/**
 * API Documentation and Versioning Configuration
 * Centralized configuration for documentation, versioning, and SDK generation
 */

import { OpenApiConfig, VersioningConfig } from '../types';

// ============================================================================
// API VERSIONING CONFIGURATION
// ============================================================================

export const versioningConfig: VersioningConfig = {
  defaultVersion: 'v1',
  supportedVersions: ['v1', 'v2'],
  versionHeader: 'X-API-Version',
  versionParam: 'version',
  sunsetWarningDays: 90,
  deprecationWarningDays: 30,
};

// ============================================================================
// OPENAPI CONFIGURATION
// ============================================================================

export const openApiConfig: OpenApiConfig = {
  title: 'YieldSensei API',
  version: '1.0.0',
  description: `
# YieldSensei API Documentation

Welcome to the YieldSensei API documentation. This API provides comprehensive access to DeFi yield optimization, risk management, and real-time market data.

## Overview

YieldSensei is a sophisticated DeFi yield optimization platform that leverages advanced algorithms, real-time market data, and risk management strategies to maximize returns while minimizing risks.

## Key Features

- **Yield Optimization**: Advanced algorithms to find the best yield opportunities across multiple protocols
- **Risk Management**: Comprehensive risk assessment and monitoring
- **Real-time Data**: Live market data, price feeds, and protocol analytics
- **Portfolio Management**: Multi-protocol portfolio tracking and rebalancing
- **Security Monitoring**: Real-time security monitoring and exploit detection
- **Compliance**: Regulatory compliance and reporting tools

## Authentication

The API uses OAuth 2.0 with JWT tokens for authentication. All requests must include a valid access token in the Authorization header.

## Rate Limiting

API requests are rate-limited based on your subscription tier:
- **Free**: 100 requests/hour
- **Pro**: 1,000 requests/hour
- **Enterprise**: 10,000 requests/hour

## Error Handling

The API uses standard HTTP status codes and returns detailed error messages in JSON format.

## Support

For support, please contact:
- Email: support@yieldsensei.com
- Documentation: https://docs.yieldsensei.com
- GitHub: https://github.com/yieldsensei/api
  `,
  contact: {
    name: 'YieldSensei Support',
    email: 'support@yieldsensei.com',
    url: 'https://yieldsensei.com/support',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
  servers: [
    {
      url: 'https://api.yieldsensei.com/v1',
      description: 'Production server',
    },
    {
      url: 'https://api-staging.yieldsensei.com/v1',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000/v1',
      description: 'Local development server',
    },
  ],
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT token for API authentication',
    },
    apiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API key for service-to-service authentication',
    },
    oauth2: {
      type: 'oauth2',
      description: 'OAuth 2.0 authentication flow',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://auth.yieldsensei.com/oauth/authorize',
          tokenUrl: 'https://auth.yieldsensei.com/oauth/token',
          refreshUrl: 'https://auth.yieldsensei.com/oauth/refresh',
          scopes: {
            'read:profile': 'Read user profile information',
            'write:profile': 'Update user profile information',
            'read:portfolio': 'Read portfolio data',
            'write:portfolio': 'Update portfolio data',
            'read:analytics': 'Read analytics and reports',
            'write:analytics': 'Create and update analytics',
            'read:admin': 'Read administrative data',
            'write:admin': 'Write administrative data',
          },
        },
        clientCredentials: {
          tokenUrl: 'https://auth.yieldsensei.com/oauth/token',
          scopes: {
            'read:api': 'Read API data',
            'write:api': 'Write API data',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Authentication',
      description: 'Authentication and authorization endpoints',
    },
    {
      name: 'Users',
      description: 'User management and profile operations',
    },
    {
      name: 'Portfolio',
      description: 'Portfolio management and tracking',
    },
    {
      name: 'Yield',
      description: 'Yield optimization and analysis',
    },
    {
      name: 'Risk',
      description: 'Risk management and assessment',
    },
    {
      name: 'Market Data',
      description: 'Real-time market data and price feeds',
    },
    {
      name: 'Protocols',
      description: 'DeFi protocol integration and data',
    },
    {
      name: 'Analytics',
      description: 'Analytics and reporting',
    },
    {
      name: 'Security',
      description: 'Security monitoring and alerts',
    },
    {
      name: 'Compliance',
      description: 'Regulatory compliance and reporting',
    },
    {
      name: 'WebSocket',
      description: 'Real-time WebSocket connections',
    },
  ],
  externalDocs: {
    description: 'YieldSensei Developer Documentation',
    url: 'https://docs.yieldsensei.com',
  },
};

