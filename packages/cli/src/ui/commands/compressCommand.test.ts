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

import {
  CompressionStatus,
  type ChatCompressionInfo,
  type GeminiClient,
} from '@salesforce/codey-core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { compressCommand } from './compressCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

describe('compressCommand', () => {
  let context: ReturnType<typeof createMockCommandContext>;
  let mockTryCompressChat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTryCompressChat = vi.fn();
    context = createMockCommandContext({
      services: {
        config: {
          getGeminiClient: () =>
            ({
              tryCompressChat: mockTryCompressChat,
            }) as unknown as GeminiClient,
        },
      },
    });
  });

  it('should do nothing if a compression is already pending', async () => {
    context.ui.pendingItem = {
      type: MessageType.COMPRESSION,
      compression: {
        isPending: true,
        originalTokenCount: null,
        newTokenCount: null,
        compressionStatus: null,
      },
    };
    await compressCommand.action!(context, '');
    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ERROR,
        text: 'Already compressing, wait for previous request to complete',
      }),
      expect.any(Number),
    );
    expect(context.ui.setPendingItem).not.toHaveBeenCalled();
    expect(mockTryCompressChat).not.toHaveBeenCalled();
  });

  it('should set pending item, call tryCompressChat, and add result on success', async () => {
    const compressedResult: ChatCompressionInfo = {
      originalTokenCount: 200,
      compressionStatus: CompressionStatus.COMPRESSED,
      newTokenCount: 100,
    };
    mockTryCompressChat.mockResolvedValue(compressedResult);

    await compressCommand.action!(context, '');

    expect(context.ui.setPendingItem).toHaveBeenNthCalledWith(1, {
      type: MessageType.COMPRESSION,
      compression: {
        isPending: true,
        compressionStatus: null,
        originalTokenCount: null,
        newTokenCount: null,
      },
    });

    expect(mockTryCompressChat).toHaveBeenCalledWith(
      expect.stringMatching(/^compress-\d+$/),
      true,
    );

    expect(context.ui.addItem).toHaveBeenCalledWith(
      {
        type: MessageType.COMPRESSION,
        compression: {
          isPending: false,
          compressionStatus: CompressionStatus.COMPRESSED,
          originalTokenCount: 200,
          newTokenCount: 100,
        },
      },
      expect.any(Number),
    );

    expect(context.ui.setPendingItem).toHaveBeenNthCalledWith(2, null);
  });

  it('should add an error message if tryCompressChat returns falsy', async () => {
    mockTryCompressChat.mockResolvedValue(null);

    await compressCommand.action!(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ERROR,
        text: 'Failed to compress chat history.',
      }),
      expect.any(Number),
    );
    expect(context.ui.setPendingItem).toHaveBeenCalledWith(null);
  });

  it('should add an error message if tryCompressChat throws', async () => {
    const error = new Error('Compression failed');
    mockTryCompressChat.mockRejectedValue(error);

    await compressCommand.action!(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ERROR,
        text: `Failed to compress chat history: ${error.message}`,
      }),
      expect.any(Number),
    );
    expect(context.ui.setPendingItem).toHaveBeenCalledWith(null);
  });

  it('should clear the pending item in a finally block', async () => {
    mockTryCompressChat.mockRejectedValue(new Error('some error'));
    await compressCommand.action!(context, '');
    expect(context.ui.setPendingItem).toHaveBeenCalledWith(null);
  });
});
