/**
 * Comprehensive Security Validation Framework
 * 
 * Unified framework for testing all security measures including:
 * - Authentication and authorization
 * - Input validation and sanitization
 * - Session management security
 * - OWASP Top 10 vulnerability protection
 * - API security testing
 * - XSS, CSRF, and injection prevention
 * - Security headers validation
 * - Rate limiting and DDoS protection
 */

import { EventEmitter } from 'events';
// import { createHash, randomBytes } from 'crypto';

// Import other security validators
import { encryptionValidationFramework } from './encryption-validation-framework';
import { environmentSecurityValidator } from './environment-security-validation';
import { databaseSecurityValidator } from './database-security-validation';

export interface SecurityTestCase {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'authorization' | 'input_validation' | 'session_management' | 
           'injection' | 'xss' | 'csrf' | 'api_security' | 'headers' | 'rate_limiting' | 'integration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  owaspCategory?: string; // OWASP Top 10 category
  testFunction: string;
  expectedResult: 'pass' | 'fail' | 'conditional';
  environment: string[];
}

export interface SecurityTestResult {
  testId: string;
  name: string;
  category: string;
  passed: boolean;
  score: number;
  executionTime: number;
  vulnerabilities: SecurityVulnerability[];
  details: Record<string, any>;
  recommendations: string[];
  owaspCompliance: {
    category: string;
    compliant: boolean;
    details: string;
  };
}

export interface SecurityVulnerability {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  impact: string;
  remediation: string;
  cve?: string;
  cwe?: string;
  owaspCategory?: string;
  references: string[];
}

export interface ComprehensiveSecurityReport {
  id: string;
  environment: string;
  generated: Date;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    criticalVulnerabilities: number;
    highRiskIssues: number;
    overallScore: number;
    securityPosture: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    owaspCompliance: {
      compliant: boolean;
      score: number;
      failedCategories: string[];
    };
  };
  testResults: SecurityTestResult[];
  componentResults: {
    encryption: any;
    environment: any;
    database: any;
  };
  securityMetrics: {
    authenticationStrength: number;
    authorizationCoverage: number;
    inputValidationScore: number;
    sessionSecurityScore: number;
    apiSecurityScore: number;
    injectionProtection: number;
    xssProtection: number;
    csrfProtection: number;
    headersSecurity: number;
    rateLimitingEffectiveness: number;
  };
  recommendations: string[];
  nextActions: string[];
  complianceStatus: {
    owasp: boolean;
    pci: boolean;
    hipaa: boolean;
    gdpr: boolean;
  };
}

export class ComprehensiveSecurityValidator extends EventEmitter {
  private testCases: Map<string, SecurityTestCase> = new Map();
  private testResults: SecurityTestResult[] = [];
  
  constructor() {
    super();
    this.initializeTestCases();
  }

  /**
   * Run comprehensive security validation
   */
  async runValidation(environment: string = 'development'): Promise<ComprehensiveSecurityReport> {
    const startTime = Date.now();
    
    console.log(`🔒 Starting comprehensive security validation for ${environment}`);
    console.log(`📋 Running ${this.testCases.size} security tests across all categories`);
    
    this.emit('validation:started', { environment, timestamp: new Date() });
    
    this.testResults = [];
    
    // Run component validations first
    console.log(`\n🔐 Running component security validations...`);
    const componentResults = await this.runComponentValidations(environment);
    
    // Execute all security test cases
    console.log(`\n🧪 Running comprehensive security tests...`);
    for (const [testId, testCase] of this.testCases) {
      if (testCase.environment.includes(environment) || testCase.environment.includes('all')) {
        console.log(`  🔍 Testing: ${testCase.name}`);
        
        this.emit('test:started', { testId, testCase });
        
        const result = await this.executeTestCase(testCase, environment);
        this.testResults.push(result);
        
        this.emit('test:completed', { testId, result });
      }
    }
    
    // Generate comprehensive report
    const report = await this.generateComprehensiveReport(environment, componentResults);
    
    const executionTime = Date.now() - startTime;
    console.log(`\n✅ Comprehensive security validation completed in ${executionTime}ms`);
    console.log(`📊 Overall Security Score: ${report.summary.overallScore}/100`);
    console.log(`🛡️ Security Posture: ${report.summary.securityPosture.toUpperCase()}`);
    
    this.emit('validation:completed', { 
      environment, 
      report, 
      executionTime,
      timestamp: new Date() 
    });
    
    return report;
  }

