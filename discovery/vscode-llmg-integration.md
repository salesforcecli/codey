# Salesforce LLM Gateway Integration Analysis in @salesforcedx-vscode-einstein-gpt

This document outlines the architecture and integration patterns used by the `@salesforcedx-vscode-einstein-gpt` Visual Studio Code extension to communicate with the Salesforce LLM Gateway API.

## High-Level Architecture

The extension is designed as a companion to the core Salesforce VS Code extensions. It does not handle authentication or org management itself. Instead, it relies on the existing infrastructure provided by the Salesforce extensions, primarily through a facade class called `CoreExtensionService`.

The core logic for interacting with the LLM Gateway is encapsulated in two client classes:

- **`ModelApiClient`**: The primary, model-agnostic client that features use to make requests. It supports a fallback mechanism to a different model if it encounters a rate-limiting error.
- **`SfApiClient`**: A direct client for the Salesforce LLM Gateway API. It's used as the fallback by `ModelApiClient` and handles all the specifics of the Salesforce API, including endpoints, headers, and request/response formats.

## Model Configuration

A key aspect of the extension's architecture is its model-agnostic design, which is achieved through a flexible model configuration system. This system allows the extension to support various Large Language Models (LLMs) without being tightly coupled to any single implementation.

At the core of this system is the `ModelConfiguration` object. Each LLM supported by the extension is defined by a `ModelConfiguration`, which contains:

- **Model Properties**: Metadata about the model, such as its display ID, whether it supports streaming, token limits, and the API endpoint URL.
- **`ModelHandler`**: A handler object that implements the `ModelHandler` interface. This is the most critical part of the configuration, as it abstracts all model-specific logic.

The `ModelHandler` interface defines a contract for how the extension interacts with a model, including methods for:

- **`convertToMessageBody`**: Transforms a generic request from the extension into the specific format required by the model's API.
- **`handleGenerationResponse`**: Processes a complete, non-streaming response from the model.
- **`handleStreamingResponse`**: Processes a streaming response, typically by converting the raw stream into an async iterator that the rest of the extension can consume.

At startup, the extension registers several `ModelConfiguration` objects for different models (e.g., `GPT4o`, `SFModel`, `Claude37Sonnet`). This decoupled approach means that adding support for a new LLM is as simple as creating a new `ModelConfiguration` and a corresponding class that implements the `ModelHandler` interface.

## How the Org for JWT Authentication is Found

The extension discovers the default org for JWT authentication by:

1.  Calling `CoreExtensionService.getWorkspaceOrgId()` and `CoreExtensionService.getWorkspaceUsername()` inside the `DefaultOrg.initialize()` method.
2.  `CoreExtensionService` then interacts with the core Salesforce VS Code extensions to get the currently configured default org. It calls `workspaceContext.getConnection()` to get a connection object.
3.  The connection object, which is already authenticated, contains the org ID and username.

This approach ensures that the extension seamlessly uses the same org that the developer has configured for all other Salesforce development activities in VS Code.

## How JWT Auth Works

JWT-based authentication is handled by the `DefaultOrg` class:

1.  When a JWT is needed, `DefaultOrg.getJwtToken()` is called.
2.  This method checks for a cached, unexpired token. If one is not available, it calls `getNearCoreJwt()`.
3.  `getNearCoreJwt()` gets an authenticated connection object from `CoreExtensionService`.
4.  It then makes a `POST` request to the `/ide/auth` endpoint on the org's instance URL using the authenticated connection.
5.  The response contains the JWT. The `JSONWebToken` class is used to decode the token, access its claims (like the expiration time and tenant ID), and determine if it has expired. A 30-second buffer is subtracted from the expiration time to prevent in-flight requests from failing.

## How the `@salesforce/core` Library is Used

The `@salesforcedx-vscode-einstein-gpt` extension does **not** directly use the `@salesforce/core` library. Instead, it interacts with the core Salesforce VS Code extensions through the `CoreExtensionService`. This service acts as an abstraction layer, retrieving an already-configured `WorkspaceContext` instance from the core extensions. This `WorkspaceContext` is where `@salesforce/core` is actually used to manage connections and authentication.

This indirect usage is a key architectural decision. It allows the Einstein GPT extension to remain loosely coupled to the core extension's implementation details, making it more resilient to changes in the underlying authentication and org management logic.

## APIs and Endpoints

The extension communicates with the following endpoints on the Salesforce API, with the base URL changing depending on the environment.

### Environment Detection

The environment is determined by reading the `salesforcedx-vscode-einstein-gpt.salesforce.api.environment` setting in the user's VS Code `settings.json` file. The `Settings` class retrieves this value, and if it's not present, it defaults to the production environment.

### Base URLs

- **Production**: `https://api.salesforce.com`
- **Development**: `https://dev.api.salesforce.com`
- **Test**: `https://test.api.salesforce.com`
- **Perf**: `https://perf.api.salesforce.com`
- **Stage**: `https://stage.api.salesforce.com`

### Endpoints

The available endpoints, which are appended to the base URL, are:

- **`/einstein/gpt/code/v1.1/generations`**: For non-streaming LLM requests.
- **`/einstein/gpt/code/v1.1/generations/stream`**: For streaming LLM requests.
- **`/einstein/gpt/code/v1.1/feedback`**: To send user feedback.
- **`/einstein/gpt/code/v1.1/embeddings`**: To retrieve text embeddings.

All requests include the JWT in the `Authorization` header and a set of custom headers for tracing and context, such as `x-client-trace-id`, `x-sfdc-core-tenant-id`, and `x-command-source`.

## Request and Response Handling

The extension's architecture for handling requests and responses is designed to be both flexible and model-agnostic. It uses a combination of data structures, handlers, and formatters to abstract the details of communicating with different LLMs.

