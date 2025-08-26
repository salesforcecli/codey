import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Fix workspace root detection for monorepo
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Turbopack configuration for monorepo
  turbopack: {
    root: path.join(__dirname, '../../'),
  },

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

  // Webpack configuration to handle warnings (fallback for non-turbopack builds)
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

export default nextConfig;
