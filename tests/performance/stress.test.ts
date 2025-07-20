/**
 * Performance and Stress Testing Suite
 * Tests system performance, scalability, and resource utilization under load
 */

import { OrchestrationEngine } from '@/core/orchestration/engine';
import { performance } from 'perf_hooks';
import { jest } from '@jest/globals';

// Performance testing configuration
const PERFORMANCE_CONFIG = {
    LOAD_TEST_DURATION: 30000, // 30 seconds
    STRESS_TEST_DURATION: 60000, // 1 minute
    CONCURRENT_OPERATIONS: [1, 5, 10, 25, 50, 100],
    MESSAGE_VOLUMES: [10, 50, 100, 500, 1000],
    LATENCY_THRESHOLDS: {
        EXCELLENT: 10, // < 10ms
        GOOD: 50,      // < 50ms
        ACCEPTABLE: 100, // < 100ms
        POOR: 500,     // < 500ms
    },
    MEMORY_THRESHOLD_MB: 512,
    CPU_THRESHOLD_PERCENT: 80,
};

// Mock all dependencies for consistent performance testing
jest.mock('@/core/lifecycle/manager', () => {
    const mockInstance = {
        createAgent: jest.fn(() => Promise.resolve('agent-' + Date.now())),
        startAgent: jest.fn(() => Promise.resolve()),
        stopAgent: jest.fn(() => Promise.resolve()),
        getAllAgentStatuses: jest.fn(() => new Map()),
        getLifecycleStats: jest.fn(() => ({
            totalAgents: 8,
            runningAgents: 8,
            stoppedAgents: 0,
            errorAgents: 0
        })),
        shutdown: jest.fn(() => Promise.resolve()),
        registerAgentFactory: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
    };
    return { AgentLifecycleManager: jest.fn(() => mockInstance) };
});

jest.mock('@/shared/database/manager', () => {
    const mockInstance = {
        initialize: jest.fn(() => Promise.resolve()),
        disconnect: jest.fn(() => Promise.resolve()),
        healthCheck: jest.fn(() => Promise.resolve({ 
            healthy: true, 
            details: { postgres: 'connected', redis: 'connected' }
        })),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
    };
    const MockClass: any = jest.fn(() => mockInstance);
    MockClass.getInstance = jest.fn(() => mockInstance);
    return { DatabaseManager: MockClass };
});

jest.mock('@/core/messaging/bus', () => {
    const mockMessageBus = jest.fn();
    mockMessageBus.prototype.initialize = jest.fn(() => Promise.resolve());
    mockMessageBus.prototype.shutdown = jest.fn(() => Promise.resolve());
    mockMessageBus.prototype.sendMessage = jest.fn(() => Promise.resolve());
    mockMessageBus.prototype.subscribeAgent = jest.fn(() => Promise.resolve());
    mockMessageBus.prototype.unsubscribeAgent = jest.fn(() => Promise.resolve());
    mockMessageBus.prototype.healthCheck = jest.fn(() => Promise.resolve({ 
        healthy: true, 
        details: { connectionStatus: 'connected' }
    }));
    mockMessageBus.prototype.getStats = jest.fn(() => ({
        messagesSent: 0,
        messagesReceived: 0,
        messagesFailed: 0,
        averageLatency: 5,
        connectionStatus: 'connected'
    }));
    return { MessageBus: mockMessageBus };
});

// Performance measurement utilities
interface PerformanceMetrics {
    duration: number;
    throughput: number;
    averageLatency: number;
    maxLatency: number;
    minLatency: number;
    errorRate: number;
    memoryUsage?: number;
    cpuUsage?: number;
}

class PerformanceMeter {
    private startTime: number = 0;
    private endTime: number = 0;
    private latencies: number[] = [];
    private errors: number = 0;
    private operations: number = 0;

    start(): void {
        this.startTime = performance.now();
        this.latencies = [];
        this.errors = 0;
        this.operations = 0;
    }

    recordOperation(latency: number, isError: boolean = false): void {
        this.latencies.push(latency);
        this.operations++;
        if (isError) this.errors++;
    }

