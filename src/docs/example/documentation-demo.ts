/**
 * API Documentation and Versioning System Demo
 * Comprehensive example showing how to use the documentation system
 */

import OpenApiGeneratorService from '../services/openapi-generator.service';
import VersioningService from '../services/versioning.service';
import PlaygroundService from '../services/playground.service';
import SdkGeneratorService from '../services/sdk-generator.service';
import { getDocumentationConfig } from '../config/documentation.config';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('DocumentationDemo');

export class DocumentationDemo {
  private openApiGenerator: OpenApiGeneratorService;
  private versioningService: VersioningService;
  private playgroundService: PlaygroundService;
  private sdkGenerator: SdkGeneratorService;

  constructor() {
    this.openApiGenerator = new OpenApiGeneratorService();
    this.versioningService = new VersioningService();
    this.playgroundService = new PlaygroundService();
    this.sdkGenerator = new SdkGeneratorService();
  }

  /**
   * Run the complete documentation demo
   */
  public async runDemo(): Promise<void> {
    logger.info('Starting API Documentation and Versioning System Demo');

    try {
      // 1. OpenAPI Documentation Demo
      await this.demoOpenApiGeneration();

      // 2. API Versioning Demo
      await this.demoApiVersioning();

      // 3. API Playground Demo
      await this.demoApiPlayground();

      // 4. SDK Generation Demo
      await this.demoSdkGeneration();

      // 5. Integration Demo
      await this.demoIntegration();

      logger.info('Documentation demo completed successfully');
    } catch (error) {
      logger.error('Documentation demo failed', { error });
      throw error;
    }
  }

