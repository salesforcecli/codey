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

// This is a replacement for the `is-in-ci` package that always returns false.
// We are doing this to avoid the issue where `ink` does not render the UI
// when it detects that it is running in a CI environment.
// This is safe because `ink` (and thus `is-in-ci`) is only used in the
// interactive code path of the CLI.
// See issue #1563 for more details.

const isInCi = false;

// eslint-disable-next-line import/no-default-export
export default isInCi;
