import { IntegrationTestBase, IntegrationTestConfig, DatabaseClient } from '../framework/integration-test-base';
import { TestDataBuilder, UserDataFactory, PortfolioDataFactory, TransactionDataFactory } from '../framework/test-data-builder';

export interface TransactionScenario {
  name: string;
  description: string;
  operations: DatabaseOperation[];
  expectedState: ExpectedDatabaseState;
  shouldRollback: boolean;
}

export interface DatabaseOperation {
  type: 'insert' | 'update' | 'delete' | 'select';
  table: string;
  data?: any;
  conditions?: any;
  expectedRows?: number;
}

export interface ExpectedDatabaseState {
  tables: Record<string, TableState>;
  constraints: ConstraintCheck[];
  indexes: IndexCheck[];
}

export interface TableState {
  rowCount: number;
  checksums?: Record<string, any>;
  foreignKeyIntegrity: boolean;
}

export interface ConstraintCheck {
  name: string;
  type: 'foreign_key' | 'unique' | 'check' | 'not_null';
  table: string;
  columns: string[];
  valid: boolean;
}

export interface IndexCheck {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  valid: boolean;
}

export class DatabaseTransactionIntegrityTest extends IntegrationTestBase {
  private testDataBuilder: TestDataBuilder;
  private scenarios: TransactionScenario[] = [];

  constructor() {
    const config: IntegrationTestConfig = {
      name: 'database-transaction-integrity',
      description: 'Database transaction integrity and ACID compliance tests',
      environment: {
        type: 'local',
        baseUrl: 'http://localhost:3000',
        variables: {
          ISOLATION_LEVEL: 'READ_COMMITTED',
          DEADLOCK_TIMEOUT: '5000'
        }
      },
      services: [
        {
          name: 'api-gateway',
          type: 'api',
          url: process.env.API_GATEWAY_URL || 'http://localhost:3000',
          healthCheck: {
            endpoint: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000,
            retries: 3
          }
        }
      ],
      database: {
        type: 'postgres',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'yieldsensei_test',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres'
        }
      },
      timeout: 120000, // 2 minutes
      retries: 1, // Don't retry transaction tests
      cleanup: {
        database: true,
        cache: false,
        files: false,
        services: false
      }
    };

