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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeDialog } from './ThemeDialog.js';
import { LoadedSettings } from '../../config/settings.js';
import { KeypressProvider } from '../contexts/KeypressContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import { DEFAULT_THEME, themeManager } from '../themes/theme-manager.js';
import { act } from 'react';

const createMockSettings = (
  userSettings = {},
  workspaceSettings = {},
  systemSettings = {},
): LoadedSettings =>
  new LoadedSettings(
    {
      settings: { ui: { customThemes: {} }, ...systemSettings },
      path: '/system/settings.json',
    },
    {
      settings: {},
      path: '/system/system-defaults.json',
    },
    {
      settings: {
        ui: { customThemes: {} },
        ...userSettings,
      },
      path: '/user/settings.json',
    },
    {
      settings: {
        ui: { customThemes: {} },
        ...workspaceSettings,
      },
      path: '/workspace/settings.json',
    },
    true,
    new Set(),
  );

describe('ThemeDialog Snapshots', () => {
  const baseProps = {
    onSelect: vi.fn(),
    onHighlight: vi.fn(),
    availableTerminalHeight: 40,
    terminalWidth: 120,
  };

  beforeEach(() => {
    // Reset theme manager to a known state
    themeManager.setActiveTheme(DEFAULT_THEME.name);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render correctly in theme selection mode', () => {
    const settings = createMockSettings();
    const { lastFrame } = render(
      <SettingsContext.Provider value={settings}>
        <KeypressProvider kittyProtocolEnabled={false}>
          <ThemeDialog {...baseProps} settings={settings} />
        </KeypressProvider>
      </SettingsContext.Provider>,
    );

    expect(lastFrame()).toMatchSnapshot();
  });

  it('should render correctly in scope selector mode', async () => {
    const settings = createMockSettings();
    const { lastFrame, stdin } = render(
      <SettingsContext.Provider value={settings}>
        <KeypressProvider kittyProtocolEnabled={false}>
          <ThemeDialog {...baseProps} settings={settings} />
        </KeypressProvider>
      </SettingsContext.Provider>,
    );

    // Press Tab to switch to scope selector mode
    act(() => {
      stdin.write('\t');
    });

    // Need to wait for the state update to propagate
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(lastFrame()).toMatchSnapshot();
  });
});
