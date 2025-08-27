## Codey Slack POC: Hosted API Integration Requirements

### Scope
- Minimal proof-of-concept that lets Slack users interact with `codey-hosted` sessions via slash commands. No tests, metrics, rate limiting, or production hardening.

### Configuration
- Environment variables (required unless noted):
  - `SLACK_BOT_TOKEN`
  - `SLACK_APP_TOKEN` (Socket Mode)
  - `CODEY_HOSTED_BASE_URL` (example: `https://<your-hosted-domain>`)
  - `CODEY_HOSTED_TOKEN` (must match `POC_ACCESS_TOKEN` in `codey-hosted`)

### Hosted API usage
- All requests include header: `Authorization: Bearer ${CODEY_HOSTED_TOKEN}`
- Endpoints used:
  - POST `${CODEY_HOSTED_BASE_URL}/api/sessions`
    - Body: `{ "workspaceRoot": string }`
    - Success: `201 { "sessionId": string }`
  - POST `${CODEY_HOSTED_BASE_URL}/api/sessions/{sessionId}/messages`
    - Body: `{ "message": string, "workspaceRoot": string }`
    - Success: `200 { "sessionId": string, "response": string, "timestamp": string }`

### Session mapping (Slack-side)
- Maintain an in-memory map: key = `team_id:channel_id:thread_ts?` → value = `{ sessionId, workspaceRoot }`.
- If the user posts in a thread, bind the session to that thread; otherwise bind to the channel.
- Mapping is in-memory only; it resets when the process restarts.

### Commands
- `/codey [message]`
  - If a mapping exists for the current conversation: send the message to the existing session
    - Call `POST /api/sessions/{sessionId}/messages` with the stored `workspaceRoot` and the provided `message`.
    - Post the `response` back to the same thread.
  - If no mapping exists: prompt the user for a workspace root
    - Send an ephemeral message instructing: "No active session. Run `/codey chat <workspace-root> <message>` to start one."
    - No modal/interactive UX for the POC.

- `/codey chat <workspace-root> <message>`
  - Always start a new session for the current conversation using `<workspace-root>`.
    - Call `POST /api/sessions` with `{ workspaceRoot: <workspace-root> }`.
    - Store `{ sessionId, workspaceRoot }` in the mapping for this conversation (replacing any prior mapping).
    - Immediately send the `<message>` to the new session via `POST /api/sessions/{sessionId}/messages`.
    - Post the `response` back to the same thread.

- `/codey status`
  - If a mapping exists: return an ephemeral message showing the current `sessionId` and `workspaceRoot` for this conversation.
  - If no mapping exists: return an ephemeral message indicating no active session.

### Slack handling details
- Acknowledge slash commands within 3 seconds; perform network calls after ack and then reply.
- Replies should be posted in-thread when the command is invoked from a thread; otherwise reply to the channel and start a thread.
- Keep formatting simple; preserve code fences in responses.

### Minimal error handling
- 401 from hosted: return an ephemeral message indicating the hosted token/config appears invalid.
- 404 from hosted when sending a message: clear the mapping and return an ephemeral message asking the user to run `/codey chat <workspace-root> <message>` to create a new session.
- Other errors: return a short ephemeral message indicating the request failed.

### Non-goals for the POC
- No model selection or configuration commands.
- No persistence beyond in-memory mapping.
- No interactive modals or dialogs.
- No streaming responses; send final text only.

### Examples
- Start a new session and send a message (explicit root):
  - `/codey chat ~/repos/my-project "List open TODOs in the codebase"`

- Send another message in the same conversation (uses existing session):
  - `/codey "Summarize the previous answer in 3 bullet points"`

- Check status:
  - `/codey status`


