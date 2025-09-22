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
 * Types of user activities that can be tracked
 */
export enum ActivityType {
  USER_INPUT_START = 'user_input_start',
  USER_INPUT_END = 'user_input_end',
  MESSAGE_ADDED = 'message_added',
  TOOL_CALL_SCHEDULED = 'tool_call_scheduled',
  TOOL_CALL_COMPLETED = 'tool_call_completed',
  STREAM_START = 'stream_start',
  STREAM_END = 'stream_end',
  HISTORY_UPDATED = 'history_updated',
  MANUAL_TRIGGER = 'manual_trigger',
}
