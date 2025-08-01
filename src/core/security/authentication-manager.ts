/**
 * YieldSensei Authentication Manager
 * Task 45.4: Security and Cloud-Native Deployment Capabilities
 * 
 * Handles satellite node authentication, authorization, and identity management
 */

import { EventEmitter } from 'events';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';
import { EncryptionManager } from './encryption-manager';

const logger = Logger.getLogger('authentication-manager');

/**
 * Authentication Method
 */
export type AuthMethod = 'certificate' | 'hmac' | 'jwt' | 'mutual-tls' | 'psk';

/**
 * Role Permissions
 */
export type Permission = 
  | 'read_data'
  | 'write_data'
  | 'execute_tasks'
  | 'manage_nodes'
  | 'coordinate_satellites'
  | 'access_telemetry'
  | 'emergency_override'
  | 'system_admin';

/**
 * Authentication Credential
 */
export interface AuthCredential {
  id: string;
  nodeId: AgentId;
  method: AuthMethod;
  credentialData: Buffer | string;
  metadata: {
    issuer: string;
    issuedAt: Date;
    expiresAt?: Date;
    purpose: string;
    securityLevel: 'low' | 'medium' | 'high' | 'classified';
  };
}

/**
 * Node Identity
 */
export interface NodeIdentity {
  nodeId: AgentId;
  role: 'satellite' | 'ground_station' | 'cloud_controller' | 'orchestrator';
  permissions: Set<Permission>;
  attributes: {
    region?: string;
    organization: string;
    securityClearance: string;
    capabilities: string[];
  };
  credentials: Map<AuthMethod, AuthCredential>;
  status: 'active' | 'suspended' | 'revoked' | 'pending';
  lastAuthenticated?: Date;
  failedAttempts: number;
}

/**
 * Authentication Request
 */
export interface AuthRequest {
  id: string;
  nodeId: AgentId;
  method: AuthMethod;
  credentials: any;
  requestedPermissions: Permission[];
  metadata: {
    timestamp: Date;
    sourceIp?: string;
    userAgent?: string;
    sessionId?: string;
  };
}

/**
 * Authentication Response
 */
export interface AuthResponse {
  requestId: string;
  success: boolean;
  nodeId: AgentId;
  sessionToken?: string;
  permissions: Permission[];
  expiresAt?: Date;
  metadata: {
    method: AuthMethod;
    timestamp: Date;
    sessionId?: string;
  };
  error?: string;
}

/**
 * Session Token
 */
export interface SessionToken {
  id: string;
  nodeId: AgentId;
  permissions: Set<Permission>;
  issuedAt: Date;
  expiresAt: Date;
  lastUsed: Date;
  metadata: {
    method: AuthMethod;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Authentication Manager Configuration
 */
export interface AuthConfig {
  nodeId: AgentId;
  defaultSessionDuration: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
  tokenRefreshWindow: number;
  enableMutualAuthentication: boolean;
  certificateValidation: {
    enableCRL: boolean;
    enableOCSP: boolean;
    requireCAVerification: boolean;
  };
  passwordPolicy: {
    minLength: number;
    requireSpecialChars: boolean;
    requireNumbers: boolean;
    requireUppercase: boolean;
  };
  rateLimiting: {
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    banDuration: number;
  };
}

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  nodeId: 'unknown',
  defaultSessionDuration: 8 * 60 * 60 * 1000, // 8 hours
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  tokenRefreshWindow: 30 * 60 * 1000, // 30 minutes
  enableMutualAuthentication: true,
  certificateValidation: {
    enableCRL: true,
    enableOCSP: true,
    requireCAVerification: true,
  },
  passwordPolicy: {
    minLength: 12,
    requireSpecialChars: true,
    requireNumbers: true,
    requireUppercase: true,
  },
  rateLimiting: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    banDuration: 60 * 60 * 1000, // 1 hour
  },
};

/**
 * Authentication Statistics
 */
export interface AuthStats {
  totalAuthRequests: number;
  successfulAuths: number;
  failedAuths: number;
  activeSessions: number;
  revokedSessions: number;
  lockedNodes: number;
  rateLimitedRequests: number;
  authsByMethod: Map<AuthMethod, number>;
  authsByRole: Map<string, number>;
  averageAuthTime: number;
}

/**
 * Authentication Manager
 * Manages node authentication, authorization, and session management
 */
export class AuthenticationManager extends EventEmitter {
  private config: AuthConfig;
  private encryptionManager?: EncryptionManager;
  
