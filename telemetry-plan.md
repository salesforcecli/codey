# Telemetry Integration Plan — forcedotcom/telemetry (clean cut)

This document proposes a minimal-blast-radius plan to route all product telemetry through the `forcedotcom/telemetry` library’s `TelemetryReporter` without touching callers. We’ll iterate here before any implementation.

## Goals

- Clean-cut switch to `forcedotcom/telemetry` as the telemetry provider.
- Keep changes localized and mostly outside `sdk.ts` by introducing a dedicated provider module; `sdk.ts` remains a thin delegator.
- Preserve existing feature behavior for traces, logs, metrics as much as feasible.
- No changes to UI metrics aggregation (e.g., `uiTelemetryService`).
- Supported targets in this fork: `local` and `forcedotcom` only (exclude `gcp`).

## Non-goals

- Migration coexistence with current OTLP pipelines (we’ll cut over directly).
- Rewriting instrumentation across the codebase.

## Current state (summary)

- Telemetry is driven by OpenTelemetry Node SDK in `packages/core/src/telemetry/sdk.ts` with OTLP exporters (gRPC/HTTP), controlled by CLI flags and settings (enabled/target/endpoint/protocol/outfile).
- Helper scripts exist for local/GCP collectors, but in this fork we will only support the `local` path; `gcp` is out of scope.
- `packages/core/src/telemetry/uiTelemetry.ts` aggregates UI stats locally only (no external export).

## Proposed approach (Option A: clean cut)

We’ll keep OpenTelemetry as the in-process instrumentation layer but route export through a dedicated provider module that adapts OTel signals to `TelemetryReporter`. `sdk.ts` will only delegate to this module when the target is selected.

- Introduce a new telemetry target: `forcedotcom`.
- Add a provider module `packages/core/src/telemetry/providers/forcedotcom.ts` that:
  - Defines `class ForcedotcomBypassReporter extends TelemetryReporter` overriding `isSfdxTelemetryEnabled()` to always return `true` (external gate is CLI flag).
  - Initializes a singleton reporter via `await ForcedotcomBypassReporter.create(options)`.
    - Use `const` values in code for `APP_INSIGHTS_KEY` and `O11Y_UPLOAD_ENDPOINT`.
    - Pass `enableAppInsights: true` and `enableO11y: true` in options.
    - Set `project`, `userId`, `sessionId`, and optionally `contextTags/commonProperties` as needed.
  - Exposes minimal OTel bridge exporters: ONLY allow-listed events and an exception-only trace exporter.
    - Allow-listed events → filtered log exporter that only sends approved event types
    - Exceptions (extracted from span events) → `reporter.sendTelemetryException(error, properties)`
    - Do NOT export metrics, general traces, or non-allow-listed logs for this target.
  - Provides a small contract back to `sdk.ts`:
    - `setupForcedotcomTelemetry(config) => { exceptionTraceExporter, logExporter, stop }`
    - `stop` flushes and disposes the reporter (`await reporter.dispose()`).
- In `sdk.ts`, when target = `forcedotcom`:
  - Call `setupForcedotcomTelemetry` to obtain exporters and register them with the Node SDK.
  - On shutdown, call `stop()` then shut down OTel as usual.
- When target ≠ `forcedotcom`, keep existing OTLP exporters unchanged for the `local` path.

Rationale: isolates provider-specific logic; minimal diffs in `sdk.ts`; no caller changes; easy rollback by switching target.

## Signal mapping (initial design)

### Exceptions (from traces)

- Register a TraceExporter that inspects finished spans only to extract exception events.
  - For span events with semantic exception fields (`exception.type`, `exception.message`, `exception.stacktrace`):
  - Construct an Error and call `sendTelemetryException(error, attributes)`.
  - Include limited context (trace_id, span_id, service/resource attrs).
- Do NOT send general span events or spans as telemetry; this exporter is exception-only.

### Metrics

- No metrics exported for the `forcedotcom` target.
- No log exporter for this target except for allow-listed events.

## Configuration model

- Single gate: `telemetry.enabled` (from CLI flag / settings) decides whether we initialize the forcedotcom provider at all.
- New target value: `telemetry.target = "forcedotcom"`.
- Provider secrets/endpoint are hardcoded constants in code (no new config keys):
  - `const APP_INSIGHTS_KEY =
  'InstrumentationKey=2ca64abb-6123-4c7b-bd9e-4fe73e71fe9c;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=ecd8fa7a-0e0d-4109-94db-4d7878ada862';`
  - `const O11Y_UPLOAD_ENDPOINT =
    'https://794testsite.my.site.com/byolwr/webruntime/log/metrics';`
