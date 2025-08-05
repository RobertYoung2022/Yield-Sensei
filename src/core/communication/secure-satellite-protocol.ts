/**
 * Secure Satellite Communication Protocol
 * Task 43.3: Design secure satellite communication protocols
 * 
 * Implements end-to-end encryption, authentication, and secure routing
 * for satellite-to-satellite and orchestration-to-satellite communication
 */

import { EventEmitter } from 'events';
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { getLogger } from "../../shared/utils/logger";
import { AgentId, Message } from '@/types';
import { AuthenticationManager, AuthCredential, Permission } from '../security/authentication-manager';
import { EncryptionManager } from '../security/encryption-manager';

const logger = getLogger('secure-satellite-protocol');

/**
 * Security levels for satellite communications
 */
export enum SecurityLevel {
  PUBLIC = 'public',           // No encryption, public broadcasts
  INTERNAL = 'internal',       // Basic encryption for internal comms
  CONFIDENTIAL = 'confidential', // Strong encryption for sensitive data
  SECRET = 'secret',           // Military-grade encryption
  TOP_SECRET = 'top_secret'    // Highest level encryption with additional safeguards
}

/**
 * Communication modes
 */
export enum CommunicationMode {
  DIRECT = 'direct',           // Direct satellite-to-satellite
  RELAY = 'relay',            // Through relay satellites
  ORCHESTRATED = 'orchestrated', // Through orchestration engine
  BROADCAST = 'broadcast',     // Broadcast to multiple satellites
  EMERGENCY = 'emergency'      // Emergency communications bypass
}

/**
 * Secure message envelope
 */
export interface SecureMessageEnvelope {
  version: string;
  messageId: string;
  securityLevel: SecurityLevel;
  communicationMode: CommunicationMode;
  timestamp: number;
  from: AgentId;
  to: AgentId | AgentId[];
  
  // Security headers
  signature: string;
  keyId: string;
  nonce: string;
  
  // Routing information
  routing?: {
    path?: AgentId[];
    maxHops?: number;
    priority: 'low' | 'normal' | 'high' | 'emergency';
    ttl: number; // Time to live in seconds
  };
  
  // Encrypted payload
  encryptedPayload: string;
  
  // Message integrity
  checksum: string;
  
  // Metadata
  metadata?: {
    contentType?: string;
    compression?: string;
    retryCount?: number;
    correlationId?: string;
  };
}

/**
 * Security configuration for satellite communication
 */
export interface SecureSatelliteConfig {
  nodeId: AgentId;
  securityLevel: SecurityLevel;
  
  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305' | 'aes-256-cbc';
    keyRotationInterval: number; // milliseconds
    keyDerivationFunction: 'pbkdf2' | 'scrypt' | 'argon2';
  };
  
  // Authentication settings
  authentication: {
    method: 'hmac-sha256' | 'ed25519' | 'rsa-pss' | 'mutual-tls';
    credentialRefreshInterval: number;
    challengeResponseEnabled: boolean;
  };
  
  // Message integrity
  integrity: {
    checksumAlgorithm: 'sha256' | 'sha512' | 'blake3';
    enableTimestampValidation: boolean;
    maxClockSkew: number; // milliseconds
  };
  
  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    maxMessagesPerSecond: number;
    burstLimit: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
  };
  
  // Emergency protocols
  emergency: {
    allowUnauthenticatedEmergency: boolean;
    emergencyBypassNodes: AgentId[];
    emergencyEncryptionKey?: string;
  };
}

export const DEFAULT_SECURE_SATELLITE_CONFIG: SecureSatelliteConfig = {
  nodeId: 'unknown',
  securityLevel: SecurityLevel.CONFIDENTIAL,
  
  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationInterval: 3600000, // 1 hour
    keyDerivationFunction: 'scrypt',
  },
  
  authentication: {
    method: 'hmac-sha256',
    credentialRefreshInterval: 1800000, // 30 minutes
    challengeResponseEnabled: true,
  },
  
  integrity: {
    checksumAlgorithm: 'sha256',
    enableTimestampValidation: true,
    maxClockSkew: 5000, // 5 seconds
  },
  
  rateLimiting: {
    enabled: true,
    maxMessagesPerSecond: 100,
    burstLimit: 200,
    backoffStrategy: 'exponential',
  },
  
  emergency: {
    allowUnauthenticatedEmergency: false,
    emergencyBypassNodes: [],
  },
};

/**
 * Key management for secure communications
 */
export interface CommunicationKey {
  keyId: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  purpose: 'encryption' | 'signing' | 'authentication';
  securityLevel: SecurityLevel;
}

