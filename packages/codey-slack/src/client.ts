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

export class ClientError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ClientError';
    this.status = status;
    this.body = body;
  }
}

export class Client {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  async createSession(workspaceRoot: string): Promise<{ sessionId: string }> {
    const url = `${this.baseUrl}/api/sessions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ workspaceRoot }),
    });

    const data = await this.safeJson(res);
    if (!res.ok) {
      throw new ClientError(
        `Failed to create session (status ${res.status})`,
        res.status,
        data,
      );
    }
    return data as { sessionId: string };
  }

  async sendMessage(
    sessionId: string,
    message: string,
  ): Promise<{ sessionId: string; response: string; timestamp: string }> {
    const url = `${this.baseUrl}/api/sessions/${encodeURIComponent(
      sessionId,
    )}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ message }),
    });

    const data = await this.safeJson(res);
    if (!res.ok) {
      throw new ClientError(
        `Failed to send message (status ${res.status})`,
        res.status,
        data,
      );
    }
    return data as { sessionId: string; response: string; timestamp: string };
  }

  async *sendMessageStream(
    sessionId: string,
    message: string,
  ): AsyncGenerator<unknown, void, unknown> {
    const url = `${this.baseUrl}/api/sessions/${encodeURIComponent(
      sessionId,
    )}/messages/stream`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ message }),
    });

    if (!res.ok || !res.body) {
      const data = await this.safeJson(res);
      throw new ClientError(
        `Failed to stream message (status ${res.status})`,
        res.status,
        data,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line);
        } catch {
          // ignore malformed lines in POC
        }
      }
    }
  }

  private async safeJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
}
