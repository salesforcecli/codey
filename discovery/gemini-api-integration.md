# Gemini API Integration in @gemini-cli

This document outlines how the `@gemini-cli/` package integrates with the Gemini LLM API and provides a guide for replacing it with an alternative LLM provider.

## Project Structure

The project is structured into two main packages:

-   `packages/cli`: Handles the user interface and command-line aspects of the tool.
-   `packages/core`: Contains the core logic for interacting with the Gemini API.

The separation of concerns makes it easier to modify the LLM provider without affecting the user-facing parts of the application.

## Core Integration Points

The integration with the Gemini LLM is primarily handled through the `ContentGenerator` interface and the `createContentGenerator` factory function.

### `ContentGenerator` Interface

The `ContentGenerator` interface, defined in `packages/core/src/core/contentGenerator.ts`, is the central abstraction for all LLM interactions. It defines the following methods:

-   `generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse>`
-   `generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>>`
-   `countTokens(request: CountTokensParameters): Promise<CountTokensResponse>`
-   `embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>`

To replace Gemini with a new LLM provider, you must create a new class that implements this interface.

### `createContentGenerator` Factory

The `createContentGenerator` function, located in `packages/core/src/core/contentGenerator.ts`, is a factory that returns an instance of a `ContentGenerator` based on the provided `AuthType`.

### `AuthType` Enum

The `AuthType` enum, also in `packages/core/src/core/contentGenerator.ts`, determines which `ContentGenerator` implementation is used. The existing `AuthType` values are:

-   `LOGIN_WITH_GOOGLE`: Uses the `CodeAssistServer` for Google-internal users.
-   `USE_GEMINI`: Uses the `@google/genai` SDK directly with a Gemini API key.
-   `USE_VERTEX_AI`: Uses the `@google/genai` SDK with Vertex AI.
-   `CLOUD_SHELL`: Also uses the `CodeAssistServer`.

## How to Replace the LLM Provider

To replace the Gemini LLM with a different provider, follow these steps:

1.  **Implement the `ContentGenerator` Interface**:
    Create a new class that implements the `ContentGenerator` interface. This class will be responsible for:
    -   Connecting to the new LLM's API.
    -   Converting the `@google/genai` request objects (`GenerateContentParameters`, `CountTokensParameters`, `EmbedContentParameters`) into the format expected by the new LLM.
    -   Converting the new LLM's responses back into the format expected by the `@gemini-cli/` application (`GenerateContentResponse`, `CountTokensResponse`, `EmbedContentResponse`).

2.  **Add a New `AuthType`**:
    Add a new value to the `AuthType` enum in `packages/core/src/core/contentGenerator.ts` to represent the new LLM provider. For example:

    ```typescript
    export enum AuthType {
      // ... existing auth types
      USE_NEW_LLM = 'new-llm-api-key',
    }
    ```

3.  **Update the `createContentGenerator` Factory**:
    Modify the `createContentGenerator` function in `packages/core/src/core/contentGenerator.ts` to instantiate your new `ContentGenerator` class when the new `AuthType` is used.

    ```typescript
    import { NewLlmContentGenerator } from './path/to/your/new/generator';

    export async function createContentGenerator(
      config: ContentGeneratorConfig,
      // ... other params
    ): Promise<ContentGenerator> {
      // ... existing logic

      if (config.authType === AuthType.USE_NEW_LLM) {
        return new NewLlmContentGenerator(config);
      }

      throw new Error(
        `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
      );
    }
    ```

4.  **Configuration**:
    You will likely need to add new configuration options to `packages/cli/src/config/config.ts` to handle API keys and other settings for the new LLM. These settings would be used when creating your new `ContentGenerator`.

By following these steps, you can replace the Gemini LLM with any other provider while minimizing changes to the existing codebase.

