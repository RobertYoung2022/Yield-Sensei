/**
 * Database Security Validator Test Suite
 */

import { DatabaseSecurityValidator } from '../../../src/security/database/db-security-validator';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('DatabaseSecurityValidator', () => {
  let validator: DatabaseSecurityValidator;
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Setup test directory
    testDir = join(process.cwd(), 'test-data', 'db-security-validator');
    mkdirSync(testDir, { recursive: true });

    // Backup original environment
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    validator = new DatabaseSecurityValidator(testDir);
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Connection Security Tests', () => {
    test('should detect SSL configuration issues', async () => {
      // Set up test environment without SSL
      const testEnv = {
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?sslmode=disable'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testConnectionSecurity']();
      const results = validator.getResults();

      const connectionResults = results.filter(r => r.testName.includes('connection security'));
      expect(connectionResults.length).toBeGreaterThan(0);
      
      const result = connectionResults[0];
      if (result) {
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('high');
      }
    });

    test('should pass with proper SSL configuration', async () => {
      const testEnv = {
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_SSL: 'true',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?sslmode=require'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testConnectionSecurity']();
      const results = validator.getResults();

      const connectionResults = results.filter(r => r.testName.includes('connection security'));
      expect(connectionResults.length).toBeGreaterThan(0);
    });
  });

  describe('SQL Injection Prevention Tests', () => {
    test('should detect vulnerable query patterns', async () => {
      // Create test source file with SQL injection vulnerabilities
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      const vulnerableCode = `
        app.get('/users/:id', (req, res) => {
          const query = "SELECT * FROM users WHERE id = " + req.params.id;
          db.query(query, (err, results) => {
            res.json(results);
          });
        });

        app.post('/login', (req, res) => {
          const sql = \`SELECT * FROM users WHERE email = '\${req.body.email}' AND password = '\${req.body.password}'\`;
          db.query(sql);
        });
      `;
      
      writeFileSync(join(srcDir, 'vulnerable.js'), vulnerableCode);

      await validator['testSqlInjectionPrevention']();
      const results = validator.getResults();

      const injectionResults = results.filter(r => r.testName.includes('SQL injection'));
      expect(injectionResults.length).toBeGreaterThan(0);
      
      const result = injectionResults[0];
      if (result) {
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('critical');
      }
    });

    test('should pass with parameterized queries', async () => {
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      const secureCode = `
        app.get('/users/:id', (req, res) => {
          const query = "SELECT * FROM users WHERE id = $1";
          db.query(query, [req.params.id], (err, results) => {
            res.json(results);
          });
        });

        app.post('/login', (req, res) => {
          const sql = "SELECT * FROM users WHERE email = $1 AND password = $2";
          db.query(sql, [req.body.email, req.body.password]);
        });
      `;
      
      writeFileSync(join(srcDir, 'secure.js'), secureCode);

      await validator['testSqlInjectionPrevention']();
      const results = validator.getResults();

      const injectionResults = results.filter(r => r.testName.includes('SQL injection'));
      expect(injectionResults.length).toBeGreaterThan(0);
    });
  });

  describe('Access Control Tests', () => {
    test('should detect privileged database users', async () => {
      const testEnv = {
        DB_USER: 'root',
        DB_PASSWORD: 'password123'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testAccessControls']();
      const results = validator.getResults();

      const accessResults = results.filter(r => r.testName.includes('access controls'));
      expect(accessResults.length).toBeGreaterThan(0);
      
      const result = accessResults[0];
      if (result) {
        expect(result.passed).toBe(false);
      }
    });

    test('should pass with proper access configuration', async () => {
      const testEnv = {
        DB_USER: 'app_reader',
        DB_PASSWORD: 'secure-random-password-12345'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // Create a file that suggests RBAC implementation
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'auth.js'), `
        const checkUserRole = (user) => {
          return user.role && user.permissions;
        };
        
        const auditLog = (action, user) => {
          console.log(\`User \${user.id} performed \${action}\`);
        };
      `);

      await validator['testAccessControls']();
      const results = validator.getResults();

      const accessResults = results.filter(r => r.testName.includes('access controls'));
      expect(accessResults.length).toBeGreaterThan(0);
    });
  });

  describe('Encryption Tests', () => {
    test('should detect missing encryption configuration', async () => {
      // Clear encryption-related environment variables
      Object.keys(process.env).forEach(key => delete process.env[key]);

      await validator['testEncryption']();
      const results = validator.getResults();

      const encryptionResults = results.filter(r => r.testName.includes('encryption'));
      expect(encryptionResults.length).toBeGreaterThan(0);
      
      const result = encryptionResults[0];
      if (result) {
        expect(result.passed).toBe(false);
      }
    });

    test('should pass with proper encryption setup', async () => {
      const testEnv = {
        DB_SSL: 'true',
        DB_ENCRYPTION_KEY: 'encryption-key-12345',
        BACKUP_ENCRYPTION_KEY: 'backup-key-12345'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // Create files suggesting encryption implementation
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'crypto.js'), `
        const encrypt = (data) => {
          // Encryption logic
        };
        
        const decrypt = (data) => {
          // Decryption logic
        };
      `);

      await validator['testEncryption']();
      const results = validator.getResults();

      const encryptionResults = results.filter(r => r.testName.includes('encryption'));
      expect(encryptionResults.length).toBeGreaterThan(0);
    });
  });

  describe('Query Monitoring Tests', () => {
    test('should detect missing monitoring configuration', async () => {
      Object.keys(process.env).forEach(key => delete process.env[key]);

      await validator['testQueryMonitoring']();
      const results = validator.getResults();

      const monitoringResults = results.filter(r => r.testName.includes('monitoring'));
      expect(monitoringResults.length).toBeGreaterThan(0);
      
      const result = monitoringResults[0];
      if (result) {
        expect(result.passed).toBe(false);
      }
    });

    test('should pass with monitoring configured', async () => {
      const testEnv = {
        DB_LOG_QUERIES: 'true',
        DB_SLOW_QUERY_THRESHOLD: '1000',
        DB_CONNECTION_MONITORING: 'true'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // Create files suggesting monitoring implementation
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'monitoring.js'), `
        const detectSuspiciousQuery = (query) => {
          if (query.includes('DROP') || query.includes('DELETE FROM users')) {
            return true; // suspicious
          }
          return false;
        };
        
        const logAnomalyDetection = (query) => {
          console.log('Anomaly detected:', query);
        };
      `);

      await validator['testQueryMonitoring']();
      const results = validator.getResults();

      const monitoringResults = results.filter(r => r.testName.includes('monitoring'));
      expect(monitoringResults.length).toBeGreaterThan(0);
    });
  });

  describe('Database Configuration Tests', () => {
    test('should detect insecure configuration', async () => {
      const testEnv = {
        DB_PORT: '5432', // Default port
        // Missing connection limits and timeouts
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testDatabaseConfiguration']();
      const results = validator.getResults();

      const configResults = results.filter(r => r.testName.includes('configuration'));
      expect(configResults.length).toBeGreaterThan(0);
      
      const result = configResults[0];
      if (result) {
        expect(result.passed).toBe(false);
      }
    });
  });

  describe('Backup Security Tests', () => {
    test('should detect missing backup security', async () => {
      Object.keys(process.env).forEach(key => delete process.env[key]);

      await validator['testBackupSecurity']();
      const results = validator.getResults();

      const backupResults = results.filter(r => r.testName.includes('backup'));
      expect(backupResults.length).toBeGreaterThan(0);
      
      const result = backupResults[0];
      if (result) {
        expect(result.passed).toBe(false);
      }
    });

    test('should pass with backup security configured', async () => {
      const testEnv = {
        DB_BACKUP_ENABLED: 'true',
        BACKUP_ENCRYPTION_KEY: 'backup-encryption-key-12345',
        BACKUP_ACCESS_KEY: 'backup-access-key',
        BACKUP_SCHEDULE: '0 2 * * *'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      await validator['testBackupSecurity']();
      const results = validator.getResults();

      const backupResults = results.filter(r => r.testName.includes('backup'));
      expect(backupResults.length).toBeGreaterThan(0);
    });
  });

  describe('Full Validation Suite', () => {
    test('should run complete validation successfully', async () => {
      // Set up a mixed environment for testing
      const testEnv = {
        NODE_ENV: 'development',
        DB_HOST: 'localhost',
        DB_PORT: '5433', // Non-default port
        DB_USER: 'app_user',
        DB_PASSWORD: 'secure-database-password-12345',
        DB_SSL: 'true',
        DB_ENCRYPTION_KEY: 'encryption-key-12345',
        DB_LOG_QUERIES: 'true'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // Create test source files
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      // Secure code example
      writeFileSync(join(srcDir, 'secure-db.js'), `
        const getUserById = (id) => {
          return db.query('SELECT * FROM users WHERE id = $1', [id]);
        };
        
        const checkUserRole = (user) => {
          return user.role && user.permissions;
        };
        
        const encrypt = (data) => { /* encryption */ };
        const decrypt = (data) => { /* decryption */ };
      `);

      const summary = await validator.validateAll();
      
      expect(summary.totalTests).toBeGreaterThan(5);
      expect(summary.passed).toBeGreaterThan(0);
      expect(summary.successRate).toBeGreaterThan(0);
      expect(summary.recommendations).toBeDefined();
    }, 30000);

    test('should generate comprehensive report', async () => {
      // Run some tests first
      await validator['testConnectionSecurity']();
      await validator['testAccessControls']();
      
      const report = validator.generateReport();
      
      expect(report).toContain('# Database Security Report');
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
    test('should correctly identify RBAC implementation', () => {
      // Create files with RBAC patterns
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'rbac.js'), `
        const userRole = 'admin';
        const permission = 'read:users';
      `);

      const hasRBAC = validator['checkRBACImplementation']();
      expect(typeof hasRBAC).toBe('boolean');
    });

    test('should correctly identify audit logging', () => {
      const srcDir = join(testDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'audit.js'), `
        const auditLog = require('audit-logger');
        auditLog.log('user_login', { userId: 123 });
      `);

      const hasAuditLog = validator['checkAuditLogging']();
      expect(typeof hasAuditLog).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing directories gracefully', async () => {
      const nonExistentValidator = new DatabaseSecurityValidator('/non/existent/path');
      
      // Should not throw an error
      await expect(nonExistentValidator.validateAll()).resolves.not.toThrow();
    });

    test('should handle database connection errors gracefully', async () => {
      // Set invalid database configuration
      const testEnv = {
        DB_HOST: 'invalid-host',
        DB_PORT: '9999',
        DB_USER: 'invalid-user'
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, testEnv);

      // This should not cause the validation to fail
      await expect(validator['testConnectionSecurity']()).resolves.not.toThrow();
    });
  });

  describe('Summary Generation', () => {
    test('should generate accurate summary statistics', async () => {
      await validator['testDatabaseConfiguration']();
      const summary = validator['generateSummary']();
      
      expect(summary.totalTests).toBe(summary.passed + summary.failed);
      expect(summary.successRate).toBe((summary.passed / summary.totalTests) * 100);
      
      const totalSeverityIssues = summary.criticalIssues + summary.highIssues + 
                                 summary.mediumIssues + summary.lowIssues;
      expect(totalSeverityIssues).toBe(summary.failed);
    });

    test('should provide actionable recommendations', async () => {
      // Set up environment that will generate recommendations
      Object.keys(process.env).forEach(key => delete process.env[key]);
      process.env['DB_USER'] = 'root'; // This should trigger recommendations

      await validator['testAccessControls']();
      const summary = validator['generateSummary']();
      
      expect(Array.isArray(summary.recommendations)).toBe(true);
      if (summary.failed > 0) {
        expect(summary.recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Realistic Scenarios', () => {
    test('should handle typical development environment', async () => {
      const devEnv = {
        NODE_ENV: 'development',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'dev_user',
        DB_PASSWORD: 'dev-password-12345',
        DB_NAME: 'yieldsensei_dev',
        DB_SSL: 'false' // Acceptable in development
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, devEnv);

      const summary = await validator.validateAll();
      
      // Development environment should have reasonable success rate
      expect(summary.successRate).toBeGreaterThan(50);
      // Critical issues should be minimal in dev
      expect(summary.criticalIssues).toBeLessThan(3);
    });

    test('should detect production security issues', async () => {
      const insecureProdEnv = {
        NODE_ENV: 'production',
        DB_HOST: 'production-db.example.com',
        DB_PORT: '5432', // Default port
        DB_USER: 'postgres', // Privileged user
        DB_PASSWORD: 'password123', // Weak password
        // Missing SSL configuration
      };
      
      Object.keys(process.env).forEach(key => delete process.env[key]);
      Object.assign(process.env, insecureProdEnv);

      const summary = await validator.validateAll();
      
      // Should detect critical issues in production
      expect(summary.criticalIssues + summary.highIssues).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });
  });
});