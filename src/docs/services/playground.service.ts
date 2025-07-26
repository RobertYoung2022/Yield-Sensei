/**
 * API Playground Service
 * Provides interactive API testing and documentation interface
 */

import { Request, Response } from 'express';
import { 
  ApiPlayground, 
  PlaygroundConfig, 
  PlaygroundExample, 
  PlaygroundTemplate,
  PlaygroundSettings,
  DocumentationError 
} from '../types';
import { getDocumentationConfig } from '../config/documentation.config';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('PlaygroundService');

export class PlaygroundService {
  private config: PlaygroundConfig;
  private playgrounds: Map<string, ApiPlayground> = new Map();
  private examples: Map<string, PlaygroundExample> = new Map();
  private templates: Map<string, PlaygroundTemplate> = new Map();

  constructor() {
    this.config = getDocumentationConfig().playground;
    this.initializePlaygrounds();
    this.initializeExamples();
    this.initializeTemplates();
  }

  /**
   * Initialize default playgrounds
   */
  private initializePlaygrounds(): void {
    // REST API Playground
    this.addPlayground({
      id: 'rest-api',
      name: 'REST API Playground',
      description: 'Interactive playground for testing REST API endpoints',
      type: 'rest',
      config: {
        baseUrl: 'https://api.yieldsensei.com/v1',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        auth: {
          type: 'bearer',
          token: '',
        },
        timeout: 30000,
        maxRetries: 3,
      },
      examples: [],
      templates: [],
      settings: this.config.defaults,
    });

    // GraphQL Playground
    this.addPlayground({
      id: 'graphql-api',
      name: 'GraphQL API Playground',
      description: 'Interactive playground for testing GraphQL queries and mutations',
      type: 'graphql',
      config: {
        baseUrl: 'https://api.yieldsensei.com/graphql',
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          type: 'bearer',
          token: '',
        },
        timeout: 30000,
        maxRetries: 3,
      },
      examples: [],
      templates: [],
      settings: this.config.defaults,
    });

