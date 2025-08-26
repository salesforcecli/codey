# Gemini CLI Server

A simple HTTP server for the Gemini CLI that provides REST API endpoints for session management and message processing.

## Features

- RESTful API for session management
- Real-time message processing with tool execution
- Structured JSON logging
- CORS support for development

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### Create Session
```
POST /sessions
Content-Type: application/json

{
  "workspaceRoot": "/path/to/workspace",
  "model": "gemini-1.5-pro" // optional
}
```
Creates a new session and returns a session ID.

### Send Message
```
POST /sessions/{sessionId}/messages
Content-Type: application/json

{
  "message": "Your message here",
  "workspaceRoot": "/path/to/workspace",
  "model": "gemini-1.5-pro" // optional
}
```
Sends a message to an existing session and returns the AI response.

## Logging

The server includes comprehensive JSON logging for observability:

### Log Format
All logs are output as JSON with the following structure:
```json
{
  "timestamp": "2025-01-27T10:30:45.123Z",
  "level": "INFO|ERROR|WARN|DEBUG",
  "message": "Description of event",
  "requestId": "req_abc123",
  "sessionId": "sess_xyz",
  "...": "additional context fields"
}
```

### Log Events

#### Server Lifecycle
- **Server startup**: Logs when server starts with configuration
- **Request received**: Logs all incoming HTTP requests
- **Request completed**: Logs response status and timing

#### Session Management
- **Session created**: Logs when new sessions are created
- **Session reused**: Logs when existing sessions are accessed

#### Tool Execution
- **Tool executing**: Logs when AI tools are being executed
- **Tool completed**: Logs successful tool completion with timing
- **Tool failed**: Logs tool execution errors with details

#### Error Handling
- **Request errors**: Invalid requests, missing parameters
- **Processing errors**: Internal server errors with stack traces
- **Tool errors**: Failed tool executions with error details

### Example Log Output

```json
{"timestamp":"2025-01-27T10:30:45.123Z","level":"INFO","message":"Server started","port":3000,"nodeVersion":"v20.11.0","environment":"development","endpoints":["GET /health","POST /sessions","POST /sessions/{id}/messages"]}

{"timestamp":"2025-01-27T10:30:50.456Z","level":"INFO","message":"Request received","requestId":"req_abc123","method":"POST","path":"/sessions"}

{"timestamp":"2025-01-27T10:30:50.789Z","level":"INFO","message":"Session created","sessionId":"sess_xyz","requestId":"req_abc123","workspaceRoot":"/path/to/workspace","model":"gemini-1.5-pro"}

{"timestamp":"2025-01-27T10:30:51.012Z","level":"INFO","message":"Request completed","requestId":"req_abc123","statusCode":201,"duration":556,"sessionId":"sess_xyz"}
```

## Development

To run the server:
```bash
npm run dev
```

To build:
```bash
npm run build
```

To start built version:
```bash
npm start
```
