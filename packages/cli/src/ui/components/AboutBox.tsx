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
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { GIT_COMMIT_INFO } from '../../generated/git-commit.js';

interface AboutBoxProps {
  cliVersion: string;
  osVersion: string;
  modelVersion: string;
  selectedAuthType: string;
  gcpProject: string;
  ideClient: string;
}

export const AboutBox: React.FC<AboutBoxProps> = ({
  cliVersion,
  osVersion,
  modelVersion,
  selectedAuthType,
  gcpProject,
  ideClient,
}) => (
  <Box
    borderStyle="round"
    borderColor={theme.border.default}
    flexDirection="column"
    padding={1}
    marginY={1}
    width="100%"
  >
    <Box marginBottom={1}>
      <Text bold color={theme.text.accent}>
        About Codey CLI
      </Text>
    </Box>
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          CLI Version
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>{cliVersion}</Text>
      </Box>
    </Box>
    {GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO) && (
      <Box flexDirection="row">
        <Box width="35%">
          <Text bold color={theme.text.link}>
            Git Commit
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.primary}>{GIT_COMMIT_INFO}</Text>
        </Box>
      </Box>
    )}
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          Model
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>{modelVersion}</Text>
      </Box>
    </Box>
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          OS
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>{osVersion}</Text>
      </Box>
    </Box>
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          Auth Method
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>
          {selectedAuthType.startsWith('oauth') ? 'OAuth' : selectedAuthType}
        </Text>
      </Box>
    </Box>
    {gcpProject && (
      <Box flexDirection="row">
        <Box width="35%">
          <Text bold color={theme.text.link}>
            GCP Project
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.primary}>{gcpProject}</Text>
        </Box>
      </Box>
    )}
    {ideClient && (
      <Box flexDirection="row">
        <Box width="35%">
          <Text bold color={theme.text.link}>
            IDE Client
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.primary}>{ideClient}</Text>
        </Box>
      </Box>
    )}
  </Box>
);
