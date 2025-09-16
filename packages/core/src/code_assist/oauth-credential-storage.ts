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

import { type Credentials } from 'google-auth-library';
import { HybridTokenStorage } from '../mcp/token-storage/hybrid-token-storage.js';
import { OAUTH_FILE } from '../config/storage.js';
import type { OAuthCredentials } from '../mcp/token-storage/types.js';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';

const GEMINI_DIR = '.codey';
const KEYCHAIN_SERVICE_NAME = 'gemini-cli-oauth';
const MAIN_ACCOUNT_KEY = 'main-account';

export class OAuthCredentialStorage {
  private static storage: HybridTokenStorage = new HybridTokenStorage(
    KEYCHAIN_SERVICE_NAME,
  );

  /**
   * Load cached OAuth credentials
   */
  static async loadCredentials(): Promise<Credentials | null> {
    try {
      const credentials = await this.storage.getCredentials(MAIN_ACCOUNT_KEY);

      if (credentials?.token) {
        const { accessToken, refreshToken, expiresAt, tokenType, scope } =
          credentials.token;
        // Convert from OAuthCredentials format to Google Credentials format
        const googleCreds: Credentials = {
          access_token: accessToken,
          refresh_token: refreshToken || undefined,
          token_type: tokenType || undefined,
          scope: scope || undefined,
        };

        if (expiresAt) {
          googleCreds.expiry_date = expiresAt;
        }

        return googleCreds;
      }

      // Fallback: Try to migrate from old file-based storage
      return await this.migrateFromFileStorage();
    } catch (error: unknown) {
      console.error(error);
      throw new Error('Failed to load OAuth credentials');
    }
  }

  /**
   * Save OAuth credentials
   */
  static async saveCredentials(credentials: Credentials): Promise<void> {
    if (!credentials.access_token) {
      throw new Error('Attempted to save credentials without an access token.');
    }

    // Convert Google Credentials to OAuthCredentials format
    const mcpCredentials: OAuthCredentials = {
      serverName: MAIN_ACCOUNT_KEY,
      token: {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || undefined,
        tokenType: credentials.token_type || 'Bearer',
        scope: credentials.scope || undefined,
        expiresAt: credentials.expiry_date || undefined,
      },
      updatedAt: Date.now(),
    };

    await this.storage.setCredentials(mcpCredentials);
  }

  /**
   * Clear cached OAuth credentials
   */
  static async clearCredentials(): Promise<void> {
    try {
      await this.storage.deleteCredentials(MAIN_ACCOUNT_KEY);

      // Also try to remove the old file if it exists
      const oldFilePath = path.join(os.homedir(), GEMINI_DIR, OAUTH_FILE);
      await fs.rm(oldFilePath, { force: true }).catch(() => {});
    } catch (error: unknown) {
      console.error(error);
      throw new Error('Failed to clear OAuth credentials');
    }
  }

  /**
   * Migrate credentials from old file-based storage to keychain
   */
  private static async migrateFromFileStorage(): Promise<Credentials | null> {
    const oldFilePath = path.join(os.homedir(), GEMINI_DIR, OAUTH_FILE);

    let credsJson: string;
    try {
      credsJson = await fs.readFile(oldFilePath, 'utf-8');
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        // File doesn't exist, so no migration.
        return null;
      }
      // Other read errors should propagate.
      throw error;
    }

    const credentials = JSON.parse(credsJson) as Credentials;

    // Save to new storage
    await this.saveCredentials(credentials);

    // Remove old file after successful migration
    await fs.rm(oldFilePath, { force: true }).catch(() => {});

    return credentials;
  }
}
