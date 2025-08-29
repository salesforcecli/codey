# scale-center

Minimal Slack app with a global shortcut that posts a message to `#scale-center-alerts`. Intended for demo use only.

## Local setup (Socket Mode + Global Shortcut)

1. Install deps from the repo root:
```bash
npm install
```

2. Create `packages/scale-center/.env` with:
```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-1-A...        # App-level token with connections:write
SCALE_CENTER_ALERTS_CHANNEL_ID=CXXXXXXX  # ID of #scale-center-alerts
PORT=3012
```

3. Slack app configuration (`https://api.slack.com/apps`):
- Basic Information → Install the app to your workspace
- OAuth & Permissions → Bot Token Scopes: `chat:write`
- Socket Mode → Enable, create App-Level Token with `connections:write`
- Interactivity & Shortcuts → Create Global Shortcut:
  - Name: "Scale Center Alert"
  - Callback ID: `scale_center_alert`
  - Short Description: "Post an alert to #scale-center-alerts"
- Invite the bot user to `#scale-center-alerts`

4. Run locally:
```bash
npm run dev --workspace scale-center
```

## Usage
- In Slack, click the lightning bolt (shortcuts) in any message box → choose "Scale Center Alert"
- A modal opens; enter the alert text and submit
- The message is posted by the Scale Center bot into `#scale-center-alerts`
