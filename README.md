# Codey

![Codey Screenshot](./docs/assets/codey.png)

**This project is under active development and is not available yet.**

Codey is an open-source Agentic CLI that brings the power and trust of Salesforce's LLM Gateway directly into your terminal. This project is a fork of Google's gemini-cli(https://github.com/google-gemini/gemini-cli).

## Run Locally

```
git clone https://github.com/salesforcecli/codey-private.git
cd codey-private
npm install
npm run build
```

### Run with DE Org

Create a Developer Edition org and then set the `CODEY_GATEWAY_ORG` in your environment:

```
export CODEY_GATEWAY_ORG="your_username_here"
```

Finally, run Codey in any project directory

```
node ~/path/to/codey-private/scripts/start.js
```

### Run with Gemini

If you don't already have an API key, go [here](https://ai.google.dev/gemini-api/docs) and click `Get a Gemini API Key`.

Then, set the `GEMINI_API_KEY` in your environment:

```
export GEMINI_API_KEY="your_api_key_here"
```

Finally, run Codey in any project directory

```
node ~/path/to/codey-private/scripts/start.js
```

## CODEY.md

Codey will look for a `CODEY.md` file in the root directory of the project. If it exists, Codey will use it to guide his actions.

## MCP

See Google's documentation [here](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md)

Instead of `.gemini` use `.codey`.
