/**
 * Performance tests for system load handling
 */

import { securityConfigValidator } from '../../src/config/validation/security-config-validator';
import { secretHealthChecker } from '../../src/config/validation/secret-health-checker';

describe('Performance Tests', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PERFORMANCE_TEST = 'true';
  });

  describe('Security Validator Performance', () => {
    it('should validate configuration within acceptable time limits', async () => {
      const testConfig = {
        security: {
          jwt: { secret: 'test-secret-key', expiresIn: '1h' },
          encryption: { algorithm: 'aes-256-gcm', keyLength: 32 }
        },
        database: { ssl: true, host: 'localhost' }
      };

      const startTime = Date.now();
      const result = await securityConfigValidator.validateConfiguration(testConfig);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result).toBeDefined();
    });

    it('should handle multiple concurrent validations', async () => {
      const testConfig = {
        security: {
          jwt: { secret: 'test-secret-key', expiresIn: '1h' }
        }
      };

      const promises = Array(10).fill(null).map(() => 
        securityConfigValidator.validateConfiguration(testConfig)
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results).toHaveLength(10);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  describe('Health Checker Performance', () => {
    it('should complete health check within time limit', async () => {
      const startTime = Date.now();
      const healthReport = await secretHealthChecker.performHealthCheck();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(healthReport).toBeDefined();
    });
  });

  afterAll(async () => {
    delete process.env.PERFORMANCE_TEST;
  });
});