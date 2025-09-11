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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
	GenerateContentParameters,
	CountTokensParameters,
	EmbedContentParameters,
} from '@google/genai';

// Lightweight helpers
type MockClient = {
	generateChatCompletion?: (req: unknown) => Promise<unknown>;
	generateChatCompletionStream?: (req: unknown) => Promise<AsyncGenerator<unknown>>;
	createEmbedding?: (req: unknown) => Promise<unknown>;
};
const setMockClient = (
	gen: GatewayContentGenerator,
	client: MockClient,
) => {
	(gen as unknown as { client: MockClient }).client = client;
};

let mockGenerateChatCompletion: ReturnType<typeof vi.fn>;
let mockGenerateChatCompletionStream: ReturnType<typeof vi.fn>;
let mockCreateEmbedding: ReturnType<typeof vi.fn>;

// Provide a predictable model configuration
// Use the real models implementation to avoid hoist issues in other modules

// Import after mocks
import { GatewayContentGenerator } from './contentGenerator.js';

describe('GatewayContentGenerator (happy paths)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateChatCompletion = vi.fn();
		mockGenerateChatCompletionStream = vi.fn();
		mockCreateEmbedding = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('generateContent', () => {
		it('sends a properly constructed request and returns candidates with usage', async () => {
			const gen = new GatewayContentGenerator();

			// Mock gateway response
			mockGenerateChatCompletion.mockResolvedValue({
				data: {
					id: 'chat-1',
					generation_details: {
						generations: [
							{
								content: 'Pong',
								role: 'assistant',
							},
						],
						parameters: {
				  usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
						},
					},
				},
				status: 200,
				headers: {},
			});

			const request: GenerateContentParameters = {
				model: 'ignored-by-mock',
				contents: { role: 'user', parts: [{ text: 'Ping' }] },
				config: {
					systemInstruction: { role: 'system', parts: [{ text: 'Be helpful' }] },
					temperature: 0.2,
					maxOutputTokens: 256,
				},
			};

			setMockClient(gen, { generateChatCompletion: mockGenerateChatCompletion });
			const resp = await gen.generateContent(request, 'userPromptId');

			// Verify client call structure (subset)
			expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(1);
			const callArg = mockGenerateChatCompletion.mock.calls[0][0];
					expect(callArg).toEqual(
						expect.objectContaining({
							messages: [
								{ role: 'system', content: 'Be helpful' },
								{ role: 'user', content: 'Ping' },
							],
							generation_settings: expect.objectContaining({
								max_tokens: 256,
								temperature: 0.2,
							}),
						}),
					);
			expect(callArg).not.toHaveProperty('tools');

			// Verify transformed response
			expect(resp.candidates?.[0]?.content?.parts?.[0]).toEqual({ text: 'Pong' });
			expect(resp.usageMetadata).toEqual({
				promptTokenCount: 3,
				candidatesTokenCount: 5,
				totalTokenCount: 8,
			});
			expect(typeof resp.modelVersion).toBe('string');
		});

		it('includes tools and tool_config when tools provided and model supports MCP', async () => {
			const gen = new GatewayContentGenerator();
			mockGenerateChatCompletion.mockResolvedValue({
				data: {
					id: 'chat-2',
					generation_details: {
						generations: [
							{
								content: 'Tool used',
								role: 'assistant',
							},
						],
					},
				},
				status: 200,
				headers: {},
			});

			const requestWithTools: GenerateContentParameters = {
				model: 'ignored',
				contents: { role: 'user', parts: [{ text: 'Call tool' }] },
				config: {
					tools: [
						{
							functionDeclarations: [
								{
									name: 'get_weather',
									description: 'Get the weather',
									parametersJsonSchema: { type: 'object', properties: {} },
								},
							],
						},
					],
				},
			};

			setMockClient(gen, { generateChatCompletion: mockGenerateChatCompletion });
			await gen.generateContent(requestWithTools, 'id');

			const callArg = mockGenerateChatCompletion.mock.calls[0][0];
			expect(callArg).toEqual(
				expect.objectContaining({
					tools: expect.arrayContaining([
						expect.objectContaining({ type: 'function' }),
					]),
					tool_config: expect.objectContaining({ mode: 'auto', parallel_calls: true }),
				}),
			);
		});
	});

	describe('generateContentStream', () => {
		it('yields text and then a terminal chunk with usage', async () => {
			const gen = new GatewayContentGenerator();

			async function* stream() {
				yield {
					id: 's-1',
					generation_details: {
						generations: [{ content: 'Hello', role: 'assistant' }],
					},
				};
				yield {
					id: 's-1',
					generation_details: {
						generations: [
							{
								content: '',
								role: 'assistant',
								parameters: { finish_reason: 'stop' },
							},
						],
						parameters: { usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
					},
				};
			}

			mockGenerateChatCompletionStream.mockResolvedValue(stream());

			const request: GenerateContentParameters = {
				model: 'ignored',
				contents: { role: 'user', parts: [{ text: 'Hi' }] },
			};

			const responses: unknown[] = [];
			setMockClient(gen, { generateChatCompletionStream: mockGenerateChatCompletionStream });
			for await (const r of await gen.generateContentStream(request, 'id')) {
				responses.push(r);
			}

			expect(responses).toHaveLength(2);
					const first = responses[0] as {
						candidates?: Array<{
							content?: { parts?: Array<{ text?: string }> };
						}>;
					};
			const second = responses[1] as { finishReason?: unknown; usageMetadata?: { totalTokenCount?: number } } & { candidates?: unknown[] };

			expect(first.candidates?.[0]?.content?.parts?.[0]).toEqual({ text: 'Hello' });
			// second should be a terminal candidate; usage metadata should be present as a number
			expect(typeof second.usageMetadata?.totalTokenCount).toBe('number');
		});
	});

	describe('countTokens', () => {
		it('returns the last seen totalTokens from usage', async () => {
			const gen = new GatewayContentGenerator();

			mockGenerateChatCompletion.mockResolvedValue({
				data: {
					id: 'chat-ct',
					generation_details: {
						generations: [{ content: 'Ok', role: 'assistant' }],
				parameters: { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } },
					},
				},
				status: 200,
				headers: {},
			});

			setMockClient(gen, { generateChatCompletion: mockGenerateChatCompletion });
			await gen.generateContent(
				{
					model: 'ignored',
					contents: { role: 'user', parts: [{ text: 'Count?' }] },
				},
				'id',
			);

			const ctReq: CountTokensParameters = {} as CountTokensParameters;
			const tokens = await gen.countTokens(ctReq);
			expect(tokens.totalTokens).toBe(3);
		});
	});

	describe('embedContent', () => {
		it('creates embeddings from text content', async () => {
			const gen = new GatewayContentGenerator();
			mockCreateEmbedding.mockResolvedValue({
				data: { embeddings: [{ values: [0.1, 0.2, 0.3] }] },
				status: 200,
				headers: {},
			});

					const req: EmbedContentParameters = {
						model: 'ignored',
				contents: { role: 'user', parts: [{ text: 'Vectorize me' }] },
			};

			setMockClient(gen, { createEmbedding: mockCreateEmbedding });
			const res = await gen.embedContent(req);

			expect(mockCreateEmbedding).toHaveBeenCalledWith({
				input: ['Vectorize me'],
				model: 'text-embedding-model',
			});
			expect(res.embeddings[0]?.values).toEqual([0.1, 0.2, 0.3]);
		});
	});
});

