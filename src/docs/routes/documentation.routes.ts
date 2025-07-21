/**
 * Documentation Routes
 * Express routes for API documentation, versioning, and playground
 */

import { Router, Request, Response } from 'express';
import OpenApiGeneratorService from '../services/openapi-generator.service';
import VersioningService from '../services/versioning.service';
import PlaygroundService from '../services/playground.service';
import SdkGeneratorService from '../services/sdk-generator.service';
import { getDocumentationConfig } from '../config/documentation.config';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('DocumentationRoutes');
const router = Router();

// Initialize services
const openApiGenerator = new OpenApiGeneratorService();
const versioningService = new VersioningService();
const playgroundService = new PlaygroundService();
const sdkGenerator = new SdkGeneratorService();

// ============================================================================
// OPENAPI DOCUMENTATION ROUTES
// ============================================================================

/**
 * GET /docs/openapi
 * Get OpenAPI specification in JSON format
 */
router.get('/openapi', async (req: Request, res: Response) => {
  try {
    const spec = openApiGenerator.generateSpec();
    res.json(spec);
  } catch (error) {
    logger.error('Failed to generate OpenAPI spec', { error });
    res.status(500).json({
      error: {
        code: 'OPENAPI_GENERATION_FAILED',
        message: 'Failed to generate OpenAPI specification',
      },
    });
  }
});

/**
 * GET /docs/openapi.yaml
 * Get OpenAPI specification in YAML format
 */
router.get('/openapi.yaml', async (req: Request, res: Response) => {
  try {
    const yaml = await openApiGenerator.exportSpec('yaml');
    res.set('Content-Type', 'application/x-yaml');
    res.send(yaml);
  } catch (error) {
    logger.error('Failed to export OpenAPI spec as YAML', { error });
    res.status(500).json({
      error: {
        code: 'YAML_EXPORT_FAILED',
        message: 'Failed to export OpenAPI specification as YAML',
      },
    });
  }
});

/**
 * GET /docs/openapi.html
 * Get interactive OpenAPI documentation
 */
router.get('/openapi.html', async (req: Request, res: Response) => {
  try {
    const html = await openApiGenerator.exportSpec('html');
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Failed to export OpenAPI spec as HTML', { error });
    res.status(500).json({
      error: {
        code: 'HTML_EXPORT_FAILED',
        message: 'Failed to export OpenAPI specification as HTML',
      },
    });
  }
});

/**
 * GET /docs/openapi.pdf
 * Get OpenAPI specification as PDF
 */
