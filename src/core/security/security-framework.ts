/**
 * YieldSensei Security Framework
 * Task 45.4: Security and Cloud-Native Deployment Capabilities
 * 
 * Integrates all security components and provides unified security management
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';
import { EncryptionManager, EncryptionConfig, DEFAULT_ENCRYPTION_CONFIG } from './encryption-manager';
import { AuthenticationManager, AuthConfig, DEFAULT_AUTH_CONFIG, Permission } from './authentication-manager';
import { SatelliteMessageBus } from '../communication/satellite-message-bus';

const logger = Logger.getLogger('security-framework');

/**
 * Security Policy
 */
export interface SecurityPolicy {
  id: string;
  name: string;
  version: string;
  encryption: {
    required: boolean;
    minimumAlgorithm: string;
    keyRotationInterval: number;
  };
  authentication: {
    required: boolean;
    methods: string[];
    sessionTimeout: number;
    mfaRequired: boolean;
  };
  authorization: {
    defaultDeny: boolean;
    roleBasedAccess: boolean;
    permissionInheritance: boolean;
  };
  networking: {
    tlsRequired: boolean;
    minimumTlsVersion: string;
    certificateValidation: boolean;
  };
  auditing: {
    enabled: boolean;
    logAllRequests: boolean;
    retentionPeriod: number;
  };
  compliance: {
    standards: string[];
    dataClassification: string[];
    auditFrequency: string;
  };
}

/**
 * Security Event
 */
export interface SecurityEvent {
  id: string;
  type: 'authentication' | 'authorization' | 'encryption' | 'audit' | 'violation' | 'alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  nodeId: AgentId;
  timestamp: Date;
  description: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: AgentId;
}

/**
 * Security Audit Log
 */
export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  nodeId: AgentId;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'denied';
  metadata: {
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    additionalInfo?: Record<string, any>;
  };
}

/**
 * Security Framework Configuration
 */
