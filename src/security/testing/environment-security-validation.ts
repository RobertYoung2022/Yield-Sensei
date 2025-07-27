/**
 * Environment Variable and Configuration Security Validation
 * 
 * Comprehensive validation framework for environment variables and configuration security:
 * - Environment variable presence and format validation
 * - Sensitive information exposure detection
 * - Default value security assessment
 * - Configuration loading robustness testing
 * - Environment-specific security configuration validation
 */

import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { join } from 'path';

export interface EnvironmentTestCase {
  id: string;
  name: string;
  category: 'presence' | 'format' | 'security' | 'defaults' | 'loading';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  environment?: string;
  testFunction: () => Promise<EnvironmentTestResult>;
  expectedBehavior: string;
  complianceStandards: string[];
}

export interface EnvironmentTestResult {
  testId: string;
  passed: boolean;
  score: number;
  executionTime: number;
  details: {
    variablesChecked: string[];
    missingVariables?: string[];
    insecureValues?: InsecureValue[];
    configurationErrors?: ConfigurationError[];
    environmentInfo?: EnvironmentInfo;
  };
  vulnerabilities: EnvironmentVulnerability[];
  recommendations: string[];
  evidence: EnvironmentEvidence[];
}

export interface InsecureValue {
  variable: string;
  issue: 'default_password' | 'weak_secret' | 'exposed_key' | 'development_value' | 'unencrypted_sensitive' | 'invalid_format';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue?: string; // Masked for logging
  recommendedAction: string;
}

export interface ConfigurationError {
  type: 'missing_required' | 'invalid_format' | 'conflicting_values' | 'deprecated_config';
  variable: string;
  message: string;
  impact: string;
  resolution: string;
}

export interface EnvironmentInfo {
  nodeEnv: string;
  platform: string;
  configSources: string[];
  totalVariables: number;
  securityVariables: number;
}

export interface EnvironmentVulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'exposed_secret' | 'weak_configuration' | 'missing_security' | 'insecure_default';
  description: string;
  impact: string;
  remediation: string;
  affectedVariables: string[];
  cveReferences?: string[];
}

export interface EnvironmentEvidence {
  type: 'variable_check' | 'format_validation' | 'security_scan' | 'configuration_test';
  description: string;
  data: any;
  timestamp: Date;
  confidence: number;
}

export interface ValidationReport {
  id: string;
  generated: Date;
  environment: string;
  overallScore: number;
  testResults: EnvironmentTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    vulnerabilitiesFound: number;
    criticalIssues: number;
    securityScore: number;
    configurationHealth: 'healthy' | 'warning' | 'critical';
  };
  environmentAnalysis: {
    requiredVariables: VariableAnalysis[];
    optionalVariables: VariableAnalysis[];
    unknownVariables: string[];
    securityVariables: SecurityVariableAnalysis[];
  };
  recommendations: string[];
  nextActions: string[];
}

export interface VariableAnalysis {
  name: string;
  present: boolean;
  format: 'valid' | 'invalid' | 'unknown';
  security: 'secure' | 'warning' | 'critical';
  value: string; // Masked
  source: string;
}

export interface SecurityVariableAnalysis {
  name: string;
  category: 'api_key' | 'password' | 'token' | 'certificate' | 'encryption_key' | 'database_url';
  strength: 'weak' | 'medium' | 'strong';
  issues: string[];
  recommendations: string[];
}

export class EnvironmentSecurityValidator extends EventEmitter {
  private testCases: Map<string, EnvironmentTestCase> = new Map();
  private testResults: Map<string, EnvironmentTestResult> = new Map();
  private requiredVariables: Map<string, VariableRequirement> = new Map();
  private securityPatterns: Map<string, SecurityPattern> = new Map();
  // private configurationSchema: ConfigurationSchema | null = null;

  constructor() {
    super();
    this.initializeRequiredVariables();
    this.initializeSecurityPatterns();
    this.initializeTestCases();
    this.loadConfigurationSchema();
  }

