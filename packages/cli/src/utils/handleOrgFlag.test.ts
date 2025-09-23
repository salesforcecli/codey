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

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import { handleOrgFlag } from './handleOrgFlag.js';
import type { LoadedSettings } from '../config/settings.js';

describe('handleOrgFlag', () => {
  const originalOrg = process.env['CODEY_GATEWAY_ORG'];
  const originalGemini = process.env['GEMINI_API_KEY'];

  let exitSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    // Clean target env vars before each test to avoid cross-test pollution
    delete process.env['CODEY_GATEWAY_ORG'];
    delete process.env['GEMINI_API_KEY'];

    // Mock process.exit to avoid terminating the test process. Throw to stop execution in error path.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      // Throw to simulate real exit and prevent code after process.exit from running
      throw new Error(`process.exit: ${code ?? 'undefined'}`);
    }) as unknown as typeof process.exit);

    // Silence error output in tests while still allowing assertions
    errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((() => {}) as unknown as (
        ..._args: unknown[]
      ) => void);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original env
    if (originalOrg === undefined) {
      delete process.env['CODEY_GATEWAY_ORG'];
    } else {
      process.env['CODEY_GATEWAY_ORG'] = originalOrg;
    }
    if (originalGemini === undefined) {
      delete process.env['GEMINI_API_KEY'];
    } else {
      process.env['GEMINI_API_KEY'] = originalGemini;
    }
  });

  it('sets CODEY_GATEWAY_ORG from provided org and refreshes settings', () => {
    const settings = { refresh: vi.fn() } as unknown as LoadedSettings;

    handleOrgFlag('user@example.com', settings);

    expect(process.env['CODEY_GATEWAY_ORG']).toBe('user@example.com');
    expect(settings.refresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('uses existing CODEY_GATEWAY_ORG when org is undefined', () => {
    process.env['CODEY_GATEWAY_ORG'] = 'preexisting@example.com';
    const settings = { refresh: vi.fn() } as unknown as LoadedSettings;

    handleOrgFlag(undefined, settings);

    expect(process.env['CODEY_GATEWAY_ORG']).toBe('preexisting@example.com');
    expect(settings.refresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not exit when GEMINI_API_KEY is set even if org is missing', () => {
    process.env['GEMINI_API_KEY'] = 'test-key';
    const settings = { refresh: vi.fn() } as unknown as LoadedSettings;

    handleOrgFlag(undefined, settings);

    // Implementation sets CODEY_GATEWAY_ORG to empty string when not provided
    expect(process.env['CODEY_GATEWAY_ORG']).toBe('');
    expect(settings.refresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints error and exits with code 1 when neither org nor GEMINI_API_KEY is set', () => {
    const settings = { refresh: vi.fn() } as unknown as LoadedSettings;

    let thrown: unknown;
    try {
      handleOrgFlag(undefined, settings);
    } catch (e) {
      thrown = e;
    }

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = (errorSpy.mock.calls[0]?.[0] ?? '') as string;
    expect(message).toMatch(/No org specified/i);

    expect(exitSpy).toHaveBeenCalledWith(1);
    // Ensure refresh was not called, since we simulate exit by throwing
    expect(settings.refresh).not.toHaveBeenCalled();

    // Verify our simulated exit was the thrown error
    expect(String(thrown)).toContain('process.exit: 1');
  });
});
