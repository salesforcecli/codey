# Agentforce Vibes CLI Core

Agentforce Vibes CLI's core package (`packages/core`) is the backend portion of Agentforce Vibes CLI, handling communication with the Salesforce LLM Gateway, managing tools, and processing requests sent from `packages/cli`. For a general overview of Agentforce Vibes CLI, see the [main documentation page](../index.md).

## Navigating this section

- **[Core tools API](./tools-api.md):** Information on how tools are defined, registered, and used by the core.
- **[Memory Import Processor](./memport.md):** Documentation for the modular SFCODE.md import feature using @file.md syntax.

## Role of the core

While the `packages/cli` portion of Agentforce Vibes CLI provides the user interface, `packages/core` is responsible for:

- **Salesforce LLM Gateway interaction:** Securely communicating with the Salesforce LLM Gateway, sending user prompts, and receiving model responses.
- **Prompt engineering:** Constructing effective prompts for the Salesforce LLM Gateway, potentially incorporating conversation history, tool definitions, and instructional context from `SFCODE.md` files.
- **Tool management & orchestration:**
  - Registering available tools (e.g., file system tools, shell command execution).
  - Interpreting tool use requests from the Salesforce LLM Gateway.
  - Executing the requested tools with the provided arguments.
  - Returning tool execution results to the Salesforce LLM Gateway for further processing.
- **Session and state management:** Keeping track of the conversation state, including history and any relevant context required for coherent interactions.
- **Configuration:** Managing core-specific configurations, such as API key access, model selection, and tool settings.

## Security considerations

The core plays a vital role in security:

- **Tool execution:** When tools interact with the local system (e.g., `run_shell_command`), the core (and its underlying tool implementations) must do so with appropriate caution, often involving sandboxing mechanisms to prevent unintended modifications.

## Chat history compression

To ensure that long conversations don't exceed the token limits of the Salesforce LLM Gateway, the core includes a chat history compression feature.

When a conversation approaches the token limit for the configured model, the core automatically compresses the conversation history before sending it to the model. This compression is designed to be lossless in terms of the information conveyed, but it reduces the overall number of tokens used.

You can find the token limits for each model in the [Google AI documentation](https://ai.google.dev/gemini-api/docs/models).

## Model fallback

Agentforce Vibes CLI includes a model fallback mechanism to ensure that you can continue to use the CLI even if the default model is rate-limited.

If you are using the default model and the CLI detects that you are being rate-limited, it automatically switches to the fallback model for the current session. This allows you to continue working without interruption.

## File discovery service

The file discovery service is responsible for finding files in the project that are relevant to the current context. It is used by the `@` command and other tools that need to access files.

## Memory discovery service

The memory discovery service is responsible for finding and loading the `SFCODE.md` files that provide context to the model. It searches for these files in a hierarchical manner, starting from the current working directory and moving up to the project root and the user's home directory. It also searches in subdirectories.

This allows you to have global, project-level, and component-level context files, which are all combined to provide the model with the most relevant information.

You can use the [`/memory` command](../cli/commands.md) to `show`, `add`, and `refresh` the content of loaded `SFCODE.md` files.
