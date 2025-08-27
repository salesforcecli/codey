# codey-slack

Minimal Slack app (Bolt for JavaScript) using Socket Mode. Replies "Hello" to app mentions and supports a simple `/codey` slash command.

## Setup
- Node.js 20+
- Slack workspace where you can install apps

### Slack app configuration
1. Create an app at `https://api.slack.com/apps`.
2. Enable Socket Mode and create an App-Level Token with scope `connections:write`.
3. Install the app to your workspace; ensure the Bot Token has scopes: `app_mentions:read`, `chat:write`.
4. (Optional) Add a slash command `/codey`.

### Local run
1. Install dependencies from repo root:
```bash
npm install
```
2. Export required env vars (or use your preferred secrets manager):
```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-1-A... # Socket Mode app-level token
export PORT=3001
```
3. Start the app:
```bash
npm run dev --workspace codey-slack
```
4. In Slack:
- Mention the app: `@your-app hello`
- Or run: `/codey`

Notes:
- Socket Mode requires no public URL or tunnel.
- Edit handlers in `src/index.ts` to iterate.
