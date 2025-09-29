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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newCommand } from './new.js';
import yargs from 'yargs';
import * as fsPromises from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockedFs = vi.mocked(fsPromises);

describe('extensions new command', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    const fakeFiles = [
      { name: 'context', isDirectory: () => true },
      { name: 'custom-commands', isDirectory: () => true },
      { name: 'mcp-server', isDirectory: () => true },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFs.readdir.mockResolvedValue(fakeFiles as any);
  });

  it('should fail if no path is provided', async () => {
    const parser = yargs([]).command(newCommand).fail(false).locale('en');
    await expect(parser.parseAsync('new')).rejects.toThrow(
      'Not enough non-option arguments: got 0, need at least 2',
    );
  });

  it('should fail if no template is provided', async () => {
    const parser = yargs([]).command(newCommand).fail(false).locale('en');
    await expect(parser.parseAsync('new /some/path')).rejects.toThrow(
      'Not enough non-option arguments: got 1, need at least 2',
    );
  });

  it('should create directory and copy files when path does not exist', async () => {
    mockedFs.access.mockRejectedValue(new Error('ENOENT'));
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.cp.mockResolvedValue(undefined);

    const parser = yargs([]).command(newCommand).fail(false);

    await parser.parseAsync('new /some/path context');

    expect(mockedFs.mkdir).toHaveBeenCalledWith('/some/path', {
      recursive: true,
    });
    expect(mockedFs.cp).toHaveBeenCalledWith(
      expect.stringContaining('context/context'),
      '/some/path/context',
      { recursive: true },
    );
    expect(mockedFs.cp).toHaveBeenCalledWith(
      expect.stringContaining('context/custom-commands'),
      '/some/path/custom-commands',
      { recursive: true },
    );
    expect(mockedFs.cp).toHaveBeenCalledWith(
      expect.stringContaining('context/mcp-server'),
      '/some/path/mcp-server',
      { recursive: true },
    );
  });

  it('should throw an error if the path already exists', async () => {
    mockedFs.access.mockResolvedValue(undefined);
    const parser = yargs([]).command(newCommand).fail(false);

    await expect(parser.parseAsync('new /some/path context')).rejects.toThrow(
      'Path already exists: /some/path',
    );

    expect(mockedFs.mkdir).not.toHaveBeenCalled();
    expect(mockedFs.cp).not.toHaveBeenCalled();
  });
});