### Request Body Construction

The process of constructing a request body is managed by the `ModelApiClient` and its associated handlers.

1.  **`ModelApiClient` Initiates the Request**: When a feature, like chat or inline completions, needs to make a request to an LLM, it calls the `generate` method on the `ModelApiClient`.
2.  **`ModelConfiguration` and `ModelHandler`**: The `ModelApiClient` is provided with an array of `ModelConfiguration` objects. Each of these objects represents a different LLM and contains properties like the model ID, supported features, and, most importantly, a `modelHandler`.
3.  **`convertToMessageBody`**: The `modelHandler` for the selected model has a `convertToMessageBody` method. This method is responsible for transforming the generic `ModelRequest` object into the specific format that the target LLM's API expects. For example, the `GPTHandler` uses the `formatModelRequestBody` utility to create a request body that is compliant with the OpenAI API.
4.  **Customization**: This architecture allows developers to easily add support for new LLMs by creating a new `ModelConfiguration` and a corresponding `ModelHandler` that can correctly format the requests for that model.

### Response Body Unpacking

The response handling is also managed by the `ModelHandler`, which provides methods for processing both streaming and non-streaming responses.

1.  **`handleStreamingResponse`**: For streaming responses, the `ModelApiClient` calls the `handleStreamingResponse` method on the active `modelHandler`. This method receives the raw response stream from the API. In the `GPTHandler`, for example, it uses the `convertStreamToModelStreamingResponse` utility to transform the stream of events from the OpenAI API into a `ModelStreamingResponse`. This involves parsing each chunk of data as it arrives and converting it into a standardized format that the rest of the extension can use.
2.  **`handleGenerationResponse`**: For non-streaming (or "blocking") responses, the `handleGenerationResponse` method is used. This method takes the complete response from the API and is responsible for parsing it and returning a `ModelGenerationResponse`.
3.  **Async Iterators**: For streaming, the extension makes use of async iterators. This allows the UI to consume the response as it arrives, creating a real-time experience for the user. The `ModelStreamingResponse` contains an `AsyncIterable<StreamingChunk>` that the UI can loop over to get the latest updates.

This decoupled and model-agnostic approach to request and response handling is a key architectural feature of the extension. It makes the system more maintainable, extensible, and adaptable to the rapidly changing landscape of LLM APIs.

## Data Model: Types and Interfaces

The extension defines a set of types and interfaces to ensure type safety and to create a clear, consistent data model for requests and responses.

### Generic Model Types

These types are defined in `src/types/modelApiClient/` and are used to create a generic interface for interacting with different LLMs.

**`ModelRequest`**: The primary request object used by the `ModelApiClient`.

```typescript
export type ModelRequest = {
  promptId: string;
  commandSource: CommandSource;
  messages: ModelMessage[];
  maxTokens: number;
  stream: boolean;
  parameters?: Record<string, unknown>;
  taskId?: string;
  tools?: ToolDefinitionLLMG[];
  toolConfig?: ToolConfig;
};
```

**`ModelMessage`**: Represents a single message in a conversation.

```typescript
export type ModelMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_invocations?: ToolInvocation[];
};
```

**`RequestBodyModelApi`**: The interface for the body of a request to the model API.

```typescript
export interface RequestBodyModelApi {
  messages: ModelMessage[];
  model: sfV1Models;
  generation_settings: GenerationSettings;
  tools?: ToolDefinitionLLMG[];
  tool_config?: ToolConfig;
  system_prompt_strategy?: string;
}
```

**`ModelGenerationResponse`**: The response from a non-streaming generation request.

```typescript
export type ModelGenerationResponse = ModelResponse & {
  generatedText: string;
};
```

**`ModelStreamingResponse`**: The response from a streaming generation request.

```typescript
export type ModelStreamingResponse = ModelResponse & {
  chunks: AsyncIterable<StreamingChunk>;
};
```

**`StreamingChunk`**: A single chunk of data in a streaming response.

```typescript
export type StreamingChunk = {
  generatedText: string;
  done: boolean;
  error?: Error;
  toolInvocations?: ToolInvocation[];
};
```

### Salesforce API Types

These types are specific to the Salesforce LLM Gateway API and are defined in `src/types/SfApi/`.

**`CoreJWTResponse`**: The response from the `/ide/auth` endpoint.

```typescript
export interface CoreJWTResponse {
  jwt: string;
}
```

**`SFApiGenerationResponse`**: The response from the `/generations` endpoint.

```typescript
export interface SFApiGenerationResponse {
  id: string;
  generations: [AiCompletion];
}
```

**`SFApiFeedbackResponse`**: The response from the `/feedback` endpoint.

```typescript
export interface SFApiFeedbackResponse {
  message: string;
}
```

### Supporting Types

These are the definitions for the nested types used in the request and response objects.

**`CommandSource`**: An enum that identifies the source of a command.

```typescript
export enum CommandSource {
  NLtoCodeGen = 'NLtoCodeGen',
  TestGen = 'TestGen',
  InlineAutocomplete = 'InlineAutocomplete',
  Chat = 'Chat',
  Optimize = 'Optimize',
  AgenticChat = 'AgenticChat',
}
```

**`ToolDefinitionLLMG`**: The definition of a tool that can be called by the LLM.

```typescript
export type ToolDefinitionLLMG = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties?: Record<string, LlmgPropertyDefinition>;
      required?: string[];
    };
    strict?: boolean;
  };
};
```

**`ToolInvocation`**: Represents a request from the LLM to invoke a tool.

```typescript
export interface ToolInvocation {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}
```

**`AiCompletion`**: Represents a single completion from the LLM.

```typescript
export type AiCompletion =
  | {
      completion: string;
    }
  | {
      id: string;
      text: string;
    };
```
