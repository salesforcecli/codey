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

import type { TokenStorage, OAuthCredentials } from './types.js';

export abstract class BaseTokenStorage implements TokenStorage {
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  abstract getCredentials(serverName: string): Promise<OAuthCredentials | null>;
  abstract setCredentials(credentials: OAuthCredentials): Promise<void>;
  abstract deleteCredentials(serverName: string): Promise<void>;
  abstract listServers(): Promise<string[]>;
  abstract getAllCredentials(): Promise<Map<string, OAuthCredentials>>;
  abstract clearAll(): Promise<void>;

  protected validateCredentials(credentials: OAuthCredentials): void {
    if (!credentials.serverName) {
      throw new Error('Server name is required');
    }
    if (!credentials.token) {
      throw new Error('Token is required');
    }
    if (!credentials.token.accessToken) {
      throw new Error('Access token is required');
    }
    if (!credentials.token.tokenType) {
      throw new Error('Token type is required');
    }
  }

  protected isTokenExpired(credentials: OAuthCredentials): boolean {
    if (!credentials.token.expiresAt) {
      return false;
    }
    const bufferMs = 5 * 60 * 1000;
    return Date.now() > credentials.token.expiresAt - bufferMs;
  }

  protected sanitizeServerName(serverName: string): string {
    return serverName.replace(/[^a-zA-Z0-9-_.]/g, '_');
  }
}