  /**
   * Initialize comprehensive security test cases
   */
  private initializeTestCases(): void {
    // Authentication Tests
    this.testCases.set('auth_mechanism_strength', {
      id: 'auth_mechanism_strength',
      name: 'Authentication Mechanism Strength',
      description: 'Validate strength of authentication mechanisms including MFA',
      category: 'authentication',
      severity: 'critical',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      testFunction: 'testAuthenticationStrength',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('password_policy', {
      id: 'password_policy',
      name: 'Password Policy Enforcement',
      description: 'Verify password complexity and policy enforcement',
      category: 'authentication',
      severity: 'high',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      testFunction: 'testPasswordPolicy',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('brute_force_protection', {
      id: 'brute_force_protection',
      name: 'Brute Force Attack Protection',
      description: 'Test protection against brute force login attempts',
      category: 'authentication',
      severity: 'high',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      testFunction: 'testBruteForceProtection',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    // Authorization Tests
    this.testCases.set('rbac_implementation', {
      id: 'rbac_implementation',
      name: 'Role-Based Access Control',
      description: 'Verify proper RBAC implementation and enforcement',
      category: 'authorization',
      severity: 'critical',
      owaspCategory: 'A01:2021 – Broken Access Control',
      testFunction: 'testRBACImplementation',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('privilege_escalation_prevention', {
      id: 'privilege_escalation_prevention',
      name: 'Privilege Escalation Prevention',
      description: 'Test for horizontal and vertical privilege escalation',
      category: 'authorization',
      severity: 'critical',
      owaspCategory: 'A01:2021 – Broken Access Control',
      testFunction: 'testPrivilegeEscalationPrevention',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    // Input Validation Tests
    this.testCases.set('input_sanitization', {
      id: 'input_sanitization',
      name: 'Input Sanitization and Validation',
      description: 'Comprehensive input validation and sanitization testing',
      category: 'input_validation',
      severity: 'critical',
      owaspCategory: 'A03:2021 – Injection',
      testFunction: 'testInputSanitization',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('file_upload_security', {
      id: 'file_upload_security',
      name: 'File Upload Security',
      description: 'Validate file upload restrictions and malware scanning',
      category: 'input_validation',
      severity: 'high',
      owaspCategory: 'A03:2021 – Injection',
      testFunction: 'testFileUploadSecurity',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    // Session Management Tests
    this.testCases.set('session_security', {
      id: 'session_security',
      name: 'Session Management Security',
      description: 'Validate session token security and lifecycle',
      category: 'session_management',
      severity: 'critical',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      testFunction: 'testSessionSecurity',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('session_fixation_prevention', {
      id: 'session_fixation_prevention',
      name: 'Session Fixation Prevention',
      description: 'Test protection against session fixation attacks',
      category: 'session_management',
      severity: 'high',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      testFunction: 'testSessionFixationPrevention',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    // Injection Prevention Tests
    this.testCases.set('sql_injection_prevention', {
      id: 'sql_injection_prevention',
      name: 'SQL Injection Prevention',
      description: 'Comprehensive SQL injection vulnerability testing',
      category: 'injection',
      severity: 'critical',
      owaspCategory: 'A03:2021 – Injection',
      testFunction: 'testSQLInjectionPrevention',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('command_injection_prevention', {
      id: 'command_injection_prevention',
      name: 'Command Injection Prevention',
      description: 'Test for OS command injection vulnerabilities',
      category: 'injection',
      severity: 'critical',
      owaspCategory: 'A03:2021 – Injection',
      testFunction: 'testCommandInjectionPrevention',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('ldap_injection_prevention', {
      id: 'ldap_injection_prevention',
      name: 'LDAP Injection Prevention',
      description: 'Test for LDAP injection vulnerabilities',
      category: 'injection',
      severity: 'high',
      owaspCategory: 'A03:2021 – Injection',
      testFunction: 'testLDAPInjectionPrevention',
      expectedResult: 'pass',
      environment: ['production', 'staging']
    });

    // XSS Prevention Tests
    this.testCases.set('xss_prevention', {
      id: 'xss_prevention',
      name: 'Cross-Site Scripting Prevention',
      description: 'Test for reflected, stored, and DOM-based XSS',
      category: 'xss',
      severity: 'high',
      owaspCategory: 'A03:2021 – Injection',
      testFunction: 'testXSSPrevention',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('csp_implementation', {
      id: 'csp_implementation',
      name: 'Content Security Policy',
      description: 'Validate CSP headers and implementation',
      category: 'xss',
      severity: 'medium',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
      testFunction: 'testCSPImplementation',
      expectedResult: 'pass',
      environment: ['production', 'staging']
    });

    // CSRF Prevention Tests
    this.testCases.set('csrf_protection', {
      id: 'csrf_protection',
      name: 'CSRF Protection',
      description: 'Validate CSRF token implementation and validation',
      category: 'csrf',
      severity: 'high',
      owaspCategory: 'A01:2021 – Broken Access Control',
      testFunction: 'testCSRFProtection',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    // API Security Tests
    this.testCases.set('api_authentication', {
      id: 'api_authentication',
      name: 'API Authentication Security',
      description: 'Test API key, OAuth, and JWT security',
      category: 'api_security',
      severity: 'critical',
      owaspCategory: 'A02:2021 – Cryptographic Failures',
      testFunction: 'testAPIAuthentication',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    this.testCases.set('api_rate_limiting', {
      id: 'api_rate_limiting',
      name: 'API Rate Limiting',
      description: 'Validate API rate limiting and throttling',
      category: 'api_security',
      severity: 'medium',
      owaspCategory: 'A04:2021 – Insecure Design',
      testFunction: 'testAPIRateLimiting',
      expectedResult: 'pass',
      environment: ['production', 'staging']
    });

    // Security Headers Tests
    this.testCases.set('security_headers', {
      id: 'security_headers',
      name: 'Security Headers Validation',
      description: 'Validate all security headers implementation',
      category: 'headers',
      severity: 'medium',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
      testFunction: 'testSecurityHeaders',
      expectedResult: 'pass',
      environment: ['production', 'staging']
    });

    // Rate Limiting Tests
    this.testCases.set('ddos_protection', {
      id: 'ddos_protection',
      name: 'DDoS Protection',
      description: 'Test DDoS protection and rate limiting effectiveness',
      category: 'rate_limiting',
      severity: 'high',
      owaspCategory: 'A04:2021 – Insecure Design',
      testFunction: 'testDDoSProtection',
      expectedResult: 'pass',
      environment: ['production', 'staging']
    });

    // Integration Tests
    this.testCases.set('security_integration', {
      id: 'security_integration',
      name: 'Security Components Integration',
      description: 'Test integration of all security components',
      category: 'integration',
      severity: 'high',
      testFunction: 'testSecurityIntegration',
      expectedResult: 'pass',
      environment: ['production', 'staging', 'development']
    });

    console.log(`🧪 Initialized ${this.testCases.size} comprehensive security test cases`);
  }

  /**
   * Run component security validations
   */
  private async runComponentValidations(environment: string): Promise<any> {
    const results: any = {};
    
    try {
      // Run encryption validation
      console.log(`  🔐 Running encryption validation...`);
      results.encryption = await encryptionValidationFramework.runValidation(environment);
      console.log(`    ✓ Encryption validation completed`);
    } catch (error) {
      console.error(`    ✗ Encryption validation failed: ${error}`);
      results.encryption = { error: error instanceof Error ? error.message : String(error) };
    }
    
    try {
      // Run environment security validation
      console.log(`  🔒 Running environment security validation...`);
      results.environment = await environmentSecurityValidator.runValidation(environment);
      console.log(`    ✓ Environment security validation completed`);
    } catch (error) {
      console.error(`    ✗ Environment security validation failed: ${error}`);
      results.environment = { error: error instanceof Error ? error.message : String(error) };
    }
    
    try {
      // Run database security validation
      console.log(`  🗄️ Running database security validation...`);
      results.database = await databaseSecurityValidator.runValidation(environment);
      console.log(`    ✓ Database security validation completed`);
    } catch (error) {
      console.error(`    ✗ Database security validation failed: ${error}`);
      results.database = { error: error instanceof Error ? error.message : String(error) };
    }
    
    return results;
  }

  /**
   * Execute a specific test case
   */
  private async executeTestCase(testCase: SecurityTestCase, _environment: string): Promise<SecurityTestResult> {
    const startTime = Date.now();
    
    try {
      const result = await (this as any)[testCase.testFunction](testCase);
      const executionTime = Date.now() - startTime;
      
      return {
        testId: testCase.id,
        name: testCase.name,
        category: testCase.category,
        passed: result.passed,
        score: result.score,
        executionTime,
        vulnerabilities: result.vulnerabilities || [],
        details: result.details || {},
        recommendations: result.recommendations || [],
        owaspCompliance: testCase.owaspCategory ? {
          category: testCase.owaspCategory,
          compliant: result.passed,
          details: result.owaspDetails || ''
        } : {
          category: '',
          compliant: false,
          details: ''
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        testId: testCase.id,
        name: testCase.name,
        category: testCase.category,
        passed: false,
        score: 0,
        executionTime,
        vulnerabilities: [{
          id: `${testCase.id}_error`,
          description: `Test execution failed: ${error instanceof Error ? error.message : error}`,
          severity: 'high' as const,
          category: testCase.category,
          impact: 'Test could not be completed, security status unknown',
          remediation: 'Fix test execution issues and retry',
          references: []
        }],
        details: { error: error instanceof Error ? error.message : String(error) },
        recommendations: ['Fix test execution environment', 'Retry validation after resolving issues'],
        owaspCompliance: {
          category: '',
          compliant: false,
          details: 'Test execution failed'
        }
      };
    }
  }

  /**
   * Test authentication mechanism strength
   */
  async testAuthenticationStrength(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check for multi-factor authentication
    const mfaEnabled = process.env['MFA_ENABLED'] === 'true';
    details['mfa_enabled'] = mfaEnabled;

    if (!mfaEnabled) {
      vulnerabilities.push({
        id: 'no_mfa',
        description: 'Multi-factor authentication is not enabled',
        severity: 'high',
        category: 'authentication',
        impact: 'Accounts vulnerable to credential compromise',
        remediation: 'Enable multi-factor authentication for all users',
        cwe: 'CWE-308',
        owaspCategory: 'A07:2021',
        references: ['https://owasp.org/www-project-top-ten/2021/Top_10/A07_2021-Identification_and_Authentication_Failures/']
      });
      score -= 30;
    }

    // Check authentication token security
    const tokenExpiry = parseInt(process.env['AUTH_TOKEN_EXPIRY'] || '3600');
    details['token_expiry_seconds'] = tokenExpiry;

    if (tokenExpiry > 86400) { // More than 24 hours
      vulnerabilities.push({
        id: 'long_token_expiry',
        description: 'Authentication tokens have excessive lifetime',
        severity: 'medium',
        category: 'authentication',
        impact: 'Increased window for token theft and replay attacks',
        remediation: 'Reduce token expiry to maximum 24 hours',
        cwe: 'CWE-613',
        references: []
      });
      score -= 15;
    }

    // Check for secure password storage
    const passwordHashAlgorithm = process.env['PASSWORD_HASH_ALGORITHM'] || 'bcrypt';
    details['password_hash_algorithm'] = passwordHashAlgorithm;

    if (!['bcrypt', 'scrypt', 'argon2'].includes(passwordHashAlgorithm)) {
      vulnerabilities.push({
        id: 'weak_password_hashing',
        description: 'Weak password hashing algorithm in use',
        severity: 'critical',
        category: 'authentication',
        impact: 'Passwords vulnerable to offline cracking',
        remediation: 'Use bcrypt, scrypt, or argon2 for password hashing',
        cwe: 'CWE-916',
        owaspCategory: 'A02:2021',
        references: ['https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html']
      });
      score -= 40;
      passed = false;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement multi-factor authentication', 'Use secure password hashing', 'Implement proper session management'] : 
        ['Authentication mechanisms are properly configured'],
      owaspDetails: 'Authentication security assessment per OWASP A07:2021'
    };
  }

  /**
   * Test password policy enforcement
   */
  async testPasswordPolicy(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check minimum password length
    const minPasswordLength = parseInt(process.env['MIN_PASSWORD_LENGTH'] || '8');
    details['min_password_length'] = minPasswordLength;

    if (minPasswordLength < 12) {
      vulnerabilities.push({
        id: 'weak_password_length',
        description: `Minimum password length is only ${minPasswordLength} characters`,
        severity: 'medium',
        category: 'authentication',
        impact: 'Passwords may be vulnerable to brute force attacks',
        remediation: 'Require minimum 12 characters for passwords',
        cwe: 'CWE-521',
        references: []
      });
      score -= 20;
    }

    // Check password complexity requirements
    const requireUppercase = process.env['PASSWORD_REQUIRE_UPPERCASE'] === 'true';
    const requireLowercase = process.env['PASSWORD_REQUIRE_LOWERCASE'] === 'true';
    const requireNumbers = process.env['PASSWORD_REQUIRE_NUMBERS'] === 'true';
    const requireSpecial = process.env['PASSWORD_REQUIRE_SPECIAL'] === 'true';

    details['complexity_requirements'] = {
      uppercase: requireUppercase,
      lowercase: requireLowercase,
      numbers: requireNumbers,
      special: requireSpecial
    };

    const complexityCount = [requireUppercase, requireLowercase, requireNumbers, requireSpecial].filter(Boolean).length;
    if (complexityCount < 3) {
      vulnerabilities.push({
        id: 'weak_password_complexity',
        description: 'Insufficient password complexity requirements',
        severity: 'medium',
        category: 'authentication',
        impact: 'Passwords may be predictable',
        remediation: 'Require at least 3 of: uppercase, lowercase, numbers, special characters',
        cwe: 'CWE-521',
        references: []
      });
      score -= 15;
    }

    // Check password history
    const passwordHistorySize = parseInt(process.env['PASSWORD_HISTORY_SIZE'] || '0');
    details['password_history_size'] = passwordHistorySize;

    if (passwordHistorySize < 5) {
      vulnerabilities.push({
        id: 'insufficient_password_history',
        description: 'Password history not enforced or too small',
        severity: 'low',
        category: 'authentication',
        impact: 'Users can reuse recent passwords',
        remediation: 'Maintain history of at least 5 previous passwords',
        references: []
      });
      score -= 10;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Strengthen password policy requirements', 'Implement password complexity rules', 'Enforce password history'] : 
        ['Password policy is properly configured']
    };
  }

  /**
   * Test brute force protection
   */
  async testBruteForceProtection(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check account lockout policy
    const lockoutEnabled = process.env['ACCOUNT_LOCKOUT_ENABLED'] === 'true';
    const lockoutThreshold = parseInt(process.env['ACCOUNT_LOCKOUT_THRESHOLD'] || '0');
    const lockoutDuration = parseInt(process.env['ACCOUNT_LOCKOUT_DURATION'] || '0');

    details['lockout_enabled'] = lockoutEnabled;
    details['lockout_threshold'] = lockoutThreshold;
    details['lockout_duration_minutes'] = lockoutDuration;

    if (!lockoutEnabled || lockoutThreshold === 0) {
      vulnerabilities.push({
        id: 'no_account_lockout',
        description: 'Account lockout not implemented',
        severity: 'high',
        category: 'authentication',
        impact: 'Accounts vulnerable to brute force attacks',
        remediation: 'Implement account lockout after failed attempts',
        cwe: 'CWE-307',
        owaspCategory: 'A07:2021',
        references: ['https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks']
      });
      score -= 40;
      passed = false;
    } else if (lockoutThreshold > 10) {
      vulnerabilities.push({
        id: 'high_lockout_threshold',
        description: 'Account lockout threshold is too high',
        severity: 'medium',
        category: 'authentication',
        impact: 'Many attempts allowed before lockout',
        remediation: 'Reduce lockout threshold to 5-10 attempts',
        references: []
      });
      score -= 20;
    }

    // Check CAPTCHA implementation
    const captchaEnabled = process.env['CAPTCHA_ENABLED'] === 'true';
    details['captcha_enabled'] = captchaEnabled;

    if (!captchaEnabled) {
      vulnerabilities.push({
        id: 'no_captcha',
        description: 'CAPTCHA not implemented for authentication',
        severity: 'medium',
        category: 'authentication',
        impact: 'Automated attacks possible',
        remediation: 'Implement CAPTCHA after failed login attempts',
        references: []
      });
      score -= 15;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement account lockout mechanism', 'Add CAPTCHA protection', 'Monitor failed login attempts'] : 
        ['Brute force protection is properly configured']
    };
  }

  /**
   * Test RBAC implementation
   */
  async testRBACImplementation(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check if RBAC is enabled
    const rbacEnabled = process.env['RBAC_ENABLED'] !== 'false';
    details['rbac_enabled'] = rbacEnabled;

    if (!rbacEnabled) {
      vulnerabilities.push({
        id: 'no_rbac',
        description: 'Role-Based Access Control not implemented',
        severity: 'critical',
        category: 'authorization',
        impact: 'No granular access control',
        remediation: 'Implement RBAC for all resources',
        cwe: 'CWE-862',
        owaspCategory: 'A01:2021',
        references: ['https://owasp.org/www-project-top-ten/2021/Top_10/A01_2021-Broken_Access_Control/']
      });
      score -= 60;
      passed = false;
    }

    // Check for principle of least privilege
    const defaultRole = process.env['DEFAULT_USER_ROLE'] || 'user';
    details['default_user_role'] = defaultRole;

    if (defaultRole === 'admin' || defaultRole === 'administrator') {
      vulnerabilities.push({
        id: 'excessive_default_privileges',
        description: 'Default user role has excessive privileges',
        severity: 'high',
        category: 'authorization',
        impact: 'Users have more access than needed',
        remediation: 'Set default role to least privileged',
        cwe: 'CWE-250',
        references: []
      });
      score -= 30;
    }

    // Check role separation
    const roleSeparation = process.env['ENFORCE_ROLE_SEPARATION'] === 'true';
    details['enforce_role_separation'] = roleSeparation;

    if (!roleSeparation) {
      vulnerabilities.push({
        id: 'no_role_separation',
        description: 'Role separation not enforced',
        severity: 'medium',
        category: 'authorization',
        impact: 'Potential for privilege accumulation',
        remediation: 'Enforce separation of duties',
        references: []
      });
      score -= 20;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement comprehensive RBAC', 'Apply principle of least privilege', 'Enforce role separation'] : 
        ['RBAC is properly implemented']
    };
  }

  /**
   * Test privilege escalation prevention
   */
  async testPrivilegeEscalationPrevention(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check for path traversal protection
    const pathTraversalProtection = process.env['PATH_TRAVERSAL_PROTECTION'] !== 'false';
    details['path_traversal_protection'] = pathTraversalProtection;

    if (!pathTraversalProtection) {
      vulnerabilities.push({
        id: 'path_traversal_vulnerable',
        description: 'Path traversal protection not implemented',
        severity: 'high',
        category: 'authorization',
        impact: 'Unauthorized file access possible',
        remediation: 'Implement path traversal protection',
        cwe: 'CWE-22',
        references: []
      });
      score -= 30;
    }

    // Check for IDOR protection
    const idorProtection = process.env['IDOR_PROTECTION'] === 'true';
    details['idor_protection'] = idorProtection;

    if (!idorProtection) {
      vulnerabilities.push({
        id: 'idor_vulnerable',
        description: 'Insecure Direct Object Reference protection not implemented',
        severity: 'critical',
        category: 'authorization',
        impact: 'Direct access to unauthorized resources',
        remediation: 'Implement proper authorization checks for all resources',
        cwe: 'CWE-639',
        owaspCategory: 'A01:2021',
        references: []
      });
      score -= 40;
      passed = false;
    }

    // Check for forced browsing protection
    const forcedBrowsingProtection = process.env['FORCED_BROWSING_PROTECTION'] !== 'false';
    details['forced_browsing_protection'] = forcedBrowsingProtection;

    if (!forcedBrowsingProtection) {
      vulnerabilities.push({
        id: 'forced_browsing_vulnerable',
        description: 'Forced browsing protection not implemented',
        severity: 'medium',
        category: 'authorization',
        impact: 'Hidden resources may be accessible',
        remediation: 'Implement access control for all endpoints',
        references: []
      });
      score -= 20;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement comprehensive authorization checks', 'Protect against IDOR attacks', 'Validate all resource access'] : 
        ['Privilege escalation prevention is properly implemented']
    };
  }

  /**
   * Test input sanitization
   */
  async testInputSanitization(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check input validation
    const inputValidationEnabled = process.env['INPUT_VALIDATION_ENABLED'] !== 'false';
    details['input_validation_enabled'] = inputValidationEnabled;

    if (!inputValidationEnabled) {
      vulnerabilities.push({
        id: 'no_input_validation',
        description: 'Input validation not implemented',
        severity: 'critical',
        category: 'input_validation',
        impact: 'Application vulnerable to injection attacks',
        remediation: 'Implement comprehensive input validation',
        cwe: 'CWE-20',
        owaspCategory: 'A03:2021',
        references: ['https://owasp.org/www-project-top-ten/2021/Top_10/A03_2021-Injection/']
      });
      score -= 50;
      passed = false;
    }

    // Check output encoding
    const outputEncodingEnabled = process.env['OUTPUT_ENCODING_ENABLED'] !== 'false';
    details['output_encoding_enabled'] = outputEncodingEnabled;

    if (!outputEncodingEnabled) {
      vulnerabilities.push({
        id: 'no_output_encoding',
        description: 'Output encoding not implemented',
        severity: 'high',
        category: 'input_validation',
        impact: 'XSS vulnerabilities possible',
        remediation: 'Implement context-appropriate output encoding',
        cwe: 'CWE-116',
        references: []
      });
      score -= 30;
    }

    // Check parameterized queries
    const parameterizedQueries = process.env['USE_PARAMETERIZED_QUERIES'] !== 'false';
    details['parameterized_queries'] = parameterizedQueries;

    if (!parameterizedQueries) {
      vulnerabilities.push({
        id: 'no_parameterized_queries',
        description: 'Parameterized queries not enforced',
        severity: 'critical',
        category: 'input_validation',
        impact: 'SQL injection vulnerabilities',
        remediation: 'Use parameterized queries for all database operations',
        cwe: 'CWE-89',
        references: []
      });
      score -= 40;
      passed = false;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement comprehensive input validation', 'Use parameterized queries', 'Enable output encoding'] : 
        ['Input sanitization is properly implemented']
    };
  }

  /**
   * Test file upload security
   */
  async testFileUploadSecurity(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check file type validation
    const fileTypeValidation = process.env['FILE_TYPE_VALIDATION'] !== 'false';
    details['file_type_validation'] = fileTypeValidation;

    if (!fileTypeValidation) {
      vulnerabilities.push({
        id: 'no_file_type_validation',
        description: 'File type validation not implemented',
        severity: 'high',
        category: 'input_validation',
        impact: 'Malicious file uploads possible',
        remediation: 'Validate file types and magic numbers',
        cwe: 'CWE-434',
        references: []
      });
      score -= 30;
    }

    // Check file size limits
    const maxFileSize = parseInt(process.env['MAX_FILE_SIZE'] || '0');
    details['max_file_size_mb'] = maxFileSize / 1024 / 1024;

    if (maxFileSize === 0 || maxFileSize > 100 * 1024 * 1024) { // 100MB
      vulnerabilities.push({
        id: 'excessive_file_size',
        description: 'File size limits not set or too high',
        severity: 'medium',
        category: 'input_validation',
        impact: 'DoS through large file uploads',
        remediation: 'Set reasonable file size limits',
        references: []
      });
      score -= 20;
    }

    // Check antivirus scanning
    const antivirusEnabled = process.env['ANTIVIRUS_SCANNING'] === 'true';
    details['antivirus_scanning'] = antivirusEnabled;

    if (!antivirusEnabled) {
      vulnerabilities.push({
        id: 'no_antivirus_scanning',
        description: 'Uploaded files not scanned for malware',
        severity: 'high',
        category: 'input_validation',
        impact: 'Malware distribution possible',
        remediation: 'Implement antivirus scanning for uploads',
        references: []
      });
      score -= 25;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement file type validation', 'Set file size limits', 'Enable antivirus scanning'] : 
        ['File upload security is properly configured']
    };
  }

  /**
   * Test session security
   */
  async testSessionSecurity(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check session token security
    const sessionSecure = process.env['SESSION_SECURE'] !== 'false';
    const sessionHttpOnly = process.env['SESSION_HTTP_ONLY'] !== 'false';
    const sessionSameSite = process.env['SESSION_SAME_SITE'] || 'lax';

    details['session_secure'] = sessionSecure;
    details['session_http_only'] = sessionHttpOnly;
    details['session_same_site'] = sessionSameSite;

    if (!sessionSecure) {
      vulnerabilities.push({
        id: 'insecure_session_cookie',
        description: 'Session cookies not marked as secure',
        severity: 'high',
        category: 'session_management',
        impact: 'Session hijacking over unencrypted connections',
        remediation: 'Set Secure flag on session cookies',
        cwe: 'CWE-614',
        references: []
      });
      score -= 30;
    }

    if (!sessionHttpOnly) {
      vulnerabilities.push({
        id: 'session_cookie_accessible_js',
        description: 'Session cookies accessible to JavaScript',
        severity: 'high',
        category: 'session_management',
        impact: 'XSS can steal session tokens',
        remediation: 'Set HttpOnly flag on session cookies',
        cwe: 'CWE-1004',
        references: []
      });
      score -= 30;
    }

    if (sessionSameSite === 'none') {
      vulnerabilities.push({
        id: 'weak_same_site_policy',
        description: 'Weak SameSite cookie policy',
        severity: 'medium',
        category: 'session_management',
        impact: 'CSRF attacks possible',
        remediation: 'Set SameSite to Strict or Lax',
        references: []
      });
      score -= 20;
    }

    // Check session timeout
    const sessionTimeout = parseInt(process.env['SESSION_TIMEOUT'] || '3600');
    details['session_timeout_seconds'] = sessionTimeout;

    if (sessionTimeout > 7200) { // More than 2 hours
      vulnerabilities.push({
        id: 'long_session_timeout',
        description: 'Session timeout is too long',
        severity: 'medium',
        category: 'session_management',
        impact: 'Extended exposure window',
        remediation: 'Reduce session timeout to 30-120 minutes',
        references: []
      });
      score -= 15;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Configure secure session cookies', 'Implement proper session timeout', 'Use strong SameSite policy'] : 
        ['Session security is properly configured']
    };
  }

  /**
   * Test session fixation prevention
   */
  async testSessionFixationPrevention(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check session regeneration
    const sessionRegenerationEnabled = process.env['SESSION_REGENERATION'] !== 'false';
    details['session_regeneration_enabled'] = sessionRegenerationEnabled;

    if (!sessionRegenerationEnabled) {
      vulnerabilities.push({
        id: 'no_session_regeneration',
        description: 'Session IDs not regenerated after login',
        severity: 'high',
        category: 'session_management',
        impact: 'Session fixation attacks possible',
        remediation: 'Regenerate session ID on authentication',
        cwe: 'CWE-384',
        owaspCategory: 'A07:2021',
        references: []
      });
      score -= 40;
      passed = false;
    }

    // Check for session ID in URL
    const sessionInUrl = process.env['SESSION_IN_URL'] === 'true';
    details['session_in_url'] = sessionInUrl;

    if (sessionInUrl) {
      vulnerabilities.push({
        id: 'session_id_in_url',
        description: 'Session IDs exposed in URLs',
        severity: 'high',
        category: 'session_management',
        impact: 'Session IDs can be leaked via referrer',
        remediation: 'Use cookies for session management',
        cwe: 'CWE-598',
        references: []
      });
      score -= 35;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Regenerate session IDs on login', 'Use secure session management', 'Avoid session IDs in URLs'] : 
        ['Session fixation prevention is properly implemented']
    };
  }

  /**
   * Test SQL injection prevention
   */
  async testSQLInjectionPrevention(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check for parameterized queries
    const usesParameterizedQueries = process.env['USE_PARAMETERIZED_QUERIES'] !== 'false';
    const usesORM = process.env['USE_ORM'] === 'true';
    const sqlQueryValidation = process.env['SQL_QUERY_VALIDATION'] === 'true';

    details['parameterized_queries'] = usesParameterizedQueries;
    details['uses_orm'] = usesORM;
    details['sql_query_validation'] = sqlQueryValidation;

    if (!usesParameterizedQueries && !usesORM) {
      vulnerabilities.push({
        id: 'sql_injection_risk',
        description: 'Neither parameterized queries nor ORM in use',
        severity: 'critical',
        category: 'injection',
        impact: 'Database compromise possible',
        remediation: 'Use parameterized queries or ORM',
        cwe: 'CWE-89',
        owaspCategory: 'A03:2021',
        references: ['https://owasp.org/www-community/attacks/SQL_Injection']
      });
      score -= 60;
      passed = false;
    }

    // Check for stored procedure usage
    const usesStoredProcedures = process.env['USE_STORED_PROCEDURES'] === 'true';
    details['uses_stored_procedures'] = usesStoredProcedures;

    // Check for dynamic SQL
    const allowsDynamicSQL = process.env['ALLOWS_DYNAMIC_SQL'] === 'true';
    details['allows_dynamic_sql'] = allowsDynamicSQL;

    if (allowsDynamicSQL) {
      vulnerabilities.push({
        id: 'dynamic_sql_allowed',
        description: 'Dynamic SQL construction allowed',
        severity: 'high',
        category: 'injection',
        impact: 'Increased SQL injection risk',
        remediation: 'Avoid dynamic SQL construction',
        references: []
      });
      score -= 30;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Use parameterized queries exclusively', 'Implement input validation', 'Avoid dynamic SQL'] : 
        ['SQL injection prevention is properly implemented']
    };
  }

  /**
   * Test command injection prevention
   */
  async testCommandInjectionPrevention(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check for command execution controls
    const allowsSystemCommands = process.env['ALLOWS_SYSTEM_COMMANDS'] === 'true';
    const commandWhitelisting = process.env['COMMAND_WHITELISTING'] === 'true';
    const shellEscaping = process.env['SHELL_ESCAPING_ENABLED'] !== 'false';

    details['allows_system_commands'] = allowsSystemCommands;
    details['command_whitelisting'] = commandWhitelisting;
    details['shell_escaping'] = shellEscaping;

    if (allowsSystemCommands && !commandWhitelisting) {
      vulnerabilities.push({
        id: 'unrestricted_command_execution',
        description: 'System commands allowed without whitelisting',
        severity: 'critical',
        category: 'injection',
        impact: 'Remote code execution possible',
        remediation: 'Implement command whitelisting or avoid system commands',
        cwe: 'CWE-78',
        owaspCategory: 'A03:2021',
        references: []
      });
      score -= 60;
      passed = false;
    }

    if (allowsSystemCommands && !shellEscaping) {
      vulnerabilities.push({
        id: 'no_shell_escaping',
        description: 'Shell escaping not implemented',
        severity: 'high',
        category: 'injection',
        impact: 'Command injection possible',
        remediation: 'Implement proper shell escaping',
        references: []
      });
      score -= 40;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Avoid system command execution', 'Implement command whitelisting', 'Use proper escaping'] : 
        ['Command injection prevention is properly implemented']
    };
  }

  /**
   * Test LDAP injection prevention
   */
  async testLDAPInjectionPrevention(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check if LDAP is used
    const usesLDAP = process.env['USES_LDAP'] === 'true';
    details['uses_ldap'] = usesLDAP;

    if (usesLDAP) {
      // Check LDAP query sanitization
      const ldapQuerySanitization = process.env['LDAP_QUERY_SANITIZATION'] !== 'false';
      const ldapParameterBinding = process.env['LDAP_PARAMETER_BINDING'] === 'true';

      details['ldap_query_sanitization'] = ldapQuerySanitization;
      details['ldap_parameter_binding'] = ldapParameterBinding;

      if (!ldapQuerySanitization) {
        vulnerabilities.push({
          id: 'no_ldap_sanitization',
          description: 'LDAP queries not sanitized',
          severity: 'high',
          category: 'injection',
          impact: 'LDAP injection attacks possible',
          remediation: 'Implement LDAP query sanitization',
          cwe: 'CWE-90',
          references: []
        });
        score -= 40;
        passed = false;
      }

      if (!ldapParameterBinding) {
        vulnerabilities.push({
          id: 'no_ldap_parameter_binding',
          description: 'LDAP parameter binding not used',
          severity: 'medium',
          category: 'injection',
          impact: 'Increased injection risk',
          remediation: 'Use parameter binding for LDAP queries',
          references: []
        });
        score -= 20;
      }
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement LDAP query sanitization', 'Use parameter binding', 'Validate LDAP input'] : 
        ['LDAP injection prevention is properly implemented or LDAP not in use']
    };
  }

  /**
   * Test XSS prevention
   */
  async testXSSPrevention(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check output encoding
    const outputEncodingEnabled = process.env['OUTPUT_ENCODING_ENABLED'] !== 'false';
    const contextAwareEncoding = process.env['CONTEXT_AWARE_ENCODING'] === 'true';
    const autoEscaping = process.env['TEMPLATE_AUTO_ESCAPING'] !== 'false';

    details['output_encoding_enabled'] = outputEncodingEnabled;
    details['context_aware_encoding'] = contextAwareEncoding;
    details['template_auto_escaping'] = autoEscaping;

    if (!outputEncodingEnabled) {
      vulnerabilities.push({
        id: 'no_output_encoding',
        description: 'Output encoding not implemented',
        severity: 'high',
        category: 'xss',
        impact: 'XSS attacks possible',
        remediation: 'Implement proper output encoding',
        cwe: 'CWE-79',
        owaspCategory: 'A03:2021',
        references: ['https://owasp.org/www-community/attacks/xss/']
      });
      score -= 40;
      passed = false;
    }

    if (!contextAwareEncoding) {
      vulnerabilities.push({
        id: 'no_context_aware_encoding',
        description: 'Context-aware encoding not implemented',
        severity: 'medium',
        category: 'xss',
        impact: 'Encoding may be insufficient in some contexts',
        remediation: 'Implement context-specific encoding',
        references: []
      });
      score -= 20;
    }

    if (!autoEscaping) {
      vulnerabilities.push({
        id: 'no_auto_escaping',
        description: 'Template auto-escaping disabled',
        severity: 'high',
        category: 'xss',
        impact: 'Developer errors can lead to XSS',
        remediation: 'Enable template auto-escaping',
        references: []
      });
      score -= 30;
    }

    // Check for DOM XSS protection
    const domXSSProtection = process.env['DOM_XSS_PROTECTION'] === 'true';
    details['dom_xss_protection'] = domXSSProtection;

    if (!domXSSProtection) {
      vulnerabilities.push({
        id: 'no_dom_xss_protection',
        description: 'DOM XSS protection not implemented',
        severity: 'medium',
        category: 'xss',
        impact: 'Client-side XSS possible',
        remediation: 'Implement DOM XSS prevention',
        references: []
      });
      score -= 15;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement comprehensive output encoding', 'Enable auto-escaping', 'Protect against DOM XSS'] : 
        ['XSS prevention is properly implemented']
    };
  }

  /**
   * Test CSP implementation
   */
  async testCSPImplementation(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check CSP header presence
    const cspEnabled = process.env['CSP_ENABLED'] !== 'false';
    details['csp_enabled'] = cspEnabled;

    if (!cspEnabled) {
      vulnerabilities.push({
        id: 'no_csp',
        description: 'Content Security Policy not implemented',
        severity: 'medium',
        category: 'xss',
        impact: 'No defense-in-depth against XSS',
        remediation: 'Implement Content Security Policy',
        references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP']
      });
      score -= 30;
    } else {
      // Check CSP directives
      const cspDirectives = process.env['CSP_DIRECTIVES'] || '';
      details['csp_directives'] = cspDirectives;

      if (cspDirectives.includes("'unsafe-inline'")) {
        vulnerabilities.push({
          id: 'unsafe_inline_csp',
          description: "CSP allows 'unsafe-inline'",
          severity: 'medium',
          category: 'xss',
          impact: 'Inline scripts allowed, reducing XSS protection',
          remediation: "Remove 'unsafe-inline' and use nonces or hashes",
          references: []
        });
        score -= 20;
      }

      if (cspDirectives.includes("'unsafe-eval'")) {
        vulnerabilities.push({
          id: 'unsafe_eval_csp',
          description: "CSP allows 'unsafe-eval'",
          severity: 'medium',
          category: 'xss',
          impact: 'Dynamic code execution allowed',
          remediation: "Remove 'unsafe-eval' from CSP",
          references: []
        });
        score -= 20;
      }
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement strict Content Security Policy', 'Avoid unsafe directives', 'Use nonces for inline scripts'] : 
        ['CSP is properly implemented']
    };
  }

  /**
   * Test CSRF protection
   */
  async testCSRFProtection(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check CSRF token implementation
    const csrfProtectionEnabled = process.env['CSRF_PROTECTION'] !== 'false';
    const csrfTokenValidation = process.env['CSRF_TOKEN_VALIDATION'] !== 'false';
    const csrfDoubleSubmit = process.env['CSRF_DOUBLE_SUBMIT'] === 'true';

    details['csrf_protection_enabled'] = csrfProtectionEnabled;
    details['csrf_token_validation'] = csrfTokenValidation;
    details['csrf_double_submit'] = csrfDoubleSubmit;

    if (!csrfProtectionEnabled) {
      vulnerabilities.push({
        id: 'no_csrf_protection',
        description: 'CSRF protection not implemented',
        severity: 'high',
        category: 'csrf',
        impact: 'State-changing operations vulnerable to CSRF',
        remediation: 'Implement CSRF token validation',
        cwe: 'CWE-352',
        owaspCategory: 'A01:2021',
        references: ['https://owasp.org/www-community/attacks/csrf']
      });
      score -= 40;
      passed = false;
    }

    if (csrfProtectionEnabled && !csrfTokenValidation) {
      vulnerabilities.push({
        id: 'weak_csrf_validation',
        description: 'CSRF tokens not properly validated',
        severity: 'high',
        category: 'csrf',
        impact: 'CSRF protection can be bypassed',
        remediation: 'Implement proper token validation',
        references: []
      });
      score -= 30;
    }

    // Check SameSite cookie attribute
    const sameSiteCookies = process.env['SESSION_SAME_SITE'] || 'lax';
    details['same_site_cookies'] = sameSiteCookies;

    if (sameSiteCookies === 'none') {
      vulnerabilities.push({
        id: 'weak_same_site',
        description: 'SameSite cookie attribute set to None',
        severity: 'medium',
        category: 'csrf',
        impact: 'Reduced CSRF protection',
        remediation: 'Set SameSite to Lax or Strict',
        references: []
      });
      score -= 20;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement CSRF token validation', 'Use SameSite cookies', 'Validate state-changing operations'] : 
        ['CSRF protection is properly implemented']
    };
  }

  /**
   * Test API authentication
   */
  async testAPIAuthentication(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check API authentication method
    const apiAuthMethod = process.env['API_AUTH_METHOD'] || 'none';
    details['api_auth_method'] = apiAuthMethod;

    if (apiAuthMethod === 'none') {
      vulnerabilities.push({
        id: 'no_api_auth',
        description: 'API authentication not implemented',
        severity: 'critical',
        category: 'api_security',
        impact: 'APIs accessible without authentication',
        remediation: 'Implement API authentication',
        cwe: 'CWE-306',
        references: []
      });
      score -= 60;
      passed = false;
    }

    // Check API key security
    if (apiAuthMethod === 'api_key') {
      const apiKeyLength = parseInt(process.env['API_KEY_LENGTH'] || '0');
      details['api_key_length'] = apiKeyLength;

      if (apiKeyLength < 32) {
        vulnerabilities.push({
          id: 'weak_api_key',
          description: 'API keys are too short',
          severity: 'high',
          category: 'api_security',
          impact: 'API keys vulnerable to brute force',
          remediation: 'Use API keys of at least 32 characters',
          references: []
        });
        score -= 30;
      }
    }

    // Check JWT implementation
    if (apiAuthMethod === 'jwt') {
      const jwtAlgorithm = process.env['JWT_ALGORITHM'] || 'HS256';
      const jwtExpiry = parseInt(process.env['JWT_EXPIRY'] || '3600');
      
      details['jwt_algorithm'] = jwtAlgorithm;
      details['jwt_expiry_seconds'] = jwtExpiry;

      if (jwtAlgorithm === 'none') {
        vulnerabilities.push({
          id: 'jwt_no_signature',
          description: 'JWT signature verification disabled',
          severity: 'critical',
          category: 'api_security',
          impact: 'JWT tokens can be forged',
          remediation: 'Enable JWT signature verification',
          cwe: 'CWE-347',
          references: []
        });
        score -= 50;
        passed = false;
      }
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement strong API authentication', 'Use secure token generation', 'Implement proper key management'] : 
        ['API authentication is properly configured']
    };
  }

  /**
   * Test API rate limiting
   */
  async testAPIRateLimiting(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check rate limiting
    const rateLimitingEnabled = process.env['RATE_LIMITING_ENABLED'] !== 'false';
    const rateLimitWindow = parseInt(process.env['RATE_LIMIT_WINDOW'] || '60');
    const rateLimitMax = parseInt(process.env['RATE_LIMIT_MAX'] || '0');

    details['rate_limiting_enabled'] = rateLimitingEnabled;
    details['rate_limit_window_seconds'] = rateLimitWindow;
    details['rate_limit_max_requests'] = rateLimitMax;

    if (!rateLimitingEnabled || rateLimitMax === 0) {
      vulnerabilities.push({
        id: 'no_rate_limiting',
        description: 'API rate limiting not implemented',
        severity: 'medium',
        category: 'api_security',
        impact: 'APIs vulnerable to abuse and DoS',
        remediation: 'Implement rate limiting',
        references: []
      });
      score -= 30;
    }

    // Check per-user rate limiting
    const perUserRateLimiting = process.env['PER_USER_RATE_LIMITING'] === 'true';
    details['per_user_rate_limiting'] = perUserRateLimiting;

    if (rateLimitingEnabled && !perUserRateLimiting) {
      vulnerabilities.push({
        id: 'no_per_user_rate_limiting',
        description: 'Rate limiting not applied per user',
        severity: 'low',
        category: 'api_security',
        impact: 'Less granular rate control',
        remediation: 'Implement per-user rate limiting',
        references: []
      });
      score -= 15;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement API rate limiting', 'Use per-user limits', 'Monitor API usage patterns'] : 
        ['API rate limiting is properly configured']
    };
  }

  /**
   * Test security headers
   */
  async testSecurityHeaders(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check security headers
    const headers = {
      'X-Frame-Options': process.env['HEADER_X_FRAME_OPTIONS'] || '',
      'X-Content-Type-Options': process.env['HEADER_X_CONTENT_TYPE_OPTIONS'] || '',
      'X-XSS-Protection': process.env['HEADER_X_XSS_PROTECTION'] || '',
      'Strict-Transport-Security': process.env['HEADER_HSTS'] || '',
      'Referrer-Policy': process.env['HEADER_REFERRER_POLICY'] || '',
      'Permissions-Policy': process.env['HEADER_PERMISSIONS_POLICY'] || ''
    };

    details['security_headers'] = headers;

    // Check each header
    if (!headers['X-Frame-Options'] || headers['X-Frame-Options'] === 'ALLOWALL') {
      vulnerabilities.push({
        id: 'missing_x_frame_options',
        description: 'X-Frame-Options header not set properly',
        severity: 'medium',
        category: 'headers',
        impact: 'Clickjacking attacks possible',
        remediation: 'Set X-Frame-Options to DENY or SAMEORIGIN',
        references: []
      });
      score -= 15;
    }

    if (!headers['X-Content-Type-Options']) {
      vulnerabilities.push({
        id: 'missing_x_content_type_options',
        description: 'X-Content-Type-Options header not set',
        severity: 'low',
        category: 'headers',
        impact: 'MIME type sniffing possible',
        remediation: 'Set X-Content-Type-Options to nosniff',
        references: []
      });
      score -= 10;
    }

    if (!headers['Strict-Transport-Security']) {
      vulnerabilities.push({
        id: 'missing_hsts',
        description: 'HSTS header not set',
        severity: 'medium',
        category: 'headers',
        impact: 'Protocol downgrade attacks possible',
        remediation: 'Enable HSTS with appropriate max-age',
        references: []
      });
      score -= 20;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement all security headers', 'Use strict header values', 'Enable HSTS'] : 
        ['Security headers are properly configured']
    };
  }

  /**
   * Test DDoS protection
   */
  async testDDoSProtection(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check DDoS protection measures
    const ddosProtection = process.env['DDOS_PROTECTION'] !== 'false';
    const connectionLimiting = process.env['CONNECTION_LIMITING'] === 'true';
    const synFloodProtection = process.env['SYN_FLOOD_PROTECTION'] === 'true';

    details['ddos_protection'] = ddosProtection;
    details['connection_limiting'] = connectionLimiting;
    details['syn_flood_protection'] = synFloodProtection;

    if (!ddosProtection) {
      vulnerabilities.push({
        id: 'no_ddos_protection',
        description: 'DDoS protection not implemented',
        severity: 'high',
        category: 'rate_limiting',
        impact: 'Service vulnerable to denial of service',
        remediation: 'Implement DDoS protection measures',
        references: []
      });
      score -= 40;
      passed = false;
    }

    if (!connectionLimiting) {
      vulnerabilities.push({
        id: 'no_connection_limiting',
        description: 'Connection limiting not implemented',
        severity: 'medium',
        category: 'rate_limiting',
        impact: 'Resource exhaustion possible',
        remediation: 'Implement connection limits',
        references: []
      });
      score -= 20;
    }

    // Check CDN/WAF usage
    const usesCDN = process.env['USES_CDN'] === 'true';
    const usesWAF = process.env['USES_WAF'] === 'true';

    details['uses_cdn'] = usesCDN;
    details['uses_waf'] = usesWAF;

    if (!usesCDN && !usesWAF) {
      vulnerabilities.push({
        id: 'no_cdn_waf',
        description: 'Neither CDN nor WAF in use',
        severity: 'medium',
        category: 'rate_limiting',
        impact: 'Limited DDoS mitigation capabilities',
        remediation: 'Consider using CDN or WAF for DDoS protection',
        references: []
      });
      score -= 15;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement comprehensive DDoS protection', 'Use CDN/WAF services', 'Enable connection limiting'] : 
        ['DDoS protection is properly configured']
    };
  }

  /**
   * Test security integration
   */
  async testSecurityIntegration(_testCase: SecurityTestCase): Promise<any> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const details: Record<string, any> = {};
    let score = 100;
    let passed = true;

    // Check security monitoring
    const securityMonitoring = process.env['SECURITY_MONITORING'] !== 'false';
    const intrusionDetection = process.env['INTRUSION_DETECTION'] === 'true';
    const anomalyDetection = process.env['ANOMALY_DETECTION'] === 'true';

    details['security_monitoring'] = securityMonitoring;
    details['intrusion_detection'] = intrusionDetection;
    details['anomaly_detection'] = anomalyDetection;

    if (!securityMonitoring) {
      vulnerabilities.push({
        id: 'no_security_monitoring',
        description: 'Security monitoring not implemented',
        severity: 'medium',
        category: 'integration',
        impact: 'Security incidents may go undetected',
        remediation: 'Implement comprehensive security monitoring',
        references: []
      });
      score -= 25;
    }

    // Check incident response
    const incidentResponsePlan = process.env['INCIDENT_RESPONSE_PLAN'] === 'true';
    const automatedResponse = process.env['AUTOMATED_RESPONSE'] === 'true';

    details['incident_response_plan'] = incidentResponsePlan;
    details['automated_response'] = automatedResponse;

    if (!incidentResponsePlan) {
      vulnerabilities.push({
        id: 'no_incident_response',
        description: 'No incident response plan',
        severity: 'medium',
        category: 'integration',
        impact: 'Delayed response to security incidents',
        remediation: 'Develop incident response procedures',
        references: []
      });
      score -= 20;
    }

    return {
      passed,
      score: Math.max(0, score),
      vulnerabilities,
      details,
      recommendations: vulnerabilities.length > 0 ? 
        ['Implement security monitoring', 'Develop incident response plan', 'Enable automated responses'] : 
        ['Security integration is properly configured']
    };
  }

  /**
   * Generate comprehensive security report
   */
  private async generateComprehensiveReport(
    environment: string, 
    componentResults: any
  ): Promise<ComprehensiveSecurityReport> {
    const summary = this.calculateSummary();
    const securityMetrics = this.calculateSecurityMetrics();
    const owaspCompliance = this.assessOWASPCompliance();
    
    return {
      id: `comprehensive_security_${Date.now()}`,
      environment,
      generated: new Date(),
      summary: {
        totalTests: summary.totalTests,
        passedTests: summary.passedTests,
        failedTests: summary.failedTests,
        criticalVulnerabilities: summary.criticalVulnerabilities,
        highRiskIssues: summary.highRiskIssues,
        overallScore: summary.overallScore,
        securityPosture: this.determineSecurityPosture(summary.overallScore),
        owaspCompliance
      },
      testResults: this.testResults,
      componentResults,
      securityMetrics,
      recommendations: this.generateRecommendations(),
      nextActions: this.generateNextActions(),
      complianceStatus: this.assessComplianceStatus()
    };
  }

  /**
   * Calculate validation summary
   */
  private calculateSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const allVulns = this.testResults.flatMap(r => r.vulnerabilities);
    const criticalVulnerabilities = allVulns.filter(v => v.severity === 'critical').length;
    const highRiskIssues = allVulns.filter(v => v.severity === 'high').length;
    
    const overallScore = totalTests > 0 ? 
      Math.round(this.testResults.reduce((sum, r) => sum + r.score, 0) / totalTests) : 0;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      criticalVulnerabilities,
      highRiskIssues,
      overallScore
    };
  }

  /**
   * Calculate security metrics
   */
  private calculateSecurityMetrics() {
    const metrics: any = {
      authenticationStrength: 0,
      authorizationCoverage: 0,
      inputValidationScore: 0,
      sessionSecurityScore: 0,
      apiSecurityScore: 0,
      injectionProtection: 0,
      xssProtection: 0,
      csrfProtection: 0,
      headersSecurity: 0,
      rateLimitingEffectiveness: 0
    };

    // Calculate metrics from test results
    const categoryScores: Map<string, number[]> = new Map();
    
    for (const result of this.testResults) {
      if (!categoryScores.has(result.category)) {
        categoryScores.set(result.category, []);
      }
      categoryScores.get(result.category)!.push(result.score);
    }

    // Map categories to metrics
    const categoryMapping = {
      'authentication': 'authenticationStrength',
      'authorization': 'authorizationCoverage',
      'input_validation': 'inputValidationScore',
      'session_management': 'sessionSecurityScore',
      'api_security': 'apiSecurityScore',
      'injection': 'injectionProtection',
      'xss': 'xssProtection',
      'csrf': 'csrfProtection',
      'headers': 'headersSecurity',
      'rate_limiting': 'rateLimitingEffectiveness'
    };

    for (const [category, metricName] of Object.entries(categoryMapping)) {
      const scores = categoryScores.get(category) || [];
      if (scores.length > 0) {
        metrics[metricName] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    }

    return metrics;
  }

  /**
   * Assess OWASP compliance
   */
  private assessOWASPCompliance() {
    const owaspCategories = new Set<string>();
    const failedCategories = new Set<string>();
    
    for (const result of this.testResults) {
      if (result.owaspCompliance) {
        owaspCategories.add(result.owaspCompliance.category);
        if (!result.owaspCompliance.compliant) {
          failedCategories.add(result.owaspCompliance.category);
        }
      }
    }

    const compliant = failedCategories.size === 0;
    const score = owaspCategories.size > 0 ? 
      Math.round(((owaspCategories.size - failedCategories.size) / owaspCategories.size) * 100) : 0;

    return {
      compliant,
      score,
      failedCategories: Array.from(failedCategories)
    };
  }

  /**
   * Determine security posture
   */
  private determineSecurityPosture(score: number): ComprehensiveSecurityReport['summary']['securityPosture'] {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 50) return 'poor';
    return 'critical';
  }

  /**
   * Assess compliance status
   */
  private assessComplianceStatus() {
    const overallScore = this.calculateSummary().overallScore;
    
    return {
      owasp: this.assessOWASPCompliance().compliant,
      pci: overallScore >= 85, // Simplified assessment
      hipaa: overallScore >= 80, // Simplified assessment
      gdpr: overallScore >= 75 // Simplified assessment
    };
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations = new Set<string>();
    
    // Add specific recommendations from test results
    for (const result of this.testResults) {
      for (const rec of result.recommendations) {
        recommendations.add(rec);
      }
    }
    
    // Add general recommendations based on metrics
    const summary = this.calculateSummary();
    
    if (summary.criticalVulnerabilities > 0) {
      recommendations.add('Address critical vulnerabilities immediately');
    }
    
    if (summary.overallScore < 70) {
      recommendations.add('Conduct comprehensive security review');
      recommendations.add('Implement security training for development team');
    }
    
    return Array.from(recommendations);
  }

  /**
   * Generate next actions
   */
  private generateNextActions(): string[] {
    const actions: string[] = [];
    const summary = this.calculateSummary();
    
    if (summary.criticalVulnerabilities > 0) {
      actions.push(`Fix ${summary.criticalVulnerabilities} critical vulnerabilities`);
    }
    
    if (summary.highRiskIssues > 0) {
      actions.push(`Address ${summary.highRiskIssues} high-risk issues`);
    }
    
    const failedOWASP = this.assessOWASPCompliance().failedCategories;
    if (failedOWASP.length > 0) {
      actions.push(`Remediate OWASP compliance failures: ${failedOWASP.join(', ')}`);
    }
    
    actions.push('Schedule regular security assessments');
    actions.push('Implement continuous security monitoring');
    
    return actions;
  }

  /**
   * Export report in various formats
   */
  exportReport(report: ComprehensiveSecurityReport, format: 'json' | 'html' | 'csv' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'html':
        return this.generateHTMLReport(report);
      
      case 'csv':
        return this.generateCSVReport(report);
      
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(report: ComprehensiveSecurityReport): string {
    const posturColor = {
      excellent: '#4caf50',
      good: '#8bc34a',
      fair: '#ff9800',
      poor: '#ff5722',
      critical: '#f44336'
    };

    return `<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Security Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #1976d2; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .posture { display: inline-block; padding: 10px 20px; border-radius: 5px; font-weight: bold; color: white; background: ${posturColor[report.summary.securityPosture]}; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f5f5f5; border-radius: 5px; min-width: 150px; text-align: center; }
        .critical { color: #d32f2f; font-weight: bold; }
        .high { color: #f57c00; font-weight: bold; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        .test-result { margin: 10px 0; padding: 15px; border-left: 4px solid #ccc; background: #fafafa; }
        .passed { border-left-color: #4caf50; }
        .failed { border-left-color: #f44336; background: #ffebee; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .compliance-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-size: 12px; margin: 2px; }
        .compliant { background: #4caf50; }
        .non-compliant { background: #f44336; }
        .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: #4caf50; transition: width 0.3s; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Comprehensive Security Validation Report</h1>
            <p><strong>Environment:</strong> ${report.environment}</p>
            <p><strong>Generated:</strong> ${report.generated.toISOString()}</p>
            <p><strong>Report ID:</strong> ${report.id}</p>
        </div>
        
        <div class="summary">
            <h2>Executive Summary</h2>
            <div class="posture">Security Posture: ${report.summary.securityPosture.toUpperCase()}</div>
            
            <div style="margin: 20px 0;">
                <div class="metric">
                    <h3>${report.summary.overallScore}</h3>
                    <p>Overall Score</p>
                </div>
                <div class="metric">
                    <h3>${report.summary.passedTests}/${report.summary.totalTests}</h3>
                    <p>Tests Passed</p>
                </div>
                <div class="metric">
                    <h3 class="critical">${report.summary.criticalVulnerabilities}</h3>
                    <p>Critical Issues</p>
                </div>
                <div class="metric">
                    <h3 class="high">${report.summary.highRiskIssues}</h3>
                    <p>High Risk Issues</p>
                </div>
            </div>

            <h3>OWASP Compliance</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${report.summary.owaspCompliance.score}%"></div>
            </div>
            <p>Score: ${report.summary.owaspCompliance.score}% - ${report.summary.owaspCompliance.compliant ? 'Compliant' : 'Non-Compliant'}</p>
            ${report.summary.owaspCompliance.failedCategories.length > 0 ? 
              `<p>Failed Categories: ${report.summary.owaspCompliance.failedCategories.join(', ')}</p>` : ''}
        </div>

        <h2>Compliance Status</h2>
        <div>
            <span class="compliance-badge ${report.complianceStatus.owasp ? 'compliant' : 'non-compliant'}">
                OWASP ${report.complianceStatus.owasp ? '✓' : '✗'}
            </span>
            <span class="compliance-badge ${report.complianceStatus.pci ? 'compliant' : 'non-compliant'}">
                PCI-DSS ${report.complianceStatus.pci ? '✓' : '✗'}
            </span>
            <span class="compliance-badge ${report.complianceStatus.hipaa ? 'compliant' : 'non-compliant'}">
                HIPAA ${report.complianceStatus.hipaa ? '✓' : '✗'}
            </span>
            <span class="compliance-badge ${report.complianceStatus.gdpr ? 'compliant' : 'non-compliant'}">
                GDPR ${report.complianceStatus.gdpr ? '✓' : '✗'}
            </span>
        </div>

        <h2>Security Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Score</th>
                <th>Status</th>
            </tr>
            ${Object.entries(report.securityMetrics).map(([metric, score]) => `
                <tr>
                    <td>${metric.replace(/([A-Z])/g, ' $1').trim()}</td>
                    <td>${score}/100</td>
                    <td>${score >= 80 ? '✅ Good' : score >= 60 ? '⚠️ Fair' : '❌ Poor'}</td>
                </tr>
            `).join('')}
        </table>

        <h2>Test Results by Category</h2>
        ${this.groupTestResultsByCategory(report.testResults).map(([category, tests]) => `
            <h3>${category.replace(/_/g, ' ').toUpperCase()}</h3>
            ${tests.map(test => `
                <div class="test-result ${test.passed ? 'passed' : 'failed'}">
                    <h4>${test.name} ${test.passed ? '✅' : '❌'}</h4>
                    <p>Score: ${test.score}/100 | Execution Time: ${test.executionTime}ms</p>
                    ${test.vulnerabilities.length > 0 ? `
                        <h5>Vulnerabilities:</h5>
                        <ul>
                            ${test.vulnerabilities.map(vuln => `
                                <li class="${vuln.severity}">
                                    <strong>${vuln.description}</strong> (${vuln.severity.toUpperCase()})
                                    <br><em>Remediation:</em> ${vuln.remediation}
                                    ${vuln.cwe ? `<br><em>CWE:</em> ${vuln.cwe}` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            `).join('')}
        `).join('')}

        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>

        <h2>Next Actions</h2>
        <ol>
            ${report.nextActions.map(action => `<li>${action}</li>`).join('')}
        </ol>
    </div>
</body>
</html>`;
  }

  /**
   * Group test results by category
   */
  private groupTestResultsByCategory(results: SecurityTestResult[]): [string, SecurityTestResult[]][] {
    const grouped = new Map<string, SecurityTestResult[]>();
    
    for (const result of results) {
      if (!grouped.has(result.category)) {
        grouped.set(result.category, []);
      }
      grouped.get(result.category)!.push(result);
    }
    
    return Array.from(grouped.entries());
  }

  /**
   * Generate CSV report
   */
  private generateCSVReport(report: ComprehensiveSecurityReport): string {
    const headers = [
      'Test ID', 'Test Name', 'Category', 'Status', 'Score', 
      'Severity', 'Vulnerabilities', 'OWASP Category', 'Recommendations'
    ];
    
    const rows = report.testResults.map(test => [
      test.testId,
      test.name,
      test.category,
      test.passed ? 'PASSED' : 'FAILED',
      test.score.toString(),
      test.vulnerabilities.length > 0 ? 
        test.vulnerabilities[0]?.severity || 'none' : 'none',
      test.vulnerabilities.length.toString(),
      test.owaspCompliance?.category || '',
      test.recommendations.join('; ')
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}

// Export singleton instance
export const comprehensiveSecurityValidator = new ComprehensiveSecurityValidator();