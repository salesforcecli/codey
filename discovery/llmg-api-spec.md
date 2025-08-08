# Salesforce LLM Gateway (LLMG) API

This document provides a complete, readable reference for the Salesforce LLM Gateway API. It includes all non-deprecated endpoints, required headers, full request/response schemas, and nested object definitions to support agentic feature development.

Notes
- Authentication: apiKeyAuth, c2cAuth, or orgJWT (as supported per endpoint)
- Required headers for direct REST usage: `x-client-feature-id`, `x-sfdc-app-context`, `x-sfdc-core-tenant-id`
- Provider override header `x-llm-provider` is generally not required; avoid unless using the `models/` endpoint or a Salesforce Research model
- Deprecated endpoints are omitted from this document by design


## Common HTTP Headers

Provide these headers (as applicable) with all requests when calling the REST API directly:

- x-client-feature-id (string, required): Identifier for your application.
- x-sfdc-app-context (string, required): Hawking app context associated with your app. Example: `EinsteinGPT`.
- x-sfdc-core-tenant-id (string, required): Core tenant identifier. Example: `core/prod1/00DDu00000008cuqMAA`.
- x-llm-provider (string, optional): Provider to use. Enum: `AzureOpenAI`, `OpenAI`, `Cohere`, `InternalTextGeneration`, `InternalCodeGeneration`, `InternalEmbedding`, `Anthropic`, `Bedrock`, `VertexAI`.

Additional notes
- `x-org-id` is deprecated. Use `x-sfdc-core-tenant-id` instead.


## Endpoint: POST /generations — Generate response

- Description: Generate a response based on a prompt and model parameters.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json;charset=utf-8

Request body
- prompt (string, required): Prompt text.
- num_generations (integer, default: 1): Number of completions to generate.
- max_tokens (integer): Max tokens to generate.
- temperature (number): Sampling temperature (0 to 1.0). Higher is more random.
- stop_sequences (string[]): Array of stop sequences.
- frequency_penalty (number): 0.0 to 1.0. Penalize repeated tokens by frequency.
- presence_penalty (number): 0.0 to 1.0. Penalize token repetition by presence.
- enable_pii_masking (boolean, default: false): Mask PII in the prompt.
- enable_input_safety_scoring (boolean, default: false): Safety scoring on input.
- enable_output_safety_scoring (boolean, default: true): Safety scoring on outputs.
- enable_input_bias_scoring (boolean, default: false): Bias scoring on input.
- enable_output_bias_scoring (boolean, default: false): Bias scoring on output.
- model (string, required): Model identifier to use.
- parameters (object): Provider-specific passthrough parameters.

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 404 Not Found
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /generations/stream — Generate response with streaming

- Description: Stream a generated response for the given prompt and parameters.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json;charset=utf-8

Request body (same fields as POST /generations)
- prompt (string, required)
- num_generations (integer, default: 1)
- max_tokens (integer)
- temperature (number)
- stop_sequences (string[])
- frequency_penalty (number)
- presence_penalty (number)
- enable_pii_masking (boolean, default: false)
- enable_input_safety_scoring (boolean, default: false)
- enable_output_safety_scoring (boolean, default: true)
- enable_input_bias_scoring (boolean, default: false)
- enable_output_bias_scoring (boolean, default: false)
- model (string, required)
- parameters (object)

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /chat/generations — Generate chat response (stateless)

- Description: Generate a response from a list of role-annotated messages.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json;charset=utf-8

