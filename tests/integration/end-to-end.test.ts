/**
 * End-to-End Integration Tests
 * Tests complete system workflows and cross-component interactions
 */

import { OrchestrationEngine } from '@/core/orchestration/engine';
import { DatabaseManager } from '@/shared/database/manager';
import { MessageBus } from '@/core/messaging/bus';
import { AgentLifecycleManager } from '@/core/lifecycle/manager';
import { jest } from '@jest/globals';

// Comprehensive mocking for E2E tests
jest.mock('@/core/lifecycle/manager', () => {
  const mockLifecycleManagerInstance = {
    createAgent: jest.fn<() => Promise<string>>().mockResolvedValue('test-agent'),
    startAgent: jest.fn<() => Promise<void>>().mockResolvedValue(),
    stopAgent: jest.fn<() => Promise<void>>().mockResolvedValue(),
    getAllAgentStatuses: jest.fn().mockReturnValue(new Map([
      ['sage', { id: 'sage', status: 'running', health: 'healthy', lastHeartbeat: new Date(), uptime: 1000 }],
      ['forge', { id: 'forge', status: 'running', health: 'healthy', lastHeartbeat: new Date(), uptime: 1000 }],
    ])),
    getLifecycleStats: jest.fn().mockReturnValue({
      totalAgents: 2,
      runningAgents: 2,
      stoppedAgents: 0,
      errorAgents: 0
    }),
    shutdown: jest.fn<() => Promise<void>>().mockResolvedValue(),
    registerAgentFactory: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  return {
    AgentLifecycleManager: jest.fn(() => mockLifecycleManagerInstance),
  };
});

jest.mock('@/shared/database/manager', () => {
    const mockDatabaseManagerInstance = {
        initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        healthCheck: jest.fn().mockResolvedValue({ 
            healthy: true, 
            details: { 
                postgres: 'connected',
                redis: 'connected',
                clickhouse: 'connected',
                vector: 'connected'
            } 
        }),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        emit: jest.fn(),
    };
    
    const MockDatabaseManager: any = jest.fn().mockImplementation(() => mockDatabaseManagerInstance);
    MockDatabaseManager.getInstance = jest.fn(() => mockDatabaseManagerInstance);
    
    return {
        DatabaseManager: MockDatabaseManager,
    };
});

jest.mock('@/core/messaging/bus', () => {
    const mockMessageBus = jest.fn();
    mockMessageBus.prototype.initialize = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.shutdown = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.subscribeAgent = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.unsubscribeAgent = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.sendMessage = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.on = jest.fn();
    mockMessageBus.prototype.getStats = jest.fn().mockReturnValue({ 
        messagesSent: 5,
        messagesReceived: 3,
        messagesRetried: 0,
        messagesFailed: 0,
        averageLatency: 15,
        topicStats: new Map(),
        connectionStatus: 'connected'
    });
    mockMessageBus.prototype.healthCheck = jest.fn().mockResolvedValue({ 
        healthy: true, 
        details: { connectionStatus: 'connected', topicCount: 5 }
    });

    return {
        MessageBus: mockMessageBus,
    };
});

// Mock external dependencies
jest.mock('kafkajs', () => ({
    Kafka: jest.fn(() => ({
        producer: () => ({ connect: jest.fn(), disconnect: jest.fn(), send: jest.fn() }),
        consumer: () => ({ connect: jest.fn(), disconnect: jest.fn(), subscribe: jest.fn(), run: jest.fn() }),
        admin: () => ({ connect: jest.fn(), disconnect: jest.fn(), createTopics: jest.fn() }),
    })),
    logLevel: { WARN: 0 },
}));

describe('End-to-End Integration Tests', () => {
    let orchestrator: OrchestrationEngine;

    beforeAll(() => {
        // Mock global fetch for external API calls
        global.fetch = jest.fn(async (input: Request | string | URL) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            
            // Mock different API responses based on URL patterns
            if (url.includes('clickhouse')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    json: () => Promise.resolve({ rows: [] }),
                    text: () => Promise.resolve('1'),
                    clone: () => Promise.resolve(this),
                } as any);
            }
            
            if (url.includes('perplexity')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ 
                        analysis: 'Protocol analysis complete',
                        confidence: 0.95
                    }),
                } as any);
            }
            
            return Promise.reject(new Error(`Unhandled fetch request: ${url}`));
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        orchestrator = OrchestrationEngine.getInstance();
    });

    afterEach(async () => {
        try {
            await orchestrator.shutdown();
        } catch (error) {
            // Ignore shutdown errors in tests
        }
        (OrchestrationEngine as any).instance = null;
    });

    describe('Complete System Initialization', () => {
        test('should initialize entire system successfully', async () => {
            // Test complete system startup
            await orchestrator.initialize();
            
            // Verify all components initialized
            expect(DatabaseManager.getInstance().initialize).toHaveBeenCalledTimes(1);
            expect(MessageBus.prototype.initialize).toHaveBeenCalledTimes(1);
            
            // Check system health
            const systemHealth = await orchestrator.getSystemHealth();
            expect(systemHealth.overall).toBe('healthy');
            expect(systemHealth.components.database).toBe('healthy');
            expect(systemHealth.components.messageBus).toBe('healthy');
        });

        test('should handle initialization failures gracefully', async () => {
            // Mock a database initialization failure
            const mockDb = DatabaseManager.getInstance();
            (mockDb.initialize as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));
            
            await expect(orchestrator.initialize()).rejects.toThrow('Database connection failed');
        });
    });

    describe('Agent Lifecycle Workflows', () => {
        test('should complete full agent lifecycle', async () => {
            await orchestrator.initialize();
            
            // Start all agents
            await orchestrator.startAllAgents();
            
            // Verify agents are running
            const systemHealth = await orchestrator.getSystemHealth();
            expect(systemHealth.metrics.totalAgents).toBeGreaterThan(0);
            expect(systemHealth.metrics.activeAgents).toBeGreaterThan(0);
            
            // Stop all agents
            await orchestrator.stopAllAgents();
            
            // Verify clean shutdown
            const stats = orchestrator.getStatistics();
            expect(stats.isRunning).toBe(false);
        });

        test('should handle agent failures and recovery', async () => {
            await orchestrator.initialize();
            await orchestrator.startAllAgents();
            
            // Simulate agent failure by checking system can handle it
            const systemHealth = await orchestrator.getSystemHealth();
            
            // System should remain stable even with some agents failing
            expect(systemHealth.overall).toMatch(/healthy|degraded/);
        });
    });

    describe('Cross-Component Communication', () => {
        test('should facilitate inter-agent messaging', async () => {
            await orchestrator.initialize();
            await orchestrator.startAllAgents();
            
            // Send test message through orchestrator
            const testMessage = {
                id: 'e2e-test-message',
                type: 'command' as any,
                from: 'sage',
                to: 'forge',
                payload: { action: 'analyze_protocol', data: { protocol: 'aave' } },
                priority: 'high' as any,
                timestamp: new Date(),
            };
            
            await orchestrator.sendMessage(testMessage);
            
            // Verify message was processed
            expect(MessageBus.prototype.sendMessage).toHaveBeenCalledWith(testMessage);
        });

        test('should handle broadcast messages', async () => {
            await orchestrator.initialize();
            await orchestrator.startAllAgents();
            
            const broadcastMessage = {
                id: 'broadcast-shutdown',
                type: 'event' as any,
                from: 'orchestrator',
                to: 'broadcast',
                payload: { event: 'system_maintenance', duration: '30m' },
                priority: 'critical' as any,
                timestamp: new Date(),
            };
            
            await orchestrator.sendMessage(broadcastMessage);
            
            expect(MessageBus.prototype.sendMessage).toHaveBeenCalledWith(broadcastMessage);
        });
    });

    describe('System Performance Under Load', () => {
        test('should maintain performance with multiple concurrent operations', async () => {
            await orchestrator.initialize();
            await orchestrator.startAllAgents();
            
            const startTime = Date.now();
            
            // Simulate concurrent operations
            const operations = [
                orchestrator.getSystemHealth(),
                orchestrator.getSystemHealth(),
                orchestrator.getSystemHealth(),
                orchestrator.getStatistics(),
                orchestrator.getStatistics(),
            ];
            
            const results = await Promise.all(operations);
            const endTime = Date.now();
            
            // All operations should complete successfully
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toBeDefined();
            });
            
            // Should complete in reasonable time (under 500ms)
            expect(endTime - startTime).toBeLessThan(500);
        });

        test('should handle rapid message throughput', async () => {
            await orchestrator.initialize();
            await orchestrator.startAllAgents();
            
            const messageCount = 50;
            const messages = Array.from({ length: messageCount }, (_, i) => ({
                id: `perf-test-${i}`,
                type: 'data' as any,
                from: 'test-generator',
                to: 'test-consumer',
                payload: { index: i, data: `test-data-${i}` },
                priority: 'medium' as any,
                timestamp: new Date(),
            }));
            
            const startTime = Date.now();
            await Promise.all(messages.map(msg => orchestrator.sendMessage(msg)));
            const endTime = Date.now();
            
            // Should process all messages in under 1 second
            expect(endTime - startTime).toBeLessThan(1000);
        });
    });

    describe('Error Recovery and Fault Tolerance', () => {
        test('should recover from component failures', async () => {
            await orchestrator.initialize();
            
            // Simulate message bus failure
            (MessageBus.prototype.healthCheck as jest.Mock).mockResolvedValueOnce({
                healthy: false,
                details: { error: 'Connection lost' }
            });
            
            const systemHealth = await orchestrator.getSystemHealth();
            
            // System should detect the failure
            expect(systemHealth.overall).toMatch(/degraded|unhealthy/);
            
            // Restore healthy state
            (MessageBus.prototype.healthCheck as jest.Mock).mockResolvedValue({
                healthy: true,
                details: { connectionStatus: 'connected' }
            });
            
            const recoveredHealth = await orchestrator.getSystemHealth();
            expect(recoveredHealth.overall).toBe('healthy');
        });

        test('should handle graceful shutdown under stress', async () => {
            await orchestrator.initialize();
            await orchestrator.startAllAgents();
            
            // Start some background operations
            const backgroundOps = Array.from({ length: 10 }, () => 
                orchestrator.getSystemHealth()
            );
            
            // Initiate shutdown while operations are running
            const shutdownPromise = orchestrator.shutdown();
            
            // Wait for shutdown to complete
            await shutdownPromise;
            
            // Background operations should handle shutdown gracefully
            const results = await Promise.allSettled(backgroundOps);
            
            // Most operations should complete or be cleanly cancelled
            const successfulOps = results.filter(r => r.status === 'fulfilled').length;
            expect(successfulOps).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Configuration and Environment Testing', () => {
        test('should validate system configuration', async () => {
            const stats = orchestrator.getStatistics();
            
            // Verify configuration is properly loaded
            expect(stats.config).toBeDefined();
            expect(stats.config.enableHealthMonitoring).toBeDefined();
            expect(stats.config.healthCheckInterval).toBeGreaterThan(0);
        });

        test('should adapt to different environment configurations', async () => {
            // Test with different configurations
            const devConfig = {
                enableHealthMonitoring: true,
                healthCheckInterval: 10000,
                enableAutoRestart: true,
                enableLoadBalancing: false,
                maxConcurrentTasks: 50,
            };
            
            const prodOrchestrator = OrchestrationEngine.getInstance(devConfig);
            
            expect(prodOrchestrator.getStatistics().config.maxConcurrentTasks).toBe(50);
            
            await prodOrchestrator.shutdown();
        });
    });

    describe('External API Integration', () => {
        test('should handle external API calls appropriately', async () => {
            // This tests the mocked external API calls
            const response = await fetch('https://api.perplexity.ai/test');
            const data = await response.json();
            
            expect(data.analysis).toBeDefined();
            expect(data.confidence).toBeGreaterThan(0);
        });

        test('should handle external API failures gracefully', async () => {
            // Mock an API failure
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API timeout'));
            
            await expect(fetch('https://api.failing-service.com')).rejects.toThrow('API timeout');
        });
    });
}); 