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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config } from '../config/config.js';
import { initializeTelemetry, shutdownTelemetry } from './sdk.js';
import { TelemetryTarget } from './index.js';
import { setupSalesforceTelemetry } from './providers/salesforce.js';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter as OTLPLogExporterHttp } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

vi.mock('@opentelemetry/exporter-trace-otlp-grpc');
vi.mock('@opentelemetry/exporter-logs-otlp-grpc');
vi.mock('@opentelemetry/exporter-metrics-otlp-grpc');
vi.mock('@opentelemetry/exporter-trace-otlp-http');
vi.mock('@opentelemetry/exporter-logs-otlp-http');
vi.mock('@opentelemetry/exporter-metrics-otlp-http');
vi.mock('@opentelemetry/sdk-node');
vi.mock('./providers/salesforce.js');

describe('Telemetry SDK', () => {
  let mockConfig: Config;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      getTelemetryEnabled: () => true,
      getTelemetryOtlpEndpoint: () => 'http://localhost:4317',
      getTelemetryOtlpProtocol: () => 'grpc',
      getTelemetryOutfile: () => undefined,
      getDebugMode: () => false,
      getSessionId: () => 'test-session',
      getTelemetryTarget: () => TelemetryTarget.LOCAL,
    } as unknown as Config;
  });

  afterEach(async () => {
    await shutdownTelemetry(mockConfig);
  });

  it('should use gRPC exporters when protocol is grpc', async () => {
    await initializeTelemetry(mockConfig);

    expect(OTLPTraceExporter).toHaveBeenCalledWith({
      url: 'http://localhost:4317',
      compression: 'gzip',
    });
    expect(OTLPLogExporter).toHaveBeenCalledWith({
      url: 'http://localhost:4317',
      compression: 'gzip',
    });
    expect(OTLPMetricExporter).toHaveBeenCalledWith({
      url: 'http://localhost:4317',
      compression: 'gzip',
    });
    expect(NodeSDK.prototype.start).toHaveBeenCalled();
  });

  it('should use HTTP exporters when protocol is http', async () => {
    vi.spyOn(mockConfig, 'getTelemetryEnabled').mockReturnValue(true);
    vi.spyOn(mockConfig, 'getTelemetryOtlpProtocol').mockReturnValue('http');
    vi.spyOn(mockConfig, 'getTelemetryOtlpEndpoint').mockReturnValue(
      'http://localhost:4318',
    );

    await initializeTelemetry(mockConfig);

    expect(OTLPTraceExporterHttp).toHaveBeenCalledWith({
      url: 'http://localhost:4318/',
    });
    expect(OTLPLogExporterHttp).toHaveBeenCalledWith({
      url: 'http://localhost:4318/',
    });
    expect(OTLPMetricExporterHttp).toHaveBeenCalledWith({
      url: 'http://localhost:4318/',
    });
    expect(NodeSDK.prototype.start).toHaveBeenCalled();
  });

  it('should parse gRPC endpoint correctly', async () => {
    vi.spyOn(mockConfig, 'getTelemetryOtlpEndpoint').mockReturnValue(
      'https://my-collector.com',
    );
    await initializeTelemetry(mockConfig);
    expect(OTLPTraceExporter).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://my-collector.com' }),
    );
  });

  it('should parse HTTP endpoint correctly', async () => {
    vi.spyOn(mockConfig, 'getTelemetryOtlpProtocol').mockReturnValue('http');
    vi.spyOn(mockConfig, 'getTelemetryOtlpEndpoint').mockReturnValue(
      'https://my-collector.com',
    );
    await initializeTelemetry(mockConfig);
    expect(OTLPTraceExporterHttp).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://my-collector.com/' }),
    );
  });

  it('should use forcedotcom provider when target is forcedotcom', async () => {
    vi.spyOn(mockConfig, 'getTelemetryTarget').mockReturnValue(
      TelemetryTarget.SALESFORCE,
    );

    const mockSetup = {
      exceptionTraceExporter: {
        export: vi.fn(),
        shutdown: vi.fn(),
        forceFlush: vi.fn(),
      },
      logExporter: {
        export: vi.fn(),
        shutdown: vi.fn(),
        forceFlush: vi.fn(),
      },
      stop: vi.fn(),
    };
    vi.mocked(setupSalesforceTelemetry).mockResolvedValue(mockSetup);

    await initializeTelemetry(mockConfig);

    expect(setupSalesforceTelemetry).toHaveBeenCalledWith(mockConfig);
    expect(NodeSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        spanProcessors: expect.any(Array),
        logRecordProcessors: expect.any(Array),
        instrumentations: expect.any(Array),
      }),
    );
  });
});