- We ALWAYS attempt to enable both AppInsights and O11y (via options):
  - `enableAppInsights: true`, `enableO11y: true`.
- No secondary gating: the external gate is our CLI `telemetry.enabled`. We WILL subclass `TelemetryReporter` to override `isSfdxTelemetryEnabled()` to always return `true`; initialization uses `ForcedotcomBypassReporter.create(options)`.
  ```ts
  class ForcedotcomBypassReporter extends TelemetryReporter {
    public isSfdxTelemetryEnabled(): boolean {
      return true;
    }
  }
  ```

Notes:

- Both channels (AppInsights + O11y) are attempted on day one; no per-channel enable flags.

## Integration points

- New provider module: `packages/core/src/telemetry/providers/forcedotcom.ts`
  - Owns reporter lifecycle and OTel-to-reporter mapping.
  - Initializes reporter using `await ForcedotcomBypassReporter.create({ project, key: APP_INSIGHTS_KEY, o11yUploadEndpoint: O11Y_UPLOAD_ENDPOINT, enableO11y: true, enableAppInsights: true, userId, sessionId, extensionName })`.
  - Returns an exception-only trace exporter, a metric exporter, and a `stop()` function.
- Minimal change in `packages/core/src/telemetry/sdk.ts`:
  - Add `forcedotcom` branch that imports and invokes `setupForcedotcomTelemetry`.
  - Register returned exporters with the Node SDK.
  - On shutdown, invoke `stop()` before shutting down OTel.
- No changes to callers or to `uiTelemetryService`.

### Suggested file layout

```
packages/core/src/telemetry/
  sdk.ts                      # thin delegator by target
  providers/
  forcedotcom.ts           # reporter init + OTel bridge exporters (metrics + exception-only)
  uiTelemetry.ts             # unchanged
```

## Shutdown and lifecycle

- On shutdown (`shutdownTelemetry`):
  - Call `await reporter.dispose()` to flush and close channels.
  - Ensure OTel SDK shutdown still occurs to flush processors.

## Risks and mitigations

- Attribute volume/PII: rely on library defaults for redaction; no custom redaction needed initially.
- Metrics parity: begin with gauges/sums; schedule histogram handling later if required.
- Bypassed internal gating: documented via subclass; external control is simpler (single flag). Add a code comment explaining rationale.

## Open questions

- Do we need runtime metrics about dropped exceptions/metrics?

## Implementation tasks

Core config & wiring

- [ ] Restrict targets to `local` and `forcedotcom` in config schema / validation.
- [ ] No new settings keys; secrets and endpoint are `const`s in code.
- [x] Add dependency on telemetry library (`@salesforce/telemetry`).

Provider module & instantiation

- [ ] Subclass `TelemetryReporter` (`ForcedotcomBypassReporter`) overriding `isSfdxTelemetryEnabled()`.
- [ ] Implement provider module `providers/forcedotcom.ts` exporting `setupForcedotcomTelemetry(config)` and `stop()`.
- [ ] In setup: `await ForcedotcomBypassReporter.create(options)` using `const` keys; enable both channels.
- [ ] Implement event allow-list filtering with field exclusions for sensitive data.

Exporters (limited scope)

- [ ] Exception-only trace exporter (span event scan → sendTelemetryException).
- [ ] Allow-listed log exporter (filter events by name, exclude specified fields).
- [ ] No metric exporter for forcedotcom target.

Redaction & safety

- [ ] Rely on library defaults for redaction (no custom implementation needed).

SDK integration

- [ ] Modify `sdk.ts` to branch on `forcedotcom` target, register exporters, keep stop handle.
- [ ] Ensure shutdown path invokes provider stop before OTel shutdown.

Nice-to-have (post-MVP)

- [ ] Histogram summarization strategy.
- [ ] Internal perf counters for exporter latency.

Completion criteria

- Forcedotcom target → only allow-listed events + exceptions emitted (no metrics).
- Local target unchanged.
- New tests pass; existing telemetry tests untouched.
- Docs updated with config and disable instructions.

## Telemetry inventory

This section enumerates all telemetry produced by the CLI, grouped by signal type. Emission points are in `packages/core/src/telemetry/loggers.ts` (events/logs), `packages/core/src/telemetry/metrics.ts` (metrics), and various call sites.

Notes:

- Local target: OTel logs, metrics, and traces export via OTLP/console/file per `sdk.ts` config.
- Forcedotcom target: exports ONLY allow-listed events (see below) and exception events (from traces) via `providers/forcedotcom.ts`. Metrics and general logs/traces are NOT exported.

### Events (OTel logs)

**Note**: For the `forcedotcom` target, only the following events are exported (all others are filtered out):

