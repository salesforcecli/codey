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

import { DefaultArgumentProcessor } from './argumentProcessor.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { describe, it, expect } from 'vitest';

describe('Argument Processors', () => {
  describe('DefaultArgumentProcessor', () => {
    const processor = new DefaultArgumentProcessor();

    it('should append the full command if args are provided', async () => {
      const prompt = [{ text: 'Parse the command.' }];
      const context = createMockCommandContext({
        invocation: {
          raw: '/mycommand arg1 "arg two"',
          name: 'mycommand',
          args: 'arg1 "arg two"',
        },
      });
      const result = await processor.process(prompt, context);
      expect(result).toEqual([
        { text: 'Parse the command.\n\n/mycommand arg1 "arg two"' },
      ]);
    });

    it('should NOT append the full command if no args are provided', async () => {
      const prompt = [{ text: 'Parse the command.' }];
      const context = createMockCommandContext({
        invocation: {
          raw: '/mycommand',
          name: 'mycommand',
          args: '',
        },
      });
      const result = await processor.process(prompt, context);
      expect(result).toEqual([{ text: 'Parse the command.' }]);
    });
  });
});
