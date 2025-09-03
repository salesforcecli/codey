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

import path from 'node:path';
import { promises as fsp, readFileSync } from 'node:fs';
import { Storage } from '../config/storage.js';

interface UserAccounts {
  active: string | null;
  old: string[];
}

export class UserAccountManager {
  private getGoogleAccountsCachePath(): string {
    return Storage.getGoogleAccountsPath();
  }

  /**
   * Parses and validates the string content of an accounts file.
   * @param content The raw string content from the file.
   * @returns A valid UserAccounts object.
   */
  private parseAndValidateAccounts(content: string): UserAccounts {
    const defaultState = { active: null, old: [] };
    if (!content.trim()) {
      return defaultState;
    }

    const parsed = JSON.parse(content);

    // Inlined validation logic
    if (typeof parsed !== 'object' || parsed === null) {
      console.log('Invalid accounts file schema, starting fresh.');
      return defaultState;
    }
    const { active, old } = parsed as Partial<UserAccounts>;
    const isValid =
      (active === undefined || active === null || typeof active === 'string') &&
      (old === undefined ||
        (Array.isArray(old) && old.every((i) => typeof i === 'string')));

    if (!isValid) {
      console.log('Invalid accounts file schema, starting fresh.');
      return defaultState;
    }

    return {
      active: parsed.active ?? null,
      old: parsed.old ?? [],
    };
  }

  private readAccountsSync(filePath: string): UserAccounts {
    const defaultState = { active: null, old: [] };
    try {
      const content = readFileSync(filePath, 'utf-8');
      return this.parseAndValidateAccounts(content);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return defaultState;
      }
      console.log('Error during sync read of accounts, starting fresh.', error);
      return defaultState;
    }
  }

  private async readAccounts(filePath: string): Promise<UserAccounts> {
    const defaultState = { active: null, old: [] };
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      return this.parseAndValidateAccounts(content);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return defaultState;
      }
      console.log('Could not parse accounts file, starting fresh.', error);
      return defaultState;
    }
  }

  async cacheGoogleAccount(email: string): Promise<void> {
    const filePath = this.getGoogleAccountsCachePath();
    await fsp.mkdir(path.dirname(filePath), { recursive: true });

    const accounts = await this.readAccounts(filePath);

    if (accounts.active && accounts.active !== email) {
      if (!accounts.old.includes(accounts.active)) {
        accounts.old.push(accounts.active);
      }
    }

    // If the new email was in the old list, remove it
    accounts.old = accounts.old.filter((oldEmail) => oldEmail !== email);

    accounts.active = email;
    await fsp.writeFile(filePath, JSON.stringify(accounts, null, 2), 'utf-8');
  }

  getCachedGoogleAccount(): string | null {
    const filePath = this.getGoogleAccountsCachePath();
    const accounts = this.readAccountsSync(filePath);
    return accounts.active;
  }

  getLifetimeGoogleAccounts(): number {
    const filePath = this.getGoogleAccountsCachePath();
    const accounts = this.readAccountsSync(filePath);
    const allAccounts = new Set(accounts.old);
    if (accounts.active) {
      allAccounts.add(accounts.active);
    }
    return allAccounts.size;
  }

  async clearCachedGoogleAccount(): Promise<void> {
    const filePath = this.getGoogleAccountsCachePath();
    const accounts = await this.readAccounts(filePath);

    if (accounts.active) {
      if (!accounts.old.includes(accounts.active)) {
        accounts.old.push(accounts.active);
      }
      accounts.active = null;
    }

    await fsp.writeFile(filePath, JSON.stringify(accounts, null, 2), 'utf-8');
  }
}
