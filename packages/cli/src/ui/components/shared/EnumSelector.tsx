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

import { useState, useEffect } from 'react';
import type React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../../colors.js';
import type { SettingEnumOption } from '../../../config/settingsSchema.js';

interface EnumSelectorProps {
  options: readonly SettingEnumOption[];
  currentValue: string | number;
  isActive: boolean;
  onValueChange: (value: string | number) => void;
}

/**
 * A left-right scrolling selector for enum values
 */
export function EnumSelector({
  options,
  currentValue,
  isActive,
  onValueChange: _onValueChange,
}: EnumSelectorProps): React.JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Guard against empty options array
    if (!options || options.length === 0) {
      return 0;
    }
    const index = options.findIndex((option) => option.value === currentValue);
    return index >= 0 ? index : 0;
  });

  // Update index when currentValue changes externally
  useEffect(() => {
    // Guard against empty options array
    if (!options || options.length === 0) {
      return;
    }
    const index = options.findIndex((option) => option.value === currentValue);
    // Always update index, defaulting to 0 if value not found
    setCurrentIndex(index >= 0 ? index : 0);
  }, [currentValue, options]);

  // Guard against empty options array
  if (!options || options.length === 0) {
    return <Box />;
  }

  // Left/right navigation is handled by parent component
  // This component is purely for display
  // onValueChange is kept for interface compatibility but not used internally

  const currentOption = options[currentIndex] || options[0];
  const canScrollLeft = options.length > 1;
  const canScrollRight = options.length > 1;

  return (
    <Box flexDirection="row" alignItems="center">
      <Text
        color={isActive && canScrollLeft ? Colors.AccentGreen : Colors.Gray}
      >
        {canScrollLeft ? '←' : ' '}
      </Text>
      <Text> </Text>
      <Text
        color={isActive ? Colors.AccentGreen : Colors.Foreground}
        bold={isActive}
      >
        {currentOption.label}
      </Text>
      <Text> </Text>
      <Text
        color={isActive && canScrollRight ? Colors.AccentGreen : Colors.Gray}
      >
        {canScrollRight ? '→' : ' '}
      </Text>
    </Box>
  );
}

// Export the interface for external use
export type { EnumSelectorProps };
