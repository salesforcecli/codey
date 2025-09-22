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

import { describe, expect, it } from 'vitest';
import { WriteTodosTool, type WriteTodosToolParams } from './write-todos.js';

describe('WriteTodosTool', () => {
  const tool = new WriteTodosTool();
  const signal = new AbortController().signal;

  describe('validation', () => {
    it('should not throw for valid parameters', async () => {
      const params: WriteTodosToolParams = {
        todos: [
          { description: 'Task 1', status: 'pending' },
          { description: 'Task 2', status: 'in_progress' },
          { description: 'Task 3', status: 'completed' },
        ],
      };
      await expect(tool.buildAndExecute(params, signal)).resolves.toBeDefined();
    });

    it('should not throw for an empty list', async () => {
      const params: WriteTodosToolParams = {
        todos: [],
      };
      await expect(tool.buildAndExecute(params, signal)).resolves.toBeDefined();
    });

    it('should throw an error if todos is not an array', async () => {
      const params = {
        todos: 'not-an-array',
      } as unknown as WriteTodosToolParams;
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'params/todos must be array',
      );
    });

    it('should throw an error if a todo item is not an object', async () => {
      const params = {
        todos: ['not-an-object'],
      } as unknown as WriteTodosToolParams;
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'params/todos/0 must be object',
      );
    });

    it('should throw an error if a todo description is missing or empty', async () => {
      const params: WriteTodosToolParams = {
        todos: [{ description: '  ', status: 'pending' }],
      };
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'Each todo must have a non-empty description string',
      );
    });

    it('should throw an error if a todo status is invalid', async () => {
      const params = {
        todos: [{ description: 'Task 1', status: 'invalid-status' }],
      } as unknown as WriteTodosToolParams;
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'params/todos/0/status must be equal to one of the allowed values',
      );
    });

    it('should throw an error if more than one task is in_progress', async () => {
      const params: WriteTodosToolParams = {
        todos: [
          { description: 'Task 1', status: 'in_progress' },
          { description: 'Task 2', status: 'in_progress' },
        ],
      };
      await expect(tool.buildAndExecute(params, signal)).rejects.toThrow(
        'Invalid parameters: Only one task can be "in_progress" at a time.',
      );
    });
  });

  describe('execute', () => {
    it('should return a success message for clearing the list', async () => {
      const params: WriteTodosToolParams = {
        todos: [],
      };
      const result = await tool.buildAndExecute(params, signal);
      expect(result.llmContent).toBe('Successfully cleared the todo list.');
      expect(result.returnDisplay).toBe('Successfully cleared the todo list.');
    });

    it('should return a formatted todo list on success', async () => {
      const params: WriteTodosToolParams = {
        todos: [
          { description: 'First task', status: 'completed' },
          { description: 'Second task', status: 'in_progress' },
          { description: 'Third task', status: 'pending' },
        ],
      };
      const result = await tool.buildAndExecute(params, signal);
      const expectedOutput = `Successfully updated the todo list. The current list is now:
1. [completed] First task
2. [in_progress] Second task
3. [pending] Third task`;
      expect(result.llmContent).toBe(expectedOutput);
      expect(result.returnDisplay).toBe(expectedOutput);
    });
  });
});
