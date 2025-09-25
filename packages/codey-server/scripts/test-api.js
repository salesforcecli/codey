#!/usr/bin/env node

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
 * End-to-end test script for Codey Server API
 *
 * This script performs a complete API test:
 * 1. Health check
 * 2. Session creation with specified authType, model, and org
 * 3. Streaming message to the session
 *
 * Usage:
 *   node test-api.js --auth-type gemini --model gemini-pro
 *   node test-api.js --auth-type gateway --org user@example.com --model llmgateway__OpenAIGPT4OmniMini
 *   node test-api.js --auth-type gemini --message "Hello, what is 2+2?"
 *
 * Environment Variables:
 *   CODEY_SERVER_URL - Server URL (default: http://localhost:3000)
 *   GEMINI_API_KEY - Required for gemini auth type
 *   CODEY_GATEWAY_ORG - Required for gateway auth type
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default configuration
const DEFAULT_CONFIG = {
  serverUrl: process.env.CODEY_SERVER_URL || 'http://localhost:3000',
  message: 'Hello! What is LWC?',
  timeout: 30000, // 30 seconds
};

/**
 * Parse command line arguments
 */
function parseArguments() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'auth-type': {
        type: 'string',
        short: 'a',
        default: 'gemini',
      },
      model: {
        type: 'string',
        short: 'm',
      },
      org: {
        type: 'string',
        short: 'o',
      },
      message: {
        type: 'string',
        default: DEFAULT_CONFIG.message,
      },
      'workspace-root': {
        type: 'string',
        short: 'w',
      },
      'server-url': {
        type: 'string',
        short: 's',
        default: DEFAULT_CONFIG.serverUrl,
      },
      timeout: {
        type: 'string',
        short: 't',
        default: String(DEFAULT_CONFIG.timeout),
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      verbose: {
        type: 'boolean',
        short: 'v',
      },
    },
    allowPositionals: true,
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // Validate auth type
  if (!['gemini', 'gateway'].includes(values['auth-type'])) {
    console.error('❌ Error: auth-type must be either "gemini" or "gateway"');
    process.exit(1);
  }

  // Validate gateway auth requirements
  if (values['auth-type'] === 'gateway' && !values.org) {
    console.error('❌ Error: --org is required when auth-type is "gateway"');
    process.exit(1);
  }

  return {
    authType: values['auth-type'],
    model: values.model,
    org: values.org,
    message: values.message,
    workspaceRoot: values['workspace-root'],
    serverUrl: values['server-url'],
    timeout: parseInt(values.timeout, 10),
    verbose: values.verbose || false,
  };
}

/**
 * Show help message
 */
function showHelp() {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  );

  console.log(`
Codey Server API End-to-End Test Script v${packageJson.version}

Usage: node test-api.js [options]

Options:
  -a, --auth-type <type>       Authentication type: "gemini" or "gateway" (default: gemini)
  -m, --model <model>          Model to use (optional)
  -o, --org <org>              Organization (required for gateway auth)
  -w, --workspace-root <path>  Workspace root directory (default: current directory)
  -s, --server-url <url>       Server URL (default: http://localhost:3000)
  --message <message>          Test message to send (default: greeting message)
  -t, --timeout <ms>           Request timeout in milliseconds (default: 30000)
  -v, --verbose                Enable verbose output
  -h, --help                   Show this help message

Environment Variables:
  CODEY_SERVER_URL             Override default server URL
  GEMINI_API_KEY               Required for gemini auth type
  CODEY_GATEWAY_ORG           Required for gateway auth type

Examples:
  # Test with Gemini auth
  node test-api.js --auth-type gemini

  # Test with Gateway auth
  node test-api.js --auth-type gateway --org user@example.com

  # Custom message and verbose output
  node test-api.js --auth-type gemini --message "What is 2+2?" --verbose
`);
}

/**
 * Log with timestamp and optional verbose filtering
 */