router.get('/openapi.pdf', async (req: Request, res: Response) => {
  try {
    const pdf = await openApiGenerator.exportSpec('pdf');
    res.set('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (error) {
    logger.error('Failed to export OpenAPI spec as PDF', { error });
    res.status(500).json({
      error: {
        code: 'PDF_EXPORT_FAILED',
        message: 'Failed to export OpenAPI specification as PDF',
      },
    });
  }
});

/**
 * GET /docs/stats
 * Get documentation statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const openApiStats = openApiGenerator.getStats();
    const versioningStats = versioningService.getVersionStats();
    const playgroundStats = playgroundService.getStats();
    const sdkStats = sdkGenerator.getStats();

    res.json({
      success: true,
      data: {
        openApi: openApiStats,
        versioning: versioningStats,
        playground: playgroundStats,
        sdk: sdkStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get documentation stats', { error });
    res.status(500).json({
      error: {
        code: 'STATS_GENERATION_FAILED',
        message: 'Failed to generate documentation statistics',
      },
    });
  }
});

// ============================================================================
// API VERSIONING ROUTES
// ============================================================================

/**
 * GET /docs/versions
 * Get all API versions
 */
router.get('/versions', (req: Request, res: Response) => {
  try {
    const versions = versioningService.getAllVersions();
    const supportedVersions = versioningService.getSupportedVersions();
    const defaultVersion = versioningService.getDefaultVersion();

    res.json({
      success: true,
      data: {
        versions,
        supportedVersions,
        defaultVersion,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get API versions', { error });
    res.status(500).json({
      error: {
        code: 'VERSIONS_FETCH_FAILED',
        message: 'Failed to fetch API versions',
      },
    });
  }
});

/**
 * GET /docs/versions/:version
 * Get specific API version information
 */
router.get('/versions/:version', (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const versionInfo = versioningService.getVersion(version);

    if (!versionInfo) {
      return res.status(404).json({
        error: {
          code: 'VERSION_NOT_FOUND',
          message: `API version '${version}' not found`,
        },
      });
    }

    const breakingChanges = versioningService.getBreakingChanges(version);
    const migrationGuide = versioningService.getMigrationGuide(version);
    const isDeprecated = versioningService.isVersionDeprecated(version);
    const isSunset = versioningService.isVersionSunset(version);

    res.json({
      success: true,
      data: {
        ...versionInfo,
        breakingChanges,
        migrationGuide,
        isDeprecated,
        isSunset,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get version info', { version: req.params.version, error });
    res.status(500).json({
      error: {
        code: 'VERSION_INFO_FETCH_FAILED',
        message: 'Failed to fetch version information',
      },
    });
  }
});

/**
 * GET /docs/versions/:version1/compare/:version2
 * Compare two API versions
 */
router.get('/versions/:version1/compare/:version2', (req: Request, res: Response) => {
  try {
    const { version1, version2 } = req.params;
    const comparison = versioningService.compareVersions(version1, version2);

    res.json({
      success: true,
      data: {
        ...comparison,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to compare versions', { 
      version1: req.params.version1, 
      version2: req.params.version2, 
      error 
    });
    res.status(500).json({
      error: {
        code: 'VERSION_COMPARISON_FAILED',
        message: 'Failed to compare API versions',
      },
    });
  }
});

/**
 * POST /docs/versions/:version/deprecate
 * Mark a version as deprecated
 */
router.post('/versions/:version/deprecate', (req: Request, res: Response) => {
  try {
    const { version } = req.params;
    const { sunsetDate, reason } = req.body;

    // In a real implementation, you'd update the version status
    logger.info('Version deprecation requested', { version, sunsetDate, reason });

    res.json({
      success: true,
      data: {
        message: `Version '${version}' marked as deprecated`,
        sunsetDate,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to deprecate version', { version: req.params.version, error });
    res.status(500).json({
      error: {
        code: 'VERSION_DEPRECATION_FAILED',
        message: 'Failed to deprecate API version',
      },
    });
  }
});

// ============================================================================
// API PLAYGROUND ROUTES
// ============================================================================

/**
 * GET /docs/playgrounds
 * Get all available playgrounds
 */
router.get('/playgrounds', (req: Request, res: Response) => {
  try {
    const playgrounds = playgroundService.getAllPlaygrounds();

    res.json({
      success: true,
      data: {
        playgrounds,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get playgrounds', { error });
    res.status(500).json({
      error: {
        code: 'PLAYGROUNDS_FETCH_FAILED',
        message: 'Failed to fetch playgrounds',
      },
    });
  }
});

/**
 * GET /docs/playgrounds/:id
 * Get specific playground
 */
router.get('/playgrounds/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const playground = playgroundService.getPlayground(id);

    if (!playground) {
      return res.status(404).json({
        error: {
          code: 'PLAYGROUND_NOT_FOUND',
          message: `Playground '${id}' not found`,
        },
      });
    }

    res.json({
      success: true,
      data: {
        playground,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get playground', { id: req.params.id, error });
    res.status(500).json({
      error: {
        code: 'PLAYGROUND_FETCH_FAILED',
        message: 'Failed to fetch playground',
      },
    });
  }
});

/**
 * GET /docs/examples
 * Get all examples
 */
router.get('/examples', (req: Request, res: Response) => {
  try {
    const { category, tag } = req.query;
    let examples;

    if (category) {
      examples = playgroundService.getExamplesByCategory(category as string);
    } else if (tag) {
      examples = playgroundService.getExamplesByTag(tag as string);
    } else {
      examples = Array.from(playgroundService['examples'].values());
    }

    res.json({
      success: true,
      data: {
        examples,
        filters: { category, tag },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get examples', { error });
    res.status(500).json({
      error: {
        code: 'EXAMPLES_FETCH_FAILED',
        message: 'Failed to fetch examples',
      },
    });
  }
});

/**
 * GET /docs/examples/:id
 * Get specific example
 */
router.get('/examples/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const example = playgroundService.getExample(id);

    if (!example) {
      return res.status(404).json({
        error: {
          code: 'EXAMPLE_NOT_FOUND',
          message: `Example '${id}' not found`,
        },
      });
    }

    res.json({
      success: true,
      data: {
        example,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get example', { id: req.params.id, error });
    res.status(500).json({
      error: {
        code: 'EXAMPLE_FETCH_FAILED',
        message: 'Failed to fetch example',
      },
    });
  }
});

/**
 * POST /docs/playgrounds/:id/execute
 * Execute a playground request
 */
router.post('/playgrounds/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { method, path, headers, params, body } = req.body;

    const result = await playgroundService.executeRequest(id, {
      method,
      path,
      headers,
      params,
      body,
    });

    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to execute playground request', { 
      id: req.params.id, 
      error 
    });
    res.status(500).json({
      error: {
        code: 'PLAYGROUND_EXECUTION_FAILED',
        message: 'Failed to execute playground request',
      },
    });
  }
});

// ============================================================================
// SDK GENERATION ROUTES
// ============================================================================

/**
 * GET /docs/sdks
 * Get all available SDKs
 */
router.get('/sdks', (req: Request, res: Response) => {
  try {
    const targets = sdkGenerator['config'].targets;
    const generatedSdks = sdkGenerator.getAllGeneratedSdks();

    res.json({
      success: true,
      data: {
        targets,
        generatedSdks,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get SDKs', { error });
    res.status(500).json({
      error: {
        code: 'SDKS_FETCH_FAILED',
        message: 'Failed to fetch SDKs',
      },
    });
  }
});

/**
 * POST /docs/sdks/generate
 * Generate SDKs for all targets
 */
router.post('/sdks/generate', async (req: Request, res: Response) => {
  try {
    const { openApiSpec } = req.body;
    const results = await sdkGenerator.generateAllSdks(openApiSpec);

    res.json({
      success: true,
      data: {
        results: Object.fromEntries(results),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to generate SDKs', { error });
    res.status(500).json({
      error: {
        code: 'SDK_GENERATION_FAILED',
        message: 'Failed to generate SDKs',
      },
    });
  }
});

/**
 * POST /docs/sdks/:language/generate
 * Generate SDK for specific language
 */
router.post('/sdks/:language/generate', async (req: Request, res: Response) => {
  try {
    const { language } = req.params;
    const { openApiSpec } = req.body;

    const target = sdkGenerator['config'].targets.find(t => t.language === language);
    if (!target) {
      return res.status(404).json({
        error: {
          code: 'SDK_TARGET_NOT_FOUND',
          message: `SDK target for language '${language}' not found`,
        },
      });
    }

    const outputPath = await sdkGenerator.generateSdk(target, openApiSpec);

    res.json({
      success: true,
      data: {
        language,
        outputPath,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to generate SDK', { 
      language: req.params.language, 
      error 
    });
    res.status(500).json({
      error: {
        code: 'SDK_GENERATION_FAILED',
        message: 'Failed to generate SDK',
      },
    });
  }
});

// ============================================================================
// DOCUMENTATION HEALTH AND STATUS ROUTES
// ============================================================================

/**
 * GET /docs/health
 * Get documentation system health
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const config = getDocumentationConfig();
    const openApiValid = openApiGenerator.validateSpec(openApiGenerator.generateSpec());
    const versioningValid = versioningService.validateConfiguration();
    const playgroundValid = playgroundService.validateConfiguration();
    const sdkValid = sdkGenerator.validateConfiguration();

    const health = {
      status: 'healthy',
      services: {
        openApi: {
          status: openApiValid ? 'healthy' : 'unhealthy',
          errors: openApiValid ? [] : ['OpenAPI specification validation failed'],
        },
        versioning: {
          status: versioningValid ? 'healthy' : 'unhealthy',
          errors: versioningValid ? [] : ['Versioning configuration validation failed'],
        },
        playground: {
          status: playgroundValid ? 'healthy' : 'unhealthy',
          errors: playgroundValid ? [] : ['Playground configuration validation failed'],
        },
        sdk: {
          status: sdkValid ? 'healthy' : 'unhealthy',
          errors: sdkValid ? [] : ['SDK configuration validation failed'],
        },
      },
      timestamp: new Date().toISOString(),
      version: config.openApi.version,
    };

    const allHealthy = openApiValid && versioningValid && playgroundValid && sdkValid;
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: allHealthy,
      data: health,
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Documentation system health check failed',
      },
    });
  }
});

/**
 * GET /docs/config
 * Get documentation configuration
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = getDocumentationConfig();
    
    // Remove sensitive information
    const safeConfig = {
      versioning: config.versioning,
      openApi: {
        title: config.openApi.title,
        version: config.openApi.version,
        servers: config.openApi.servers,
        tags: config.openApi.tags,
      },
      documentation: config.documentation,
      playground: config.playground,
      sdk: {
        metadata: config.sdk.metadata,
        languages: config.sdk.languages,
        targets: config.sdk.targets,
      },
      deprecation: {
        policy: config.deprecation.policy,
        timeline: config.deprecation.timeline,
      },
      env: config.env,
    };

    res.json({
      success: true,
      data: {
        config: safeConfig,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get documentation config', { error });
    res.status(500).json({
      error: {
        code: 'CONFIG_FETCH_FAILED',
        message: 'Failed to fetch documentation configuration',
      },
    });
  }
});

export default router; 