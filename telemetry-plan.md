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
  - Initializes a singleton `TelemetryReporter` (init/start/stop), based on config.
  - Exposes minimal OTel bridge exporters: ONLY metrics and an exception-only trace exporter.
    - Metrics → `sendTelemetryMetric`
    - Exceptions (extracted from span events) → `sendTelemetryException`
    - Do NOT export general traces or logs for this target.
  - Provides a small contract back to `sdk.ts`:
    - `setupForcedotcomTelemetry(config) => { exceptionTraceExporter, metricExporter, stop }`
    - `stop` flushes and disposes the reporter.
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
  - Include limited context (trace_id, span_id, service/resource attrs) and basic redaction.
- Do NOT send general span events or spans as telemetry; this exporter is exception-only.

### Metrics (phase 1)

- Map counters/sums and gauges to `sendTelemetryMetric(name, value, properties)`.
- Defer histograms/summaries or export key percentiles as derived metrics (TBD).
- No log exporter for this target.

## Configuration model

- Single gate: `telemetry.enabled` (from CLI flag / settings) decides whether we initialize the forcedotcom provider at all.
- New target value: `telemetry.target = "forcedotcom"`.
- Provider-specific options (reduced):
  - `telemetry.forcedotcom.appInsightsKey` (AppInsights instrumentation key)
  - `telemetry.forcedotcom.o11yUploadEndpoint` (endpoint URL for O11y uploads)
  - `telemetry.forcedotcom.o11yHeaders` (optional auth / tenant headers map)
- We ALWAYS attempt to enable both AppInsights and O11y.
  - Missing key → warn, continue with O11y only.
  - Missing endpoint → warn, continue with AppInsights only.
  - Missing both → skip initialization (no-op exporters) with a single error log.
- No secondary gating: we intentionally bypass internal `TelemetryReporter.isSfdxTelemetryEnabled()` logic.
  - Achieved by subclassing `TelemetryReporter` and overriding `isSfdxTelemetryEnabled()` to always return true:
    ```ts
    class ForcedotcomBypassReporter extends TelemetryReporter {
      // Always enabled; external gate is our CLI flag.
      public isSfdxTelemetryEnabled(): boolean {
        return true;
      }
    }
    ```
- Environment variables still acceptable for secrets; config remains source of truth for deterministic behavior.

Notes:

- Both channels (AppInsights + O11y) are attempted on day one; no per-channel enable flags.

## Integration points

- New provider module: `packages/core/src/telemetry/providers/forcedotcom.ts`
  - Owns reporter lifecycle and OTel-to-reporter mapping.
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
  - Call `reporter.stop()` (which flushes and disposes) and await completion.
  - Ensure OTel SDK shutdown still occurs to flush processors.

## Risks and mitigations

- Attribute volume/PII: start with conservative attribute sets and add a redaction helper for known sensitive keys.
- Metrics parity: begin with gauges/sums; schedule histogram handling later if required.
- Bypassed internal gating: documented via subclass; external control is simpler (single flag). Add a code comment explaining rationale.

## Open questions

- Any additional redaction rules needed beyond initial allowlist?
- Do we need runtime metrics about dropped exceptions/metrics?
- Required PII scrubbing policies beyond library defaults?

## Implementation tasks

Core config & wiring

- [ ] Restrict targets to `local` and `forcedotcom` in config schema / validation.
- [ ] Add provider-specific config keys: `telemetry.forcedotcom.appInsightsKey`, `telemetry.forcedotcom.o11yUploadEndpoint`, optional `telemetry.forcedotcom.o11yHeaders`.
- [ ] Add dependency on telemetry library (`@salesforce/telemetry`).

Provider module & subclass

- [ ] Subclass `TelemetryReporter` (`ForcedotcomBypassReporter`) overriding `isSfdxTelemetryEnabled()`.
- [ ] Implement provider module `providers/forcedotcom.ts` exporting `setupForcedotcomTelemetry(config)` and `stop()`.
- [ ] In setup: initialize reporter (attempt both channels), warn if one missing, error+no-op if both missing.

Exporters (limited scope)

- [ ] Exception-only trace exporter (span event scan → sendTelemetryException).
- [ ] Metric exporter (counters/gauges → sendTelemetryMetric).
- [ ] Leave histogram handling as TODO comment.

Redaction & safety

- [ ] Lightweight redaction helper (deny list + path/home stripping).
- [ ] Ensure exception stack sanitization; augment if needed.

SDK integration

- [ ] Modify `sdk.ts` to branch on `forcedotcom` target, register exporters, keep stop handle.
- [ ] Ensure shutdown path invokes provider stop before OTel shutdown.

Nice-to-have (post-MVP)

- [ ] Histogram summarization strategy.
- [ ] Internal perf counters for exporter latency.
- [ ] Configurable redaction allow/deny extension.

Completion criteria

- Forcedotcom target → only metrics + exceptions emitted.
- Local target unchanged.
- New tests pass; existing telemetry tests untouched.
- Docs updated with config and disable instructions.

## Timeline (suggested)

PR1: Config schema, dependency, subclass, provider skeleton, sdk branching
PR2: Exception-only exporter + tests
PR3: Metric exporter + redaction helper + tests
PR4: Validation, docs, edge-case handling (missing configs), cleanup of gcp references
PR5 (optional): Nice-to-haves (histograms, perf counters, extended redaction)

---

References:

- Library: https://github.com/forcedotcom/telemetry (see `src/telemetryReporter.ts`)
- Current SDK: `packages/core/src/telemetry/sdk.ts`
- UI metrics (unchanged): `packages/core/src/telemetry/uiTelemetry.ts`