Request body
- model (string, required): Chat model identifier.
- messages ([ChatMessageRequest](#chatmessagerequest)[], required): Ordered list of chat messages.
- generation_settings ([GenerationSettings](#generationsettings)): Generation configuration. Required in some environments.
- log_probability_settings ([LogProbabilitySettings](#logprobabilitysettings)): Log-probability settings.
- composition_settings ([CompositionSettings](#compositionsettings)): Message composition settings.
- enable_pii_masking (boolean): Defaults to true for external providers and false for internal; can be overridden.
- enable_input_safety_scoring (boolean, default: false): Not exposed through SFAP (internal default applies).
- enable_output_safety_scoring (boolean, default: true): Not exposed through SFAP (internal default applies).
- enable_input_bias_scoring (boolean, default: false)
- enable_output_bias_scoring (boolean, default: false)
- localization ([Localization](#localization)): Localization inputs/outputs.
- tags ([Tags](#tags) | null): Gateway-defined and client-defined metadata entries.
- turn_id (string): Planner turn identifier.
- slots_to_data ([SlotFillingData](#slotfillingdata)): Slot-filling metadata for masked fields.
- debug_settings ([DebugSettings](#debugsettings)): Include masked data transformation details.
- system_prompt_strategy (string): Strategy for system message. Example: `use_model_parameter`.
- tools ([ChatCompletionTool](#chatcompletiontool)[]): Allowed tools (function calling, web search) with tool-specific definitions.

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 404 Not Found
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /chat/generations/stream — Generate chat response with streaming (stateless)

- Description: Stream a generated response from role-annotated messages.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json;charset=utf-8

Request body (same structure as POST /chat/generations)
- model (string, required)
- messages ([ChatMessageRequest](#chatmessagerequest)[], required)
- generation_settings ([GenerationSettings](#generationsettings))
- log_probability_settings ([LogProbabilitySettings](#logprobabilitysettings))
- composition_settings ([CompositionSettings](#compositionsettings))
- enable_pii_masking (boolean; default semantics as above)
- enable_input_safety_scoring (boolean, default: false)
- enable_output_safety_scoring (boolean, default: true)
- enable_input_bias_scoring (boolean, default: false)
- enable_output_bias_scoring (boolean, default: false)
- localization ([Localization](#localization))
- tags ([Tags](#tags) | null)
- turn_id (string)
- slots_to_data ([SlotFillingData](#slotfillingdata))
- debug_settings ([DebugSettings](#debugsettings))
- system_prompt_strategy (string)
- tools ([ChatCompletionTool](#chatcompletiontool)[])

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 404 Not Found
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /plugins/{plugin-name}/generations — Generate plug-in response

- Description: Generate a response to an external request handled by a plug-in.
- Path params: plugin-name (string, required)
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json

Request body
- property name* (any): Arbitrary key-value properties passed to the plug-in endpoint.

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /plugins/{plugin-name}/generations/stream — Streamed plug-in response

- Description: Stream a plug-in generated response.
- Path params: plugin-name (string, required)
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json

Request body
- property name* (any): Arbitrary key-value properties passed to the plug-in endpoint.

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /embeddings — Create embedding

- Description: Create an embedding vector representing the input text.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json;charset=utf-8

Request body
- input (string[], required): Array of input strings to embed.
- model (string): Embedding model. If omitted, defaults to provider-specific model.
- enable_pii_masking (boolean, default: false): Mask PII in the input prior to embedding.
- localization ([Localization](#localization)): Localization configuration.
- parameters (object): Provider-specific passthrough.
- tags ([Tags](#tags) | null): Gateway/client metadata.

Responses
- 200 OK
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /batch/embeddings — Create batch embeddings

- Description: Submit a batch job to create embeddings.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json

Request body
- data_source ([DataSource](#datasource)): Source configuration for the batch data.
- model (string, required): Embedding model identifier.
- enable_pii_masking (boolean, default: false)
- localization ([Localization](#localization))
- parameters (object): Provider-specific passthrough.

Responses
- 202 Accepted — Successful operation
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 404 Not Found
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: GET /batch/{jobId} — Get batch job status

- Description: Retrieve status for a batch job.
- Path params: jobId (string, required)
- Auth: apiKeyAuth, c2cAuth, orgJWT

Response (200 OK)
- jobId (string)
- status (string): Example values include: `ACCEPTED`, `RUNNING`, `SUCCEEDED`, `FAILED`.
- startTime (string)
- endTime (string)
- error (string)

Other responses
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 404 Not Found
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- default Something went wrong


## Endpoint: POST /feedback — Register feedback

- Description: Register feedback for a generation.
- Auth: apiKeyAuth, c2cAuth, orgJWT
- Content-Type: application/json

Request body
- id (string): Unique feedback identifier.
- generation_id (string): Identifier of the generation being rated; may be any client-chosen identifier.
- feedback ("GOOD" | "BAD" | null): Sentiment. If null, `feedback_text` must be provided.
- feedback_text (string): Free-text feedback. Required if `feedback` is null.
- source (string): Source of feedback, e.g., `human` or `app`.
- app_feedback (object): Dictionary of app-level or free-form parameters.
- app_generation_id (string): Client generation ID when multiple responses exist.
- app_generation (string): Client generation text.
- turn_id (string): Planner turn identifier.

Responses
- 202 Accepted
- 400 Bad Request
- 401 Access bearer token is missing or invalid
- 403 Forbidden
- 423 Server busy
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable


## Object Definitions

These objects are referenced by one or more endpoints. All fields listed below were extracted from the API documentation. Some objects are provider-dependent and may accept additional properties via `parameters`.

### ChatMessageRequest
- role (string): One of `system`, `user`, `assistant`, `tool` (provider-specific set may vary). Ordered chronologically.
- content (string | [MessageContent](#messagecontent)[]): Content for the message, possibly multi-part.
- name (string, optional): Tool/function name or participant identifier as required by some providers.
- tool_call_id (string, optional): Links assistant message to a prior tool call.

### GenerationSettings
- max_tokens (integer): Maximum tokens to generate.
- temperature (number): 0–1.0.
- stop_sequences (string[]): Stop sequences.
- frequency_penalty (number): 0.0–1.0.
- presence_penalty (number): 0.0–1.0.
- top_p (number, optional): Nucleus sampling parameter if supported by the provider.
- top_k (integer, optional): If supported by provider.
- seed (integer, optional): If supported by provider.

### LogProbabilitySettings
- enable (boolean): Whether to enable log-probabilities in outputs.
- top_k (integer): Number of tokens for which to return probabilities.

### CompositionSettings
- system_message (string): Optional system prompt override.
- tool_choice (string | object): Forced tool selection or provider-specific tool routing config.
- response_format (string | object): JSON/text or stricter schemas when supported.

### Localization
- default_locale (string): Default locale for inputs/outputs, e.g., `en-US`.
- input_locales (string[]): Declared input locales.
- output_locales (string[]): Expected output locales.

### Tags
- gateway (object): Reserved keys used by the gateway (non-generative tracking).
- client (object): Free-form client-owned metadata.

### SlotFillingData
- slots (object[]): Collection of slots found in the input, with placeholders and classification tags.
- placeholders (object): Placeholder mapping for masked content.
- classifications (object): Tagging for masked fields.

### DebugSettings
- include_masked_data_details (boolean): Include masked data details in transformation.

### ChatCompletionTool
- type (string): Tool type. Examples include `function`, `web_search`.
- function (object, when type=function):
  - name (string)
  - description (string)
  - parameters (JSON Schema object)
- web_search (object, when type=web_search):
  - provider (string)
  - options (object)

### UserMessage
- role (constant `user`)
- content (string)

### MessageContent
- type (string): E.g., `text`, `image_url`, `input_audio`, etc. (provider-dependent)
- text (string, when type=text)
- url (string, when type=image_url | input_audio)

### DataSource
- type (string): Batch source type (e.g., `s3`, `vector-db`, `file`).
- uri (string): Location/identifier.
- format (string): Input data format.
- options (object): Source-specific options (headers, auth, parsing rules, etc.).


## Error Model (generic examples)

Errors may be returned in provider- or gateway-specific formats. Typical fields include:
- error_code (string): Example: `REQUIRED_FIELD_MISSING`
- message_code (string): Example: `EXXXXX`
- message (string): Human-readable description


## Deprecations (not included in endpoints above)

The following endpoint families are marked as deprecated in the HTML spec and are intentionally excluded here:
- /models (List models)
- /llm-providers (List providers)
- /chat/sessions (Create stateful chat session)
- /chat/session/{session-id} (Get stateful chat session)
- /chat/session/{session-id}/messages (Generate stateful chat response)

These have equivalents or superseding stateless APIs documented above.