function log(message, isVerbose = false, config) {
  if (isVerbose && !config.verbose) return;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Check server health
 */
async function checkHealth(config) {
  log('🏥 Checking server health...', false, config);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(`${config.serverUrl}/api/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    const result = await response.json();
    log(`✅ Server is healthy: ${JSON.stringify(result)}`, true, config);
    return true;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`❌ Health check timed out after ${config.timeout}ms`);
    } else {
      console.error(`❌ Health check failed: ${error.message}`);
    }
    return false;
  }
}

/**
 * Create a new session
 */
async function createSession(config) {
  log('🆕 Creating session...', false, config);

  const requestBody = {
    workspaceRoot: config.workspaceRoot,
    authType: config.authType,
  };

  if (config.model) {
    requestBody.model = config.model;
  }

  if (config.org) {
    requestBody.org = config.org;
  }

  log(`Request body: ${JSON.stringify(requestBody, null, 2)}`, true, config);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(`${config.serverUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        `Session creation failed: ${result.error || response.statusText}`,
      );
    }

    log(`✅ Session created successfully: ${result.sessionId}`, false, config);
    log(`Response: ${JSON.stringify(result, null, 2)}`, true, config);
    return result.sessionId;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`❌ Session creation timed out after ${config.timeout}ms`);
    } else {
      console.error(`❌ Session creation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Send a streaming message to the session
 */
async function sendStreamingMessage(sessionId, config) {
  log(`💬 Sending streaming message to session ${sessionId}...`, false, config);

  const requestBody = {
    message: config.message,
  };

  log(`Message: "${config.message}"`, false, config);
  log(`Request body: ${JSON.stringify(requestBody, null, 2)}`, true, config);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(
      `${config.serverUrl}/api/sessions/${sessionId}/messages/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Streaming request failed: ${errorText || response.statusText}`,
      );
    }

    log('📡 Receiving streaming response...', false, config);

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedEvents = 0;
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          log('✅ Streaming completed', false, config);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line);
              receivedEvents++;

              log(`📨 Event ${receivedEvents}: ${event.type}`, true, config);

              if (config.verbose) {
                console.log(`   ${JSON.stringify(event, null, 2)}`);
              } else if (event.type === 'content' && event.value) {
                process.stdout.write(event.value);
              }
            } catch {
              log(`⚠️  Failed to parse event: ${line}`, true, config);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!config.verbose && receivedEvents > 0) {
      console.log(''); // Add newline after content
    }

    log(`✅ Received ${receivedEvents} events successfully`, false, config);
    return receivedEvents;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`❌ Streaming timed out after ${config.timeout}ms`);
    } else {
      console.error(`❌ Streaming failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate environment variables
 */
function validateEnvironment(config) {
  log('🔍 Validating environment...', true, config);

  const issues = [];

  if (config.authType === 'gemini' && !process.env.GEMINI_API_KEY) {
    issues.push(
      'GEMINI_API_KEY environment variable is required for gemini auth type',
    );
  }

  if (issues.length > 0) {
    console.error('❌ Environment validation failed:');
    issues.forEach((issue) => console.error(`   • ${issue}`));
    return false;
  }

  log('✅ Environment validation passed', true, config);
  return true;
}

/**
 * Main test execution
 */
async function main() {
  console.log('🚀 Starting Codey Server API End-to-End Test\n');

  const config = parseArguments();

  log(`Configuration:`, false, config);
  log(`  Server URL: ${config.serverUrl}`, false, config);
  log(`  Auth Type: ${config.authType}`, false, config);
  log(`  Model: ${config.model}`, false, config);
  log(`  Org: ${config.org}`, false, config);
  log(`  Workspace: ${config.workspaceRoot}`, false, config);
  log(`  Timeout: ${config.timeout}ms`, false, config);
  log('', false, config);

  try {
    // Validate environment
    if (!validateEnvironment(config)) {
      process.exit(1);
    }

    // Step 1: Health check
    const isHealthy = await checkHealth(config);
    if (!isHealthy) {
      console.error('❌ Cannot proceed with unhealthy server');
      process.exit(1);
    }

    // Step 2: Create session
    const sessionId = await createSession(config);

    // Step 3: Send streaming message
    const eventCount = await sendStreamingMessage(sessionId, config);

    console.log('\n🎉 End-to-end test completed successfully!');
    console.log(`✅ Session ID: ${sessionId}`);
    console.log(`✅ Events received: ${eventCount}`);
  } catch (error) {
    console.error('\n💥 Test failed with error:');
    console.error(`❌ ${error.message}`);

    if (config.verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught exception:');
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 Unhandled promise rejection:');
  console.error(reason);
  process.exit(1);
});

// Run the test
main().catch((error) => {
  console.error('\n💥 Fatal error:');
  console.error(error);
  process.exit(1);
});