Allow-listed events:
- `gemini_cli.config`
- `gemini_cli.user_prompt` (excluding `user.email` field)
- `gemini_cli.tool_call`
- `gemini_cli.api_request` (excluding `request_text` field)
- `gemini_cli.api_response` (excluding `response_text` field)
- `gemini_cli.api_error`
- `gemini_cli.flash_fallback`
- `gemini_cli.slash_command`
- `gemini_cli.conversation_finished`
- `gemini_cli.chat_compression`
- `gemini_cli.malformed_json_response`
- `gemini_cli.chat.invalid_chunk`
- `gemini_cli.chat.content_retry`
- `gemini_cli.chat.content_retry_failure`
- `gemini_cli.file_operation`
- `tool_output_truncated`
- `loop_detected`

Event details:

- `gemini_cli.config` (CLI configuration)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `model`: Active chat model id
  - `embedding_model`: Active embedding model id
  - `sandbox_enabled`: Whether sandboxing is enabled
  - `core_tools_enabled`: Enabled core tools (comma-separated)
  - `approval_mode`: Current approval mode
  - `api_key_enabled`: Whether API key auth is used
  - `vertex_ai_enabled`: Whether Vertex AI auth is used
  - `debug_mode`: Debug mode flag
  - `telemetry_log_user_prompts_enabled`: Whether prompts are logged
  - `file_filtering_respect_git_ignore`: Whether .gitignore is respected
  - `mcp_servers`: Configured MCP servers (comma-separated)
  - `mcp_servers_count`: Number of MCP servers
  - `mcp_tools`: Discovered MCP tool names (comma-separated)
  - `mcp_tools_count`: Number of MCP tools
  - `output_format`: Current output format (text|json)

- `gemini_cli.user_prompt` (User prompt)
  - `session.id`: Unique session identifier
  - `user.email` (optional): Cached Google account email
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `prompt_length`: Prompt length in characters
  - `prompt_id`: Unique prompt identifier
  - `auth_type` (optional): Authentication type
  - `prompt` (optional): Full prompt text (when enabled)

- `gemini_cli.tool_call` (Tool invocation)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `function_name`: Tool/function name
  - `function_args`: JSON stringified arguments
  - `duration_ms`: Duration in milliseconds
  - `success`: Whether the call succeeded
  - `decision` (optional): Decision taken (accept|reject|modify|auto_accept)
  - `error.message` (optional): Error message
  - `error.type` (optional): Error type/classification
  - `prompt_id`: Originating prompt id
  - `tool_type`: Tool type (native|mcp)
  - `content_length` (optional): Size of tool output
  - `metadata.*` (optional): Diff stats and other metadata

- `gemini_cli.api_request` (LLM API request)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `model`: Target model id
  - `prompt_id`: Originating prompt id
  - `request_text` (optional): Serialized request text

- `gemini_cli.api_response` (LLM API response)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `model`: Target model id
  - `status_code` (optional): Response status (string or number)
  - `http.status_code` (optional): Numeric HTTP status code
  - `duration_ms`: Latency in milliseconds
  - `input_token_count`: Tokens in prompt
  - `output_token_count`: Tokens in response
  - `cached_content_token_count`: Cached tokens
  - `thoughts_token_count`: Thoughts tokens (if provided)
  - `tool_token_count`: Tool-use tokens
  - `total_token_count`: Total tokens
  - `response_text` (optional): Response text
  - `prompt_id`: Originating prompt id
  - `auth_type` (optional): Authentication type

- `gemini_cli.api_error` (LLM API error)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `model_name`: Target model id
  - `duration`: Latency in milliseconds
  - `error.message`: Error message
  - `error.type` (optional): Error classification
  - `http.status_code` (optional): HTTP status code
  - `prompt_id`: Originating prompt id
  - `auth_type` (optional): Authentication type

- `gemini_cli.flash_fallback` (Fallback to flash)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `auth_type`: Authentication type

- `gemini_cli.ripgrep_fallback` (Fallback from ripgrep)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `error` (optional): Error details or reason

- `gemini_cli.next_speaker_check` (Next speaker check)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `prompt_id`: Originating prompt id
  - `finish_reason`: LLM finish reason
  - `result`: Check result

- `gemini_cli.slash_command` (Slash command)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `command`: Slash command name
  - `subcommand` (optional): Subcommand name
  - `status` (optional): Execution status (success|error)

- `gemini_cli.ide_connection` (IDE connection lifecycle)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `connection_type`: Connection phase (start|session)

- `gemini_cli.conversation_finished` (Conversation summary)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `approvalMode`: Final approval mode
  - `turnCount`: Total turns in conversation

- `gemini_cli.chat_compression` (Chat compression)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `tokens_before`: Tokens before compression
  - `tokens_after`: Tokens after compression

