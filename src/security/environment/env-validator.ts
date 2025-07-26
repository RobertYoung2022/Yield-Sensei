/**
 * Environment Variable Security Validator
 * 
 * Comprehensive testing and validation of environment variable security
 * practices throughout the YieldSensei platform
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface EnvTestResult {
  testName: string;
  category: 'secrets' | 'configuration' | 'access' | 'validation' | 'exposure';
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  error?: string;
  details?: Record<string, any>;
  recommendations?: string[];
}

export interface EnvValidationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  categories: Record<string, { passed: number; failed: number }>;
  recommendations: string[];
}

export interface EnvSecurityConfig {
  projectRoot: string;
  includeNodeModules: boolean;
  checkGitHistory: boolean;
  validateRequired: boolean;
  scanFileTypes: string[];
  secretPatterns: RegExp[];
  allowedEnvFiles: string[];
}

export class EnvironmentVariableValidator {
  private results: EnvTestResult[] = [];
  private config: EnvSecurityConfig;
  private processEnv: Record<string, string | undefined>;

  // Common secret patterns to detect
  private readonly SECRET_PATTERNS: RegExp[] = [
    /(?:password|passwd|pwd)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:secret|key|token)\s*[:=]\s*['"]\w{8,}['"]/gi,
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:auth[_-]?token|authtoken)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:private[_-]?key|privatekey)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:database[_-]?url|db[_-]?url)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:jwt[_-]?secret|jwtsecret)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:encryption[_-]?key|encryptionkey)\s*[:=]\s*['"]\w+['"]/gi,
  ];

  // Required environment variables for YieldSensei
  private readonly REQUIRED_ENV_VARS: Record<string, { 
    required: boolean; 
    environments: string[]; 
    pattern?: RegExp;
    minLength?: number;
  }> = {
    NODE_ENV: { 
      required: true, 
      environments: ['*'],
      pattern: /^(development|staging|production|test)$/
    },
    PORT: { 
      required: false, 
      environments: ['*'],
      pattern: /^\d{2,5}$/
    },
    DATABASE_URL: { 
      required: true, 
      environments: ['production', 'staging'],
      minLength: 20
    },
    REDIS_URL: { 
      required: true, 
      environments: ['production', 'staging'],
      minLength: 10
    },
    JWT_SECRET: { 
      required: true, 
      environments: ['*'],
      minLength: 32
    },
    VAULT_ENCRYPTION_KEY: { 
      required: true, 
      environments: ['*'],
      minLength: 32
    },
    API_RATE_LIMIT: { 
      required: false, 
      environments: ['*'],
      pattern: /^\d+$/
    },
    CORS_ORIGIN: { 
      required: false, 
      environments: ['production'],
      minLength: 5
    }
  };

  // Sensitive variable names that should never be logged or exposed
  private readonly SENSITIVE_VARS: string[] = [
    'PASSWORD', 'PASSWD', 'PWD',
    'SECRET', 'KEY', 'TOKEN',
    'API_KEY', 'APIKEY',
    'AUTH_TOKEN', 'AUTHTOKEN',
    'PRIVATE_KEY', 'PRIVATEKEY',
    'DATABASE_PASSWORD', 'DB_PASSWORD',
    'JWT_SECRET', 'JWTSECRET',
    'ENCRYPTION_KEY', 'ENCRYPTIONKEY',
    'VAULT_ENCRYPTION_KEY',
    'OAUTH_CLIENT_SECRET',
    'WEBHOOK_SECRET',
    'SIGNING_KEY'
  ];

  constructor(config?: Partial<EnvSecurityConfig>) {
    this.config = {
      projectRoot: process.cwd(),
      includeNodeModules: false,
      checkGitHistory: false,
      validateRequired: true,
      scanFileTypes: ['.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.yaml', '.yml'],
      secretPatterns: this.SECRET_PATTERNS,
      allowedEnvFiles: ['.env', '.env.local', '.env.example', '.env.template'],
      ...config
    };

    // Capture current process environment safely
    this.processEnv = { ...process.env };
  }

  /**
   * Run comprehensive environment variable security validation
   */
  async validateAll(): Promise<EnvValidationSummary> {
    this.results = [];

    console.log('🔍 Starting environment variable security validation...\n');

    // Test categories
    await this.testSecretsExposure();
    await this.testConfigurationSecurity();
    await this.testAccessControl();
    await this.testValidationRules();
    await this.testEnvironmentExposure();

    return this.generateSummary();
  }

  /**
   * Test for secrets exposure in various places
   */
  private async testSecretsExposure(): Promise<void> {
    console.log('🔐 Testing secrets exposure...');

    // Test 1: Check for hardcoded secrets in source code
    await this.testHardcodedSecrets();

    // Test 2: Check for secrets in environment files
    await this.testEnvFileSecrets();

    // Test 3: Check for secrets in configuration files
    await this.testConfigFileSecrets();

    // Test 4: Check for secrets in logs
    await this.testLogSecrets();

    // Test 5: Check for secrets in Git history
    if (this.config.checkGitHistory) {
      await this.testGitHistorySecrets();
    }
  }

  /**
   * Test configuration security practices
   */
  private async testConfigurationSecurity(): Promise<void> {
    console.log('⚙️ Testing configuration security...');

    // Test 1: Validate required environment variables
    await this.testRequiredVariables();

    // Test 2: Check environment variable formats
    await this.testVariableFormats();

    // Test 3: Test default value security
    await this.testDefaultValues();

    // Test 4: Check for insecure configurations
    await this.testInsecureConfigurations();
  }

  /**
   * Test access control mechanisms
   */
  private async testAccessControl(): Promise<void> {
    console.log('🔒 Testing access control...');

    // Test 1: Check file permissions on environment files
    await this.testFilePermissions();

    // Test 2: Test environment isolation
    await this.testEnvironmentIsolation();

    // Test 3: Check for unauthorized access patterns
    await this.testUnauthorizedAccess();
  }

  /**
   * Test validation rules for environment variables
   */
  private async testValidationRules(): Promise<void> {
    console.log('✅ Testing validation rules...');

    // Test 1: Validate variable naming conventions
    await this.testNamingConventions();

    // Test 2: Test value validation
    await this.testValueValidation();

    // Test 3: Check for missing validation
    await this.testMissingValidation();
  }

  /**
   * Test for environment variable exposure
   */
  private async testEnvironmentExposure(): Promise<void> {
    console.log('🌐 Testing environment exposure...');

    // Test 1: Check for client-side exposure
    await this.testClientSideExposure();

    // Test 2: Test server response exposure
    await this.testServerResponseExposure();

    // Test 3: Check for debugging exposure
    await this.testDebuggingExposure();

    // Test 4: Test process exposure
    await this.testProcessExposure();
  }

  // Individual test implementations
  private async testHardcodedSecrets(): Promise<void> {
    const sourceFiles = this.getSourceFiles();
    let foundSecrets = 0;

    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        for (const pattern of this.config.secretPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            foundSecrets += matches.length;
            
            this.results.push({
              testName: `Hardcoded secrets in ${file}`,
              category: 'secrets',
              passed: false,
              severity: 'critical',
              details: {
                file,
                matches: matches.map(m => m.substring(0, 50) + '...')
              },
              recommendations: [
                'Move secrets to environment variables',
                'Use secure secret management system',
                'Add the file to .gitignore if it contains test data'
              ]
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    if (foundSecrets === 0) {
      this.results.push({
        testName: 'Hardcoded secrets scan',
        category: 'secrets',
        passed: true,
        severity: 'low',
        details: { filesScanned: sourceFiles.length }
      });
    }
  }

  private async testEnvFileSecrets(): Promise<void> {
    const envFiles = ['.env', '.env.local', '.env.development', '.env.staging', '.env.production'];
    
    for (const envFile of envFiles) {
      const filePath = join(this.config.projectRoot, envFile);
      
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          const issues: string[] = [];

          lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const [key, value] = trimmed.split('=', 2);
              
              if (value && value.length > 0) {
                // Check for weak or default values
                if (this.isWeakValue(value)) {
                  issues.push(`Line ${index + 1}: Weak value for ${key}`);
                }
                
                // Check for exposed secrets
                if (this.isSensitiveVariable(key) && value && this.isExposedValue(value)) {
                  issues.push(`Line ${index + 1}: Potentially exposed secret ${key}`);
                }
              }
            }
          });

          this.results.push({
            testName: `Environment file security - ${envFile}`,
            category: 'secrets',
            passed: issues.length === 0,
            severity: issues.length > 0 ? 'high' : 'low',
            details: { file: envFile, issues },
            ...(issues.length > 0 && {
              recommendations: [
                'Use strong, unique values for all secrets',
                'Ensure .env files are in .gitignore',
                'Consider using a secret management system'
              ]
            })
          });

        } catch (error) {
          this.results.push({
            testName: `Environment file access - ${envFile}`,
            category: 'access',
            passed: false,
            severity: 'medium',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  private async testConfigFileSecrets(): Promise<void> {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'jest.config.js',
      'docker-compose.yml',
      'Dockerfile'
    ];

    for (const configFile of configFiles) {
      const filePath = join(this.config.projectRoot, configFile);
      
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const foundSecrets: string[] = [];

          for (const pattern of this.config.secretPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              foundSecrets.push(...matches);
            }
          }

          this.results.push({
            testName: `Configuration file secrets - ${configFile}`,
            category: 'secrets',
            passed: foundSecrets.length === 0,
            severity: foundSecrets.length > 0 ? 'high' : 'low',
            details: { file: configFile, foundSecrets: foundSecrets.slice(0, 5) },
            recommendations: foundSecrets.length > 0 ? [
              'Remove hardcoded secrets from configuration files',
              'Use environment variable references instead'
            ] : undefined
          });

        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }
  }

  private async testLogSecrets(): Promise<void> {
    const logDirs = ['logs', 'log', '.logs'];
    let foundLogSecrets = false;

    for (const logDir of logDirs) {
      const logPath = join(this.config.projectRoot, logDir);
      
      if (existsSync(logPath) && statSync(logPath).isDirectory()) {
        const logFiles = readdirSync(logPath)
          .filter(f => f.endsWith('.log') || f.endsWith('.txt'))
          .slice(0, 10); // Limit to prevent long scans

        for (const logFile of logFiles) {
          const filePath = join(logPath, logFile);
          
          try {
            const content = readFileSync(filePath, 'utf8');
            const lines = content.split('\n').slice(-100); // Check last 100 lines
            
            for (const line of lines) {
              for (const sensVar of this.SENSITIVE_VARS) {
                if (line.toLowerCase().includes(sensVar.toLowerCase()) && 
                    !line.includes('***') && !line.includes('[REDACTED]')) {
                  foundLogSecrets = true;
                  break;
                }
              }
              if (foundLogSecrets) break;
            }
          } catch (error) {
            continue;
          }
          
          if (foundLogSecrets) break;
        }
      }
    }

    this.results.push({
      testName: 'Log file secret exposure',
      category: 'secrets',
      passed: !foundLogSecrets,
      severity: foundLogSecrets ? 'high' : 'low',
      details: { logDirsChecked: logDirs.filter(d => existsSync(join(this.config.projectRoot, d))) },
      recommendations: foundLogSecrets ? [
        'Implement log sanitization',
        'Mask sensitive values in logs',
        'Review logging configuration'
      ] : undefined
    });
  }

  private async testGitHistorySecrets(): Promise<void> {
    try {
      // Check if we're in a git repository
      const isGitRepo = existsSync(join(this.config.projectRoot, '.git'));
      
      if (isGitRepo) {
        // Use git log to check for potential secrets in commit messages and diffs
        const gitLog = execSync('git log --oneline -n 100', { 
          cwd: this.config.projectRoot,
          encoding: 'utf8'
        });

        const suspiciousCommits: string[] = [];
        const lines = gitLog.split('\n');

        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          for (const sensVar of this.SENSITIVE_VARS) {
            if (lowerLine.includes(sensVar.toLowerCase())) {
              suspiciousCommits.push(line.substring(0, 80));
              break;
            }
          }
        }

        this.results.push({
          testName: 'Git history secret exposure',
          category: 'secrets',
          passed: suspiciousCommits.length === 0,
          severity: suspiciousCommits.length > 0 ? 'medium' : 'low',
          details: { 
            suspiciousCommits: suspiciousCommits.slice(0, 5),
            commitsScanned: lines.length
          },
          recommendations: suspiciousCommits.length > 0 ? [
            'Review commit messages for sensitive information',
            'Consider git filter-branch if secrets were committed',
            'Use conventional commit messages'
          ] : undefined
        });
      } else {
        this.results.push({
          testName: 'Git history secret exposure',
          category: 'secrets',
          passed: true,
          severity: 'low',
          details: { reason: 'Not a git repository' }
        });
      }
    } catch (error) {
      this.results.push({
        testName: 'Git history secret exposure',
        category: 'secrets',
        passed: false,
        severity: 'low',
        error: 'Unable to check git history: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }

  private async testRequiredVariables(): Promise<void> {
    const currentEnv = this.processEnv.NODE_ENV || 'development';
    const missingRequired: string[] = [];
    const incorrectFormat: string[] = [];

    for (const [varName, config] of Object.entries(this.REQUIRED_ENV_VARS)) {
      const value = this.processEnv[varName];
      
      // Check if required for current environment
      const isRequired = config.required && 
        (config.environments.includes('*') || config.environments.includes(currentEnv));

      if (isRequired && !value) {
        missingRequired.push(varName);
        continue;
      }

      if (value) {
        // Check format if pattern is specified
        if (config.pattern && !config.pattern.test(value)) {
          incorrectFormat.push(`${varName}: does not match required pattern`);
        }

        // Check minimum length
        if (config.minLength && value.length < config.minLength) {
          incorrectFormat.push(`${varName}: too short (minimum ${config.minLength} characters)`);
        }
      }
    }

    this.results.push({
      testName: 'Required environment variables',
      category: 'configuration',
      passed: missingRequired.length === 0 && incorrectFormat.length === 0,
      severity: missingRequired.length > 0 ? 'critical' : incorrectFormat.length > 0 ? 'high' : 'low',
      details: {
        environment: currentEnv,
        missingRequired,
        incorrectFormat,
        totalChecked: Object.keys(this.REQUIRED_ENV_VARS).length
      },
      recommendations: missingRequired.length > 0 || incorrectFormat.length > 0 ? [
        'Set all required environment variables',
        'Ensure values meet format requirements',
        'Use environment-specific configuration'
      ] : undefined
    });
  }

  private async testVariableFormats(): Promise<void> {
    const formatIssues: string[] = [];
    const namingIssues: string[] = [];

    for (const [key, value] of Object.entries(this.processEnv)) {
      if (value === undefined) continue;

      // Check naming conventions
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        namingIssues.push(`${key}: should use UPPER_SNAKE_CASE`);
      }

      // Check for suspicious values
      if (this.isSensitiveVariable(key)) {
        if (value.length < 8) {
          formatIssues.push(`${key}: too short for a secret`);
        }
        if (/^(test|demo|example|default|password|secret|key|token|123)$/i.test(value)) {
          formatIssues.push(`${key}: appears to be a placeholder value`);
        }
      }

      // Check URL formats
      if (key.includes('URL') || key.includes('URI')) {
        try {
          new URL(value);
        } catch {
          formatIssues.push(`${key}: invalid URL format`);
        }
      }

      // Check port numbers
      if (key.includes('PORT')) {
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          formatIssues.push(`${key}: invalid port number`);
        }
      }
    }

    this.results.push({
      testName: 'Environment variable formats',
      category: 'validation',
      passed: formatIssues.length === 0 && namingIssues.length === 0,
      severity: formatIssues.length > 0 ? 'medium' : namingIssues.length > 0 ? 'low' : 'low',
      details: {
        formatIssues: formatIssues.slice(0, 10),
        namingIssues: namingIssues.slice(0, 10),
        totalVariables: Object.keys(this.processEnv).length
      },
      recommendations: formatIssues.length > 0 || namingIssues.length > 0 ? [
        'Follow naming conventions (UPPER_SNAKE_CASE)',
        'Validate URL and port formats',
        'Use strong, non-default values for secrets'
      ] : undefined
    });
  }

  private async testDefaultValues(): Promise<void> {
    const defaultValues = [
      'changeme', 'password', 'secret', 'key', 'token',
      'admin', 'root', 'test', 'demo', 'example',
      '123456', 'password123', 'secret123',
      'localhost', '127.0.0.1', 'example.com'
    ];

    const foundDefaults: string[] = [];

    for (const [key, value] of Object.entries(this.processEnv)) {
      if (value && defaultValues.some(def => 
        value.toLowerCase().includes(def.toLowerCase())
      )) {
        foundDefaults.push(key);
      }
    }

    this.results.push({
      testName: 'Default value detection',
      category: 'configuration',
      passed: foundDefaults.length === 0,
      severity: foundDefaults.length > 0 ? 'high' : 'low',
      details: {
        foundDefaults: foundDefaults.slice(0, 10),
        defaultPatterns: defaultValues.length
      },
      recommendations: foundDefaults.length > 0 ? [
        'Replace default values with secure alternatives',
        'Generate strong random values for secrets',
        'Use environment-specific configurations'
      ] : undefined
    });
  }

  private async testInsecureConfigurations(): Promise<void> {
    const insecureConfigs: string[] = [];

    // Check for insecure configurations
    const checks = [
      { key: 'NODE_ENV', insecureValues: ['debug'], message: 'Debug mode in production' },
      { key: 'CORS_ORIGIN', insecureValues: ['*'], message: 'Wildcard CORS origin' },
      { key: 'SSL_VERIFY', insecureValues: ['false', '0'], message: 'SSL verification disabled' },
      { key: 'SECURE_COOKIES', insecureValues: ['false', '0'], message: 'Insecure cookies enabled' },
      { key: 'LOG_LEVEL', insecureValues: ['debug', 'trace'], message: 'Verbose logging enabled' }
    ];

    for (const check of checks) {
      const value = this.processEnv[check.key];
      if (value && check.insecureValues.includes(value.toLowerCase())) {
        insecureConfigs.push(`${check.key}: ${check.message}`);
      }
    }

    this.results.push({
      testName: 'Insecure configuration detection',
      category: 'configuration',
      passed: insecureConfigs.length === 0,
      severity: insecureConfigs.length > 0 ? 'medium' : 'low',
      details: { insecureConfigs },
      recommendations: insecureConfigs.length > 0 ? [
        'Review security-sensitive configuration values',
        'Use secure defaults for production',
        'Implement environment-specific overrides'
      ] : undefined
    });
  }

  private async testFilePermissions(): Promise<void> {
    const envFiles = ['.env', '.env.local', '.env.production'];
    const permissionIssues: string[] = [];

    for (const envFile of envFiles) {
      const filePath = join(this.config.projectRoot, envFile);
      
      if (existsSync(filePath)) {
        try {
          const stats = statSync(filePath);
          const mode = stats.mode & parseInt('777', 8);
          
          // Check if file is readable by others (should be 600 or 640 max)
          if (mode & parseInt('044', 8)) {
            permissionIssues.push(`${envFile}: readable by others (${mode.toString(8)})`);
          }
          
          // Check if file is writable by others
          if (mode & parseInt('022', 8)) {
            permissionIssues.push(`${envFile}: writable by others (${mode.toString(8)})`);
          }
        } catch (error) {
          permissionIssues.push(`${envFile}: unable to check permissions`);
        }
      }
    }

    this.results.push({
      testName: 'Environment file permissions',
      category: 'access',
      passed: permissionIssues.length === 0,
      severity: permissionIssues.length > 0 ? 'medium' : 'low',
      details: { permissionIssues },
      recommendations: permissionIssues.length > 0 ? [
        'Set restrictive permissions on .env files (chmod 600)',
        'Ensure .env files are not accessible by web server',
        'Use proper file ownership'
      ] : undefined
    });
  }

  private async testEnvironmentIsolation(): Promise<void> {
    const isolationIssues: string[] = [];
    const envVars = Object.keys(this.processEnv);

    // Check for cross-environment contamination
    const environments = ['development', 'staging', 'production'];
    for (const env of environments) {
      const envSpecificVars = envVars.filter(key => 
        key.toLowerCase().includes(env.toLowerCase()) ||
        key.endsWith(`_${env.toUpperCase()}`)
      );

      if (envSpecificVars.length > 0 && this.processEnv.NODE_ENV !== env) {
        isolationIssues.push(`Found ${env} variables in ${this.processEnv.NODE_ENV} environment`);
      }
    }

    this.results.push({
      testName: 'Environment isolation',
      category: 'access',
      passed: isolationIssues.length === 0,
      severity: isolationIssues.length > 0 ? 'medium' : 'low',
      details: { isolationIssues },
      recommendations: isolationIssues.length > 0 ? [
        'Separate environment-specific variables',
        'Use environment-specific .env files',
        'Implement proper deployment isolation'
      ] : undefined
    });
  }

  private async testUnauthorizedAccess(): Promise<void> {
    // This test would check for patterns that might indicate unauthorized access
    // For now, we'll do basic checks
    
    const accessIssues: string[] = [];
    
    // Check for suspicious environment variable patterns
    const suspiciousPatterns = [
      /.*DEBUG.*=.*true.*/i,
      /.*ADMIN.*=.*true.*/i,
      /.*ROOT.*=.*true.*/i,
      /.*BYPASS.*=.*true.*/i
    ];

    for (const [key, value] of Object.entries(this.processEnv)) {
      if (value) {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(`${key}=${value}`)) {
            accessIssues.push(`Suspicious variable: ${key}`);
          }
        }
      }
    }

    this.results.push({
      testName: 'Unauthorized access patterns',
      category: 'access',
      passed: accessIssues.length === 0,
      severity: accessIssues.length > 0 ? 'medium' : 'low',
      details: { accessIssues },
      recommendations: accessIssues.length > 0 ? [
        'Review debug and admin flags',
        'Ensure bypass mechanisms are disabled in production',
        'Implement proper access controls'
      ] : undefined
    });
  }

  private async testNamingConventions(): Promise<void> {
    const namingIssues: string[] = [];
    
    for (const key of Object.keys(this.processEnv)) {
      // Check naming convention (UPPER_SNAKE_CASE)
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        namingIssues.push(`${key}: should use UPPER_SNAKE_CASE`);
      }
      
      // Check for reserved names
      const reservedNames = ['PATH', 'HOME', 'USER', 'PWD'];
      if (reservedNames.includes(key)) {
        namingIssues.push(`${key}: conflicts with system variable`);
      }
    }

    this.results.push({
      testName: 'Variable naming conventions',
      category: 'validation',
      passed: namingIssues.length === 0,
      severity: 'low',
      details: { namingIssues: namingIssues.slice(0, 10) },
      recommendations: namingIssues.length > 0 ? [
        'Use UPPER_SNAKE_CASE for environment variables',
        'Avoid conflicts with system variables',
        'Use descriptive, consistent naming'
      ] : undefined
    });
  }

  private async testValueValidation(): Promise<void> {
    const validationIssues: string[] = [];

    for (const [key, value] of Object.entries(this.processEnv)) {
      if (!value) continue;

      // Validate based on variable name patterns
      if (key.includes('EMAIL') && !this.isValidEmail(value)) {
        validationIssues.push(`${key}: invalid email format`);
      }

      if (key.includes('URL') || key.includes('URI')) {
        if (!this.isValidUrl(value)) {
          validationIssues.push(`${key}: invalid URL format`);
        }
      }

      if (key.includes('PORT')) {
        if (!this.isValidPort(value)) {
          validationIssues.push(`${key}: invalid port number`);
        }
      }

      if (key.includes('TIMEOUT') || key.includes('INTERVAL')) {
        if (!this.isValidNumber(value)) {
          validationIssues.push(`${key}: should be a number`);
        }
      }

      if (key.includes('BOOLEAN') || key.includes('ENABLE') || key.includes('DISABLE')) {
        if (!this.isValidBoolean(value)) {
          validationIssues.push(`${key}: should be boolean (true/false)`);
        }
      }
    }

    this.results.push({
      testName: 'Value validation',
      category: 'validation',
      passed: validationIssues.length === 0,
      severity: validationIssues.length > 0 ? 'medium' : 'low',
      details: { validationIssues: validationIssues.slice(0, 10) },
      recommendations: validationIssues.length > 0 ? [
        'Validate environment variable formats',
        'Implement runtime validation',
        'Use type-safe configuration loading'
      ] : undefined
    });
  }

  private async testMissingValidation(): Promise<void> {
    // Check if there's a centralized environment validation system
    const validationFiles = [
      'src/config/env.ts',
      'src/config/environment.ts',
      'src/validation/env.ts',
      'config/env.js',
      'env.config.js'
    ];

    const hasValidation = validationFiles.some(file => 
      existsSync(join(this.config.projectRoot, file))
    );

    this.results.push({
      testName: 'Environment validation system',
      category: 'validation',
      passed: hasValidation,
      severity: hasValidation ? 'low' : 'medium',
      details: { 
        checkedFiles: validationFiles,
        hasValidation
      },
      recommendations: !hasValidation ? [
        'Implement centralized environment validation',
        'Use schema validation libraries (Joi, Zod, etc.)',
        'Validate on application startup'
      ] : undefined
    });
  }

  private async testClientSideExposure(): Promise<void> {
    const exposureIssues: string[] = [];
    const clientFiles = this.getSourceFiles()
      .filter(f => f.includes('client') || f.includes('frontend') || f.includes('public'));

    for (const file of clientFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        // Check for process.env usage in client files
        if (content.includes('process.env')) {
          const envMatches = content.match(/process\.env\.([A-Z_]+)/g);
          if (envMatches) {
            for (const match of envMatches) {
              const varName = match.replace('process.env.', '');
              if (this.isSensitiveVariable(varName)) {
                exposureIssues.push(`${file}: exposes sensitive variable ${varName}`);
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    this.results.push({
      testName: 'Client-side environment exposure',
      category: 'exposure',
      passed: exposureIssues.length === 0,
      severity: exposureIssues.length > 0 ? 'critical' : 'low',
      details: { 
        exposureIssues: exposureIssues.slice(0, 5),
        clientFilesScanned: clientFiles.length
      },
      recommendations: exposureIssues.length > 0 ? [
        'Never expose sensitive variables to client-side code',
        'Use public environment variables with NEXT_PUBLIC_ prefix if needed',
        'Implement server-side API endpoints for sensitive operations'
      ] : undefined
    });
  }

  private async testServerResponseExposure(): Promise<void> {
    const responseFiles = this.getSourceFiles()
      .filter(f => f.includes('route') || f.includes('api') || f.includes('controller'));

    let foundExposure = false;
    const exposureDetails: string[] = [];

    for (const file of responseFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        // Look for patterns that might expose environment variables
        const patterns = [
          /res\.json\(.*process\.env/,
          /response\.send\(.*process\.env/,
          /JSON\.stringify\(.*process\.env/
        ];

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            foundExposure = true;
            exposureDetails.push(`${file}: potential environment variable exposure in response`);
          }
        }
      } catch (error) {
        continue;
      }
    }

    this.results.push({
      testName: 'Server response environment exposure',
      category: 'exposure',
      passed: !foundExposure,
      severity: foundExposure ? 'high' : 'low',
      details: { 
        exposureDetails: exposureDetails.slice(0, 5),
        serverFilesScanned: responseFiles.length
      },
      recommendations: foundExposure ? [
        'Never include environment variables in API responses',
        'Sanitize response data',
        'Use explicit data mapping instead of direct object serialization'
      ] : undefined
    });
  }

  private async testDebuggingExposure(): Promise<void> {
    const debugPatterns = [
      /console\.log\(.*process\.env/,
      /console\.dir\(.*process\.env/,
      /debugger.*process\.env/,
      /logger\.debug\(.*process\.env/
    ];

    const debugFiles: string[] = [];
    const sourceFiles = this.getSourceFiles();

    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        for (const pattern of debugPatterns) {
          if (pattern.test(content)) {
            debugFiles.push(file);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }

    this.results.push({
      testName: 'Debug environment variable exposure',
      category: 'exposure',
      passed: debugFiles.length === 0,
      severity: debugFiles.length > 0 ? 'medium' : 'low',
      details: { 
        debugFiles: debugFiles.slice(0, 5),
        totalFilesScanned: sourceFiles.length
      },
      recommendations: debugFiles.length > 0 ? [
        'Remove debug statements that log environment variables',
        'Use proper logging libraries with level controls',
        'Implement log sanitization'
      ] : undefined
    });
  }

  private async testProcessExposure(): Promise<void> {
    // Check for process.env being passed around or exposed
    const sourceFiles = this.getSourceFiles();
    const exposurePatterns = [
      /export.*process\.env/,
      /return.*process\.env/,
      /\.env\s*=\s*process\.env/,
      /Object\.assign\(.*process\.env/
    ];

    const exposureFiles: string[] = [];

    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        for (const pattern of exposurePatterns) {
          if (pattern.test(content)) {
            exposureFiles.push(file);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }

    this.results.push({
      testName: 'Process environment exposure',
      category: 'exposure',
      passed: exposureFiles.length === 0,
      severity: exposureFiles.length > 0 ? 'medium' : 'low',
      details: { 
        exposureFiles: exposureFiles.slice(0, 5),
        patternsChecked: exposurePatterns.length
      },
      recommendations: exposureFiles.length > 0 ? [
        'Avoid exposing entire process.env object',
        'Use explicit environment variable access',
        'Implement configuration abstraction layer'
      ] : undefined
    });
  }

  // Helper methods
  private getSourceFiles(): string[] {
    const files: string[] = [];
    const dirs = ['src', 'lib', 'config', 'scripts'];

    for (const dir of dirs) {
      const dirPath = join(this.config.projectRoot, dir);
      if (existsSync(dirPath)) {
        this.scanDirectory(dirPath, files);
      }
    }

    return files.filter(f => 
      this.config.scanFileTypes.some(ext => f.endsWith(ext))
    );
  }

  private scanDirectory(dir: string, files: string[]): void {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!this.config.includeNodeModules && item === 'node_modules') {
            continue;
          }
          this.scanDirectory(fullPath, files);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private isSensitiveVariable(name: string): boolean {
    const upperName = name.toUpperCase();
    return this.SENSITIVE_VARS.some(sensitive => 
      upperName.includes(sensitive.toUpperCase())
    );
  }

  private isWeakValue(value: string): boolean {
    const weakValues = [
      'password', 'secret', 'key', 'token', 'changeme',
      '123456', 'admin', 'root', 'test', 'demo',
      'default', 'example', 'sample'
    ];
    
    return weakValues.some(weak => 
      value.toLowerCase().includes(weak.toLowerCase())
    ) || value.length < 8;
  }

  private isExposedValue(value: string): boolean {
    // Check if value looks like it might be exposed (not a reference or encrypted)
    return !value.startsWith('${') && 
           !value.includes('***') && 
           !value.includes('[REDACTED]') &&
           !/^[A-Fa-f0-9]{32,}$/.test(value); // Not a hash
  }

  private isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isValidPort(value: string): boolean {
    const port = parseInt(value, 10);
    return !isNaN(port) && port > 0 && port <= 65535;
  }

  private isValidNumber(value: string): boolean {
    return !isNaN(Number(value));
  }

  private isValidBoolean(value: string): boolean {
    return ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase());
  }

  /**
   * Generate validation summary
   */
  private generateSummary(): EnvValidationSummary {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = totalTests - passed;
    const successRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    // Count by severity
    const criticalIssues = this.results.filter(r => !r.passed && r.severity === 'critical').length;
    const highIssues = this.results.filter(r => !r.passed && r.severity === 'high').length;
    const mediumIssues = this.results.filter(r => !r.passed && r.severity === 'medium').length;
    const lowIssues = this.results.filter(r => !r.passed && r.severity === 'low').length;

    // Count by category
    const categories = this.results.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = { passed: 0, failed: 0 };
      }
      if (result.passed) {
        acc[result.category].passed++;
      } else {
        acc[result.category].failed++;
      }
      return acc;
    }, {} as Record<string, { passed: number; failed: number }>);

    // Generate recommendations
    const recommendations = this.results
      .filter(r => !r.passed && r.recommendations)
      .flatMap(r => r.recommendations!)
      .filter((rec, index, arr) => arr.indexOf(rec) === index)
      .slice(0, 10);

    return {
      totalTests,
      passed,
      failed,
      successRate,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      categories,
      recommendations
    };
  }

  /**
   * Get detailed test results
   */
  getResults(): EnvTestResult[] {
    return [...this.results];
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const summary = this.generateSummary();
    
    let report = '# Environment Variable Security Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Project:** ${this.config.projectRoot}\n\n`;
    
    report += '## Executive Summary\n\n';
    report += `- **Total Tests:** ${summary.totalTests}\n`;
    report += `- **Passed:** ${summary.passed}\n`;
    report += `- **Failed:** ${summary.failed}\n`;
    report += `- **Success Rate:** ${summary.successRate.toFixed(2)}%\n\n`;
    
    report += '### Issues by Severity\n\n';
    report += `- **Critical:** ${summary.criticalIssues}\n`;
    report += `- **High:** ${summary.highIssues}\n`;
    report += `- **Medium:** ${summary.mediumIssues}\n`;
    report += `- **Low:** ${summary.lowIssues}\n\n`;

    if (summary.criticalIssues > 0 || summary.highIssues > 0) {
      report += '## ⚠️ Priority Issues\n\n';
      
      const priorityIssues = this.results.filter(r => 
        !r.passed && (r.severity === 'critical' || r.severity === 'high')
      );
      
      priorityIssues.forEach(issue => {
        const severity = issue.severity.toUpperCase();
        report += `**${severity}:** ${issue.testName}\n`;
        if (issue.error) {
          report += `- Error: ${issue.error}\n`;
        }
        if (issue.recommendations) {
          report += `- Recommendations: ${issue.recommendations.join(', ')}\n`;
        }
        report += '\n';
      });
    }
    
    if (summary.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      summary.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '## Results by Category\n\n';
    
    Object.entries(summary.categories).forEach(([category, stats]) => {
      report += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      report += `- Passed: ${stats.passed}\n`;
      report += `- Failed: ${stats.failed}\n`;
      report += `- Success Rate: ${((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(2)}%\n\n`;
      
      const categoryResults = this.results.filter(r => r.category === category);
      categoryResults.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        report += `${status} **${result.testName}** (${result.severity})\n`;
        
        if (result.error) {
          report += `   - Error: ${result.error}\n`;
        }
        
        if (result.details) {
          const details = Object.entries(result.details)
            .slice(0, 3)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : value}`)
            .join(', ');
          if (details) {
            report += `   - Details: ${details}\n`;
          }
        }
        report += '\n';
      });
    });
    
    return report;
  }
}