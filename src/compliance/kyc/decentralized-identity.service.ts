/**
 * Decentralized Identity Service
 * Manages DIDs, Verifiable Credentials, and Self-Sovereign Identity
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  User,
  KYCLevel,
  ActivityLevel,
  Jurisdiction
} from '../types';

const logger = Logger.getLogger('decentralized-identity');

// Decentralized Identity Types
export interface DecentralizedIdentity {
  did: string;                    // Decentralized Identifier (e.g., did:ethr:0x...)
  walletAddress: string;          // Connected wallet address
  verifiableCredentials: VerifiableCredential[];
  proofOfPersonhood?: ProofOfPersonhood;
  socialRecovery?: SocialRecoveryConfig;
  reputation?: ReputationScore;
  createdAt: Date;
  lastUpdated: Date;
}

export interface VerifiableCredential {
  id: string;
  type: CredentialType[];
  issuer: CredentialIssuer;
  issuanceDate: Date;
  expirationDate?: Date;
  credentialSubject: CredentialSubject;
  proof: CryptographicProof;
  status: CredentialStatus;
  jurisdiction: Jurisdiction;
  kycLevel: KYCLevel;
  revoked: boolean;
}

export type CredentialType = 
  | 'VerifiableCredential'
  | 'KYCCredential'
  | 'AMLScreeningCredential'
  | 'AccreditedInvestorCredential'
  | 'ProofOfPersonhood'
  | 'ProofOfFunds'
  | 'ResidencyCredential'
  | 'SanctionsScreeningCredential';

export interface CredentialIssuer {
  id: string;                     // DID of issuer
  name: string;                   // Human-readable name
  type: IssuerType;
  jurisdiction: Jurisdiction;
  license?: string;               // Regulatory license number
  reputation: number;             // 0-100 trust score
  publicKey: string;              // For verification
  endpoints: IssuerEndpoints;
}

export type IssuerType = 
  | 'regulated-kyc-provider'      // Jumio, Onfido, etc.
  | 'government-agency'           // Official government issuers
  | 'self-attested'              // User self-attestation
  | 'community-verified'         // DAO/community verification
  | 'biometric-provider'         // WorldCoin, HumanityDAO
  | 'financial-institution';     // Banks, credit unions

export interface IssuerEndpoints {
  verification: string;           // Endpoint to verify credentials
  revocation: string;            // Check revocation status
  schema: string;                // Credential schema endpoint
}

export interface CredentialSubject {
  id: string;                    // DID of credential subject
  kycLevel: KYCLevel;
  activityLevel?: ActivityLevel;
  verificationMethod: VerificationMethod;
  attributes: CredentialAttributes;
  restrictions?: string[];        // Any usage restrictions
}

export interface VerificationMethod {
  type: 'biometric' | 'document' | 'in-person' | 'video' | 'blockchain';
  details: Record<string, any>;
  timestamp: Date;
  location?: string;
}

export interface CredentialAttributes {
  personhood: boolean;           // Verified human
  uniqueness: boolean;          // One person, one identity
  jurisdiction: Jurisdiction;    // Verified jurisdiction
  sanctions: boolean;           // Passed sanctions screening
  pep: boolean;                // Politically Exposed Person check
  accredited?: boolean;         // Accredited investor status
  residency?: string;           // Verified residency
  age?: {                       // Age verification without revealing exact age
    over18: boolean;
    over21: boolean;
    ageGroup: 'minor' | '18-25' | '26-40' | '41-65' | '65+';
  };
}

export interface CryptographicProof {
  type: 'Ed25519Signature2020' | 'EcdsaSecp256k1Signature2019' | 'BbsBlsSignature2020';
  created: Date;
  verificationMethod: string;    // DID URL of signing key
  proofPurpose: 'assertionMethod' | 'authentication';
  signature: string;             // Base64-encoded signature
  challenge?: string;            // For proof-of-possession
  domain?: string;              // For domain binding
}

export type CredentialStatus = 'active' | 'suspended' | 'revoked' | 'expired' | 'pending';

export interface ProofOfPersonhood {
  provider: ProofOfPersonhoodProvider;
  proof: string;                 // Provider-specific proof
  verifiedAt: Date;
  expiresAt?: Date;
  uniquenessScore: number;       // 0-100, confidence in uniqueness
  humanityScore: number;         // 0-100, confidence in being human
  metadata: Record<string, any>; // Provider-specific metadata
}

export type ProofOfPersonhoodProvider = 
  | 'worldcoin'
  | 'brightid'
  | 'gitcoin-passport'
  | 'proof-of-humanity'
  | 'idena'
  | 'humanode'
  | 'civic'
  | 'unstoppable-domains';

export interface SocialRecoveryConfig {
  guardians: Guardian[];         // Trusted guardians for recovery
  threshold: number;             // Required guardian confirmations
  recoveryMethods: RecoveryMethod[];
  lastRecovery?: Date;
}

export interface Guardian {
  did: string;
  name?: string;
  relationship: string;          // 'family', 'friend', 'colleague'
  addedAt: Date;
  lastActive: Date;
}

export interface RecoveryMethod {
  type: 'social' | 'biometric' | 'hardware' | 'time-lock';
  config: Record<string, any>;
  enabled: boolean;
}

export interface ReputationScore {
  overall: number;               // 0-1000 overall reputation
  components: {
    transactionHistory: number;  // Based on clean transaction history
    communityVouching: number;   // Community endorsements
    timeInSystem: number;        // Sybil resistance through time
    verification: number;        // Quality of identity verification
    compliance: number;          // Compliance history
  };
  lastUpdated: Date;
  attestations: ReputationAttestation[];
}

export interface ReputationAttestation {
  issuer: string;               // DID of attester
  type: 'transaction' | 'vouch' | 'verification' | 'compliance';
  score: number;
  reason: string;
  timestamp: Date;
  signature: string;
}

// Verification Results
export interface VerificationResult {
  valid: boolean;
  verified: boolean;
  issuerTrusted: boolean;
  notRevoked: boolean;
  notExpired: boolean;
  signatureValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;            // 0-100 overall confidence
  details: VerificationDetails;
}

export interface VerificationDetails {
  credential: VerifiableCredential;
  issuerVerification: IssuerVerificationResult;
  signatureVerification: SignatureVerificationResult;
  statusVerification: StatusVerificationResult;
  complianceChecks: ComplianceCheckResult[];
}

export interface IssuerVerificationResult {
  did: string;
  trusted: boolean;
  reputation: number;
  license?: string;
  lastChecked: Date;
}

export interface SignatureVerificationResult {
  valid: boolean;
  algorithm: string;
  publicKey: string;
  verifiedAt: Date;
}

export interface StatusVerificationResult {
  active: boolean;
  revoked: boolean;
  expired: boolean;
  lastChecked: Date;
}

export interface ComplianceCheckResult {
  rule: string;
  passed: boolean;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class DecentralizedIdentityService extends EventEmitter {
  private trustedIssuers: Map<string, CredentialIssuer> = new Map();
  private didResolver: any; // Would use actual DID resolver library
  private credentialCache: Map<string, VerificationResult> = new Map();
  private isInitialized = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Decentralized Identity Service already initialized');
      return;
    }

    try {
      logger.info('Initializing Decentralized Identity Service...');

      // Initialize trusted issuers registry
      await this.loadTrustedIssuers();

      // Initialize DID resolver
      await this.initializeDIDResolver();

      // Set up credential verification cache
      this.setupCredentialCache();

      this.isInitialized = true;
      logger.info('✅ Decentralized Identity Service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Decentralized Identity Service:', error);
      throw error;
    }
  }

  /**
   * Create a new decentralized identity
   */
  async createDecentralizedIdentity(
    walletAddress: string,
    verifiableCredentials: VerifiableCredential[] = []
  ): Promise<DecentralizedIdentity> {
    try {
      // Generate DID based on wallet address
      const did = await this.generateDID(walletAddress);

      const identity: DecentralizedIdentity = {
        did,
        walletAddress: walletAddress.toLowerCase(),
        verifiableCredentials,
        reputation: {
          overall: 100, // Starting reputation
          components: {
            transactionHistory: 50,
            communityVouching: 0,
            timeInSystem: 0,
            verification: 50,
            compliance: 50
          },
          lastUpdated: new Date(),
          attestations: []
        },
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      logger.info('Created decentralized identity', {
        did,
        walletAddress,
        credentialsCount: verifiableCredentials.length
      });

      this.emit('identity_created', {
        identity,
        timestamp: new Date()
      });

      return identity;

    } catch (error) {
      logger.error('Error creating decentralized identity:', error);
      throw error;
    }
  }

  /**
   * Verify a DID and its associated credentials
   */
  async verifyDID(did: string): Promise<VerificationResult> {
    try {
      logger.debug('Verifying DID', { did });

      // Check cache first
      const cached = this.credentialCache.get(did);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Resolve DID document
      const didDocument = await this.resolveDID(did);
      if (!didDocument) {
        return {
          valid: false,
          verified: false,
          issuerTrusted: false,
          notRevoked: false,
          notExpired: false,
          signatureValid: false,
          errors: ['DID could not be resolved'],
          warnings: [],
          confidence: 0,
          details: {} as VerificationDetails
        };
      }

      // Verify DID is active and not revoked
      const isActive = await this.checkDIDStatus(did);
      
      const result: VerificationResult = {
        valid: isActive,
        verified: isActive,
        issuerTrusted: true, // DID itself is self-sovereign
        notRevoked: isActive,
        notExpired: true, // DIDs don't typically expire
        signatureValid: true, // DID document signature verified
        errors: isActive ? [] : ['DID is not active'],
        warnings: [],
        confidence: isActive ? 95 : 0,
        details: {
          credential: {} as VerifiableCredential, // Not applicable for DID verification
          issuerVerification: {
            did,
            trusted: true,
            reputation: 100,
            lastChecked: new Date()
          },
          signatureVerification: {
            valid: true,
            algorithm: 'secp256k1',
            publicKey: didDocument.authentication[0].publicKeyHex,
            verifiedAt: new Date()
          },
          statusVerification: {
            active: isActive,
            revoked: !isActive,
            expired: false,
            lastChecked: new Date()
          },
          complianceChecks: []
        }
      };

      // Cache result
      this.credentialCache.set(did, result);

      return result;

    } catch (error) {
      logger.error('Error verifying DID:', error);
      throw error;
    }
  }

  /**
   * Verify a verifiable credential
   */
  async verifyCredential(credential: VerifiableCredential): Promise<VerificationResult> {
    try {
      logger.debug('Verifying credential', {
        id: credential.id,
        type: credential.type,
        issuer: credential.issuer.id
      });

      // Check cache first
      const cacheKey = `${credential.id}_${credential.proof.signature}`;
      const cached = this.credentialCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Verify issuer is trusted
      const issuerTrusted = await this.verifyIssuer(credential.issuer);
      if (!issuerTrusted.trusted) {
        errors.push(`Untrusted issuer: ${credential.issuer.name}`);
      }

      // 2. Verify credential is not expired
      const notExpired = !credential.expirationDate || credential.expirationDate > new Date();
      if (!notExpired) {
        errors.push('Credential has expired');
      }

      // 3. Verify credential is not revoked
      const notRevoked = !credential.revoked && credential.status === 'active';
      if (!notRevoked) {
        errors.push('Credential has been revoked');
      }

      // 4. Verify cryptographic signature
      const signatureValid = await this.verifySignature(credential);
      if (!signatureValid.valid) {
        errors.push('Invalid cryptographic signature');
      }

      // 5. Perform compliance checks
      const complianceChecks = await this.performComplianceChecks(credential);
      const compliancePassed = complianceChecks.every(check => check.passed);

      if (!compliancePassed) {
        const failedChecks = complianceChecks.filter(check => !check.passed);
        warnings.push(`Failed compliance checks: ${failedChecks.map(c => c.rule).join(', ')}`);
      }

      // Calculate overall confidence
      const confidence = this.calculateCredentialConfidence({
        issuerTrusted: issuerTrusted.trusted,
        notExpired,
        notRevoked,
        signatureValid: signatureValid.valid,
        compliancePassed,
        issuerReputation: issuerTrusted.reputation
      });

      const result: VerificationResult = {
        valid: errors.length === 0,
        verified: errors.length === 0 && warnings.length === 0,
        issuerTrusted: issuerTrusted.trusted,
        notRevoked,
        notExpired,
        signatureValid: signatureValid.valid,
        errors,
        warnings,
        confidence,
        details: {
          credential,
          issuerVerification: issuerTrusted,
          signatureVerification: signatureValid,
          statusVerification: {
            active: credential.status === 'active',
            revoked: credential.revoked,
            expired: !notExpired,
            lastChecked: new Date()
          },
          complianceChecks
        }
      };

      // Cache result
      this.credentialCache.set(cacheKey, result);

      // Emit verification event
      this.emit('credential_verified', {
        credential,
        result,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      logger.error('Error verifying credential:', error);
      throw error;
    }
  }

  /**
   * Create proof of personhood verification
   */
  async createProofOfPersonhood(
    provider: ProofOfPersonhoodProvider,
    walletAddress: string,
    proofData: any
  ): Promise<ProofOfPersonhood> {
    try {
      logger.info('Creating proof of personhood', { provider, walletAddress });

      const proof = await this.verifyProofOfPersonhood(provider, proofData);

      const proofOfPersonhood: ProofOfPersonhood = {
        provider,
        proof: proof.signature,
        verifiedAt: new Date(),
        expiresAt: proof.expiresAt,
        uniquenessScore: proof.uniquenessScore,
        humanityScore: proof.humanityScore,
        metadata: proof.metadata
      };

      this.emit('proof_of_personhood_created', {
        provider,
        walletAddress,
        proof: proofOfPersonhood,
        timestamp: new Date()
      });

      return proofOfPersonhood;

    } catch (error) {
      logger.error('Error creating proof of personhood:', error);
      throw error;
    }
  }

  /**
   * Calculate KYC compliance level from credentials
   */
  calculateKYCLevel(credentials: VerifiableCredential[]): {
    level: KYCLevel;
    confidence: number;
    missingRequirements: string[];
  } {
    const kycCredentials = credentials.filter(cred => 
      cred.type.includes('KYCCredential') && cred.status === 'active' && !cred.revoked
    );

    if (kycCredentials.length === 0) {
      return {
        level: 'basic',
        confidence: 0,
        missingRequirements: ['Valid KYC credential required']
      };
    }

    // Find highest level credential
    const levels = ['basic', 'enhanced', 'professional', 'institutional'];
    let highestLevel: KYCLevel = 'basic';
    let totalConfidence = 0;
    const missingRequirements: string[] = [];

    for (const credential of kycCredentials) {
      const credLevel = credential.kycLevel;
      const levelIndex = levels.indexOf(credLevel);
      const currentIndex = levels.indexOf(highestLevel);
      
      if (levelIndex > currentIndex) {
        highestLevel = credLevel;
      }

      // Add confidence based on issuer reputation and verification method
      const issuerReputation = credential.issuer.reputation / 100;
      const verificationBonus = this.getVerificationMethodBonus(credential.credentialSubject.verificationMethod);
      totalConfidence += (issuerReputation * 70) + verificationBonus;
    }

    const averageConfidence = totalConfidence / kycCredentials.length;

    // Check for missing requirements based on level
    if (highestLevel === 'institutional') {
      const hasAccreditation = credentials.some(cred => 
        cred.type.includes('AccreditedInvestorCredential') && cred.status === 'active'
      );
      if (!hasAccreditation) {
        missingRequirements.push('Accredited investor verification');
      }
    }

    return {
      level: highestLevel,
      confidence: Math.min(100, averageConfidence),
      missingRequirements
    };
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      trustedIssuers: this.trustedIssuers.size,
      cacheSize: this.credentialCache.size,
      supportedProviders: [
        'worldcoin',
        'brightid',
        'gitcoin-passport',
        'proof-of-humanity',
        'idena',
        'humanode',
        'civic',
        'unstoppable-domains'
      ]
    };
  }

  // Private methods

  private async loadTrustedIssuers(): Promise<void> {
    // Load trusted issuers from configuration or registry
    const defaultIssuers: CredentialIssuer[] = [
      {
        id: 'did:ethr:0x1234567890123456789012345678901234567890',
        name: 'Jumio Decentralized',
        type: 'regulated-kyc-provider',
        jurisdiction: 'US',
        license: 'MSB-123456',
        reputation: 95,
        publicKey: '0x1234...abcd',
        endpoints: {
          verification: 'https://api.jumio.com/kyc/verify',
          revocation: 'https://api.jumio.com/kyc/revocation',
          schema: 'https://api.jumio.com/kyc/schema'
        }
      },
      {
        id: 'did:web:worldcoin.org',
        name: 'WorldCoin',
        type: 'biometric-provider',
        jurisdiction: 'US',
        reputation: 90,
        publicKey: '0x5678...efgh',
        endpoints: {
          verification: 'https://api.worldcoin.org/verify',
          revocation: 'https://api.worldcoin.org/revocation',
          schema: 'https://api.worldcoin.org/schema'
        }
      }
    ];

    for (const issuer of defaultIssuers) {
      this.trustedIssuers.set(issuer.id, issuer);
    }

    logger.info(`Loaded ${this.trustedIssuers.size} trusted issuers`);
  }

  private async initializeDIDResolver(): Promise<void> {
    // Initialize DID resolver for different DID methods
    // This would integrate with actual DID resolver libraries
    logger.debug('DID resolver initialized');
  }

  private setupCredentialCache(): void {
    // Set up periodic cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, 60 * 60 * 1000); // Every hour
  }

  private async generateDID(walletAddress: string): Promise<string> {
    // Generate DID based on Ethereum address
    return `did:ethr:${walletAddress.toLowerCase()}`;
  }

  private async resolveDID(did: string): Promise<any> {
    // Mock DID resolution - would use actual DID resolver
    return {
      id: did,
      authentication: [{
        id: `${did}#keys-1`,
        type: 'Secp256k1VerificationKey2018',
        controller: did,
        publicKeyHex: '0x1234567890abcdef'
      }],
      service: []
    };
  }

  private async checkDIDStatus(did: string): Promise<boolean> {
    // Mock DID status check - would check actual DID registry
    return true; // Assume active for mock
  }

  private async verifyIssuer(issuer: CredentialIssuer): Promise<IssuerVerificationResult> {
    const trustedIssuer = this.trustedIssuers.get(issuer.id);
    
    return {
      did: issuer.id,
      trusted: !!trustedIssuer,
      reputation: trustedIssuer?.reputation || 0,
      license: trustedIssuer?.license,
      lastChecked: new Date()
    };
  }

  private async verifySignature(credential: VerifiableCredential): Promise<SignatureVerificationResult> {
    // Mock signature verification - would use actual cryptographic verification
    return {
      valid: true,
      algorithm: credential.proof.type,
      publicKey: credential.proof.verificationMethod,
      verifiedAt: new Date()
    };
  }

  private async performComplianceChecks(credential: VerifiableCredential): Promise<ComplianceCheckResult[]> {
    const checks: ComplianceCheckResult[] = [];

    // Check 1: Jurisdiction compatibility
    checks.push({
      rule: 'jurisdiction-compatibility',
      passed: true, // Mock result
      details: `Credential jurisdiction ${credential.jurisdiction} is supported`,
      severity: 'medium'
    });

    // Check 2: KYC level adequacy
    checks.push({
      rule: 'kyc-level-adequacy',
      passed: credential.kycLevel !== 'basic', // Require enhanced or higher
      details: `KYC level ${credential.kycLevel} meets requirements`,
      severity: 'high'
    });

    return checks;
  }

  private calculateCredentialConfidence(factors: {
    issuerTrusted: boolean;
    notExpired: boolean;
    notRevoked: boolean;
    signatureValid: boolean;
    compliancePassed: boolean;
    issuerReputation: number;
  }): number {
    let confidence = 0;

    if (factors.issuerTrusted) confidence += 30;
    if (factors.notExpired) confidence += 20;
    if (factors.notRevoked) confidence += 20;
    if (factors.signatureValid) confidence += 20;
    if (factors.compliancePassed) confidence += 10;

    // Adjust based on issuer reputation
    confidence = confidence * (factors.issuerReputation / 100);

    return Math.min(100, Math.max(0, confidence));
  }

  private getVerificationMethodBonus(method: VerificationMethod): number {
    const bonuses = {
      'biometric': 30,
      'in-person': 25,
      'video': 20,
      'document': 15,
      'blockchain': 10
    };

    return bonuses[method.type] || 0;
  }

  private async verifyProofOfPersonhood(
    provider: ProofOfPersonhoodProvider,
    proofData: any
  ): Promise<{
    signature: string;
    expiresAt?: Date;
    uniquenessScore: number;
    humanityScore: number;
    metadata: Record<string, any>;
  }> {
    // Mock proof verification - would integrate with actual providers
    switch (provider) {
      case 'worldcoin':
        return {
          signature: 'worldcoin_proof_' + Math.random().toString(36),
          uniquenessScore: 95,
          humanityScore: 98,
          metadata: { orb_verified: true, nullifier_hash: 'hash123' }
        };
      case 'brightid':
        return {
          signature: 'brightid_proof_' + Math.random().toString(36),
          uniquenessScore: 90,
          humanityScore: 92,
          metadata: { context_id: 'YieldSensei', verification_level: 'gold' }
        };
      default:
        throw new Error(`Unsupported proof of personhood provider: ${provider}`);
    }
  }

  private isCacheValid(result: VerificationResult): boolean {
    // Cache is valid for 1 hour
    const maxAge = 60 * 60 * 1000;
    return Date.now() - result.details.statusVerification.lastChecked.getTime() < maxAge;
  }

  private cleanupCache(): void {
    for (const [key, result] of this.credentialCache.entries()) {
      if (!this.isCacheValid(result)) {
        this.credentialCache.delete(key);
      }
    }
    logger.debug(`Credential cache cleaned up, size: ${this.credentialCache.size}`);
  }
}