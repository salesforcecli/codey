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

/**
 * Integration test to verify circular reference handling with proxy agents
 */

import { describe, it, expect } from 'vitest';
import { ClearcutLogger } from './clearcut-logger/clearcut-logger.js';
import type { Config } from '../config/config.js';

describe('Circular Reference Integration Test', () => {
  it('should handle HttpsProxyAgent-like circular references in clearcut logging', () => {
    // Create a mock config with proxy
    const mockConfig = {
      getTelemetryEnabled: () => true,
      getUsageStatisticsEnabled: () => true,
      getSessionId: () => 'test-session',
      getModel: () => 'test-model',
      getEmbeddingModel: () => 'test-embedding',
      getDebugMode: () => false,
      getProxy: () => 'http://proxy.example.com:8080',
    } as unknown as Config;

    // Simulate the structure that causes the circular reference error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proxyAgentLike: any = {
      sockets: {},
      options: { proxy: 'http://proxy.example.com:8080' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const socketLike: any = {
      _httpMessage: {
        agent: proxyAgentLike,
        socket: null,
      },
    };

    socketLike._httpMessage.socket = socketLike; // Create circular reference
    proxyAgentLike.sockets['cloudcode-pa.googleapis.com:443'] = [socketLike];

    // Create an event that would contain this circular structure
    const problematicEvent = {
      error: new Error('Network error'),
      function_args: {
        filePath: '/test/file.txt',
        httpAgent: proxyAgentLike, // This would cause the circular reference
      },
    };

    // Test that ClearcutLogger can handle this
    const logger = ClearcutLogger.getInstance(mockConfig);

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger?.enqueueLogEvent(problematicEvent as any);
    }).not.toThrow();
  });
});
