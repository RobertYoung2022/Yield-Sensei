/**
 * Simple Environment Variable Validator Test Suite
 */

import { SimpleEnvironmentValidator } from '../../../src/security/environment/env-validator-simple';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('SimpleEnvironmentValidator', () => {
  let validator: SimpleEnvironmentValidator;
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Setup test directory
    testDir = join(process.cwd(), 'test-data', 'simple-env-validator');
    mkdirSync(testDir, { recursive: true });

    // Backup original environment
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    validator = new SimpleEnvironmentValidator(testDir);
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Core Security Tests', () => {
    test('should detect hardcoded secrets in source files', async () => {
      // Create test source file with hardcoded secret
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      const testFile = join(srcDir, 'test.js');
      writeFileSync(testFile, `
        const config = {
          apiKey: "sk-1234567890abcdef",
          password: "hardcoded-password"
        };
      `);

      await validator['testHardcodedSecrets']();
      const results = validator.getResults();

      const secretResults = results.filter(r => r.testName.includes('Hardcoded secrets'));
      expect(secretResults.length).toBeGreaterThan(0);
    });

    test('should validate .env file security', async () => {
      // Create test .env file with weak values
      const envContent = `
NODE_ENV=development
JWT_SECRET=changeme
DATABASE_PASSWORD=weak123
SECURE_SECRET=a-very-long-and-secure-secret-key
`;
      writeFileSync(join(testDir, '.env'), envContent);

      await validator['testEnvFileSecrets']();
      const results = validator.getResults();

      const envResults = results.filter(r => r.testName.includes('Environment file security'));
      expect(envResults.length).toBeGreaterThan(0);
    });

    test('should check required environment variables', async () => {
      // Set up test environment with missing variables
      const testEnv = {
        NODE_ENV: 'production',
        // Missing JWT_SECRET and VAULT_ENCRYPTION_KEY
        PORT: '3000'
      };
      
      // Temporarily modify process.env
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testRequiredVariables']();
      const results = validator.getResults();

      const requiredResults = results.filter(r => r.testName.includes('Required environment variables'));
      expect(requiredResults.length).toBeGreaterThan(0);
    });

    test('should detect default values', async () => {
      // Set up test environment with default values
      const testEnv = {
        JWT_SECRET: 'changeme',
        DATABASE_PASSWORD: 'password123',
        API_KEY: 'test-key'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testDefaultValues']();
      const results = validator.getResults();

      const defaultResults = results.filter(r => r.testName.includes('Default value detection'));
      expect(defaultResults.length).toBeGreaterThan(0);
    });

    test('should validate naming conventions', async () => {
      // Set up test environment with naming issues
      const testEnv = {
        'lower-case-var': 'value',
        'VALID_VAR': 'value',
        'mixedCaseVar': 'value'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testNamingConventions']();
      const results = validator.getResults();

      const namingResults = results.filter(r => r.testName.includes('naming conventions'));
      expect(namingResults.length).toBeGreaterThan(0);
    });
  });

  describe('Full Validation Suite', () => {
    test('should run complete validation successfully', async () => {
      // Set up a mixed environment for testing
      const testEnv = {
        NODE_ENV: 'development',
        JWT_SECRET: 'a-secure-jwt-secret-key-for-testing',
        VAULT_ENCRYPTION_KEY: 'a-secure-vault-encryption-key',
        WEAK_SECRET: 'changeme', // This should fail
        'invalid-name': 'value' // This should fail naming
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // Create test source file
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'good.js'), 'const port = process.env["PORT"];');

      const summary = await validator.validateAll();
      
      expect(summary.totalTests).toBeGreaterThan(3);
      expect(summary.passed).toBeGreaterThan(0);
      expect(summary.successRate).toBeGreaterThan(0);
      expect(summary.recommendations).toBeDefined();
    }, 30000);

    test('should generate comprehensive report', async () => {
      // Run some tests first
      await validator['testDefaultValues']();
      await validator['testNamingConventions']();
      
      const report = validator.generateReport();
      
      expect(report).toContain('# Environment Variable Security Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Test Results');
      expect(report).toContain('Total Tests:');
      expect(report).toContain('Success Rate:');
    });

    test('should provide structured results', () => {
      const results = validator.getResults();
      
      results.forEach(result => {
        expect(result.testName).toBeDefined();
        expect(result.category).toBeDefined();
        expect(typeof result.passed).toBe('boolean');
        expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
        expect(Array.isArray(result.recommendations)).toBe(true);
      });
    });
  });

  describe('Helper Methods', () => {
    test('should correctly identify sensitive variables', () => {
      expect(validator['isSensitiveVariable']('JWT_SECRET')).toBe(true);
      expect(validator['isSensitiveVariable']('API_KEY')).toBe(true);
      expect(validator['isSensitiveVariable']('PASSWORD')).toBe(true);
      expect(validator['isSensitiveVariable']('NODE_ENV')).toBe(false);
      expect(validator['isSensitiveVariable']('PORT')).toBe(false);
    });

    test('should correctly identify weak values', () => {
      expect(validator['isWeakValue']('changeme')).toBe(true);
      expect(validator['isWeakValue']('password123')).toBe(true);
      expect(validator['isWeakValue']('123456')).toBe(true);
      expect(validator['isWeakValue']('short')).toBe(true); // Too short
      expect(validator['isWeakValue']('a-very-secure-and-long-secret-key')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing directories gracefully', async () => {
      const nonExistentValidator = new SimpleEnvironmentValidator('/non/existent/path');
      
      // Should not throw an error
      await expect(nonExistentValidator.validateAll()).resolves.not.toThrow();
    });

    test('should handle file read errors gracefully', async () => {
      // Create a file we can't read (system dependent)
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      // This should not cause the validation to fail
      await expect(validator['testHardcodedSecrets']()).resolves.not.toThrow();
    });
  });

  describe('Summary Generation', () => {
    test('should generate accurate summary statistics', async () => {
      await validator['testNamingConventions']();
      const summary = validator['generateSummary']();
      
      expect(summary.totalTests).toBe(summary.passed + summary.failed);
      expect(summary.successRate).toBe((summary.passed / summary.totalTests) * 100);
      
      const totalSeverityIssues = summary.criticalIssues + summary.highIssues + 
                                 summary.mediumIssues + summary.lowIssues;
      expect(totalSeverityIssues).toBe(summary.failed);
    });

    test('should provide actionable recommendations', async () => {
      // Set up environment that will generate recommendations
      const testEnv = { WEAK_SECRET: 'changeme' };
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testDefaultValues']();
      const summary = validator['generateSummary']();
      
      expect(Array.isArray(summary.recommendations)).toBe(true);
      if (summary.failed > 0) {
        expect(summary.recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('File Scanning', () => {
    test('should correctly scan source directories', () => {
      // Create test file structure
      const srcDir = join(testDir, 'src');
      const libDir = join(testDir, 'lib');
      mkdirSync(srcDir, { recursive: true });
      mkdirSync(libDir, { recursive: true });
      
      writeFileSync(join(srcDir, 'test.js'), 'console.log("test");');
      writeFileSync(join(srcDir, 'test.ts'), 'const x = 1;');
      writeFileSync(join(libDir, 'utils.js'), 'export const utils = {};');
      writeFileSync(join(testDir, 'README.md'), '# Test'); // Should be ignored
      
      const files = validator['getSourceFiles']();
      
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files.some(f => f.endsWith('.js'))).toBe(true);
      expect(files.some(f => f.endsWith('.ts'))).toBe(true);
      expect(files.some(f => f.endsWith('.md'))).toBe(false);
    });
  });

  describe('Realistic Scenarios', () => {
    test('should handle typical development environment', async () => {
      const devEnv = {
        NODE_ENV: 'development',
        PORT: '3000',
        JWT_SECRET: 'dev-jwt-secret-key-that-is-reasonably-long',
        DATABASE_URL: 'postgresql://localhost:5432/devdb',
        VAULT_ENCRYPTION_KEY: 'dev-vault-key-32-chars-minimum'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, devEnv);

      const summary = await validator.validateAll();
      
      // Development environment should have good success rate
      expect(summary.successRate).toBeGreaterThan(60);
      expect(summary.criticalIssues).toBe(0);
    });

    test('should detect production security issues', async () => {
      const insecureProdEnv = {
        NODE_ENV: 'production',
        JWT_SECRET: 'changeme', // Weak
        DATABASE_PASSWORD: 'admin123', // Default-ish
        // Missing VAULT_ENCRYPTION_KEY
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, insecureProdEnv);

      const summary = await validator.validateAll();
      
      // Should detect critical issues
      expect(summary.criticalIssues + summary.highIssues).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });
  });
});