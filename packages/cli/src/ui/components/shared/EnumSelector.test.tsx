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

import { renderWithProviders } from '../../../test-utils/render.js';
import { EnumSelector } from './EnumSelector.js';
import type { SettingEnumOption } from '../../../config/settingsSchema.js';
import { describe, it, expect } from 'vitest';

const LANGUAGE_OPTIONS: readonly SettingEnumOption[] = [
  { label: 'English', value: 'en' },
  { label: '中文 (简体)', value: 'zh' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
];

const NUMERIC_OPTIONS: readonly SettingEnumOption[] = [
  { label: 'Low', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'High', value: 3 },
];

describe('<EnumSelector />', () => {
  it('renders with string options and matches snapshot', () => {
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={LANGUAGE_OPTIONS}
        currentValue="en"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders with numeric options and matches snapshot', () => {
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={NUMERIC_OPTIONS}
        currentValue={2}
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders inactive state and matches snapshot', () => {
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={LANGUAGE_OPTIONS}
        currentValue="zh"
        isActive={false}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders with single option and matches snapshot', () => {
    const singleOption: readonly SettingEnumOption[] = [
      { label: 'Only Option', value: 'only' },
    ];
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={singleOption}
        currentValue="only"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders nothing when no options are provided', () => {
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={[]}
        currentValue=""
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toBe('');
  });

  it('handles currentValue not found in options', () => {
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={LANGUAGE_OPTIONS}
        currentValue="invalid"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    // Should default to first option
    expect(lastFrame()).toContain('English');
  });

  it('updates when currentValue changes externally', () => {
    const { rerender, lastFrame } = renderWithProviders(
      <EnumSelector
        options={LANGUAGE_OPTIONS}
        currentValue="en"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toContain('English');

    rerender(
      <EnumSelector
        options={LANGUAGE_OPTIONS}
        currentValue="zh"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toContain('中文 (简体)');
  });

  it('shows navigation arrows when multiple options available', () => {
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={LANGUAGE_OPTIONS}
        currentValue="en"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).toContain('←');
    expect(lastFrame()).toContain('→');
  });

  it('hides navigation arrows when single option available', () => {
    const singleOption: readonly SettingEnumOption[] = [
      { label: 'Only Option', value: 'only' },
    ];
    const { lastFrame } = renderWithProviders(
      <EnumSelector
        options={singleOption}
        currentValue="only"
        isActive={true}
        onValueChange={() => {}}
      />,
    );
    expect(lastFrame()).not.toContain('←');
    expect(lastFrame()).not.toContain('→');
  });
});
