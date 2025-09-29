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

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ProQuotaDialog } from './ProQuotaDialog.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';

// Mock the child component to make it easier to test the parent
vi.mock('./shared/RadioButtonSelect.js', () => ({
  RadioButtonSelect: vi.fn(),
}));

describe('ProQuotaDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with correct title and options', () => {
    const { lastFrame } = render(
      <ProQuotaDialog
        failedModel="gemini-2.5-pro"
        fallbackModel="gemini-2.5-flash"
        onChoice={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain('Pro quota limit reached for gemini-2.5-pro.');

    // Check that RadioButtonSelect was called with the correct items
    expect(RadioButtonSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            label: 'Change auth (executes the /auth command)',
            value: 'auth',
            key: 'auth',
          },
          {
            label: `Continue with gemini-2.5-flash`,
            value: 'continue',
            key: 'continue',
          },
        ],
      }),
      undefined,
    );
  });

  it('should call onChoice with "auth" when "Change auth" is selected', () => {
    const mockOnChoice = vi.fn();
    render(
      <ProQuotaDialog
        failedModel="gemini-2.5-pro"
        fallbackModel="gemini-2.5-flash"
        onChoice={mockOnChoice}
      />,
    );

    // Get the onSelect function passed to RadioButtonSelect
    const onSelect = (RadioButtonSelect as Mock).mock.calls[0][0].onSelect;

    // Simulate the selection
    onSelect('auth');

    expect(mockOnChoice).toHaveBeenCalledWith('auth');
  });

  it('should call onChoice with "continue" when "Continue with flash" is selected', () => {
    const mockOnChoice = vi.fn();
    render(
      <ProQuotaDialog
        failedModel="gemini-2.5-pro"
        fallbackModel="gemini-2.5-flash"
        onChoice={mockOnChoice}
      />,
    );

    // Get the onSelect function passed to RadioButtonSelect
    const onSelect = (RadioButtonSelect as Mock).mock.calls[0][0].onSelect;

    // Simulate the selection
    onSelect('continue');

    expect(mockOnChoice).toHaveBeenCalledWith('continue');
  });
});
