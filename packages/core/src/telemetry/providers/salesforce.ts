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

import { execSync } from 'node:child_process';
import { TelemetryReporter, type Attributes } from '@salesforce/telemetry';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { LogRecord } from '@opentelemetry/api-logs';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResultCode } from '@opentelemetry/core';
import type { Config } from '../../config/config.js';
import { findGatewayModel } from '../../gateway/models.js';

const SERVICE_NAME = 'salesforce-codey';
const APP_INSIGHTS_KEY =
  'InstrumentationKey=2ca64abb-6123-4c7b-bd9e-4fe73e71fe9c;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=ecd8fa7a-0e0d-4109-94db-4d7878ada862';
const O11Y_UPLOAD_ENDPOINT =
  'https://794testsite.my.site.com/byolwr/webruntime/log/metrics';

// Allow-listed events from the telemetry plan
const ALLOWED_EVENTS = new Set([
  'gemini_cli.config',
  'gemini_cli.user_prompt',
  'gemini_cli.tool_call',
  'gemini_cli.api_request',
  'gemini_cli.api_response',
  'gemini_cli.api_error',
  'gemini_cli.flash_fallback',
  'gemini_cli.slash_command',
  'gemini_cli.conversation_finished',
  'gemini_cli.chat_compression',
  'gemini_cli.malformed_json_response',
  'gemini_cli.chat.invalid_chunk',
  'gemini_cli.chat.content_retry',
  'gemini_cli.chat.content_retry_failure',
  'gemini_cli.file_operation',
  'tool_output_truncated',
  'loop_detected',
]);

// Fields to exclude from specific events for privacy/security
const FIELD_EXCLUSIONS: Record<string, Set<string>> = {
  'gemini_cli.user_prompt': new Set(['user.email', 'prompt']),
  'gemini_cli.api_request': new Set(['request_text']),
  'gemini_cli.api_response': new Set(['response_text']),
};

const GLOBAL_FIELD_EXCLUSIONS = new Set(['event.name']);

type Value = string | number | boolean;

const KEY_TRANSFORMATIONS: Record<
  string,
  (key: string, value: Value) => { key: string; value: Value }
> = {
  model: (_, value: Value) => ({
    key: 'model',
    value:
      typeof value === 'string'
        ? (findGatewayModel(value)?.displayId ?? value)
        : value,
  }),
  embedding_model: (_, value: Value) => ({
    key: 'embedding_model',
    value:
      typeof value === 'string'
        ? (findGatewayModel(value)?.displayId ?? value)
        : value,
  }),
};

const DEBUG_MODE = process.env['CODEY_DEBUG_TELEMETRY'] === 'true';

/**
 * Subclass of TelemetryReporter that bypasses internal gating by always returning true
 * for isSfdxTelemetryEnabled(). The external gate is controlled by CLI telemetry.enabled setting.
 */
class SalesforceReporter extends TelemetryReporter {
  override isSfdxTelemetryEnabled(): boolean {
    return true;
  }

  override sendTelemetryEvent(
    eventName: string,
    attributes?: Attributes,
  ): void {
    if (DEBUG_MODE) {
      this.debug(eventName, attributes);
    }
    super.sendTelemetryEvent(eventName, attributes);
  }

  override sendTelemetryException(error: Error, attributes?: Attributes): void {
    if (DEBUG_MODE) {
      this.debug('ERROR', attributes);
    }
    super.sendTelemetryException(error, attributes);
  }

  override sendTelemetryMetric(
    _metricName: string,
    _value: number,
    _properties?: unknown,
  ): void {
    // no-op
  }

  private debug(event: string, attributes: Attributes | undefined): void {
    if (DEBUG_MODE) {
      const namespacedEvent = `${SERVICE_NAME}/${event}`;
      console.log('[DEBUG]', namespacedEvent, attributes);
    }
  }
}

/**
 * Exception-only trace exporter that extracts exception events from finished spans
 * and forwards them to the TelemetryReporter as telemetry exceptions.
 */
