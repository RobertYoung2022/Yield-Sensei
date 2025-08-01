/**
 * Pulse Satellite - Security and Edge Case Testing Suite
 * Task 24.7: Comprehensive security testing and edge case handling
 * 
 * Tests security vulnerabilities, timeout handling, rate limiting, and extreme edge cases
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { PulseSatellite } from '../../../src/satellites/pulse/pulse-satellite';
import { YieldOptimizationEngine } from '../../../src/satellites/pulse/optimization/yield-optimization-engine';
import { ProtocolDiscoveryService } from '../../../src/satellites/pulse/discovery/protocol-discovery-service';
import { getUnifiedAIClient } from '../../../src/integrations/ai/unified-ai-client';
import { getLogger } from '../../../src/shared/logging/logger';
import Redis from 'ioredis';
import { Pool } from 'pg';

describe('Pulse Satellite - Security and Edge Case Testing Suite', () => {
  let pulseSatellite: PulseSatellite;
  let yieldEngine: YieldOptimizationEngine;
  let discoveryService: ProtocolDiscoveryService;
  let redisClient: Redis;
  let pgPool: Pool;
  let aiClient: any;
  let logger: any;

  beforeAll(async () => {
    // Initialize dependencies with timeout configurations
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 10000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'yieldsense_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10
    });

    aiClient = getUnifiedAIClient();
    logger = getLogger({ name: 'pulse-security-test' });

    // Initialize with security hardening
    pulseSatellite = new PulseSatellite({
      enabledFeatures: ['yield_optimization', 'protocol_discovery'],
      operationalMode: 'secure',
      maxConcurrentOperations: 5,
      emergencyProtections: true,
      rateLimiting: true,
      timeoutConfig: {
        defaultTimeout: 10000,
        apiTimeout: 15000,
        dbTimeout: 5000
      }
    }, redisClient, pgPool, aiClient, logger);

    await pulseSatellite.initialize();
    yieldEngine = pulseSatellite.getYieldOptimizationEngine();
    discoveryService = pulseSatellite.getProtocolDiscoveryService();
  });

  afterAll(async () => {
    if (pulseSatellite) {
      await pulseSatellite.shutdown();
    }
    if (redisClient) {
      await redisClient.quit();
    }
    if (pgPool) {
      await pgPool.end();
    }
  });

  describe('Network Timeout and APR Request Handling', () => {
    
    test('should handle APR API timeouts gracefully', async () => {
      const timeoutScenarios = [
        {
          protocolId: 'slow-protocol',
          endpoint: 'https://slow-api.example.com/apr',
          expectedTimeout: 5000, // 5 seconds
          fallbackStrategy: 'use_cached_data'
        },
        {
          protocolId: 'unreliable-protocol',
          endpoint: 'https://unreliable-api.example.com/apr',
          expectedTimeout: 10000, // 10 seconds
          fallbackStrategy: 'estimate_from_history'
        },
        {
          protocolId: 'dead-protocol',
          endpoint: 'https://dead-endpoint.example.com/apr',
          expectedTimeout: 3000, // 3 seconds
          fallbackStrategy: 'exclude_from_optimization'
        }
      ];

      for (const scenario of timeoutScenarios) {
        const startTime = Date.now();
        
        const result = await yieldEngine.fetchAPRWithTimeout(
          scenario.protocolId,
          scenario.endpoint,
          scenario.expectedTimeout
        );

        const endTime = Date.now();
        const actualTime = endTime - startTime;

        expect(result).toBeDefined();
        expect(actualTime).toBeLessThan(scenario.expectedTimeout + 2000); // Allow 2s buffer

        if (result.timedOut) {
          expect(result.fallbackUsed).toBe(true);
          expect(result.fallbackStrategy).toBe(scenario.fallbackStrategy);
          
          switch (scenario.fallbackStrategy) {
            case 'use_cached_data':
              expect(result.data.source).toBe('cache');
              expect(result.data.age).toBeDefined();
              break;
            case 'estimate_from_history':
              expect(result.data.source).toBe('historical_estimate');
              expect(result.data.confidence).toBeDefined();
              break;
            case 'exclude_from_optimization':
              expect(result.excluded).toBe(true);
              expect(result.reason).toContain('timeout');
              break;
          }
        } else {
          expect(result.data.apr).toBeGreaterThan(0);
          expect(result.data.timestamp).toBeDefined();
        }
      }
    });

    test('should implement exponential backoff for failed APR requests', async () => {
      const failingProtocol = {
        id: 'failing-protocol',
        endpoint: 'https://failing-api.example.com/apr',
        maxRetries: 3,
        baseDelay: 1000 // 1 second
      };

      const retryAttempts = [];
      
      const result = await yieldEngine.fetchAPRWithRetry(
        failingProtocol,
        {
          onRetry: (attempt, delay) => {
            retryAttempts.push({ attempt, delay, timestamp: Date.now() });
          }
        }
      );

      expect(result).toBeDefined();
      expect(retryAttempts.length).toBeLessThanOrEqual(failingProtocol.maxRetries);

      // Verify exponential backoff
      if (retryAttempts.length > 1) {
        for (let i = 1; i < retryAttempts.length; i++) {
          const currentDelay = retryAttempts[i].delay;
          const previousDelay = retryAttempts[i - 1].delay;
          expect(currentDelay).toBeGreaterThanOrEqual(previousDelay * 1.5); // At least 1.5x increase
        }
      }

      // Should eventually give up and provide fallback
      if (result.failed) {
        expect(result.fallbackData).toBeDefined();
        expect(result.retryCount).toBe(failingProtocol.maxRetries);
      }
    });

    test('should handle concurrent APR requests with rate limiting', async () => {
      const concurrentRequests = Array(20).fill(null).map((_, i) => ({
        protocolId: `protocol-${i}`,
        priority: i < 5 ? 'high' : i < 15 ? 'medium' : 'low'
      }));

      const rateLimitConfig = {
        maxConcurrent: 5,
        requestsPerSecond: 10,
        priorityQueuing: true
      };

      const startTime = Date.now();
      
      const results = await yieldEngine.fetchMultipleAPRs(
        concurrentRequests,
        rateLimitConfig
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results.length).toBe(concurrentRequests.length);
      
      // Should respect rate limiting (not complete instantly)
      expect(totalTime).toBeGreaterThan(1000); // At least 1 second for 20 requests at 10/sec

      // High priority requests should complete first
      const highPriorityResults = results.filter(r => r.priority === 'high');
      const lowPriorityResults = results.filter(r => r.priority === 'low');
      
      if (highPriorityResults.length > 0 && lowPriorityResults.length > 0) {
        const avgHighPriorityTime = highPriorityResults.reduce((sum, r) => sum + r.completionTime, 0) / highPriorityResults.length;
        const avgLowPriorityTime = lowPriorityResults.reduce((sum, r) => sum + r.completionTime, 0) / lowPriorityResults.length;
        
        expect(avgHighPriorityTime).toBeLessThan(avgLowPriorityTime);
      }

      // Verify no requests were dropped due to rate limiting
      const successfulRequests = results.filter(r => r.success).length;
      expect(successfulRequests).toBeGreaterThan(results.length * 0.8); // At least 80% success
    });
  });

  describe('Input Validation and Sanitization', () => {
    
    test('should validate and sanitize user inputs', async () => {
      const maliciousInputs = [
        {
          name: 'SQL Injection Attempt',
          input: {
            totalCapital: "'; DROP TABLE protocols; --",
            riskTolerance: 0.5
          }
        },
        {
          name: 'XSS Attempt',
          input: {
            totalCapital: 100000,
            protocolFilter: "<script>alert('xss')</script>"
          }
        },
        {
          name: 'Buffer Overflow Attempt',
          input: {
            totalCapital: 100000,
            notes: 'A'.repeat(10000) // Very long string
          }
        },
        {
          name: 'Invalid Number Types',
          input: {
            totalCapital: "not_a_number",
            riskTolerance: "infinity"
          }
        },
        {
          name: 'Negative Values',
          input: {
            totalCapital: -100000,
            riskTolerance: -0.5
          }
        }
      ];

      for (const testCase of maliciousInputs) {
        const result = await yieldEngine.optimizeAllocation([], testCase.input);

        expect(result).toBeDefined();
        
        if (result.error) {
          expect(result.error.type).toBe('validation_error');
          expect(result.error.sanitized).toBe(true);
          expect(result.maliciousInputDetected).toBe(true);
        } else {
          // If no error, inputs should be sanitized
          expect(result.sanitizedInputs).toBeDefined();
          expect(result.inputValidationPassed).toBe(true);
        }
      }
    });

    test('should enforce strict parameter boundaries', async () => {
      const boundaryTests = [
        {
          name: 'Extremely High Capital',
          input: { totalCapital: 1e15, riskTolerance: 0.5 }, // $1 quadrillion
          expectedBehavior: 'cap_at_maximum'
        },
        {
          name: 'Zero Capital',
          input: { totalCapital: 0, riskTolerance: 0.5 },
          expectedBehavior: 'reject_with_error'
        },
        {
          name: 'Risk Tolerance Above 1',
          input: { totalCapital: 100000, riskTolerance: 1.5 },
          expectedBehavior: 'cap_at_one'
        },
        {
          name: 'Excessive Max Positions',
          input: { totalCapital: 100000, maxPositions: 1000 },
          expectedBehavior: 'cap_at_reasonable_limit'
        }
      ];

      for (const test of boundaryTests) {
        const result = await yieldEngine.optimizeAllocation([], test.input);

        expect(result).toBeDefined();

        switch (test.expectedBehavior) {
          case 'cap_at_maximum':
            expect(result.adjustedInputs.totalCapital).toBeLessThan(test.input.totalCapital);
            expect(result.warnings).toContain('capital_capped');
            break;
          case 'reject_with_error':
            expect(result.error).toBeDefined();
            expect(result.error.code).toBe('invalid_capital');
            break;
          case 'cap_at_one':
            expect(result.adjustedInputs.riskTolerance).toBeLessThanOrEqual(1);
            expect(result.warnings).toContain('risk_tolerance_capped');
            break;
          case 'cap_at_reasonable_limit':
            expect(result.adjustedInputs.maxPositions).toBeLessThan(test.input.maxPositions);
            expect(result.warnings).toContain('max_positions_capped');
            break;
        }
      }
    });
  });

  describe('Protocol Security Validation', () => {
    
    test('should detect and block malicious protocol contracts', async () => {
      const suspiciousProtocols = [
        {
          id: 'honeypot-protocol',
          name: 'Too Good To Be True',
          apy: 10000, // 1,000,000% APY - obvious scam
          contractAddress: '0x1234567890123456789012345678901234567890',
          auditStatus: 'none',
          codeVerified: false,
          redFlags: ['unlimited_minting', 'no_withdrawal_mechanism', 'admin_backdoor']
        },
        {
          id: 'phishing-protocol',
          name: 'Compound Finance', // Impersonating legitimate protocol
          apy: 0.08,
          contractAddress: '0xfakeaddress123456789012345678901234567890',
          websiteUrl: 'compound-finance-fake.com',
          redFlags: ['domain_typosquatting', 'copied_interface', 'suspicious_admin_keys']
        },
        {
          id: 'rug-pull-risk',
          name: 'QuickYield Protocol',
          apy: 0.5, // 50% APY - suspiciously high
          teamInfo: 'anonymous',
          liquidityLocked: false,
          tokenDistribution: { team: 0.8, public: 0.2 }, // Team controls 80%
          redFlags: ['anonymous_team', 'unlocked_liquidity', 'high_team_allocation']
        }
      ];

      for (const protocol of suspiciousProtocols) {
        const securityAnalysis = await discoveryService.analyzeProtocolSecurity(protocol);

        expect(securityAnalysis).toBeDefined();
        expect(securityAnalysis.riskScore).toBeGreaterThan(0.8); // High risk
        expect(securityAnalysis.blocked).toBe(true);
        expect(securityAnalysis.redFlags.length).toBeGreaterThan(0);

        // Should provide specific warnings
        protocol.redFlags.forEach(flag => {
          expect(securityAnalysis.detectedFlags).toContain(flag);
        });

        // Should not be included in optimization
        const optimizationResult = await yieldEngine.optimizeAllocation(
          [protocol],
          { totalCapital: 100000, riskTolerance: 0.5 }
        );

        expect(optimizationResult.allocations.length).toBe(0);
        expect(optimizationResult.excludedProtocols).toContain(protocol.id);
        expect(optimizationResult.exclusionReasons[protocol.id]).toContain('security_risk');
      }
    });

    test('should verify protocol contract authenticity', async () => {
      const protocolsToVerify = [
        {
          id: 'claimed-compound',
          claimedName: 'Compound Finance',
          contractAddress: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', // Real Compound
          expectedMatch: true
        },
        {
          id: 'fake-compound',
          claimedName: 'Compound Finance',
          contractAddress: '0x1111111111111111111111111111111111111111', // Fake address
          expectedMatch: false
        },
        {
          id: 'claimed-aave',
          claimedName: 'Aave Protocol',
          contractAddress: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', // Real Aave
          expectedMatch: true
        }
      ];

      for (const protocol of protocolsToVerify) {
        const verification = await discoveryService.verifyProtocolAuthenticity(protocol);

        expect(verification).toBeDefined();
        expect(verification.verified).toBe(protocol.expectedMatch);

        if (protocol.expectedMatch) {
          expect(verification.matchConfidence).toBeGreaterThan(0.9);
          expect(verification.officialContract).toBe(true);
        } else {
          expect(verification.matchConfidence).toBeLessThan(0.5);
          expect(verification.warnings).toContain('address_mismatch');
          expect(verification.potentialImpersonation).toBe(true);
        }
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    
    test('should handle database connection failures', async () => {
      // Simulate database connection failure
      await pgPool.end(); // Close all connections

      const operationsBefore = [
        () => yieldEngine.getHistoricalData('compound-usdc'),
        () => discoveryService.saveProtocolData({ id: 'test', name: 'Test' }),
        () => pulseSatellite.getPortfolioState()
      ];

      const results = [];
      
      for (const operation of operationsBefore) {
        const result = await operation().catch(error => ({ error: error.message }));
        results.push(result);
      }

      // All operations should handle the DB failure gracefully
      results.forEach(result => {
        if (result.error) {
          expect(result.error).toContain('database');
        } else {
          // If no error, should indicate fallback was used
          expect(result.fallbackUsed || result.cachedData).toBe(true);
        }
      });

      // Reinitialize database for subsequent tests
      pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'yieldsense_test',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      });

      // Verify recovery
      const recoveryTest = await yieldEngine.getHistoricalData('compound-usdc');
      expect(recoveryTest).toBeDefined();
    });

    test('should handle Redis cache failures', async () => {
      // Simulate Redis failure
      await redisClient.quit();

      const cacheOperations = [
        () => yieldEngine.getCachedAPR('compound-usdc'),
        () => discoveryService.getCachedProtocols(),
        () => pulseSatellite.getCachedOptimization('user-123')
      ];

      for (const operation of cacheOperations) {
        const result = await operation().catch(error => ({ error: error.message }));
        
        expect(result).toBeDefined();
        
        if (result.error) {
          expect(result.error).toContain('cache' || 'redis');
        } else {
          // Should fallback to direct data source
          expect(result.source).toBe('direct');
          expect(result.cacheBypass).toBe(true);
        }
      }

      // Reinitialize Redis
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: true
      });
    });

    test('should handle AI service failures', async () => {
      // Mock AI service failure
      const originalAIClient = aiClient;
      aiClient = {
        chat: () => { throw new Error('AI service unavailable'); },
        analyze: () => { throw new Error('AI service timeout'); }
      };

      const aiDependentOperations = [
        () => discoveryService.analyzeProtocolSecurity({ id: 'test', name: 'Test' }),
        () => yieldEngine.getAIOptimizedAllocation([], { totalCapital: 100000 }),
        () => pulseSatellite.getAIRiskAssessment({ protocolId: 'test' })
      ];

      for (const operation of aiDependentOperations) {
        const result = await operation().catch(error => ({ error: error.message }));
        
        expect(result).toBeDefined();
        
        if (result.error) {
          expect(result.error).toContain('AI' || 'service unavailable');
        } else {
          // Should fallback to rule-based analysis
          expect(result.fallbackMethod).toBe('rule_based');
          expect(result.aiEnhanced).toBe(false);
        }
      }

      // Restore AI client
      aiClient = originalAIClient;
    });
  });

  describe('Extreme Edge Cases', () => {
    
    test('should handle market crash scenarios', async () => {
      const crashScenario = {
        trigger: 'major_protocol_hack',
        marketImpact: {
          overallTVLDrop: 0.6, // 60% TVL drop across DeFi
          correlationIncrease: 0.95, // Everything moves together
          liquidityDrain: 0.8, // 80% liquidity reduction
          volatilitySpike: 5.0 // 5x normal volatility
        },
        affectedProtocols: [
          { id: 'protocol-1', tvlDrop: 0.9, apyDrop: 0.5 },
          { id: 'protocol-2', tvlDrop: 0.7, apyDrop: 0.3 },
          { id: 'protocol-3', tvlDrop: 0.8, apyDrop: 0.4 }
        ]
      };

      const emergencyResponse = await pulseSatellite.handleMarketCrash(crashScenario);

      expect(emergencyResponse).toBeDefined();
      expect(emergencyResponse.emergencyModeActivated).toBe(true);
      expect(emergencyResponse.immediateActions).toBeDefined();
      expect(emergencyResponse.immediateActions.length).toBeGreaterThan(0);

      // Should trigger emergency exits
      const exitActions = emergencyResponse.immediateActions.filter(
        action => action.type === 'emergency_exit'
      );
      expect(exitActions.length).toBeGreaterThan(0);

      // Should preserve capital in safe assets
      expect(emergencyResponse.safeAssetAllocation).toBeGreaterThan(0.5); // At least 50% in safe assets
      expect(emergencyResponse.estimatedLoss).toBeLessThan(0.3); // Max 30% loss

      // Should provide recovery strategy
      expect(emergencyResponse.recoveryStrategy).toBeDefined();
      expect(emergencyResponse.recoveryTimeline).toBeDefined();
    });

    test('should handle protocol mass exodus scenarios', async () => {
      const exodusScenario = {
        trigger: 'regulatory_crackdown',
        affectedRegions: ['US', 'EU'],
        protocolsAffected: 15,
        userExitRate: 0.8, // 80% of users exiting
        timeWindow: 24 // hours
      };

      const exodusResponse = await pulseSatellite.handleMassExodus(exodusScenario);

      expect(exodusResponse).toBeDefined();
      expect(exodusResponse.contingencyPlan).toBeDefined();
      expect(exodusResponse.alternativeProtocols).toBeDefined();
      expect(exodusResponse.alternativeProtocols.length).toBeGreaterThan(0);

      // Should recommend jurisdiction-safe protocols
      exodusResponse.alternativeProtocols.forEach(protocol => {
        expect(protocol.jurisdictionCompliant).toBe(true);
        expect(protocol.regulatoryRisk).toBeLessThan(0.3);
      });

      // Should provide exit strategy if needed
      if (exodusResponse.exitRecommended) {
        expect(exodusResponse.exitStrategy).toBeDefined();
        expect(exodusResponse.exitStrategy.priorityOrder).toBeDefined();
        expect(exodusResponse.exitStrategy.timeframe).toBeLessThan(exodusScenario.timeWindow);
      }
    });

    test('should handle zero-liquidity scenarios', async () => {
      const liquidityScenarios = [
        {
          protocolId: 'illiquid-protocol',
          availableLiquidity: 0,
          userPosition: 100000,
          scenario: 'complete_liquidity_drain'
        },
        {
          protocolId: 'partial-liquidity',
          availableLiquidity: 5000,
          userPosition: 100000,
          scenario: 'insufficient_liquidity'
        }
      ];

      for (const scenario of liquidityScenarios) {
        const liquidityResponse = await yieldEngine.handleLiquidityCrisis(scenario);

        expect(liquidityResponse).toBeDefined();
        expect(liquidityResponse.strategy).toBeDefined();

        if (scenario.availableLiquidity === 0) {
          expect(liquidityResponse.strategy).toBe('wait_for_liquidity');
          expect(liquidityResponse.alternativeOptions).toBeDefined();
          expect(liquidityResponse.estimatedWaitTime).toBeDefined();
        } else {
          expect(liquidityResponse.strategy).toBe('partial_exit');
          expect(liquidityResponse.exitPlan).toBeDefined();
          expect(liquidityResponse.exitPlan.batchSizes).toBeDefined();
        }

        // Should provide realistic timelines
        expect(liquidityResponse.timeline).toBeDefined();
        expect(liquidityResponse.riskAssessment).toBeDefined();
      }
    });
  });

  describe('Performance Under Stress', () => {
    
    test('should maintain functionality under memory pressure', async () => {
      // Simulate memory pressure by creating large objects
      const memoryPressureTest = Array(100).fill(null).map(() => ({
        largeData: new Array(10000).fill('x'.repeat(1000)),
        timestamp: Date.now()
      }));

      const operationsUnderPressure = [
        () => yieldEngine.optimizeAllocation([], { totalCapital: 100000 }),
        () => discoveryService.discoverProtocols({ maxResults: 10 }),
        () => pulseSatellite.getSystemHealth()
      ];

      const results = [];
      
      for (const operation of operationsUnderPressure) {
        const startTime = Date.now();
        const result = await operation();
        const endTime = Date.now();
        
        results.push({
          result,
          executionTime: endTime - startTime,
          memoryUsage: process.memoryUsage()
        });
      }

      // Operations should still complete
      results.forEach(test => {
        expect(test.result).toBeDefined();
        expect(test.executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      });

      // Clean up memory pressure
      memoryPressureTest.splice(0);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    test('should handle CPU-intensive operations gracefully', async () => {
      const cpuIntensiveConfig = {
        protocols: 500,
        optimizationRounds: 100,
        backtestPeriod: 365 // days
      };

      const startTime = Date.now();
      
      const intensiveResult = await yieldEngine.performIntensiveOptimization(cpuIntensiveConfig);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(intensiveResult).toBeDefined();
      expect(intensiveResult.completed).toBe(true);
      
      // Should complete in reasonable time (allow up to 2 minutes for intensive operations)
      expect(executionTime).toBeLessThan(120000);

      // Should maintain system responsiveness
      const healthCheck = await pulseSatellite.getSystemHealth();
      expect(healthCheck.responsive).toBe(true);
      expect(healthCheck.cpuUsage).toBeLessThan(0.95); // Less than 95% CPU
    });
  });
});

/**
 * Security and Edge Case Testing Suite Summary
 * 
 * This test suite validates:
 * ✅ APR API timeout handling with fallback strategies
 * ✅ Exponential backoff for failed requests
 * ✅ Rate limiting and concurrent request management
 * ✅ Input validation and malicious input sanitization
 * ✅ Parameter boundary enforcement
 * ✅ Malicious protocol detection and blocking
 * ✅ Protocol contract authenticity verification
 * ✅ Database connection failure handling
 * ✅ Redis cache failure recovery
 * ✅ AI service failure fallbacks
 * ✅ Market crash scenario response
 * ✅ Protocol mass exodus handling
 * ✅ Zero-liquidity scenario management
 * ✅ Performance under memory pressure
 * ✅ CPU-intensive operation handling
 * 
 * Task 24.7 completion status: ✅ READY FOR VALIDATION
 */