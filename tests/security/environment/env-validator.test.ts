/**
 * Environment Variable Validator Test Suite
 */

import { EnvironmentVariableValidator } from '../../../src/security/environment/env-validator';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('EnvironmentVariableValidator', () => {
  let validator: EnvironmentVariableValidator;
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Setup test directory
    testDir = join(process.cwd(), 'test-data', 'env-validator');
    mkdirSync(testDir, { recursive: true });

    // Backup original environment
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // Reset to clean environment
    validator = new EnvironmentVariableValidator({
      projectRoot: testDir,
      includeNodeModules: false,
      checkGitHistory: false
    });
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Secrets Exposure Testing', () => {
    test('should detect hardcoded secrets in source files', async () => {
      // Create test source file with hardcoded secret
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      const testFile = join(srcDir, 'test.js');
      writeFileSync(testFile, `
        const config = {
          apiKey: "sk-1234567890abcdef",
          password: "hardcoded-password",
          secret: "my-secret-key"
        };
      `);

      await validator['testHardcodedSecrets']();
      const results = validator.getResults();

      const secretResults = results.filter(r => r.testName.includes('Hardcoded secrets'));
      expect(secretResults.length).toBeGreaterThan(0);
      expect(secretResults.some(r => !r.passed)).toBe(true);
    });

    test('should validate .env file security', async () => {
      // Create test .env file
      const envContent = `
NODE_ENV=development
JWT_SECRET=changeme
DATABASE_PASSWORD=weak123
API_KEY=sk-1234567890abcdef
SECURE_SECRET=a-very-long-and-secure-secret-key-that-is-definitely-not-weak
`;
      writeFileSync(join(testDir, '.env'), envContent);

      await validator['testEnvFileSecrets']();
      const results = validator.getResults();

      const envResults = results.filter(r => r.testName.includes('Environment file security'));
      expect(envResults.length).toBeGreaterThan(0);
      
      // Should detect weak values
      const failedEnvResults = envResults.filter(r => !r.passed);
      expect(failedEnvResults.length).toBeGreaterThan(0);
    });

    test('should check configuration files for secrets', async () => {
      // Create package.json with potential secret
      const packageJson = {
        name: 'test-package',
        scripts: {
          deploy: 'API_KEY=secret-key npm run deploy'
        }
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      await validator['testConfigFileSecrets']();
      const results = validator.getResults();

      const configResults = results.filter(r => r.testName.includes('Configuration file secrets'));
      expect(configResults.length).toBeGreaterThan(0);
    });

    test('should detect secrets in log files', async () => {
      // Create log directory with test logs
      const logDir = join(testDir, 'logs');
      mkdirSync(logDir, { recursive: true });
      
      const logContent = `
2024-01-01 10:00:00 INFO Starting application
2024-01-01 10:00:01 DEBUG JWT_SECRET: my-secret-key
2024-01-01 10:00:02 ERROR Database connection failed with password: db-password
`;
      writeFileSync(join(logDir, 'app.log'), logContent);

      await validator['testLogSecrets']();
      const results = validator.getResults();

      const logResults = results.filter(r => r.testName.includes('Log file secret exposure'));
      expect(logResults.length).toBeGreaterThan(0);
      
      // Should detect secret exposure in logs
      const failedLogResults = logResults.filter(r => !r.passed);
      expect(failedLogResults.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Security Testing', () => {
    test('should validate required environment variables', async () => {
      // Set up test environment with missing required variables
      const testEnv = {
        NODE_ENV: 'production',
        // Missing JWT_SECRET and VAULT_ENCRYPTION_KEY
        PORT: '3000'
      };
      
      // Temporarily modify process.env for this test
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testRequiredVariables']();
      const results = validator.getResults();

      const requiredResults = results.filter(r => r.testName.includes('Required environment variables'));
      expect(requiredResults.length).toBeGreaterThan(0);
      
      // Should fail due to missing required variables
      const failedRequired = requiredResults.filter(r => !r.passed);
      expect(failedRequired.length).toBeGreaterThan(0);
    });

    test('should validate environment variable formats', async () => {
      // Set up test environment with invalid formats
      const testEnv = {
        NODE_ENV: 'invalid-environment',
        PORT: '99999999', // Invalid port
        DATABASE_URL: 'not-a-url',
        JWT_SECRET: '123', // Too short
        invalidName: 'should-be-upper-case'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testVariableFormats']();
      const results = validator.getResults();

      const formatResults = results.filter(r => r.testName.includes('Environment variable formats'));
      expect(formatResults.length).toBeGreaterThan(0);
      
      // Should detect format issues
      const failedFormats = formatResults.filter(r => !r.passed);
      expect(failedFormats.length).toBeGreaterThan(0);
    });

    test('should detect default values', async () => {
      // Set up test environment with default/weak values
      const testEnv = {
        JWT_SECRET: 'changeme',
        DATABASE_PASSWORD: 'password123',
        API_KEY: 'demo-key',
        ADMIN_PASSWORD: 'admin'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testDefaultValues']();
      const results = validator.getResults();

      const defaultResults = results.filter(r => r.testName.includes('Default value detection'));
      expect(defaultResults.length).toBeGreaterThan(0);
      
      // Should detect default values
      const failedDefaults = defaultResults.filter(r => !r.passed);
      expect(failedDefaults.length).toBeGreaterThan(0);
    });

    test('should detect insecure configurations', async () => {
      // Set up test environment with insecure settings
      const testEnv = {
        NODE_ENV: 'debug',
        CORS_ORIGIN: '*',
        SSL_VERIFY: 'false',
        LOG_LEVEL: 'debug'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testInsecureConfigurations']();
      const results = validator.getResults();

      const insecureResults = results.filter(r => r.testName.includes('Insecure configuration detection'));
      expect(insecureResults.length).toBeGreaterThan(0);
      
      // Should detect insecure configurations
      const failedInsecure = insecureResults.filter(r => !r.passed);
      expect(failedInsecure.length).toBeGreaterThan(0);
    });
  });

  describe('Access Control Testing', () => {
    test('should check file permissions on .env files', async () => {
      // Create .env file (permissions will depend on system)
      writeFileSync(join(testDir, '.env'), 'TEST=value');

      await validator['testFilePermissions']();
      const results = validator.getResults();

      const permissionResults = results.filter(r => r.testName.includes('Environment file permissions'));
      expect(permissionResults.length).toBeGreaterThan(0);
    });

    test('should test environment isolation', async () => {
      // Set up test environment with cross-environment contamination
      const testEnv = {
        NODE_ENV: 'development',
        PRODUCTION_SECRET: 'prod-secret', // Production var in development
        STAGING_API_KEY: 'staging-key'    // Staging var in development
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testEnvironmentIsolation']();
      const results = validator.getResults();

      const isolationResults = results.filter(r => r.testName.includes('Environment isolation'));
      expect(isolationResults.length).toBeGreaterThan(0);
    });

    test('should detect unauthorized access patterns', async () => {
      // Set up test environment with suspicious patterns
      const testEnv = {
        DEBUG_MODE: 'true',
        ADMIN_BYPASS: 'true',
        ROOT_ACCESS: 'true'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testUnauthorizedAccess']();
      const results = validator.getResults();

      const accessResults = results.filter(r => r.testName.includes('Unauthorized access patterns'));
      expect(accessResults.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Rules Testing', () => {
    test('should validate naming conventions', async () => {
      // Set up test environment with naming issues
      const testEnv = {
        'lower-case-var': 'value',
        'mixedCaseVar': 'value',
        'VALID_VAR': 'value',
        'PATH': 'conflicts-with-system' // Reserved name
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testNamingConventions']();
      const results = validator.getResults();

      const namingResults = results.filter(r => r.testName.includes('Variable naming conventions'));
      expect(namingResults.length).toBeGreaterThan(0);
    });

    test('should validate values based on patterns', async () => {
      // Set up test environment with validation issues
      const testEnv = {
        EMAIL_ADDRESS: 'not-an-email',
        DATABASE_URL: 'invalid-url',
        PORT: 'not-a-number',
        TIMEOUT_MS: 'not-a-number',
        ENABLE_FEATURE: 'maybe' // Should be boolean
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testValueValidation']();
      const results = validator.getResults();

      const validationResults = results.filter(r => r.testName.includes('Value validation'));
      expect(validationResults.length).toBeGreaterThan(0);
    });

    test('should check for missing validation system', async () => {
      await validator['testMissingValidation']();
      const results = validator.getResults();

      const missingResults = results.filter(r => r.testName.includes('Environment validation system'));
      expect(missingResults.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Exposure Testing', () => {
    test('should detect client-side exposure', async () => {
      // Create client-side file that exposes secrets
      const clientDir = join(testDir, 'src', 'client');
      mkdirSync(clientDir, { recursive: true });
      
      const clientFile = join(clientDir, 'config.js');
      writeFileSync(clientFile, `
        const config = {
          apiKey: process.env['SECRET_API_KEY'],
          jwt: process.env['JWT_SECRET']
        };
        export default config;
      `);

      await validator['testClientSideExposure']();
      const results = validator.getResults();

      const clientResults = results.filter(r => r.testName.includes('Client-side environment exposure'));
      expect(clientResults.length).toBeGreaterThan(0);
    });

    test('should detect server response exposure', async () => {
      // Create API route that might expose environment variables
      const apiDir = join(testDir, 'src', 'api');
      mkdirSync(apiDir, { recursive: true });
      
      const apiFile = join(apiDir, 'config.js');
      writeFileSync(apiFile, `
        app.get('/config', (req, res) => {
          res.json({
            environment: process.env['NODE_ENV'],
            secret: process.env['SECRET_KEY'] // This should not be exposed
          });
        });
      `);

      await validator['testServerResponseExposure']();
      const results = validator.getResults();

      const responseResults = results.filter(r => r.testName.includes('Server response environment exposure'));
      expect(responseResults.length).toBeGreaterThan(0);
    });

    test('should detect debugging exposure', async () => {
      // Create file with debug statements that log environment variables
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      const debugFile = join(srcDir, 'debug.js');
      writeFileSync(debugFile, `
        console.log('Environment:', process.env);
        console.log('JWT Secret:', process.env['JWT_SECRET']);
        logger.debug('Database URL:', process.env['DATABASE_URL']);
      `);

      await validator['testDebuggingExposure']();
      const results = validator.getResults();

      const debugResults = results.filter(r => r.testName.includes('Debug environment variable exposure'));
      expect(debugResults.length).toBeGreaterThan(0);
    });

    test('should detect process exposure', async () => {
      // Create file that exposes process.env
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      const processFile = join(srcDir, 'config.js');
      writeFileSync(processFile, `
        export const env = process.env;
        export function getConfig() {
          return process.env;
        }
      `);

      await validator['testProcessExposure']();
      const results = validator.getResults();

      const processResults = results.filter(r => r.testName.includes('Process environment exposure'));
      expect(processResults.length).toBeGreaterThan(0);
    });
  });

  describe('Full Validation Suite', () => {
    test('should run complete validation successfully', async () => {
      // Set up a mixed environment for comprehensive testing
      const testEnv = {
        NODE_ENV: 'development',
        JWT_SECRET: 'a-reasonably-long-secret-key-for-testing',
        VAULT_ENCRYPTION_KEY: 'another-long-key-for-vault-encryption',
        PORT: '3000',
        WEAK_SECRET: 'changeme', // This should fail
        'invalid-name': 'value' // This should fail naming
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // Create some test files
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(join(srcDir, 'good.js'), 'const config = { port: process.env["PORT"] };');
      writeFileSync(join(srcDir, 'bad.js'), 'const secret = "hardcoded-secret";');

      const summary = await validator.validateAll();
      
      expect(summary.totalTests).toBeGreaterThan(15);
      expect(summary.passed).toBeGreaterThan(0);
      expect(summary.failed).toBeGreaterThan(0); // We expect some failures from our test setup
      expect(summary.categories).toBeDefined();
      expect(Object.keys(summary.categories).length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for full suite

    test('should generate comprehensive report', async () => {
      // Run a few tests first
      await validator['testDefaultValues']();
      await validator['testNamingConventions']();
      
      const report = validator.generateReport();
      
      expect(report).toContain('# Environment Variable Security Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Results by Category');
      expect(report).toContain('Total Tests:');
      expect(report).toContain('Success Rate:');
    });

    test('should provide detailed results structure', () => {
      const results = validator.getResults();
      
      results.forEach(result => {
        expect(result.testName).toBeDefined();
        expect(result.category).toBeDefined();
        expect(typeof result.passed).toBe('boolean');
        expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
        
        if (!result.passed && result.recommendations) {
          expect(Array.isArray(result.recommendations)).toBe(true);
          expect(result.recommendations.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Helper Methods', () => {
    test('should correctly identify sensitive variables', () => {
      const sensitiveVars = ['JWT_SECRET', 'API_KEY', 'PASSWORD', 'PRIVATE_KEY'];
      const normalVars = ['NODE_ENV', 'PORT', 'DEBUG'];
      
      sensitiveVars.forEach(varName => {
        expect(validator['isSensitiveVariable'](varName)).toBe(true);
      });
      
      normalVars.forEach(varName => {
        expect(validator['isSensitiveVariable'](varName)).toBe(false);
      });
    });

    test('should correctly identify weak values', () => {
      const weakValues = ['password', 'secret', 'changeme', '12345', 'admin'];
      const strongValues = ['a-very-long-and-secure-secret-key', 'Str0ng!P@ssw0rd123'];
      
      weakValues.forEach(value => {
        expect(validator['isWeakValue'](value)).toBe(true);
      });
      
      strongValues.forEach(value => {
        expect(validator['isWeakValue'](value)).toBe(false);
      });
    });

    test('should validate different value formats', () => {
      // Email validation
      expect(validator['isValidEmail']('test@example.com')).toBe(true);
      expect(validator['isValidEmail']('invalid-email')).toBe(false);
      
      // URL validation
      expect(validator['isValidUrl']('https://example.com')).toBe(true);
      expect(validator['isValidUrl']('not-a-url')).toBe(false);
      
      // Port validation
      expect(validator['isValidPort']('3000')).toBe(true);
      expect(validator['isValidPort']('99999999')).toBe(false);
      
      // Boolean validation
      expect(validator['isValidBoolean']('true')).toBe(true);
      expect(validator['isValidBoolean']('maybe')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing files gracefully', async () => {
      // Try to scan a non-existent directory
      const nonExistentValidator = new EnvironmentVariableValidator({
        projectRoot: join(testDir, 'non-existent'),
        includeNodeModules: false,
        checkGitHistory: false
      });

      // Should not throw an error
      await expect(nonExistentValidator['testHardcodedSecrets']()).resolves.not.toThrow();
    });

    test('should handle permission errors gracefully', async () => {
      // This test would be system-dependent, so we'll just ensure
      // the file permission test completes without throwing
      await expect(validator['testFilePermissions']()).resolves.not.toThrow();
    });

    test('should handle git errors gracefully', async () => {
      // Test git history check when not in a git repository
      await expect(validator['testGitHistorySecrets']()).resolves.not.toThrow();
    });
  });
});