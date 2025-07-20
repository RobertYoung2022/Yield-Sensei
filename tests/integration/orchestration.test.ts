import { OrchestrationEngine } from '@/core/orchestration/engine';
import { DatabaseManager } from '@/shared/database/manager';
import { MessageBus } from '@/core/messaging/bus';
import { jest } from '@jest/globals';

// Mock AgentLifecycleManager first (CRITICAL - this was removed)
jest.mock('@/core/lifecycle/manager', () => {
  const mockLifecycleManagerInstance = {
    createAgent: jest.fn<() => Promise<string>>().mockResolvedValue('test-agent'),
    startAgent: jest.fn<() => Promise<void>>().mockResolvedValue(),
    stopAgent: jest.fn<() => Promise<void>>().mockResolvedValue(),
    getAllAgentStatuses: jest.fn().mockReturnValue(new Map()),
    getLifecycleStats: jest.fn().mockReturnValue({
      totalAgents: 0,
      runningAgents: 0,
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

// Mock DatabaseManager completely (FIXED - prevent constructor execution)
jest.mock('@/shared/database/manager', () => {
    const mockDatabaseManagerInstance = {
        initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        healthCheck: jest.fn<() => Promise<{ healthy: boolean; details: any }>>().mockResolvedValue({ 
            healthy: true, 
            details: {} 
        }),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        emit: jest.fn(),
    };
    
    // Completely replace the class to prevent constructor execution
    const MockDatabaseManager: any = jest.fn().mockImplementation(() => mockDatabaseManagerInstance);
    MockDatabaseManager.getInstance = jest.fn(() => mockDatabaseManagerInstance);
    
    return {
        DatabaseManager: MockDatabaseManager,
    };
});

// Mock MessageBus (this looks correct already)
jest.mock('@/core/messaging/bus', () => {
    const mockMessageBus = jest.fn();
    mockMessageBus.prototype.initialize = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.shutdown = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.subscribeAgent = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.unsubscribeAgent = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockMessageBus.prototype.on = jest.fn();
    mockMessageBus.prototype.getStats = jest.fn().mockReturnValue({ 
        messagesSent: 0, 
        messagesReceived: 0, 
        messagesRetried: 0, 
        messagesFailed: 0, 
        averageLatency: 0, 
        topicStats: new Map(), 
        connectionStatus: 'connected' 
    });
    mockMessageBus.prototype.healthCheck = jest.fn<() => Promise<{ healthy: boolean; details: any }>>().mockResolvedValue({ 
        healthy: true, 
        details: {} 
    });

    return {
        MessageBus: mockMessageBus,
    };
});

// Helper function to create a mock Response object
const createMockResponse = (url: string, wasmBuffer?: Buffer): Response => {
    return {
        arrayBuffer: () => Promise.resolve(wasmBuffer ? wasmBuffer.buffer : new ArrayBuffer(0)),
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        url: url,
        type: 'default' as any, // Cast to avoid type issues
        redirected: false,
        body: null,
        bodyUsed: false,
        blob: () => Promise.resolve(new Blob([])),
        formData: () => Promise.resolve(new FormData()),
        clone: () => createMockResponse(url, wasmBuffer),
    } as Response;
};

describe('OrchestrationEngine Integration', () => {
    let orchestrator: OrchestrationEngine;

    beforeAll(() => {
        // Mock global fetch for ClickHouse queries
        global.fetch = jest.fn(async (input: Request | string | URL) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            if (url.includes('clickhouse')) {
                return Promise.resolve(createMockResponse(url));
            }
            return Promise.reject(new Error(`Unhandled fetch request: ${url}`));
        });
    });

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        orchestrator = OrchestrationEngine.getInstance();
    });

    afterEach(async () => {
        try {
            await orchestrator.shutdown();
        } catch (error) {
            // Ignore shutdown errors in tests
        }
        
        // Reset singleton to prevent state pollution (CRITICAL - this was removed)
        (OrchestrationEngine as any).instance = null;
    });

    test('should initialize and shutdown successfully', async () => {
        // Test initialization
        await orchestrator.initialize();
        expect(DatabaseManager.getInstance().initialize).toHaveBeenCalledTimes(1);
        expect(MessageBus.prototype.initialize).toHaveBeenCalledTimes(1);

        // Test shutdown (explicit call for verification, afterEach will also call it)
        await orchestrator.shutdown();
        expect(DatabaseManager.getInstance().disconnect).toHaveBeenCalledTimes(1);
        expect(MessageBus.prototype.shutdown).toHaveBeenCalledTimes(1);
    });
});