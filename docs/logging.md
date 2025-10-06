# Logging

Agentforce Vibes CLI writes structured logs to a file so they don’t interfere with the interactive terminal UI. Logs can help diagnose issues with model requests, streaming, tool calls, and other system events.

## Where logs are written

By default, logs are written to your user directory under:

- `~/.sfcode/tmp/sfcode.log.*` — Rotated JSON logs (default behavior)

Log files are automatically rotated when they reach a certain size, and several historical files are kept to avoid unlimited growth.

## Enable more verbose logging

You can control the verbosity using the `SFCODE_LOG_LEVEL` environment variable:

```bash
# Show general informational messages (default)
SFCODE_LOG_LEVEL=info sfcode

# Show detailed debugging output
SFCODE_LOG_LEVEL=debug sfcode

# Only show warnings and errors
SFCODE_LOG_LEVEL=warn sfcode

# Only show errors
SFCODE_LOG_LEVEL=error sfcode
```

To disable logging entirely:

```bash
SFCODE_LOG_LEVEL=silent sfcode
```

## Viewing logs

Use `tail -f` to follow the latest log file while running the CLI:

```bash
# Follow rotated JSON logs (production/default)
 tail -f ~/.sfcode/tmp/sfcode.log.*
```

## Custom log location

You can override the default log file path with `SFCODE_LOG_FILE`:

```bash
SFCODE_LOG_FILE=/tmp/my-sfcode.log SFCODE_LOG_LEVEL=debug sfcode
```

Note that when using the default rotated logs, multiple files may be created (e.g., `my-sfcode.log.1`, `my-sfcode.log.2`, etc.).

## Notes

- Logs are designed to be non-blocking and written on a separate stream to avoid impacting CLI responsiveness.
- Avoid sharing logs publicly if they may contain sensitive project information.