/**
 * Secure Satellite Protocol Implementation
 */
export class SecureSatelliteProtocol extends EventEmitter {
  private config: SecureSatelliteConfig;
  private authManager: AuthenticationManager;
  private encryptionManager: EncryptionManager;
  
  // Key management
  private communicationKeys: Map<string, CommunicationKey> = new Map();
  private peerKeys: Map<AgentId, CommunicationKey> = new Map();
  
  // Rate limiting
  private messageRates: Map<AgentId, { count: number; lastReset: number }> = new Map();
  
  // Session management
  private activeSessions: Map<AgentId, {
    sessionId: string;
    establishedAt: Date;
    lastActivity: Date;
    securityLevel: SecurityLevel;
    permissions: Permission[];
  }> = new Map();

  constructor(
    config: SecureSatelliteConfig,
    authManager: AuthenticationManager,
    encryptionManager: EncryptionManager
  ) {
    super();
    this.config = config;
    this.authManager = authManager;
    this.encryptionManager = encryptionManager;
    
    this.initializeKeys();
    this.startKeyRotation();
    this.startSessionCleanup();
  }

  /**
   * Encrypt and sign a message for secure transmission
   */
  async encryptMessage(
    message: Message,
    recipient: AgentId,
    securityLevel: SecurityLevel = this.config.securityLevel
  ): Promise<SecureMessageEnvelope> {
    try {
      // Validate message
      this.validateMessage(message);
      
      // Check rate limiting
      await this.checkRateLimit(message.from);
      
      // Get appropriate encryption key
      const encryptionKey = await this.getEncryptionKey(securityLevel);
      const signingKey = await this.getSigningKey(securityLevel);
      
      // Generate nonce
      const nonce = randomBytes(12);
      
      // Serialize message payload
      const payload = JSON.stringify(message);
      
      // Encrypt payload
      const cipher = createCipheriv(this.config.encryption.algorithm, encryptionKey.key, nonce);
      let encryptedPayload = cipher.update(payload, 'utf8', 'hex');
      encryptedPayload += cipher.final('hex');
      
      // Get auth tag for GCM mode
      const authTag = this.config.encryption.algorithm.includes('gcm') 
        ? cipher.getAuthTag().toString('hex') 
        : '';
      
      // Create message envelope
      const envelope: SecureMessageEnvelope = {
        version: '1.0.0',
        messageId: this.generateMessageId(),
        securityLevel,
        communicationMode: this.determineCommunicationMode(message.from, recipient),
        timestamp: Date.now(),
        from: message.from,
        to: recipient,
        signature: '',
        keyId: encryptionKey.keyId,
        nonce: nonce.toString('hex'),
        encryptedPayload: encryptedPayload + (authTag ? ':' + authTag : ''),
        checksum: '',
        routing: {
          priority: message.priority || 'normal',
          ttl: 300, // 5 minutes default TTL
          maxHops: 5
        },
        metadata: {
          contentType: 'application/json',
          correlationId: message.correlationId
        }
      };
      
      // Calculate checksum
      envelope.checksum = this.calculateChecksum(envelope);
      
      // Sign envelope
      envelope.signature = await this.signEnvelope(envelope, signingKey);
      
      logger.debug('Message encrypted and signed', {
        messageId: envelope.messageId,
        from: envelope.from,
        to: envelope.to,
        securityLevel: envelope.securityLevel
      });
      
      return envelope;
      
    } catch (error) {
      logger.error('Failed to encrypt message:', error);
      throw new Error(`Message encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt and verify a secure message
   */
  async decryptMessage(envelope: SecureMessageEnvelope): Promise<Message> {
    try {
      // Validate envelope structure
      this.validateEnvelope(envelope);
      
      // Check timestamp (prevent replay attacks)
      if (this.config.integrity.enableTimestampValidation) {
        const now = Date.now();
        const age = now - envelope.timestamp;
        if (Math.abs(age) > this.config.integrity.maxClockSkew) {
          throw new Error('Message timestamp outside acceptable range');
        }
      }
      
      // Check TTL
      if (envelope.routing && envelope.routing.ttl) {
        const age = (Date.now() - envelope.timestamp) / 1000;
        if (age > envelope.routing.ttl) {
          throw new Error('Message TTL expired');
        }
      }
      
      // Verify checksum
      const calculatedChecksum = this.calculateChecksum({
        ...envelope,
        signature: '',
        checksum: ''
      });
      
      if (calculatedChecksum !== envelope.checksum) {
        throw new Error('Message checksum validation failed');
      }
      
      // Get decryption and verification keys
      const encryptionKey = this.communicationKeys.get(envelope.keyId);
      if (!encryptionKey) {
        throw new Error(`Encryption key not found: ${envelope.keyId}`);
      }
      
      // Verify signature
      const isValidSignature = await this.verifySignature(envelope);
      if (!isValidSignature) {
        throw new Error('Message signature verification failed');
      }
      
      // Decrypt payload
      const [encryptedData, authTagHex] = envelope.encryptedPayload.split(':');
      const nonce = Buffer.from(envelope.nonce, 'hex');
      
      const decipher = createDecipheriv(this.config.encryption.algorithm, encryptionKey.key, nonce);
      
      // Set auth tag for GCM mode
      if (authTagHex && this.config.encryption.algorithm.includes('gcm')) {
        const authTag = Buffer.from(authTagHex, 'hex');
        (decipher as any).setAuthTag(authTag);
      }
      
      let decryptedPayload = decipher.update(encryptedData, 'hex', 'utf8');
      decryptedPayload += decipher.final('utf8');
      
      // Parse message
      const message: Message = JSON.parse(decryptedPayload);
      
      logger.debug('Message decrypted and verified', {
        messageId: envelope.messageId,
        from: envelope.from,
        to: envelope.to,
        originalMessageId: message.id
      });
      
      return message;
      
    } catch (error) {
      logger.error('Failed to decrypt message:', error);
      throw new Error(`Message decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Establish secure session with another satellite
   */
  async establishSecureSession(
    peerId: AgentId,
    securityLevel: SecurityLevel = this.config.securityLevel
  ): Promise<string> {
    try {
      logger.info('Establishing secure session', { peerId, securityLevel });
      
      // Generate session ID
      const sessionId = this.generateSessionId();
      
      // Perform authentication handshake
      const authResult = await this.performAuthenticationHandshake(peerId, securityLevel);
      
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error}`);
      }
      
      // Create session
      const session = {
        sessionId,
        establishedAt: new Date(),
        lastActivity: new Date(),
        securityLevel,
        permissions: authResult.permissions || []
      };
      
      this.activeSessions.set(peerId, session);
      
      // Emit session established event
      this.emit('sessionEstablished', {
        peerId,
        sessionId,
        securityLevel,
        permissions: session.permissions
      });
      
      logger.info('Secure session established', {
        peerId,
        sessionId,
        securityLevel,
        permissions: session.permissions.length
      });
      
      return sessionId;
      
    } catch (error) {
      logger.error('Failed to establish secure session:', error);
      throw error;
    }
  }

  /**
   * Validate message routing and apply security policies
   */
  async validateSecureRouting(
    envelope: SecureMessageEnvelope,
    currentPath: AgentId[] = []
  ): Promise<{ allowed: boolean; newPath: AgentId[]; reason?: string }> {
    try {
      // Check if routing is within hop limits
      if (envelope.routing?.maxHops && currentPath.length >= envelope.routing.maxHops) {
        return {
          allowed: false,
          newPath: currentPath,
          reason: 'Maximum hop count exceeded'
        };
      }
      
      // Check for routing loops
      if (currentPath.includes(this.config.nodeId)) {
        return {
          allowed: false,
          newPath: currentPath,
          reason: 'Routing loop detected'
        };
      }
      
      // Validate sender authorization for this security level
      const session = this.activeSessions.get(envelope.from);
      if (!session) {
        // Allow emergency messages without session for specific nodes
        if (envelope.communicationMode === CommunicationMode.EMERGENCY &&
            this.config.emergency.allowUnauthenticatedEmergency) {
          logger.warn('Allowing unauthenticated emergency message', {
            from: envelope.from,
            messageId: envelope.messageId
          });
        } else {
          return {
            allowed: false,
            newPath: currentPath,
            reason: 'No active session for sender'
          };
        }
      }
      
      // Check security level authorization
      if (session && !this.isSecurityLevelAuthorized(session.securityLevel, envelope.securityLevel)) {
        return {
          allowed: false,
          newPath: currentPath,
          reason: 'Insufficient security clearance'
        };
      }
      
      // Add current node to path
      const newPath = [...currentPath, this.config.nodeId];
      
      return {
        allowed: true,
        newPath,
        reason: 'Routing validation passed'
      };
      
    } catch (error) {
      logger.error('Routing validation failed:', error);
      return {
        allowed: false,
        newPath: currentPath,
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate emergency bypass credentials
   */
  async generateEmergencyBypass(
    sourceNode: AgentId,
    targetNode: AgentId,
    reason: string
  ): Promise<{ bypassToken: string; expiresAt: Date }> {
    try {
      logger.warn('Generating emergency bypass credentials', {
        sourceNode,
        targetNode,
        reason
      });
      
      const bypassData = {
        sourceNode,
        targetNode,
        reason,
        timestamp: Date.now(),
        nonce: randomBytes(16).toString('hex')
      };
      
      // Create emergency bypass token
      const bypassToken = createHmac('sha256', this.config.emergency.emergencyEncryptionKey || 'emergency-key')
        .update(JSON.stringify(bypassData))
        .digest('hex');
      
      const expiresAt = new Date(Date.now() + 300000); // 5 minutes
      
      // Log emergency bypass for audit
      this.emit('emergencyBypass', {
        sourceNode,
        targetNode,
        reason,
        bypassToken,
        expiresAt,
        timestamp: new Date()
      });
      
      return { bypassToken, expiresAt };
      
    } catch (error) {
      logger.error('Failed to generate emergency bypass:', error);
      throw error;
    }
  }

  // Private methods

  private initializeKeys(): void {
    // Initialize default encryption and signing keys
    const defaultKey: CommunicationKey = {
      keyId: 'default-' + randomBytes(8).toString('hex'),
      key: randomBytes(32), // 256-bit key
      algorithm: this.config.encryption.algorithm,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.encryption.keyRotationInterval),
      purpose: 'encryption',
      securityLevel: this.config.securityLevel
    };
    
    this.communicationKeys.set(defaultKey.keyId, defaultKey);
    
    logger.info('Communication keys initialized', {
      keyId: defaultKey.keyId,
      algorithm: defaultKey.algorithm,
      expiresAt: defaultKey.expiresAt
    });
  }

  private startKeyRotation(): void {
    setInterval(() => {
      this.rotateExpiredKeys();
    }, this.config.encryption.keyRotationInterval / 2); // Check every half rotation interval
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 300000); // Every 5 minutes
  }

  private async rotateExpiredKeys(): Promise<void> {
    try {
      const now = new Date();
      const expiredKeys: string[] = [];
      
      for (const [keyId, key] of this.communicationKeys) {
        if (key.expiresAt <= now) {
          expiredKeys.push(keyId);
        }
      }
      
      if (expiredKeys.length > 0) {
        logger.info('Rotating expired keys', { count: expiredKeys.length });
        
        for (const keyId of expiredKeys) {
          this.communicationKeys.delete(keyId);
        }
        
        // Generate new keys
        this.initializeKeys();
        
        this.emit('keysRotated', {
          rotatedKeys: expiredKeys,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      logger.error('Key rotation failed:', error);
    }
  }

  private cleanupInactiveSessions(): void {
    try {
      const now = new Date();
      const sessionTimeout = 1800000; // 30 minutes
      const inactiveSessions: AgentId[] = [];
      
      for (const [peerId, session] of this.activeSessions) {
        const inactiveTime = now.getTime() - session.lastActivity.getTime();
        if (inactiveTime > sessionTimeout) {
          inactiveSessions.push(peerId);
        }
      }
      
      if (inactiveSessions.length > 0) {
        logger.info('Cleaning up inactive sessions', { count: inactiveSessions.length });
        
        for (const peerId of inactiveSessions) {
          this.activeSessions.delete(peerId);
          this.emit('sessionExpired', { peerId, timestamp: new Date() });
        }
      }
      
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    }
  }

  private validateMessage(message: Message): void {
    if (!message.id || !message.from || !message.to || !message.type) {
      throw new Error('Invalid message: missing required fields');
    }
  }

  private validateEnvelope(envelope: SecureMessageEnvelope): void {
    const required = ['version', 'messageId', 'from', 'to', 'signature', 'keyId', 'nonce', 'encryptedPayload', 'checksum'];
    
    for (const field of required) {
      if (!(field in envelope) || envelope[field as keyof SecureMessageEnvelope] === null || envelope[field as keyof SecureMessageEnvelope] === undefined) {
        throw new Error(`Invalid envelope: missing required field '${field}'`);
      }
    }
  }

  private calculateChecksum(envelope: Partial<SecureMessageEnvelope>): string {
    const data = JSON.stringify({
      version: envelope.version,
      messageId: envelope.messageId,
      from: envelope.from,
      to: envelope.to,
      timestamp: envelope.timestamp,
      encryptedPayload: envelope.encryptedPayload,
      nonce: envelope.nonce,
      keyId: envelope.keyId
    });
    
    return createHash(this.config.integrity.checksumAlgorithm).update(data).digest('hex');
  }

  private async signEnvelope(envelope: SecureMessageEnvelope, signingKey: CommunicationKey): Promise<string> {
    const data = JSON.stringify({
      messageId: envelope.messageId,
      from: envelope.from,
      to: envelope.to,
      timestamp: envelope.timestamp,
      checksum: envelope.checksum
    });
    
    return createHmac('sha256', signingKey.key).update(data).digest('hex');
  }

  private async verifySignature(envelope: SecureMessageEnvelope): Promise<boolean> {
    try {
      const signingKey = this.communicationKeys.get(envelope.keyId);
      if (!signingKey) {
        return false;
      }
      
      const expectedSignature = await this.signEnvelope(envelope, signingKey);
      return envelope.signature === expectedSignature;
      
    } catch (error) {
      logger.error('Signature verification failed:', error);
      return false;
    }
  }

  private async getEncryptionKey(securityLevel: SecurityLevel): Promise<CommunicationKey> {
    // Find appropriate key for security level
    for (const key of this.communicationKeys.values()) {
      if (key.purpose === 'encryption' && this.isSecurityLevelCompatible(key.securityLevel, securityLevel)) {
        return key;
      }
    }
    
    throw new Error(`No suitable encryption key found for security level: ${securityLevel}`);
  }

  private async getSigningKey(securityLevel: SecurityLevel): Promise<CommunicationKey> {
    // For now, use the same key for signing and encryption
    return this.getEncryptionKey(securityLevel);
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  private generateSessionId(): string {
    return `sess-${Date.now()}-${randomBytes(12).toString('hex')}`;
  }

  private determineCommunicationMode(from: AgentId, to: AgentId | AgentId[]): CommunicationMode {
    if (Array.isArray(to)) {
      return CommunicationMode.BROADCAST;
    }
    
    if (from.includes('orchestration') || to.includes('orchestration')) {
      return CommunicationMode.ORCHESTRATED;
    }
    
    return CommunicationMode.DIRECT;
  }

  private async checkRateLimit(nodeId: AgentId): Promise<void> {
    if (!this.config.rateLimiting.enabled) {
      return;
    }
    
    const now = Date.now();
    const rate = this.messageRates.get(nodeId) || { count: 0, lastReset: now };
    
    // Reset counter if window has passed
    if (now - rate.lastReset > 1000) { // 1 second window
      rate.count = 0;
      rate.lastReset = now;
    }
    
    rate.count++;
    this.messageRates.set(nodeId, rate);
    
    if (rate.count > this.config.rateLimiting.maxMessagesPerSecond) {
      throw new Error(`Rate limit exceeded for node ${nodeId}`);
    }
  }

  private async performAuthenticationHandshake(
    peerId: AgentId,
    securityLevel: SecurityLevel
  ): Promise<{ success: boolean; permissions?: Permission[]; error?: string }> {
    try {
      // This would perform actual authentication with the peer
      // For now, return a mock successful authentication
      const permissions: Permission[] = [
        'read_data',
        'write_data',
        'execute_tasks'
      ];
      
      if (securityLevel === SecurityLevel.SECRET || securityLevel === SecurityLevel.TOP_SECRET) {
        permissions.push('coordinate_satellites', 'access_telemetry');
      }
      
      return { success: true, permissions };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private isSecurityLevelAuthorized(sessionLevel: SecurityLevel, messageLevel: SecurityLevel): boolean {
    const levelHierarchy = {
      [SecurityLevel.PUBLIC]: 0,
      [SecurityLevel.INTERNAL]: 1,
      [SecurityLevel.CONFIDENTIAL]: 2,
      [SecurityLevel.SECRET]: 3,
      [SecurityLevel.TOP_SECRET]: 4
    };
    
    return levelHierarchy[sessionLevel] >= levelHierarchy[messageLevel];
  }

  private isSecurityLevelCompatible(keyLevel: SecurityLevel, messageLevel: SecurityLevel): boolean {
    return this.isSecurityLevelAuthorized(keyLevel, messageLevel);
  }

  /**
   * Get protocol status and metrics
   */
  getStatus() {
    return {
      nodeId: this.config.nodeId,
      securityLevel: this.config.securityLevel,
      activeSessions: this.activeSessions.size,
      activeKeys: this.communicationKeys.size,
      config: {
        encryption: this.config.encryption.algorithm,
        authentication: this.config.authentication.method,
        rateLimiting: this.config.rateLimiting.enabled
      },
      metrics: {
        messagesProcessed: this.messageRates.size,
        lastKeyRotation: new Date(),
        sessionCount: this.activeSessions.size
      }
    };
  }
}