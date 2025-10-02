# Logging

Vibe Codey CLI writes structured logs to a file so they don’t interfere with the interactive terminal UI. Logs can help diagnose issues with model requests, streaming, tool calls, and other system events.

## Where logs are written

By default, logs are written to your user directory under:

- `~/.codey/tmp/codey.log.*` — Rotated JSON logs (default behavior)

Log files are automatically rotated when they reach a certain size, and several historical files are kept to avoid unlimited growth.

## Enable more verbose logging

You can control the verbosity using the `CODEY_LOG_LEVEL` environment variable:

```bash
# Show general informational messages (default)
CODEY_LOG_LEVEL=info codey

# Show detailed debugging output
CODEY_LOG_LEVEL=debug codey

# Only show warnings and errors
CODEY_LOG_LEVEL=warn codey

# Only show errors
CODEY_LOG_LEVEL=error codey
```

To disable logging entirely:

```bash
CODEY_LOG_LEVEL=silent codey
```

## Viewing logs

Use `tail -f` to follow the latest log file while running the CLI:

```bash
# Follow rotated JSON logs (production/default)
 tail -f ~/.codey/tmp/codey.log.*
```

## Custom log location

You can override the default log file path with `CODEY_LOG_FILE`:

```bash
CODEY_LOG_FILE=/tmp/my-codey.log CODEY_LOG_LEVEL=debug codey
```

Note that when using the default rotated logs, multiple files may be created (e.g., `my-codey.log.1`, `my-codey.log.2`, etc.).

## Notes

- Logs are designed to be non-blocking and written on a separate stream to avoid impacting CLI responsiveness.
- Avoid sharing logs publicly if they may contain sensitive project information.
