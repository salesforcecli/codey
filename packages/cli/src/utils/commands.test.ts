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

import { describe, it, expect } from 'vitest';
import { parseSlashCommand } from './commands.js';
import { CommandKind, type SlashCommand } from '../ui/commands/types.js';

// Mock command structure for testing
const mockCommands: readonly SlashCommand[] = [
  {
    name: 'help',
    description: 'Show help',
    action: async () => {},
    kind: CommandKind.BUILT_IN,
  },
  {
    name: 'commit',
    description: 'Commit changes',
    action: async () => {},
    kind: CommandKind.FILE,
  },
  {
    name: 'memory',
    description: 'Manage memory',
    altNames: ['mem'],
    subCommands: [
      {
        name: 'add',
        description: 'Add to memory',
        action: async () => {},
        kind: CommandKind.BUILT_IN,
      },
      {
        name: 'clear',
        description: 'Clear memory',
        altNames: ['c'],
        action: async () => {},
        kind: CommandKind.BUILT_IN,
      },
    ],
    kind: CommandKind.BUILT_IN,
  },
];

describe('parseSlashCommand', () => {
  it('should parse a simple command without arguments', () => {
    const result = parseSlashCommand('/help', mockCommands);
    expect(result.commandToExecute?.name).toBe('help');
    expect(result.args).toBe('');
    expect(result.canonicalPath).toEqual(['help']);
  });

  it('should parse a simple command with arguments', () => {
    const result = parseSlashCommand(
      '/commit -m "Initial commit"',
      mockCommands,
    );
    expect(result.commandToExecute?.name).toBe('commit');
    expect(result.args).toBe('-m "Initial commit"');
    expect(result.canonicalPath).toEqual(['commit']);
  });

  it('should parse a subcommand', () => {
    const result = parseSlashCommand('/memory add', mockCommands);
    expect(result.commandToExecute?.name).toBe('add');
    expect(result.args).toBe('');
    expect(result.canonicalPath).toEqual(['memory', 'add']);
  });

  it('should parse a subcommand with arguments', () => {
    const result = parseSlashCommand(
      '/memory add some important data',
      mockCommands,
    );
    expect(result.commandToExecute?.name).toBe('add');
    expect(result.args).toBe('some important data');
    expect(result.canonicalPath).toEqual(['memory', 'add']);
  });

  it('should handle a command alias', () => {
    const result = parseSlashCommand('/mem add some data', mockCommands);
    expect(result.commandToExecute?.name).toBe('add');
    expect(result.args).toBe('some data');
    expect(result.canonicalPath).toEqual(['memory', 'add']);
  });

  it('should handle a subcommand alias', () => {
    const result = parseSlashCommand('/memory c', mockCommands);
    expect(result.commandToExecute?.name).toBe('clear');
    expect(result.args).toBe('');
    expect(result.canonicalPath).toEqual(['memory', 'clear']);
  });

  it('should return undefined for an unknown command', () => {
    const result = parseSlashCommand('/unknown', mockCommands);
    expect(result.commandToExecute).toBeUndefined();
    expect(result.args).toBe('unknown');
    expect(result.canonicalPath).toEqual([]);
  });

  it('should return the parent command if subcommand is unknown', () => {
    const result = parseSlashCommand(
      '/memory unknownsub some args',
      mockCommands,
    );
    expect(result.commandToExecute?.name).toBe('memory');
    expect(result.args).toBe('unknownsub some args');
    expect(result.canonicalPath).toEqual(['memory']);
  });

  it('should handle extra whitespace', () => {
    const result = parseSlashCommand(
      '  /memory   add  some data  ',
      mockCommands,
    );
    expect(result.commandToExecute?.name).toBe('add');
    expect(result.args).toBe('some data');
    expect(result.canonicalPath).toEqual(['memory', 'add']);
  });

  it('should return undefined if query does not start with a slash', () => {
    const result = parseSlashCommand('help', mockCommands);
    expect(result.commandToExecute).toBeUndefined();
  });

  it('should handle an empty query', () => {
    const result = parseSlashCommand('', mockCommands);
    expect(result.commandToExecute).toBeUndefined();
  });

  it('should handle a query with only a slash', () => {
    const result = parseSlashCommand('/', mockCommands);
    expect(result.commandToExecute).toBeUndefined();
    expect(result.args).toBe('');
    expect(result.canonicalPath).toEqual([]);
  });
});
