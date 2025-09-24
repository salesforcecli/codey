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

export interface FooterProps {
  model: string;
  targetDir: string;
  branchName?: string;
  debugMode: boolean;
  debugMessage: string;
  corgiMode: boolean;
  errorCount: number;
  showErrorDetails: boolean;
  showMemoryUsage?: boolean;
  promptTokenCount: number;
  nightly: boolean;
  vimMode?: string;
  isTrustedFolder?: boolean;
  hideCWD?: boolean;
  hideSandboxStatus?: boolean;
  hideModelInfo?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  model,
  targetDir,
  branchName,
  debugMode,
  debugMessage,
  corgiMode,
  errorCount,
  showErrorDetails,
  showMemoryUsage,
  promptTokenCount,
  nightly,
  vimMode,
  hideCWD = false,
  hideModelInfo = false,
}) => {
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

  return (
    <Box width="100%" flexDirection="column">
      {/* First Row: CWD and Model Info */}
      <Box
        justifyContent={justifyContent}
        width="100%"
        flexDirection="row"
        alignItems="center"
      >
        {/* Left Section: CWD, Debug, Vim Mode */}
        {(debugMode || vimMode || !hideCWD) && (
          <Box>
            {debugMode && <DebugProfiler />}
            {vimMode && <Text color={theme.text.secondary}>[{vimMode}] </Text>}
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
      </Box>

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