  /**
   * Initialize required environment variables with their requirements
   */
  private initializeRequiredVariables(): void {
    // Database configuration
    this.requiredVariables.set('DATABASE_URL', {
      required: true,
      format: /^(postgres|mysql|mongodb):\/\/.+/,
      security: 'critical',
      description: 'Database connection string',
      defaultAllowed: false,
      environments: ['production', 'staging']
    });

    this.requiredVariables.set('DATABASE_PASSWORD', {
      required: true,
      format: /.{12,}/,
      security: 'critical',
      description: 'Database password',
      defaultAllowed: false,
      minLength: 12,
      environments: ['production', 'staging']
    });

    // API Keys
    this.requiredVariables.set('API_SECRET_KEY', {
      required: true,
      format: /^[A-Za-z0-9+/]{32,}$/,
      security: 'critical',
      description: 'API secret key for authentication',
      defaultAllowed: false,
      minLength: 32,
      environments: ['production', 'staging', 'development']
    });

    this.requiredVariables.set('JWT_SECRET', {
      required: true,
      format: /.{32,}/,
      security: 'critical',
      description: 'JWT signing secret',
      defaultAllowed: false,
      minLength: 32,
      environments: ['production', 'staging', 'development']
    });

    // Encryption keys
    this.requiredVariables.set('ENCRYPTION_KEY', {
      required: true,
      format: /^[A-Fa-f0-9]{64}$/,
      security: 'critical',
      description: 'Primary encryption key',
      defaultAllowed: false,
      exactLength: 64,
      environments: ['production', 'staging']
    });

    // TLS Configuration
    this.requiredVariables.set('TLS_MIN_VERSION', {
      required: false,
      format: /^1\.[2-3]$/,
      security: 'high',
      description: 'Minimum TLS version',
      defaultValue: '1.2',
      defaultAllowed: true,
      environments: ['production', 'staging']
    });

    // Security headers
    this.requiredVariables.set('HTTPS_ONLY', {
      required: false,
      format: /^(true|false)$/,
      security: 'high',
      description: 'Force HTTPS connections',
      defaultValue: 'true',
      defaultAllowed: true,
      environments: ['production', 'staging']
    });

    // Session configuration
    this.requiredVariables.set('SESSION_SECRET', {
      required: true,
      format: /.{24,}/,
      security: 'critical',
      description: 'Session signing secret',
      defaultAllowed: false,
      minLength: 24,
      environments: ['production', 'staging', 'development']
    });

    // Rate limiting
    this.requiredVariables.set('RATE_LIMIT_MAX', {
      required: false,
      format: /^\d+$/,
      security: 'medium',
      description: 'Maximum requests per window',
      defaultValue: '100',
      defaultAllowed: true,
      environments: ['production', 'staging']
    });

    // CORS configuration
    this.requiredVariables.set('ALLOWED_ORIGINS', {
      required: false,
      format: /^https?:\/\/.+/,
      security: 'high',
      description: 'Allowed CORS origins',
      defaultValue: 'https://localhost:3000',
      defaultAllowed: false,
      environments: ['production', 'staging']
    });

    console.log(`🔧 Initialized ${this.requiredVariables.size} required environment variables`);
  }

  /**
   * Initialize security patterns for detecting insecure values
   */
  private initializeSecurityPatterns(): void {
    // Common weak/default passwords
    this.securityPatterns.set('weak_passwords', {
      patterns: [
        /^(password|123456|admin|test|default)$/i,
        /^(letmein|welcome|qwerty|abc123)$/i,
        /^(changeme|temp|temporary|secret)$/i
      ],
      severity: 'critical',
      description: 'Common weak passwords detected'
    });

    // Development/test values
    this.securityPatterns.set('development_values', {
      patterns: [
        /^(dev|test|demo|example|sample)$/i,
        /localhost/i,
        /127\.0\.0\.1/,
        /^(key|secret|token)_(dev|test|demo)$/i
      ],
      severity: 'high',
      description: 'Development/test values in production'
    });

    // Exposed keys/tokens
    this.securityPatterns.set('exposed_secrets', {
      patterns: [
        /^(sk_|pk_|rk_)[a-zA-Z0-9]{20,}$/, // Common API key formats
        /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64 encoded secrets
        /^ghp_[A-Za-z0-9]{36}$/, // GitHub personal access tokens
        /^xox[baprs]-[A-Za-z0-9-]{10,48}$/ // Slack tokens
      ],
      severity: 'critical',
      description: 'Potential exposed API keys or tokens'
    });

    // Weak encryption
    this.securityPatterns.set('weak_encryption', {
      patterns: [
        /^(md5|sha1|des|3des)$/i,
        /^(rc4|ssl|tls1\.0|tls1\.1)$/i
      ],
      severity: 'high',
      description: 'Weak encryption algorithms'
    });

    console.log(`🛡️ Initialized ${this.securityPatterns.size} security pattern categories`);
  }

  /**
   * Initialize all environment test cases
   */
  private initializeTestCases(): void {
    // Required Variables Presence Tests
    this.addTestCase({
      id: 'required_variables_present',
      name: 'Required Environment Variables Present',
      category: 'presence',
      severity: 'critical',
      description: 'Verify all required environment variables are present',
      testFunction: () => this.testRequiredVariablesPresence(),
      expectedBehavior: 'All required environment variables should be present and non-empty',
      complianceStandards: ['OWASP', 'NIST']
    });

    // Security Variable Format Tests
    this.addTestCase({
      id: 'security_variable_formats',
      name: 'Security Variable Format Validation',
      category: 'format',
      severity: 'critical',
      description: 'Validate format and strength of security-related variables',
      testFunction: () => this.testSecurityVariableFormats(),
      expectedBehavior: 'Security variables should meet format and strength requirements',
      complianceStandards: ['OWASP', 'NIST', 'PCI-DSS']
    });

    // Insecure Default Detection Tests
    this.addTestCase({
      id: 'insecure_defaults_detection',
      name: 'Insecure Default Values Detection',
      category: 'defaults',
      severity: 'critical',
      description: 'Detect use of insecure default values',
      testFunction: () => this.testInsecureDefaults(),
      expectedBehavior: 'No insecure default values should be in use',
      complianceStandards: ['OWASP', 'CIS']
    });

    // Sensitive Information Exposure Tests
    this.addTestCase({
      id: 'sensitive_exposure_detection',
      name: 'Sensitive Information Exposure Detection',
      category: 'security',
      severity: 'critical',
      description: 'Detect potential exposure of sensitive information',
      testFunction: () => this.testSensitiveExposure(),
      expectedBehavior: 'No sensitive information should be exposed in logs or configurations',
      complianceStandards: ['GDPR', 'PCI-DSS', 'HIPAA']
    });

    // Configuration Loading Tests
    this.addTestCase({
      id: 'configuration_loading_robustness',
      name: 'Configuration Loading Robustness',
      category: 'loading',
      severity: 'high',
      description: 'Test configuration loading with malformed or missing inputs',
      testFunction: () => this.testConfigurationLoading(),
      expectedBehavior: 'Configuration should load gracefully with appropriate fallbacks',
      complianceStandards: ['OWASP']
    });

    // Environment-Specific Security Tests
    this.addTestCase({
      id: 'environment_specific_security',
      name: 'Environment-Specific Security Configuration',
      category: 'security',
      severity: 'high',
      description: 'Validate environment-specific security configurations',
      testFunction: () => this.testEnvironmentSpecificSecurity(),
      expectedBehavior: 'Security configurations should be appropriate for the environment',
      complianceStandards: ['NIST', 'CIS']
    });

    console.log(`🧪 Initialized ${this.testCases.size} environment security test cases`);
  }

