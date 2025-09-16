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

import { z } from 'zod';

/**
 * A file that is open in the IDE.
 */
export const FileSchema = z.object({
  /**
   * The absolute path to the file.
   */
  path: z.string(),
  /**
   * The unix timestamp of when the file was last focused.
   */
  timestamp: z.number(),
  /**
   * Whether the file is the currently active file. Only one file can be active at a time.
   */
  isActive: z.boolean().optional(),
  /**
   * The text that is currently selected in the active file.
   */
  selectedText: z.string().optional(),
  /**
   * The cursor position in the active file.
   */
  cursor: z
    .object({
      /**
       * The 1-based line number.
       */
      line: z.number(),
      /**
       * The 1-based character offset.
       */
      character: z.number(),
    })
    .optional(),
});
export type File = z.infer<typeof FileSchema>;

/**
 * The context of the IDE.
 */
export const IdeContextSchema = z.object({
  workspaceState: z
    .object({
      /**
       * The list of files that are currently open.
       */
      openFiles: z.array(FileSchema).optional(),
      /**
       * Whether the workspace is trusted.
       */
      isTrusted: z.boolean().optional(),
    })
    .optional(),
});
export type IdeContext = z.infer<typeof IdeContextSchema>;

/**
 * A notification that the IDE context has been updated.
 */
export const IdeContextNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('ide/contextUpdate'),
  params: IdeContextSchema,
});

/**
 * A notification that a diff has been accepted in the IDE.
 */
export const IdeDiffAcceptedNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('ide/diffAccepted'),
  params: z.object({
    /**
     * The absolute path to the file that was diffed.
     */
    filePath: z.string(),
    /**
     * The full content of the file after the diff was accepted, which includes any manual edits the user may have made.
     */
    content: z.string(),
  }),
});

/**
 * A notification that a diff has been rejected in the IDE.
 */
export const IdeDiffRejectedNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('ide/diffRejected'),
  params: z.object({
    /**
     * The absolute path to the file that was diffed.
     */
    filePath: z.string(),
  }),
});

/**
 * This is defineded for backwards compatability only. Newer extension versions
 * will only send IdeDiffRejectedNotificationSchema.
 *
 * A notification that a diff has been closed in the IDE.
 */
export const IdeDiffClosedNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('ide/diffClosed'),
  params: z.object({
    filePath: z.string(),
    content: z.string().optional(),
  }),
});

/**
 * The request to open a diff view in the IDE.
 */
export const OpenDiffRequestSchema = z.object({
  /**
   * The absolute path to the file to be diffed.
   */
  filePath: z.string(),
  /**
   * The proposed new content for the file.
   */
  newContent: z.string(),
});

/**
 * The request to close a diff view in the IDE.
 */
export const CloseDiffRequestSchema = z.object({
  /**
   * The absolute path to the file to be diffed.
   */
  filePath: z.string(),
  /**
   * @deprecated
   */
  suppressNotification: z.boolean().optional(),
});
