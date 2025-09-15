# Codey Server

A lightweight HTTP API server built with [Hono](https://hono.dev/) and [Pino](https://getpino.io/) that exposes HTTP endpoints for chat sessions with Codey.

## Table of Contents

- [Requirements](#requirements)
- [API Endpoints](#api-endpoints)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Test Script](#test-script)
- [Architecture](#architecture)
- [Session Management](#session-management)


## Overview

This project is an HTTP server that wraps the Codey CLI (Google gemini-cli fork) and exposes HTTP endpoints for chat sessions.

The basic flow is:
- Create a session using `POST /api/sessions`
- Stream messages using `POST /api/sessions/{sessionId}/messages/stream`

Codey can talk to models via the LLM Gateway or directly to Gemini.

For the LLM Gateway, you need a Developer Edition org and set the `CODEY_ORG_USERNAME` environment variable or pass the `org` parameter in the session creation request.

For Gemini, you need a Gemini API key and set the `GEMINI_API_KEY` environment variable.

## Requirements

- **Node.js**: 18.18 or higher
- **Authentication**: Either Gemini API key or Salesforce Gateway access

## API Endpoints

The server provides a REST API with the following endpoints under the `/api` base path:

### Health Check

**GET** `/api/health`

Returns server health status.

**Response** (200):

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "codey-server"
}
```

### Session Management

**POST** `/api/sessions`

Creates a new chat session with the specified authentication and configuration.

**Request Body**:

```json
{
  "workspaceRoot": "/path/to/workspace",
  "authType": "gemini" | "gateway",
  "model": "llmgateway__OpenAIGPT4OmniMini",           // optional
  "org": "user@example.com"                            // required for gateway auth
}
```

The `model` and `org` parameters are only applied when `authType` is `gateway`.

Valid Models:
- `llmgateway__OpenAIGPT4oMini` (default model if not provided)
- `llmgateway__BedrockAnthropicClaude4Sonnet`
- `llmgateway__BedrockAnthropicClaude37Sonnet`
- `xgen_stream`

The `workspaceRoot` parameter is the root directory where Codey will run. This is where Codey will look for settings (`.codey/settings.json`) and `CODEY.md` files. It's also where Codey will make his changes to the codebase.

**Response** (201):

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Headers**:

- `Location: /api/sessions/{sessionId}`

### Send Message (Non-Streaming)

**POST** `/api/sessions/{sessionId}/messages`

Sends a message to an existing session and returns the complete response.

**Request Body**:

```json
{
  "message": "Hello, what is LWC?",
  "workspaceRoot": "/path/to/workspace"
}
```

**Response** (200):

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Lightning Web Components (LWC) is...",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Send Message (Streaming)

**POST** `/api/sessions/{sessionId}/messages/stream`

Sends a message to an existing session and streams the response as NDJSON.

**Request Body**: Same as non-streaming endpoint

**Response Headers**:

- `Content-Type: application/x-ndjson`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `Transfer-Encoding: chunked`

**Response Body**: Stream of `ServerGeminiStreamEvent` objects, one per line:

```json
{"type":"content","value":"Lightning"}
{"type":"content","value":" Web"}
{"type":"content","value":" Components"}
{"type":"thought","value":"The user is asking about LWC..."}
{"type":"tool_call_request","value":{"name":"read_file","args":{"path":"lwc-example.js"}}}
{"type":"tool_call_response","value":{"callId":"123","result":"..."}}
```

## Local Development Setup

### From Monorepo Root

```bash
# Install dependencies (if not already done)
npm install

# Build all packages in the monorepo
npm run build

# Start in development mode (with hot reload)
npm run -w packages/codey-server dev
```

The server will start on `http://localhost:3000` by default (configurable via `PORT` environment variable).

## Environment Variables

### Required Variables

#### For Gemini Authentication (`authType: "gemini"`)

- **`GEMINI_API_KEY`**: Your Google Gemini API key
  - Required when using `authType: "gemini"`
  - Obtain from [Google AI Studio](https://makersuite.google.com/app/apikey)

#### For Gateway Authentication (`authType: "gateway"`)

- **`CODEY_ORG_USERNAME`**: Salesforce org username
  - Required when using `authType: "gateway"` (unless provided in request body)
  - Can be overridden by the `org` parameter in the session creation request

### Optional Variables

- **`PORT`**: Server port number
  - Default: `3000`
  - Example: `PORT=8080`

- **`NODE_ENV`**: Node.js environment
  - Default: `development`
  - Values: `development` | `production`
  - Affects logging format and level

- **`LOG_LEVEL`**: Logging level
  - Default: `debug` (development) / `info` (production)
  - Values: `trace` | `debug` | `info` | `warn` | `error` | `fatal`

### Example Configuration

```bash
# .env file for local development
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Gemini setup
GEMINI_API_KEY=your_gemini_api_key_here

# Gateway setup (alternative to Gemini)
# CODEY_ORG_USERNAME=your_username@company.com
```

## Test Script

The package includes a comprehensive end-to-end test script at `scripts/test-api.js` that validates the entire API workflow.

### Usage

```bash
# Test with Gemini authentication
node scripts/test-api.js --auth-type gemini

# Test with Gateway authentication
node scripts/test-api.js --auth-type gateway --org user@example.com

# Test with Gateway authentication and custom model
node scripts/test-api.js --auth-type gateway --org user@example.com --model llmgateway__OpenAIGPT4OmniMini

# Test with custom message
node scripts/test-api.js --auth-type gemini --message "What is 2+2?"

```

### Available Options

- **`-a, --auth-type <type>`**: Authentication type (`gemini` or `gateway`)
- **`-m, --model <model>`**: Model to use (optional)
- **`-o, --org <org>`**: Organization (required for gateway auth)
- **`-w, --workspace-root <path>`**: Workspace root directory
- **`-s, --server-url <url>`**: Server URL (default: `http://localhost:3000`)
- **`--message <message>`**: Custom test message
- **`-t, --timeout <ms>`**: Request timeout in milliseconds (default: 30000)
- **`-v, --verbose`**: Enable verbose output
- **`-h, --help`**: Show help message

### Test Workflow

The script performs the following steps:

1. **Environment Validation**: Checks required environment variables
2. **Health Check**: Verifies server is running and healthy
3. **Session Creation**: Creates a new chat session with specified config
4. **Streaming Message**: Sends a test message and validates streaming response
5. **Response Validation**: Ensures all events are received properly
