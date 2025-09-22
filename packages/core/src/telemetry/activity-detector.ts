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

/**
 * Tracks user activity state to determine when memory monitoring should be active
 */
export class ActivityDetector {
  private lastActivityTime: number = Date.now();
  private readonly idleThresholdMs: number;

  constructor(idleThresholdMs: number = 30000) {
    this.idleThresholdMs = idleThresholdMs;
  }

  /**
   * Record user activity (called by CLI when user types, adds messages, etc.)
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  /**
   * Check if user is currently active (activity within idle threshold)
   */
  isUserActive(): boolean {
    const timeSinceActivity = Date.now() - this.lastActivityTime;
    return timeSinceActivity < this.idleThresholdMs;
  }

  /**
   * Get time since last activity in milliseconds
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivityTime(): number {
    return this.lastActivityTime;
  }
}

// Global activity detector instance (eagerly created with default threshold)
const globalActivityDetector: ActivityDetector = new ActivityDetector();

/**
 * Get global activity detector instance
 */
export function getActivityDetector(): ActivityDetector {
  return globalActivityDetector;
}

/**
 * Record user activity (convenience function for CLI to call)
 */
export function recordUserActivity(): void {
  globalActivityDetector.recordActivity();
}

/**
 * Check if user is currently active (convenience function)
 */
export function isUserActive(): boolean {
  return globalActivityDetector.isUserActive();
}