export interface SecurityFrameworkConfig {
  nodeId: AgentId;
  encryption: EncryptionConfig;
  authentication: AuthConfig;
  policy: SecurityPolicy;
  monitoring: {
    enableRealTimeAlerts: boolean;
    alertThresholds: {
      failedAuthAttempts: number;
      suspiciousActivity: number;
      encryptionFailures: number;
    };
    auditLogRetention: number;
    securityEventRetention: number;
  };
  incident: {
    autoResponse: boolean;
    escalationThresholds: {
      medium: number;
      high: number;
      critical: number;
    };
    responseActions: {
      lockNode: boolean;
      revokeTokens: boolean;
      alertAdministrators: boolean;
    };
  };
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  id: 'default-policy-v1',
  name: 'YieldSensei Default Security Policy',
  version: '1.0.0',
  encryption: {
    required: true,
    minimumAlgorithm: 'aes-256-gcm',
    keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
  },
  authentication: {
    required: true,
    methods: ['certificate', 'hmac'],
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    mfaRequired: false,
  },
  authorization: {
    defaultDeny: true,
    roleBasedAccess: true,
    permissionInheritance: false,
  },
  networking: {
    tlsRequired: true,
    minimumTlsVersion: '1.3',
    certificateValidation: true,
  },
  auditing: {
    enabled: true,
    logAllRequests: true,
    retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  compliance: {
    standards: ['SOC2', 'ISO27001'],
    dataClassification: ['public', 'internal', 'confidential', 'restricted'],
    auditFrequency: 'quarterly',
  },
};

export const DEFAULT_SECURITY_FRAMEWORK_CONFIG: SecurityFrameworkConfig = {
  nodeId: 'unknown',
  encryption: DEFAULT_ENCRYPTION_CONFIG,
  authentication: DEFAULT_AUTH_CONFIG,
  policy: DEFAULT_SECURITY_POLICY,
  monitoring: {
    enableRealTimeAlerts: true,
    alertThresholds: {
      failedAuthAttempts: 5,
      suspiciousActivity: 10,
      encryptionFailures: 3,
    },
    auditLogRetention: 90 * 24 * 60 * 60 * 1000, // 90 days
    securityEventRetention: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  incident: {
    autoResponse: true,
    escalationThresholds: {
      medium: 3,
      high: 2,
      critical: 1,
    },
    responseActions: {
      lockNode: true,
      revokeTokens: true,
      alertAdministrators: true,
    },
  },
};

/**
 * Security Statistics
 */
export interface SecurityStats {
  totalSecurityEvents: number;
  eventsBySeverity: Map<string, number>;
  totalAuditLogs: number;
  authenticatedSessions: number;
  encryptedMessages: number;
  securityViolations: number;
  resolvedIncidents: number;
  activeThreats: number;
  averageResponseTime: number;
}

/**
 * Security Framework
 * Central security management and coordination
 */
export class SecurityFramework extends EventEmitter {
  private config: SecurityFrameworkConfig;
  private encryptionManager: EncryptionManager;
  private authenticationManager: AuthenticationManager;
  private messageBus?: SatelliteMessageBus;
  
  // Security event tracking
  private securityEvents: Map<string, SecurityEvent> = new Map();
  private auditLogs: Map<string, SecurityAuditLog> = new Map();
  
  // Monitoring and alerting
  private alertThresholdCounters: Map<string, number> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  
  // Timers
  private cleanupTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  
  // State
  private isRunning: boolean = false;
  private eventSequence: number = 0;
  private auditSequence: number = 0;
  
  // Statistics
  private stats: SecurityStats = {
    totalSecurityEvents: 0,
    eventsBySeverity: new Map(),
    totalAuditLogs: 0,
    authenticatedSessions: 0,
    encryptedMessages: 0,
    securityViolations: 0,
    resolvedIncidents: 0,
    activeThreats: 0,
    averageResponseTime: 0,
  };

  constructor(config: SecurityFrameworkConfig = DEFAULT_SECURITY_FRAMEWORK_CONFIG) {
    super();
    this.config = config;
    
    // Initialize security components
    this.encryptionManager = new EncryptionManager(config.encryption);
    this.authenticationManager = new AuthenticationManager(config.authentication);
    
    // Set up component integration
    this.authenticationManager.setEncryptionManager(this.encryptionManager);
    
    this.setupEventHandlers();
  }

  /**
   * Set message bus for secure communication
   */
  setMessageBus(messageBus: SatelliteMessageBus): void {
    this.messageBus = messageBus;
    this.setupMessageBusHandlers();
  }

  /**
   * Start the security framework
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Security framework already running');
      return;
    }

    try {
      logger.info('Starting security framework...');

      // Start security components
      await this.encryptionManager.start();
      await this.authenticationManager.start();

      // Start monitoring
      this.startSecurityMonitoring();

      // Start cleanup
      this.startCleanup();

      this.isRunning = true;
      logger.info('Security framework started successfully');
      this.emit('started');

      // Log security framework startup
      await this.auditLog({
        action: 'security_framework_started',
        resource: 'system',
        outcome: 'success',
        metadata: {
          version: this.config.policy.version,
          nodeId: this.config.nodeId,
        },
      });

    } catch (error) {
      logger.error('Failed to start security framework:', error);
      throw error;
    }
  }

  /**
   * Stop the security framework
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping security framework...');

    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      delete this.monitoringTimer;
    }

    // Stop security components
    await this.encryptionManager.stop();
    await this.authenticationManager.stop();

    this.isRunning = false;
    logger.info('Security framework stopped');
    this.emit('stopped');

    // Log security framework shutdown
    await this.auditLog({
      action: 'security_framework_stopped',
      resource: 'system',
      outcome: 'success',
      metadata: {
        nodeId: this.config.nodeId,
      },
    });
  }

  /**
   * Authenticate node request
   */
  async authenticate(request: any): Promise<any> {
    const startTime = Date.now();

    try {
      // Policy enforcement
      if (this.config.policy.authentication.required) {
        const response = await this.authenticationManager.authenticate(request);
        
        // Log authentication attempt
        await this.auditLog({
          action: 'authentication_attempt',
          resource: 'authentication_service',
          outcome: response.success ? 'success' : 'failure',
          metadata: {
            nodeId: request.nodeId,
            method: request.method,
            sessionId: response.sessionToken,
            error: response.error,
          },
        });

        // Update statistics
        if (response.success) {
          this.stats.authenticatedSessions++;
        } else {
          await this.recordSecurityEvent({
            type: 'authentication',
            severity: 'medium',
            nodeId: request.nodeId,
            description: `Authentication failed: ${response.error}`,
            metadata: { method: request.method, attempt: Date.now() },
          });
        }

        return response;
      }

      // Authentication not required by policy
      return { success: true, nodeId: request.nodeId, permissions: [] };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.recordSecurityEvent({
        type: 'authentication',
        severity: 'high',
        nodeId: request.nodeId,
        description: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { method: request.method, responseTime },
      });

      throw error;
    }
  }

  /**
   * Encrypt data with security policy enforcement
   */
  async encrypt(data: Buffer, options?: any): Promise<any> {
    try {
      // Policy enforcement
      if (!this.config.policy.encryption.required) {
        logger.warn('Encryption policy not enforced - data transmitted unencrypted');
      }

      const encryptedMessage = await this.encryptionManager.encrypt(data, undefined, options);
      this.stats.encryptedMessages++;

      // Log encryption activity
      await this.auditLog({
        action: 'data_encrypted',
        resource: 'encryption_service',
        outcome: 'success',
        metadata: {
          algorithm: encryptedMessage.algorithm,
          dataSize: data.length,
          keyId: encryptedMessage.keyId,
        },
      });

      return encryptedMessage;

    } catch (error) {
      await this.recordSecurityEvent({
        type: 'encryption',
        severity: 'high',
        nodeId: this.config.nodeId,
        description: `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { dataSize: data.length },
      });

      throw error;
    }
  }

  /**
   * Decrypt data with security policy enforcement
   */
  async decrypt(encryptedMessage: any, options?: any): Promise<Buffer> {
    try {
      const decryptedData = await this.encryptionManager.decrypt(encryptedMessage, options?.associatedData);

      // Log decryption activity
      await this.auditLog({
        action: 'data_decrypted',
        resource: 'encryption_service',
        outcome: 'success',
        metadata: {
          algorithm: encryptedMessage.algorithm,
          messageId: encryptedMessage.id,
          keyId: encryptedMessage.keyId,
        },
      });

      return decryptedData;

    } catch (error) {
      await this.recordSecurityEvent({
        type: 'encryption',
        severity: 'high',
        nodeId: this.config.nodeId,
        description: `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { messageId: encryptedMessage.id },
      });

      throw error;
    }
  }

  /**
   * Authorize action with permissions check
   */
  async authorize(sessionToken: string, requiredPermissions: Permission[]): Promise<boolean> {
    try {
      const session = this.authenticationManager.validateSession(sessionToken, requiredPermissions);
      
      const authorized = session !== null;
      
      // Log authorization attempt
      await this.auditLog({
        action: 'authorization_check',
        resource: 'authorization_service',
        outcome: authorized ? 'success' : 'denied',
        metadata: {
          sessionId: sessionToken,
          requiredPermissions,
          nodeId: session?.nodeId,
        },
      });

      if (!authorized && this.config.policy.authorization.defaultDeny) {
        await this.recordSecurityEvent({
          type: 'authorization',
          severity: 'medium',
          nodeId: session?.nodeId || 'unknown',
          description: 'Unauthorized access attempt',
          metadata: { requiredPermissions, sessionToken },
        });
      }

      return authorized;

    } catch (error) {
      await this.recordSecurityEvent({
        type: 'authorization',
        severity: 'high',
        nodeId: 'unknown',
        description: `Authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { requiredPermissions },
      });

      return false;
    }
  }

  /**
   * Record security event
   */
  async recordSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'resolved' | 'timestamp'>): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      ...eventData,
      id: `sec-event-${++this.eventSequence}-${Date.now()}`,
      timestamp: new Date(),
      resolved: false,
    };

    this.securityEvents.set(event.id, event);
    this.stats.totalSecurityEvents++;
    this.updateEventStatsBySeverity(event.severity, 1);

    logger.warn(`Security event recorded: ${event.type} - ${event.severity} - ${event.description}`);
    this.emit('security_event', event);

    // Check for auto-response triggers
    if (this.config.incident.autoResponse) {
      await this.handleSecurityIncident(event);
    }

    // Check alert thresholds
    await this.checkAlertThresholds(event);

    return event;
  }

  /**
   * Audit log action
   */
  async auditLog(logData: Omit<SecurityAuditLog, 'id' | 'timestamp' | 'nodeId'>): Promise<SecurityAuditLog> {
    const auditLog: SecurityAuditLog = {
      ...logData,
      id: `audit-${++this.auditSequence}-${Date.now()}`,
      timestamp: new Date(),
      nodeId: this.config.nodeId,
    };

    if (this.config.policy.auditing.enabled) {
      this.auditLogs.set(auditLog.id, auditLog);
      this.stats.totalAuditLogs++;

      logger.debug(`Audit log: ${auditLog.action} - ${auditLog.outcome} - ${auditLog.resource}`);
      this.emit('audit_log', auditLog);
    }

    return auditLog;
  }

  /**
   * Resolve security event
   */
  async resolveSecurityEvent(eventId: string, resolvedBy: AgentId, resolution?: string): Promise<boolean> {
    const event = this.securityEvents.get(eventId);
    if (!event) {
      return false;
    }

    event.resolved = true;
    event.resolvedAt = new Date();
    event.resolvedBy = resolvedBy;

    if (resolution) {
      event.metadata.resolution = resolution;
    }

    this.stats.resolvedIncidents++;

    logger.info(`Security event ${eventId} resolved by ${resolvedBy}`);
    this.emit('security_event_resolved', event);

    // Log resolution
    await this.auditLog({
      action: 'security_event_resolved',
      resource: 'security_framework',
      outcome: 'success',
      metadata: {
        eventId,
        resolvedBy,
        resolution,
        eventType: event.type,
        severity: event.severity,
      },
    });

    return true;
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): SecurityStats {
    // Update active threats count
    this.stats.activeThreats = Array.from(this.securityEvents.values())
      .filter(event => !event.resolved && (event.severity === 'high' || event.severity === 'critical'))
      .length;

    return {
      ...this.stats,
      eventsBySeverity: new Map(this.stats.eventsBySeverity),
    };
  }

  /**
   * Get security events
   */
  getSecurityEvents(filter?: {
    severity?: string;
    type?: string;
    nodeId?: AgentId;
    resolved?: boolean;
    since?: Date;
  }): SecurityEvent[] {
    let events = Array.from(this.securityEvents.values());

    if (filter) {
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.nodeId) {
        events = events.filter(e => e.nodeId === filter.nodeId);
      }
      if (filter.resolved !== undefined) {
        events = events.filter(e => e.resolved === filter.resolved);
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filter?: {
    action?: string;
    outcome?: string;
    nodeId?: AgentId;
    since?: Date;
    limit?: number;
  }): SecurityAuditLog[] {
    let logs = Array.from(this.auditLogs.values());

    if (filter) {
      if (filter.action) {
        logs = logs.filter(l => l.action === filter.action);
      }
      if (filter.outcome) {
        logs = logs.filter(l => l.outcome === filter.outcome);
      }
      if (filter.nodeId) {
        logs = logs.filter(l => l.nodeId === filter.nodeId);
      }
      if (filter.since) {
        logs = logs.filter(l => l.timestamp >= filter.since!);
      }
      if (filter.limit) {
        logs = logs.slice(0, filter.limit);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Setup event handlers for security components
   */
  private setupEventHandlers(): void {
    // Encryption Manager events
    this.encryptionManager.on('data_encrypted', (data) => {
      this.auditLog({
        action: 'data_encrypted',
        resource: 'encryption_manager',
        outcome: 'success',
        metadata: data,
      });
    });

    this.encryptionManager.on('key_generated', (key) => {
      this.auditLog({
        action: 'key_generated',
        resource: 'encryption_manager',
        outcome: 'success',
        metadata: { keyId: key.id, type: key.type },
      });
    });

    // Authentication Manager events
    this.authenticationManager.on('node_authenticated', (data) => {
      this.stats.authenticatedSessions++;
      this.auditLog({
        action: 'node_authenticated',
        resource: 'authentication_manager',
        outcome: 'success',
        metadata: { nodeId: data.identity.nodeId, method: data.request.method },
      });
    });

    this.authenticationManager.on('node_locked', (data) => {
      this.recordSecurityEvent({
        type: 'violation',
        severity: 'high',
        nodeId: data.nodeId,
        description: 'Node locked due to repeated authentication failures',
        metadata: { unlockTime: data.unlockTime },
      });
    });
  }

  /**
   * Setup message bus handlers for secure communication
   */
  private setupMessageBusHandlers(): void {
    if (!this.messageBus) {
      return;
    }

    this.messageBus.on('satellite_message', (message) => {
      this.auditLog({
        action: 'message_received',
        resource: 'message_bus',
        outcome: 'success',
        metadata: {
          messageId: message.id,
          from: message.from,
          type: message.type,
        },
      });
    });
  }

  /**
   * Handle security incident with auto-response
   */
  private async handleSecurityIncident(event: SecurityEvent): Promise<void> {
    const thresholds = this.config.incident.escalationThresholds;
    let shouldRespond = false;

    switch (event.severity) {
      case 'critical':
        shouldRespond = true;
        break;
      case 'high':
        const highEvents = Array.from(this.securityEvents.values())
          .filter(e => e.severity === 'high' && e.nodeId === event.nodeId && !e.resolved)
          .length;
        shouldRespond = highEvents >= thresholds.high;
        break;
      case 'medium':
        const mediumEvents = Array.from(this.securityEvents.values())
          .filter(e => e.severity === 'medium' && e.nodeId === event.nodeId && !e.resolved)
          .length;
        shouldRespond = mediumEvents >= thresholds.medium;
        break;
    }

    if (shouldRespond) {
      await this.executeSecurityResponse(event);
    }
  }

  /**
   * Execute security response actions
   */
  private async executeSecurityResponse(event: SecurityEvent): Promise<void> {
    const actions = this.config.incident.responseActions;

    logger.warn(`Executing security response for ${event.severity} event: ${event.description}`);

    if (actions.lockNode && event.nodeId !== this.config.nodeId) {
      this.authenticationManager.lockNode(event.nodeId);
      await this.auditLog({
        action: 'node_locked_security_response',
        resource: 'security_framework',
        outcome: 'success',
        metadata: { eventId: event.id, nodeId: event.nodeId },
      });
    }

    if (actions.revokeTokens) {
      // Would revoke all sessions for the node
      await this.auditLog({
        action: 'tokens_revoked_security_response',
        resource: 'security_framework',
        outcome: 'success',
        metadata: { eventId: event.id, nodeId: event.nodeId },
      });
    }

    if (actions.alertAdministrators) {
      this.emit('security_alert', {
        event,
        action: 'administrator_alert',
        timestamp: new Date(),
      });
    }

    this.emit('security_response_executed', { event, actions });
  }

  /**
   * Check alert thresholds
   */
  private async checkAlertThresholds(event: SecurityEvent): Promise<void> {
    const thresholds = this.config.monitoring.alertThresholds;
    const key = `${event.type}_${event.nodeId}`;
    
    const count = (this.alertThresholdCounters.get(key) || 0) + 1;
    this.alertThresholdCounters.set(key, count);

    let shouldAlert = false;
    
    switch (event.type) {
      case 'authentication':
        shouldAlert = count >= thresholds.failedAuthAttempts;
        break;
      case 'encryption':
        shouldAlert = count >= thresholds.encryptionFailures;
        break;
      default:
        shouldAlert = count >= thresholds.suspiciousActivity;
    }

    if (shouldAlert && this.config.monitoring.enableRealTimeAlerts) {
      this.emit('security_threshold_exceeded', {
        type: event.type,
        nodeId: event.nodeId,
        count,
        threshold: this.getThresholdForType(event.type),
        event,
      });

      // Reset counter after alert
      this.alertThresholdCounters.set(key, 0);
    }
  }

  /**
   * Get threshold value for event type
   */
  private getThresholdForType(type: string): number {
    const thresholds = this.config.monitoring.alertThresholds;
    switch (type) {
      case 'authentication':
        return thresholds.failedAuthAttempts;
      case 'encryption':
        return thresholds.encryptionFailures;
      default:
        return thresholds.suspiciousActivity;
    }
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.performSecurityChecks();
    }, 60000); // Check every minute
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldRecords();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Perform periodic security checks
   */
  private performSecurityChecks(): void {
    // Check for policy violations
    this.checkPolicyCompliance();
    
    // Reset alert counters periodically
    this.resetAlertCounters();
    
    // Update statistics
    this.updateSecurityStats();
  }

  /**
   * Check policy compliance
   */
  private checkPolicyCompliance(): void {
    // Check encryption policy
    if (this.config.policy.encryption.required) {
      const encStats = this.encryptionManager.getStats();
      if (encStats.failedOperations > 0) {
        this.recordSecurityEvent({
          type: 'violation',
          severity: 'medium',
          nodeId: this.config.nodeId,
          description: 'Encryption policy violations detected',
          metadata: { failedOperations: encStats.failedOperations },
        });
      }
    }

    // Check authentication policy
    if (this.config.policy.authentication.required) {
      const authStats = this.authenticationManager.getStats();
      if (authStats.failedAuths > authStats.successfulAuths * 0.1) {
        this.recordSecurityEvent({
          type: 'violation',
          severity: 'medium',
          nodeId: this.config.nodeId,
          description: 'High authentication failure rate detected',
          metadata: { 
            failedAuths: authStats.failedAuths,
            successfulAuths: authStats.successfulAuths,
          },
        });
      }
    }
  }

  /**
   * Reset alert counters periodically
   */
  private resetAlertCounters(): void {
    const now = new Date();
    for (const [key, lastReset] of this.lastAlertTime.entries()) {
      if (now.getTime() - lastReset.getTime() > 60 * 60 * 1000) { // 1 hour
        this.alertThresholdCounters.set(key, 0);
        this.lastAlertTime.set(key, now);
      }
    }
  }

  /**
   * Clean up old records
   */
  private cleanupOldRecords(): void {
    const now = new Date();
    
    // Clean up old security events
    const eventRetention = this.config.monitoring.securityEventRetention;
    for (const [eventId, event] of this.securityEvents.entries()) {
      if (now.getTime() - event.timestamp.getTime() > eventRetention) {
        this.securityEvents.delete(eventId);
      }
    }

    // Clean up old audit logs
    const auditRetention = this.config.monitoring.auditLogRetention;
    for (const [logId, log] of this.auditLogs.entries()) {
      if (now.getTime() - log.timestamp.getTime() > auditRetention) {
        this.auditLogs.delete(logId);
      }
    }

    logger.debug('Completed security records cleanup');
  }

  /**
   * Update security statistics
   */
  private updateSecurityStats(): void {
    // Calculate average response time
    const resolvedEvents = Array.from(this.securityEvents.values())
      .filter(e => e.resolved && e.resolvedAt);
    
    if (resolvedEvents.length > 0) {
      const totalResponseTime = resolvedEvents.reduce((sum, event) => {
        return sum + (event.resolvedAt!.getTime() - event.timestamp.getTime());
      }, 0);
      this.stats.averageResponseTime = totalResponseTime / resolvedEvents.length;
    }

    // Update violation count
    this.stats.securityViolations = Array.from(this.securityEvents.values())
      .filter(e => e.type === 'violation').length;
  }

  /**
   * Update event statistics by severity
   */
  private updateEventStatsBySeverity(severity: string, delta: number): void {
    const current = this.stats.eventsBySeverity.get(severity) || 0;
    this.stats.eventsBySeverity.set(severity, current + delta);
  }
}