- `gemini_cli.malformed_json_response` (Malformed JSON)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `model`: Model returning malformed JSON

- `gemini_cli.chat.invalid_chunk` (Invalid stream chunk)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `error.message` (optional): Validation error details

- `gemini_cli.chat.content_retry` (Content retry)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `attempt_number`: Retry attempt number
  - `error_type`: Error type that triggered retry
  - `retry_delay_ms`: Delay before retry in milliseconds

- `gemini_cli.chat.content_retry_failure` (Content retries exhausted)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `total_attempts`: Total retry attempts
  - `final_error_type`: Final error type
  - `total_duration_ms` (optional): Total retry duration

- `gemini_cli.file_operation` (File create/read/update)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `event.timestamp`: ISO 8601 timestamp
  - `tool_name`: Tool performing the operation
  - `operation`: Operation type (create|read|update)
  - `lines` (optional): Lines affected
  - `mimetype` (optional): File MIME type
  - `extension` (optional): File extension
  - `programming_language` (optional): Detected programming language

- `kitty_sequence_overflow` (Terminal kitty sequence overflow)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `sequence_length`: Buffer length in bytes
  - `truncated_sequence`: Truncated sequence sample

- `tool_output_truncated` (Tool output truncation)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `tool_name`: Tool that produced the output
  - `original_content_length`: Original size (chars)
  - `truncated_content_length`: Truncated size (chars)
  - `threshold`: Truncation threshold (chars)
  - `lines`: Truncation line count
  - `prompt_id`: Originating prompt id

- `loop_detected` (Loop detection)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `loop_type`: Detected loop type
  - `prompt_id`: Originating prompt id

- `extension_install` (Extension install lifecycle)
  - `session.id`: Unique session identifier
  - `event.name`: Constant event identifier
  - `extension_name`: Extension name
  - `extension_version`: Extension version
  - `extension_source`: Source (npm, path, etc.)
  - `status`: Outcome (success|error)

### Metrics (OTel metrics)

- `gemini_cli.session.count` (Counter)
  - `session.id`: Unique session identifier (increments once per session)

- `gemini_cli.tool.call.count` (Counter)
  - `session.id`: Unique session identifier
  - `function_name`: Tool/function name
  - `success`: Whether the call succeeded
  - `decision` (optional): Decision taken (accept|reject|modify|auto_accept)
  - `tool_type`: Tool type (native|mcp)

- `gemini_cli.tool.call.latency` (Histogram)
  - `session.id`: Unique session identifier
  - `function_name`: Tool/function name

- `gemini_cli.api.request.count` (Counter)
  - `session.id`: Unique session identifier
  - `model`: Target model id
  - `status_code`: Status classification (ok|error|<code>)

- `gemini_cli.api.request.latency` (Histogram)
  - `session.id`: Unique session identifier
  - `model`: Target model id

- `gemini_cli.token.usage` (Counter)
  - `session.id`: Unique session identifier
  - `model`: Target model id
  - `type`: Token category (input|output|thought|cache|tool)

- `gemini_cli.file.operation.count` (Counter)
  - `session.id`: Unique session identifier
  - `operation`: Operation type (create|read|update)
  - `lines` (optional): Lines affected
  - `mimetype` (optional): File MIME type
  - `extension` (optional): File extension
  - `programming_language` (optional): Detected programming language

- `gemini_cli.chat.invalid_chunk.count` (Counter)
  - `session.id`: Unique session identifier

- `gemini_cli.chat.content_retry.count` (Counter)
  - `session.id`: Unique session identifier

- `gemini_cli.chat.content_retry_failure.count` (Counter)
  - `session.id`: Unique session identifier

- `gemini_cli.chat_compression` (Counter)
  - `session.id`: Unique session identifier
  - `tokens_before`: Tokens before compression
  - `tokens_after`: Tokens after compression

### Traces (exceptions only for forcedotcom)

- Exception events extracted from finished spans (`event.name == 'exception'`)
  - Extracted attributes:
    - `exception.type`: Exception type/class name
    - `exception.message`: Exception message
    - `exception.stacktrace`: Raw stack trace
  - Enriched properties:
    - `trace_id`: OTel trace id
    - `span_id`: OTel span id
    - `error_type`: Normalized error type
    - `service_name`: Service identifier
  - Export policy:
    - Local target: spans/logs/metrics per `sdk.ts` exporter selection
    - Forcedotcom target: only exceptions are forwarded via `sendTelemetryException`; general spans are dropped

### UI-only aggregation (not exported externally)

- `uiTelemetryService` maintains session aggregates for model API stats, token usage, tool call counts/latency/decisions, and file diff stats; these power in-app UI and are not exported.
