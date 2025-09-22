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
import { render } from 'ink-testing-library';
import { QueuedMessageDisplay } from './QueuedMessageDisplay.js';

describe('QueuedMessageDisplay', () => {
  it('renders nothing when message queue is empty', () => {
    const { lastFrame } = render(<QueuedMessageDisplay messageQueue={[]} />);

    expect(lastFrame()).toBe('');
  });

  it('displays single queued message', () => {
    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={['First message']} />,
    );

    const output = lastFrame();
    expect(output).toContain('First message');
  });

  it('displays multiple queued messages', () => {
    const messageQueue = [
      'First queued message',
      'Second queued message',
      'Third queued message',
    ];

    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={messageQueue} />,
    );

    const output = lastFrame();
    expect(output).toContain('First queued message');
    expect(output).toContain('Second queued message');
    expect(output).toContain('Third queued message');
  });

  it('shows overflow indicator when more than 3 messages are queued', () => {
    const messageQueue = [
      'Message 1',
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5',
    ];

    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={messageQueue} />,
    );

    const output = lastFrame();
    expect(output).toContain('Message 1');
    expect(output).toContain('Message 2');
    expect(output).toContain('Message 3');
    expect(output).toContain('... (+2 more)');
    expect(output).not.toContain('Message 4');
    expect(output).not.toContain('Message 5');
  });

  it('normalizes whitespace in messages', () => {
    const messageQueue = ['Message   with\tmultiple\n  whitespace'];

    const { lastFrame } = render(
      <QueuedMessageDisplay messageQueue={messageQueue} />,
    );

    const output = lastFrame();
    expect(output).toContain('Message with multiple whitespace');
  });
});
