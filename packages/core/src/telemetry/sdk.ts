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

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter as OTLPLogExporterHttp } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-node';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { Config } from '../config/config.js';
import { SERVICE_NAME } from './constants.js';
import { initializeMetrics } from './metrics.js';
import { ClearcutLogger } from './clearcut-logger/clearcut-logger.js';
import {
  FileLogExporter,
  FileMetricExporter,
  FileSpanExporter,
} from './file-exporters.js';
import { TelemetryTarget } from './index.js';
import type { SalesforceTelemetrySetup } from './providers/salesforce.js';
import { setupSalesforceTelemetry } from './providers/salesforce.js';

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

let sdk: NodeSDK | undefined;
let telemetryInitialized = false;
let salesforceTelemetrySetup: SalesforceTelemetrySetup | undefined;

export function isTelemetrySdkInitialized(): boolean {
  return telemetryInitialized;
}

function parseOtlpEndpoint(
  otlpEndpointSetting: string | undefined,
  protocol: 'grpc' | 'http',
): string | undefined {
  if (!otlpEndpointSetting) {
    return undefined;
  }
  // Trim leading/trailing quotes that might come from env variables
  const trimmedEndpoint = otlpEndpointSetting.replace(/^["']|["']$/g, '');

  try {
    const url = new URL(trimmedEndpoint);
    if (protocol === 'grpc') {
      // OTLP gRPC exporters expect an endpoint in the format scheme://host:port
      // The `origin` property provides this, stripping any path, query, or hash.
      return url.origin;
    }
    // For http, use the full href.
    return url.href;
  } catch (error) {
    diag.error('Invalid OTLP endpoint URL provided:', trimmedEndpoint, error);
    return undefined;
  }
}

export async function initializeTelemetry(config: Config): Promise<void> {
  if (telemetryInitialized || !config.getTelemetryEnabled()) {
    return;
  }

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.version,
    'session.id': config.getSessionId(),
  });

  const telemetryTarget = config.getTelemetryTarget();

  // Handle salesforce target
  if (telemetryTarget === TelemetryTarget.SALESFORCE) {
    try {
      salesforceTelemetrySetup = await setupSalesforceTelemetry(config);

      sdk = new NodeSDK({
        resource,
        spanProcessors: [
          new BatchSpanProcessor(
            salesforceTelemetrySetup.exceptionTraceExporter,
          ),
        ],
        logRecordProcessors: [
          new BatchLogRecordProcessor(salesforceTelemetrySetup.logExporter),
        ],
        // No metric reader for salesforce target as per plan
        instrumentations: [new HttpInstrumentation()],
      });

      sdk.start();
      if (config.getDebugMode()) {
        console.log(
          'OpenTelemetry SDK started successfully with salesforce target.',
        );
      }
      telemetryInitialized = true;
      initializeMetrics(config);
      return;
    } catch (error) {
      console.error(
        'Error starting OpenTelemetry SDK with salesforce target:',
        error,
      );
      return;
    }
  }

  // Handle local target (existing logic)
  const otlpEndpoint = config.getTelemetryOtlpEndpoint();
  const otlpProtocol = config.getTelemetryOtlpProtocol();
  const parsedEndpoint = parseOtlpEndpoint(otlpEndpoint, otlpProtocol);
  const useOtlp = !!parsedEndpoint;
  const telemetryOutfile = config.getTelemetryOutfile();

  let spanExporter:
    | OTLPTraceExporter
    | OTLPTraceExporterHttp
    | FileSpanExporter
    | ConsoleSpanExporter;
  let logExporter:
    | OTLPLogExporter
    | OTLPLogExporterHttp
    | FileLogExporter
    | ConsoleLogRecordExporter;
  let metricReader: PeriodicExportingMetricReader;

  if (useOtlp) {
    if (otlpProtocol === 'http') {
      spanExporter = new OTLPTraceExporterHttp({
        url: parsedEndpoint,
      });
      logExporter = new OTLPLogExporterHttp({
        url: parsedEndpoint,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporterHttp({
          url: parsedEndpoint,
        }),
        exportIntervalMillis: 10000,
      });
    } else {
      // grpc
      spanExporter = new OTLPTraceExporter({
        url: parsedEndpoint,
        compression: CompressionAlgorithm.GZIP,
      });
      logExporter = new OTLPLogExporter({
        url: parsedEndpoint,
        compression: CompressionAlgorithm.GZIP,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: parsedEndpoint,
          compression: CompressionAlgorithm.GZIP,
        }),
        exportIntervalMillis: 10000,
      });
    }
  } else if (telemetryOutfile) {
    spanExporter = new FileSpanExporter(telemetryOutfile);
    logExporter = new FileLogExporter(telemetryOutfile);
    metricReader = new PeriodicExportingMetricReader({
      exporter: new FileMetricExporter(telemetryOutfile),
      exportIntervalMillis: 10000,
    });
  } else {
    spanExporter = new ConsoleSpanExporter();
    logExporter = new ConsoleLogRecordExporter();
    metricReader = new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 10000,
    });
  }

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(spanExporter)],
    logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
    metricReader,
    instrumentations: [new HttpInstrumentation()],
  });

  try {
    sdk.start();
    if (config.getDebugMode()) {
      console.log('OpenTelemetry SDK started successfully.');
    }
    telemetryInitialized = true;
    initializeMetrics(config);
  } catch (error) {
    console.error('Error starting OpenTelemetry SDK:', error);
  }

  process.on('SIGTERM', () => {
    shutdownTelemetry(config);
  });
  process.on('SIGINT', () => {
    shutdownTelemetry(config);
  });
}

export async function shutdownTelemetry(config: Config): Promise<void> {
  if (!telemetryInitialized || !sdk) {
    return;
  }
  try {
    // Shutdown salesforce telemetry setup if it exists
    if (salesforceTelemetrySetup) {
      await salesforceTelemetrySetup.stop();
      salesforceTelemetrySetup = undefined;
    }

    ClearcutLogger.getInstance()?.shutdown();
    await sdk.shutdown();
    if (config.getDebugMode()) {
      console.log('OpenTelemetry SDK shut down successfully.');
    }
  } catch (error) {
    console.error('Error shutting down SDK:', error);
  } finally {
    telemetryInitialized = false;
  }
}
