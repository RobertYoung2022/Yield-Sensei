import { IntegrationTestBase, IntegrationTestConfig } from '../framework/integration-test-base';
import * as Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface APIContract {
  service: string;
  version: string;
  endpoints: EndpointContract[];
  schemas: Record<string, any>;
  authentication: AuthenticationContract;
  rateLimit?: RateLimitContract;
}

export interface EndpointContract {
  path: string;
  method: string;
  description: string;
  requestSchema?: string;
  responseSchema: string;
  errorSchemas?: Record<number, string>;
  headers?: HeaderContract[];
  queryParams?: ParameterContract[];
  pathParams?: ParameterContract[];
  authentication?: boolean;
  rateLimit?: number;
}

export interface HeaderContract {
  name: string;
  required: boolean;
  type: string;
  description?: string;
}

export interface ParameterContract {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  constraints?: any;
}

export interface AuthenticationContract {
  type: 'bearer' | 'apiKey' | 'oauth2' | 'none';
  tokenEndpoint?: string;
  scopes?: string[];
}

export interface RateLimitContract {
  requests: number;
  window: number; // seconds
  headers: string[];
}

export interface ContractViolation {
  endpoint: string;
  violationType: 'schema' | 'status' | 'header' | 'authentication' | 'rateLimit';
  expected: any;
  actual: any;
  message: string;
}

export class APIContractTester extends IntegrationTestBase {
  private contracts: Map<string, APIContract> = new Map();
  private ajv: Ajv.default;
  private violations: ContractViolation[] = [];

  constructor() {
    const config: IntegrationTestConfig = {
      name: 'api-contract-testing',
      description: 'API contract testing across all YieldSensei services',
      environment: {
        type: 'local',
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
        variables: {
          CONTRACT_MODE: 'strict'
        }
      },
      services: [
        {
          name: 'api-gateway',
          type: 'api',
          url: process.env.API_GATEWAY_URL || 'http://localhost:3000',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'sage-satellite',
          type: 'satellite',
          url: process.env.SAGE_URL || 'http://localhost:3001',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'echo-satellite',
          type: 'satellite',
          url: process.env.ECHO_URL || 'http://localhost:3002',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'forge-satellite',
          type: 'satellite',
          url: process.env.FORGE_URL || 'http://localhost:3003',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'pulse-satellite',
          type: 'satellite',
          url: process.env.PULSE_URL || 'http://localhost:3004',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'bridge-satellite',
          type: 'satellite',
          url: process.env.BRIDGE_URL || 'http://localhost:3005',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        },
        {
          name: 'oracle-satellite',
          type: 'satellite',
          url: process.env.ORACLE_URL || 'http://localhost:3006',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        }
      ],
      database: {
        type: 'postgres',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'yieldsensei_test',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres'
        }
      },
      timeout: 60000,
      retries: 3,
      cleanup: {
        database: false,
        cache: false,
        files: false,
        services: false
      }
    };

