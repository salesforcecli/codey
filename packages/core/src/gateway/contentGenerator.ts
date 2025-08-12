/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  Candidate,
  GenerateContentResponseUsageMetadata,
  ContentListUnion,
  ContentUnion,
  FinishReason,
} from '@google/genai';
import { GatewayClient, Generations } from './client.js';
import { ContentGenerator } from '../core/contentGenerator.js';
import { Claude37Sonnet } from './models.js';

export interface HttpOptions {
  headers?: Record<string, string>;
}

/**
 * ContentGenerator implementation that uses Salesforce LLM Gateway
 */
export class GatewayContentGenerator implements ContentGenerator {
  private client: GatewayClient;
  // Default to Claude37Sonnet model for now - this could be made configurable
  model = Claude37Sonnet;

  constructor(_httpOptions: HttpOptions) {
    this.client = new GatewayClient({
      model: this.model,
    });
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const gatewayRequest = this.prepareGatewayRequest(request);
    const response = await this.client.generateCompletion(gatewayRequest);

    // Convert Gateway response back to Gemini format
    return this.convertGatewayResponseToGemini(response, userPromptId);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const gatewayRequest = this.prepareGatewayRequest(request);
    const streamGenerator =
      await this.client.generateCompletionStream(gatewayRequest);

    return this.convertStreamGeneratorToGemini(streamGenerator, userPromptId);
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Gateway doesn't have a direct token counting endpoint
    // Provide an estimation based on rough character count
    const prompt = this.convertContentsToPrompt(request.contents);
    const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimation: 1 token ≈ 4 characters

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Convert content to text - handle ContentListUnion properly
    const contentArray = this.toContentsArray(request.contents);
    const text = this.convertContentToText(contentArray[0]);

    const embeddingRequest = {
      input: [text],
      model: 'text-embedding-model', // This might need to be adjusted based on available models
    };

    const response = await this.client.createEmbedding(embeddingRequest);

    // Convert to Gemini format
    return {
      embeddings: [
        {
          values:
            ((
              (response.data as Record<string, unknown>)?.embeddings as Array<
                Record<string, unknown>
              >
            )?.[0]?.values as number[]) || [],
        },
      ],
    };
  }

  /**
   * Convert Gemini Contents array to a single prompt string
   */
  private convertContentsToPrompt(contents: ContentListUnion): string {
    const contentArray = this.toContentsArray(contents);
    return contentArray
      .map((content) =>
        content.parts
          ?.map((part) => {
            if ('text' in part && part.text) {
              return part.text;
            }
            // Handle other part types if needed (images, etc.)
            return '';
          })
          .join(' '),
      )
      .join('\n');
  }

  /**
   * Convert ContentListUnion to Content array (similar to converter.ts)
   */
  private toContentsArray(contents: ContentListUnion): Content[] {
    if (Array.isArray(contents)) {
      return contents.map(this.toContent.bind(this));
    }
    return [this.toContent(contents)];
  }

  /**
   * Convert ContentUnion to Content (similar to converter.ts)
   */
  private toContent(content: ContentUnion): Content {
    if (Array.isArray(content)) {
      // it's a PartsUnion[]
      return {
        role: 'user',
        parts: content.map((part) =>
          typeof part === 'string' ? { text: part } : part,
        ),
      };
    }
    if (typeof content === 'string') {
      return {
        role: 'user',
        parts: [{ text: content }],
      };
    }
    // Check if it's a Part (has properties like text, but not role)
    if ('text' in content && !('role' in content)) {
      return {
        role: 'user',
        parts: [content],
      };
    }
    // it's already a Content object
    return content as Content;
  }

  private prepareGatewayRequest(request: GenerateContentParameters) {
    const promptContents: Content[] = [];
    if (request.config?.systemInstruction) {
      // Assuming systemInstruction is a Content object as per our usage
      promptContents.push(request.config.systemInstruction as Content);
    }
    promptContents.push(...this.toContentsArray(request.contents));

    let prompt = this.convertContentsToPrompt(promptContents);

    // When JSON output is requested, add instructions to the prompt
    if (
      request.config?.responseMimeType === 'application/json' &&
      request.config.responseSchema
    ) {
      const schema = JSON.stringify(request.config.responseSchema, null, 2);
      const jsonInstruction = `\n\nPlease respond with a valid JSON object that conforms to the following schema. Do not include any other explanatory text or markdown formatting such as \`\`\`json.\n\nSCHEMA:\n${schema}`;
      prompt += jsonInstruction;
    }

    const gatewayRequest = {
      prompt,
      model: this.model.model,
      max_tokens: request.config?.maxOutputTokens || this.model.maxOutputTokens,
      temperature: request.config?.temperature || 0.7,
      stop_sequences: request.config?.stopSequences,
    };
    return gatewayRequest;
  }

  /**
   * Convert a single Content to text string
   */
  private convertContentToText(content: Content): string {
    return (
      content.parts
        ?.map((part) => {
          if ('text' in part && part.text) {
            return part.text;
          }
          return '';
        })
        .join(' ') || ''
    );
  }

  /**
   * Convert Gateway response to Gemini GenerateContentResponse format
   */
  private convertGatewayResponseToGemini(
    gatewayResponse: Record<string, unknown>,
    _userPromptId: string,
  ): GenerateContentResponse {
    const generations =
      ((gatewayResponse.data as Record<string, unknown>)
        ?.generations as unknown[]) || [];

    const candidates: Candidate[] = generations.map((gen: unknown) => {
      const generation = gen as Record<string, unknown>;
      return {
        content: {
          parts: [{ text: (generation.text as string) || '' }] as Part[],
          role: 'model',
        },
        finishReason: 'STOP' as FinishReason, // Gateway doesn't provide finish reasons, so assume STOP
        index: 0,
        safetyRatings: [], // Gateway doesn't provide safety ratings in the same format
      };
    });

    const usageMetadata: GenerateContentResponseUsageMetadata = {
      promptTokenCount: 0, // Gateway doesn't provide token counts in response
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    };

    const response = new GenerateContentResponse();
    response.candidates = candidates;
    response.usageMetadata = usageMetadata;
    response.modelVersion = this.model.model;

    return response;
  }

  /**
   * Convert streaming Gateway generator to Gemini format
   */
  private async *convertStreamGeneratorToGemini(
    streamGenerator: AsyncGenerator<Generations>,
    _userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    for await (const data of streamGenerator) {
      const generation = data.generations[0];

      if (generation.text && generation.text.trim()) {
        // Convert each streaming chunk to Gemini format
        const candidate: Candidate = {
          content: {
            parts: [{ text: generation.text }] as Part[],
            role: 'model',
          },
          index: 0,
          safetyRatings: [],
        };

        const response = new GenerateContentResponse();
        response.candidates = [candidate];
        response.usageMetadata = {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        };
        response.modelVersion = this.model.model;

        yield response;
      }
    }
  }
}
