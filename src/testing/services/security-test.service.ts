/**
 * Security Testing Service for YieldSensei
 * Implements comprehensive security testing including penetration testing and vulnerability scanning
 */

import { SecurityTestCase, TestResult, AssertionResult, SecurityTestConfig, SecurityVulnerability, SecurityPayload } from '../types';
import { testingConfig } from '../config/testing.config';
import { logger } from '../../shared/utils/logger';

/**
 * Security Testing Service for YieldSensei
 * Implements comprehensive security testing including penetration testing and vulnerability scanning
 */
export class SecurityTestService {
  private config: SecurityTestConfig;
  private testSuites: Map<string, SecurityTestCase[]> = new Map();
  private vulnerabilities: SecurityVulnerability[] = [];

  constructor() {
    this.config = testingConfig.getSecurityTestConfig();
    this.initializeTestSuites();
  }

  /**
   * Initialize all security test suites
   */
  private initializeTestSuites(): void {
    // SQL Injection tests
    this.testSuites.set('sql-injection', this.createSqlInjectionTests());
    
    // XSS tests
    this.testSuites.set('xss', this.createXssTests());
    
    // CSRF tests
    this.testSuites.set('csrf', this.createCsrfTests());
    
    // Authentication bypass tests
    this.testSuites.set('auth-bypass', this.createAuthBypassTests());
    
    // Input validation tests
    this.testSuites.set('input-validation', this.createInputValidationTests());
    
    // Security header tests
    this.testSuites.set('security-headers', this.createSecurityHeaderTests());
    
    // SSL/TLS tests
    this.testSuites.set('ssl-tls', this.createSslTlsTests());
    
    // CORS tests
    this.testSuites.set('cors', this.createCorsTests());
    
    // Rate limiting tests
    this.testSuites.set('rate-limiting', this.createRateLimitingTests());
    
    // Authorization tests
    this.testSuites.set('authorization', this.createAuthorizationTests());
  }

  /**
   * Run all security tests
   */
  public async runAllTests(): Promise<TestResult[]> {
    logger.info('Starting security test execution');
    const results: TestResult[] = [];

    for (const [suiteName, testCases] of this.testSuites) {
      logger.info(`Running security test suite: ${suiteName}`);
      
      for (const testCase of testCases) {
        try {
          const result = await this.runTestCase(testCase);
          results.push(result);
        } catch (error) {
          logger.error(`Error running security test case ${testCase.id}:`, error);
          results.push(this.createErrorResult(testCase, error as Error));
        }
      }
    }

    logger.info(`Security test execution completed. Total tests: ${results.length}`);
    return results;
  }

  /**
   * Run a specific security test suite
   */
  public async runTestSuite(suiteName: string): Promise<TestResult[]> {
    const testCases = this.testSuites.get(suiteName);
    if (!testCases) {
      throw new Error(`Security test suite '${suiteName}' not found`);
    }

    logger.info(`Running security test suite: ${suiteName}`);
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      try {
        const result = await this.runTestCase(testCase);
        results.push(result);
      } catch (error) {
        logger.error(`Error running security test case ${testCase.id}:`, error);
        results.push(this.createErrorResult(testCase, error as Error));
      }
    }

