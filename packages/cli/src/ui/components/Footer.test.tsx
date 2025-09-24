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

import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { Footer } from './Footer.js';
import * as useTerminalSize from '../hooks/useTerminalSize.js';
import { tildeifyPath } from '@salesforce/codey-core';
import path from 'node:path';

vi.mock('../hooks/useTerminalSize.js');
const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);

vi.mock('@salesforce/codey-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@salesforce/codey-core')>();
  return {
    ...original,
    shortenPath: (p: string, len: number) => {
      if (p.length > len) {
        return '...' + p.slice(p.length - len + 3);
      }
      return p;
    },
  };
});

const defaultProps = {
  model: 'gemini-pro',
  targetDir:
    '/Users/test/project/foo/bar/and/some/more/directories/to/make/it/long',
  branchName: 'main',
  debugMode: false,
  debugMessage: '',
  corgiMode: false,
  errorCount: 0,
  showErrorDetails: false,
  showMemoryUsage: false,
  promptTokenCount: 100,
  nightly: false,
};

const renderWithWidth = (width: number, props = defaultProps) => {
  useTerminalSizeMock.mockReturnValue({ columns: width, rows: 24 });
  return render(<Footer {...props} />);
};

describe('<Footer />', () => {
  it('renders the component', () => {
    const { lastFrame } = renderWithWidth(120);
    expect(lastFrame()).toBeDefined();
  });

  describe('path display', () => {
    it('should display shortened path on a wide terminal', () => {
      const { lastFrame } = renderWithWidth(120);
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const expectedPath = '...' + tildePath.slice(tildePath.length - 48 + 3);
      expect(lastFrame()).toContain(expectedPath);
    });

    it('should display only the base directory name on a narrow terminal', () => {
      const { lastFrame } = renderWithWidth(79);
      const expectedPath = path.basename(defaultProps.targetDir);
      expect(lastFrame()).toContain(expectedPath);
    });

    it('should use wide layout at 80 columns', () => {
      const { lastFrame } = renderWithWidth(80);
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const expectedPath = '...' + tildePath.slice(tildePath.length - 32 + 3);
      expect(lastFrame()).toContain(expectedPath);
    });

    it('should use narrow layout at 79 columns', () => {
      const { lastFrame } = renderWithWidth(79);
      const expectedPath = path.basename(defaultProps.targetDir);
      expect(lastFrame()).toContain(expectedPath);
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const unexpectedPath = '...' + tildePath.slice(tildePath.length - 31 + 3);
      expect(lastFrame()).not.toContain(unexpectedPath);
    });
  });

  it('displays the branch name when provided', () => {
    const { lastFrame } = renderWithWidth(120);
    expect(lastFrame()).toContain(`(${defaultProps.branchName}*)`);
  });

  it('does not display the branch name when not provided', () => {
    const { lastFrame } = renderWithWidth(120, {
      ...defaultProps,
      branchName: undefined,
    });
    expect(lastFrame()).not.toContain(`(${defaultProps.branchName}*)`);
  });

  it('displays the model name and context percentage', () => {
    const { lastFrame } = renderWithWidth(120);
    expect(lastFrame()).toContain(defaultProps.model);
    expect(lastFrame()).toMatch(/\(\d+% context[\s\S]*left\)/);
  });

  describe('footer configuration filtering (golden snapshots)', () => {
    it('renders complete footer with all sections visible (baseline)', () => {
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        hideCWD: false,
        hideSandboxStatus: false,
        hideModelInfo: false,
      });
      expect(lastFrame()).toMatchSnapshot('complete-footer-wide');
    });

    it('renders footer with all optional sections hidden (minimal footer)', () => {
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        hideCWD: true,
        hideSandboxStatus: true,
        hideModelInfo: true,
      });
      expect(lastFrame()).toMatchSnapshot('footer-minimal');
    });

    it('renders footer with only model info hidden (partial filtering)', () => {
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        hideCWD: false,
        hideSandboxStatus: false,
        hideModelInfo: true,
      });
      expect(lastFrame()).toMatchSnapshot('footer-no-model');
    });

    it('renders footer with CWD and model info hidden to test alignment (only sandbox visible)', () => {
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        hideCWD: true,
        hideSandboxStatus: false,
        hideModelInfo: true,
      });
      expect(lastFrame()).toMatchSnapshot('footer-only-sandbox');
    });

    it('renders complete footer in narrow terminal (baseline narrow)', () => {
      const { lastFrame } = renderWithWidth(79, {
        ...defaultProps,
        hideCWD: false,
        hideSandboxStatus: false,
        hideModelInfo: false,
      });
      expect(lastFrame()).toMatchSnapshot('complete-footer-narrow');
    });
  });
});
