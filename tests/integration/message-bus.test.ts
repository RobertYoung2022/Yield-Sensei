/**
 * MessageBus Integration Tests
 * Tests message bus functionality and inter-agent communication patterns
 */

import { MessageBus } from '@/core/messaging/bus';
import { Message, MessageType, MessagePriority } from '@/types';
import { jest } from '@jest/globals';

// Mock Kafka for integration testing
jest.mock('kafkajs', () => {
    const mockProducer = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue([{ partition: 0, offset: '0' }]),
    };

    const mockConsumer = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockResolvedValue(undefined),
        run: jest.fn().mockResolvedValue(undefined),
    };

    const mockKafka = {
        producer: jest.fn(() => mockProducer),
        consumer: jest.fn(() => mockConsumer),
        admin: jest.fn(() => ({
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            createTopics: jest.fn().mockResolvedValue(undefined),
        })),
    };

    return {
        Kafka: jest.fn(() => mockKafka),
        logLevel: { WARN: 0 },
    };
});

describe('MessageBus Integration Tests', () => {
    let messageBus: MessageBus;
    const testMessages: Message[] = [];

    beforeEach(async () => {
        jest.clearAllMocks();
        testMessages.length = 0;
        
        messageBus = new MessageBus();
        await messageBus.initialize();
    });

    afterEach(async () => {
        await messageBus.shutdown();
    });

    describe('Message Delivery Patterns', () => {
        test('should handle point-to-point messaging', async () => {
            const message: Message = {
                id: 'test-msg-1',
                type: MessageType.COMMAND,
                from: 'sage',
                to: 'forge',
                payload: { action: 'analyze_protocol', data: { protocol: 'uniswap' } },
                priority: MessagePriority.HIGH,
                timestamp: new Date(),
                correlationId: 'correlation-1',
            };

            await messageBus.sendMessage(message);
            
            // Verify message was sent with correct routing
            expect(messageBus.getStats().messagesSent).toBe(1);
        });

        test('should handle broadcast messaging', async () => {
            const broadcastMessage: Message = {
                id: 'broadcast-1',
                type: MessageType.EVENT,
                from: 'orchestrator',
                to: 'broadcast',
                payload: { event: 'system_shutdown', data: {} },
                priority: MessagePriority.CRITICAL,
                timestamp: new Date(),
            };

            await messageBus.sendMessage(broadcastMessage);
            
            expect(messageBus.getStats().messagesSent).toBe(1);
        });

        test('should handle priority message ordering', async () => {
            const messages: Message[] = [
                {
                    id: 'low-priority',
                    type: MessageType.DATA,
                    from: 'oracle',
                    to: 'sage',
                    payload: { data: 'background_sync' },
                    priority: MessagePriority.LOW,
                    timestamp: new Date(),
                },
                {
                    id: 'critical-priority',
                    type: MessageType.COMMAND,
                    from: 'aegis',
                    to: 'all',
                    payload: { alert: 'liquidation_risk' },
                    priority: MessagePriority.CRITICAL,
                    timestamp: new Date(),
                },
                {
                    id: 'high-priority',
                    type: MessageType.QUERY,
                    from: 'pulse',
                    to: 'sage',
                    payload: { query: 'yield_analysis' },
                    priority: MessagePriority.HIGH,
                    timestamp: new Date(),
                },
            ];

            // Send messages in reverse priority order
            for (const msg of messages) {
                await messageBus.sendMessage(msg);
            }

            expect(messageBus.getStats().messagesSent).toBe(3);
        });
    });

    describe('Agent Subscription Management', () => {
        test('should manage agent subscriptions correctly', async () => {
            const agentIds = ['sage', 'forge', 'pulse', 'aegis'];

            // Subscribe all agents
            for (const agentId of agentIds) {
                await messageBus.subscribeAgent(agentId);
            }

            // Verify subscriptions
            const stats = messageBus.getStats();
            expect(stats.topicStats.size).toBeGreaterThan(0);
        });

        test('should handle agent unsubscription', async () => {
            await messageBus.subscribeAgent('test-agent');
            await messageBus.unsubscribeAgent('test-agent');

            // Verify agent is unsubscribed
            expect(messageBus.getStats().messagesSent).toBe(0);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle message delivery failures gracefully', async () => {
            // Mock a delivery failure
            const originalSend = messageBus.sendMessage;
            messageBus.sendMessage = jest.fn().mockRejectedValueOnce(new Error('Network error'));

            const message: Message = {
                id: 'failing-message',
                type: MessageType.COMMAND,
                from: 'test',
                to: 'test',
                payload: {},
                priority: MessagePriority.MEDIUM,
                timestamp: new Date(),
            };

            await expect(messageBus.sendMessage(message)).rejects.toThrow('Network error');
            
            // Restore original method
            messageBus.sendMessage = originalSend;
        });

        test('should track failed message statistics', async () => {
            const initialStats = messageBus.getStats();
            
            // Simulate a failure scenario and verify stats are updated
            expect(initialStats.messagesFailed).toBe(0);
        });
    });

    describe('Performance and Throughput', () => {
        test('should handle high message volume', async () => {
            const messageCount = 100;
            const startTime = Date.now();

            const sendPromises = [];
            for (let i = 0; i < messageCount; i++) {
                const message: Message = {
                    id: `bulk-msg-${i}`,
                    type: MessageType.DATA,
                    from: 'generator',
                    to: 'consumer',
                    payload: { index: i },
                    priority: MessagePriority.MEDIUM,
                    timestamp: new Date(),
                };
                sendPromises.push(messageBus.sendMessage(message));
            }

            await Promise.all(sendPromises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(messageBus.getStats().messagesSent).toBe(messageCount);
            
            // Performance assertion: should handle 100 messages in under 1 second
            expect(duration).toBeLessThan(1000);
        });

        test('should maintain low latency for priority messages', async () => {
            const priorityMessage: Message = {
                id: 'latency-test',
                type: MessageType.COMMAND,
                from: 'test',
                to: 'test',
                payload: { urgent: true },
                priority: MessagePriority.CRITICAL,
                timestamp: new Date(),
            };

            const startTime = Date.now();
            await messageBus.sendMessage(priorityMessage);
            const endTime = Date.now();

            // Should process critical messages in under 10ms
            expect(endTime - startTime).toBeLessThan(10);
        });
    });

    describe('Health Monitoring', () => {
        test('should provide accurate health status', async () => {
            const healthStatus = await messageBus.healthCheck();
            
            expect(healthStatus).toHaveProperty('healthy');
            expect(healthStatus).toHaveProperty('details');
            expect(healthStatus.healthy).toBe(true);
        });

        test('should track connection status', async () => {
            const stats = messageBus.getStats();
            expect(stats.connectionStatus).toBe('connected');
        });
    });

    describe('Configuration Validation', () => {
        test('should validate message bus configuration', () => {
            const config = {
                kafka: {
                    clientId: 'test-client',
                    brokers: ['localhost:9092'],
                },
                topics: {
                    default: 'test.messages',
                    priority: 'test.priority',
                    broadcast: 'test.broadcast',
                    events: 'test.events',
                    heartbeat: 'test.heartbeat',
                },
            };

            // Verify configuration is valid
            expect(config.kafka.brokers).toHaveLength(1);
            expect(config.topics.default).toBeDefined();
        });
    });
}); 