    super(config);
    this.ajv = new Ajv.default({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.loadContracts();
  }

  getName(): string {
    return 'API Contract Testing Suite';
  }

  getDescription(): string {
    return 'Validates API contracts across all YieldSensei services';
  }

  async runTests(): Promise<void> {
    await this.runTest('API Gateway Contract Compliance', async () => {
      await this.testServiceContract('api-gateway');
    });

    await this.runTest('Sage Satellite Contract Compliance', async () => {
      await this.testServiceContract('sage-satellite');
    });

    await this.runTest('Echo Satellite Contract Compliance', async () => {
      await this.testServiceContract('echo-satellite');
    });

    await this.runTest('Forge Satellite Contract Compliance', async () => {
      await this.testServiceContract('forge-satellite');
    });

    await this.runTest('Pulse Satellite Contract Compliance', async () => {
      await this.testServiceContract('pulse-satellite');
    });

    await this.runTest('Bridge Satellite Contract Compliance', async () => {
      await this.testServiceContract('bridge-satellite');
    });

    await this.runTest('Oracle Satellite Contract Compliance', async () => {
      await this.testServiceContract('oracle-satellite');
    });

    await this.runTest('Cross-Service Contract Compatibility', async () => {
      await this.testCrossServiceCompatibility();
    });

    await this.runTest('Contract Evolution Compatibility', async () => {
      await this.testContractEvolution();
    });
  }

  private loadContracts(): void {
    // Load API Gateway contract
    this.contracts.set('api-gateway', {
      service: 'api-gateway',
      version: '1.0.0',
      authentication: {
        type: 'bearer',
        tokenEndpoint: '/api/v1/auth/token'
      },
      endpoints: [
        {
          path: '/api/v1/auth/login',
          method: 'POST',
          description: 'User authentication',
          requestSchema: 'LoginRequest',
          responseSchema: 'LoginResponse',
          errorSchemas: {
            400: 'ValidationError',
            401: 'AuthenticationError'
          }
        },
        {
          path: '/api/v1/portfolios',
          method: 'GET',
          description: 'Get user portfolios',
          responseSchema: 'PortfolioList',
          authentication: true
        },
        {
          path: '/api/v1/portfolios',
          method: 'POST',
          description: 'Create new portfolio',
          requestSchema: 'CreatePortfolioRequest',
          responseSchema: 'Portfolio',
          authentication: true
        },
        {
          path: '/api/v1/portfolios/{id}',
          method: 'GET',
          description: 'Get portfolio by ID',
          pathParams: [
            { name: 'id', type: 'string', required: true, description: 'Portfolio ID' }
          ],
          responseSchema: 'Portfolio',
          authentication: true
        }
      ],
      schemas: this.getAPIGatewaySchemas()
    });

    // Load Sage Satellite contract
    this.contracts.set('sage-satellite', {
      service: 'sage-satellite',
      version: '1.0.0',
      authentication: {
        type: 'bearer'
      },
      endpoints: [
        {
          path: '/api/v1/rwa/score',
          method: 'POST',
          description: 'Score RWA opportunity',
          requestSchema: 'RWAScoringRequest',
          responseSchema: 'RWAScoringResponse'
        },
        {
          path: '/api/v1/analysis/fundamental',
          method: 'POST',
          description: 'Perform fundamental analysis',
          requestSchema: 'FundamentalAnalysisRequest',
          responseSchema: 'FundamentalAnalysisResponse'
        },
        {
          path: '/api/v1/compliance/check',
          method: 'POST',
          description: 'Check compliance status',
          requestSchema: 'ComplianceCheckRequest',
          responseSchema: 'ComplianceCheckResponse'
        }
      ],
      schemas: this.getSageSchemas()
    });

    // Load other satellite contracts...
    this.loadSatelliteContracts();
  }

  private async testServiceContract(serviceName: string): Promise<void> {
    const contract = this.contracts.get(serviceName);
    if (!contract) {
      throw new Error(`No contract found for service: ${serviceName}`);
    }

    this.context.logger.info(`Testing contract for ${serviceName}`);

    // Test each endpoint
    for (const endpoint of contract.endpoints) {
      await this.testEndpointContract(serviceName, contract, endpoint);
    }

    // Test authentication if required
    if (contract.authentication.type !== 'none') {
      await this.testAuthenticationContract(serviceName, contract);
    }

    // Test rate limiting if configured
    if (contract.rateLimit) {
      await this.testRateLimitContract(serviceName, contract);
    }
  }

  private async testEndpointContract(
    serviceName: string,
    contract: APIContract,
    endpoint: EndpointContract
  ): Promise<void> {
    this.context.logger.info(`Testing endpoint: ${endpoint.method} ${endpoint.path}`);

    try {
      // Prepare test request
      const requestData = this.generateTestData(
        contract.schemas[endpoint.requestSchema || '']
      );

      const headers: Record<string, string> = {};
      
      // Add authentication if required
      if (endpoint.authentication) {
        headers['Authorization'] = 'Bearer test-token';
      }

      // Make request
      const response = await this.makeRequest(serviceName, {
        method: endpoint.method,
        path: this.resolvePath(endpoint.path, endpoint.pathParams),
        headers,
        body: requestData,
        query: this.generateQueryParams(endpoint.queryParams)
      });

      // Validate response schema
      await this.validateResponseSchema(
        serviceName,
        endpoint,
        contract.schemas[endpoint.responseSchema],
        response
      );

      // Validate headers
      this.validateResponseHeaders(serviceName, endpoint, response);

    } catch (error) {
      this.recordViolation({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        violationType: 'schema',
        expected: 'Valid response',
        actual: error,
        message: `Endpoint test failed: ${error}`
      });
    }
  }

  private async validateResponseSchema(
    serviceName: string,
    endpoint: EndpointContract,
    schema: any,
    response: any
  ): Promise<void> {
    if (!schema) {
      this.context.logger.warn(`No schema defined for ${endpoint.path}`);
      return;
    }

    const validate = this.ajv.compile(schema);
    const valid = validate(response.body);

    if (!valid) {
      this.recordViolation({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        violationType: 'schema',
        expected: schema,
        actual: response.body,
        message: `Response schema validation failed: ${this.ajv.errorsText(validate.errors)}`
      });
    }

    // Validate status code is in expected range
    if (response.status < 200 || response.status >= 300) {
      // Check if error schema is defined
      const errorSchema = endpoint.errorSchemas?.[response.status];
      if (errorSchema) {
        const errorValidate = this.ajv.compile(schema);
        const errorValid = errorValidate(response.body);
        
        if (!errorValid) {
          this.recordViolation({
            endpoint: `${endpoint.method} ${endpoint.path}`,
            violationType: 'schema',
            expected: errorSchema,
            actual: response.body,
            message: `Error response schema validation failed`
          });
        }
      }
    }
  }

  private validateResponseHeaders(
    serviceName: string,
    endpoint: EndpointContract,
    response: any
  ): void {
    // Check required headers
    const requiredHeaders = endpoint.headers?.filter(h => h.required) || [];
    
    for (const headerContract of requiredHeaders) {
      const headerValue = response.headers[headerContract.name.toLowerCase()];
      
      if (!headerValue) {
        this.recordViolation({
          endpoint: `${endpoint.method} ${endpoint.path}`,
          violationType: 'header',
          expected: `Header ${headerContract.name}`,
          actual: 'Missing',
          message: `Required header missing: ${headerContract.name}`
        });
      }
    }

    // Validate standard headers
    this.validateStandardHeaders(serviceName, endpoint, response);
  }

  private validateStandardHeaders(
    serviceName: string,
    endpoint: EndpointContract,
    response: any
  ): void {
    // Content-Type validation
    if (response.body && !response.headers['content-type']?.includes('application/json')) {
      this.recordViolation({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        violationType: 'header',
        expected: 'application/json',
        actual: response.headers['content-type'],
        message: 'Invalid Content-Type header'
      });
    }

    // CORS headers validation for browser requests
    const corsHeaders = ['access-control-allow-origin', 'access-control-allow-methods'];
    for (const corsHeader of corsHeaders) {
      if (!response.headers[corsHeader]) {
        this.context.logger.warn(`Missing CORS header: ${corsHeader}`);
      }
    }
  }

  private async testAuthenticationContract(
    serviceName: string,
    contract: APIContract
  ): Promise<void> {
    // Test authentication endpoint if available
    if (contract.authentication.tokenEndpoint) {
      const authResponse = await this.makeRequest(serviceName, {
        method: 'POST',
        path: contract.authentication.tokenEndpoint,
        body: {
          username: 'test@example.com',
          password: 'testpassword'
        }
      });

      if (authResponse.status !== 200) {
        this.recordViolation({
          endpoint: contract.authentication.tokenEndpoint,
          violationType: 'authentication',
          expected: '200 OK',
          actual: authResponse.status,
          message: 'Authentication endpoint failed'
        });
      }
    }

    // Test unauthorized access
    const protectedEndpoint = contract.endpoints.find(e => e.authentication);
    if (protectedEndpoint) {
      const unauthorizedResponse = await this.makeRequest(serviceName, {
        method: protectedEndpoint.method,
        path: protectedEndpoint.path
      });

      if (unauthorizedResponse.status !== 401) {
        this.recordViolation({
          endpoint: `${protectedEndpoint.method} ${protectedEndpoint.path}`,
          violationType: 'authentication',
          expected: '401 Unauthorized',
          actual: unauthorizedResponse.status,
          message: 'Protected endpoint should return 401 without auth'
        });
      }
    }
  }

  private async testRateLimitContract(
    serviceName: string,
    contract: APIContract
  ): Promise<void> {
    if (!contract.rateLimit) return;

    const endpoint = contract.endpoints[0]; // Test with first endpoint
    const requests: Promise<any>[] = [];

    // Make requests exceeding rate limit
    for (let i = 0; i < contract.rateLimit.requests + 5; i++) {
      requests.push(
        this.makeRequest(serviceName, {
          method: endpoint.method,
          path: endpoint.path
        }).catch(e => ({ status: 429, error: e }))
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);

    if (rateLimitedResponses.length === 0) {
      this.recordViolation({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        violationType: 'rateLimit',
        expected: 'Rate limiting active',
        actual: 'No rate limiting detected',
        message: 'Rate limiting not enforced'
      });
    }

    // Check rate limit headers
    const lastResponse = responses[responses.length - 1];
    const expectedHeaders = contract.rateLimit.headers;
    
    for (const headerName of expectedHeaders) {
      if (!lastResponse.headers?.[headerName.toLowerCase()]) {
        this.recordViolation({
          endpoint: `${endpoint.method} ${endpoint.path}`,
          violationType: 'header',
          expected: `Rate limit header ${headerName}`,
          actual: 'Missing',
          message: `Missing rate limit header: ${headerName}`
        });
      }
    }
  }

  private async testCrossServiceCompatibility(): Promise<void> {
    // Test that services can communicate with each other
    const sageForgeCommunication = await this.testServiceCommunication(
      'sage-satellite',
      'forge-satellite',
      '/api/v1/rwa/score',
      '/api/v1/strategies/rwa'
    );

    const pulseOracleCommunication = await this.testServiceCommunication(
      'pulse-satellite',
      'oracle-satellite',
      '/api/v1/strategies/discover',
      '/api/v1/validate/protocols'
    );

    this.assert(sageForgeCommunication, 'Sage-Forge communication failed');
    this.assert(pulseOracleCommunication, 'Pulse-Oracle communication failed');
  }

  private async testServiceCommunication(
    service1: string,
    service2: string,
    endpoint1: string,
    endpoint2: string
  ): Promise<boolean> {
    try {
      // Test communication flow
      const response1 = await this.makeRequest(service1, {
        method: 'GET',
        path: endpoint1
      });

      if (response1.status === 200 && response1.body.data) {
        const response2 = await this.makeRequest(service2, {
          method: 'POST',
          path: endpoint2,
          body: { data: response1.body.data }
        });

        return response2.status === 200;
      }

      return false;
    } catch (error) {
      this.context.logger.error(`Service communication test failed: ${error}`);
      return false;
    }
  }

  private async testContractEvolution(): Promise<void> {
    // Test backward compatibility
    for (const [serviceName, contract] of this.contracts) {
      await this.testBackwardCompatibility(serviceName, contract);
    }

    // Test version negotiation
    await this.testVersionNegotiation();
  }

  private async testBackwardCompatibility(
    serviceName: string,
    contract: APIContract
  ): Promise<void> {
    // Test with older API version headers
    const endpoint = contract.endpoints[0];
    
    const response = await this.makeRequest(serviceName, {
      method: endpoint.method,
      path: endpoint.path,
      headers: {
        'API-Version': '0.9.0', // Older version
        'Accept': 'application/vnd.yieldsensei.v0+json'
      }
    });

    // Should either work or return proper error
    if (response.status !== 200 && response.status !== 400 && response.status !== 406) {
      this.recordViolation({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        violationType: 'schema',
        expected: 'Graceful version handling',
        actual: response.status,
        message: 'Poor version compatibility handling'
      });
    }
  }

  private async testVersionNegotiation(): Promise<void> {
    // Test version negotiation across services
    const services = Array.from(this.contracts.keys());
    
    for (const serviceName of services) {
      const response = await this.makeRequest(serviceName, {
        method: 'GET',
        path: '/api/version',
        headers: {
          'Accept': 'application/vnd.yieldsensei.v1+json'
        }
      });

      if (response.status === 200) {
        this.assert(response.body.version, `No version info from ${serviceName}`);
        this.assert(response.body.supportedVersions, `No supported versions from ${serviceName}`);
      }
    }
  }

  private generateTestData(schema: any): any {
    if (!schema) return {};

    const data: any = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        data[key] = this.generateValueFromSchema(prop as any);
      }
    }

    return data;
  }

