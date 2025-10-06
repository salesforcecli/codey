# Troubleshooting guide

This guide provides solutions to common issues and debugging tips, including topics on:

- Authentication or login errors
- Frequently asked questions (FAQs)
- Debugging tips
- Existing GitHub Issues similar to yours or creating new Issues

For information on where logs are written and how to increase verbosity, see [Logging](./logging.md).

## Frequently asked questions (FAQs)

- **Q: How do I update Agentforce Vibes CLI to the latest version?**
  - A: If you installed it globally via `npm`, update it using the command `npm install -g @salesforce/sfcode@latest`. If you compiled it from source, pull the latest changes from the repository, and then rebuild using the command `npm run build`.

- **Q: Where are the Agentforce Vibes CLI configuration or settings files stored?**
  - A: The Agentforce Vibes CLI configuration is stored in two `settings.json` files:
    1. In your home directory: `~/.sfcode/settings.json`.
    2. In your project's root directory: `./.sfcode/settings.json`.

    Refer to [Agentforce Vibes CLI Configuration](./cli/configuration.md) for more details.

## Common error messages and solutions

- **Error: `EADDRINUSE` (Address already in use) when starting an MCP server.**
  - **Cause:** Another process is already using the port that the MCP server is trying to bind to.
  - **Solution:**
    Either stop the other process that is using the port or configure the MCP server to use a different port.

- **Error: Command not found (when attempting to run Agentforce Vibes CLI with `sfcode`).**
  - **Cause:** Agentforce Vibes CLI is not correctly installed or it is not in your system's `PATH`.
  - **Solution:**
    The update depends on how you installed Agentforce Vibes CLI:
    - If you installed `sfcode` globally, check that your `npm` global binary directory is in your `PATH`. You can update Agentforce Vibes CLI using the command `npm install -g @salesforce/sfcode@latest`.
    - If you are running `sfcode` from source, ensure you are using the correct command to invoke it (e.g., `node packages/cli/dist/index.js ...`). To update Agentforce Vibes CLI, pull the latest changes from the repository, and then rebuild using the command `npm run build`.

- **Error: `MODULE_NOT_FOUND` or import errors.**
  - **Cause:** Dependencies are not installed correctly, or the project hasn't been built.
  - **Solution:**
    1.  Run `npm install` to ensure all dependencies are present.
    2.  Run `npm run build` to compile the project.
    3.  Verify that the build completed successfully with `npm run start`.

- **Agentforce Vibes CLI is not running in interactive mode in "CI" environments**
  - **Issue:** The Agentforce Vibes CLI does not enter interactive mode (no prompt appears) if an environment variable starting with `CI_` (e.g., `CI_TOKEN`) is set. This is because the `is-in-ci` package, used by the underlying UI framework, detects these variables and assumes a non-interactive CI environment.
  - **Cause:** The `is-in-ci` package checks for the presence of `CI`, `CONTINUOUS_INTEGRATION`, or any environment variable with a `CI_` prefix. When any of these are found, it signals that the environment is non-interactive, which prevents the Agentforce Vibes CLI from starting in its interactive mode.
  - **Solution:** If the `CI_` prefixed variable is not needed for the CLI to function, you can temporarily unset it for the command. e.g., `env -u CI_TOKEN sfcode`

- **DEBUG mode not working from project .env file**
  - **Issue:** Setting `DEBUG=true` in a project's `.env` file doesn't enable debug mode for sfcode.
  - **Cause:** The `DEBUG` and `DEBUG_MODE` variables are automatically excluded from project `.env` files to prevent interference with sfcode behavior.
  - **Solution:** Use a `.sfcode/.env` file instead, or configure the `advanced.excludedEnvVars` setting in your `settings.json` to exclude fewer variables.

## Exit Codes

The Agentforce Vibes CLI uses specific exit codes to indicate the reason for termination. This is especially useful for scripting and automation.

| Exit Code | Error Type              | Description                                                                                         |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| 42        | `FatalInputError`       | Invalid or missing input was provided to the CLI. (non-interactive mode only)                       |
| 52        | `FatalConfigError`      | A configuration file (`settings.json`) is invalid or contains errors.                               |
| 53        | `FatalTurnLimitedError` | The maximum number of conversational turns for the session was reached. (non-interactive mode only) |

## Debugging Tips

- **CLI debugging:**
  - Use the `--verbose` flag (if available) with CLI commands for more detailed output.
  - Check the CLI logs. See [Logging](./logging.md) for where to find logs and how to increase verbosity.

- **Core debugging:**
  - Check the server console output for error messages or stack traces.
  - Increase log verbosity if configurable.
  - Use Node.js debugging tools (e.g., `node --inspect`) if you need to step through server-side code.

- **Tool issues:**
  - If a specific tool is failing, try to isolate the issue by running the simplest possible version of the command or operation the tool performs.
  - For `run_shell_command`, check that the command works directly in your shell first.
  - For _file system tools_, verify that paths are correct and check the permissions.

- **Pre-flight checks:**
  - Always run `npm run preflight` before committing code. This can catch many common issues related to formatting, linting, and type errors.

## Existing GitHub Issues similar to yours or creating new Issues

If you encounter an issue that was not covered here in this _Troubleshooting guide_, consider searching the Agentforce Vibes CLI [Issue tracker on GitHub](https://github.com/salesforceli/sfcode/issues). If you can't find an issue similar to yours, consider creating a new GitHub Issue with a detailed description. Pull requests are also welcome!
