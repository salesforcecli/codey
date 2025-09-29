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

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { shortenPath, tildeifyPath } from '@salesforce/codey-core';
import { ConsoleSummaryDisplay } from './ConsoleSummaryDisplay.js';
import { getDefaultOrgs } from '../../core/orgs.js';

import path from 'node:path';
import Gradient from 'ink-gradient';
import { MemoryUsageDisplay } from './MemoryUsageDisplay.js';
import { ContextUsageDisplay } from './ContextUsageDisplay.js';
import { DebugProfiler } from './DebugProfiler.js';

import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';

import { useUIState } from '../contexts/UIStateContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useVimMode } from '../contexts/VimModeContext.js';

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const settings = useSettings();
  const { vimEnabled, vimMode } = useVimMode();

  const {
    model,
    targetDir,
    debugMode,
    branchName,
    debugMessage,
    corgiMode,
    errorCount,
    showErrorDetails,
    promptTokenCount,
    nightly,
    // isTrustedFolder,
  } = {
    model: config.getModel(),
    targetDir: config.getTargetDir(),
    debugMode: config.getDebugMode(),
    branchName: uiState.branchName,
    debugMessage: uiState.debugMessage,
    corgiMode: uiState.corgiMode,
    errorCount: uiState.errorCount,
    showErrorDetails: uiState.showErrorDetails,
    promptTokenCount: uiState.sessionStats.lastPromptTokenCount,
    nightly: uiState.nightly,
    // isTrustedFolder: uiState.isTrustedFolder,
  };

  const showMemoryUsage =
    config.getDebugMode() || settings.merged.ui?.showMemoryUsage || false;
  const hideCWD = settings.merged.ui?.footer?.hideCWD || false;
  // const hideSandboxStatus =
  //   settings.merged.ui?.footer?.hideSandboxStatus || false;
  const hideModelInfo = settings.merged.ui?.footer?.hideModelInfo || false;

  const { columns: terminalWidth } = useTerminalSize();
  const [defaultTargetOrg, setDefaultTargetOrg] = useState<string | null>(null);
  const [defaultTargetDevhub, setDefaultTargetDevhub] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const fetchDefaultOrgs = async () => {
      try {
        const { defaultTargetOrg, defaultTargetDevhub } =
          await getDefaultOrgs();
        setDefaultTargetOrg(defaultTargetOrg);
        setDefaultTargetDevhub(defaultTargetDevhub);
      } catch {
        // Handle error silently or set to null
        setDefaultTargetOrg(null);
        setDefaultTargetDevhub(null);
      }
    };

    fetchDefaultOrgs();
  }, []);

  const isNarrow = isNarrowWidth(terminalWidth);

  // Adjust path length based on terminal width
  const pathLength = Math.max(20, Math.floor(terminalWidth * 0.4));
  const displayPath = isNarrow
    ? path.basename(tildeifyPath(targetDir))
    : shortenPath(tildeifyPath(targetDir), pathLength);

  const justifyContent = hideCWD && hideModelInfo ? 'center' : 'space-between';
  const displayVimMode = vimEnabled ? vimMode : undefined;

  return (
    <Box
      justifyContent={justifyContent}
      width="100%"
      flexDirection={isNarrow ? 'column' : 'row'}
      alignItems={isNarrow ? 'flex-start' : 'center'}
    >
      {(debugMode || displayVimMode || !hideCWD) && (
        <Box>
          {debugMode && <DebugProfiler />}
          {displayVimMode && (
            <Text color={theme.text.secondary}>[{displayVimMode}] </Text>
          )}
          {!hideCWD &&
            (nightly ? (
              <Gradient colors={theme.ui.gradient}>
                <Text>
                  {displayPath}
                  {branchName && <Text> ({branchName}*)</Text>}
                </Text>
              </Gradient>
            ) : (
              <Text color={theme.text.link}>
                {displayPath}
                {branchName && (
                  <Text color={theme.text.secondary}> ({branchName}*)</Text>
                )}
              </Text>
            ))}
          {debugMode && (
            <Text color={theme.status.error}>
              {' ' + (debugMessage || '--debug')}
            </Text>
          )}
        </Box>
      )}

      {/* Right Section: Model Info and Console Summary */}
      {(!hideModelInfo ||
        showMemoryUsage ||
        corgiMode ||
        (!showErrorDetails && errorCount > 0)) && (
        <Box alignItems="center">
          {!hideModelInfo && (
            <Box alignItems="center">
              <Text color={theme.text.accent}>
                {model}{' '}
                <ContextUsageDisplay
                  promptTokenCount={promptTokenCount}
                  model={model}
                />
              </Text>
              {showMemoryUsage && <MemoryUsageDisplay />}
            </Box>
          )}
          <Box alignItems="center" paddingLeft={2}>
            {corgiMode && (
              <Text>
                {!hideModelInfo && <Text color={theme.ui.comment}>| </Text>}
                <Text color={theme.status.error}>▼</Text>
                <Text color={theme.text.primary}>(´</Text>
                <Text color={theme.status.error}>ᴥ</Text>
                <Text color={theme.text.primary}>`)</Text>
                <Text color={theme.status.error}>▼ </Text>
              </Text>
            )}
            {!showErrorDetails && errorCount > 0 && (
              <Box>
                {!hideModelInfo && <Text color={theme.ui.comment}>| </Text>}
                <ConsoleSummaryDisplay errorCount={errorCount} />
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Second Row: Default Orgs - Only show if at least one org is configured */}
      {(defaultTargetOrg || defaultTargetDevhub) && (
        <Box
          width="100%"
          flexDirection="column"
          alignItems="flex-start"
          justifyContent="flex-start"
        >
          <Box flexDirection="column">
            {defaultTargetOrg && (
              <Text color={theme.text.primary}>
                <Text color={theme.text.primary}>
                  {defaultTargetDevhub ? '» Target: ' : '» Target: '}
                </Text>
                <Text color={theme.text.secondary}>{defaultTargetOrg}</Text>
              </Text>
            )}
            {defaultTargetDevhub && (
              <Text color={theme.text.primary}>
                <Text color={theme.text.primary}>» Devhub: </Text>
                <Text color={theme.text.secondary}>{defaultTargetDevhub}</Text>
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