  /**
   * Demo OpenAPI documentation generation
   */
  private async demoOpenApiGeneration(): Promise<void> {
    logger.info('=== OpenAPI Documentation Generation Demo ===');

    // Add some example endpoints to the documentation
    this.openApiGenerator.addEndpoint({
      path: '/auth/login',
      method: 'POST',
      summary: 'User Login',
      description: 'Authenticate a user and get access token',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'User email address'
                },
                password: {
                  type: 'string',
                  minLength: 8,
                  description: 'User password'
                }
              },
              required: ['email', 'password']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Success' },
            },
          },
        },
        '401': {
          description: 'Invalid credentials',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
      security: [],
    });

    this.openApiGenerator.addEndpoint({
      path: '/users/profile',
      method: 'GET',
      summary: 'Get User Profile',
      description: 'Retrieve current user profile information',
      tags: ['Users'],
      parameters: [],
      responses: {
        '200': {
          description: 'Profile retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
      security: [['bearerAuth']],
    });

    this.openApiGenerator.addEndpoint({
      path: '/portfolios',
      method: 'GET',
      summary: 'List Portfolios',
      description: 'Get all portfolios for the current user',
      tags: ['Portfolio'],
      parameters: [
        {
          name: 'page',
          in: 'query',
          description: 'Page number',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          description: 'Items per page',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        '200': {
          description: 'Portfolios retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      portfolios: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Portfolio' },
                      },
                      pagination: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
      security: [['bearerAuth']],
    });

    // Generate OpenAPI specification
    const spec = this.openApiGenerator.generateSpec();
    logger.info('OpenAPI specification generated', {
      endpoints: spec.paths ? Object.keys(spec.paths).length : 0,
      schemas: spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0,
    });

    // Export to different formats
    const jsonSpec = await this.openApiGenerator.exportSpec('json');
    const htmlSpec = await this.openApiGenerator.exportSpec('html');

    logger.info('OpenAPI exports completed', {
      jsonLength: typeof jsonSpec === 'string' ? jsonSpec.length : 0,
      htmlLength: typeof htmlSpec === 'string' ? htmlSpec.length : 0,
    });

    // Get statistics
    const stats = this.openApiGenerator.getStats();
    logger.info('OpenAPI statistics', stats);
  }

  /**
   * Demo API versioning functionality
   */
  private async demoApiVersioning(): Promise<void> {
    logger.info('=== API Versioning Demo ===');

    // Get version information
    const versions = this.versioningService.getAllVersions();
    const supportedVersions = this.versioningService.getSupportedVersions();
    const defaultVersion = this.versioningService.getDefaultVersion();

    logger.info('Version information', {
      totalVersions: versions.length,
      supportedVersions,
      defaultVersion,
    });

    // Check version status
    for (const version of versions) {
      const isDeprecated = this.versioningService.isVersionDeprecated(version.version);
      const isSunset = this.versioningService.isVersionSunset(version.version);
      const breakingChanges = this.versioningService.getBreakingChanges(version.version);

      logger.info(`Version ${version.version} status`, {
        status: version.status,
        isDeprecated,
        isSunset,
        breakingChangesCount: breakingChanges.length,
        newFeaturesCount: version.newFeatures.length,
      });
    }

    // Compare versions
    if (versions.length >= 2) {
      const comparison = this.versioningService.compareVersions('v1', 'v2');
      logger.info('Version comparison v1 vs v2', {
        newer: comparison.newer,
        older: comparison.older,
        breakingChangesCount: comparison.breakingChanges.length,
        newFeaturesCount: comparison.newFeatures.length,
      });
    }

    // Add a deprecation policy
    const deprecationPolicy = {
      version: 'v1',
      policy: {
        deprecationPeriod: 365,
        sunsetPeriod: 730,
        breakingChangeGracePeriod: 90,
        notificationChannels: ['email', 'webhook'],
        autoMigration: false,
        rollbackSupport: true,
      },
      notifications: [],
      timeline: {
        deprecationDate: new Date('2024-12-31'),
        sunsetDate: new Date('2025-12-31'),
        breakingChanges: [],
        migrationMilestones: [],
      },
    };

    this.versioningService.addDeprecationPolicy('v1', deprecationPolicy);

    // Schedule a deprecation notification
    const notification = {
      id: 'deprecation-v1-2024',
      type: 'deprecation' as const,
      title: 'API Version v1 Deprecation Notice',
      message: 'API version v1 will be deprecated on December 31, 2024',
      severity: 'warning' as const,
      channels: ['email', 'webhook'],
      schedule: {
        type: 'scheduled' as const,
        startDate: new Date('2024-06-01'),
        times: ['09:00'],
      },
      recipients: ['developers@yieldsensei.com'],
      sent: false,
    };

    this.versioningService.scheduleNotification(notification);

    // Get version statistics
    const stats = this.versioningService.getVersionStats();
    logger.info('Versioning statistics', stats);
  }

  /**
   * Demo API playground functionality
   */
  private async demoApiPlayground(): Promise<void> {
    logger.info('=== API Playground Demo ===');

    // Get playgrounds
    const playgrounds = this.playgroundService.getAllPlaygrounds();
    logger.info('Available playgrounds', {
      count: playgrounds.length,
      types: playgrounds.map(p => p.type),
    });

    // Get examples by category
    const authExamples = this.playgroundService.getExamplesByCategory('Authentication');
    const portfolioExamples = this.playgroundService.getExamplesByCategory('Portfolio');
    const yieldExamples = this.playgroundService.getExamplesByCategory('Yield');

    logger.info('Examples by category', {
      authentication: authExamples.length,
      portfolio: portfolioExamples.length,
      yield: yieldExamples.length,
    });

    // Execute a playground request
    try {
      const result = await this.playgroundService.executeRequest('rest-api', {
        method: 'POST',
        path: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        params: {},
        body: {
          email: 'demo@example.com',
          password: 'demo123',
        },
      });

      logger.info('Playground request executed', {
        status: result.status,
        duration: result.duration,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logger.error('Playground request failed', { error });
    }

    // Get playground statistics
    const stats = this.playgroundService.getStats();
    logger.info('Playground statistics', stats);
  }

  /**
   * Demo SDK generation
   */
  private async demoSdkGeneration(): Promise<void> {
    logger.info('=== SDK Generation Demo ===');

    // Get available templates
    const typescriptTemplates = this.sdkGenerator.getTemplatesByLanguage('typescript');
    const pythonTemplates = this.sdkGenerator.getTemplatesByLanguage('python');

    logger.info('Available SDK templates', {
      typescript: typescriptTemplates.length,
      python: pythonTemplates.length,
    });

    // Generate TypeScript SDK
    try {
      const target = this.sdkGenerator['config'].targets.find(t => t.language === 'typescript');
      if (target) {
        const outputPath = await this.sdkGenerator.generateSdk(target);
        logger.info('TypeScript SDK generated', { outputPath });
      }
    } catch (error) {
      logger.error('TypeScript SDK generation failed', { error });
    }

    // Get generated SDKs
    const generatedSdks = this.sdkGenerator.getAllGeneratedSdks();
    logger.info('Generated SDKs', {
      count: generatedSdks.length,
      languages: generatedSdks.map(sdk => sdk.target.language),
    });

    // Get SDK statistics
    const stats = this.sdkGenerator.getStats();
    logger.info('SDK generation statistics', stats);
  }

  /**
   * Demo integration of all components
   */
  private async demoIntegration(): Promise<void> {
    logger.info('=== Integration Demo ===');

    const config = getDocumentationConfig();

    // Simulate a complete documentation workflow
    logger.info('Documentation system configuration', {
      defaultVersion: config.versioning.defaultVersion,
      supportedVersions: config.versioning.supportedVersions,
      openApiTitle: config.openApi.title,
      openApiVersion: config.openApi.version,
      playgroundEnabled: config.playground.server.enabled,
      sdkGenerationEnabled: config.sdk.generation.enabled,
    });

    // Validate all components
    const openApiValid = this.openApiGenerator.validateSpec(this.openApiGenerator.generateSpec());
    const versioningValid = this.versioningService.validateConfiguration();
    const playgroundValid = this.playgroundService.validateConfiguration();
    const sdkValid = this.sdkGenerator.validateConfiguration();

    logger.info('Component validation results', {
      openApi: openApiValid,
      versioning: versioningValid,
      playground: playgroundValid,
      sdk: sdkValid,
      allValid: openApiValid && versioningValid && playgroundValid && sdkValid,
    });

    // Generate comprehensive documentation report
    const report = {
      timestamp: new Date().toISOString(),
      system: {
        version: config.openApi.version,
        environment: config.env,
        components: {
          openApi: {
            status: openApiValid ? 'healthy' : 'unhealthy',
            stats: this.openApiGenerator.getStats(),
          },
          versioning: {
            status: versioningValid ? 'healthy' : 'unhealthy',
            stats: this.versioningService.getVersionStats(),
          },
          playground: {
            status: playgroundValid ? 'healthy' : 'unhealthy',
            stats: this.playgroundService.getStats(),
          },
          sdk: {
            status: sdkValid ? 'healthy' : 'unhealthy',
            stats: this.sdkGenerator.getStats(),
          },
        },
      },
      features: {
        openApiDocumentation: true,
        apiVersioning: true,
        interactivePlayground: true,
        sdkGeneration: true,
        deprecationManagement: true,
        notificationSystem: true,
      },
      endpoints: {
        openApi: '/docs/openapi',
        playground: '/docs/playgrounds',
        versioning: '/docs/versions',
        sdk: '/docs/sdks',
        health: '/docs/health',
      },
    };

    logger.info('Documentation system integration report', report);

    // Simulate API request with versioning
    const mockRequest = {
      path: '/api/v1/users/profile',
      method: 'GET',
      headers: {
        'X-API-Version': 'v1',
        'Authorization': 'Bearer demo-token',
      },
      query: {},
    };

    const version = this.versioningService.extractVersion(mockRequest as any);
    const isDeprecated = this.versioningService.isVersionDeprecated(version);
    const isSunset = this.versioningService.isVersionSunset(version);

    logger.info('API request simulation', {
      originalPath: mockRequest.path,
      extractedVersion: version,
      isDeprecated,
      isSunset,
      supported: this.versioningService.isVersionSupported(version),
    });

    logger.info('=== Integration Demo Completed ===');
  }

  /**
   * Run a specific demo section
   */
  public async runSection(section: 'openapi' | 'versioning' | 'playground' | 'sdk' | 'integration'): Promise<void> {
    logger.info(`Running documentation demo section: ${section}`);

    switch (section) {
      case 'openapi':
        await this.demoOpenApiGeneration();
        break;
      case 'versioning':
        await this.demoApiVersioning();
        break;
      case 'playground':
        await this.demoApiPlayground();
        break;
      case 'sdk':
        await this.demoSdkGeneration();
        break;
      case 'integration':
        await this.demoIntegration();
        break;
      default:
        throw new Error(`Unknown demo section: ${section}`);
    }

    logger.info(`Demo section ${section} completed`);
  }
}

// Example usage
export async function runDocumentationDemo(): Promise<void> {
  const demo = new DocumentationDemo();
  
  try {
    await demo.runDemo();
    console.log('✅ Documentation demo completed successfully');
  } catch (error) {
    console.error('❌ Documentation demo failed:', error);
    throw error;
  }
}

// Example of running specific sections
export async function runOpenApiDemo(): Promise<void> {
  const demo = new DocumentationDemo();
  await demo.runSection('openapi');
}

export async function runVersioningDemo(): Promise<void> {
  const demo = new DocumentationDemo();
  await demo.runSection('versioning');
}

export async function runPlaygroundDemo(): Promise<void> {
  const demo = new DocumentationDemo();
  await demo.runSection('playground');
}

export async function runSdkDemo(): Promise<void> {
  const demo = new DocumentationDemo();
  await demo.runSection('sdk');
}

export default DocumentationDemo; 