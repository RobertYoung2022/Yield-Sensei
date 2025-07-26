/**
 * OpenAPI/Swagger Documentation Generator Service
 * Generates comprehensive OpenAPI documentation from route definitions
 */

// Removed unused Express imports
// import { Request, Response, NextFunction } from 'express';
import { OpenApiConfig, ApiEndpoint, ApiSchema, DocumentationError } from '../types';
import { getDocumentationConfig } from '../config/documentation.config';
import Logger from '../../shared/logging/logger';
const logger = Logger.getLogger('openapi-generator');

export class OpenApiGeneratorService {
  private config: OpenApiConfig;
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private schemas: Map<string, ApiSchema> = new Map();
  private tags: Set<string> = new Set();

  constructor() {
    this.config = getDocumentationConfig().openApi;
    this.initializeSchemas();
  }

  /**
   * Initialize common schemas used across the API
   */
  private initializeSchemas(): void {
    // Common response schemas
    this.addSchema('Error', {
      type: 'object',
      properties: {
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Invalid request parameters' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string', example: 'req_123456789' },
          },
          required: ['code', 'message', 'timestamp'],
        },
      },
      required: ['error'],
    });

    this.addSchema('Success', {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'object' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        requestId: { type: 'string', example: 'req_123456789' },
      },
      required: ['success', 'timestamp'],
    });

    this.addSchema('Pagination', {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, example: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, example: 20 },
        total: { type: 'integer', example: 150 },
        totalPages: { type: 'integer', example: 8 },
        hasNext: { type: 'boolean', example: true },
        hasPrev: { type: 'boolean', example: false },
      },
      required: ['page', 'limit', 'total', 'totalPages'],
    });

    // User-related schemas
    this.addSchema('User', {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        username: { type: 'string', example: 'johndoe' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        avatar: { type: 'string', format: 'uri', example: 'https://example.com/avatar.jpg' },
        status: { type: 'string', enum: ['active', 'inactive', 'suspended'], example: 'active' },
        roles: { type: 'array', items: { type: 'string' }, example: ['user'] },
        preferences: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        lastLoginAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'email', 'username', 'status', 'createdAt'],
    });

    // Portfolio-related schemas
    this.addSchema('Portfolio', {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'My DeFi Portfolio' },
        description: { type: 'string' },
        totalValue: { type: 'number', format: 'float', example: 50000.00 },
        currency: { type: 'string', example: 'USD' },
        riskScore: { type: 'number', minimum: 0, maximum: 100, example: 65 },
        yieldRate: { type: 'number', format: 'float', example: 12.5 },
        positions: { type: 'array', items: { $ref: '#/components/schemas/Position' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'userId', 'name', 'totalValue', 'currency'],
    });

    this.addSchema('Position', {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        portfolioId: { type: 'string', format: 'uuid' },
        protocol: { type: 'string', example: 'Aave' },
        asset: { type: 'string', example: 'USDC' },
        amount: { type: 'number', format: 'float', example: 10000.00 },
        value: { type: 'number', format: 'float', example: 10000.00 },
        yieldRate: { type: 'number', format: 'float', example: 8.5 },
        riskScore: { type: 'number', minimum: 0, maximum: 100, example: 45 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'portfolioId', 'protocol', 'asset', 'amount', 'value'],
    });

    // Market data schemas
    this.addSchema('MarketData', {
      type: 'object',
      properties: {
        symbol: { type: 'string', example: 'ETH/USD' },
        price: { type: 'number', format: 'float', example: 3500.00 },
        change24h: { type: 'number', format: 'float', example: 2.5 },
        changePercent24h: { type: 'number', format: 'float', example: 0.71 },
        volume24h: { type: 'number', format: 'float', example: 1500000000 },
        marketCap: { type: 'number', format: 'float', example: 420000000000 },
        high24h: { type: 'number', format: 'float', example: 3550.00 },
        low24h: { type: 'number', format: 'float', example: 3450.00 },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['symbol', 'price', 'timestamp'],
    });

    // Yield opportunity schemas
    this.addSchema('YieldOpportunity', {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        protocol: { type: 'string', example: 'Aave' },
        asset: { type: 'string', example: 'USDC' },
        yieldRate: { type: 'number', format: 'float', example: 12.5 },
        apy: { type: 'number', format: 'float', example: 13.2 },
        riskScore: { type: 'number', minimum: 0, maximum: 100, example: 35 },
        liquidity: { type: 'number', format: 'float', example: 50000000 },
        minDeposit: { type: 'number', format: 'float', example: 100 },
        maxDeposit: { type: 'number', format: 'float', example: 1000000 },
        lockPeriod: { type: 'integer', example: 0 },
        fees: { type: 'object' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'protocol', 'asset', 'yieldRate', 'riskScore'],
    });

    // Security alert schemas
    this.addSchema('SecurityAlert', {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: ['exploit', 'vulnerability', 'anomaly', 'risk'], example: 'exploit' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], example: 'high' },
        title: { type: 'string', example: 'Potential exploit detected in protocol' },
        description: { type: 'string' },
        protocol: { type: 'string', example: 'Compound' },
        affectedAssets: { type: 'array', items: { type: 'string' } },
        recommendation: { type: 'string' },
        status: { type: 'string', enum: ['active', 'resolved', 'false_positive'], example: 'active' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'type', 'severity', 'title', 'status'],
    });
  }

  /**
   * Add a schema to the documentation
   */
  public addSchema(name: string, schema: ApiSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Add an endpoint to the documentation
   */
  public addEndpoint(endpoint: ApiEndpoint): void {
    const key = `${endpoint.method.toUpperCase()}:${endpoint.path}`;
    this.endpoints.set(key, endpoint);
    
    // Add tags to the set
    endpoint.tags.forEach(tag => this.tags.add(tag));
  }

  /**
   * Generate OpenAPI specification
   */
  public generateSpec(): any {
    try {
      const spec = {
        openapi: '3.0.3',
        info: {
          title: this.config.title,
          version: this.config.version,
          description: this.config.description,
          contact: this.config.contact,
          license: this.config.license,
        },
        servers: this.config.servers,
        paths: this.generatePaths(),
        components: {
          schemas: this.generateSchemas(),
          securitySchemes: this.config.securitySchemes,
          responses: this.generateCommonResponses(),
          parameters: this.generateCommonParameters(),
        },
        tags: this.generateTags(),
        externalDocs: this.config.externalDocs,
      };

      logger.info('OpenAPI specification generated successfully', {
        endpoints: this.endpoints.size,
        schemas: this.schemas.size,
        tags: this.tags.size,
      });

      return spec;
    } catch (error) {
      logger.error('Failed to generate OpenAPI specification', { error });
      throw new DocumentationError(
        'Failed to generate OpenAPI specification',
        'OPENAPI_GENERATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate paths object from endpoints
   */
  private generatePaths(): Record<string, any> {
    const paths: Record<string, any> = {};

    for (const [_key, endpoint] of this.endpoints) {
      const path = endpoint.path;
      
      if (!paths[path]) {
        paths[path] = {};
      }

      const method = endpoint.method.toLowerCase();
      paths[path][method] = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: this.generateParameters(endpoint.parameters),
        requestBody: endpoint.requestBody ? this.generateRequestBody(endpoint.requestBody) : undefined,
        responses: this.generateResponses(endpoint.responses),
        security: endpoint.security,
        deprecated: endpoint.deprecated,
        ...(endpoint.deprecatedSince && { 'x-deprecated-since': endpoint.deprecatedSince }),
        ...(endpoint.sunsetDate && { 'x-sunset-date': endpoint.sunsetDate }),
      };
    }

    return paths;
  }

  /**
   * Generate parameters array
   */
  private generateParameters(parameters: any[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      schema: param.schema,
      example: param.example,
      deprecated: param.deprecated,
    }));
  }

  /**
   * Generate request body object
   */
  private generateRequestBody(requestBody: any): any {
    return {
      description: requestBody.description,
      required: requestBody.required,
      content: requestBody.content,
    };
  }

  /**
   * Generate responses object
   */
  private generateResponses(responses: Record<string, any>): Record<string, any> {
    const generatedResponses: Record<string, any> = {};

    for (const [code, response] of Object.entries(responses)) {
      generatedResponses[code] = {
        description: response.description,
        content: response.content,
        headers: response.headers,
        links: response.links,
      };
    }

    return generatedResponses;
  }

  /**
   * Generate schemas object
   */
  private generateSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {};

    for (const [name, schema] of this.schemas) {
      schemas[name] = schema;
    }

    return schemas;
  }

  /**
   * Generate common responses
   */
  private generateCommonResponses(): Record<string, any> {
    return {
      '400': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
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
      '403': {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      '404': {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      '429': {
        description: 'Too Many Requests',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
        headers: {
          'X-RateLimit-Limit': {
            description: 'Rate limit limit',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Remaining': {
            description: 'Rate limit remaining',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Reset': {
            description: 'Rate limit reset time',
            schema: { type: 'integer' },
          },
        },
      },
      '500': {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    };
  }

  /**
   * Generate common parameters
   */
  private generateCommonParameters(): Record<string, any> {
    return {
      'PaginationPage': {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
          example: 1,
        },
      },
      'PaginationLimit': {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          example: 20,
        },
      },
      'ApiVersion': {
        name: 'version',
        in: 'query',
        description: 'API version',
        required: false,
        schema: {
          type: 'string',
          enum: ['v1', 'v2'],
          default: 'v1',
          example: 'v1',
        },
      },
    };
  }

  /**
   * Generate tags array
   */
  private generateTags(): any[] {
    return Array.from(this.tags).map(tagName => {
      const tag = this.config.tags.find(t => t.name === tagName);
      return {
        name: tagName,
        description: tag?.description || `${tagName} operations`,
        ...(tag?.externalDocs && { externalDocs: tag.externalDocs }),
      };
    });
  }

  /**
   * Export specification to different formats
   */
  public async exportSpec(format: 'json' | 'yaml' | 'html' | 'pdf' = 'json'): Promise<string | Buffer> {
    const spec = this.generateSpec();

    switch (format) {
      case 'json':
        return JSON.stringify(spec, null, 2);

      case 'yaml':
        // Note: In a real implementation, you'd use a YAML library like 'js-yaml'
        const yaml = require('js-yaml');
        return yaml.dump(spec);

      case 'html':
        return this.generateHtml(spec);

      case 'pdf':
        return this.generatePdf(spec);

      default:
        throw new DocumentationError(
          `Unsupported export format: ${format}`,
          'UNSUPPORTED_FORMAT',
          { format }
        );
    }
  }

  /**
   * Generate HTML documentation
   */
  private async generateHtml(spec: any): Promise<string> {
    // In a real implementation, you'd use a library like 'swagger-ui-express'
    // or generate custom HTML with the specification
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${this.config.title} - API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                spec: ${JSON.stringify(spec)},
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`;
  }

  /**
   * Generate PDF documentation
   */
  private async generatePdf(spec: any): Promise<Buffer> {
    // In a real implementation, you'd use a library like 'puppeteer'
    // to convert HTML to PDF
    const _html = await this.generateHtml(spec);
    
    // This is a placeholder - in reality you'd use puppeteer or similar
    throw new DocumentationError(
      'PDF generation not implemented',
      'PDF_GENERATION_NOT_IMPLEMENTED'
    );
  }

  /**
   * Validate the generated specification
   */
  public validateSpec(spec: any): boolean {
    try {
      // Basic validation - in a real implementation you'd use a proper OpenAPI validator
      const required = ['openapi', 'info', 'paths'];
      for (const field of required) {
        if (!spec[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (!spec.info.title || !spec.info.version) {
        throw new Error('Missing required info fields: title, version');
      }

      return true;
    } catch (error) {
      logger.error('OpenAPI specification validation failed', { error });
      return false;
    }
  }

  /**
   * Get documentation statistics
   */
  public getStats(): any {
    return {
      totalEndpoints: this.endpoints.size,
      totalSchemas: this.schemas.size,
      totalTags: this.tags.size,
      endpointsByMethod: this.getEndpointsByMethod(),
      endpointsByTag: this.getEndpointsByTag(),
    };
  }

  /**
   * Get endpoints grouped by HTTP method
   */
  private getEndpointsByMethod(): Record<string, number> {
    const methods: Record<string, number> = {};
    
    for (const [key] of this.endpoints) {
      const parts = key.split(':');
      const method = parts[0];
      if (method) {
        methods[method] = (methods[method] || 0) + 1;
      }
    }

    return methods;
  }

  /**
   * Get endpoints grouped by tag
   */
  private getEndpointsByTag(): Record<string, number> {
    const tags: Record<string, number> = {};
    
    for (const endpoint of this.endpoints.values()) {
      for (const tag of endpoint.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }

    return tags;
  }
}

export default OpenApiGeneratorService; 