    stop(): PerformanceMetrics {
        this.endTime = performance.now();
        const duration = this.endTime - this.startTime;
        
        return {
            duration,
            throughput: (this.operations / duration) * 1000, // operations per second
            averageLatency: this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length || 0,
            maxLatency: Math.max(...this.latencies, 0),
            minLatency: Math.min(...this.latencies, Infinity) || 0,
            errorRate: (this.errors / this.operations) * 100 || 0,
        };
    }
}

async function measureMemoryUsage(): Promise<number> {
    // In Node.js environment, we can use process.memoryUsage()
    if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        return usage.heapUsed / 1024 / 1024; // Convert to MB
    }
    return 0;
}

describe('Performance and Stress Testing', () => {
    let orchestrator: OrchestrationEngine;
    let performanceMeter: PerformanceMeter;

    beforeAll(() => {
        // Set up performance testing environment
        if (typeof global !== 'undefined') {
            global.fetch = jest.fn(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
            } as any));
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        performanceMeter = new PerformanceMeter();
        orchestrator = OrchestrationEngine.getInstance();
    });

    afterEach(async () => {
        try {
            await orchestrator.shutdown();
        } catch (error) {
            // Ignore shutdown errors
        }
        (OrchestrationEngine as any).instance = null;
    });

    describe('Initialization Performance', () => {
        test('should initialize system within performance thresholds', async () => {
            const startTime = performance.now();
            
            await orchestrator.initialize();
            
            const endTime = performance.now();
            const initializationTime = endTime - startTime;
            
            // System should initialize in under 1 second
            expect(initializationTime).toBeLessThan(1000);
            
            console.log(`System initialization took: ${initializationTime.toFixed(2)}ms`);
        });

        test('should handle concurrent initialization attempts', async () => {
            const concurrentInits = 5;
            const initPromises = Array.from({ length: concurrentInits }, () => 
                orchestrator.initialize()
            );
            
            const startTime = performance.now();
            await Promise.all(initPromises);
            const endTime = performance.now();
            
            const totalTime = endTime - startTime;
            
            // Concurrent initializations should not take significantly longer
            expect(totalTime).toBeLessThan(2000);
            
            console.log(`${concurrentInits} concurrent initializations took: ${totalTime.toFixed(2)}ms`);
        });
    });

    describe('Message Throughput Performance', () => {
        beforeEach(async () => {
            await orchestrator.initialize();
        });

        test.each(PERFORMANCE_CONFIG.MESSAGE_VOLUMES)(
            'should handle %d messages efficiently',
            async (messageCount) => {
                performanceMeter.start();
                
                const messages = Array.from({ length: messageCount }, (_, i) => ({
                    id: `perf-msg-${i}`,
                    type: 'data' as any,
                    from: 'performance-test',
                    to: 'consumer',
                    payload: { index: i, timestamp: Date.now() },
                    priority: 'medium' as any,
                    timestamp: new Date(),
                }));
                
                const sendPromises = messages.map(async (msg) => {
                    const msgStart = performance.now();
                    try {
                        await orchestrator.sendMessage(msg);
                        const msgEnd = performance.now();
                        performanceMeter.recordOperation(msgEnd - msgStart, false);
                    } catch (error) {
                        const msgEnd = performance.now();
                        performanceMeter.recordOperation(msgEnd - msgStart, true);
                    }
                });
                
                await Promise.all(sendPromises);
                
                const metrics = performanceMeter.stop();
                
                // Performance assertions based on message volume
                if (messageCount <= 100) {
                    expect(metrics.averageLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.GOOD);
                } else if (messageCount <= 500) {
                    expect(metrics.averageLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.ACCEPTABLE);
                } else {
                    expect(metrics.averageLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.POOR);
                }
                
                // Error rate should be low
                expect(metrics.errorRate).toBeLessThan(5); // Less than 5% error rate
                
                console.log(`${messageCount} messages - Throughput: ${metrics.throughput.toFixed(2)} ops/sec, Avg Latency: ${metrics.averageLatency.toFixed(2)}ms`);
            }
        );
    });

    describe('Concurrent Operations Scalability', () => {
        beforeEach(async () => {
            await orchestrator.initialize();
        });

        test.each(PERFORMANCE_CONFIG.CONCURRENT_OPERATIONS)(
            'should maintain performance with %d concurrent operations',
            async (concurrentOps) => {
                performanceMeter.start();
                
                const operations = Array.from({ length: concurrentOps }, async (_, i) => {
                    const opStart = performance.now();
                    try {
                        // Mix of different operations to simulate real load
                        if (i % 3 === 0) {
                            await orchestrator.getSystemHealth();
                        } else if (i % 3 === 1) {
                            await orchestrator.getStatistics();
                        } else {
                            await orchestrator.sendMessage({
                                id: `concurrent-${i}`,
                                type: 'query' as any,
                                from: 'load-test',
                                to: 'system',
                                payload: { operation: 'health_check' },
                                priority: 'low' as any,
                                timestamp: new Date(),
                            });
                        }
                        
                        const opEnd = performance.now();
                        performanceMeter.recordOperation(opEnd - opStart, false);
                    } catch (error) {
                        const opEnd = performance.now();
                        performanceMeter.recordOperation(opEnd - opStart, true);
                    }
                });
                
                await Promise.all(operations);
                
                const metrics = performanceMeter.stop();
                
                // Performance should degrade gracefully with increased load
                const expectedLatency = concurrentOps <= 10 
                    ? PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.GOOD
                    : concurrentOps <= 50 
                    ? PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.ACCEPTABLE
                    : PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.POOR;
                
                expect(metrics.averageLatency).toBeLessThan(expectedLatency);
                expect(metrics.errorRate).toBeLessThan(10); // Less than 10% error rate
                
                console.log(`${concurrentOps} concurrent ops - Throughput: ${metrics.throughput.toFixed(2)} ops/sec, Avg Latency: ${metrics.averageLatency.toFixed(2)}ms`);
            }
        );
    });

    describe('Load Testing', () => {
        beforeEach(async () => {
            await orchestrator.initialize();
        });

        test('should maintain stability under sustained load', async () => {
            const loadTestDuration = PERFORMANCE_CONFIG.LOAD_TEST_DURATION;
            const startTime = performance.now();
            const metrics: PerformanceMetrics[] = [];
            let operationCount = 0;
            
            // Run load test for specified duration
            while ((performance.now() - startTime) < loadTestDuration) {
                performanceMeter.start();
                
                // Batch of operations
                const batchSize = 10;
                const batch = Array.from({ length: batchSize }, async () => {
                    const opStart = performance.now();
                    try {
                        await orchestrator.getSystemHealth();
                        const opEnd = performance.now();
                        performanceMeter.recordOperation(opEnd - opStart, false);
                        operationCount++;
                    } catch (error) {
                        const opEnd = performance.now();
                        performanceMeter.recordOperation(opEnd - opStart, true);
                    }
                });
                
                await Promise.all(batch);
                metrics.push(performanceMeter.stop());
                
                // Small delay to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            const endTime = performance.now();
            const totalDuration = endTime - startTime;
            
            // Calculate overall metrics
            const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length;
            const avgLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0) / metrics.length;
            const maxLatency = Math.max(...metrics.map(m => m.maxLatency));
            const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;
            
            // Verify system remained stable under load
            expect(avgLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.ACCEPTABLE);
            expect(maxLatency).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_THRESHOLDS.POOR);
            expect(avgErrorRate).toBeLessThan(5);
            
            console.log(`Load Test Results (${totalDuration.toFixed(0)}ms):`);
            console.log(`  Operations: ${operationCount}`);
            console.log(`  Avg Throughput: ${avgThroughput.toFixed(2)} ops/sec`);
            console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`);
            console.log(`  Max Latency: ${maxLatency.toFixed(2)}ms`);
            console.log(`  Error Rate: ${avgErrorRate.toFixed(2)}%`);
        }, 40000); // Extend timeout for load test
    });

    describe('Memory and Resource Usage', () => {
        beforeEach(async () => {
            await orchestrator.initialize();
        });

        test('should maintain reasonable memory usage under load', async () => {
            const initialMemory = await measureMemoryUsage();
            
            // Generate sustained load
            const operations = Array.from({ length: 200 }, async (_, i) => {
                await orchestrator.sendMessage({
                    id: `memory-test-${i}`,
                    type: 'data' as any,
                    from: 'memory-test',
                    to: 'consumer',
                    payload: { 
                        data: 'x'.repeat(1000), // 1KB payload
                        index: i 
                    },
                    priority: 'low' as any,
                    timestamp: new Date(),
                });
            });
            
            await Promise.all(operations);
            
            const finalMemory = await measureMemoryUsage();
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable
            expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.MEMORY_THRESHOLD_MB);
            
            console.log(`Memory usage: Initial: ${initialMemory.toFixed(2)}MB, Final: ${finalMemory.toFixed(2)}MB, Increase: ${memoryIncrease.toFixed(2)}MB`);
        });

        test('should clean up resources properly after operations', async () => {
            const preTestMemory = await measureMemoryUsage();
            
            // Perform operations that should be cleaned up
            for (let i = 0; i < 5; i++) {
                const tempOrchestrator = OrchestrationEngine.getInstance();
                await tempOrchestrator.initialize();
                await tempOrchestrator.getSystemHealth();
                await tempOrchestrator.shutdown();
                (OrchestrationEngine as any).instance = null;
            }
            
            // Force garbage collection if available
            if (typeof global !== 'undefined' && (global as any).gc) {
                (global as any).gc();
            }
            
            const postTestMemory = await measureMemoryUsage();
            const memoryDiff = Math.abs(postTestMemory - preTestMemory);
            
            // Memory should return to approximately initial levels
            expect(memoryDiff).toBeLessThan(50); // Within 50MB variance
            
            console.log(`Resource cleanup test: Pre: ${preTestMemory.toFixed(2)}MB, Post: ${postTestMemory.toFixed(2)}MB, Diff: ${memoryDiff.toFixed(2)}MB`);
        });
    });

    describe('Stress Testing', () => {
        test('should survive extreme load conditions', async () => {
            await orchestrator.initialize();
            
            const stressTestDuration = 10000; // 10 seconds for CI
            const startTime = performance.now();
            let totalOperations = 0;
            let totalErrors = 0;
            
            // Extreme concurrent load
            const stressPromises: Promise<void>[] = [];
            
            while ((performance.now() - startTime) < stressTestDuration) {
                // Launch high concurrency batches
                const batch = Array.from({ length: 20 }, async () => {
                    try {
                        await Promise.all([
                            orchestrator.getSystemHealth(),
                            orchestrator.getStatistics(),
                            orchestrator.sendMessage({
                                id: `stress-${Date.now()}-${Math.random()}`,
                                type: 'command' as any,
                                from: 'stress-test',
                                to: 'system',
                                payload: { stress: true },
                                priority: 'high' as any,
                                timestamp: new Date(),
                            }),
                        ]);
                        totalOperations += 3;
                    } catch (error) {
                        totalErrors++;
                    }
                });
                
                stressPromises.push(...batch);
                
                // Brief pause to prevent complete system overwhelming
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            // Wait for all operations to complete
            await Promise.allSettled(stressPromises);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            const errorRate = (totalErrors / totalOperations) * 100;
            
            // System should survive stress test
            expect(errorRate).toBeLessThan(25); // Allow higher error rate under extreme stress
            
            // System should still be responsive
            const healthCheck = await orchestrator.getSystemHealth();
            expect(healthCheck).toBeDefined();
            
            console.log(`Stress Test Results (${duration.toFixed(0)}ms):`);
            console.log(`  Total Operations: ${totalOperations}`);
            console.log(`  Total Errors: ${totalErrors}`);
            console.log(`  Error Rate: ${errorRate.toFixed(2)}%`);
            console.log(`  System survived: ${errorRate < 25 ? 'YES' : 'NO'}`);
        }, 20000); // Extended timeout for stress test
    });
}); 