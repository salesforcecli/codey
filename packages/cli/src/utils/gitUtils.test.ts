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

import { vi, describe, expect, it, afterEach, beforeEach } from 'vitest';
import * as child_process from 'node:child_process';
import {
  isGitHubRepository,
  getGitRepoRoot,
  getLatestGitHubRelease,
  getGitHubRepoInfo,
} from './gitUtils.js';

vi.mock('child_process');

describe('isGitHubRepository', async () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false if the git command fails', async () => {
    vi.mocked(child_process.execSync).mockImplementation((): string => {
      throw new Error('oops');
    });
    expect(isGitHubRepository()).toBe(false);
  });

  it('returns false if the remote is not github.com', async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce('https://gitlab.com');
    expect(isGitHubRepository()).toBe(false);
  });

  it('returns true if the remote is github.com', async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce(`
      origin  https://github.com/sethvargo/gemini-cli (fetch)
      origin  https://github.com/sethvargo/gemini-cli (push)
    `);
    expect(isGitHubRepository()).toBe(true);
  });
});

describe('getGitHubRepoInfo', async () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an error if github repo info cannot be determined', async () => {
    vi.mocked(child_process.execSync).mockImplementation((): string => {
      throw new Error('oops');
    });
    expect(() => {
      getGitHubRepoInfo();
    }).toThrowError(/oops/);
  });

  it('throws an error if owner/repo could not be determined', async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce('');
    expect(() => {
      getGitHubRepoInfo();
    }).toThrowError(/Owner & repo could not be extracted from remote URL/);
  });

  it('returns the owner and repo', async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce(
      'https://github.com/owner/repo.git ',
    );
    expect(getGitHubRepoInfo()).toEqual({ owner: 'owner', repo: 'repo' });
  });
});

describe('getGitRepoRoot', async () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an error if git root cannot be determined', async () => {
    vi.mocked(child_process.execSync).mockImplementation((): string => {
      throw new Error('oops');
    });
    expect(() => {
      getGitRepoRoot();
    }).toThrowError(/oops/);
  });

  it('throws an error if git root is empty', async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce('');
    expect(() => {
      getGitRepoRoot();
    }).toThrowError(/Git repo returned empty value/);
  });

  it('returns the root', async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce('/path/to/git/repo');
    expect(getGitRepoRoot()).toBe('/path/to/git/repo');
  });
});

describe('getLatestRelease', async () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an error if the fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.reject('nope'));
    await expect(getLatestGitHubRelease()).rejects.toThrowError(
      /Unable to determine the latest/,
    );
  });

  it('throws an error if the fetch does not return a json body', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ foo: 'bar' }),
      } as Response),
    );
    await expect(getLatestGitHubRelease()).rejects.toThrowError(
      /Unable to determine the latest/,
    );
  });

  it('returns the release version', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ tag_name: 'v1.2.3' }),
      } as Response),
    );
    await expect(getLatestGitHubRelease()).resolves.toBe('v1.2.3');
  });
});
