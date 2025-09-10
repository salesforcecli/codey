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

import { useEffect, useState } from 'react';
import { appEvents } from './../../utils/events.js';
import { Box, Text } from 'ink';
import { useConfig } from '../contexts/ConfigContext.js';
import { type McpClient, MCPServerStatus } from '@salesforce/codey-core';
import { GeminiSpinner } from './GeminiRespondingSpinner.js';

export const ConfigInitDisplay = () => {
  const config = useConfig();
  const [message, setMessage] = useState('Initializing...');

  useEffect(() => {
    const onChange = (clients?: Map<string, McpClient>) => {
      if (!clients || clients.size === 0) {
        setMessage(`Initializing...`);
        return;
      }
      let connected = 0;
      for (const client of clients.values()) {
        if (client.getStatus() === MCPServerStatus.CONNECTED) {
          connected++;
        }
      }
      setMessage(`Connecting to MCP servers... (${connected}/${clients.size})`);
    };

    appEvents.on('mcp-client-update', onChange);
    return () => {
      appEvents.off('mcp-client-update', onChange);
    };
  }, [config]);

  return (
    <Box marginTop={1}>
      <Text>
        <GeminiSpinner /> {message}
      </Text>
    </Box>
  );
};
