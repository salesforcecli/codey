# Vibe Codey CLI

Within Vibe Codey CLI, `packages/cli` is the frontend for users to send and receive prompts with the Salesforce LLM Gateway and its associated tools. For a general overview of Vibe Codey CLI, see the [main documentation page](../index.md).

## Navigating this section

- **[Commands](./commands.md):** A reference for Vibe Codey CLI commands (e.g., `/help`, `/tools`, `/theme`).
- **[Configuration](./configuration.md):** A guide to tailoring Vibe Codey CLI behavior using configuration files.
- **[Enterprise](./enterprise.md):** A guide to enterprise configuration.
- **[Headless Mode](../headless.md):** A comprehensive guide to using Vibe Codey CLI programmatically for scripting and automation.
- **[Themes](./themes.md)**: A guide to customizing the CLI's appearance with different themes.
- **[Tutorials](tutorials.md)**: A tutorial showing how to use Vibe Codey CLI to automate a development task.

## Non-interactive mode

Vibe Codey CLI can be run in a non-interactive mode, which is useful for scripting and automation. In this mode, you pipe input to the CLI, it executes the command, and then it exits.

The following example pipes a command to Vibe Codey CLI from your terminal:

```bash
echo "What is fine tuning?" | codey
```

You can also use the `--prompt` or `-p` flag:

```bash
codey -p "What is fine tuning?"
```

For comprehensive documentation on headless usage, scripting, automation, and advanced examples, see the **[Headless Mode](../headless.md)** guide.