  private generateValueFromSchema(schema: any): any {
    switch (schema.type) {
      case 'string':
        return schema.format === 'email' ? 'test@example.com' : 'test-value';
      case 'number':
        return schema.minimum || 0;
      case 'integer':
        return schema.minimum || 1;
      case 'boolean':
        return true;
      case 'array':
        return [this.generateValueFromSchema(schema.items)];
      case 'object':
        return this.generateTestData(schema);
      default:
        return null;
    }
  }

  private resolvePath(path: string, pathParams?: ParameterContract[]): string {
    let resolvedPath = path;
    
    if (pathParams) {
      for (const param of pathParams) {
        resolvedPath = resolvedPath.replace(
          `{${param.name}}`,
          this.generateValueFromSchema({ type: param.type }) as string
        );
      }
    }
    
    return resolvedPath;
  }

  private generateQueryParams(queryParams?: ParameterContract[]): Record<string, string> {
    const params: Record<string, string> = {};
    
    if (queryParams) {
      for (const param of queryParams.filter(p => p.required)) {
        params[param.name] = this.generateValueFromSchema({ type: param.type }) as string;
      }
    }
    
    return params;
  }

  private recordViolation(violation: ContractViolation): void {
    this.violations.push(violation);
    this.context.logger.error('Contract violation', violation);
  }