  // Identity and credential storage
  private nodeIdentities: Map<AgentId, NodeIdentity> = new Map();
  private sessions: Map<string, SessionToken> = new Map();
  private lockouts: Map<AgentId, Date> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: Date }> = new Map();
  
  // Timers
  private cleanupTimer?: NodeJS.Timeout;
  private sessionReaperTimer?: NodeJS.Timeout;
  
  // State
  private isRunning: boolean = false;
  private requestSequence: number = 0;
  
  // Statistics
  private stats: AuthStats = {
    totalAuthRequests: 0,
    successfulAuths: 0,
    failedAuths: 0,
    activeSessions: 0,
    revokedSessions: 0,
    lockedNodes: 0,
    rateLimitedRequests: 0,
    authsByMethod: new Map(),
    authsByRole: new Map(),
    averageAuthTime: 0,
  };

  constructor(config: AuthConfig = DEFAULT_AUTH_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Set encryption manager for secure operations
   */
  setEncryptionManager(encryptionManager: EncryptionManager): void {
    this.encryptionManager = encryptionManager;
  }

  /**
   * Start the authentication manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Authentication manager already running');
      return;
    }

    try {
      logger.info('Starting authentication manager...');

      // Register self node
      await this.registerSelfNode();

      // Start session reaper
      this.startSessionReaper();

      // Start cleanup timer
      this.startCleanup();

      this.isRunning = true;
      logger.info('Authentication manager started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start authentication manager:', error);
      throw error;
    }
  }

  /**
   * Stop the authentication manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping authentication manager...');

    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete this.cleanupTimer;
    }

    if (this.sessionReaperTimer) {
      clearInterval(this.sessionReaperTimer);
      delete this.sessionReaperTimer;
    }

    // Revoke all active sessions
    await this.revokeAllSessions();

    this.isRunning = false;
    logger.info('Authentication manager stopped');
    this.emit('stopped');
  }

  /**
   * Register a new node identity
   */
  async registerNodeIdentity(
    nodeId: AgentId,
    role: NodeIdentity['role'],
    permissions: Permission[],
    attributes: NodeIdentity['attributes']
  ): Promise<NodeIdentity> {
    const identity: NodeIdentity = {
      nodeId,
      role,
      permissions: new Set(permissions),
      attributes,
      credentials: new Map(),
      status: 'pending',
      failedAttempts: 0,
    };

    this.nodeIdentities.set(nodeId, identity);

    logger.info(`Registered node identity ${nodeId} with role ${role}`);
    this.emit('node_registered', identity);

    return identity;
  }

  /**
   * Add credential to node identity
   */
  async addCredential(
    nodeId: AgentId,
    method: AuthMethod,
    credentialData: Buffer | string,
    options?: {
      purpose?: string;
      expiresIn?: number;
      securityLevel?: 'low' | 'medium' | 'high' | 'classified';
    }
  ): Promise<AuthCredential> {
    const identity = this.nodeIdentities.get(nodeId);
    if (!identity) {
      throw new Error(`Node identity ${nodeId} not found`);
    }

    const credential: AuthCredential = {
      id: `cred-${nodeId}-${method}-${Date.now()}`,
      nodeId,
      method,
      credentialData,
      metadata: {
        issuer: this.config.nodeId,
        issuedAt: new Date(),
        expiresAt: options?.expiresIn ? new Date(Date.now() + options.expiresIn) : undefined,
        purpose: options?.purpose || 'authentication',
        securityLevel: options?.securityLevel || 'medium',
      },
    };

    identity.credentials.set(method, credential);

    logger.info(`Added ${method} credential for node ${nodeId}`);
    this.emit('credential_added', { nodeId, method, credentialId: credential.id });

    return credential;
  }

  /**
   * Authenticate node request
   */
  async authenticate(request: AuthRequest): Promise<AuthResponse> {
    const startTime = Date.now();
    this.stats.totalAuthRequests++;

    try {
      // Rate limiting check
      if (!this.checkRateLimit(request)) {
        this.stats.rateLimitedRequests++;
        return this.createErrorResponse(request, 'Rate limit exceeded');
      }

      // Check if node is locked out
      if (this.isNodeLockedOut(request.nodeId)) {
        return this.createErrorResponse(request, 'Node is locked out due to failed attempts');
      }

      // Get node identity
      const identity = this.nodeIdentities.get(request.nodeId);
      if (!identity || identity.status !== 'active') {
        this.recordFailedAttempt(request.nodeId);
        return this.createErrorResponse(request, 'Invalid node identity or inactive status');
      }

      // Validate credentials
      const credentialValid = await this.validateCredentials(identity, request);
      if (!credentialValid) {
        this.recordFailedAttempt(request.nodeId);
        return this.createErrorResponse(request, 'Invalid credentials');
      }

      // Check permissions
      const hasPermissions = this.checkPermissions(identity, request.requestedPermissions);
      if (!hasPermissions) {
        return this.createErrorResponse(request, 'Insufficient permissions');
      }

      // Generate session token
      const sessionToken = await this.generateSessionToken(identity, request);

      // Reset failed attempts
      identity.failedAttempts = 0;
      identity.lastAuthenticated = new Date();

      // Update statistics
      this.stats.successfulAuths++;
      this.stats.activeSessions++;
      this.updateAuthStatsByMethod(request.method, 1);
      this.updateAuthStatsByRole(identity.role, 1);
      
      const authTime = Date.now() - startTime;
      this.updateAverageAuthTime(authTime);

      const response: AuthResponse = {
        requestId: request.id,
        success: true,
        nodeId: request.nodeId,
        sessionToken: sessionToken.id,
        permissions: Array.from(identity.permissions),
        expiresAt: sessionToken.expiresAt,
        metadata: {
          method: request.method,
          timestamp: new Date(),
          sessionId: sessionToken.id,
        },
      };

      logger.info(`Authenticated node ${request.nodeId} using ${request.method} in ${authTime}ms`);
      this.emit('node_authenticated', { identity, sessionToken, request });

      return response;

    } catch (error) {
      this.stats.failedAuths++;
      logger.error(`Authentication failed for node ${request.nodeId}:`, error);
      return this.createErrorResponse(request, error instanceof Error ? error.message : 'Authentication failed');
    }
  }

  /**
   * Validate session token
   */
  validateSession(tokenId: string, requiredPermissions?: Permission[]): SessionToken | null {
    const session = this.sessions.get(tokenId);
    
    if (!session) {
      logger.debug(`Session ${tokenId} not found`);
      return null;
    }

    // Check expiration
    if (session.expiresAt <= new Date()) {
      logger.debug(`Session ${tokenId} has expired`);
      this.revokeSession(tokenId);
      return null;
    }

    // Check permissions
    if (requiredPermissions && !this.sessionHasPermissions(session, requiredPermissions)) {
      logger.debug(`Session ${tokenId} lacks required permissions`);
      return null;
    }

    // Update last used
    session.lastUsed = new Date();

    return session;
  }

  /**
   * Revoke session token
   */
  async revokeSession(tokenId: string): Promise<boolean> {
    const session = this.sessions.get(tokenId);
    if (!session) {
      return false;
    }

    this.sessions.delete(tokenId);
    this.stats.activeSessions--;
    this.stats.revokedSessions++;

    logger.info(`Revoked session ${tokenId} for node ${session.nodeId}`);
    this.emit('session_revoked', { sessionId: tokenId, nodeId: session.nodeId });

    return true;
  }

  /**
   * Refresh session token
   */
  async refreshSession(tokenId: string): Promise<SessionToken | null> {
    const session = this.sessions.get(tokenId);
    if (!session) {
      return null;
    }

    // Check if within refresh window
    const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry > this.config.tokenRefreshWindow) {
      return session; // No need to refresh yet
    }

    // Extend session
    session.expiresAt = new Date(Date.now() + this.config.defaultSessionDuration);
    session.lastUsed = new Date();

    logger.debug(`Refreshed session ${tokenId} for node ${session.nodeId}`);
    this.emit('session_refreshed', { sessionId: tokenId, nodeId: session.nodeId });

    return session;
  }

  /**
   * Get node identity
   */
  getNodeIdentity(nodeId: AgentId): NodeIdentity | null {
    return this.nodeIdentities.get(nodeId) || null;
  }

  /**
   * Update node permissions
   */
  updateNodePermissions(nodeId: AgentId, permissions: Permission[]): boolean {
    const identity = this.nodeIdentities.get(nodeId);
    if (!identity) {
      return false;
    }

    identity.permissions = new Set(permissions);

    logger.info(`Updated permissions for node ${nodeId}: ${permissions.join(', ')}`);
    this.emit('permissions_updated', { nodeId, permissions });

    return true;
  }

  /**
   * Lock node due to security violations
   */
  lockNode(nodeId: AgentId, duration?: number): void {
    const lockDuration = duration || this.config.lockoutDuration;
    const unlockTime = new Date(Date.now() + lockDuration);
    
    this.lockouts.set(nodeId, unlockTime);
    this.stats.lockedNodes++;

    // Revoke all active sessions for this node
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.nodeId === nodeId) {
        this.revokeSession(sessionId);
      }
    }

    logger.warn(`Locked node ${nodeId} until ${unlockTime.toISOString()}`);
    this.emit('node_locked', { nodeId, unlockTime });
  }

  /**
   * Unlock node
   */
  unlockNode(nodeId: AgentId): boolean {
    const removed = this.lockouts.delete(nodeId);
    if (removed) {
      this.stats.lockedNodes--;
      
      // Reset failed attempts
      const identity = this.nodeIdentities.get(nodeId);
      if (identity) {
        identity.failedAttempts = 0;
      }

      logger.info(`Unlocked node ${nodeId}`);
      this.emit('node_unlocked', { nodeId });
    }
    return removed;
  }

  /**
   * Get authentication statistics
   */
  getStats(): AuthStats {
    return {
      ...this.stats,
      authsByMethod: new Map(this.stats.authsByMethod),
      authsByRole: new Map(this.stats.authsByRole),
    };
  }

  /**
   * Register self node identity
   */
  private async registerSelfNode(): Promise<void> {
    await this.registerNodeIdentity(
      this.config.nodeId,
      'orchestrator',
      ['system_admin', 'manage_nodes', 'coordinate_satellites', 'emergency_override'],
      {
        organization: 'YieldSensei',
        securityClearance: 'high',
        capabilities: ['authentication', 'coordination', 'management'],
      }
    );

    // Add default credential
    await this.addCredential(
      this.config.nodeId,
      'hmac',
      randomBytes(32),
      { purpose: 'self_auth', securityLevel: 'high' }
    );

    // Activate self
    const selfIdentity = this.nodeIdentities.get(this.config.nodeId)!;
    selfIdentity.status = 'active';
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(request: AuthRequest): boolean {
    const key = request.metadata.sourceIp || request.nodeId;
    const now = new Date();
    
    const limit = this.rateLimits.get(key);
    if (!limit || limit.resetTime <= now) {
      this.rateLimits.set(key, { count: 1, resetTime: new Date(now.getTime() + 60000) });
      return true;
    }

    if (limit.count >= this.config.rateLimiting.maxRequestsPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Check if node is locked out
   */
  private isNodeLockedOut(nodeId: AgentId): boolean {
    const unlockTime = this.lockouts.get(nodeId);
    if (!unlockTime) {
      return false;
    }

    if (unlockTime <= new Date()) {
      this.lockouts.delete(nodeId);
      this.stats.lockedNodes--;
      return false;
    }

    return true;
  }

  /**
   * Validate credentials based on method
   */
  private async validateCredentials(identity: NodeIdentity, request: AuthRequest): Promise<boolean> {
    const credential = identity.credentials.get(request.method);
    if (!credential) {
      return false;
    }

    // Check credential expiration
    if (credential.metadata.expiresAt && credential.metadata.expiresAt <= new Date()) {
      return false;
    }

    switch (request.method) {
      case 'hmac':
        return this.validateHMACCredential(credential, request);
      case 'certificate':
        return this.validateCertificateCredential(credential, request);
      case 'psk':
        return this.validatePSKCredential(credential, request);
      default:
        logger.warn(`Unsupported authentication method: ${request.method}`);
        return false;
    }
  }

  /**
   * Validate HMAC credential
   */
  private validateHMACCredential(credential: AuthCredential, request: AuthRequest): boolean {
    if (typeof credential.credentialData !== 'string' && !Buffer.isBuffer(credential.credentialData)) {
      return false;
    }

    const key = Buffer.isBuffer(credential.credentialData) ? credential.credentialData : Buffer.from(credential.credentialData, 'hex');
    const expectedHmac = createHmac('sha256', key)
      .update(JSON.stringify({
        nodeId: request.nodeId,
        timestamp: request.metadata.timestamp.toISOString(),
        nonce: request.credentials.nonce,
      }))
      .digest('hex');

    return timingSafeEqual(Buffer.from(expectedHmac, 'hex'), Buffer.from(request.credentials.hmac, 'hex'));
  }

  /**
   * Validate certificate credential
   */
  private validateCertificateCredential(credential: AuthCredential, request: AuthRequest): boolean {
    // Simplified certificate validation
    // In production, would verify certificate chain, CRL, OCSP, etc.
    return typeof request.credentials.certificate === 'string' && 
           request.credentials.certificate.length > 0;
  }

  /**
   * Validate PSK credential
   */
  private validatePSKCredential(credential: AuthCredential, request: AuthRequest): boolean {
    if (typeof credential.credentialData !== 'string' && !Buffer.isBuffer(credential.credentialData)) {
      return false;
    }

    const expectedPSK = Buffer.isBuffer(credential.credentialData) ? 
      credential.credentialData.toString('hex') : credential.credentialData;

    return timingSafeEqual(Buffer.from(expectedPSK, 'hex'), Buffer.from(request.credentials.psk, 'hex'));
  }

  /**
   * Check if identity has required permissions
   */
  private checkPermissions(identity: NodeIdentity, requestedPermissions: Permission[]): boolean {
    return requestedPermissions.every(permission => identity.permissions.has(permission));
  }

  /**
   * Check if session has required permissions
   */
  private sessionHasPermissions(session: SessionToken, requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(permission => session.permissions.has(permission));
  }

  /**
   * Generate session token
   */
  private async generateSessionToken(identity: NodeIdentity, request: AuthRequest): Promise<SessionToken> {
    const sessionToken: SessionToken = {
      id: `session-${this.config.nodeId}-${++this.requestSequence}-${Date.now()}`,
      nodeId: identity.nodeId,
      permissions: new Set(identity.permissions),
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.defaultSessionDuration),
      lastUsed: new Date(),
      metadata: {
        method: request.method,
        ipAddress: request.metadata.sourceIp,
        userAgent: request.metadata.userAgent,
      },
    };

    this.sessions.set(sessionToken.id, sessionToken);
    return sessionToken;
  }

  /**
   * Record failed authentication attempt
   */
  private recordFailedAttempt(nodeId: AgentId): void {
    const identity = this.nodeIdentities.get(nodeId);
    if (identity) {
      identity.failedAttempts++;
      
      if (identity.failedAttempts >= this.config.maxFailedAttempts) {
        this.lockNode(nodeId);
      }
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(request: AuthRequest, error: string): AuthResponse {
    this.stats.failedAuths++;
    
    return {
      requestId: request.id,
      success: false,
      nodeId: request.nodeId,
      permissions: [],
      metadata: {
        method: request.method,
        timestamp: new Date(),
      },
      error,
    };
  }

  /**
   * Start session reaper to clean up expired sessions
   */
  private startSessionReaper(): void {
    this.sessionReaperTimer = setInterval(() => {
      this.reapExpiredSessions();
    }, 60000); // Run every minute
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredLockouts();
      this.cleanupRateLimits();
    }, 300000); // Run every 5 minutes
  }

  /**
   * Reap expired sessions
   */
  private reapExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.revokeSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.debug(`Reaped ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Clean up expired lockouts
   */
  private cleanupExpiredLockouts(): void {
    const now = new Date();
    const expiredLockouts: AgentId[] = [];

    for (const [nodeId, unlockTime] of this.lockouts.entries()) {
      if (unlockTime <= now) {
        expiredLockouts.push(nodeId);
      }
    }

    for (const nodeId of expiredLockouts) {
      this.unlockNode(nodeId);
    }
  }

  /**
   * Clean up expired rate limits
   */
  private cleanupRateLimits(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, limit] of this.rateLimits.entries()) {
      if (limit.resetTime <= now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.rateLimits.delete(key);
    }
  }

  /**
   * Revoke all sessions
   */
  private async revokeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.revokeSession(sessionId);
    }
    logger.info(`Revoked ${sessionIds.length} active sessions`);
  }

  /**
   * Update authentication statistics by method
   */
  private updateAuthStatsByMethod(method: AuthMethod, delta: number): void {
    const current = this.stats.authsByMethod.get(method) || 0;
    this.stats.authsByMethod.set(method, current + delta);
  }

  /**
   * Update authentication statistics by role
   */
  private updateAuthStatsByRole(role: string, delta: number): void {
    const current = this.stats.authsByRole.get(role) || 0;
    this.stats.authsByRole.set(role, current + delta);
  }

  /**
   * Update average authentication time
   */
  private updateAverageAuthTime(authTime: number): void {
    const currentAvg = this.stats.averageAuthTime;
    const totalAuths = this.stats.successfulAuths;
    this.stats.averageAuthTime = ((currentAvg * (totalAuths - 1)) + authTime) / totalAuths;
  }
}