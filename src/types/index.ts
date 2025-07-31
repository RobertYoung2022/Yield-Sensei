/**
 * Core type definitions for YieldSensei
 */

// Re-export common types and utilities
export * from './common';

// Re-export database schema types
export * from './database-schemas';

// Agent Types
export type AgentId = string;
export type AgentType = 'sage' | 'forge' | 'pulse' | 'aegis' | 'echo' | 'fuel' | 'bridge' | 'oracle';

export interface AgentConfig {
  id: AgentId;
  type: AgentType;
  name: string;
  version: string;
  implementation: 'custom' | 'elizaos' | 'hybrid';
  config: Record<string, unknown>;
}

export interface AgentStatus {
  id: AgentId;
  status: 'initializing' | 'running' | 'stopped' | 'error' | 'restarting';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastHeartbeat: Date;
  uptime: number;
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  messagesSent: number;
  messagesReceived: number;
  tasksProcessed: number;
  errors: number;
  avgResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Message Types
export type MessageType = 
  | 'command' 
  | 'query' 
  | 'response' 
  | 'event' 
  | 'heartbeat' 
  | 'error'
  | 'data'
  | 'notification';

export interface Message {
  id: string;
  type: MessageType;
  from: AgentId;
  to: AgentId | 'broadcast';
  timestamp: Date;
  payload: Record<string, unknown>;
  correlationId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ttl?: number; // Time to live in milliseconds
}

export interface MessageEnvelope {
  message: Message;
  retryCount: number;
  maxRetries: number;
  deliveryAttempts: Date[];
}

// Communication Protocol Types
export interface ProtocolConfig {
  version: string;
  encryption: boolean;
  compression: boolean;
  messageFormat: 'json' | 'protobuf' | 'msgpack';
  maxMessageSize: number;
  heartbeatInterval: number;
  timeout: number;
  encryptionKey?: string;
}

// State Management Types
export interface AgentState {
  id: AgentId;
  data: Record<string, unknown>;
  version: number;
  lastModified: Date;
  locks: string[];
}

export interface StateUpdate {
  agentId: AgentId;
  key: string;
  value: unknown;
  version: number;
  operation: 'set' | 'delete' | 'increment' | 'append';
}

// Lifecycle Types
export interface LifecycleEvent {
  type: 'created' | 'started' | 'stopped' | 'error' | 'heartbeat' | 'config_updated';
  agentId: AgentId;
  timestamp: Date;
  data?: unknown;
}

// Error Types
export class AgentError extends Error {
  constructor(
    message: string,
    public agentId: AgentId,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class MessageError extends Error {
  constructor(
    message: string,
    public messageId: string,
    public code: string
  ) {
    super(message);
    this.name = 'MessageError';
  }
}

export class ProtocolError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

// Satellite-specific interfaces
export interface SatelliteAgent {
  readonly id: AgentId;
  readonly type: AgentType;
  readonly config: AgentConfig;
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  handleMessage(message: Message): Promise<void>;
  getStatus(): AgentStatus;
  updateConfig(config: Partial<AgentConfig>): Promise<void>;
}

// Performance and monitoring
export interface PerformanceMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    messagesPerSecond: number;
    tasksPerSecond: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
  };
  errors: {
    rate: number;
    recent: Error[];
  };
}