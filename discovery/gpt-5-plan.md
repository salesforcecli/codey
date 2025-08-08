# Plan: Replace Gemini backend with Salesforce LLM Gateway in `@gemini-cli`

## Goals and constraints

- Keep the external CLI API and internal `ContentGenerator` interface unchanged.
- Reuse the existing auth strategy and UI/UX. Only the LLM backend changes.
- No need to be fully backward compatible; we can add types/fields as needed internally.
- The CLI has no pre-authorized org. Assume an environment variable supplies the username to an already-authenticated org. Use `@salesforce/core` `Org` to obtain an authenticated `Connection` and exchange for a JWT.
- Target the Salesforce LLM Gateway endpoints and headers per `@llmg-api-spec.md` and environment/endpoint conventions from `@vscode-llmg-integration.md`.

References
- `@salesforce/core` `Org` class for connection lookup and auth: https://github.com/forcedotcom/sfdx-core/blob/a7d0d1dde4b9cc2be171777116e75e947382142b/src/org/org.ts

## High-level approach

- Introduce a new `ContentGenerator` implementation: `LlmgContentGenerator`.
- Add a new `AuthType` (e.g., `USE_SF_LLMG`) and wire it into `createContentGenerator(...)` factory in `packages/core/src/core/contentGenerator.ts`.
- Keep existing Gemini and Vertex implementations intact; selection via existing config/env flow.
- Centralize Salesforce environment + endpoints in a small config module and construct the correct base URL (`prod`, `dev`, `test`, `perf`, `stage`).
- Acquire a JWT from the user’s Salesforce org using `@salesforce/core` and call the LLM Gateway with Salesforce headers.

## Project structure changes

- packages/core/
  - src/
    - llmg/
      - LlmgContentGenerator.ts (new)
      - llmg-types.ts (request/response mapping types; optional)
      - jwt.ts (JWT parsing/expiry helper with 30s buffer)
      - env.ts (environment to base URL mapping)
    - core/
      - contentGenerator.ts (add `AuthType.USE_SF_LLMG`, update factory)
    - config/
      - config.ts (add fields for Salesforce env, username env var, default headers)

## Dependencies

- Add to `packages/core/package.json`:
  - `@salesforce/core` (Org/Connection)
  - `jsonwebtoken` (decode-only or equivalent lightweight decoder) or a small local base64url decoder to read claims
  - Optional: token estimator if we need `countTokens` parity (e.g., `gpt-tokenizer` or `tiktoken` via wasm). Otherwise, implement a simple heuristic.

## Configuration

 - Environment variables (defaults shown):
  - `SF_LLMG_USERNAME` (required): Username (or alias) of an already-authenticated org.
  - `SF_API_ENV` (optional): `prod` | `dev` | `test` | `perf` | `stage` (default `prod`).
  - Note: The following headers are fixed constants and are not configurable: `x-client-feature-id`, `x-llm-provider`, `x-sfdc-app-context`.

## Authentication and JWT acquisition

1. Create `Org` via `Org.create({ aliasOrUsername: process.env.SF_LLMG_USERNAME })`.
2. Get an authenticated `Connection` from the `Org`.
3. Call the org’s instance URL to obtain a JWT for the Gateway:
   - POST `${connection.instanceUrl}/ide/auth`
   - Response `{ jwt: string }` (per `@vscode-llmg-integration.md`).
4. Decode the JWT to extract expiration (`exp`) and tenant id (for `x-sfdc-core-tenant-id`). Cache the token until ~30s before expiry; refresh on expiry or 401.
5. Send `Authorization: Bearer <jwt>` to the LLM Gateway.

## Endpoint and header strategy

- Environment base URLs (per `@vscode-llmg-integration.md`):
  - prod: `https://api.salesforce.com`
  - dev: `https://dev.api.salesforce.com`
  - test: `https://test.api.salesforce.com`
  - perf: `https://perf.api.salesforce.com`
  - stage: `https://stage.api.salesforce.com`

- Prefer the VS Code path segment for code features for now:
  - Non-stream generations: `POST /einstein/gpt/code/v1.1/generations`
  - Stream generations: `POST /einstein/gpt/code/v1.1/generations/stream`
  - Feedback: `POST /einstein/gpt/code/v1.1/feedback`
  - Embeddings: `POST /einstein/gpt/code/v1.1/embeddings`

- Keep the path segment configurable so we can switch to the root `@llmg-api-spec.md` shape (`/generations`, `/chat/generations`, etc.) without code edits.

 - Required headers (aligned to VS Code client; see `SfApiClient.ts`):
  - `Authorization: Bearer <jwt>`
  - `Content-Type: application/json`
  - `x-client-feature-id: EinsteinGptForDevelopers`
  - `x-llm-provider: InternalTextGeneration`
  - `x-sfdc-app-context: EinsteinGPT`
  - `x-sfdc-core-tenant-id`: from JWT claim when present; fallback to `SF_LLMG_CORE_TENANT_ID`
  - `x-salesforce-region`: derived from `SF_API_ENV` (same mapping as VS Code: Production→EAST_REGION_1, Stage→EAST_REGION_2, Dev/Test/Perf→WEST_REGION)
  - `x-client-trace-id`: generated per request

## Request/response mapping to `ContentGenerator`

`ContentGenerator` methods remain unchanged:

- generateContent(request: GenerateContentParameters)
  - Map to either chat-style (`/chat/generations`) or code generations (`/einstein/gpt/code/.../generations`).
  - Build `messages` array:
    - Map roles: system → system, user → user, model → assistant, tool → tool
    - If existing Gemini requests provide a single prompt string, wrap it as a single user message.
  - Map generation settings:
    - `max_tokens`, `temperature`, `stop_sequences`, penalties, `top_p/top_k` (via `parameters` passthrough when supported)
  - Include `tools` and `tool_config` if present (function-calling and web search are supported by LLMG per spec).
  - Non-stream: call `/generations`; return first completion text as `GenerateContentResponse`-compatible payload.

- generateContentStream(request: GenerateContentParameters)
  - Call `/generations/stream`.
  - Convert server stream into `AsyncGenerator<GenerateContentResponse>`:
    - Parse each server event/chunk into `{ generatedText, done, toolInvocations? }` shape
    - Yield compat chunks; finalize with `done: true`

- countTokens(request: CountTokensParameters)
  - If there is no native LLMG count endpoint, implement a best-effort estimator:
    - Use a tokenizer lib dependency (preferred), else a heuristic based on whitespace + punctuation.
  - Return `CountTokensResponse` compatible fields.

- embedContent(request: EmbedContentParameters)
  - Map to `/embeddings` with `input: string[]`, optional `model`, and passthrough `parameters`.
  - Return vectors mapped into `EmbedContentResponse`.

## Error handling

- Normalize HTTP errors into existing error surface:
  - Map 401/403 to auth errors that trigger JWT refresh + retry once.
  - Map 429 to rate-limit error (optionally include `Retry-After`).
  - Preserve gateway error codes/messages from body in an `error` field for diagnostics.



