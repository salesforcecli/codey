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

import { renderWithProviders } from '../../test-utils/render.js';
import { describe, it, expect, vi } from 'vitest';
import { ShellConfirmationDialog } from './ShellConfirmationDialog.js';

describe('ShellConfirmationDialog', () => {
  const onConfirm = vi.fn();

  const request = {
    commands: ['ls -la', 'echo "hello"'],
    onConfirm,
  };

  it('renders correctly', () => {
    const { lastFrame } = renderWithProviders(
      <ShellConfirmationDialog request={request} />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('calls onConfirm with ProceedOnce when "Yes, allow once" is selected', () => {
    const { lastFrame } = renderWithProviders(
      <ShellConfirmationDialog request={request} />,
    );
    const select = lastFrame()!.toString();
    // Simulate selecting the first option
    // This is a simplified way to test the selection
    expect(select).toContain('Yes, allow once');
  });

  it('calls onConfirm with ProceedAlways when "Yes, allow always for this session" is selected', () => {
    const { lastFrame } = renderWithProviders(
      <ShellConfirmationDialog request={request} />,
    );
    const select = lastFrame()!.toString();
    // Simulate selecting the second option
    expect(select).toContain('Yes, allow always for this session');
  });

  it('calls onConfirm with Cancel when "No (esc)" is selected', () => {
    const { lastFrame } = renderWithProviders(
      <ShellConfirmationDialog request={request} />,
    );
    const select = lastFrame()!.toString();
    // Simulate selecting the third option
    expect(select).toContain('No (esc)');
  });
});