    // WebSocket Playground
    this.addPlayground({
      id: 'websocket-api',
      name: 'WebSocket API Playground',
      description: 'Interactive playground for testing WebSocket connections',
      type: 'websocket',
      config: {
        baseUrl: 'wss://api.yieldsensei.com/ws',
        headers: {},
        auth: {
          type: 'bearer',
          token: '',
        },
        timeout: 30000,
        maxRetries: 3,
      },
      examples: [],
      templates: [],
      settings: this.config.defaults,
    });
  }

  /**
   * Initialize example requests
   */
  private initializeExamples(): void {
    // Authentication examples
    this.addExample({
      id: 'auth-login',
      name: 'User Login',
      description: 'Authenticate a user and get access token',
      category: 'Authentication',
      method: 'POST',
      path: '/auth/login',
      headers: {
        'Content-Type': 'application/json',
      },
      params: {},
      body: {
        email: 'user@example.com',
        password: 'password123',
      },
      response: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'refresh_token_here',
          expiresIn: 3600,
          user: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            username: 'johndoe',
          },
        },
      },
      tags: ['authentication', 'login'],
    });

    // User profile examples
    this.addExample({
      id: 'user-profile',
      name: 'Get User Profile',
      description: 'Retrieve current user profile information',
      category: 'Users',
      method: 'GET',
      path: '/users/profile',
      headers: {
        'Authorization': 'Bearer {{accessToken}}',
      },
      params: {},
      response: {
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'user@example.com',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
        },
      },
      tags: ['users', 'profile'],
    });

    // Portfolio examples
    this.addExample({
      id: 'portfolio-list',
      name: 'List Portfolios',
      description: 'Get all portfolios for the current user',
      category: 'Portfolio',
      method: 'GET',
      path: '/portfolios',
      headers: {
        'Authorization': 'Bearer {{accessToken}}',
      },
      params: {
        page: 1,
        limit: 20,
      },
      response: {
        success: true,
        data: {
          portfolios: [
            {
              id: 'portfolio-123',
              name: 'My DeFi Portfolio',
              totalValue: 50000.00,
              currency: 'USD',
              riskScore: 65,
              yieldRate: 12.5,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        },
      },
      tags: ['portfolio', 'list'],
    });

    // Yield opportunities examples
    this.addExample({
      id: 'yield-opportunities',
      name: 'Get Yield Opportunities',
      description: 'Find the best yield opportunities across protocols',
      category: 'Yield',
      method: 'GET',
      path: '/yield/opportunities',
      headers: {
        'Authorization': 'Bearer {{accessToken}}',
      },
      params: {
        minYield: 5.0,
        maxRisk: 80,
        protocols: 'aave,compound,uniswap',
      },
      response: {
        success: true,
        data: {
          opportunities: [
            {
              id: 'opp-123',
              protocol: 'Aave',
              asset: 'USDC',
              yieldRate: 12.5,
              apy: 13.2,
              riskScore: 35,
              liquidity: 50000000,
            },
          ],
        },
      },
      tags: ['yield', 'opportunities'],
    });

    // Market data examples
    this.addExample({
      id: 'market-data',
      name: 'Get Market Data',
      description: 'Retrieve real-time market data for assets',
      category: 'Market Data',
      method: 'GET',
      path: '/market/data',
      headers: {
        'Authorization': 'Bearer {{accessToken}}',
      },
      params: {
        symbols: 'ETH/USD,BTC/USD,USDC/USD',
      },
      response: {
        success: true,
        data: {
          'ETH/USD': {
            price: 3500.00,
            change24h: 2.5,
            volume24h: 1500000000,
          },
        },
      },
      tags: ['market', 'data'],
    });

    // GraphQL examples
    this.addExample({
      id: 'graphql-portfolio',
      name: 'GraphQL Portfolio Query',
      description: 'Query portfolio data using GraphQL',
      category: 'GraphQL',
      method: 'POST',
      path: '/graphql',
      headers: {
        'Authorization': 'Bearer {{accessToken}}',
        'Content-Type': 'application/json',
      },
      params: {},
      body: {
        query: `
          query GetPortfolio($id: ID!) {
            portfolio(id: $id) {
              id
              name
              totalValue
              positions {
                id
                protocol
                asset
                amount
                yieldRate
              }
            }
          }
        `,
        variables: {
          id: 'portfolio-123',
        },
      },
      response: {
        data: {
          portfolio: {
            id: 'portfolio-123',
            name: 'My DeFi Portfolio',
            totalValue: 50000.00,
            positions: [
              {
                id: 'pos-123',
                protocol: 'Aave',
                asset: 'USDC',
                amount: 10000.00,
                yieldRate: 8.5,
              },
            ],
          },
        },
      },
      tags: ['graphql', 'portfolio'],
    });

    // WebSocket examples
    this.addExample({
      id: 'websocket-market-data',
      name: 'WebSocket Market Data',
      description: 'Subscribe to real-time market data via WebSocket',
      category: 'WebSocket',
      method: 'WS',
      path: '/ws',
      headers: {
        'Authorization': 'Bearer {{accessToken}}',
      },
      params: {},
      body: {
        type: 'subscribe',
        channel: 'market-data',
        symbols: ['ETH/USD', 'BTC/USD'],
      },
      response: {
        type: 'market-data',
        data: {
          'ETH/USD': {
            price: 3500.00,
            timestamp: '2024-01-01T12:00:00Z',
          },
        },
      },
      tags: ['websocket', 'market-data'],
    });
  }

  /**
   * Initialize request templates
   */
  private initializeTemplates(): void {
    // Authentication template
    this.addTemplate({
      id: 'auth-template',
      name: 'Authentication Template',
      description: 'Template for authenticated requests',
      category: 'Authentication',
      template: `{
  "headers": {
    "Authorization": "Bearer {{accessToken}}",
    "Content-Type": "application/json"
  }
}`,
      variables: [
        {
          name: 'accessToken',
          description: 'JWT access token',
          type: 'string',
          required: true,
        },
      ],
      tags: ['authentication', 'template'],
    });

    // Pagination template
    this.addTemplate({
      id: 'pagination-template',
      name: 'Pagination Template',
      description: 'Template for paginated requests',
      category: 'Common',
      template: `{
  "params": {
    "page": {{page}},
    "limit": {{limit}},
    "sort": "{{sort}}",
    "order": "{{order}}"
  }
}`,
      variables: [
        {
          name: 'page',
          description: 'Page number',
          type: 'number',
          required: false,
          default: 1,
        },
        {
          name: 'limit',
          description: 'Items per page',
          type: 'number',
          required: false,
          default: 20,
        },
        {
          name: 'sort',
          description: 'Sort field',
          type: 'string',
          required: false,
          default: 'createdAt',
        },
        {
          name: 'order',
          description: 'Sort order',
          type: 'string',
          required: false,
          default: 'desc',
          options: ['asc', 'desc'],
        },
      ],
      tags: ['pagination', 'template'],
    });

    // Error handling template
    this.addTemplate({
      id: 'error-handling-template',
      name: 'Error Handling Template',
      description: 'Template for error handling',
      category: 'Common',
      template: `{
  "error": {
    "code": "{{errorCode}}",
    "message": "{{errorMessage}}",
    "details": {{errorDetails}},
    "timestamp": "{{timestamp}}",
    "requestId": "{{requestId}}"
  }
}`,
      variables: [
        {
          name: 'errorCode',
          description: 'Error code',
          type: 'string',
          required: true,
        },
        {
          name: 'errorMessage',
          description: 'Error message',
          type: 'string',
          required: true,
        },
        {
          name: 'errorDetails',
          description: 'Error details',
          type: 'object',
          required: false,
          default: {},
        },
        {
          name: 'timestamp',
          description: 'Error timestamp',
          type: 'string',
          required: true,
        },
        {
          name: 'requestId',
          description: 'Request ID',
          type: 'string',
          required: true,
        },
      ],
      tags: ['error', 'template'],
    });
  }

  /**
   * Add a playground
   */
  public addPlayground(playground: ApiPlayground): void {
    this.playgrounds.set(playground.id, playground);
    logger.info('Added playground', { id: playground.id, name: playground.name });
  }

  /**
   * Get playground by ID
   */
  public getPlayground(id: string): ApiPlayground | undefined {
    return this.playgrounds.get(id);
  }

  /**
   * Get all playgrounds
   */
  public getAllPlaygrounds(): ApiPlayground[] {
    return Array.from(this.playgrounds.values());
  }

  /**
   * Add an example
   */
  public addExample(example: PlaygroundExample): void {
    this.examples.set(example.id, example);
    logger.info('Added example', { id: example.id, name: example.name });
  }

  /**
   * Get example by ID
   */
  public getExample(id: string): PlaygroundExample | undefined {
    return this.examples.get(id);
  }

  /**
   * Get examples by category
   */
  public getExamplesByCategory(category: string): PlaygroundExample[] {
    return Array.from(this.examples.values()).filter(
      example => example.category === category
    );
  }

  /**
   * Get examples by tag
   */
  public getExamplesByTag(tag: string): PlaygroundExample[] {
    return Array.from(this.examples.values()).filter(
      example => example.tags.includes(tag)
    );
  }

  /**
   * Add a template
   */
  public addTemplate(template: PlaygroundTemplate): void {
    this.templates.set(template.id, template);
    logger.info('Added template', { id: template.id, name: template.name });
  }

  /**
   * Get template by ID
   */
  public getTemplate(id: string): PlaygroundTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): PlaygroundTemplate[] {
    return Array.from(this.templates.values()).filter(
      template => template.category === category
    );
  }

  /**
   * Execute a playground request
   */
  public async executeRequest(
    playgroundId: string,
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      params: Record<string, any>;
      body?: any;
    }
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
    timestamp: string;
  }> {
    const playground = this.playgrounds.get(playgroundId);
    if (!playground) {
      throw new DocumentationError(
        `Playground not found: ${playgroundId}`,
        'PLAYGROUND_NOT_FOUND'
      );
    }

    const startTime = Date.now();
    const url = new URL(request.path, playground.config.baseUrl);

    // Add query parameters
    Object.entries(request.params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    try {
      // In a real implementation, you'd make the actual HTTP request
      // For now, we'll simulate a response
      const response = await this.simulateRequest(request, playground.config);

      const duration = Date.now() - startTime;

      logger.info('Playground request executed', {
        playgroundId,
        method: request.method,
        path: request.path,
        status: response.status,
        duration,
      });

      return {
        ...response,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Playground request failed', {
        playgroundId,
        method: request.method,
        path: request.path,
        error,
      });

      throw new DocumentationError(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        'REQUEST_FAILED',
        { error }
      );
    }
  }

  /**
   * Simulate a request (placeholder for actual implementation)
   */
  private async simulateRequest(
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      params: Record<string, any>;
      body?: any;
    },
    config: PlaygroundConfig
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
  }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simulate different responses based on the request
    if (request.path.includes('/auth/login')) {
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '999',
        },
        body: {
          success: true,
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'refresh_token_here',
            expiresIn: 3600,
          },
        },
      };
    }

    if (request.path.includes('/users/profile')) {
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            username: 'johndoe',
          },
        },
      };
    }

    // Default success response
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        success: true,
        data: {
          message: 'Request simulated successfully',
          method: request.method,
          path: request.path,
        },
      },
    };
  }

  /**
   * Get playground statistics
   */
  public getStats(): any {
    return {
      totalPlaygrounds: this.playgrounds.size,
      totalExamples: this.examples.size,
      totalTemplates: this.templates.size,
      examplesByCategory: this.getExamplesByCategoryStats(),
      examplesByTag: this.getExamplesByTagStats(),
      templatesByCategory: this.getTemplatesByCategoryStats(),
    };
  }

  /**
   * Get examples grouped by category
   */
  private getExamplesByCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const example of this.examples.values()) {
      stats[example.category] = (stats[example.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get examples grouped by tag
   */
  private getExamplesByTagStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const example of this.examples.values()) {
      for (const tag of example.tags) {
        stats[tag] = (stats[tag] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Get templates grouped by category
   */
  private getTemplatesByCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const template of this.templates.values()) {
      stats[template.category] = (stats[template.category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Validate playground configuration
   */
  public validateConfiguration(): boolean {
    try {
      // Check if all playgrounds have valid configurations
      for (const [id, playground] of this.playgrounds) {
        if (!playground.config.baseUrl) {
          throw new DocumentationError(
            `Playground ${id} missing baseUrl`,
            'INVALID_PLAYGROUND_CONFIG'
          );
        }

        if (!playground.config.timeout || playground.config.timeout <= 0) {
          throw new DocumentationError(
            `Playground ${id} has invalid timeout`,
            'INVALID_PLAYGROUND_CONFIG'
          );
        }
      }

      return true;
    } catch (error) {
      logger.error('Playground configuration validation failed', { error });
      return false;
    }
  }
}

export default PlaygroundService; 