class ExceptionOnlyTraceExporter implements SpanExporter {
  constructor(private reporter: TelemetryReporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: ExportResultCode; error?: Error }) => void,
  ): void {
    try {
      for (const span of spans) {
        // Look for exception events in the span
        for (const event of span.events) {
          if (event.name === 'exception') {
            const exceptionType = event.attributes?.[
              'exception.type'
            ] as string;
            const exceptionMessage = event.attributes?.[
              'exception.message'
            ] as string;
            const exceptionStacktrace = event.attributes?.[
              'exception.stacktrace'
            ] as string;

            if (exceptionType || exceptionMessage) {
              // Construct an Error object
              const error = new Error(exceptionMessage || 'Unknown error');
              error.name = exceptionType || 'UnknownError';
              if (exceptionStacktrace) {
                error.stack = exceptionStacktrace;
              }

              // Include limited context as properties
              const properties = {
                trace_id: span.spanContext().traceId,
                span_id: span.spanContext().spanId,
                error_type: exceptionType || 'UnknownError',
                service_name: span.resource.attributes[
                  'service.name'
                ] as string,
              };

              // Send exception to reporter
              this.reporter.sendTelemetryException(error, properties);
            }
          }
        }
      }
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Allow-listed log exporter that filters events by name and excludes sensitive fields.
 * Only exports approved events to the TelemetryReporter.
 */
class AllowListedLogExporter implements LogRecordExporter {
  constructor(private reporter: TelemetryReporter) {}

  export(
    logs: LogRecord[],
    resultCallback: (result: { code: ExportResultCode; error?: Error }) => void,
  ): void {
    try {
      for (const log of logs) {
        const eventName = log.attributes?.['event.name'] as string;

        // Only process allow-listed events
        if (eventName && ALLOWED_EVENTS.has(eventName)) {
          // Clone attributes and apply field exclusions
          const filteredAttributes = { ...log.attributes };
          const exclusions = new Set([
            ...(FIELD_EXCLUSIONS[eventName] ?? []),
            ...GLOBAL_FIELD_EXCLUSIONS,
          ]);
          if (exclusions) {
            for (const field of exclusions) {
              delete filteredAttributes[field];
            }
          }

          // Convert AnyValue attributes to simple types for telemetry
          const simplifiedAttributes: Record<
            string,
            string | number | boolean
          > = {};
          for (const [key, value] of Object.entries(filteredAttributes)) {
            if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ) {
              const { key: transformedKey, value: transformedValue } =
                KEY_TRANSFORMATIONS[key]?.(key, value) ?? {
                  key,
                  value,
                };
              simplifiedAttributes[transformedKey] = transformedValue;
            } else if (value != null) {
              simplifiedAttributes[key] = String(value);
            }
          }

          const normalizedName = eventName
            .replace('gemini_cli.', '')
            .toUpperCase();

          this.reporter.sendTelemetryEvent(
            normalizedName,
            simplifiedAttributes,
          );
        }
      }
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

const getUserId = (): string => {
  try {
    const telemData = execSync('sf telemetry --json').toString();
    const parsed = JSON.parse(telemData) as {
      status: number;
      result: {
        cliId: string;
      };
    };
    return parsed.result.cliId;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return 'anonymous';
  }
};

/**
 * Provider setup configuration
 */
export interface SalesforceTelemetrySetup {
  exceptionTraceExporter: SpanExporter;
  logExporter: LogRecordExporter;
  stop: () => Promise<void>;
}

/**
 * Sets up the forcedotcom telemetry provider with TelemetryReporter integration.
 * Returns OTel bridge exporters and a stop function for lifecycle management.
 */
export async function setupSalesforceTelemetry(
  config: Config,
): Promise<SalesforceTelemetrySetup> {
  // Initialize the bypass reporter with required options
  const reporter = await SalesforceReporter.create({
    project: SERVICE_NAME,
    key: APP_INSIGHTS_KEY,
    o11yUploadEndpoint: O11Y_UPLOAD_ENDPOINT,
    enableAppInsights: true,
    enableO11y: true,
    userId: getUserId(),
    sessionId: config.getSessionId(),
  });

  // Create the bridge exporters
  const exceptionTraceExporter = new ExceptionOnlyTraceExporter(reporter);
  const logExporter = new AllowListedLogExporter(reporter);

  // Return setup with stop function
  return {
    exceptionTraceExporter,
    logExporter,
    stop: async () => reporter.stop(),
  };
}
