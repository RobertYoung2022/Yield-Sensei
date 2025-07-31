/**
 * Decentralized Authentication Service
 * Handles DID-based authentication, wallet connections, and session management
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  DecentralizedUser,
  DecentralizedAuthSession,
  CrossChainIdentity,
  SessionCapability,
  SessionProof
} from '../../compliance/types/decentralized-types';
import {
  DecentralizedIdentityService
} from '../types';

const logger = Logger.getLogger('decentralized-auth');

export interface WalletConnectionRequest {
  walletAddress: string;
  chainId: number;
  signature: string;
  message: string;
  timestamp: number;
}

export interface DIDAuthRequest {
  did: string;
  challenge: string;
  proof: string;
  verificationMethod: string;
  timestamp: number;
}

export interface AuthenticationResult {
  success: boolean;
  user?: DecentralizedUser;
  session?: DecentralizedAuthSession;
  error?: string;
  requiresSetup?: boolean;
  setupSteps?: string[];
}

export interface SessionValidationResult {
  valid: boolean;
  session?: DecentralizedAuthSession;
  user?: DecentralizedUser;
  capabilities: SessionCapability[];
  error?: string;
}

export class DecentralizedAuthService extends EventEmitter {
  private identityService: DecentralizedIdentityService;
  private activeSessions: Map<string, DecentralizedAuthSession> = new Map();
  private userCache: Map<string, DecentralizedUser> = new Map();
  private challengeStore: Map<string, { challenge: string; timestamp: number; used: boolean }> = new Map();
  private isInitialized = false;

  constructor(identityService: DecentralizedIdentityService) {
    super();
    this.identityService = identityService;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Decentralized Auth Service already initialized');
      return;
    }

    try {
      logger.info('Initializing Decentralized Auth Service...');

      // Set up session cleanup
      setInterval(() => this.cleanupExpiredSessions(), 60 * 1000); // Every minute

      // Set up challenge cleanup
      setInterval(() => this.cleanupExpiredChallenges(), 5 * 60 * 1000); // Every 5 minutes

      this.isInitialized = true;
      logger.info('✅ Decentralized Auth Service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Decentralized Auth Service:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with wallet signature
   */
  async authenticateWithWallet(request: WalletConnectionRequest): Promise<AuthenticationResult> {
    try {
      logger.info('Authenticating with wallet', {
        walletAddress: request.walletAddress,
        chainId: request.chainId
      });

      // Verify signature
      const signatureValid = await this.verifyWalletSignature(request);
      if (!signatureValid) {
        return {
          success: false,
          error: 'Invalid wallet signature'
        };
      }

      // Check if user exists
      const did = await this.walletAddressToDID(request.walletAddress);
      let user = await this.getUserByDID(did);

      if (!user) {
        // New user - needs to set up decentralized identity
        return {
          success: false,
          requiresSetup: true,
          setupSteps: [
            'Create decentralized identity',
            'Set up proof of personhood',
            'Complete KYC verification',
            'Configure privacy settings'
          ]
        };
      }

      // Create session
      const session = await this.createSession(user, {
        type: 'wallet-signature',
        challenge: request.message,
        response: request.signature,
        timestamp: new Date(request.timestamp),
        signature: request.signature
      });

      logger.info('Wallet authentication successful', {
        did: user.did,
        sessionId: session.sessionId
      });

      this.emit('authentication_success', {
        did: user.did,
        method: 'wallet',
        sessionId: session.sessionId,
        timestamp: new Date()
      });

      return {
        success: true,
        user,
        session
      };

    } catch (error) {
      logger.error('Error authenticating with wallet:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Authenticate user with DID
   */
  async authenticateWithDID(request: DIDAuthRequest): Promise<AuthenticationResult> {
    try {
      logger.info('Authenticating with DID', { did: request.did });

      // Verify DID is valid
      const didVerification = await this.identityService.verifyDID(request.did, {
        type: 'did-auth',
        challenge: request.challenge,
        response: request.proof,
        timestamp: new Date(request.timestamp),
        signature: request.proof
      });
      if (!didVerification) {
        return {
          success: false,
          error: 'Invalid DID'
        };
      }

      // Verify DID auth proof
      const proofValid = await this.verifyDIDProof(request);
      if (!proofValid) {
        return {
          success: false,
          error: 'Invalid DID authentication proof'
        };
      }

      // Get user
      const user = await this.getUserByDID(request.did);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Create session
      const session = await this.createSession(user, {
        type: 'did-auth',
        challenge: request.challenge,
        response: request.proof,
        timestamp: new Date(request.timestamp),
        signature: request.proof
      });

      logger.info('DID authentication successful', {
        did: user.did,
        sessionId: session.sessionId
      });

      this.emit('authentication_success', {
        did: user.did,
        method: 'did',
        sessionId: session.sessionId,
        timestamp: new Date()
      });

      return {
        success: true,
        user,
        session
      };

    } catch (error) {
      logger.error('Error authenticating with DID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Set up new decentralized user
   */
  async setupDecentralizedUser(
    walletAddress: string,
    preferences: {
      privacyLevel: 'minimal' | 'balanced' | 'maximum';
      dataSharing: boolean;
      anonymousMode: boolean;
    }
  ): Promise<{ user: DecentralizedUser; setupInstructions: string[] }> {
    try {
      logger.info('Setting up new decentralized user', { walletAddress });

      // Create DID
      const did = await this.walletAddressToDID(walletAddress);

      // Create decentralized identity
      const identity = await this.identityService.createDecentralizedIdentity(did, walletAddress);

      // Create user profile
      const user: DecentralizedUser = {
        did,
        walletAddress: walletAddress.toLowerCase(),
        authenticationMethod: 'decentralized',
        decentralizedIdentity: {
          did,
          didDocument: identity.didDocument,
          verifiableCredentials: [],
          zkProofs: [],
          biometricHashes: [],
          reputation: {
            overallScore: 100,
            transactionReputation: 50,
            communityReputation: 0,
            verificationReputation: 50,
            complianceReputation: 50,
            timeReputation: 0,
            endorsements: [],
            attestations: [],
            stakedTokens: 0,
            stakingHistory: [],
            lastUpdated: new Date()
          },
          crossChainIdentities: [],
          privacySettings: {
            dataMinimization: true,
            anonymousMode: false,
            selectiveDisclosure: {
              age: 'none',
              jurisdiction: 'category',
              income: 'none',
              identity: 'pseudonymous'
            },
            dataSharing: {
              analytics: false,
              compliance: true,
              research: false,
              marketing: false
            },
            credentialRevocation: {
              automatic: true,
              notificationRequired: true,
              gracePeriod: 30
            }
          }
        },
        kycStatus: {
          level: 'basic',
          verified: false,
          confidence: 0,
          verificationMethod: 'self-sovereign',
          proofOfPersonhood: false,
          communityAttestations: 0,
          zkProofCount: 0,
          biometricVerified: false,
          reputationScore: 100,
          lastVerification: new Date(),
          violations: []
        },
        complianceLevel: {
          overall: 'pending',
          categories: {},
          riskLevel: 'medium',
          automatedApproval: false,
          manualReviewRequired: true
        },
        profile: {
          zkProofs: {}
        },
        reputation: {
          overallScore: 100,
          transactionReputation: 50,
          communityReputation: 0,
          verificationReputation: 50,
          complianceReputation: 50,
          timeReputation: 0,
          endorsements: [],
          attestations: [],
          stakedTokens: 0,
          stakingHistory: [],
          lastUpdated: new Date()
        },
        socialGraph: {
          connectionCount: 0,
          verifiedConnections: 0,
          mutualConnections: 0,
          daoMemberships: [],
          communityRoles: [],
          socialProofs: [],
          crossReferenceCount: 0,
          networkScore: 0,
          influenceScore: 0,
          trustScore: 0
        },
        activityLevel: 'retail',
        restrictions: [],
        createdAt: new Date(),
        lastActive: new Date(),
        lastVerification: new Date()
      };

      // Apply privacy preferences
      this.applyPrivacyPreferences(user, preferences);

      // Cache user
      this.userCache.set(did, user);

      const setupInstructions = [
        'Complete proof of personhood verification',
        'Set up community attestations',
        'Configure social recovery options',
        'Complete initial KYC verification',
        'Set reputation staking preferences'
      ];

      logger.info('Decentralized user setup completed', { did });

      this.emit('user_created', {
        did,
        walletAddress,
        timestamp: new Date()
      });

      return { user, setupInstructions };

    } catch (error) {
      logger.error('Error setting up decentralized user:', error);
      throw error;
    }
  }

  /**
   * Validate session and get user capabilities
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          valid: false,
          capabilities: [],
          error: 'Session not found'
        };
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        this.activeSessions.delete(sessionId);
        return {
          valid: false,
          capabilities: [],
          error: 'Session expired'
        };
      }

      // Check if session is revoked
      if (session.revoked) {
        return {
          valid: false,
          capabilities: [],
          error: 'Session revoked'
        };
      }

      // Get user
      const user = this.userCache.get(session.did);
      if (!user) {
        return {
          valid: false,
          capabilities: [],
          error: 'User not found'
        };
      }

      // Update last activity
      session.lastActivity = new Date();

      // Get current capabilities
      const capabilities = this.getUserCapabilities(user, session);

      return {
        valid: true,
        session,
        user,
        capabilities
      };

    } catch (error) {
      logger.error('Error validating session:', error);
      return {
        valid: false,
        capabilities: [],
        error: 'Session validation failed'
      };
    }
  }

  /**
   * Generate authentication challenge
   */
  generateChallenge(walletAddress: string): string {
    const challenge = `YieldSensei authentication challenge for ${walletAddress} at ${Date.now()}`;
    const challengeId = this.generateChallengeId();
    
    this.challengeStore.set(challengeId, {
      challenge,
      timestamp: Date.now(),
      used: false
    });

    return challenge;
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string, reason: string = 'User logout'): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.revoked = true;
      session.revokedAt = new Date();
      session.revokeReason = reason;

      logger.info('Session revoked', {
        sessionId,
        did: session.did,
        reason
      });

      this.emit('session_revoked', {
        sessionId,
        did: session.did,
        reason,
        timestamp: new Date()
      });
    }
  }

  /**
   * Link cross-chain identity
   */
  async linkCrossChainIdentity(
    did: string,
    chainIdentity: Omit<CrossChainIdentity, 'linkedAt' | 'verified'>
  ): Promise<void> {
    try {
      const user = this.userCache.get(did);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify chain identity
      const verified = await this.verifyCrossChainIdentity(chainIdentity);

      const crossChainIdentity: CrossChainIdentity = {
        ...chainIdentity,
        verified,
        linkedAt: new Date()
      };

      user.decentralizedIdentity.crossChainIdentities.push(crossChainIdentity);

      logger.info('Cross-chain identity linked', {
        did,
        chain: chainIdentity['chain'],
        address: chainIdentity['address'],
        verified
      });

      this.emit('cross_chain_linked', {
        did,
        chainIdentity: crossChainIdentity,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error linking cross-chain identity:', error);
      throw error;
    }
  }

  /**
   * Get user by wallet address
   */
  async getUserByWalletAddress(walletAddress: string): Promise<DecentralizedUser | null> {
    const did = await this.walletAddressToDID(walletAddress);
    return this.getUserByDID(did);
  }

  /**
   * Get user by DID
   */
  async getUserByDID(did: string): Promise<DecentralizedUser | null> {
    // Check cache first
    const cached = this.userCache.get(did);
    if (cached) {
      return cached;
    }

    // In production, this would query a decentralized storage system
    // For now, return null if not in cache
    return null;
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      activeSessions: this.activeSessions.size,
      cachedUsers: this.userCache.size,
      pendingChallenges: this.challengeStore.size,
      supportedMethods: ['wallet-signature', 'did-auth', 'zk-proof']
    };
  }

  // Private methods

  private async createSession(user: DecentralizedUser, proof: SessionProof): Promise<DecentralizedAuthSession> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session: DecentralizedAuthSession = {
      sessionId,
      did: user.did,
      walletAddress: user.walletAddress,
      proof,
      capabilities: this.getUserCapabilities(user),
      createdAt: new Date(),
      expiresAt,
      lastActivity: new Date(),
      active: true,
      revoked: false
    };

    this.activeSessions.set(sessionId, session);

    this.emit('session_created', {
      sessionId,
      did: user.did,
      timestamp: new Date()
    });

    return session;
  }

  private getUserCapabilities(user: DecentralizedUser, _session?: DecentralizedAuthSession): SessionCapability[] {
    const capabilities: SessionCapability[] = [];

    // Base capabilities for all authenticated users
    capabilities.push(
      {
        action: 'read',
        resource: 'profile'
      },
      {
        action: 'update',
        resource: 'profile'
      }
    );

    // Capabilities based on KYC level
    if (user.kycStatus.verified) {
      capabilities.push({
        action: 'trade',
        resource: 'basic-assets'
      });

      if (user.kycStatus.level === 'enhanced' || user.kycStatus.level === 'professional' || user.kycStatus.level === 'institutional') {
        capabilities.push(
          {
            action: 'trade',
            resource: 'advanced-assets'
          },
          {
            action: 'access',
            resource: 'yield-farming'
          }
        );
      }

      if (user.kycStatus.level === 'institutional') {
        capabilities.push(
          {
            action: 'access',
            resource: 'institutional-features'
          },
          {
            action: 'manage',
            resource: 'large-transactions'
          }
        );
      }
    }

    // Capabilities based on reputation
    if (user.reputation.overallScore > 500) {
      capabilities.push({
        action: 'participate',
        resource: 'governance'
      });
    }

    if (user.reputation.overallScore > 750) {
      capabilities.push({
        action: 'create',
        resource: 'community-proposals'
      });
    }

    // Capabilities based on compliance level
    if (user.complianceLevel.overall === 'compliant') {
      capabilities.push({
        action: 'access',
        resource: 'all-features'
      });
    }

    return capabilities;
  }

  private async verifyWalletSignature(request: WalletConnectionRequest): Promise<boolean> {
    // Mock signature verification
    // In production, this would verify the actual wallet signature
    return request.signature.length > 0 && 
           request.message.includes('YieldSensei') &&
           Math.abs(Date.now() - request.timestamp) < 5 * 60 * 1000; // 5 minute window
  }

  private async verifyDIDProof(request: DIDAuthRequest): Promise<boolean> {
    // Mock DID proof verification
    // In production, this would verify the actual DID authentication proof
    return request.proof.length > 0 && 
           request.challenge.length > 0 &&
           Math.abs(Date.now() - request.timestamp) < 5 * 60 * 1000; // 5 minute window
  }

  private async walletAddressToDID(walletAddress: string): Promise<string> {
    // Convert wallet address to DID
    return `did:ethr:${walletAddress.toLowerCase()}`;
  }

  private applyPrivacyPreferences(
    user: DecentralizedUser, 
    preferences: { privacyLevel: string; dataSharing: boolean; anonymousMode: boolean }
  ): void {
    user.decentralizedIdentity.privacySettings = {
      dataMinimization: preferences.privacyLevel === 'maximum',
      anonymousMode: preferences.anonymousMode,
      selectiveDisclosure: {
        age: preferences.privacyLevel === 'maximum' ? 'threshold' : 'range',
        jurisdiction: preferences.privacyLevel === 'maximum' ? 'category' : 'region',
        income: preferences.privacyLevel === 'maximum' ? 'threshold' : 'range',
        identity: preferences.privacyLevel === 'minimal' ? 'verified' : 'pseudonymous'
      },
      dataSharing: {
        analytics: preferences.dataSharing && preferences.privacyLevel !== 'maximum',
        compliance: true, // Always required for compliance
        research: preferences.dataSharing,
        marketing: preferences.dataSharing && preferences.privacyLevel === 'minimal'
      },
      credentialRevocation: {
        automatic: preferences.privacyLevel === 'maximum',
        notificationRequired: true,
        gracePeriod: preferences.privacyLevel === 'maximum' ? 1 : 7
      }
    };
  }

  private async verifyCrossChainIdentity(chainIdentity: any): Promise<boolean> {
    // Mock cross-chain verification
    // In production, this would verify ownership of the address on the specified chain
    return chainIdentity.address.length > 0 && chainIdentity.chain.length > 0;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now || session.revoked) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [challengeId, challenge] of this.challengeStore.entries()) {
      if (now - challenge.timestamp > maxAge || challenge.used) {
        this.challengeStore.delete(challengeId);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChallengeId(): string {
    return `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}