// ============================================================================
// GRAPHQL CONFIGURATION
// ============================================================================

export const graphqlConfig = {
  title: 'YieldSensei GraphQL API',
  version: '1.0.0',
  description: 'GraphQL API for YieldSensei platform',
  endpoint: '/graphql',
  playground: {
    enabled: true,
    endpoint: '/graphql',
    settings: {
      'editor.theme': 'dark',
      'editor.reuseHeaders': true,
      'tracing.hideTracingResponse': false,
    },
  },
  introspection: true,
  debug: process.env['NODE_ENV'] === 'development',
  formatError: (error: any) => {
    return {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: {
        code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      },
    };
  },
};

// ============================================================================
// DOCUMENTATION CONFIGURATION
// ============================================================================

export const documentationConfig = {
  // Documentation generation settings
  generation: {
    outputDir: './docs/api',
    format: ['json', 'yaml', 'html', 'pdf'],
    includeExamples: true,
    includeSchemas: true,
    includeResponses: true,
    includeHeaders: true,
    includeSecurity: true,
    includeDeprecated: true,
  },

  // Documentation hosting settings
  hosting: {
    enabled: true,
    provider: 'github-pages', // 'github-pages', 'netlify', 'vercel', 'custom'
    domain: 'docs.yieldsensei.com',
    autoDeploy: true,
    branch: 'gh-pages',
  },

  // Documentation testing settings
  testing: {
    enabled: true,
    framework: 'jest',
    coverage: {
      endpoints: 90,
      schemas: 95,
      examples: 80,
    },
    parallel: true,
    timeout: 30000,
  },

  // Documentation validation settings
  validation: {
    enabled: true,
    strict: true,
    rules: {
      'no-unused-schemas': 'error',
      'no-unused-parameters': 'error',
      'no-unused-responses': 'error',
      'no-missing-examples': 'warn',
      'no-missing-descriptions': 'error',
      'no-deprecated-without-alternative': 'error',
    },
  },
};

// ============================================================================
// API PLAYGROUND CONFIGURATION
// ============================================================================

export const playgroundConfig = {
  // Playground server settings
  server: {
    enabled: true,
    port: 3001,
    host: 'localhost',
    cors: {
      origin: ['http://localhost:3000', 'https://playground.yieldsensei.com'],
      credentials: true,
    },
  },

  // Playground features
  features: {
    rest: true,
    graphql: true,
    websocket: true,
    collections: true,
    environments: true,
    history: true,
    autoComplete: true,
    syntaxHighlighting: true,
    responseFormatting: true,
  },

  // Playground themes
  themes: {
    light: {
      primary: '#1976d2',
      secondary: '#dc004e',
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#212121',
    },
    dark: {
      primary: '#90caf9',
      secondary: '#f48fb1',
      background: '#121212',
      surface: '#1e1e1e',
      text: '#ffffff',
    },
  },

  // Default playground settings
  defaults: {
    theme: 'dark',
    fontSize: 14,
    enableAutoComplete: true,
    enableSyntaxHighlighting: true,
    enableResponseFormatting: true,
    enableHistory: true,
    maxHistoryItems: 100,
    enableCollections: true,
    enableEnvironmentVariables: true,
  },
};

// ============================================================================
// SDK GENERATION CONFIGURATION
// ============================================================================

