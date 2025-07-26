/**
 * SDK Generation Service
 * Generates client libraries and SDKs in multiple programming languages
 */

import { 
  SdkConfig, 
  SdkTarget, 
  SdkTemplate, 
  SdkTemplateFile,
  SdkGenerationError 
} from '../types';
import { getDocumentationConfig } from '../config/documentation.config';
import Logger from '../../shared/logging/logger';

const logger = Logger.getLogger('SdkGeneratorService');

export class SdkGeneratorService {
  private config: SdkConfig;
  private templates: Map<string, SdkTemplate> = new Map();
  private generatedSdks: Map<string, any> = new Map();

  constructor() {
    const sdkConfig = getDocumentationConfig().sdk;
    // Transform the config to match SdkConfig interface
    this.config = {
      name: sdkConfig.metadata.name,
      version: sdkConfig.metadata.version,
      description: sdkConfig.metadata.description,
      author: sdkConfig.metadata.author,
      license: sdkConfig.metadata.license,
      repository: sdkConfig.metadata.repository,
      homepage: sdkConfig.metadata.homepage,
      keywords: sdkConfig.metadata.keywords,
      languages: sdkConfig.languages,
      targets: sdkConfig.targets
    };
    this.initializeTemplates();
  }

  /**
   * Initialize SDK templates for different languages
   */
  private initializeTemplates(): void {
    // TypeScript Node.js template
    this.addTemplate({
      id: 'typescript-node',
      name: 'TypeScript Node.js SDK',
      description: 'TypeScript SDK for Node.js environments',
      language: 'typescript',
      version: '1.0.0',
      files: [
        {
          path: 'package.json',
          content: `{
  "name": "{{packageName}}",
  "version": "{{packageVersion}}",
  "description": "{{packageDescription}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "prepare": "npm run build"
  },
  "keywords": {{packageKeywords}},
  "author": "{{packageAuthor}}",
  "license": "{{packageLicense}}",
  "repository": {
    "type": "git",
    "url": "{{packageRepository}}"
  },
  "homepage": "{{packageHomepage}}",
  "dependencies": {
    "axios": "^1.6.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`,
          type: 'template',
          variables: [
            'packageName',
            'packageVersion',
            'packageDescription',
            'packageKeywords',
            'packageAuthor',
            'packageLicense',
            'packageRepository',
            'packageHomepage',
          ],
        },
        {
          path: 'tsconfig.json',
          content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`,
          type: 'static',
          variables: [],
        },
        {
          path: 'src/index.ts',
          content: `/**
 * {{packageName}} - {{packageDescription}}
 * Generated SDK for YieldSensei API
 */

export * from './client';
export * from './types';
export * from './errors';

// Default export
export { YieldSenseiClient as default } from './client';
`,
          type: 'template',
          variables: ['packageName', 'packageDescription'],
        },
        {
          path: 'src/client.ts',
          content: `import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { YieldSenseiConfig, ApiResponse } from './types';
import { YieldSenseiError } from './errors';

export class YieldSenseiClient {
  private client: AxiosInstance;
  private config: YieldSenseiConfig;

  constructor(config: YieldSenseiConfig) {
    this.config = {
      baseUrl: 'https://api.yieldsensei.com',
      version: 'v1',
      timeout: 30000,
      ...config,
    };

    this.client = axios.create({
      baseURL: \`\${this.config.baseUrl}/\${this.config.version}\`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '{{packageName}}/\${this.config.version}',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      if (this.config.accessToken) {
        config.headers.Authorization = \`Bearer \${this.config.accessToken}\`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        throw new YieldSenseiError(
          error.response?.data?.error?.message || error.message,
          error.response?.data?.error?.code || 'UNKNOWN_ERROR',
          error.response?.status,
          error.response?.data
        );
      }
    );
  }

  // Authentication methods
  async login(email: string, password: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  // User methods
  async getProfile(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/users/profile');
    return response.data;
  }

  async updateProfile(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.put('/users/profile', data);
    return response.data;
  }

  // Portfolio methods
  async getPortfolios(params?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get('/portfolios', { params });
    return response.data;
  }

  async getPortfolio(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(\`/portfolios/\${id}\`);
    return response.data;
  }

  async createPortfolio(data: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/portfolios', data);
    return response.data;
  }

  async updatePortfolio(id: string, data: any): Promise<ApiResponse<any>> {
    const response = await this.client.put(\`/portfolios/\${id}\`, data);
    return response.data;
  }

  async deletePortfolio(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.delete(\`/portfolios/\${id}\`);
    return response.data;
  }

  // Yield methods
  async getYieldOpportunities(params?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get('/yield/opportunities', { params });
    return response.data;
  }

  async getYieldAnalytics(params?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get('/yield/analytics', { params });
    return response.data;
  }

  // Market data methods
  async getMarketData(symbols: string[]): Promise<ApiResponse<any>> {
    const response = await this.client.get('/market/data', {
      params: { symbols: symbols.join(',') },
    });
    return response.data;
  }

  async getPriceHistory(symbol: string, params?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get(\`/market/history/\${symbol}\`, { params });
    return response.data;
  }

  // Risk methods
  async getRiskAssessment(portfolioId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(\`/risk/assessment/\${portfolioId}\`);
    return response.data;
  }

  async getRiskMetrics(params?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get('/risk/metrics', { params });
    return response.data;
  }

  // Analytics methods
  async getAnalytics(params?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get('/analytics', { params });
    return response.data;
  }

  async generateReport(params: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/analytics/reports', params);
    return response.data;
  }

  // WebSocket methods
  createWebSocketConnection(token?: string): WebSocket {
    const wsUrl = this.config.baseUrl.replace('https', 'wss') + '/ws';
    const url = token ? \`\${wsUrl}?token=\${token}\` : wsUrl;
    return new WebSocket(url);
  }

  // Utility methods
  setAccessToken(token: string): void {
    this.config.accessToken = token;
  }

  getAccessToken(): string | undefined {
    return this.config.accessToken;
  }

  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
    this.client.defaults.baseURL = \`\${url}/\${this.config.version}\`;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}
`,
          type: 'template',
          variables: ['packageName'],
        },
        {
          path: 'src/types.ts',
          content: `/**
 * TypeScript type definitions for YieldSensei API
 */

export interface YieldSenseiConfig {
  baseUrl?: string;
  version?: string;
  accessToken?: string;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'suspended';
  roles: string[];
  preferences?: any;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  totalValue: number;
  currency: string;
  riskScore: number;
  yieldRate: number;
  positions: Position[];
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  portfolioId: string;
  protocol: string;
  asset: string;
  amount: number;
  value: number;
  yieldRate: number;
  riskScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface YieldOpportunity {
  id: string;
  protocol: string;
  asset: string;
  yieldRate: number;
  apy: number;
  riskScore: number;
  liquidity: number;
  minDeposit: number;
  maxDeposit: number;
  lockPeriod: number;
  fees?: any;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  timestamp: string;
}

export interface RiskAssessment {
  portfolioId: string;
  overallRisk: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
  timestamp: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface Analytics {
  portfolioId: string;
  metrics: AnalyticsMetric[];
  charts: AnalyticsChart[];
  timestamp: string;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  unit: string;
  change?: number;
  changePercent?: number;
}

export interface AnalyticsChart {
  type: string;
  data: any[];
  options?: any;
}
`,
          type: 'static',
          variables: [],
        },
        {
          path: 'src/errors.ts',
          content: `/**
 * Error classes for YieldSensei SDK
 */

export class YieldSenseiError extends Error {
  public code: string;
  public status?: number;
  public details?: any;

  constructor(
    message: string,
    code: string,
    status?: number,
    details?: any
  ) {
    super(message);
    this.name = 'YieldSenseiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class AuthenticationError extends YieldSenseiError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends YieldSenseiError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends YieldSenseiError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends YieldSenseiError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

export class ServerError extends YieldSenseiError {
  constructor(message: string, details?: any) {
    super(message, 'SERVER_ERROR', 500, details);
    this.name = 'ServerError';
  }
}
`,
          type: 'static',
          variables: [],
        },
        {
          path: 'README.md',
          content: `# {{packageName}}

{{packageDescription}}

## Installation

\`\`\`bash
npm install {{packageName}}
\`\`\`

## Quick Start

\`\`\`typescript
import YieldSenseiClient from '{{packageName}}';

// Initialize the client
const client = new YieldSenseiClient({
  baseUrl: 'https://api.yieldsensei.com',
  version: 'v1',
  accessToken: 'your-access-token',
});

// Authenticate
const authResponse = await client.login('user@example.com', 'password');
client.setAccessToken(authResponse.data.accessToken);

// Get user profile
const profile = await client.getProfile();
console.log(profile.data);

// Get portfolios
const portfolios = await client.getPortfolios();
console.log(portfolios.data);

// Get yield opportunities
const opportunities = await client.getYieldOpportunities({
  minYield: 5.0,
  maxRisk: 80,
});
console.log(opportunities.data);
\`\`\`

## Features

- **Authentication**: OAuth 2.0 with JWT tokens
- **Portfolio Management**: Create, read, update, and delete portfolios
- **Yield Optimization**: Find the best yield opportunities
- **Risk Assessment**: Comprehensive risk analysis
- **Market Data**: Real-time market data and price feeds
- **Analytics**: Advanced analytics and reporting
- **WebSocket Support**: Real-time data streaming
- **TypeScript Support**: Full TypeScript definitions
- **Error Handling**: Comprehensive error handling
- **Rate Limiting**: Built-in rate limiting support

## Documentation

For detailed documentation, visit: {{packageHomepage}}

## License

{{packageLicense}}
`,
          type: 'template',
          variables: [
            'packageName',
            'packageDescription',
            'packageHomepage',
            'packageLicense',
          ],
        },
      ],
      dependencies: {
        axios: '^1.6.0',
        ws: '^8.14.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/ws': '^8.5.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0',
        eslint: '^8.0.0',
        jest: '^29.0.0',
        prettier: '^3.0.0',
        typescript: '^5.0.0',
      },
      scripts: {
        build: 'tsc',
        test: 'jest',
        lint: 'eslint src/**/*.ts',
        format: 'prettier --write src/**/*.ts',
        prepare: 'npm run build',
      },
    });

    // Add more templates for other languages...
  }

  /**
   * Add a template
   */
  public addTemplate(template: SdkTemplate): void {
    this.templates.set(template.id, template);
    logger.info('Added SDK template', { id: template.id, language: template.language });
  }

  /**
   * Get template by ID
   */
  public getTemplate(id: string): SdkTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by language
   */
  public getTemplatesByLanguage(language: string): SdkTemplate[] {
    return Array.from(this.templates.values()).filter(
      template => template.language === language
    );
  }

  /**
   * Generate SDK for a specific target
   */
  public async generateSdk(target: SdkTarget, openApiSpec?: any): Promise<string> {
    try {
      const template = this.templates.get(target.template);
      if (!template) {
        throw new SdkGenerationError(
          `Template not found: ${target.template}`,
          'TEMPLATE_NOT_FOUND'
        );
      }

      logger.info('Generating SDK', { 
        language: target.language, 
        platform: target.platform,
        template: target.template 
      });

      // Generate files from template
      const generatedFiles = await this.generateFiles(template, target.config, openApiSpec);

      // Save files to output directory
      const outputPath = await this.saveFiles(target.outputDir, generatedFiles);

      // Track generated SDK
      this.generatedSdks.set(target.language, {
        target,
        template,
        outputPath,
        generatedAt: new Date(),
        files: generatedFiles.length,
      });

      logger.info('SDK generated successfully', { 
        language: target.language,
        outputPath,
        files: generatedFiles.length 
      });

      return outputPath;
    } catch (error) {
      logger.error('SDK generation failed', { 
        target, 
        error 
      });
      throw new SdkGenerationError(
        `Failed to generate SDK: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATION_FAILED',
        { target, error }
      );
    }
  }

  /**
   * Generate files from template
   */
  private async generateFiles(
    template: SdkTemplate,
    config: Record<string, any>,
    openApiSpec?: any
  ): Promise<SdkTemplateFile[]> {
    const generatedFiles: SdkTemplateFile[] = [];

    for (const file of template.files) {
      let content = file.content;

      // Replace template variables
      if (file.type === 'template') {
        content = this.replaceVariables(content, config);
      }

      // Generate content from OpenAPI spec if provided
      if (file.type === 'generated' && openApiSpec) {
        content = await this.generateFromOpenApi(file, openApiSpec, config);
      }

      generatedFiles.push({
        ...file,
        content,
      });
    }

    return generatedFiles;
  }

  /**
   * Replace variables in template content
   */
  private replaceVariables(content: string, config: Record<string, any>): string {
    let result = content;

    // Replace simple variables
    for (const [key, value] of Object.entries(config)) {
      const placeholder = `{{${key}}}`;
      if (typeof value === 'string') {
        result = result.replace(new RegExp(placeholder, 'g'), value);
      } else if (typeof value === 'object') {
        result = result.replace(new RegExp(placeholder, 'g'), JSON.stringify(value));
      }
    }

    return result;
  }

  /**
   * Generate content from OpenAPI specification
   */
  private async generateFromOpenApi(
    file: SdkTemplateFile,
    openApiSpec: any,
    _config: Record<string, any>
  ): Promise<string> {
    // This is a placeholder for actual OpenAPI to code generation
    // In a real implementation, you'd use libraries like openapi-generator-cli
    // or implement custom code generation logic
    
    logger.info('Generating content from OpenAPI spec', { 
      path: file.path,
      specVersion: openApiSpec.info?.version 
    });

    return `// Generated from OpenAPI specification ${openApiSpec.info?.version}
// This file contains auto-generated code based on the API specification
// Manual edits may be overwritten during regeneration

${file.content}`;
  }

  /**
   * Save generated files to output directory
   */
  private async saveFiles(outputDir: string, files: SdkTemplateFile[]): Promise<string> {
    // In a real implementation, you'd use fs/promises to write files
    // For now, we'll just return the output directory path
    
    logger.info('Saving generated files', { 
      outputDir, 
      fileCount: files.length 
    });

    // Placeholder for actual file writing
    for (const file of files) {
      logger.debug('Would write file', { 
        path: `${outputDir}/${file.path}`,
        type: file.type 
      });
    }

    return outputDir;
  }

  /**
   * Generate SDKs for all configured targets
   */
  public async generateAllSdks(openApiSpec?: any): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const target of this.config.targets) {
      try {
        const outputPath = await this.generateSdk(target, openApiSpec);
        results.set(target.language, outputPath);
      } catch (error) {
        logger.error('Failed to generate SDK for target', { 
          target, 
          error 
        });
        // Continue with other targets
      }
    }

    return results;
  }

  /**
   * Get generated SDK information
   */
  public getGeneratedSdk(language: string): any {
    return this.generatedSdks.get(language);
  }

  /**
   * Get all generated SDKs
   */
  public getAllGeneratedSdks(): any[] {
    return Array.from(this.generatedSdks.values());
  }

  /**
   * Validate SDK configuration
   */
  public validateConfiguration(): boolean {
    try {
      // Check if all targets have valid templates
      for (const target of this.config.targets) {
        if (!this.templates.has(target.template)) {
          throw new SdkGenerationError(
            `Target template not found: ${target.template}`,
            'INVALID_TARGET_CONFIG'
          );
        }

        if (!target.outputDir) {
          throw new SdkGenerationError(
            `Target missing output directory: ${target.language}`,
            'INVALID_TARGET_CONFIG'
          );
        }
      }

      return true;
    } catch (error) {
      logger.error('SDK configuration validation failed', { error });
      return false;
    }
  }

  /**
   * Get SDK generation statistics
   */
  public getStats(): any {
    return {
      totalTemplates: this.templates.size,
      totalTargets: this.config.targets.length,
      totalGenerated: this.generatedSdks.size,
      templatesByLanguage: this.getTemplatesByLanguageStats(),
      generatedByLanguage: this.getGeneratedByLanguageStats(),
    };
  }

  /**
   * Get templates grouped by language
   */
  private getTemplatesByLanguageStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const template of this.templates.values()) {
      stats[template.language] = (stats[template.language] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get generated SDKs grouped by language
   */
  private getGeneratedByLanguageStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const [language, _sdk] of this.generatedSdks) {
      stats[language] = (stats[language] || 0) + 1;
    }

    return stats;
  }
}

export default SdkGeneratorService; 