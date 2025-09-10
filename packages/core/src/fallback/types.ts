/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Defines the intent returned by the UI layer during a fallback scenario.
 */
export type FallbackIntent =
  | 'retry' // Immediately retry the current request with the fallback model.
  | 'stop' // Switch to fallback for future requests, but stop the current request.
  | 'auth'; // Stop the current request; user intends to change authentication.

/**
 * The interface for the handler provided by the UI layer (e.g., the CLI)
 * to interact with the user during a fallback scenario.
 */
export type FallbackModelHandler = (
  failedModel: string,
  fallbackModel: string,
  error?: unknown,
) => Promise<FallbackIntent | null>;