export const sdkConfig = {
  // SDK metadata
  metadata: {
    name: 'yieldsensei-sdk',
    version: '1.0.0',
    description: 'Official SDK for YieldSensei API',
    author: 'YieldSensei Team',
    license: 'MIT',
    repository: 'https://github.com/yieldsensei/sdk',
    homepage: 'https://yieldsensei.com',
    keywords: ['defi', 'yield', 'optimization', 'api', 'sdk'],
  },

  // Supported languages and platforms
  languages: [
    {
      name: 'typescript',
      version: '4.9.0',
      extensions: ['.ts', '.d.ts'],
      packageManager: 'npm',
      buildTool: 'tsc',
      testFramework: 'jest',
    },
    {
      name: 'javascript',
      version: '18.0.0',
      extensions: ['.js', '.mjs'],
      packageManager: 'npm',
      buildTool: 'webpack',
      testFramework: 'jest',
    },
    {
      name: 'python',
      version: '3.9.0',
      extensions: ['.py'],
      packageManager: 'pip',
      buildTool: 'setuptools',
      testFramework: 'pytest',
    },
    {
      name: 'java',
      version: '11.0.0',
      extensions: ['.java'],
      packageManager: 'maven',
      buildTool: 'maven',
      testFramework: 'junit',
    },
    {
      name: 'csharp',
      version: '6.0.0',
      extensions: ['.cs'],
      packageManager: 'nuget',
      buildTool: 'dotnet',
      testFramework: 'xunit',
    },
    {
      name: 'go',
      version: '1.19.0',
      extensions: ['.go'],
      packageManager: 'go mod',
      buildTool: 'go build',
      testFramework: 'testing',
    },
  ],

  // SDK generation targets
  targets: [
    {
      language: 'typescript',
      platform: 'node',
      outputDir: './sdks/typescript',
      template: 'typescript-node',
      config: {
        packageName: '@yieldsensei/sdk',
        packageVersion: '1.0.0',
        packageDescription: 'TypeScript SDK for YieldSensei API',
        packageAuthor: 'YieldSensei Team',
        packageLicense: 'MIT',
        packageRepository: 'https://github.com/yieldsensei/sdk-typescript',
        packageHomepage: 'https://yieldsensei.com',
        packageKeywords: ['defi', 'yield', 'optimization', 'api', 'sdk', 'typescript'],
      },
    },
    {
      language: 'javascript',
      platform: 'browser',
      outputDir: './sdks/javascript',
      template: 'javascript-browser',
      config: {
        packageName: '@yieldsensei/sdk-browser',
        packageVersion: '1.0.0',
        packageDescription: 'JavaScript SDK for YieldSensei API (Browser)',
        packageAuthor: 'YieldSensei Team',
        packageLicense: 'MIT',
        packageRepository: 'https://github.com/yieldsensei/sdk-javascript',
        packageHomepage: 'https://yieldsensei.com',
        packageKeywords: ['defi', 'yield', 'optimization', 'api', 'sdk', 'javascript', 'browser'],
      },
    },
    {
      language: 'python',
      platform: 'universal',
      outputDir: './sdks/python',
      template: 'python-universal',
      config: {
        packageName: 'yieldsensei-sdk',
        packageVersion: '1.0.0',
        packageDescription: 'Python SDK for YieldSensei API',
        packageAuthor: 'YieldSensei Team',
        packageLicense: 'MIT',
        packageRepository: 'https://github.com/yieldsensei/sdk-python',
        packageHomepage: 'https://yieldsensei.com',
        packageKeywords: ['defi', 'yield', 'optimization', 'api', 'sdk', 'python'],
      },
    },
  ],

  // SDK generation settings
  generation: {
    enabled: true,
    autoGenerate: true,
    includeExamples: true,
    includeTests: true,
    includeDocumentation: true,
    includeTypes: true,
    includeValidation: true,
    includeRetry: true,
    includeLogging: true,
    includeMetrics: true,
  },
};

// ============================================================================
// DEPRECATION POLICY CONFIGURATION
// ============================================================================

export const deprecationConfig = {
  // Deprecation policy settings
  policy: {
    deprecationPeriod: 365, // days
    sunsetPeriod: 730, // days
    breakingChangeGracePeriod: 90, // days
    notificationChannels: ['email', 'webhook', 'slack', 'discord'],
    autoMigration: false,
    rollbackSupport: true,
  },

  // Notification settings
  notifications: {
    email: {
      enabled: true,
      from: 'noreply@yieldsensei.com',
      template: 'deprecation-notification',
    },
    webhook: {
      enabled: true,
      url: 'https://api.yieldsensei.com/webhooks/deprecation',
      secret: process.env['DEPRECATION_WEBHOOK_SECRET'],
    },
    slack: {
      enabled: true,
      webhookUrl: process.env['SLACK_WEBHOOK_URL'],
      channel: '#api-deprecations',
    },
    discord: {
      enabled: true,
      webhookUrl: process.env['DISCORD_WEBHOOK_URL'],
      channel: 'api-deprecations',
    },
  },

  // Deprecation timeline settings
  timeline: {
    announcementLeadTime: 180, // days
    deprecationLeadTime: 90, // days
    sunsetLeadTime: 30, // days
    migrationSupportPeriod: 365, // days
  },
};

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

export const getDocumentationConfig = () => {
  const env = process.env['NODE_ENV'] || 'development';
  
  return {
    versioning: versioningConfig,
    openApi: {
      ...openApiConfig,
      servers: env === 'production' 
        ? openApiConfig.servers.filter(s => s.url.includes('yieldsensei.com'))
        : openApiConfig.servers,
    },
    graphql: graphqlConfig,
    documentation: documentationConfig,
    playground: playgroundConfig,
    sdk: sdkConfig,
    deprecation: deprecationConfig,
    env,
  };
};

export default getDocumentationConfig; 