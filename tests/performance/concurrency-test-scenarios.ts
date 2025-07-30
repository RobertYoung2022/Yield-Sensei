import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ConcurrencyTester, UserScenario, ConcurrencyTestConfig } from './concurrency-tester';
import { PerformanceMonitor } from './performance-monitor';
import * as http from 'http';

describe('Concurrency Testing', () => {
  let tester: ConcurrencyTester;
  let testServer: http.Server;
  let serverPort: number;

  beforeEach(async () => {
    // Create a test HTTP server
    testServer = http.createServer((req, res) => {
      // Simulate some processing time
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'Success', 
          timestamp: Date.now(),
          path: req.url 
        }));
      }, Math.random() * 100); // 0-100ms response time
    });

    await new Promise<void>(resolve => {
      testServer.listen(0, () => {
        serverPort = (testServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (tester) {
      await tester.stop();
    }
    
    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => err ? reject(err) : resolve());
    });
  });

  describe('Basic Concurrency Tests', () => {
    test('should execute simple concurrent scenario', async () => {
      const scenarios: UserScenario[] = [{
        name: 'Simple Request',
        weight: 100,
        steps: [{
          name: 'Get Home',
          action: 'request',
          params: {
            url: `http://localhost:${serverPort}/`,
            method: 'GET'
          }
        }]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 5,
        rampUpTime: 1000,
        sustainTime: 2000,
        rampDownTime: 1000,
        thinkTime: 100
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      expect(results.summary.totalUsers).toBeGreaterThan(0);
      expect(results.summary.successfulUsers).toBeGreaterThan(0);
      expect(results.summary.averageResponseTime).toBeGreaterThan(0);
      expect(results.summary.throughput).toBeGreaterThan(0);
    });

    test('should handle multiple scenarios with weights', async () => {
      const scenarios: UserScenario[] = [
        {
          name: 'Browse Products',
          weight: 60,
          steps: [
            {
              name: 'View Products',
              action: 'request',
              params: { url: `http://localhost:${serverPort}/products` }
            },
            {
              name: 'View Details',
              action: 'request',
              params: { url: `http://localhost:${serverPort}/products/1` }
            }
          ]
        },
        {
          name: 'Search',
          weight: 30,
          steps: [{
            name: 'Search Products',
            action: 'request',
            params: { 
              url: `http://localhost:${serverPort}/search`,
              method: 'POST',
              body: { query: 'test' }
            }
          }]
        },
        {
          name: 'Checkout',
          weight: 10,
          steps: [
            {
              name: 'Add to Cart',
              action: 'request',
              params: { 
                url: `http://localhost:${serverPort}/cart`,
                method: 'POST',
                body: { productId: 1 }
              }
            },
            {
              name: 'Checkout',
              action: 'request',
              params: { 
                url: `http://localhost:${serverPort}/checkout`,
                method: 'POST'
              }
            }
          ]
        }
      ];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 10,
        rampUpTime: 2000,
        sustainTime: 3000,
        rampDownTime: 1000,
        thinkTime: 200
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      // Check scenario distribution
      const scenarioMetrics = results.scenarioMetrics;
      expect(scenarioMetrics.size).toBe(3);

      // Verify weights are roughly respected
      const totalExecutions = Array.from(scenarioMetrics.values())
        .reduce((sum, m) => sum + m.executions, 0);
      
      const browsePercentage = (scenarioMetrics.get('Browse Products')?.executions || 0) / totalExecutions * 100;
      const searchPercentage = (scenarioMetrics.get('Search')?.executions || 0) / totalExecutions * 100;
      const checkoutPercentage = (scenarioMetrics.get('Checkout')?.executions || 0) / totalExecutions * 100;

      expect(browsePercentage).toBeGreaterThan(40);
      expect(searchPercentage).toBeGreaterThan(15);
      expect(checkoutPercentage).toBeGreaterThan(0);
    });
  });

  describe('Concurrency Metrics', () => {
    test('should track concurrent users over time', async () => {
      const scenarios: UserScenario[] = [{
        name: 'Test Scenario',
        weight: 100,
        steps: [{
          name: 'Test Step',
          action: 'wait',
          params: { duration: 500 }
        }]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 20,
        rampUpTime: 2000,
        sustainTime: 2000,
        rampDownTime: 2000,
        thinkTime: 0
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      expect(results.concurrencyMetrics.peakConcurrentUsers).toBeLessThanOrEqual(20);
      expect(results.concurrencyMetrics.averageConcurrentUsers).toBeGreaterThan(0);
      expect(results.concurrencyMetrics.userDistribution.size).toBeGreaterThan(0);

      // Verify ramp pattern
      const timeline = Array.from(results.concurrencyMetrics.userDistribution.entries())
        .sort((a, b) => a[0] - b[0]);
      
      // Should see increase during ramp-up
      const firstQuarter = timeline.slice(0, Math.floor(timeline.length / 4));
      const lastQuarter = timeline.slice(Math.floor(timeline.length * 3 / 4));
      
      const avgFirstQuarter = firstQuarter.reduce((sum, [, users]) => sum + users, 0) / firstQuarter.length;
      const avgLastQuarter = lastQuarter.reduce((sum, [, users]) => sum + users, 0) / lastQuarter.length;
      
      expect(avgFirstQuarter).toBeLessThan(avgLastQuarter);
    });

    test('should detect contention points', async () => {
      const scenarios: UserScenario[] = [{
        name: 'Database Heavy',
        weight: 100,
        steps: [
          {
            name: 'DB Read',
            action: 'database',
            params: { operation: 'read' }
          },
          {
            name: 'DB Write',
            action: 'database',
            params: { operation: 'write' }
          }
        ]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 50,
        rampUpTime: 1000,
        sustainTime: 3000,
        rampDownTime: 1000,
        thinkTime: 0
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      // Should detect database contention
      expect(results.concurrencyMetrics.contentionPoints.length).toBeGreaterThan(0);
      
      const dbContention = results.concurrencyMetrics.contentionPoints
        .filter(p => p.resource === 'database');
      
      expect(dbContention.length).toBeGreaterThan(0);
      expect(dbContention[0].waitingUsers).toBeGreaterThan(1);
      expect(dbContention[0].averageWaitTime).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    test('should integrate with performance monitor', async () => {
      const performanceMonitor = new PerformanceMonitor({
        metricsInterval: 100
      });

      const scenarios: UserScenario[] = [{
        name: 'CPU Intensive',
        weight: 100,
        steps: [{
          name: 'Compute',
          action: 'compute',
          params: { complexity: 100000 }
        }]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 10,
        rampUpTime: 1000,
        sustainTime: 2000,
        rampDownTime: 1000,
        thinkTime: 100,
        performanceMonitor
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      // Should have resource utilization data
      expect(results.concurrencyMetrics.resourceUtilization.length).toBeGreaterThan(0);
      
      const utilization = results.concurrencyMetrics.resourceUtilization;
      expect(utilization[0].cpu).toBeGreaterThanOrEqual(0);
      expect(utilization[0].memory).toBeGreaterThanOrEqual(0);
      expect(utilization[0].connections).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle step failures with retries', async () => {
      let attempts = 0;
      const failServer = http.createServer((req, res) => {
        attempts++;
        if (attempts < 3) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
          res.writeHead(200);
          res.end('Success');
        }
      });

      await new Promise<void>(resolve => failServer.listen(0, resolve));
      const failPort = (failServer.address() as any).port;

      const scenarios: UserScenario[] = [{
        name: 'Retry Test',
        weight: 100,
        steps: [{
          name: 'Flaky Request',
          action: 'request',
          params: { url: `http://localhost:${failPort}/` },
          retries: 3
        }]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 5,
        rampUpTime: 500,
        sustainTime: 1000,
        rampDownTime: 500,
        thinkTime: 100
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      // Should eventually succeed with retries
      expect(results.summary.successfulUsers).toBeGreaterThan(0);
      
      // Check retry counts in step metrics
      const userWithRetries = results.userMetrics.find(m => 
        m.steps.some(s => s.retries > 0)
      );
      expect(userWithRetries).toBeDefined();

      await new Promise<void>((resolve, reject) => {
        failServer.close(err => err ? reject(err) : resolve());
      });
    });

    test('should track and report errors', async () => {
      const scenarios: UserScenario[] = [{
        name: 'Error Scenario',
        weight: 100,
        steps: [
          {
            name: 'Bad Request',
            action: 'request',
            params: { url: 'http://invalid-host-that-does-not-exist:9999/' },
            timeout: 1000
          }
        ]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 3,
        rampUpTime: 500,
        sustainTime: 1000,
        rampDownTime: 500,
        thinkTime: 0
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      expect(results.summary.failedUsers).toBeGreaterThan(0);
      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.errors[0].error).toBeDefined();
      expect(results.errors[0].scenario).toBe('Error Scenario');
    });
  });

  describe('Validation Rules', () => {
    test('should validate performance criteria', async () => {
      const scenarios: UserScenario[] = [{
        name: 'Performance Test',
        weight: 100,
        steps: [{
          name: 'Fast Request',
          action: 'request',
          params: { url: `http://localhost:${serverPort}/` }
        }],
        validations: [
          {
            metric: 'averageDuration',
            condition: 'lessThan',
            value: 5000,
            failureMessage: 'Average duration exceeds 5 seconds'
          },
          {
            metric: 'p95Duration',
            condition: 'lessThan',
            value: 10000,
            failureMessage: 'P95 duration exceeds 10 seconds'
          },
          {
            metric: 'successRate',
            condition: 'greaterThan',
            value: 95,
            failureMessage: 'Success rate below 95%'
          }
        ]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 10,
        rampUpTime: 1000,
        sustainTime: 2000,
        rampDownTime: 1000,
        thinkTime: 100
      };

      tester = new ConcurrencyTester(config);
      const results = await tester.run();

      expect(results.validationResults.length).toBe(3);
      
      // Should pass reasonable performance criteria
      const avgDurationValidation = results.validationResults.find(v => 
        v.rule.metric === 'averageDuration'
      );
      expect(avgDurationValidation?.passed).toBe(true);
      
      const successRateValidation = results.validationResults.find(v => 
        v.rule.metric === 'successRate'
      );
      expect(successRateValidation?.passed).toBe(true);
    });
  });

  describe('Event Emissions', () => {
    test('should emit lifecycle events', async () => {
      const events: string[] = [];

      const scenarios: UserScenario[] = [{
        name: 'Event Test',
        weight: 100,
        steps: [{
          name: 'Test Step',
          action: 'wait',
          params: { duration: 100 }
        }]
      }];

      const config: ConcurrencyTestConfig = {
        scenarios,
        maxConcurrentUsers: 2,
        rampUpTime: 500,
        sustainTime: 500,
        rampDownTime: 500,
        thinkTime: 0
      };

      tester = new ConcurrencyTester(config);

      tester.on('test-started', () => events.push('test-started'));
      tester.on('phase-started', (data) => events.push(`phase-started:${data.phase}`));
      tester.on('phase-completed', (data) => events.push(`phase-completed:${data.phase}`));
      tester.on('user-spawned', () => events.push('user-spawned'));
      tester.on('user-completed', () => events.push('user-completed'));
      tester.on('test-completed', () => events.push('test-completed'));

      await tester.run();

      expect(events).toContain('test-started');
      expect(events).toContain('phase-started:ramp-up');
      expect(events).toContain('phase-completed:ramp-up');
      expect(events).toContain('phase-started:sustain');
      expect(events).toContain('phase-completed:sustain');
      expect(events).toContain('phase-started:ramp-down');
      expect(events).toContain('phase-completed:ramp-down');
      expect(events).toContain('test-completed');
      expect(events.filter(e => e === 'user-spawned').length).toBeGreaterThan(0);
      expect(events.filter(e => e === 'user-completed').length).toBeGreaterThan(0);
    });
  });
});