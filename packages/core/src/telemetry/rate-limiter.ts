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
 * Rate limiter to prevent excessive telemetry recording
 * Ensures we don't send metrics more frequently than specified limits
 */
export class RateLimiter {
  private lastRecordTimes: Map<string, number> = new Map();
  private readonly minIntervalMs: number;
  private static readonly HIGH_PRIORITY_DIVISOR = 2;

  constructor(minIntervalMs: number = 60000) {
    if (minIntervalMs < 0) {
      throw new Error('minIntervalMs must be non-negative.');
    }
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Check if we should record a metric based on rate limiting
   * @param metricKey - Unique key for the metric type/context
   * @param isHighPriority - If true, uses shorter interval for critical events
   * @returns true if metric should be recorded
   */
  shouldRecord(metricKey: string, isHighPriority: boolean = false): boolean {
    const now = Date.now();
    const lastRecordTime = this.lastRecordTimes.get(metricKey) || 0;

    // Use shorter interval for high priority events (e.g., memory leaks)
    const interval = isHighPriority
      ? Math.round(this.minIntervalMs / RateLimiter.HIGH_PRIORITY_DIVISOR)
      : this.minIntervalMs;

    if (now - lastRecordTime >= interval) {
      this.lastRecordTimes.set(metricKey, now);
      return true;
    }

    return false;
  }

  /**
   * Force record a metric (bypasses rate limiting)
   * Use sparingly for critical events
   */
  forceRecord(metricKey: string): void {
    this.lastRecordTimes.set(metricKey, Date.now());
  }

  /**
   * Get time until next allowed recording for a metric
   */
  getTimeUntilNextAllowed(
    metricKey: string,
    isHighPriority: boolean = false,
  ): number {
    const now = Date.now();
    const lastRecordTime = this.lastRecordTimes.get(metricKey) || 0;
    const interval = isHighPriority
      ? Math.round(this.minIntervalMs / RateLimiter.HIGH_PRIORITY_DIVISOR)
      : this.minIntervalMs;
    const nextAllowedTime = lastRecordTime + interval;

    return Math.max(0, nextAllowedTime - now);
  }

  /**
   * Get statistics about rate limiting
   */
  getStats(): {
    totalMetrics: number;
    oldestRecord: number;
    newestRecord: number;
    averageInterval: number;
  } {
    const recordTimes = Array.from(this.lastRecordTimes.values());

    if (recordTimes.length === 0) {
      return {
        totalMetrics: 0,
        oldestRecord: 0,
        newestRecord: 0,
        averageInterval: 0,
      };
    }

    const oldest = Math.min(...recordTimes);
    const newest = Math.max(...recordTimes);
    const totalSpan = newest - oldest;
    const averageInterval =
      recordTimes.length > 1 ? totalSpan / (recordTimes.length - 1) : 0;

    return {
      totalMetrics: recordTimes.length,
      oldestRecord: oldest,
      newestRecord: newest,
      averageInterval,
    };
  }

  /**
   * Clear all rate limiting state
   */
  reset(): void {
    this.lastRecordTimes.clear();
  }

  /**
   * Remove old entries to prevent memory leaks
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const cutoffTime = Date.now() - maxAgeMs;

    for (const [key, time] of this.lastRecordTimes.entries()) {
      if (time < cutoffTime) {
        this.lastRecordTimes.delete(key);
      }
    }
  }
}
