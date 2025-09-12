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

import { Text } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';

export const DebugProfiler = () => {
  const numRenders = useRef(0);
  const [showNumRenders, setShowNumRenders] = useState(false);

  useEffect(() => {
    numRenders.current++;
  });

  useKeypress(
    (key) => {
      if (key.ctrl && key.name === 'b') {
        setShowNumRenders((prev) => !prev);
      }
    },
    { isActive: true },
  );

  if (!showNumRenders) {
    return null;
  }

  return (
    <Text color={theme.status.warning}>Renders: {numRenders.current} </Text>
  );
};
