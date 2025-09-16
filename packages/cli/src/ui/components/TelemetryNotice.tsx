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

export const TelemetryNotice: React.FC = () => (
    <Box marginTop={1}>
      <Text color={theme.ui.comment}>
      You acknowledge and agree that the Codey CLI may collect usage information, user environment, and crash reports for the purposes of providing services or functions that are relevant to use of the Codey CLI and product improvements. Use --no-telemetry or set telemetry.enabled to false to opt out.
      </Text>
    </Box>
  );


