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
import type { SettingScope } from '../../../config/settings.js';
import { getScopeItems } from '../../../utils/dialogScopeUtils.js';
import { RadioButtonSelect } from './RadioButtonSelect.js';

interface ScopeSelectorProps {
  /** Callback function when a scope is selected */
  onSelect: (scope: SettingScope) => void;
  /** Callback function when a scope is highlighted */
  onHighlight: (scope: SettingScope) => void;
  /** Whether the component is focused */
  isFocused: boolean;
  /** The initial scope to select */
  initialScope: SettingScope;
}

export function ScopeSelector({
  onSelect,
  onHighlight,
  isFocused,
  initialScope,
}: ScopeSelectorProps): React.JSX.Element {
  const scopeItems = getScopeItems().map((item) => ({
    ...item,
    key: item.value,
  }));

  const initialIndex = scopeItems.findIndex(
    (item) => item.value === initialScope,
  );
  const safeInitialIndex = initialIndex >= 0 ? initialIndex : 0;

  return (
    <Box flexDirection="column">
      <Text bold={isFocused} wrap="truncate">
        {isFocused ? '> ' : '  '}Apply To
      </Text>
      <RadioButtonSelect
        items={scopeItems}
        initialIndex={safeInitialIndex}
        onSelect={onSelect}
        onHighlight={onHighlight}
        isFocused={isFocused}
        showNumbers={isFocused}
      />
    </Box>
  );
}
