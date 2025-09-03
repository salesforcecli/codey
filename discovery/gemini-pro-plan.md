# Plan: Integrate Salesforce LLM Gateway into Gemini CLI

## 1. Objective

The goal of this project is to replace the existing Gemini API integration within the `gemini-cli` with the Salesforce LLM Gateway. This will enable the CLI to leverage models and services provided through the gateway, while maintaining the existing command structure and user experience. This plan assumes breaking changes are acceptable and that a user's authorized org username is available via a `SF_USERNAME` environment variable.

## 2. High-Level Plan

The integration will be achieved through the following major steps:

1.  **Implement JWT Authentication**: Create a dedicated service to handle authentication with a Salesforce org using `@salesforce/core` and fetch a JWT for API requests.
2.  **Replace the Content Generator**: Replace the existing `ContentGenerator` with a new class that implements the same interface but is tailored to the Salesforce LLM Gateway API.
3.  **Map Request/Response Formats**: Implement the logic to translate the CLI's internal data structures to the format required by the LLM Gateway API and vice-versa.
4.  **Update Configuration**: Modify the CLI's configuration and factory functions to remove the Gemini-specific provider options and default to the new Salesforce LLM Gateway provider.

---

## 3. Detailed Implementation Steps

### Step 1: Dependency Management

- Add the `@salesforce/core` library as a dependency to the `packages/core` workspace.

  ```bash
  npm install @salesforce/core --workspace=@gemini-cli/core
  ```

### Step 2: Authentication Service

The CLI needs to obtain a JWT to communicate with the LLM Gateway. This will be handled by a new, dedicated authentication manager.

- **Create `SalesforceAuthManager.ts`**:
  - Location: `packages/core/src/mcp/salesforceAuthManager.ts`
  - **Responsibilities**:
    1.  Read the Salesforce username from the `process.env.SF_USERNAME` environment variable.
    2.  Use the `Org.create()` method from `@salesforce/core` to establish a connection to the user's authorized org.
    3.  Obtain an authenticated `Connection` object from the `Org` instance.
    4.  Make a `POST` request to the `/ide/auth` endpoint on the org's instance URL to fetch a JWT, as described in the `vscode-llmg-integration.md` document.
    5.  Implement a mechanism to cache the JWT and its expiration time to avoid re-fetching on every request. A 30-second buffer should be used to account for in-flight requests.
    6.  Expose a method, e.g., `getJwt()`, that returns a valid token, refreshing it if it's expired or about to expire.

### Step 3: Salesforce LLM Gateway Content Generator

This class will be the core of the new integration, acting as the bridge between the CLI and the gateway API.

- **Create `SalesforceLlmGatewayContentGenerator.ts`**:
  - Location: `packages/core/src/core/salesforceLlmGatewayContentGenerator.ts`
  - The class must implement the `ContentGenerator` interface.
  - The constructor will accept an instance of the `SalesforceAuthManager`.
- **Implement Interface Methods**:
  - **`generateContentStream`**:
    - Maps to the `POST /chat/generations/stream` gateway endpoint.
    - Will be responsible for handling the Server-Sent Events (SSE) stream and converting it into an `AsyncGenerator<GenerateContentResponse>`.
  - **`generateContent`**:
    - Maps to the `POST /chat/generations` gateway endpoint for non-streaming requests.
  - **`embedContent`**:
    - Maps to the `POST /embeddings` gateway endpoint.
  - **`countTokens`**:
    - **Note**: The LLM Gateway API spec does not list a dedicated endpoint for counting tokens. The initial implementation should log a warning and return a `totalTokens` count of `0`. Further investigation will be needed to determine if client-side token counting is required.

### Step 4: API and Header Configuration

The `SalesforceLlmGatewayContentGenerator` must be configured to use the correct API endpoints and to send the required HTTP headers with each request.

