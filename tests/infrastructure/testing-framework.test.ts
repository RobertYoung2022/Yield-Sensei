/**
 * Testing Framework Validation Test
 * Validates that the core testing infrastructure works correctly
 */

import { 
  CoreTestingInfrastructure,
  TestSuite,
} from '../../src/testing/infrastructure/core-testing-infrastructure';

import {
  UnitTestFramework,
  MockObject,
} from '../../src/testing/unit/unit-test-framework';

import {
  TestFixtures,
  CommonFixtureSets,
} from '../../src/testing/unit/test-fixtures';

import {
  createDatabaseMock,
  createRedisMock,
} from '../../src/testing/unit/mock-utilities';

describe('Testing Framework Infrastructure', () => {
  describe('Core Testing Infrastructure', () => {
    let infrastructure: CoreTestingInfrastructure;

    beforeEach(() => {
      infrastructure = new CoreTestingInfrastructure({
        timeout: 5000,
        retries: 0,
        parallel: false,
        coverage: false,
        environment: 'unit',
      });
    });

    it('should create and run a basic test suite', async () => {
      const testSuite: TestSuite = {
        name: 'Basic Test Suite',
        tests: [
          {
            name: 'should pass',
            fn: async () => {
              expect(true).toBe(true);
            },
          },
          {
            name: 'should also pass',
            fn: async () => {
              expect(1 + 1).toBe(2);
            },
          },
        ],
      };

      const results = await infrastructure.runTestSuite(testSuite);
      
      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe('passed');
      expect(results[1]?.status).toBe('passed');
    });

    it('should handle test failures correctly', async () => {
      const testSuite: TestSuite = {
        name: 'Failing Test Suite',
        tests: [
          {
            name: 'should fail',
            fn: async () => {
              throw new Error('Expected failure');
            },
          },
        ],
      };

      const results = await infrastructure.runTestSuite(testSuite);
      
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('failed');
      expect(results[0]?.error).toBeDefined();
    });

    it('should provide accurate test summary', async () => {
      const testSuite: TestSuite = {
        name: 'Mixed Results Suite',
        tests: [
          {
            name: 'should pass',
            fn: async () => {
              expect(true).toBe(true);
            },
          },
          {
            name: 'should fail',
            fn: async () => {
              throw new Error('Expected failure');
            },
          },
          {
            name: 'should skip',
            fn: async () => {
              expect(true).toBe(true);
            },
            skip: true,
          },
        ],
      };

      await infrastructure.runTestSuite(testSuite);
      const summary = infrastructure.getSummary();
      
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.successRate).toBeCloseTo(33.33, 1);
    });
  });

  describe('Unit Testing Framework', () => {
    let framework: UnitTestFramework;

    beforeEach(() => {
      framework = new UnitTestFramework({
        isolationLevel: 'complete',
        autoMock: false,
        mockExternal: false,
        coverageThreshold: 80,
      });
    });

    it('should create and manage mocks', () => {
      const mock = framework.createMock('testMock', {
        mockType: 'function',
        returnValue: 'test result',
      });

      expect(mock).toBeInstanceOf(MockObject);
      expect(framework.getMock('testMock')).toBe(mock);
    });

    it('should provide working assertions', () => {
      expect(() => {
        framework.expect(5).toBe(5);
      }).not.toThrow();

      expect(() => {
        framework.expect([1, 2, 3]).toContain(2);
      }).not.toThrow();

      expect(() => {
        framework.expect(5).toBe(10);
      }).toThrow();
    });
  });

  describe('Test Fixtures', () => {
    it('should create valid user fixtures', () => {
      const user = TestFixtures.createUser();
      
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('testuser');
      expect(user.isActive).toBe(true);
      expect(user.profile).toBeDefined();
    });

    it('should create portfolio with positions', () => {
      const portfolio = TestFixtures.createPortfolioWithPositions(3);
      
      expect(portfolio.positions).toHaveLength(3);
      expect(portfolio.totalValue).toBeGreaterThan(0);
      expect(portfolio.positions[0]?.portfolioId).toBe(portfolio.id);
    });

    it('should create market data for multiple symbols', () => {
      const symbols = ['BTC', 'ETH', 'ADA'];
      const marketData = TestFixtures.createMarketDataSet(symbols);
      
      expect(marketData).toHaveLength(3);
      expect(marketData.map(d => d.symbol)).toEqual(symbols);
    });

    it('should create common fixture sets', () => {
      const { user, portfolio } = CommonFixtureSets.basicUserWithPortfolio();
      
      expect(user.id).toBeDefined();
      expect(portfolio.userId).toBe(user.id);
      expect(portfolio.positions).toHaveLength(3);
    });
  });

  describe('Mock Utilities', () => {
    it('should create functional database mock', async () => {
      const dbMock = createDatabaseMock({
        queryResults: [{ id: 1, name: 'test' }],
      });

      await dbMock.connect();
      const results = await dbMock.query('SELECT * FROM test');
      
      expect(results).toEqual([{ id: 1, name: 'test' }]);
    });

    it('should create functional Redis mock', async () => {
      const redisMock = createRedisMock();

      await redisMock.set('testKey', 'testValue');
      const value = await redisMock.get('testKey');
      
      expect(value).toBe('testValue');
    });

    it('should handle Redis operations correctly', async () => {
      const redisMock = createRedisMock();

      // Test hash operations
      await redisMock.hset('hash1', 'field1', 'value1');
      const hashValue = await redisMock.hget('hash1', 'field1');
      expect(hashValue).toBe('value1');

      // Test list operations
      await redisMock.lpush('list1', 'item1', 'item2');
      const listLength = await redisMock.llen('list1');
      expect(listLength).toBe(2);

      // Test set operations
      await redisMock.sadd('set1', 'member1', 'member2');
      const setMembers = await redisMock.smembers('set1');
      expect(setMembers).toContain('member1');
      expect(setMembers).toContain('member2');
    });
  });
});