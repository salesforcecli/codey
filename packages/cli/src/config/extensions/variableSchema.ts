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

export interface VariableDefinition {
  type: 'string';
  description: string;
  default?: string;
  required?: boolean;
}

export interface VariableSchema {
  [key: string]: VariableDefinition;
}

export interface LoadExtensionContext {
  extensionDir: string;
  workspaceDir: string;
}

const PATH_SEPARATOR_DEFINITION = {
  type: 'string',
  description: 'The path separator.',
} as const;

export const VARIABLE_SCHEMA = {
  extensionPath: {
    type: 'string',
    description: 'The path of the extension in the filesystem.',
  },
  workspacePath: {
    type: 'string',
    description: 'The absolute path of the current workspace.',
  },
  '/': PATH_SEPARATOR_DEFINITION,
  pathSeparator: PATH_SEPARATOR_DEFINITION,
} as const;
