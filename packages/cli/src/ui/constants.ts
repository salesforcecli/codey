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

const EstimatedArtWidth = 59;
const BoxBorderWidth = 1;
export const BOX_PADDING_X = 1;

// Calculate width based on art, padding, and border
export const UI_WIDTH =
  EstimatedArtWidth + BOX_PADDING_X * 2 + BoxBorderWidth * 2; // ~63

export const STREAM_DEBOUNCE_MS = 100;

export const SHELL_COMMAND_NAME = 'Shell Command';

export const SHELL_NAME = 'Shell';

// Tool status symbols used in ToolMessage component
export const TOOL_STATUS = {
  SUCCESS: '✓',
  PENDING: 'o',
  EXECUTING: '⊷',
  CONFIRMING: '?',
  CANCELED: '-',
  ERROR: 'x',
} as const;