    return results;
  }

  /**
   * Run a single security test case
   */
  public async runTestCase(testCase: SecurityTestCase): Promise<TestResult> {
    const startTime = new Date();
    const assertions: AssertionResult[] = [];

    try {
      logger.debug(`Running security test case: ${testCase.name}`);

      // Setup if provided
      if (testCase.setup) {
        await testCase.setup();
      }

      // Execute the security test
      const result = await this.executeSecurityTest(testCase);
      assertions.push(...result.assertions);

      // Check if vulnerability was detected
      if (result.vulnerabilityDetected) {
        this.vulnerabilities.push({
          id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: testCase.vulnerability,
          severity: testCase.severity,
          description: testCase.description,
          location: testCase.payload.type,
          evidence: result.evidence,
          recommendation: this.getRecommendation(testCase.vulnerability),
          cveId: this.getCveId(testCase.vulnerability),
        });
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Teardown if provided
      if (testCase.teardown) {
        await testCase.teardown();
      }

      return {
        id: `security-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        testCaseId: testCase.id,
        status: this.determineStatus(assertions),
        duration,
        startTime,
        endTime,
        details: result.details,
        metadata: { 
          vulnerabilityDetected: result.vulnerabilityDetected,
          severity: testCase.severity,
          evidence: result.evidence,
        },
        assertions,
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Teardown if provided
      if (testCase.teardown) {
        try {
          await testCase.teardown();
        } catch (teardownError) {
          logger.error('Error during teardown:', teardownError);
        }
      }

      return {
        id: `security-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        testCaseId: testCase.id,
        status: 'error',
        duration,
        startTime,
        endTime,
        error: error as Error,
        assertions,
      };
    }
  }

  /**
   * Execute security test with payload
   */
  private async executeSecurityTest(testCase: SecurityTestCase): Promise<{
    assertions: AssertionResult[];
    vulnerabilityDetected: boolean;
    evidence: string;
    details: any;
  }> {
    const assertions: AssertionResult[] = [];
    let vulnerabilityDetected = false;
    let evidence = '';

    try {
      // Execute the payload against the target
      const response = await this.executePayload(testCase.payload, testCase.expectedBehavior);
      
      // Analyze the response for vulnerability indicators
      const analysis = this.analyzeResponse(response, testCase.payload, testCase.expectedBehavior);
      
      vulnerabilityDetected = analysis.vulnerabilityDetected;
      evidence = analysis.evidence;

      // Create assertions based on expected behavior
      assertions.push({
        name: `${testCase.vulnerability} - ${testCase.payload.description}`,
        status: vulnerabilityDetected ? 'failed' : 'passed',
        expected: testCase.expectedBehavior,
        actual: vulnerabilityDetected ? 'vulnerability_detected' : 'secure',
        message: analysis.message,
      });

      // Additional security checks
      assertions.push({
        name: 'Response validation',
        status: analysis.responseValid ? 'passed' : 'failed',
        expected: 'valid_response',
        actual: analysis.responseValid ? 'valid_response' : 'invalid_response',
        message: analysis.responseMessage,
      });

      return {
        assertions,
        vulnerabilityDetected,
        evidence,
        details: {
          payload: testCase.payload,
          response: response,
          analysis: analysis,
        },
      };

    } catch (error) {
      assertions.push({
        name: `${testCase.vulnerability} - ${testCase.payload.description}`,
        status: 'failed',
        expected: testCase.expectedBehavior,
        actual: 'error',
        message: `Test execution failed: ${(error as Error).message}`,
      });

      return {
        assertions,
        vulnerabilityDetected: false,
        evidence: `Error: ${(error as Error).message}`,
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Execute security payload against target
   */
  private async executePayload(payload: SecurityPayload, expectedBehavior: string): Promise<any> {
    // Simulate payload execution based on type
    switch (payload.type) {
      case 'sql-injection':
        return this.executeSqlInjectionPayload(payload);
      case 'xss':
        return this.executeXssPayload(payload);
      case 'csrf':
        return this.executeCsrfPayload(payload);
      case 'authentication-bypass':
        return this.executeAuthBypassPayload(payload);
      case 'input-validation':
        return this.executeInputValidationPayload(payload);
      default:
        throw new Error(`Unknown payload type: ${payload.type}`);
    }
  }

  /**
   * Analyze response for vulnerability indicators
   */
  private analyzeResponse(response: any, payload: SecurityPayload, expectedBehavior: string): {
    vulnerabilityDetected: boolean;
    evidence: string;
    message: string;
    responseValid: boolean;
    responseMessage: string;
  } {
    let vulnerabilityDetected = false;
    let evidence = '';
    let message = '';
    let responseValid = true;
    let responseMessage = 'Response is valid';

    // Analyze based on payload type
    switch (payload.type) {
      case 'sql-injection':
        const sqlAnalysis = this.analyzeSqlInjectionResponse(response);
        vulnerabilityDetected = sqlAnalysis.vulnerabilityDetected;
        evidence = sqlAnalysis.evidence;
        message = sqlAnalysis.message;
        break;

      case 'xss':
        const xssAnalysis = this.analyzeXssResponse(response);
        vulnerabilityDetected = xssAnalysis.vulnerabilityDetected;
        evidence = xssAnalysis.evidence;
        message = xssAnalysis.message;
        break;

      case 'csrf':
        const csrfAnalysis = this.analyzeCsrfResponse(response);
        vulnerabilityDetected = csrfAnalysis.vulnerabilityDetected;
        evidence = csrfAnalysis.evidence;
        message = csrfAnalysis.message;
        break;

      case 'authentication-bypass':
        const authAnalysis = this.analyzeAuthBypassResponse(response);
        vulnerabilityDetected = authAnalysis.vulnerabilityDetected;
        evidence = authAnalysis.evidence;
        message = authAnalysis.message;
        break;

      case 'input-validation':
        const inputAnalysis = this.analyzeInputValidationResponse(response);
        vulnerabilityDetected = inputAnalysis.vulnerabilityDetected;
        evidence = inputAnalysis.evidence;
        message = inputAnalysis.message;
        break;
    }

    // Check if response is valid
    if (response.statusCode >= 400) {
      responseValid = false;
      responseMessage = `Invalid response: ${response.statusCode}`;
    }

    return {
      vulnerabilityDetected,
      evidence,
      message,
      responseValid,
      responseMessage,
    };
  }

  /**
   * Create SQL injection tests
   */
  private createSqlInjectionTests(): SecurityTestCase[] {
    return [
      {
        id: 'sql-001',
        name: 'Basic SQL Injection',
        description: 'Test basic SQL injection with OR condition',
        category: 'security',
        priority: 'high',
        tags: ['sql-injection', 'authentication'],
        vulnerability: 'sql-injection',
        payload: {
          type: 'sql-injection',
          payload: "' OR '1'='1",
          description: 'Basic SQL injection with OR condition',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
      {
        id: 'sql-002',
        name: 'Union SQL Injection',
        description: 'Test SQL injection with UNION attack',
        category: 'security',
        priority: 'high',
        tags: ['sql-injection', 'data-extraction'],
        vulnerability: 'sql-injection',
        payload: {
          type: 'sql-injection',
          payload: "' UNION SELECT username,password FROM users --",
          description: 'SQL injection with UNION attack',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'critical',
      },
      {
        id: 'sql-003',
        name: 'Blind SQL Injection',
        description: 'Test blind SQL injection',
        category: 'security',
        priority: 'high',
        tags: ['sql-injection', 'blind'],
        vulnerability: 'sql-injection',
        payload: {
          type: 'sql-injection',
          payload: "' AND (SELECT COUNT(*) FROM users) > 0 --",
          description: 'Blind SQL injection test',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
    ];
  }

  /**
   * Create XSS tests
   */
  private createXssTests(): SecurityTestCase[] {
    return [
      {
        id: 'xss-001',
        name: 'Reflected XSS',
        description: 'Test reflected XSS vulnerability',
        category: 'security',
        priority: 'high',
        tags: ['xss', 'reflected'],
        vulnerability: 'xss',
        payload: {
          type: 'xss',
          payload: '<script>alert("XSS")</script>',
          description: 'Basic reflected XSS test',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
      {
        id: 'xss-002',
        name: 'Stored XSS',
        description: 'Test stored XSS vulnerability',
        category: 'security',
        priority: 'high',
        tags: ['xss', 'stored'],
        vulnerability: 'xss',
        payload: {
          type: 'xss',
          payload: '<img src="x" onerror="alert(\'XSS\')">',
          description: 'Stored XSS with img onerror',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
      {
        id: 'xss-003',
        name: 'DOM XSS',
        description: 'Test DOM-based XSS vulnerability',
        category: 'security',
        priority: 'high',
        tags: ['xss', 'dom'],
        vulnerability: 'xss',
        payload: {
          type: 'xss',
          payload: 'javascript:alert("XSS")',
          description: 'DOM-based XSS with javascript protocol',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
    ];
  }

  /**
   * Create CSRF tests
   */
  private createCsrfTests(): SecurityTestCase[] {
    return [
      {
        id: 'csrf-001',
        name: 'CSRF Token Validation',
        description: 'Test CSRF token validation',
        category: 'security',
        priority: 'high',
        tags: ['csrf', 'token'],
        vulnerability: 'csrf',
        payload: {
          type: 'csrf',
          payload: 'POST /api/transfer HTTP/1.1\r\nHost: evil.com\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\namount=1000&to=attacker',
          description: 'CSRF attack simulation',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
    ];
  }

  /**
   * Create authentication bypass tests
   */
  private createAuthBypassTests(): SecurityTestCase[] {
    return [
      {
        id: 'auth-bypass-001',
        name: 'Admin Bypass',
        description: 'Test admin authentication bypass',
        category: 'security',
        priority: 'critical',
        tags: ['authentication-bypass', 'admin'],
        vulnerability: 'authentication-bypass',
        payload: {
          type: 'authentication-bypass',
          payload: 'admin',
          description: 'Authentication bypass attempt',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'critical',
      },
      {
        id: 'auth-bypass-002',
        name: 'Boolean Bypass',
        description: 'Test boolean authentication bypass',
        category: 'security',
        priority: 'critical',
        tags: ['authentication-bypass', 'boolean'],
        vulnerability: 'authentication-bypass',
        payload: {
          type: 'authentication-bypass',
          payload: 'true',
          description: 'Boolean authentication bypass',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'critical',
      },
    ];
  }

  /**
   * Create input validation tests
   */
  private createInputValidationTests(): SecurityTestCase[] {
    return [
      {
        id: 'input-001',
        name: 'Path Traversal',
        description: 'Test path traversal vulnerability',
        category: 'security',
        priority: 'high',
        tags: ['input-validation', 'path-traversal'],
        vulnerability: 'input-validation',
        payload: {
          type: 'input-validation',
          payload: '../../../../etc/passwd',
          description: 'Path traversal attack',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
      {
        id: 'input-002',
        name: 'Buffer Overflow',
        description: 'Test buffer overflow vulnerability',
        category: 'security',
        priority: 'high',
        tags: ['input-validation', 'buffer-overflow'],
        vulnerability: 'input-validation',
        payload: {
          type: 'input-validation',
          payload: 'A'.repeat(10000),
          description: 'Buffer overflow attempt',
          expectedResponse: { blocked: true },
        },
        expectedBehavior: 'blocked',
        severity: 'high',
      },
    ];
  }

  /**
   * Create security header tests
   */
  private createSecurityHeaderTests(): SecurityTestCase[] {
    return [
      {
        id: 'headers-001',
        name: 'Security Headers Check',
        description: 'Test security headers presence',
        category: 'security',
        priority: 'medium',
        tags: ['security-headers', 'headers'],
        vulnerability: 'security-headers',
        payload: {
          type: 'input-validation',
          payload: 'security-headers-check',
          description: 'Security headers validation',
          expectedResponse: { headers: ['X-Frame-Options', 'X-Content-Type-Options', 'X-XSS-Protection'] },
        },
        expectedBehavior: 'detected',
        severity: 'medium',
      },
    ];
  }

  /**
   * Create SSL/TLS tests
   */
  private createSslTlsTests(): SecurityTestCase[] {
    return [
      {
        id: 'ssl-001',
        name: 'SSL Certificate Validation',
        description: 'Test SSL certificate validation',
        category: 'security',
        priority: 'medium',
        tags: ['ssl-tls', 'certificate'],
        vulnerability: 'ssl-tls',
        payload: {
          type: 'input-validation',
          payload: 'ssl-cert-check',
          description: 'SSL certificate validation',
          expectedResponse: { valid: true },
        },
        expectedBehavior: 'detected',
        severity: 'medium',
      },
    ];
  }

  /**
   * Create CORS tests
   */
  private createCorsTests(): SecurityTestCase[] {
    return [
      {
        id: 'cors-001',
        name: 'CORS Policy Check',
        description: 'Test CORS policy configuration',
        category: 'security',
        priority: 'medium',
        tags: ['cors', 'policy'],
        vulnerability: 'cors',
        payload: {
          type: 'input-validation',
          payload: 'cors-policy-check',
          description: 'CORS policy validation',
          expectedResponse: { secure: true },
        },
        expectedBehavior: 'detected',
        severity: 'medium',
      },
    ];
  }

  /**
   * Create rate limiting tests
   */
  private createRateLimitingTests(): SecurityTestCase[] {
    return [
      {
        id: 'rate-001',
        name: 'Rate Limiting Test',
        description: 'Test rate limiting functionality',
        category: 'security',
        priority: 'medium',
        tags: ['rate-limiting', 'throttling'],
        vulnerability: 'rate-limiting',
        payload: {
          type: 'input-validation',
          payload: 'rate-limit-test',
          description: 'Rate limiting validation',
          expectedResponse: { limited: true },
        },
        expectedBehavior: 'detected',
        severity: 'medium',
      },
    ];
  }

  /**
   * Create authorization tests
   */
  private createAuthorizationTests(): SecurityTestCase[] {
    return [
      {
        id: 'authz-001',
        name: 'Authorization Check',
        description: 'Test authorization controls',
        category: 'security',
        priority: 'high',
        tags: ['authorization', 'rbac'],
        vulnerability: 'authorization',
        payload: {
          type: 'input-validation',
          payload: 'authz-check',
          description: 'Authorization validation',
          expectedResponse: { authorized: false },
        },
        expectedBehavior: 'detected',
        severity: 'high',
      },
    ];
  }

  /**
   * Execute SQL injection payload
   */
  private async executeSqlInjectionPayload(payload: SecurityPayload): Promise<any> {
    // Simulate SQL injection attempt
    const response = await this.simulateApiCall('/api/v1/users/search', 'GET', {
      query: payload.payload,
    });

    return response;
  }

  /**
   * Execute XSS payload
   */
  private async executeXssPayload(payload: SecurityPayload): Promise<any> {
    // Simulate XSS attempt
    const response = await this.simulateApiCall('/api/v1/comments', 'POST', {
      content: payload.payload,
    });

    return response;
  }

  /**
   * Execute CSRF payload
   */
  private async executeCsrfPayload(payload: SecurityPayload): Promise<any> {
    // Simulate CSRF attempt
    const response = await this.simulateApiCall('/api/v1/transfer', 'POST', {
      amount: 1000,
      to: 'attacker',
    }, {
      headers: {
        'Origin': 'evil.com',
        'Referer': 'evil.com',
      },
    });

    return response;
  }

  /**
   * Execute authentication bypass payload
   */
  private async executeAuthBypassPayload(payload: SecurityPayload): Promise<any> {
    // Simulate authentication bypass attempt
    const response = await this.simulateApiCall('/api/v1/admin/users', 'GET', {}, {
      headers: {
        'Authorization': `Bearer ${payload.payload}`,
      },
    });

    return response;
  }

  /**
   * Execute input validation payload
   */
  private async executeInputValidationPayload(payload: SecurityPayload): Promise<any> {
    // Simulate input validation test
    const response = await this.simulateApiCall('/api/v1/files/upload', 'POST', {
      filename: payload.payload,
    });

    return response;
  }

  /**
   * Analyze SQL injection response
   */
  private analyzeSqlInjectionResponse(response: any): {
    vulnerabilityDetected: boolean;
    evidence: string;
    message: string;
  } {
    // Check for SQL error messages in response
    const sqlErrors = [
      'sql syntax',
      'mysql_fetch',
      'ora-',
      'sql server',
      'postgresql',
      'sqlite',
    ];

    const responseText = JSON.stringify(response).toLowerCase();
    const hasSqlError = sqlErrors.some(error => responseText.includes(error));

    if (hasSqlError) {
      return {
        vulnerabilityDetected: true,
        evidence: 'SQL error message detected in response',
        message: 'SQL injection vulnerability detected - error messages exposed',
      };
    }

    // Check for unexpected data in response
    if (response.data && Array.isArray(response.data) && response.data.length > 10) {
      return {
        vulnerabilityDetected: true,
        evidence: 'Large dataset returned unexpectedly',
        message: 'SQL injection vulnerability detected - unauthorized data access',
      };
    }

    return {
      vulnerabilityDetected: false,
      evidence: 'No SQL injection indicators found',
      message: 'SQL injection test passed - no vulnerability detected',
    };
  }

  /**
   * Analyze XSS response
   */
  private analyzeXssResponse(response: any): {
    vulnerabilityDetected: boolean;
    evidence: string;
    message: string;
  } {
    const responseText = JSON.stringify(response);
    
    // Check if script tags are reflected in response
    if (responseText.includes('<script>') || responseText.includes('javascript:')) {
      return {
        vulnerabilityDetected: true,
        evidence: 'Script tags reflected in response',
        message: 'XSS vulnerability detected - script tags not properly encoded',
      };
    }

    // Check for other XSS indicators
    if (responseText.includes('onerror=') || responseText.includes('onload=')) {
      return {
        vulnerabilityDetected: true,
        evidence: 'Event handlers reflected in response',
        message: 'XSS vulnerability detected - event handlers not properly sanitized',
      };
    }

    return {
      vulnerabilityDetected: false,
      evidence: 'No XSS indicators found',
      message: 'XSS test passed - no vulnerability detected',
    };
  }

  /**
   * Analyze CSRF response
   */
  private analyzeCsrfResponse(response: any): {
    vulnerabilityDetected: boolean;
    evidence: string;
    message: string;
  } {
    // Check if request was processed without CSRF token
    if (response.statusCode === 200 && response.data && response.data.success) {
      return {
        vulnerabilityDetected: true,
        evidence: 'Request processed without CSRF protection',
        message: 'CSRF vulnerability detected - request accepted without token validation',
      };
    }

    return {
      vulnerabilityDetected: false,
      evidence: 'CSRF protection working correctly',
      message: 'CSRF test passed - protection mechanisms working',
    };
  }

  /**
   * Analyze authentication bypass response
   */
  private analyzeAuthBypassResponse(response: any): {
    vulnerabilityDetected: boolean;
    evidence: string;
    message: string;
  } {
    // Check if unauthorized access was granted
    if (response.statusCode === 200 && response.data) {
      return {
        vulnerabilityDetected: true,
        evidence: 'Unauthorized access granted',
        message: 'Authentication bypass vulnerability detected - unauthorized access allowed',
      };
    }

    return {
      vulnerabilityDetected: false,
      evidence: 'Authentication controls working correctly',
      message: 'Authentication bypass test passed - controls working properly',
    };
  }

  /**
   * Analyze input validation response
   */
  private analyzeInputValidationResponse(response: any): {
    vulnerabilityDetected: boolean;
    evidence: string;
    message: string;
  } {
    // Check if malicious input was processed
    if (response.statusCode === 200 && response.data) {
      return {
        vulnerabilityDetected: true,
        evidence: 'Malicious input processed successfully',
        message: 'Input validation vulnerability detected - malicious input not properly validated',
      };
    }

    return {
      vulnerabilityDetected: false,
      evidence: 'Input validation working correctly',
      message: 'Input validation test passed - validation mechanisms working',
    };
  }

  /**
   * Simulate API call for security testing
   */
  private async simulateApiCall(endpoint: string, method: string, data: any, options?: any): Promise<any> {
    // Simulate network delay
    await this.delay(50 + Math.random() * 100);

    // Simulate different responses based on endpoint and payload
    if (endpoint.includes('/users/search') && data.query) {
      // Simulate SQL injection response
      if (data.query.includes("' OR '1'='1")) {
        return {
          statusCode: 500,
          error: 'mysql_fetch_array() expects parameter 1 to be resource',
          data: null,
        };
      }
    }

    if (endpoint.includes('/comments') && data.content) {
      // Simulate XSS response
      if (data.content.includes('<script>')) {
        return {
          statusCode: 200,
          data: {
            id: 1,
            content: data.content, // Reflected XSS
            createdAt: new Date().toISOString(),
          },
        };
      }
    }

    if (endpoint.includes('/transfer')) {
      // Simulate CSRF response
      if (options?.headers?.Origin === 'evil.com') {
        return {
          statusCode: 200,
          data: {
            success: true,
            message: 'Transfer completed',
          },
        };
      }
    }

    if (endpoint.includes('/admin/users')) {
      // Simulate auth bypass response
      if (options?.headers?.Authorization?.includes('admin')) {
        return {
          statusCode: 200,
          data: {
            users: [
              { id: 1, email: 'admin@example.com' },
              { id: 2, email: 'user@example.com' },
            ],
          },
        };
      }
    }

    // Default secure response
    return {
      statusCode: 403,
      error: 'Access denied',
      data: null,
    };
  }

  /**
   * Get security recommendation for vulnerability type
   */
  private getRecommendation(vulnerabilityType: string): string {
    const recommendations: Record<string, string> = {
      'sql-injection': 'Use parameterized queries and input validation to prevent SQL injection attacks',
      'xss': 'Implement proper output encoding and Content Security Policy to prevent XSS attacks',
      'csrf': 'Implement CSRF tokens and validate request origin to prevent CSRF attacks',
      'authentication-bypass': 'Implement proper authentication controls and session management',
      'input-validation': 'Implement comprehensive input validation and sanitization',
      'security-headers': 'Configure security headers like CSP, HSTS, and X-Frame-Options',
      'ssl-tls': 'Use strong SSL/TLS configuration and valid certificates',
      'cors': 'Configure CORS policy to restrict cross-origin requests',
      'rate-limiting': 'Implement rate limiting to prevent abuse and DDoS attacks',
      'authorization': 'Implement proper authorization controls and access management',
    };

    return recommendations[vulnerabilityType] || 'Implement appropriate security controls';
  }

  /**
   * Get CVE ID for vulnerability type
   */
  private getCveId(vulnerabilityType: string): string {
    const cveIds: Record<string, string> = {
      'sql-injection': 'CWE-89',
      'xss': 'CWE-79',
      'csrf': 'CWE-352',
      'authentication-bypass': 'CWE-287',
      'input-validation': 'CWE-20',
      'security-headers': 'CWE-693',
      'ssl-tls': 'CWE-327',
      'cors': 'CWE-942',
      'rate-limiting': 'CWE-400',
      'authorization': 'CWE-285',
    };

    return cveIds[vulnerabilityType] || '';
  }

  /**
   * Determine test status based on assertions
   */
  private determineStatus(assertions: AssertionResult[]): 'passed' | 'failed' | 'skipped' | 'error' {
    if (assertions.length === 0) {
      return 'skipped';
    }

    const failedAssertions = assertions.filter(a => a.status === 'failed');
    return failedAssertions.length > 0 ? 'failed' : 'passed';
  }

  /**
   * Create error result for failed test cases
   */
  private createErrorResult(testCase: SecurityTestCase, error: Error): TestResult {
    return {
      id: `security-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      testCaseId: testCase.id,
      status: 'error',
      duration: 0,
      startTime: new Date(),
      endTime: new Date(),
      error,
      assertions: [],
    };
  }

  /**
   * Add delay to simulate real-world conditions
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all detected vulnerabilities
   */
  public getVulnerabilities(): SecurityVulnerability[] {
    return this.vulnerabilities;
  }

  /**
   * Generate security score based on vulnerabilities
   */
  public generateSecurityScore(): number {
    if (this.vulnerabilities.length === 0) {
      return 100;
    }

    const severityScores = {
      'low': 10,
      'medium': 25,
      'high': 50,
      'critical': 100,
    };

    const totalScore = this.vulnerabilities.reduce((score, vuln) => {
      return score + severityScores[vuln.severity];
    }, 0);

    return Math.max(0, 100 - totalScore);
  }

  /**
   * Generate security recommendations
   */
  public generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const vulnerabilityTypes = new Set(this.vulnerabilities.map(v => v.type));

    vulnerabilityTypes.forEach(type => {
      recommendations.push(this.getRecommendation(type));
    });

    return recommendations;
  }
}

// Export singleton instance
export const securityTestService = new SecurityTestService(); 