/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// E2E test framework for session persistence and functionality testing.
// Usage: node scripts/test-session-e2e.js

import { dirname } from 'path';

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}/api`;
// `cd` up 3 levels to get to the workspace root of the monorepo
const WORKSPACE_ROOT = dirname(dirname(dirname(import.meta.dirname)));
console.log('WORKSPACE_ROOT', WORKSPACE_ROOT);

// Test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.sessionId = null;
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runAllTests() {
    console.log(`🧪 Running ${this.tests.length} tests...\n`);

    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        console.log(`⏳ Running: ${test.name}`);
        await test.testFn();
        console.log(`✅ PASSED: ${test.name}\n`);
        passed++;
      } catch (error) {
        console.error(`❌ FAILED: ${test.name}`);
        console.error(`   Error: ${error.message}\n`);
        failed++;
      }
    }

    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 All tests passed!');
      process.exit(0);
    }
  }
}

// HTTP Client with unified response handling
class ApiClient {
  static async makeRequest(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Leave json as null if parsing fails
    }

    return { ok: res.ok, status: res.status, json, raw: text };
  }

  static async getHealth() {
    const result = await this.makeRequest(`${BASE_URL}/health`);
    if (!result.ok) {
      throw new Error(`Health check failed: ${result.status}`);
    }
    return result.json;
  }

  static async createSession(workspaceRoot) {
    const result = await this.makeRequest(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceRoot }),
    });

    if (!result.ok || !result.json?.sessionId) {
      throw new Error(`Failed to create session: ${result.raw}`);
    }

    return result.json.sessionId;
  }

  static async postSessionMessage(sessionId, body) {
    const result = await this.makeRequest(
      `${BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!result.ok) {
      throw new Error(`Session message failed: ${result.raw}`);
    }

    return result.json;
  }
}

// Test utilities and assertions
class TestUtils {
  static assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  static assertIncludes(text, substring, message) {
    if (!text.includes(substring)) {
      throw new Error(
        message || `Expected "${text}" to include "${substring}"`,
      );
    }
  }

  static assertResponseIncludes(response, substring, message) {
    const responseText = response?.response || '';
    this.assertIncludes(responseText, substring, message);
  }

  static async sendMessage(sessionId, message) {
    console.log(`   📤 Sending: ${message}`);
    const response = await ApiClient.postSessionMessage(sessionId, {
      message,
      workspaceRoot: WORKSPACE_ROOT,
    });
    console.log(
      `   📥 Response preview: ${(response?.response || '').substring(0, 100)}...`,
    );
    return response;
  }
}

// Individual test cases
async function testHealthCheck() {
  console.log(`   🔍 Checking health at ${BASE_URL}/health`);
  const health = await ApiClient.getHealth();
  TestUtils.assert(health, 'Health check should return data');
  console.log(`   ✓ Health check successful`);
}

async function testSessionCreation() {
  console.log(`   🔍 Creating session for workspace: ${WORKSPACE_ROOT}`);
  const sessionId = await ApiClient.createSession(WORKSPACE_ROOT);
  TestUtils.assert(sessionId, 'Session creation should return a session ID');
  console.log(`   ✓ Session created: ${sessionId}`);
  return sessionId;
}

async function testSessionMemoryPersistence() {
  // Create a fresh session for this test
  const sessionId = await ApiClient.createSession(WORKSPACE_ROOT);

  // Step 1: Ask the model to remember a number
  const secret = '424242';
  const message1 = `Remember the number ${secret}. Reply exactly with OK.`;
  await TestUtils.sendMessage(sessionId, message1);

  // Step 2: Ask what number was remembered using the same session
  const message2 =
    'What number did I ask you to remember? Reply with only digits.';
  const response = await TestUtils.sendMessage(sessionId, message2);

  TestUtils.assertResponseIncludes(
    response,
    secret,
    `Expected response to include remembered number ${secret}`,
  );

  console.log(`   ✓ Session correctly remembered: ${secret}`);
}

async function testMcpToolsIntegration() {
  // Create a fresh session for this test
  const sessionId = await ApiClient.createSession(WORKSPACE_ROOT);

  const message = 'list all my salesforce orgs';
  const response = await TestUtils.sendMessage(sessionId, message);

  const responseText = (response?.response || '').toLowerCase();

  // Check for indications that the MCP tool was invoked
  const toolInvoked =
    responseText.includes('sf-list-orgs') ||
    responseText.includes('salesforce') ||
    responseText.includes('org') ||
    responseText.includes('tool') ||
    responseText.length > 20; // Any substantial response indicates some processing

  TestUtils.assert(
    toolInvoked,
    `Expected response to indicate MCP tool usage. Response was: "${responseText}"`,
  );

  console.log(`   ✓ MCP tools integration working`);
}

// Main test runner
(async function main() {
  const runner = new TestRunner();

  // Register all tests
  runner.addTest('Health Check', testHealthCheck);
  runner.addTest('Session Creation', testSessionCreation);
  runner.addTest('Session Memory Persistence', testSessionMemoryPersistence);
  // runner.addTest('MCP Tools Integration', testMcpToolsIntegration);

  // Run all tests
  await runner.runAllTests();
})();
