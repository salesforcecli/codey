/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type ParsedCall = {
  name: string;
  args?: Record<string, unknown>;
  id?: string;
};

export type FeedResult = {
  calls: ParsedCall[];
  text: string;
};
/**
 * Incremental parser for extracting function calls from mixed text/JSON content.
 *
 * This class provides a robust way to parse function calls embedded in text content
 * while avoiding false positives and maintaining proper streaming behavior.
 */
export class FunctionCallAccumulator {
  private buf = '';
  private capturing = false;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private static readonly LOOKBACK_SIZE = 200;

  /**
   * Process a chunk of content and extract any complete function calls.
   *
   * @param chunk - The content chunk to process
   * @returns Object containing extracted function calls and remaining text
   */
  feed(chunk: string): FeedResult {
    let textOut = '';
    const calls: ParsedCall[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      // If not currently capturing a JSON object
      if (!this.capturing) {
        // First, add to buffer for lookahead
        this.buf += ch;

        // Check if we're starting to see a function call pattern
        if (this.buf.includes('"functionCall"')) {
          // Find the opening brace of the JSON object containing the function call
          const openBraceIdx = this.findOpeningBraceInBuffer();
          if (openBraceIdx !== -1) {
            // Extract text before the function call
            textOut += this.buf.substring(0, openBraceIdx);

            // Start capturing from the opening brace
            this.capturing = true;
            this.depth = 1;
            this.inString = false;
            this.escaped = false;
            this.buf = this.buf.substring(openBraceIdx);

            // Continue processing the current character as part of the JSON
            continue;
          }
        }

        // If buffer gets too large without finding a function call, flush some text
        if (this.buf.length > FunctionCallAccumulator.LOOKBACK_SIZE) {
          const flushAmount =
            this.buf.length - FunctionCallAccumulator.LOOKBACK_SIZE;
          textOut += this.buf.substring(0, flushAmount);
          this.buf = this.buf.substring(flushAmount);
        }

        continue;
      }

      // Currently capturing a JSON object
      this.buf += ch;

      if (this.inString) {
        if (this.escaped) {
          this.escaped = false;
        } else if (ch === '\\') {
          this.escaped = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        continue;
      }

      // Not in string, track JSON structure
      if (ch === '"') {
        this.inString = true;
      } else if (ch === '{') {
        this.depth++;
      } else if (ch === '}') {
        this.depth--;

        if (this.depth === 0) {
          // We have a complete JSON object, try to parse it
          const parseResult = this.tryParseBuffer();
          if (parseResult) {
            calls.push(parseResult);
          } else {
            // Not a valid function call, treat as regular text
            textOut += this.buf;
          }

          // Reset for next potential function call
          this.resetCapture();
        }
      }
    }

    return { calls, text: textOut };
  }

  /**
   * Flush any remaining content when processing is complete.
   *
   * @returns Final result with any remaining content
   */
  flush(): FeedResult {
    const calls: ParsedCall[] = [];
    let text = '';

    if (this.buf) {
      if (this.capturing) {
        // If we're in the middle of capturing, try to parse what we have
        const parseResult = this.tryParseBuffer();
        if (parseResult) {
          calls.push(parseResult);
        } else {
          // Incomplete or invalid JSON, drop it to avoid showing partial function calls
          console.warn(
            '[FunctionCallAccumulator] Dropping incomplete function call at end of stream:',
            this.buf.substring(0, 100) + '...',
          );
        }
      } else {
        // Not capturing, but we might have text content with potential partial function calls
        // Check if buffer contains potential function call start
        if (this.buf.includes('"functionCall"')) {
          const openBraceIdx = this.findOpeningBraceInBuffer();
          if (openBraceIdx !== -1) {
            // Extract text before potential function call and discard the incomplete JSON
            text = this.buf.substring(0, openBraceIdx);
            console.warn(
              '[FunctionCallAccumulator] Dropping incomplete function call at end of stream:',
              this.buf.substring(openBraceIdx, openBraceIdx + 100) + '...',
            );
          } else {
            // No valid opening brace found, treat as regular text
            text = this.buf;
          }
        } else {
          // Regular text content
          text = this.buf;
        }
      }
    }

    this.reset();
    return { calls, text };
  }

  /**
   * Reset the accumulator to initial state.
   */
  reset(): void {
    this.buf = '';
    this.capturing = false;
    this.depth = 0;
    this.inString = false;
    this.escaped = false;
  }

  /**
   * Find the opening brace of the JSON object in the current buffer.
   */
  private findOpeningBraceInBuffer(): number {
    // Look for the most recent '{' that could be the start of our function call object
    for (let i = this.buf.length - 1; i >= 0; i--) {
      if (this.buf[i] === '{') {
        return i;
      }
    }
    return -1;
  }

  /**
   * Try to parse the current buffer as a function call.
   */
  private tryParseBuffer(): ParsedCall | null {
    try {
      const parsed = JSON.parse(this.buf);

      // Check if this is a valid function call object
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.functionCall &&
        typeof parsed.functionCall === 'object' &&
        typeof parsed.functionCall.name === 'string'
      ) {
        return {
          name: parsed.functionCall.name,
          args: parsed.functionCall.args || {},
          id: parsed.functionCall.id,
        };
      }
    } catch {
      // Not valid JSON or not a function call, will be treated as text
    }

    return null;
  }

  /**
   * Reset capture state while preserving other state.
   */
  private resetCapture(): void {
    this.buf = '';
    this.capturing = false;
    this.depth = 0;
    this.inString = false;
    this.escaped = false;
  }
}
