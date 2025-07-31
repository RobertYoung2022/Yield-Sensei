/**
 * Access Control Manager
 * Role-based access control for service integrations and API endpoints
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  AccessControlPolicy,
  AccessRule,
  AccessCondition,
  SecurityAuditLog,
  AccessControlConfig,
  SecurityEvent
} from './types';

const logger = Logger.getLogger('access-control');

export interface AccessRequest {
  subject: string; // user ID, service ID, or role
  action: string;
  resource: string;
  context?: {
    ipAddress?: string;
    userAgent?: string;
    timestamp?: Date;
    sessionId?: string;
    metadata?: Record<string, any>;
  };
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedPolicies: string[];
  appliedRules: AccessRule[];
  requiresMFA?: boolean;
  rateLimitInfo?: {
    remaining: number;
    resetTime: Date;
  };
}

export class AccessControlManager extends EventEmitter {
  private policies: Map<string, AccessControlPolicy> = new Map();
  private auditLogs: SecurityAuditLog[] = [];
  private config: AccessControlConfig;
  private rateLimits: Map<string, RateLimitState> = new Map();
  private sessions: Map<string, SessionInfo> = new Map();

  constructor(config: AccessControlConfig) {
    super();
    this.config = {
      defaultDeny: true,
      sessionTimeout: 30,
      maxConcurrentSessions: 5,
      mfaRequired: false,
      ipWhitelistEnabled: false,
      geoFencingEnabled: false,
      ...config
    };

    this.startCleanupTasks();
  }

  /**
   * Create or update an access control policy
   */
  async createPolicy(policy: Omit<AccessControlPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const policyId = 'policy_' + Math.random().toString(36).substr(2, 9);
      const now = new Date();

      const fullPolicy: AccessControlPolicy = {
        id: policyId,
        createdAt: now,
        updatedAt: now,
        ...policy
      };

      // Validate policy
      this.validatePolicy(fullPolicy);

      this.policies.set(policyId, fullPolicy);

      await this.auditLog('policy_created', 'success', {
        policyId,
        name: policy.name,
        subjects: policy.subjects,
        resources: policy.resources
      });

      logger.info(`Access control policy created: ${policy.name}`, { policyId });
      this.emit('policy_created', fullPolicy);

      return policyId;
    } catch (error) {
      logger.error(`Failed to create access control policy:`, error);
      throw error;
    }
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(policyId: string, updates: Partial<AccessControlPolicy>): Promise<void> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      const updatedPolicy = {
        ...policy,
        ...updates,
        updatedAt: new Date()
      };

      this.validatePolicy(updatedPolicy);
      this.policies.set(policyId, updatedPolicy);

      await this.auditLog('policy_updated', 'success', {
        policyId,
        updates: Object.keys(updates)
      });

      logger.info(`Access control policy updated: ${policyId}`);
      this.emit('policy_updated', updatedPolicy);
    } catch (error) {
      logger.error(`Failed to update policy ${policyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      this.policies.delete(policyId);

      await this.auditLog('policy_deleted', 'success', { policyId });

      logger.info(`Access control policy deleted: ${policyId}`);
      this.emit('policy_deleted', { policyId });
    } catch (error) {
      logger.error(`Failed to delete policy ${policyId}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate access request
   */
  async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    try {
      const decision: AccessDecision = {
        allowed: false,
        reason: 'Default deny',
        matchedPolicies: [],
        appliedRules: []
      };

      // Check rate limits first
      const rateLimitCheck = await this.checkRateLimit(request);
      if (!rateLimitCheck.allowed) {
        decision.reason = 'Rate limit exceeded';
        decision.rateLimitInfo = rateLimitCheck.rateLimitInfo;
        
        await this.auditLog('rate_limit_exceeded', 'blocked', {
          subject: request.subject,
          action: request.action,
          resource: request.resource,
          rateLimitInfo: rateLimitCheck.rateLimitInfo
        }, request.context);

        return decision;
      }

      // Evaluate policies
      const applicablePolicies = this.findApplicablePolicies(request);
      
      for (const policy of applicablePolicies) {
        const policyDecision = await this.evaluatePolicy(policy, request);
        
        if (policyDecision.matches) {
          decision.matchedPolicies.push(policy.id);
          decision.appliedRules.push(...policyDecision.matchedRules);

          if (policy.effect === 'allow') {
            decision.allowed = true;
            decision.reason = `Allowed by policy: ${policy.name}`;
            
            // Check if MFA is required
            if (this.requiresMFA(policy, request)) {
              decision.requiresMFA = true;
            }
          } else if (policy.effect === 'deny') {
            decision.allowed = false;
            decision.reason = `Denied by policy: ${policy.name}`;
            break; // Deny takes precedence
          }
        }
      }

      // Apply default deny if no explicit allow
      if (!decision.allowed && this.config.defaultDeny) {
        decision.reason = 'No matching allow policy found (default deny)';
      }

      // Log the access decision
      await this.auditLog(
        'access_evaluated',
        decision.allowed ? 'success' : 'blocked',
        {
          subject: request.subject,
          action: request.action,
          resource: request.resource,
          decision: decision.allowed,
          reason: decision.reason,
          matchedPolicies: decision.matchedPolicies
        },
        request.context
      );

      return decision;
    } catch (error) {
      logger.error('Failed to evaluate access request:', error);
      
      await this.auditLog('access_evaluation_error', 'failure', {
        subject: request.subject,
        action: request.action,
        resource: request.resource,
        error: error.message
      }, request.context);

      return {
        allowed: false,
        reason: 'Access evaluation error',
        matchedPolicies: [],
        appliedRules: []
      };
    }
  }

  /**
   * Create or update a user session
   */
  async createSession(userId: string, sessionData: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const sessionId = 'session_' + Math.random().toString(36).substr(2, 16);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeout * 60 * 1000);

    // Check concurrent session limit
    const userSessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);
    if (userSessions.length >= this.config.maxConcurrentSessions) {
      // Remove oldest session
      const oldestSession = userSessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      this.sessions.delete(oldestSession.sessionId);
    }

    const session: SessionInfo = {
      sessionId,
      userId,
      createdAt: now,
      expiresAt,
      lastAccessAt: now,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      metadata: sessionData.metadata,
      isActive: true
    };

    this.sessions.set(sessionId, session);

    await this.auditLog('session_created', 'success', {
      sessionId,
      userId,
      ipAddress: sessionData.ipAddress
    });

    logger.info(`Session created for user: ${userId}`, { sessionId });
    return sessionId;
  }

  /**
   * Validate and refresh a session
   */
  async validateSession(sessionId: string): Promise<SessionInfo | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      session.isActive = false;
      await this.auditLog('session_expired', 'blocked', { sessionId });
      return null;
    }

    // Refresh session
    session.lastAccessAt = new Date();
    session.expiresAt = new Date(Date.now() + this.config.sessionTimeout * 60 * 1000);

    return session;
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      
      await this.auditLog('session_terminated', 'success', { sessionId });
      logger.info(`Session terminated: ${sessionId}`);
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filters?: {
    eventType?: string;
    severity?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): SecurityAuditLog[] {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.eventType) {
        logs = logs.filter(log => log.eventType === filters.eventType);
      }
      if (filters.severity) {
        logs = logs.filter(log => log.severity === filters.severity);
      }
      if (filters.fromDate) {
        logs = logs.filter(log => log.timestamp >= filters.fromDate!);
      }
      if (filters.toDate) {
        logs = logs.filter(log => log.timestamp <= filters.toDate!);
      }
      if (filters.limit) {
        logs = logs.slice(-filters.limit);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): AccessControlPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): AccessControlPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get policies for a subject
   */
  getPoliciesForSubject(subject: string): AccessControlPolicy[] {
    return Array.from(this.policies.values()).filter(policy =>
      policy.subjects.includes(subject) && policy.isActive
    );
  }

  /**
   * Find applicable policies for a request
   */
  private findApplicablePolicies(request: AccessRequest): AccessControlPolicy[] {
    return Array.from(this.policies.values()).filter(policy => {
      if (!policy.isActive) return false;

      // Check if subject matches
      const subjectMatches = policy.subjects.some(subject =>
        this.matchesPattern(request.subject, subject)
      );

      // Check if resource matches
      const resourceMatches = policy.resources.some(resource =>
        this.matchesPattern(request.resource, resource)
      );

      return subjectMatches && resourceMatches;
    });
  }

  /**
   * Evaluate a single policy against a request
   */
  private async evaluatePolicy(policy: AccessControlPolicy, request: AccessRequest): Promise<{
    matches: boolean;
    matchedRules: AccessRule[];
  }> {
    const matchedRules: AccessRule[] = [];

    // Check each rule in the policy
    for (const rule of policy.rules) {
      if (rule.action === request.action || rule.action === '*') {
        const resourceMatches = this.matchesPattern(request.resource, rule.resource);
        
        if (resourceMatches) {
          // Check rule conditions
          if (rule.conditions) {
            const conditionsPass = await this.evaluateConditions(rule.conditions, request);
            if (conditionsPass) {
              matchedRules.push(rule);
            }
          } else {
            matchedRules.push(rule);
          }
        }
      }
    }

    // Check policy-level conditions
    if (policy.conditions && matchedRules.length > 0) {
      const policyConditionsPass = await this.evaluateConditions(policy.conditions, request);
      if (!policyConditionsPass) {
        return { matches: false, matchedRules: [] };
      }
    }

    return {
      matches: matchedRules.length > 0,
      matchedRules
    };
  }

  /**
   * Evaluate access conditions
   */
  private async evaluateConditions(conditions: AccessCondition[], request: AccessRequest): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, request);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(condition: AccessCondition, request: AccessRequest): Promise<boolean> {
    switch (condition.type) {
      case 'time_range':
        return this.evaluateTimeRangeCondition(condition, request);
      
      case 'ip_whitelist':
        return this.evaluateIPWhitelistCondition(condition, request);
      
      case 'rate_limit':
        return this.evaluateRateLimitCondition(condition, request);
      
      case 'geo_location':
        return this.evaluateGeoLocationCondition(condition, request);
      
      case 'custom':
        return this.evaluateCustomCondition(condition, request);
      
      default:
        logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Check rate limits for a request
   */
  private async checkRateLimit(request: AccessRequest): Promise<{
    allowed: boolean;
    rateLimitInfo?: {
      remaining: number;
      resetTime: Date;
    };
  }> {
    const key = `${request.subject}:${request.action}:${request.resource}`;
    const now = Date.now();
    
    let rateLimitState = this.rateLimits.get(key);
    if (!rateLimitState) {
      rateLimitState = {
        count: 0,
        resetTime: new Date(now + 60000), // 1 minute window
        limit: 100 // Default limit
      };
      this.rateLimits.set(key, rateLimitState);
    }

    // Reset if window has passed
    if (now > rateLimitState.resetTime.getTime()) {
      rateLimitState.count = 0;
      rateLimitState.resetTime = new Date(now + 60000);
    }

    rateLimitState.count++;

    return {
      allowed: rateLimitState.count <= rateLimitState.limit,
      rateLimitInfo: {
        remaining: Math.max(0, rateLimitState.limit - rateLimitState.count),
        resetTime: rateLimitState.resetTime
      }
    };
  }

  /**
   * Check if MFA is required
   */
  private requiresMFA(policy: AccessControlPolicy, request: AccessRequest): boolean {
    // Check if global MFA is required
    if (this.config.mfaRequired) {
      return true;
    }

    // Check policy-specific MFA requirements
    return policy.conditions?.some(condition => 
      condition.type === 'custom' && 
      condition.value?.requiresMFA
    ) || false;
  }

  /**
   * Validate policy structure
   */
  private validatePolicy(policy: AccessControlPolicy): void {
    if (!policy.name || policy.name.trim().length === 0) {
      throw new Error('Policy name is required');
    }

    if (!policy.subjects || policy.subjects.length === 0) {
      throw new Error('Policy must have at least one subject');
    }

    if (!policy.resources || policy.resources.length === 0) {
      throw new Error('Policy must have at least one resource');
    }

    if (!policy.rules || policy.rules.length === 0) {
      throw new Error('Policy must have at least one rule');
    }

    if (!['allow', 'deny'].includes(policy.effect)) {
      throw new Error('Policy effect must be either "allow" or "deny"');
    }
  }

  /**
   * Pattern matching with wildcards
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (pattern === '*') return true;
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }

  /**
   * Evaluate time range condition
   */
  private evaluateTimeRangeCondition(condition: AccessCondition, request: AccessRequest): boolean {
    const now = request.context?.timestamp || new Date();
    const timeRange = condition.value;
    
    if (timeRange.start && now < new Date(timeRange.start)) {
      return false;
    }
    
    if (timeRange.end && now > new Date(timeRange.end)) {
      return false;
    }
    
    return true;
  }

  /**
   * Evaluate IP whitelist condition
   */
  private evaluateIPWhitelistCondition(condition: AccessCondition, request: AccessRequest): boolean {
    if (!this.config.ipWhitelistEnabled) {
      return true;
    }
    
    const clientIP = request.context?.ipAddress;
    if (!clientIP) {
      return false;
    }
    
    const allowedIPs = condition.value;
    return Array.isArray(allowedIPs) && allowedIPs.includes(clientIP);
  }

  /**
   * Evaluate rate limit condition
   */
  private evaluateRateLimitCondition(condition: AccessCondition, request: AccessRequest): boolean {
    // Rate limiting is handled separately in checkRateLimit
    return true;
  }

  /**
   * Evaluate geo location condition
   */
  private evaluateGeoLocationCondition(condition: AccessCondition, request: AccessRequest): boolean {
    if (!this.config.geoFencingEnabled) {
      return true;
    }
    
    // Placeholder for geo-location logic
    // In practice, you'd use a geo-IP service
    return true;
  }

  /**
   * Evaluate custom condition
   */
  private evaluateCustomCondition(condition: AccessCondition, request: AccessRequest): boolean {
    // Placeholder for custom condition evaluation
    // Could execute custom scripts or call external services
    return true;
  }

  /**
   * Create audit log entry
   */
  private async auditLog(
    eventType: string,
    result: 'success' | 'failure' | 'blocked',
    details: Record<string, any>,
    context?: AccessRequest['context']
  ): Promise<void> {
    const log: SecurityAuditLog = {
      id: 'audit_' + Math.random().toString(36).substr(2, 16),
      timestamp: new Date(),
      eventType: eventType as any,
      severity: result === 'failure' ? 'high' : result === 'blocked' ? 'medium' : 'low',
      details: {
        action: eventType,
        resource: 'access_control',
        result,
        metadata: details
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      sessionId: context?.sessionId
    };

    this.auditLogs.push(log);
    
    // Keep only recent logs to prevent memory issues
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000);
    }

    this.emit('audit_log', log);
  }

  /**
   * Start cleanup tasks
   */
  private startCleanupTasks(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, session] of this.sessions) {
        if (session.expiresAt < now) {
          this.sessions.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000);

    // Clean up old rate limit states every hour
    setInterval(() => {
      const now = Date.now();
      for (const [key, state] of this.rateLimits) {
        if (now > state.resetTime.getTime() + 60000) {
          this.rateLimits.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.policies.clear();
    this.auditLogs.length = 0;
    this.rateLimits.clear();
    this.sessions.clear();
    this.removeAllListeners();
    
    logger.info('Access control manager cleanup complete');
  }
}

interface RateLimitState {
  count: number;
  resetTime: Date;
  limit: number;
}

interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastAccessAt: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
}