- **API Base URLs**:
  - The base URL will be determined by a new `SF_API_ENV` environment variable, which can be one of `prod`, `dev`, `test`, `perf`, or `stage`.
  - The `SalesforceLlmGatewayContentGenerator` will map these values to the corresponding base URLs:
    - `prod`: `https://api.salesforce.com`
    - `dev`: `https://dev.api.salesforce.com`
    - `test`: `https://test.api.salesforce.com`
    - `perf`: `https://perf.api.salesforce.com`
    - `stage`: `https://stage.api.salesforce.com`
  - If `SF_API_ENV` is not set, it will default to `prod`.

- **Required Headers**:
  - The following headers must be included in all requests to the LLM Gateway:
    - `Authorization`: `Bearer <jwt>` (from `SalesforceAuthManager`)
    - `Content-Type`: `application/json`
    - `x-client-feature-id`: `EinsteinGptForDevelopers`
    - `x-llm-provider`: `InternalTextGeneration`
    - `x-sfdc-app-context`: `EinsteinGPT`
    - `x-sfdc-core-tenant-id`: This will be extracted from the `tid` claim of the JWT. If the claim is not present, the implementation will fall back to a `SF_LLMG_CORE_TENANT_ID` environment variable.
    - `x-salesforce-region`: This will be derived from the `SF_API_ENV` variable, following the same mapping used by the VS Code extension:
      - `prod` -> `EAST_REGION_1`
      - `stage` -> `EAST_REGION_2`
      - `dev`, `test`, `perf` -> `WEST_REGION`
    - `x-client-trace-id`: A unique identifier (e.g., a UUID) will be generated for each request.

### Step 5: Request/Response Transformation Logic

Inside `SalesforceLlmGatewayContentGenerator.ts`, create private helper methods to handle data format conversions.

- **Request Transformation**:
  - Create a function to convert the `Content[]` from `gemini-cli`'s history to the `ChatMessageRequest[]` format required by the LLM Gateway. This involves mapping roles (`model` to `assistant`) and structuring the message content correctly.
  - Map `GenerateContentParameters` (from `@google/genai`) to the LLM Gateway's `generation_settings` and other request body parameters.
  - Map the `Tool[]` definitions to the `ChatCompletionTool[]` format specified in the gateway API.
- **Response Transformation**:
  - For streaming, create a utility that parses the incoming SSE stream from the gateway. Each data chunk should be transformed into a `GenerateContentResponse` object and yielded, matching the `ContentGenerator` interface.
  - For non-streaming responses, parse the JSON response from the gateway and map its fields to the `GenerateContentResponse` structure.

### Step 5: Configuration & Integration

The final step is to wire up the new provider within the existing `gemini-cli` framework.

1.  **Replace `createContentGenerator` Factory Logic**:
    - In the `createContentGenerator` function, remove all existing logic related to `AuthType`.
    - The function should now unconditionally:
      1.  Instantiate the `SalesforceAuthManager`.
      2.  Instantiate the `SalesforceLlmGatewayContentGenerator` and pass the auth manager to it.
      3.  Return the new content generator instance.

2.  **Update CLI Configuration**:
    - Modify the configuration logic in `packages/cli/src/config/` to remove any options related to choosing an LLM provider or authentication method.
    - The CLI should now perform a check for the `SF_USERNAME` environment variable on startup and provide a clear error message if it is not set.
3.  **Cleanup**:
    - Remove the `AuthType` enum from `packages/core/src/core/contentGenerator.ts` as it is no longer needed.
    - Delete any files related to the old Gemini integration, such as `codeAssist.ts`, `google-auth-provider.ts`, and any other files that are no longer referenced.

---

## 4. Assumptions and Risks

- **Assumption**: A valid Salesforce username will be provided via the `SF_USERNAME` environment variable, and the corresponding org will have been authorized previously (e.g., via `sfdx auth:web:login`).
- **Assumption**: The `/ide/auth` endpoint is available and will function similarly for the CLI as it does for the VS Code extension.
- **Risk**: The LLM Gateway API does not provide a `/count-tokens` endpoint. If precise token counting is critical for any CLI features (like context window management), a client-side tokenizer (e.g., `tiktoken`) might be required, adding complexity.
- **Risk**: There may be subtle differences in features (e.g., tool schemas, system prompt handling) between the Gemini API and the Salesforce LLM Gateway that will require careful mapping and testing to ensure compatibility with the CLI's existing logic.
