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

import type { Mock } from 'vitest';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstallationManager } from './installationManager.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    existsSync: vi.fn(actual.existsSync),
  } as typeof actual;
});

vi.mock('os', async (importOriginal) => {
  const os = await importOriginal<typeof import('os')>();
  return {
    ...os,
    homedir: vi.fn(),
  };
});

vi.mock('crypto', async (importOriginal) => {
  const crypto = await importOriginal<typeof import('crypto')>();
  return {
    ...crypto,
    randomUUID: vi.fn(),
  };
});

describe('InstallationManager', () => {
  let tempHomeDir: string;
  let installationManager: InstallationManager;
  const installationIdFile = () =>
    path.join(tempHomeDir, '.codey', 'installation_id');

  beforeEach(() => {
    tempHomeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gemini-cli-test-home-'),
    );
    (os.homedir as Mock).mockReturnValue(tempHomeDir);
    installationManager = new InstallationManager();
  });

  afterEach(() => {
    fs.rmSync(tempHomeDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('getInstallationId', () => {
    it('should create and write a new installation ID if one does not exist', () => {
      const newId = 'new-uuid-123';
      (randomUUID as Mock).mockReturnValue(newId);

      const installationId = installationManager.getInstallationId();

      expect(installationId).toBe(newId);
      expect(fs.existsSync(installationIdFile())).toBe(true);
      expect(fs.readFileSync(installationIdFile(), 'utf-8')).toBe(newId);
    });

    it('should read an existing installation ID from a file', () => {
      const existingId = 'existing-uuid-123';
      fs.mkdirSync(path.dirname(installationIdFile()), { recursive: true });
      fs.writeFileSync(installationIdFile(), existingId);

      const installationId = installationManager.getInstallationId();

      expect(installationId).toBe(existingId);
    });

    it('should return the same ID on subsequent calls', () => {
      const firstId = installationManager.getInstallationId();
      const secondId = installationManager.getInstallationId();
      expect(secondId).toBe(firstId);
    });

    it('should handle read errors and return a fallback ID', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      const readSpy = vi.mocked(fs.readFileSync);
      readSpy.mockImplementationOnce(() => {
        throw new Error('Read error');
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const id = installationManager.getInstallationId();

      expect(id).toBe('123456789');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
