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

export enum TelemetryTarget {
  LOCAL = 'local',
  SALESFORCE = 'salesforce',
  GCP = 'gcp',
}

const DEFAULT_TELEMETRY_TARGET = TelemetryTarget.SALESFORCE;
const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4317';

export { DEFAULT_TELEMETRY_TARGET, DEFAULT_OTLP_ENDPOINT };
export {
  initializeTelemetry,
  shutdownTelemetry,
  isTelemetrySdkInitialized,
} from './sdk.js';
export {
  resolveTelemetrySettings,
  parseBooleanEnvFlag,
  parseTelemetryTargetValue,
} from './config.js';
export {
  GcpTraceExporter,
  GcpMetricExporter,
  GcpLogExporter,
} from './gcp-exporters.js';
export {
  logCliConfiguration,
  logUserPrompt,
  logToolCall,
  logApiRequest,
  logApiError,
  logApiResponse,
  logFlashFallback,
  logSlashCommand,
  logConversationFinishedEvent,
  logKittySequenceOverflow,
  logChatCompression,
  logToolOutputTruncated,
  logExtensionEnable,
  logExtensionInstallEvent,
  logExtensionUninstall,
} from './loggers.js';
export type { SlashCommandEvent, ChatCompressionEvent } from './types.js';
export {
  SlashCommandStatus,
  EndSessionEvent,
  UserPromptEvent,
  ApiRequestEvent,
  ApiErrorEvent,
  ApiResponseEvent,
  FlashFallbackEvent,
  StartSessionEvent,
  ToolCallEvent,
  ConversationFinishedEvent,
  KittySequenceOverflowEvent,
  ToolOutputTruncatedEvent,
} from './types.js';
export { makeSlashCommandEvent, makeChatCompressionEvent } from './types.js';
export type { TelemetryEvent } from './types.js';
export { SpanStatusCode, ValueType } from '@opentelemetry/api';
export { SemanticAttributes } from '@opentelemetry/semantic-conventions';
export * from './uiTelemetry.js';
export { HighWaterMarkTracker } from './high-water-mark-tracker.js';
export { RateLimiter } from './rate-limiter.js';
export { ActivityType } from './activity-types.js';
export {
  ActivityDetector,
  getActivityDetector,
  recordUserActivity,
  isUserActive,
} from './activity-detector.js';
export {
  // Core metrics functions
  recordToolCallMetrics,
  recordTokenUsageMetrics,
  recordApiResponseMetrics,
  recordApiErrorMetrics,
  recordFileOperationMetric,
  recordInvalidChunk,
  recordContentRetry,
  recordContentRetryFailure,
  recordModelRoutingMetrics,
  // Performance monitoring functions
  recordStartupPerformance,
  recordMemoryUsage,
  recordCpuUsage,
  recordToolQueueDepth,
  recordToolExecutionBreakdown,
  recordTokenEfficiency,
  recordApiRequestBreakdown,
  recordPerformanceScore,
  recordPerformanceRegression,
  recordBaselineComparison,
  isPerformanceMonitoringActive,
  // Performance monitoring types
  PerformanceMetricType,
  MemoryMetricType,
  ToolExecutionPhase,
  ApiRequestPhase,
  FileOperation,
} from './metrics.js';
