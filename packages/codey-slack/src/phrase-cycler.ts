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

import { WITTY_LOADING_PHRASES } from './witty-phrases';

export interface PhraseCyclerOptions {
  /** Interval in milliseconds between phrase changes. Default: 10000 (10 seconds) */
  intervalMs?: number;
  /** Custom phrases to use instead of the default ones */
  phrases?: string[];
  /** Callback function called when the phrase changes */
  onPhraseChange?: (phrase: string) => void;
}

/**
 * Manages cycling through loading phrases at regular intervals.
 * Follows best practices for resource management and cleanup.
 */
export class PhraseCycler {
  private intervalId: NodeJS.Timeout | null = null;
  private currentPhraseIndex = 0;
  private readonly phrases: string[];
  private readonly intervalMs: number;
  private readonly onPhraseChange?: (phrase: string) => void;
  private isActive = false;
  private unusedPhrases: number[] = [];

  constructor(options: PhraseCyclerOptions = {}) {
    this.phrases = options.phrases ?? WITTY_LOADING_PHRASES;
    this.intervalMs = options.intervalMs ?? 10000; // 10 seconds default
    this.onPhraseChange = options.onPhraseChange;

    // Initialize the cycle with all phrase indices shuffled
    this.resetCycle();

    // Start with the first phrase from the shuffled cycle
    this.currentPhraseIndex = this.unusedPhrases.pop()!;
  }

  /**
   * Gets the current loading phrase.
   */
  getCurrentPhrase(): string {
    return this.phrases[this.currentPhraseIndex];
  }

  /**
   * Starts cycling through phrases at the configured interval.
   * If already active, this is a no-op.
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    // Immediately call the callback with the current phrase
    this.onPhraseChange?.(this.getCurrentPhrase());

    // Set up the interval to cycle through phrases
    this.intervalId = setInterval(() => {
      this.nextPhrase();
      this.onPhraseChange?.(this.getCurrentPhrase());
    }, this.intervalMs);
  }

  /**
   * Stops cycling through phrases and cleans up resources.
   * Safe to call multiple times.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
  }

  /**
   * Advances to the next phrase in the sequence.
   * Cycles through all phrases before repeating any.
   */
  private nextPhrase(): void {
    // If we've used all phrases, reset the cycle
    if (this.unusedPhrases.length === 0) {
      this.resetCycle();
    }

    // Get the next phrase from the shuffled unused phrases
    this.currentPhraseIndex = this.unusedPhrases.pop()!;
  }

  /**
   * Resets the cycle by creating a shuffled array of all phrase indices.
   * This ensures we go through all phrases before repeating any.
   */
  private resetCycle(): void {
    // Create array of all indices
    this.unusedPhrases = Array.from(
      { length: this.phrases.length },
      (_, i) => i,
    );

    // Shuffle the array using Fisher-Yates algorithm
    for (let i = this.unusedPhrases.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.unusedPhrases[i], this.unusedPhrases[j]] = [
        this.unusedPhrases[j],
        this.unusedPhrases[i],
      ];
    }
  }

  /**
   * Checks if the cycler is currently active.
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Gets the total number of available phrases.
   */
  getPhraseCount(): number {
    return this.phrases.length;
  }

  /**
   * Manually advances to the next phrase without waiting for the interval.
   * Useful for testing or immediate phrase changes.
   */
  forceNext(): string {
    this.nextPhrase();
    const newPhrase = this.getCurrentPhrase();
    this.onPhraseChange?.(newPhrase);
    return newPhrase;
  }
}