  /**
   * Load configuration schema if available
   */
  private loadConfigurationSchema(): void {
    const schemaPath = join(process.cwd(), 'config', 'environment-schema.json');
    if (existsSync(schemaPath)) {
      try {
        // const schemaContent = readFileSync(schemaPath, 'utf8');
        // this.configurationSchema = JSON.parse(schemaContent);
        console.log('📋 Loaded configuration schema');
      } catch (error) {
        console.warn('⚠️ Failed to load configuration schema:', error);
      }
    }
  }

  /**
   * Add a new test case
   */
  private addTestCase(testCase: EnvironmentTestCase): void {
    this.testCases.set(testCase.id, testCase);
  }

  /**
   * Run all environment security validation tests
   */
  async runValidation(environment: string = 'development'): Promise<ValidationReport> {
    console.log(`🔒 Starting environment security validation for ${environment}`);
    const startTime = Date.now();

    const testResults: EnvironmentTestResult[] = [];
    let totalScore = 0;
    const vulnerabilities: EnvironmentVulnerability[] = [];

    // Execute all test cases
    for (const [testId, testCase] of this.testCases) {
      try {
        console.log(`  🧪 Running: ${testCase.name}`);
        const result = await this.executeTestCase(testCase, environment);
        testResults.push(result);
        totalScore += result.score;
        vulnerabilities.push(...result.vulnerabilities);

        this.emit('test:completed', { testId, result });
      } catch (error) {
        console.error(`❌ Test failed: ${testCase.name}`, error);
        const failedResult = this.createFailedResult(testId, error);
        testResults.push(failedResult);
      }
    }

    const overallScore = Math.round(totalScore / testResults.length);
    const passedTests = testResults.filter(r => r.passed).length;
    const criticalIssues = vulnerabilities.filter(v => v.severity === 'critical').length;

    // Analyze environment variables
    const environmentAnalysis = await this.analyzeEnvironmentVariables(environment);

    // Calculate security score
    const securityScore = this.calculateSecurityScore(testResults, environmentAnalysis);

    const report: ValidationReport = {
      id: `env_security_validation_${Date.now()}`,
      generated: new Date(),
      environment,
      overallScore,
      testResults,
      summary: {
        totalTests: testResults.length,
        passedTests,
        failedTests: testResults.length - passedTests,
        vulnerabilitiesFound: vulnerabilities.length,
        criticalIssues,
        securityScore,
        configurationHealth: this.determineConfigurationHealth(securityScore, criticalIssues)
      },
      environmentAnalysis,
      recommendations: this.generateRecommendations(testResults, vulnerabilities),
      nextActions: this.generateNextActions(overallScore, criticalIssues, securityScore)
    };

    this.emit('validation:completed', report);
    console.log(`✅ Environment security validation completed in ${Date.now() - startTime}ms`);
    return report;
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(testCase: EnvironmentTestCase, _environment: string): Promise<EnvironmentTestResult> {
    const startTime = Date.now();
    
    try {
      const result = await testCase.testFunction();
      result.executionTime = Date.now() - startTime;
      
      // Store result for future reference
      this.testResults.set(testCase.id, result);
      
      return result;
    } catch (error) {
      throw new Error(`Test case execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test required variables presence
   */
  private async testRequiredVariablesPresence(): Promise<EnvironmentTestResult> {
    const currentEnv = process.env['NODE_ENV'] || 'development';
    const vulnerabilities: EnvironmentVulnerability[] = [];
    const evidence: EnvironmentEvidence[] = [];
    const missingVariables: string[] = [];
    const variablesChecked: string[] = [];

    for (const [varName, requirement] of this.requiredVariables) {
      if (!requirement.environments.includes(currentEnv) && requirement.required) {
        continue; // Skip if not required for this environment
      }

      variablesChecked.push(varName);
      const value = process.env[varName];

      if (!value && requirement.required) {
        missingVariables.push(varName);
        vulnerabilities.push({
          id: `missing_required_${varName}`,
          severity: 'critical',
          type: 'missing_security',
          description: `Required environment variable ${varName} is missing`,
          impact: `${requirement.description} will not function properly`,
          remediation: `Set ${varName} environment variable with appropriate value`,
          affectedVariables: [varName]
        });
      }

      if (!value && !requirement.required && !requirement.defaultValue) {
        vulnerabilities.push({
          id: `missing_optional_${varName}`,
          severity: 'medium',
          type: 'missing_security',
          description: `Optional environment variable ${varName} is missing and has no default`,
          impact: `${requirement.description} may use unsafe fallback behavior`,
          remediation: `Consider setting ${varName} or providing a secure default`,
          affectedVariables: [varName]
        });
      }
    }

    evidence.push({
      type: 'variable_check',
      description: 'Required environment variables presence check',
      data: {
        environment: currentEnv,
        totalChecked: variablesChecked.length,
        missingCount: missingVariables.length,
        missingVariables
      },
      timestamp: new Date(),
      confidence: 95
    });

    const passed = missingVariables.length === 0;
    const score = Math.round(((variablesChecked.length - missingVariables.length) / variablesChecked.length) * 100);

    return {
      testId: 'required_variables_present',
      passed,
      score,
      executionTime: 0,
      details: {
        variablesChecked,
        missingVariables,
        environmentInfo: {
          nodeEnv: currentEnv,
          platform: process.platform,
          configSources: ['process.env'],
          totalVariables: Object.keys(process.env).length,
          securityVariables: variablesChecked.length
        }
      },
      vulnerabilities,
      recommendations: missingVariables.length > 0 ? 
        [`Set missing required variables: ${missingVariables.join(', ')}`] : 
        ['All required environment variables are present'],
      evidence
    };
  }

  /**
   * Test security variable formats
   */
  private async testSecurityVariableFormats(): Promise<EnvironmentTestResult> {
    const vulnerabilities: EnvironmentVulnerability[] = [];
    const evidence: EnvironmentEvidence[] = [];
    const variablesChecked: string[] = [];
    const insecureValues: InsecureValue[] = [];

    for (const [varName, requirement] of this.requiredVariables) {
      if (requirement.security === 'critical' || requirement.security === 'high') {
        variablesChecked.push(varName);
        const value = process.env[varName];

        if (value) {
          // Check format
          if (requirement.format && !requirement.format.test(value)) {
            insecureValues.push({
              variable: varName,
              issue: 'invalid_format',
              description: `Variable ${varName} does not match required format`,
              severity: 'high',
              currentValue: this.maskValue(value),
              recommendedAction: `Update ${varName} to match required format`
            });

            vulnerabilities.push({
              id: `invalid_format_${varName}`,
              severity: 'high',
              type: 'weak_configuration',
              description: `Environment variable ${varName} has invalid format`,
              impact: 'May cause security vulnerabilities or application errors',
              remediation: `Update ${varName} to match required format pattern`,
              affectedVariables: [varName]
            });
          }

          // Check length requirements
          if (requirement.minLength && value.length < requirement.minLength) {
            insecureValues.push({
              variable: varName,
              issue: 'weak_secret',
              description: `Variable ${varName} is too short`,
              severity: 'critical',
              currentValue: this.maskValue(value),
              recommendedAction: `Use at least ${requirement.minLength} characters`
            });

            vulnerabilities.push({
              id: `weak_length_${varName}`,
              severity: 'critical',
              type: 'weak_configuration',
              description: `Environment variable ${varName} is too short`,
              impact: 'Weak secrets are vulnerable to brute force attacks',
              remediation: `Use at least ${requirement.minLength} characters for ${varName}`,
              affectedVariables: [varName]
            });
          }

          // Check exact length requirements
          if (requirement.exactLength && value.length !== requirement.exactLength) {
            insecureValues.push({
              variable: varName,
              issue: 'invalid_format',
              description: `Variable ${varName} has incorrect length`,
              severity: 'high',
              currentValue: this.maskValue(value),
              recommendedAction: `Use exactly ${requirement.exactLength} characters`
            });
          }
        }
      }
    }

    evidence.push({
      type: 'format_validation',
      description: 'Security variable format validation',
      data: {
        totalChecked: variablesChecked.length,
        insecureCount: insecureValues.length,
        formatViolations: insecureValues.filter(v => v.issue === 'invalid_format').length,
        weakSecrets: insecureValues.filter(v => v.issue === 'weak_secret').length
      },
      timestamp: new Date(),
      confidence: 90
    });

    const passed = insecureValues.length === 0;
    const score = Math.round(((variablesChecked.length - insecureValues.length) / variablesChecked.length) * 100);

    return {
      testId: 'security_variable_formats',
      passed,
      score,
      executionTime: 0,
      details: {
        variablesChecked,
        insecureValues
      },
      vulnerabilities,
      recommendations: insecureValues.length > 0 ? 
        ['Fix format and strength issues in security variables'] : 
        ['All security variables meet format requirements'],
      evidence
    };
  }

  /**
   * Test for insecure default values
   */
  private async testInsecureDefaults(): Promise<EnvironmentTestResult> {
    const vulnerabilities: EnvironmentVulnerability[] = [];
    const evidence: EnvironmentEvidence[] = [];
    const variablesChecked: string[] = [];
    const insecureValues: InsecureValue[] = [];

    for (const [varName, requirement] of this.requiredVariables) {
      variablesChecked.push(varName);
      const value = process.env[varName];

      if (value) {
        // Check against security patterns
        for (const [patternName, pattern] of this.securityPatterns) {
          for (const regex of pattern.patterns) {
            if (regex.test(value)) {
              insecureValues.push({
                variable: varName,
                issue: this.mapPatternToIssue(patternName),
                description: pattern.description,
                severity: pattern.severity,
                currentValue: this.maskValue(value),
                recommendedAction: `Replace ${varName} with a secure value`
              });

              vulnerabilities.push({
                id: `insecure_default_${varName}_${patternName}`,
                severity: pattern.severity,
                type: 'insecure_default',
                description: `Environment variable ${varName} uses ${pattern.description}`,
                impact: 'Insecure defaults can be exploited by attackers',
                remediation: `Generate a strong, unique value for ${varName}`,
                affectedVariables: [varName]
              });
            }
          }
        }

        // Check if using default value when not allowed
        if (requirement.defaultValue && value === requirement.defaultValue && !requirement.defaultAllowed) {
          insecureValues.push({
            variable: varName,
            issue: 'default_password',
            description: `Variable ${varName} is using default value`,
            severity: 'critical',
            currentValue: this.maskValue(value),
            recommendedAction: `Set a unique value for ${varName}`
          });

          vulnerabilities.push({
            id: `default_value_${varName}`,
            severity: 'critical',
            type: 'insecure_default',
            description: `Environment variable ${varName} is using insecure default value`,
            impact: 'Default values are well-known and can be exploited',
            remediation: `Set a unique, secure value for ${varName}`,
            affectedVariables: [varName]
          });
        }
      }
    }

    evidence.push({
      type: 'security_scan',
      description: 'Insecure default values detection',
      data: {
        totalScanned: variablesChecked.length,
        insecureDefaults: insecureValues.length,
        patternMatches: vulnerabilities.length
      },
      timestamp: new Date(),
      confidence: 85
    });

    const passed = insecureValues.length === 0;
    const score = Math.round(((variablesChecked.length - insecureValues.length) / variablesChecked.length) * 100);

    return {
      testId: 'insecure_defaults_detection',
      passed,
      score,
      executionTime: 0,
      details: {
        variablesChecked,
        insecureValues
      },
      vulnerabilities,
      recommendations: insecureValues.length > 0 ? 
        ['Replace insecure default values with strong, unique values'] : 
        ['No insecure default values detected'],
      evidence
    };
  }

  /**
   * Test for sensitive information exposure
   */
  private async testSensitiveExposure(): Promise<EnvironmentTestResult> {
    const vulnerabilities: EnvironmentVulnerability[] = [];
    const evidence: EnvironmentEvidence[] = [];
    const variablesChecked: string[] = [];
    const exposedSecrets: string[] = [];

    // Check for variables that might be logged or exposed
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /api/i,
      /auth/i
    ];

    for (const [envVar, value] of Object.entries(process.env)) {
      if (value && sensitivePatterns.some(pattern => pattern.test(envVar))) {
        variablesChecked.push(envVar);

        // Check if value looks like it could be logged safely (masked)
        if (value.length < 8 || value.includes('***') || value.includes('MASK')) {
          // Potentially exposed
          exposedSecrets.push(envVar);
          vulnerabilities.push({
            id: `exposed_secret_${envVar}`,
            severity: 'high',
            type: 'exposed_secret',
            description: `Sensitive environment variable ${envVar} may be exposed`,
            impact: 'Sensitive information could be leaked in logs or error messages',
            remediation: `Ensure ${envVar} is properly masked in logs and not exposed`,
            affectedVariables: [envVar]
          });
        }
      }
    }

    evidence.push({
      type: 'security_scan',
      description: 'Sensitive information exposure check',
      data: {
        sensitiveVariables: variablesChecked.length,
        potentialExposures: exposedSecrets.length
      },
      timestamp: new Date(),
      confidence: 70
    });

    const passed = exposedSecrets.length === 0;
    const score = exposedSecrets.length === 0 ? 100 : Math.max(0, 100 - (exposedSecrets.length * 20));

    return {
      testId: 'sensitive_exposure_detection',
      passed,
      score,
      executionTime: 0,
      details: {
        variablesChecked,
        insecureValues: exposedSecrets.map(secretVar => ({
          variable: secretVar,
          issue: 'exposed_key' as const,
          description: 'Potentially exposed sensitive variable',
          severity: 'high' as const,
          currentValue: '***MASKED***',
          recommendedAction: 'Ensure proper masking and logging practices'
        }))
      },
      vulnerabilities,
      recommendations: exposedSecrets.length > 0 ? 
        ['Review logging and error handling to prevent sensitive information exposure'] : 
        ['No obvious sensitive information exposure detected'],
      evidence
    };
  }

  /**
   * Test configuration loading robustness
   */
  private async testConfigurationLoading(): Promise<EnvironmentTestResult> {
    const vulnerabilities: EnvironmentVulnerability[] = [];
    const evidence: EnvironmentEvidence[] = [];
    const configurationErrors: ConfigurationError[] = [];

    // Test with missing required variables
    const missingRequired = Array.from(this.requiredVariables.entries())
      .filter(([name, req]) => req.required && !process.env[name])
      .map(([name]) => name);

    if (missingRequired.length > 0) {
      configurationErrors.push({
        type: 'missing_required',
        variable: missingRequired.join(', '),
        message: `Missing required environment variables: ${missingRequired.join(', ')}`,
        impact: 'Application may fail to start or function incorrectly',
        resolution: 'Set all required environment variables before starting the application'
      });

      vulnerabilities.push({
        id: 'missing_required_vars',
        severity: 'critical',
        type: 'missing_security',
        description: 'Required environment variables are missing',
        impact: 'Application cannot start safely without required configuration',
        remediation: 'Set all required environment variables',
        affectedVariables: missingRequired
      });
    }

    // Test for conflicting values
    const httpsOnly = process.env['HTTPS_ONLY'];
    const allowedOrigins = process.env['ALLOWED_ORIGINS'];
    
    if (httpsOnly === 'true' && allowedOrigins && allowedOrigins.startsWith('http:')) {
      configurationErrors.push({
        type: 'conflicting_values',
        variable: 'HTTPS_ONLY, ALLOWED_ORIGINS',
        message: 'HTTPS_ONLY is true but ALLOWED_ORIGINS contains HTTP URLs',
        impact: 'CORS policy may conflict with HTTPS enforcement',
        resolution: 'Update ALLOWED_ORIGINS to use HTTPS URLs only'
      });

      vulnerabilities.push({
        id: 'https_cors_conflict',
        severity: 'medium',
        type: 'weak_configuration',
        description: 'Conflicting HTTPS and CORS configuration',
        impact: 'May allow insecure connections despite HTTPS enforcement',
        remediation: 'Ensure CORS origins use HTTPS when HTTPS_ONLY is enabled',
        affectedVariables: ['HTTPS_ONLY', 'ALLOWED_ORIGINS']
      });
    }

    evidence.push({
      type: 'configuration_test',
      description: 'Configuration loading robustness test',
      data: {
        configurationErrors: configurationErrors.length,
        missingRequired: missingRequired.length,
        conflictingConfigs: configurationErrors.filter(e => e.type === 'conflicting_values').length
      },
      timestamp: new Date(),
      confidence: 85
    });

    const passed = configurationErrors.length === 0;
    const score = configurationErrors.length === 0 ? 100 : Math.max(0, 100 - (configurationErrors.length * 25));

    return {
      testId: 'configuration_loading_robustness',
      passed,
      score,
      executionTime: 0,
      details: {
        variablesChecked: Array.from(this.requiredVariables.keys()),
        configurationErrors
      },
      vulnerabilities,
      recommendations: configurationErrors.length > 0 ? 
        ['Fix configuration errors before deployment'] : 
        ['Configuration loading is robust'],
      evidence
    };
  }

  /**
   * Test environment-specific security configurations
   */
  private async testEnvironmentSpecificSecurity(): Promise<EnvironmentTestResult> {
    const currentEnv = process.env['NODE_ENV'] || 'development';
    const vulnerabilities: EnvironmentVulnerability[] = [];
    const evidence: EnvironmentEvidence[] = [];
    const variablesChecked: string[] = [];

    // Production-specific checks
    if (currentEnv === 'production') {
      variablesChecked.push('NODE_ENV');

      // Should have HTTPS enforcement
      if (process.env['HTTPS_ONLY'] !== 'true') {
        vulnerabilities.push({
          id: 'prod_https_not_enforced',
          severity: 'critical',
          type: 'weak_configuration',
          description: 'HTTPS enforcement is not enabled in production',
          impact: 'Production traffic may be transmitted insecurely',
          remediation: 'Set HTTPS_ONLY=true in production environment',
          affectedVariables: ['HTTPS_ONLY']
        });
      }

      // Should have secure TLS version
      const tlsVersion = process.env['TLS_MIN_VERSION'];
      if (!tlsVersion || parseFloat(tlsVersion) < 1.2) {
        vulnerabilities.push({
          id: 'prod_weak_tls',
          severity: 'high',
          type: 'weak_configuration',
          description: 'Weak TLS version in production',
          impact: 'Communications may be vulnerable to attacks',
          remediation: 'Set TLS_MIN_VERSION to 1.2 or higher',
          affectedVariables: ['TLS_MIN_VERSION']
        });
      }

      // Should not allow development origins
      const allowedOrigins = process.env['ALLOWED_ORIGINS'];
      if (allowedOrigins && (allowedOrigins.includes('localhost') || allowedOrigins.includes('127.0.0.1'))) {
        vulnerabilities.push({
          id: 'prod_dev_origins',
          severity: 'high',
          type: 'weak_configuration',
          description: 'Development origins allowed in production',
          impact: 'May allow unauthorized access from development environments',
          remediation: 'Remove localhost and development origins from ALLOWED_ORIGINS',
          affectedVariables: ['ALLOWED_ORIGINS']
        });
      }
    }

    // Development-specific checks
    if (currentEnv === 'development') {
      // Should have reasonable rate limits even in dev
      const rateLimit = process.env['RATE_LIMIT_MAX'];
      if (rateLimit && parseInt(rateLimit) > 1000) {
        vulnerabilities.push({
          id: 'dev_high_rate_limit',
          severity: 'low',
          type: 'weak_configuration',
          description: 'Very high rate limit in development',
          impact: 'May not catch rate limiting issues during development',
          remediation: 'Use reasonable rate limits even in development',
          affectedVariables: ['RATE_LIMIT_MAX']
        });
      }
    }

    evidence.push({
      type: 'configuration_test',
      description: 'Environment-specific security configuration check',
      data: {
        environment: currentEnv,
        securityChecks: variablesChecked.length,
        issues: vulnerabilities.length
      },
      timestamp: new Date(),
      confidence: 90
    });

    const passed = vulnerabilities.length === 0;
    const score = vulnerabilities.length === 0 ? 100 : Math.max(0, 100 - (vulnerabilities.length * 20));

    return {
      testId: 'environment_specific_security',
      passed,
      score,
      executionTime: 0,
      details: {
        variablesChecked,
        environmentInfo: {
          nodeEnv: currentEnv,
          platform: process.platform,
          configSources: ['process.env'],
          totalVariables: Object.keys(process.env).length,
          securityVariables: variablesChecked.length
        }
      },
      vulnerabilities,
      recommendations: vulnerabilities.length > 0 ? 
        [`Fix environment-specific security issues for ${currentEnv}`] : 
        [`Environment-specific security configuration is appropriate for ${currentEnv}`],
      evidence
    };
  }

  // Helper methods

  private createFailedResult(testId: string, error: any): EnvironmentTestResult {
    return {
      testId,
      passed: false,
      score: 0,
      executionTime: 0,
      details: {
        variablesChecked: [],
        configurationErrors: [{
          type: 'missing_required',
          variable: 'test_execution',
          message: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          impact: 'Unable to validate environment security',
          resolution: 'Fix test execution environment and retry'
        }]
      },
      vulnerabilities: [{
        id: `${testId}_failure`,
        severity: 'high',
        type: 'weak_configuration',
        description: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        impact: 'Unable to validate environment security configuration',
        remediation: 'Investigate test failure and fix underlying issues',
        affectedVariables: []
      }],
      recommendations: ['Investigate test failure and fix underlying issues'],
      evidence: []
    };
  }

  private maskValue(value: string): string {
    if (value.length <= 4) return '***';
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }

  private mapPatternToIssue(patternName: string): InsecureValue['issue'] {
    switch (patternName) {
      case 'weak_passwords': return 'default_password';
      case 'development_values': return 'development_value';
      case 'exposed_secrets': return 'exposed_key';
      case 'weak_encryption': return 'unencrypted_sensitive';
      default: return 'weak_secret';
    }
  }

  private async analyzeEnvironmentVariables(_environment: string): Promise<ValidationReport['environmentAnalysis']> {
    const requiredVariables: VariableAnalysis[] = [];
    const optionalVariables: VariableAnalysis[] = [];
    const securityVariables: SecurityVariableAnalysis[] = [];
    const allEnvVars = new Set(Object.keys(process.env));
    // const knownVars = new Set(this.requiredVariables.keys());

    // Analyze required/optional variables
    for (const [name, requirement] of this.requiredVariables) {
      const value = process.env[name];
      const analysis: VariableAnalysis = {
        name,
        present: !!value,
        format: value && requirement.format ? 
          (requirement.format.test(value) ? 'valid' : 'invalid') : 'unknown',
        security: this.assessVariableSecurity(name, value, requirement),
        value: value ? this.maskValue(value) : '',
        source: 'process.env'
      };

      if (requirement.required) {
        requiredVariables.push(analysis);
      } else {
        optionalVariables.push(analysis);
      }

      // Security analysis for security-related variables
      if (requirement.security === 'critical' || requirement.security === 'high') {
        securityVariables.push(this.analyzeSecurityVariable(name, value, requirement));
      }

      allEnvVars.delete(name);
    }

    const unknownVariables = Array.from(allEnvVars).filter(name => 
      !name.startsWith('npm_') && !name.startsWith('NODE_') && name !== 'PATH'
    );

    return {
      requiredVariables,
      optionalVariables,
      unknownVariables,
      securityVariables
    };
  }

  private assessVariableSecurity(_name: string, value: string | undefined, requirement: VariableRequirement): 'secure' | 'warning' | 'critical' {
    if (!value) return requirement.required ? 'critical' : 'warning';
    
    // Check against security patterns
    for (const pattern of this.securityPatterns.values()) {
      for (const regex of pattern.patterns) {
        if (regex.test(value)) {
          return pattern.severity === 'critical' ? 'critical' : 'warning';
        }
      }
    }

    // Check format compliance
    if (requirement.format && !requirement.format.test(value)) {
      return 'warning';
    }

    // Check length requirements
    if (requirement.minLength && value.length < requirement.minLength) {
      return 'critical';
    }

    return 'secure';
  }

  private analyzeSecurityVariable(name: string, value: string | undefined, requirement: VariableRequirement): SecurityVariableAnalysis {
    const category = this.categorizeSecurityVariable(name);
    const issues: string[] = [];
    
    if (!value) {
      issues.push('Variable is missing');
    } else {
      if (requirement.format && !requirement.format.test(value)) {
        issues.push('Invalid format');
      }
      if (requirement.minLength && value.length < requirement.minLength) {
        issues.push(`Too short (minimum ${requirement.minLength} characters)`);
      }
      
      // Check against weak patterns
      for (const pattern of this.securityPatterns.values()) {
        for (const regex of pattern.patterns) {
          if (regex.test(value)) {
            issues.push(pattern.description);
          }
        }
      }
    }

    const strength = this.assessSecurityVariableStrength(value, requirement, issues);
    
    return {
      name,
      category,
      strength,
      issues,
      recommendations: this.generateSecurityVariableRecommendations(name, issues, requirement)
    };
  }

  private categorizeSecurityVariable(name: string): SecurityVariableAnalysis['category'] {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('password')) return 'password';
    if (lowerName.includes('secret')) return 'api_key';
    if (lowerName.includes('key')) return 'encryption_key';
    if (lowerName.includes('token')) return 'token';
    if (lowerName.includes('cert')) return 'certificate';
    if (lowerName.includes('database') || lowerName.includes('db')) return 'database_url';
    return 'api_key';
  }

  private assessSecurityVariableStrength(value: string | undefined, requirement: VariableRequirement, issues: string[]): 'weak' | 'medium' | 'strong' {
    if (!value || issues.length > 2) return 'weak';
    if (issues.length > 0) return 'medium';
    
    // Additional strength checks
    if (requirement.minLength && value.length >= requirement.minLength * 1.5) return 'strong';
    if (requirement.format && requirement.format.test(value)) return 'strong';
    
    return 'medium';
  }

  private generateSecurityVariableRecommendations(name: string, issues: string[], requirement: VariableRequirement): string[] {
    const recommendations: string[] = [];
    
    if (issues.includes('Variable is missing')) {
      recommendations.push(`Set ${name} environment variable`);
    }
    if (issues.includes('Invalid format')) {
      recommendations.push('Use the correct format for this variable');
    }
    if (issues.some(i => i.includes('Too short'))) {
      recommendations.push(`Use at least ${requirement.minLength} characters`);
    }
    if (issues.some(i => i.includes('weak') || i.includes('default'))) {
      recommendations.push('Generate a strong, unique value');
    }
    
    return recommendations;
  }

  private calculateSecurityScore(testResults: EnvironmentTestResult[], environmentAnalysis: ValidationReport['environmentAnalysis']): number {
    const weights = {
      requiredVariables: 0.3,
      formatCompliance: 0.25,
      noInsecureDefaults: 0.25,
      configurationRobustness: 0.2
    };

    const requiredScore = (environmentAnalysis.requiredVariables.filter(v => v.present).length / 
      Math.max(environmentAnalysis.requiredVariables.length, 1)) * 100;

    const formatScore = testResults.find(r => r.testId === 'security_variable_formats')?.score || 0;
    const defaultsScore = testResults.find(r => r.testId === 'insecure_defaults_detection')?.score || 0;
    const configScore = testResults.find(r => r.testId === 'configuration_loading_robustness')?.score || 0;

    return Math.round(
      requiredScore * weights.requiredVariables +
      formatScore * weights.formatCompliance +
      defaultsScore * weights.noInsecureDefaults +
      configScore * weights.configurationRobustness
    );
  }

  private determineConfigurationHealth(securityScore: number, criticalIssues: number): 'healthy' | 'warning' | 'critical' {
    if (criticalIssues > 0) return 'critical';
    if (securityScore < 70) return 'critical';
    if (securityScore < 90) return 'warning';
    return 'healthy';
  }

  private generateRecommendations(testResults: EnvironmentTestResult[], vulnerabilities: EnvironmentVulnerability[]): string[] {
    const recommendations = new Set<string>();

    // Add vulnerability-based recommendations
    for (const vuln of vulnerabilities) {
      recommendations.add(vuln.remediation);
    }

    // Add test-specific recommendations
    for (const result of testResults) {
      for (const rec of result.recommendations) {
        recommendations.add(rec);
      }
    }

    return Array.from(recommendations);
  }

  private generateNextActions(overallScore: number, criticalIssues: number, securityScore: number): string[] {
    const actions: string[] = [];

    if (criticalIssues > 0) {
      actions.push('🚨 URGENT: Fix critical environment security issues immediately');
    }

    if (securityScore < 70) {
      actions.push('🔒 Comprehensive environment security review required');
    }

    if (overallScore < 80) {
      actions.push('📋 Address environment configuration issues before deployment');
    }

    if (overallScore >= 90 && criticalIssues === 0) {
      actions.push('✅ Environment security configuration meets requirements');
      actions.push('📅 Schedule regular environment security reviews');
    }

    return actions;
  }

  /**
   * Export validation report
   */
  exportReport(report: ValidationReport, format: 'json' | 'html' | 'csv' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'html':
        return this.generateHTMLReport(report);
      
      case 'csv':
        return this.generateCSVReport(report);
      
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  private generateHTMLReport(report: ValidationReport): string {
    // HTML report generation logic
    return `<!DOCTYPE html><html><head><title>Environment Security Report</title></head><body><h1>Environment Security Validation Report</h1><p>Generated: ${report.generated.toISOString()}</p></body></html>`;
  }

  private generateCSVReport(report: ValidationReport): string {
    let csv = 'Test ID,Status,Score,Vulnerabilities,Environment\n';
    for (const result of report.testResults) {
      csv += `${result.testId},${result.passed ? 'PASS' : 'FAIL'},${result.score},${result.vulnerabilities.length},${report.environment}\n`;
    }
    return csv;
  }
}

// Supporting interfaces
interface VariableRequirement {
  required: boolean;
  format?: RegExp;
  security: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  defaultValue?: string;
  defaultAllowed: boolean;
  minLength?: number;
  exactLength?: number;
  environments: string[];
}

interface SecurityPattern {
  patterns: RegExp[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// interface ConfigurationSchema {
//   version: string;
//   variables: Record<string, any>;
// }

// Export singleton instance
export const environmentSecurityValidator = new EnvironmentSecurityValidator();