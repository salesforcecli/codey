/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    resolveAlias: {
      // Turbopack-specific alias resolution for problematic modules
      'pino-pretty': 'pino-pretty',
      pino: 'pino',
    },
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },

  // Fix workspace root detection for monorepo
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Optional: Exclude problematic directories from file tracing
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      '.git/**/*',
    ],
  },

  // External packages that should not be bundled
  serverExternalPackages: [
    '@google/gemini-cli-core',
    '@google/gemini-cli',
    '@salesforce/core',
    'pino',
    'pino-pretty',
    'pino-abstract-transport',
    'sonic-boom',
  ],

  // Webpack configuration to handle warnings
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle missing optional dependencies
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@opentelemetry/exporter-jaeger': false,
        '@opentelemetry/exporter-prometheus': false,
        '@opentelemetry/exporter-zipkin': false,
      };

      // Fix Pino transport resolution issues
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino-pretty': require.resolve('pino-pretty'),
        pino: require.resolve('pino'),
      };

      // Externalize problematic modules
      config.externals = [
        ...(config.externals || []),
        'pino-pretty',
        'sonic-boom',
        '@salesforce/core',
      ];
    }

    // Suppress specific warnings
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      /Critical dependency: require function is used in a way/,
      /Module not found: Can't resolve '@opentelemetry\/exporter-/,
      /unable to determine transport target/,
    ];

    return config;
  },
};

module.exports = nextConfig;
