# codey-server

A lightweight Hono + Pino Node.js server that replaces the Next.js-based `codey-hosted` API. It exposes the same API surface, except streaming is moved to a dedicated endpoint.

## Requirements

- Node.js 18+

## Install & Run

From the monorepo root:

```bash
# Build once
npm run -w packages/codey-server build

# Development (watch)
npm run -w packages/codey-server dev

# Start (after build)
npm run -w packages/codey-server start
```

The server listens on `PORT` (default 3000).

## API

Base path: `/api`

- GET `/api/health`
  - 200 JSON:
    ```json
    { "status": "healthy", "timestamp": "<ISO>", "service": "codey-server" }
    ```

- POST `/api/sessions`
  - Request JSON: `{ "workspaceRoot": string, "model"?: string }`
  - 201 JSON on success: `{ "sessionId": "<id>" }`
  - Header: `Location: /api/sessions/<id>`

- POST `/api/sessions/:id/messages` (non-streaming)
  - Request JSON: `{ "workspaceRoot": string, "message": string }`
  - 200 JSON on success:
    ```json
    { "sessionId": "<id>", "response": "<string>", "timestamp": "<ISO>" }
    ```

- POST `/api/sessions/:id/messages/stream` (streaming)
  - Same request JSON as non-streaming.
  - Responds with NDJSON stream of `ServerGeminiStreamEvent` objects.
  - Headers:
    - `Content-Type: application/x-ndjson`
    - `Cache-Control: no-cache`
    - `Connection: keep-alive`
    - `Transfer-Encoding: chunked`

## Notes

- Uses in-memory sessions with periodic cleanup of idle sessions (>2h).
- Logging via Pino with pretty transport in development.