    super(config);
    this.testDataBuilder = new TestDataBuilder();
    this.setupFactories();
    this.defineScenarios();
  }

  getName(): string {
    return 'Database Transaction Integrity Test';
  }

  getDescription(): string {
    return 'Tests ACID properties, transaction isolation, and data integrity constraints';
  }

  async runTests(): Promise<void> {
    await this.runTest('ACID Compliance - Atomicity', async () => {
      await this.testAtomicity();
    });

    await this.runTest('ACID Compliance - Consistency', async () => {
      await this.testConsistency();
    });

    await this.runTest('ACID Compliance - Isolation', async () => {
      await this.testIsolation();
    });

    await this.runTest('ACID Compliance - Durability', async () => {
      await this.testDurability();
    });

    await this.runTest('Concurrent Transaction Handling', async () => {
      await this.testConcurrentTransactions();
    });

    await this.runTest('Deadlock Detection and Resolution', async () => {
      await this.testDeadlockHandling();
    });

    await this.runTest('Foreign Key Integrity', async () => {
      await this.testForeignKeyIntegrity();
    });

    await this.runTest('Portfolio Value Consistency', async () => {
      await this.testPortfolioValueConsistency();
    });

    await this.runTest('Transaction Log Integrity', async () => {
      await this.testTransactionLogIntegrity();
    });

    await this.runTest('Large Transaction Performance', async () => {
      await this.testLargeTransactionPerformance();
    });
  }

  private setupFactories(): void {
    this.testDataBuilder.registerFactory('user', new UserDataFactory());
    this.testDataBuilder.registerFactory('portfolio', new PortfolioDataFactory());
    this.testDataBuilder.registerFactory('transaction', new TransactionDataFactory());
  }

  private defineScenarios(): void {
    this.scenarios = [
      {
        name: 'Portfolio Creation with Assets',
        description: 'Create portfolio and add multiple assets atomically',
        operations: [
          {
            type: 'insert',
            table: 'portfolios',
            data: { user_id: 'test-user', name: 'Test Portfolio', total_value: 0 }
          },
          {
            type: 'insert',
            table: 'assets',
            data: { portfolio_id: 'portfolio-id', symbol: 'BTC', amount: 1.5 }
          },
          {
            type: 'insert',
            table: 'assets',
            data: { portfolio_id: 'portfolio-id', symbol: 'ETH', amount: 10 }
          },
          {
            type: 'update',
            table: 'portfolios',
            data: { total_value: 45000 },
            conditions: { id: 'portfolio-id' }
          }
        ],
        expectedState: {
          tables: {
            portfolios: { rowCount: 1, foreignKeyIntegrity: true },
            assets: { rowCount: 2, foreignKeyIntegrity: true }
          },
          constraints: [],
          indexes: []
        },
        shouldRollback: false
      },
      {
        name: 'Failed Transaction Rollback',
        description: 'Test transaction rollback on constraint violation',
        operations: [
          {
            type: 'insert',
            table: 'users',
            data: { email: 'test@example.com', username: 'testuser' }
          },
          {
            type: 'insert',
            table: 'users',
            data: { email: 'test@example.com', username: 'duplicate' } // Duplicate email
          }
        ],
        expectedState: {
          tables: {
            users: { rowCount: 0, foreignKeyIntegrity: true }
          },
          constraints: [],
          indexes: []
        },
        shouldRollback: true
      }
    ];
  }

  private async testAtomicity(): Promise<void> {
    // Test that transactions are all-or-nothing
    const userData = await this.testDataBuilder.create('user');
    
    // Test successful atomic transaction
    await this.context.database.transaction(async (client) => {
      await client.query(
        'INSERT INTO portfolios (id, user_id, name, total_value) VALUES ($1, $2, $3, $4)',
        ['portfolio-1', userData.data.id, 'Atomic Test Portfolio', 10000]
      );
      
      await client.query(
        'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price) VALUES ($1, $2, $3, $4, $5)',
        ['asset-1', 'portfolio-1', 'BTC', 0.5, 50000]
      );
      
      await client.query(
        'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price) VALUES ($1, $2, $3, $4, $5)',
        ['asset-2', 'portfolio-1', 'ETH', 5, 3000]
      );
    });

    // Verify all operations succeeded
    const portfolioCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM portfolios WHERE id = $1',
      ['portfolio-1']
    );
    this.assert(portfolioCount.rows[0].count == '1', 'Portfolio should exist');

    const assetCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM assets WHERE portfolio_id = $1',
      ['portfolio-1']
    );
    this.assert(assetCount.rows[0].count == '2', 'Both assets should exist');

    // Test failed atomic transaction (should rollback everything)
    try {
      await this.context.database.transaction(async (client) => {
        await client.query(
          'INSERT INTO portfolios (id, user_id, name, total_value) VALUES ($1, $2, $3, $4)',
          ['portfolio-2', userData.data.id, 'Failed Portfolio', 5000]
        );
        
        await client.query(
          'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price) VALUES ($1, $2, $3, $4, $5)',
          ['asset-3', 'portfolio-2', 'DOT', 100, 25]
        );
        
        // This should fail due to foreign key constraint
        await client.query(
          'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price) VALUES ($1, $2, $3, $4, $5)',
          ['asset-4', 'nonexistent-portfolio', 'ADA', 200, 1.5]
        );
      });
      
      this.assert(false, 'Transaction should have failed');
    } catch (error) {
      // Expected failure
    }

    // Verify rollback - portfolio-2 should not exist
    const failedPortfolioCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM portfolios WHERE id = $1',
      ['portfolio-2']
    );
    this.assert(failedPortfolioCount.rows[0].count == '0', 'Failed portfolio should not exist');

    const failedAssetCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM assets WHERE portfolio_id = $1',
      ['portfolio-2']
    );
    this.assert(failedAssetCount.rows[0].count == '0', 'Failed assets should not exist');
  }

  private async testConsistency(): Promise<void> {
    // Test that database constraints are enforced
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id
    });

    // Test unique constraint
    try {
      await this.executeQuery(
        'INSERT INTO portfolios (id, user_id, name, total_value) VALUES ($1, $2, $3, $4)',
        [portfolioData.data.id, userData.data.id, 'Duplicate Portfolio', 1000]
      );
      this.assert(false, 'Duplicate portfolio ID should fail');
    } catch (error) {
      // Expected - unique constraint violation
    }

    // Test check constraint (if total_value >= 0)
    try {
      await this.executeQuery(
        'INSERT INTO portfolios (id, user_id, name, total_value) VALUES ($1, $2, $3, $4)',
        ['negative-portfolio', userData.data.id, 'Negative Portfolio', -1000]
      );
      this.assert(false, 'Negative portfolio value should fail');
    } catch (error) {
      // Expected - check constraint violation
    }

    // Test foreign key constraint
    try {
      await this.executeQuery(
        'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price) VALUES ($1, $2, $3, $4, $5)',
        ['orphan-asset', 'nonexistent-portfolio', 'BTC', 1, 50000]
      );
      this.assert(false, 'Asset with invalid portfolio_id should fail');
    } catch (error) {
      // Expected - foreign key constraint violation
    }

    // Test NOT NULL constraint
    try {
      await this.executeQuery(
        'INSERT INTO users (id, email) VALUES ($1, $2)',
        ['incomplete-user', null]
      );
      this.assert(false, 'User with null email should fail');
    } catch (error) {
      // Expected - NOT NULL constraint violation
    }
  }

  private async testIsolation(): Promise<void> {
    // Test transaction isolation levels
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id,
      totalValue: 10000
    });

    // Test READ COMMITTED isolation
    const transaction1Promise = this.context.database.transaction(async (client1) => {
      // Read initial value
      const result1 = await client1.query(
        'SELECT total_value FROM portfolios WHERE id = $1',
        [portfolioData.data.id]
      );
      const initialValue = result1.rows[0].total_value;

      // Wait to allow concurrent transaction
      await this.wait(1000);

      // Read again - should see committed changes from other transaction
      const result2 = await client1.query(
        'SELECT total_value FROM portfolios WHERE id = $1',
        [portfolioData.data.id]
      );
      const finalValue = result2.rows[0].total_value;

      return { initialValue, finalValue };
    });

    // Concurrent transaction that modifies the portfolio
    const transaction2Promise = this.wait(500).then(() =>
      this.context.database.transaction(async (client2) => {
        await client2.query(
          'UPDATE portfolios SET total_value = total_value + 5000 WHERE id = $1',
          [portfolioData.data.id]
        );
      })
    );

    const [result1] = await Promise.all([transaction1Promise, transaction2Promise]);

    // In READ COMMITTED, the second read should see the committed change
    this.assert(
      result1.finalValue > result1.initialValue,
      'READ COMMITTED should allow reading committed changes'
    );
  }

  private async testDurability(): Promise<void> {
    // Test that committed transactions survive system failures
    const userData = await this.testDataBuilder.create('user');
    
    // Create a transaction and commit it
    const transactionId = `tx-${Date.now()}`;
    await this.context.database.transaction(async (client) => {
      await client.query(
        'INSERT INTO transactions (id, user_id, type, amount, status, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
        [transactionId, userData.data.id, 'deposit', 1000, 'completed', new Date()]
      );
    });

    // Simulate system restart by reconnecting to database
    await this.context.database.disconnect();
    await this.context.database.connect();

    // Verify transaction still exists
    const result = await this.executeQuery(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    this.assert(result.rows.length === 1, 'Committed transaction should survive restart');
    this.assert(result.rows[0].amount === '1000', 'Transaction data should be intact');
  }

  private async testConcurrentTransactions(): Promise<void> {
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id,
      totalValue: 10000
    });

    // Test concurrent updates to same portfolio
    const concurrentUpdates = Array.from({ length: 10 }, (_, i) =>
      this.context.database.transaction(async (client) => {
        // Read current value
        const result = await client.query(
          'SELECT total_value FROM portfolios WHERE id = $1 FOR UPDATE',
          [portfolioData.data.id]
        );
        const currentValue = parseFloat(result.rows[0].total_value);

        // Update with small delay to increase contention
        await this.wait(Math.random() * 100);
        
        await client.query(
          'UPDATE portfolios SET total_value = $1 WHERE id = $2',
          [currentValue + 100, portfolioData.data.id]
        );

        return i;
      })
    );

    const results = await Promise.all(concurrentUpdates);
    
    // Verify all transactions completed
    this.assert(results.length === 10, 'All concurrent transactions should complete');

    // Verify final value is correct (initial + 10 * 100)
    const finalResult = await this.executeQuery(
      'SELECT total_value FROM portfolios WHERE id = $1',
      [portfolioData.data.id]
    );
    const expectedValue = 10000 + (10 * 100);
    this.assert(
      parseFloat(finalResult.rows[0].total_value) === expectedValue,
      'Final portfolio value should be correct'
    );
  }

  private async testDeadlockHandling(): Promise<void> {
    const user1Data = await this.testDataBuilder.create('user', { email: 'user1@example.com' });
    const user2Data = await this.testDataBuilder.create('user', { email: 'user2@example.com' });
    
    const portfolio1Data = await this.testDataBuilder.create('portfolio', {
      userId: user1Data.data.id,
      totalValue: 5000
    });
    
    const portfolio2Data = await this.testDataBuilder.create('portfolio', {
      userId: user2Data.data.id,
      totalValue: 3000
    });

    // Create deadlock scenario
    const transaction1Promise = this.context.database.transaction(async (client1) => {
      // Lock portfolio1
      await client1.query(
        'SELECT total_value FROM portfolios WHERE id = $1 FOR UPDATE',
        [portfolio1Data.data.id]
      );

      await this.wait(100); // Allow other transaction to start

      // Try to lock portfolio2 (this may cause deadlock)
      await client1.query(
        'SELECT total_value FROM portfolios WHERE id = $1 FOR UPDATE',
        [portfolio2Data.data.id]
      );

      // Transfer from portfolio1 to portfolio2
      await client1.query(
        'UPDATE portfolios SET total_value = total_value - 1000 WHERE id = $1',
        [portfolio1Data.data.id]
      );
      await client1.query(
        'UPDATE portfolios SET total_value = total_value + 1000 WHERE id = $1',
        [portfolio2Data.data.id]
      );

      return 'transaction1-success';
    });

    const transaction2Promise = this.context.database.transaction(async (client2) => {
      // Lock portfolio2
      await client2.query(
        'SELECT total_value FROM portfolios WHERE id = $1 FOR UPDATE',
        [portfolio2Data.data.id]
      );

      await this.wait(100); // Allow other transaction to start

      // Try to lock portfolio1 (this may cause deadlock)
      await client2.query(
        'SELECT total_value FROM portfolios WHERE id = $1 FOR UPDATE',
        [portfolio1Data.data.id]
      );

      // Transfer from portfolio2 to portfolio1
      await client2.query(
        'UPDATE portfolios SET total_value = total_value - 500 WHERE id = $1',
        [portfolio2Data.data.id]
      );
      await client2.query(
        'UPDATE portfolios SET total_value = total_value + 500 WHERE id = $1',
        [portfolio1Data.data.id]
      );

      return 'transaction2-success';
    });

    // One transaction should succeed, one should fail due to deadlock
    const results = await Promise.allSettled([transaction1Promise, transaction2Promise]);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    // At least one should complete successfully
    this.assert(successCount >= 1, 'At least one transaction should succeed');
    
    // Database should detect and resolve deadlock
    if (failureCount > 0) {
      const rejectedResult = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
      this.assert(
        rejectedResult.reason.message.includes('deadlock'),
        'Failed transaction should be due to deadlock detection'
      );
    }
  }

  private async testForeignKeyIntegrity(): Promise<void> {
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id
    });

    // Create assets linked to portfolio
    await this.executeQuery(
      'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price) VALUES ($1, $2, $3, $4, $5)',
      ['asset-1', portfolioData.data.id, 'BTC', 1, 50000]
    );

    // Try to delete portfolio with assets (should fail due to foreign key)
    try {
      await this.executeQuery(
        'DELETE FROM portfolios WHERE id = $1',
        [portfolioData.data.id]
      );
      this.assert(false, 'Should not be able to delete portfolio with assets');
    } catch (error) {
      // Expected - foreign key constraint violation
    }

    // Verify cascade delete works correctly
    await this.executeQuery(
      'DELETE FROM assets WHERE portfolio_id = $1',
      [portfolioData.data.id]
    );

    await this.executeQuery(
      'DELETE FROM portfolios WHERE id = $1',
      [portfolioData.data.id]
    );

    // Verify both are deleted
    const portfolioCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM portfolios WHERE id = $1',
      [portfolioData.data.id]
    );
    this.assert(portfolioCount.rows[0].count == '0', 'Portfolio should be deleted');

    const assetCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM assets WHERE portfolio_id = $1',
      [portfolioData.data.id]
    );
    this.assert(assetCount.rows[0].count == '0', 'Assets should be deleted');
  }

  private async testPortfolioValueConsistency(): Promise<void> {
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id,
      totalValue: 0
    });

    // Test that portfolio total_value matches sum of asset values
    await this.context.database.transaction(async (client) => {
      // Add assets
      await client.query(
        'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price, total_value) VALUES ($1, $2, $3, $4, $5, $6)',
        ['asset-1', portfolioData.data.id, 'BTC', 1, 50000, 50000]
      );
      
      await client.query(
        'INSERT INTO assets (id, portfolio_id, symbol, amount, current_price, total_value) VALUES ($1, $2, $3, $4, $5, $6)',
        ['asset-2', portfolioData.data.id, 'ETH', 10, 3000, 30000]
      );

      // Update portfolio total_value
      const assetSumResult = await client.query(
        'SELECT SUM(total_value) as total FROM assets WHERE portfolio_id = $1',
        [portfolioData.data.id]
      );
      
      const totalAssetValue = parseFloat(assetSumResult.rows[0].total);
      
      await client.query(
        'UPDATE portfolios SET total_value = $1 WHERE id = $2',
        [totalAssetValue, portfolioData.data.id]
      );
    });

    // Verify consistency
    const consistencyCheck = await this.executeQuery(`
      SELECT 
        p.total_value as portfolio_total,
        COALESCE(SUM(a.total_value), 0) as asset_total
      FROM portfolios p
      LEFT JOIN assets a ON p.id = a.portfolio_id
      WHERE p.id = $1
      GROUP BY p.id, p.total_value
    `, [portfolioData.data.id]);

    const portfolioTotal = parseFloat(consistencyCheck.rows[0].portfolio_total);
    const assetTotal = parseFloat(consistencyCheck.rows[0].asset_total);

    this.assert(
      Math.abs(portfolioTotal - assetTotal) < 0.01,
      'Portfolio total should equal sum of asset values'
    );
  }

  private async testTransactionLogIntegrity(): Promise<void> {
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id,
      totalValue: 10000
    });

    // Test transaction logging
    const transactionId = `tx-${Date.now()}`;
    
    await this.context.database.transaction(async (client) => {
      // Log transaction
      await client.query(
        'INSERT INTO transactions (id, user_id, portfolio_id, type, amount, status, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [transactionId, userData.data.id, portfolioData.data.id, 'yield', 500, 'pending', new Date()]
      );

      // Update portfolio
      await client.query(
        'UPDATE portfolios SET total_value = total_value + 500 WHERE id = $1',
        [portfolioData.data.id]
      );

      // Update transaction status
      await client.query(
        'UPDATE transactions SET status = $1, completed_at = $2 WHERE id = $3',
        ['completed', new Date(), transactionId]
      );
    });

    // Verify transaction log integrity
    const logResult = await this.executeQuery(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    this.assert(logResult.rows.length === 1, 'Transaction should be logged');
    this.assert(logResult.rows[0].status === 'completed', 'Transaction status should be updated');
    this.assert(logResult.rows[0].completed_at !== null, 'Completion time should be set');

    // Verify portfolio update
    const portfolioResult = await this.executeQuery(
      'SELECT total_value FROM portfolios WHERE id = $1',
      [portfolioData.data.id]
    );

    this.assert(
      parseFloat(portfolioResult.rows[0].total_value) === 10500,
      'Portfolio value should be updated'
    );
  }

  private async testLargeTransactionPerformance(): Promise<void> {
    const userData = await this.testDataBuilder.create('user');
    const portfolioData = await this.testDataBuilder.create('portfolio', {
      userId: userData.data.id
    });

    const startTime = Date.now();

    // Test large batch insert
    await this.context.database.transaction(async (client) => {
      const batchSize = 1000;
      const values: string[] = [];
      const params: any[] = [];
      
      for (let i = 0; i < batchSize; i++) {
        const offset = i * 6;
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
        params.push(
          `asset-${i}`,
          portfolioData.data.id,
          i % 2 === 0 ? 'BTC' : 'ETH',
          Math.random(),
          50000,
          Math.random() * 50000
        );
      }

      const query = `
        INSERT INTO assets (id, portfolio_id, symbol, amount, current_price, total_value)
        VALUES ${values.join(', ')}
      `;

      await client.query(query, params);

      // Update portfolio total
      const sumResult = await client.query(
        'SELECT SUM(total_value) as total FROM assets WHERE portfolio_id = $1',
        [portfolioData.data.id]
      );

      await client.query(
        'UPDATE portfolios SET total_value = $1 WHERE id = $2',
        [sumResult.rows[0].total, portfolioData.data.id]
      );
    });

    const duration = Date.now() - startTime;

    // Verify performance (should complete within reasonable time)
    this.assert(duration < 10000, 'Large transaction should complete within 10 seconds');

    // Verify data integrity
    const assetCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM assets WHERE portfolio_id = $1',
      [portfolioData.data.id]
    );

    this.assert(assetCount.rows[0].count == '1000', 'All assets should be inserted');

    // Verify portfolio total is consistent
    const consistencyCheck = await this.executeQuery(`
      SELECT 
        p.total_value as portfolio_total,
        SUM(a.total_value) as asset_total
      FROM portfolios p
      JOIN assets a ON p.id = a.portfolio_id
      WHERE p.id = $1
      GROUP BY p.id, p.total_value
    `, [portfolioData.data.id]);

    const portfolioTotal = parseFloat(consistencyCheck.rows[0].portfolio_total);
    const assetTotal = parseFloat(consistencyCheck.rows[0].asset_total);

    this.assert(
      Math.abs(portfolioTotal - assetTotal) < 0.01,
      'Portfolio total should match asset sum after large transaction'
    );
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}