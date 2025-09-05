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

import { describe, it, expect } from 'vitest';
import { installCommand, handleInstall } from './install.js';
import yargs from 'yargs';
import * as extension from '../../config/extension.js';

vi.mock('../../config/extension.js', () => ({
  installExtension: vi.fn(),
}));

describe('extensions install command', () => {
  it('should fail if no source is provided', () => {
    const validationParser = yargs([]).command(installCommand).fail(false);
    expect(() => validationParser.parse('install')).toThrow(
      'Either source or --path must be provided.',
    );
  });

  it('should fail if both git source and local path are provided', () => {
    const validationParser = yargs([]).command(installCommand).fail(false);
    expect(() =>
      validationParser.parse('install some-url --path /some/path'),
    ).toThrow('Arguments source and path are mutually exclusive');
  });
});

describe('extensions install with org/repo', () => {
  it('should call installExtension with the correct git URL', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const installExtensionSpy = vi
      .spyOn(extension, 'installExtension')
      .mockResolvedValue('test-extension');

    await handleInstall({ source: 'test-org/test-repo' });

    expect(installExtensionSpy).toHaveBeenCalledWith({
      source: 'https://github.com/test-org/test-repo.git',
      type: 'git',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Extension "test-extension" installed successfully and enabled.',
    );
  });
});
