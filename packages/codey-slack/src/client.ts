/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      authorization: `Bearer ${this.token}`,
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
    workspaceRoot: string,
    message: string,
  ): Promise<{ sessionId: string; response: string; timestamp: string }> {
    const url = `${this.baseUrl}/api/sessions/${encodeURIComponent(
      sessionId,
    )}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ workspaceRoot, message }),
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
    workspaceRoot: string,
    message: string,
  ): AsyncGenerator<unknown, void, unknown> {
    const url = `${this.baseUrl}/api/sessions/${encodeURIComponent(
      sessionId,
    )}/messages/stream`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ workspaceRoot, message }),
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

  async sendThreadHistoryMessage(
    sessionId: string,
    workspaceRoot: string,
    message: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/api/sessions/${encodeURIComponent(
      sessionId,
    )}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ workspaceRoot, message }),
    });

    if (!res.ok) {
      const data = await this.safeJson(res);
      throw new ClientError(
        `Failed to send thread history message (status ${res.status})`,
        res.status,
        data,
      );
    }
    // Intentionally ignore the response - we don't want to surface it to Slack
  }

  private async safeJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
}
