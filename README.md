# Codey

![Codey Screenshot](./docs/assets/codey.png)

**This project is under active development and is not available yet.**

Codey is an open-source AI agent that brings the power and trust of Salesforce's LLM Gateway directly into your terminal.

## Run Locally

```
git clone https://github.com/salesforcecli/codey-private.git
cd codey-private
npm install
npm run build
```

### Run with DE Org

Create a Developer Edition org and then set the `CODEY_ORG_USERNAME` in your environment:

```
export CODEY_ORG_USERNAME="your_username_here"
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