  private getAPIGatewaySchemas(): Record<string, any> {
    return {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        }
      },
      LoginResponse: {
        type: 'object',
        required: ['token', 'user'],
        properties: {
          token: { type: 'string' },
          user: {
            type: 'object',
            required: ['id', 'email'],
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' }
            }
          }
        }
      },
      Portfolio: {
        type: 'object',
        required: ['id', 'name', 'totalValue'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          totalValue: { type: 'number', minimum: 0 },
          currency: { type: 'string' }
        }
      },
      PortfolioList: {
        type: 'object',
        required: ['portfolios'],
        properties: {
          portfolios: {
            type: 'array',
            items: { $ref: '#/schemas/Portfolio' }
          }
        }
      }
    };
  }

  private getSageSchemas(): Record<string, any> {
    return {
      RWAScoringRequest: {
        type: 'object',
        required: ['asset'],
        properties: {
          asset: {
            type: 'object',
            required: ['id', 'type', 'yield'],
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              yield: { type: 'number', minimum: 0 }
            }
          }
        }
      },
      RWAScoringResponse: {
        type: 'object',
        required: ['score', 'breakdown'],
        properties: {
          score: { type: 'number', minimum: 0, maximum: 100 },
          breakdown: {
            type: 'object',
            required: ['yieldScore', 'riskScore'],
            properties: {
              yieldScore: { type: 'number' },
              riskScore: { type: 'number' }
            }
          }
        }
      }
    };
  }

  private loadSatelliteContracts(): void {
    // Load contracts for other satellites
    // This would typically be loaded from OpenAPI specs or contract files
  }

  getViolations(): ContractViolation[] {
    return this.violations;
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }
}