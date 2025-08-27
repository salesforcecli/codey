/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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

  constructor(options: PhraseCyclerOptions = {}) {
    this.phrases = options.phrases ?? WITTY_LOADING_PHRASES;
    this.intervalMs = options.intervalMs ?? 10000; // 10 seconds default
    this.onPhraseChange = options.onPhraseChange;

    // Start with a random phrase to avoid always showing the same first phrase
    this.currentPhraseIndex = Math.floor(Math.random() * this.phrases.length);
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
   * Uses random selection to avoid predictable patterns.
   */
  private nextPhrase(): void {
    // Get a random index that's different from the current one
    // This ensures we don't show the same phrase twice in a row
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * this.phrases.length);
    } while (nextIndex === this.currentPhraseIndex && this.phrases.length > 1);

    this.currentPhraseIndex = nextIndex;
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
