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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FunctionCallAccumulator,
  type ParsedCall,
} from './functionCallAccumulator.js';

describe('FunctionCallAccumulator', () => {
  let accumulator: FunctionCallAccumulator;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    accumulator = new FunctionCallAccumulator();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty state', () => {
      const newAccumulator = new FunctionCallAccumulator();
      const result = newAccumulator.feed('');
      expect(result).toEqual({ calls: [], text: '' });
    });
  });

  describe('feed method', () => {
    describe('basic text processing', () => {
      it('should buffer plain text when no function calls are present', () => {
        const result = accumulator.feed('Hello, world!');
        expect(result).toEqual({
          calls: [],
          text: '', // Text is buffered until flush() is called
        });

        const flushResult = accumulator.flush();
        expect(flushResult.text).toBe('Hello, world!');
      });

      it('should handle empty input', () => {
        const result = accumulator.feed('');
        expect(result).toEqual({
          calls: [],
          text: '',
        });
      });

      it('should accumulate text across multiple feed calls', () => {
        const result1 = accumulator.feed('Hello, ');
        const result2 = accumulator.feed('world!');

        expect(result1).toEqual({ calls: [], text: '' });
        expect(result2).toEqual({ calls: [], text: '' });

        const finalResult = accumulator.flush();
        expect(finalResult.text).toBe('Hello, world!');
      });
    });

    describe('function call detection and parsing', () => {
      it('should extract a simple function call', () => {
        const functionCallJson =
          '{"functionCall": {"name": "testFunction", "args": {"param1": "value1"}}}';
        const result = accumulator.feed(functionCallJson);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0]).toEqual({
          name: 'testFunction',
          args: { param1: 'value1' },
          id: undefined,
        });
        expect(result.text).toBe('');
      });

      it('should extract function call with id', () => {
        const functionCallJson =
          '{"functionCall": {"name": "testFunction", "args": {"param1": "value1"}, "id": "call123"}}';
        const result = accumulator.feed(functionCallJson);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0]).toEqual({
          name: 'testFunction',
          args: { param1: 'value1' },
          id: 'call123',
        });
      });

      it('should extract function call without args', () => {
        const functionCallJson = '{"functionCall": {"name": "testFunction"}}';
        const result = accumulator.feed(functionCallJson);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0]).toEqual({
          name: 'testFunction',
          args: {},
          id: undefined,
        });
      });

      it('should handle function call mixed with text', () => {
        const input =
          'Some text before {"functionCall": {"name": "testFunction"}} and after';
        const result = accumulator.feed(input);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].name).toBe('testFunction');
        expect(result.text).toBe('Some text before '); // Only text before function call is returned

        const flushResult = accumulator.flush();
        expect(flushResult.text).toBe(' and after'); // Remaining text from flush
      });

      it('should extract multiple function calls from single input', () => {
        const input =
          '{"functionCall": {"name": "func1"}} text {"functionCall": {"name": "func2"}}';
        const result = accumulator.feed(input);

        expect(result.calls).toHaveLength(2);
        expect(result.calls[0].name).toBe('func1');
        expect(result.calls[1].name).toBe('func2');
        expect(result.text).toBe(' text ');
      });
    });

    describe('streaming behavior', () => {
      it('should handle function call split across multiple chunks', () => {
        const chunk1 = '{"functionCall": {"name": "test';
        const chunk2 = 'Function", "args": {"param": "val';
        const chunk3 = 'ue"}}}';

        const result1 = accumulator.feed(chunk1);
        const result2 = accumulator.feed(chunk2);
        const result3 = accumulator.feed(chunk3);

        expect(result1.calls).toHaveLength(0);
        expect(result2.calls).toHaveLength(0);
        expect(result3.calls).toHaveLength(1);
        expect(result3.calls[0]).toEqual({
          name: 'testFunction',
          args: { param: 'value' },
          id: undefined,
        });
      });

      it('should handle text before function call split across chunks', () => {
        const chunk1 = 'Some text ';
        const chunk2 = 'before {"functionCall": {"name": "testFunction"}}';

        const result1 = accumulator.feed(chunk1);
        const result2 = accumulator.feed(chunk2);

        expect(result1.calls).toHaveLength(0);
        expect(result1.text).toBe('');
        expect(result2.calls).toHaveLength(1);
        expect(result2.text).toBe('Some text before ');
      });
    });

    describe('JSON parsing edge cases', () => {
      it('should handle escaped quotes in function call strings', () => {
        const functionCallJson =
          '{"functionCall": {"name": "testFunction", "args": {"message": "Hello \\"world\\""}}}';
        const result = accumulator.feed(functionCallJson);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].args).toEqual({ message: 'Hello "world"' });
      });

      it('should handle nested JSON objects in args', () => {
        const functionCallJson =
          '{"functionCall": {"name": "testFunction", "args": {"nested": {"key": "value"}}}}';
        const result = accumulator.feed(functionCallJson);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].args).toEqual({ nested: { key: 'value' } });
      });

      it('should handle arrays in function call args', () => {
        const functionCallJson =
          '{"functionCall": {"name": "testFunction", "args": {"items": [1, 2, 3]}}}';
        const result = accumulator.feed(functionCallJson);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].args).toEqual({ items: [1, 2, 3] });
      });

      it('should ignore invalid JSON that contains functionCall', () => {
        const invalidJson =
          '{"functionCall": {"name": "testFunction", "args": {invalid}}}';
        const result = accumulator.feed(invalidJson);

        expect(result.calls).toHaveLength(0);
        expect(result.text).toBe(invalidJson);
      });

      it('should ignore JSON objects that are not function calls', () => {
        const nonFunctionCall =
          '{"someOtherProperty": {"name": "testFunction"}}';
        const result = accumulator.feed(nonFunctionCall);

        expect(result.calls).toHaveLength(0);
        expect(result.text).toBe(''); // Text is buffered until flush

        const flushResult = accumulator.flush();
        expect(flushResult.text).toBe(nonFunctionCall);
      });

      it('should ignore function calls with invalid structure (missing name)', () => {
        const invalidFunctionCall =
          '{"functionCall": {"args": {"param": "value"}}}';
        const result = accumulator.feed(invalidFunctionCall);

        expect(result.calls).toHaveLength(0);
        expect(result.text).toBe(invalidFunctionCall);
      });

      it('should ignore function calls with non-string name', () => {
        const invalidFunctionCall =
          '{"functionCall": {"name": 123, "args": {"param": "value"}}}';
        const result = accumulator.feed(invalidFunctionCall);

        expect(result.calls).toHaveLength(0);
        expect(result.text).toBe(invalidFunctionCall);
      });
    });

    describe('buffer management', () => {
      it('should flush text when buffer exceeds LOOKBACK_SIZE without function calls', () => {
        const longText = 'a'.repeat(250); // Exceeds LOOKBACK_SIZE (200)
        const result = accumulator.feed(longText);

        expect(result.text.length).toBeGreaterThan(0);
        expect(result.text.length).toBeLessThan(longText.length);
      });

      it('should maintain LOOKBACK_SIZE characters in buffer for potential function calls', () => {
        const longText = 'a'.repeat(250);
        const result = accumulator.feed(longText);

        // Should flush some text when buffer exceeds LOOKBACK_SIZE
        expect(result.text.length).toBeGreaterThan(0);

        const finalResult = accumulator.flush();
        // Total text should equal original
        expect(result.text + finalResult.text).toBe(longText);
      });
    });

    describe('complex scenarios', () => {
      it('should handle multiple function calls with text interspersed', () => {
        const input =
          'Start {"functionCall": {"name": "func1"}} middle {"functionCall": {"name": "func2"}} end';
        const result = accumulator.feed(input);

        expect(result.calls).toHaveLength(2);
        expect(result.calls[0].name).toBe('func1');
        expect(result.calls[1].name).toBe('func2');
        expect(result.text).toBe('Start  middle '); // Only text before function calls

        const flushResult = accumulator.flush();
        expect(flushResult.text).toBe(' end'); // Remaining text
      });

      it('should handle function call at the very beginning', () => {
        const input =
          '{"functionCall": {"name": "testFunction"}} followed by text';
        const result = accumulator.feed(input);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].name).toBe('testFunction');
        expect(result.text).toBe(''); // No text before function call

        const flushResult = accumulator.flush();
        expect(flushResult.text).toBe(' followed by text');
      });

      it('should handle function call at the very end', () => {
        const input = 'Text before {"functionCall": {"name": "testFunction"}}';
        const result = accumulator.feed(input);

        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].name).toBe('testFunction');
        expect(result.text).toBe('Text before ');
      });

      it('should handle consecutive function calls without text between', () => {
        const input =
          '{"functionCall": {"name": "func1"}}{"functionCall": {"name": "func2"}}';
        const result = accumulator.feed(input);

        expect(result.calls).toHaveLength(2);
        expect(result.calls[0].name).toBe('func1');
        expect(result.calls[1].name).toBe('func2');
        expect(result.text).toBe('');
      });
    });
  });

  describe('flush method', () => {
    it('should return empty result when buffer is empty', () => {
      const result = accumulator.flush();
      expect(result).toEqual({ calls: [], text: '' });
    });

    it('should return remaining text when not capturing', () => {
      accumulator.feed('Some text without function calls');
      const result = accumulator.flush();

      expect(result.calls).toHaveLength(0);
      expect(result.text).toBe('Some text without function calls');
    });

    it('should parse complete function call when capturing', () => {
      // Feed incomplete function call that starts capturing
      const result1 = accumulator.feed(
        '{"functionCall": {"name": "testFunction"',
      );
      expect(result1.calls).toHaveLength(0); // Not complete yet

      // Complete the function call
      const result2 = accumulator.feed(', "args": {"param": "value"}}}');
      expect(result2.calls).toHaveLength(1);
      expect(result2.calls[0]).toEqual({
        name: 'testFunction',
        args: { param: 'value' },
        id: undefined,
      });
    });

    it('should warn and drop incomplete function call when capturing invalid JSON', () => {
      accumulator.feed(
        '{"functionCall": {"name": "testFunction", "args": {invalid',
      );

      const result = accumulator.flush();

      expect(result.calls).toHaveLength(0);
      expect(result.text).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FunctionCallAccumulator] Dropping incomplete function call at end of stream:',
        expect.stringContaining(
          '{"functionCall": {"name": "testFunction", "args": {invalid',
        ),
      );
    });

    it('should extract text before incomplete function call and warn', () => {
      // This will start capturing when it sees "functionCall", so flush will be in capturing mode
      accumulator.feed('Some text {"functionCall": {"name": "incomplete');

      const result = accumulator.flush();

      expect(result.calls).toHaveLength(0);
      expect(result.text).toBe(''); // In capturing mode, incomplete JSON is dropped
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FunctionCallAccumulator] Dropping incomplete function call at end of stream:',
        expect.stringContaining('{"functionCall": {"name": "incomplete'),
      );
    });

    it('should extract text before incomplete function call in non-capturing mode', () => {
      // Use a scenario where we have text with "functionCall" but no opening brace found
      accumulator.feed('Some text with "functionCall" but no brace');

      const result = accumulator.flush();

      expect(result.calls).toHaveLength(0);
      expect(result.text).toBe('Some text with "functionCall" but no brace');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle text with "functionCall" string but no valid JSON structure', () => {
      accumulator.feed('This text mentions "functionCall" but has no JSON');

      const result = accumulator.flush();

      expect(result.calls).toHaveLength(0);
      expect(result.text).toBe(
        'This text mentions "functionCall" but has no JSON',
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should reset accumulator state after flush', () => {
      accumulator.feed('Some text');
      accumulator.flush();

      // Verify state is reset by checking subsequent operations
      const result = accumulator.feed('New text');
      expect(result.text).toBe('');

      const finalResult = accumulator.flush();
      expect(finalResult.text).toBe('New text');
    });
  });

  describe('reset method', () => {
    it('should reset all internal state', () => {
      // Set up some state
      accumulator.feed('{"functionCall": {"name": "test');

      // Reset
      accumulator.reset();

      // Verify state is clean
      const result = accumulator.feed('New text');
      expect(result).toEqual({ calls: [], text: '' });

      const flushResult = accumulator.flush();
      expect(flushResult.text).toBe('New text');
    });

    it('should allow reuse after reset', () => {
      // Use accumulator
      accumulator.feed('{"functionCall": {"name": "testFunction"}}');
      accumulator.reset();

      // Reuse after reset
      const result = accumulator.feed(
        '{"functionCall": {"name": "newFunction"}}',
      );
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0].name).toBe('newFunction');
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic streaming scenario with mixed content', () => {
      const chunks = [
        'Here is some response text. ',
        'I need to call a function: {"functionCall": ',
        '{"name": "searchFiles", "args": {"pattern": "*.ts"}}} ',
        'Now I have the results and can continue with more text.',
      ];

      const allCalls: ParsedCall[] = [];
      let allText = '';

      chunks.forEach((chunk) => {
        const result = accumulator.feed(chunk);
        allCalls.push(...result.calls);
        allText += result.text;
      });

      const finalResult = accumulator.flush();
      allCalls.push(...finalResult.calls);
      allText += finalResult.text;

      expect(allCalls).toHaveLength(1);
      expect(allCalls[0]).toEqual({
        name: 'searchFiles',
        args: { pattern: '*.ts' },
        id: undefined,
      });
      expect(allText).toBe(
        'Here is some response text. I need to call a function:  Now I have the results and can continue with more text.',
      );
    });

    it('should handle multiple function calls in streaming scenario', () => {
      const chunks = [
        'First, I\'ll search: {"functionCall": {"name": "search", "args": {"query": "test"}}} ',
        'Then I\'ll read: {"functionCall": {"name": "readFile", "args": {"path": "test.ts"}}} ',
        'Finally, some conclusion text.',
      ];

      const allCalls: ParsedCall[] = [];
      let allText = '';

      chunks.forEach((chunk) => {
        const result = accumulator.feed(chunk);
        allCalls.push(...result.calls);
        allText += result.text;
      });

      const finalResult = accumulator.flush();
      allCalls.push(...finalResult.calls);
      allText += finalResult.text;

      expect(allCalls).toHaveLength(2);
      expect(allCalls[0].name).toBe('search');
      expect(allCalls[1].name).toBe('readFile');
      expect(allText).toBe(
        "First, I'll search:  Then I'll read:  Finally, some conclusion text.",
      );
    });

    it('should handle edge case with function call split at critical boundaries', () => {
      // Split right at the opening brace
      const result1 = accumulator.feed('Text before {');
      const result2 = accumulator.feed(
        '"functionCall": {"name": "testFunction"}}',
      );

      expect(result1.calls).toHaveLength(0);
      expect(result2.calls).toHaveLength(1);
      expect(result2.calls[0].name).toBe('testFunction');
      expect(result1.text + result2.text).toBe('Text before ');
    });

    it('should handle malformed JSON that starts like a function call', () => {
      const malformedJson =
        '{"functionCall": {"name": "test", "args": {malformed json here}';
      const result = accumulator.feed(malformedJson);

      // Should not extract any calls since JSON is malformed
      expect(result.calls).toHaveLength(0);
      expect(result.text).toBe('');

      const flushResult = accumulator.flush();
      expect(flushResult.calls).toHaveLength(0);
      expect(flushResult.text).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('performance and edge cases', () => {
    it('should handle very large text inputs efficiently', () => {
      const largeText = 'a'.repeat(10000);
      const result = accumulator.feed(largeText);

      // Should flush most of the text to avoid memory issues
      expect(result.text.length).toBeGreaterThan(0);

      const finalResult = accumulator.flush();
      expect((result.text + finalResult.text).length).toBe(largeText.length);
    });

    it('should handle function calls with very large args', () => {
      const largeArgs = { data: 'x'.repeat(5000) };
      const functionCallJson = `{"functionCall": {"name": "testFunction", "args": ${JSON.stringify(largeArgs)}}}`;

      const result = accumulator.feed(functionCallJson);

      expect(result.calls).toHaveLength(1);
      expect(result.calls[0].name).toBe('testFunction');
      expect(result.calls[0].args).toEqual(largeArgs);
    });

    it('should handle special characters and unicode in function calls', () => {
      const specialArgs = {
        unicode: '🚀 Hello 世界',
        special: 'Line1\nLine2\tTabbed',
        quotes: 'He said "Hello"',
      };
      const functionCallJson = `{"functionCall": {"name": "testFunction", "args": ${JSON.stringify(specialArgs)}}}`;

      const result = accumulator.feed(functionCallJson);

      expect(result.calls).toHaveLength(1);
      expect(result.calls[0].args).toEqual(specialArgs);
    });
  });
});
