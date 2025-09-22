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

import { renderWithProviders } from '../../test-utils/render.js';
import { waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { FolderTrustDialog, FolderTrustChoice } from './FolderTrustDialog.js';
import * as processUtils from '../../utils/processUtils.js';

vi.mock('../../utils/processUtils.js', () => ({
  relaunchApp: vi.fn(),
}));

const mockedExit = vi.hoisted(() => vi.fn());
const mockedCwd = vi.hoisted(() => vi.fn());

vi.mock('node:process', async () => {
  const actual = await vi.importActual('process');
  return {
    ...actual,
    exit: mockedExit,
    cwd: mockedCwd,
  };
});

describe('FolderTrustDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCwd.mockReturnValue('/home/user/project');
  });

  it('should render the dialog with title and description', () => {
    const { lastFrame } = renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Do you trust this folder?');
    expect(lastFrame()).toContain(
      'Trusting a folder allows Gemini to execute commands it suggests.',
    );
  });

  it('should call onSelect with DO_NOT_TRUST when escape is pressed and not restarting', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderWithProviders(
      <FolderTrustDialog onSelect={onSelect} isRestarting={false} />,
    );

    stdin.write('\x1b'); // escape key

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(FolderTrustChoice.DO_NOT_TRUST);
    });
  });

  it('should not call onSelect when escape is pressed and is restarting', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderWithProviders(
      <FolderTrustDialog onSelect={onSelect} isRestarting={true} />,
    );

    stdin.write('\x1b'); // escape key

    await waitFor(() => {
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it('should display restart message when isRestarting is true', () => {
    const { lastFrame } = renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} isRestarting={true} />,
    );

    expect(lastFrame()).toContain(' Gemini CLI is restarting');
  });

  it('should call relaunchApp when isRestarting is true', async () => {
    vi.useFakeTimers();
    const relaunchApp = vi.spyOn(processUtils, 'relaunchApp');
    renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} isRestarting={true} />,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(relaunchApp).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not call process.exit when "r" is pressed and isRestarting is false', async () => {
    const { stdin } = renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} isRestarting={false} />,
    );

    stdin.write('r');

    await waitFor(() => {
      expect(mockedExit).not.toHaveBeenCalled();
    });
  });

  describe('directory display', () => {
    it('should correctly display the folder name for a nested directory', () => {
      mockedCwd.mockReturnValue('/home/user/project');
      const { lastFrame } = renderWithProviders(
        <FolderTrustDialog onSelect={vi.fn()} />,
      );
      expect(lastFrame()).toContain('Trust folder (project)');
    });

    it('should correctly display the parent folder name for a nested directory', () => {
      mockedCwd.mockReturnValue('/home/user/project');
      const { lastFrame } = renderWithProviders(
        <FolderTrustDialog onSelect={vi.fn()} />,
      );
      expect(lastFrame()).toContain('Trust parent folder (user)');
    });

    it('should correctly display an empty parent folder name for a directory directly under root', () => {
      mockedCwd.mockReturnValue('/project');
      const { lastFrame } = renderWithProviders(
        <FolderTrustDialog onSelect={vi.fn()} />,
      );
      expect(lastFrame()).toContain('Trust parent folder ()');
    });
  });
});
