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

let detectionComplete = false;
let protocolSupported = false;
let protocolEnabled = false;

/**
 * Detects Kitty keyboard protocol support.
 * Definitive document about this protocol lives at https://sw.kovidgoyal.net/kitty/keyboard-protocol/
 * This function should be called once at app startup.
 */
export async function detectAndEnableKittyProtocol(): Promise<boolean> {
  if (detectionComplete) {
    return protocolSupported;
  }

  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      detectionComplete = true;
      resolve(false);
      return;
    }

    const originalRawMode = process.stdin.isRaw;
    if (!originalRawMode) {
      process.stdin.setRawMode(true);
    }

    let responseBuffer = '';
    let progressiveEnhancementReceived = false;
    let checkFinished = false;

    const handleData = (data: Buffer) => {
      responseBuffer += data.toString();

      // Check for progressive enhancement response (CSI ? <flags> u)
      if (responseBuffer.includes('\x1b[?') && responseBuffer.includes('u')) {
        progressiveEnhancementReceived = true;
      }

      // Check for device attributes response (CSI ? <attrs> c)
      if (responseBuffer.includes('\x1b[?') && responseBuffer.includes('c')) {
        if (!checkFinished) {
          checkFinished = true;
          process.stdin.removeListener('data', handleData);

          if (!originalRawMode) {
            process.stdin.setRawMode(false);
          }

          if (progressiveEnhancementReceived) {
            // Enable the protocol
            process.stdout.write('\x1b[>1u');
            protocolSupported = true;
            protocolEnabled = true;

            // Set up cleanup on exit
            process.on('exit', disableProtocol);
            process.on('SIGTERM', disableProtocol);
          }

          detectionComplete = true;
          resolve(protocolSupported);
        }
      }
    };

    process.stdin.on('data', handleData);

    // Send queries
    process.stdout.write('\x1b[?u'); // Query progressive enhancement
    process.stdout.write('\x1b[c'); // Query device attributes

    // Timeout after configurable ms (default 50ms)
    const timeoutMs =
      Number(process.env['CODEY_KITTY_PROTOCOL_TIMEOUT_MS']) || 100;
    setTimeout(() => {
      if (!checkFinished) {
        process.stdin.removeListener('data', handleData);
        if (!originalRawMode) {
          process.stdin.setRawMode(false);
        }
        detectionComplete = true;
        resolve(false);
      }
    }, timeoutMs);
  });
}

function disableProtocol() {
  if (protocolEnabled) {
    process.stdout.write('\x1b[<u');
    protocolEnabled = false;
  }
}

export function isKittyProtocolEnabled(): boolean {
  return protocolEnabled;
}

export function isKittyProtocolSupported(): boolean {
  return protocolSupported;
}
