/**
 * Decentralized Identity and KYC Types
 * Comprehensive type definitions for self-sovereign identity and decentralized KYC
 */

import { 
  Jurisdiction, 
  ActivityLevel, 
  KYCLevel, 
  RiskLevel, 
  ComplianceCategory 
} from './index';

// Core Decentralized User Types
export interface DecentralizedUser {
  // Core Identity
  did: string;                           // Decentralized Identifier
  walletAddress: string;                 // Primary wallet address
  authenticationMethod: 'decentralized'; // Always decentralized for this type
  
  // Decentralized Identity
  decentralizedIdentity: DecentralizedIdentity;
  
  // Compliance Status
  kycStatus: DecentralizedKYCStatus;
  complianceLevel: ComplianceLevel;
  
  // Profile Information (privacy-preserving)
  profile: PrivacyPreservingProfile;
  
  // Reputation and Social
  reputation: ReputationProfile;
  socialGraph: SocialGraphProfile;
  
  // Activity and Restrictions
  activityLevel: ActivityLevel;
  restrictions: UserRestriction[];
  
  // Timestamps
  createdAt: Date;
  lastActive: Date;
  lastVerification: Date;
}

export interface DecentralizedIdentity {
  did: string;
  didDocument: DIDDocument;
  verifiableCredentials: VerifiableCredential[];
  proofOfPersonhood?: ProofOfPersonhood;
  zkProofs: ZKProof[];
  biometricHashes: BiometricHash[];
  socialRecovery?: SocialRecoveryConfig;
  reputation: ReputationScore;
  crossChainIdentities: CrossChainIdentity[];
  privacySettings: PrivacySettings;
}

export interface DIDDocument {
  id: string;                            // The DID
  context: string[];                     // JSON-LD contexts
  verificationMethod: VerificationMethod[];
  authentication: string[];             // Authentication methods
  assertionMethod?: string[];           // Assertion methods
  keyAgreement?: string[];              // Key agreement methods
  capabilityInvocation?: string[];      // Capability invocation methods
  capabilityDelegation?: string[];      // Capability delegation methods
  service?: ServiceEndpoint[];          // Service endpoints
  created: Date;
  updated: Date;
  proof?: DIDProof;
}

export interface VerificationMethod {
  id: string;
  type: string;                         // e.g., 'Ed25519VerificationKey2020'
  controller: string;                   // DID that controls this key
  publicKeyMultibase?: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyBase58?: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;                         // Service type
  serviceEndpoint: string | object;    // Service endpoint
}

export interface DIDProof {
  type: string;
  created: Date;
  verificationMethod: string;
  proofPurpose: string;
  signature: string;
}

export interface DecentralizedKYCStatus {
  level: KYCLevel;
  verified: boolean;
  confidence: number;                   // 0-100 confidence score
  verificationMethod: 'self-sovereign' | 'community-attested' | 'zk-proof' | 'biometric';
  
  // Verification Components
  proofOfPersonhood: boolean;
  communityAttestations: number;
  zkProofCount: number;
  biometricVerified: boolean;
  reputationScore: number;
  
  // Compliance Tracking
  lastVerification: Date;
  expiresAt?: Date;
  nextReviewDue?: Date;
  violations: DecentralizedViolation[];
  
  // Privacy-Preserving Attributes
  ageProof?: ZKAgeProof;
  jurisdictionProof?: ZKJurisdictionProof;
  sanctionsProof?: ZKSanctionsProof;
  accreditationProof?: ZKAccreditationProof;
}

export interface ComplianceLevel {
  overall: 'compliant' | 'partial' | 'non-compliant' | 'pending';
  categories: {
    [key in ComplianceCategory]?: {
      status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
      confidence: number;
      lastChecked: Date;
      expiresAt?: Date;
    };
  };
  riskLevel: RiskLevel;
  automatedApproval: boolean;
  manualReviewRequired: boolean;
}

export interface PrivacyPreservingProfile {
  // Only privacy-preserving attributes are stored
  ageGroup?: 'minor' | '18-25' | '26-40' | '41-65' | '65+';
  jurisdictionCategory?: 'high-compliance' | 'medium-compliance' | 'emerging';
  investorType?: 'retail' | 'accredited' | 'institutional' | 'professional';
  riskCategory?: RiskLevel;
  activityPattern?: 'low' | 'medium' | 'high' | 'institutional';
  
  // Zero-knowledge proofs for sensitive attributes
  zkProofs: {
    age?: ZKAgeProof;
    jurisdiction?: ZKJurisdictionProof;
    income?: ZKIncomeProof;
    netWorth?: ZKNetWorthProof;
    sanctions?: ZKSanctionsProof;
  };
}

export interface ReputationProfile {
  overallScore: number;                 // 0-1000 reputation score
  
  // Component scores
  transactionReputation: number;        // Based on transaction history
  communityReputation: number;          // Based on community vouching
  verificationReputation: number;       // Based on verification quality
  complianceReputation: number;         // Based on compliance history
  timeReputation: number;               // Based on time in system
  
  // Social proof
  endorsements: CommunityEndorsement[];
  attestations: ReputationAttestation[];
  
  // Reputation staking
  stakedTokens: number;
  stakingHistory: StakingRecord[];
  
  lastUpdated: Date;
}

export interface SocialGraphProfile {
  // Privacy-preserving social connections
  connectionCount: number;
  verifiedConnections: number;
  mutualConnections: number;
  
  // Community participation
  daoMemberships: DAOMembership[];
  communityRoles: CommunityRole[];
  
  // Social verification
  socialProofs: SocialProof[];
  crossReferenceCount: number;
  
  // Network analysis (privacy-preserving)
  networkScore: number;
  influenceScore: number;
  trustScore: number;
}

export interface UserRestriction {
  type: 'transaction-limit' | 'jurisdiction-block' | 'feature-restriction' | 'temporary-suspension';
  description: string;
  startDate: Date;
  endDate?: Date;
  parameters: Record<string, any>;
  reason: string;
  appealable: boolean;
}

// Zero-Knowledge Proof Types
export interface ZKAgeProof {
  over18: boolean;
  over21: boolean;
  ageGroup: 'minor' | '18-25' | '26-40' | '41-65' | '65+';
  proof: string;
  circuit: 'age-verification-v1';
  verifiedAt: Date;
  expiresAt: Date;
}

export interface ZKJurisdictionProof {
  allowedJurisdictions: Jurisdiction[];
  complianceLevel: 'high' | 'medium' | 'low';
  proof: string;
  circuit: 'jurisdiction-verification-v1';
  verifiedAt: Date;
  expiresAt: Date;
}

export interface ZKSanctionsProof {
  sanctionsClear: boolean;
  pepStatus: boolean;
  proof: string;
  circuit: 'sanctions-screening-v1';
  verifiedAt: Date;
  expiresAt: Date;
}

export interface ZKAccreditationProof {
  accredited: boolean;
  accreditationType: 'income' | 'net-worth' | 'professional' | 'institutional';
  proof: string;
  circuit: 'accreditation-verification-v1';
  verifiedAt: Date;
  expiresAt: Date;
}

export interface ZKIncomeProof {
  incomeThreshold: number;              // Minimum threshold met
  currency: string;
  timeframe: 'annual' | 'monthly';
  proof: string;
  circuit: 'income-verification-v1';
  verifiedAt: Date;
  expiresAt: Date;
}

export interface ZKNetWorthProof {
  netWorthThreshold: number;            // Minimum threshold met
  currency: string;
  includedAssets: string[];             // Types of assets included
  proof: string;
  circuit: 'networth-verification-v1';
  verifiedAt: Date;
  expiresAt: Date;
}

// Community and Social Types
export interface CommunityEndorsement {
  endorser: string;                     // DID of endorser
  endorsementType: 'reputation' | 'identity' | 'professional' | 'character';
  stake: number;                        // Amount staked for endorsement
  confidence: number;                   // Endorser's confidence (0-100)
  message?: string;                     // Optional endorsement message
  timestamp: Date;
  signature: string;
}

export interface ReputationAttestation {
  attester: string;                     // DID of attester
  attestationType: 'transaction' | 'compliance' | 'community' | 'professional';
  score: number;                        // Reputation score contributed
  evidence?: string;                    // Optional evidence
  timestamp: Date;
  signature: string;
  stakeAmount: number;
}

export interface StakingRecord {
  amount: number;
  token: string;
  purpose: 'reputation' | 'attestation' | 'verification' | 'insurance';
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'withdrawn' | 'slashed';
  reason?: string;
}

export interface DAOMembership {
  daoId: string;                        // DID of DAO
  daoName: string;
  memberSince: Date;
  role: string;
  votingPower: number;
  reputation: number;
  active: boolean;
}

export interface CommunityRole {
  community: string;                    // Community identifier
  role: string;                         // Role in community
  granted: Date;
  grantedBy: string;                    // DID of granter
  responsibilities: string[];
  active: boolean;
}

export interface SocialProof {
  platform: string;                    // Platform type
  proofType: 'domain-verification' | 'social-media' | 'professional' | 'education';
  identifier: string;                   // Platform-specific identifier (hashed)
  verified: boolean;
  verifiedAt: Date;
  signature: string;
}

// Cross-Chain Identity
export interface CrossChainIdentity {
  chain: string;                        // Blockchain name
  address: string;                      // Address on that chain
  verified: boolean;
  verificationMethod: 'signature' | 'transaction' | 'smart-contract';
  linkedAt: Date;
  proof: string;
}

// Privacy Settings
export interface PrivacySettings {
  dataMinimization: boolean;            // Minimize data collection
  anonymousMode: boolean;               // Use anonymous credentials when possible
  
  // Selective disclosure preferences
  selectiveDisclosure: {
    age: 'none' | 'range' | 'threshold' | 'exact';
    jurisdiction: 'none' | 'category' | 'region' | 'exact';
    income: 'none' | 'threshold' | 'range' | 'exact';
    identity: 'none' | 'pseudonymous' | 'verified';
  };
  
  // Data sharing preferences
  dataSharing: {
    analytics: boolean;
    compliance: boolean;
    research: boolean;
    marketing: boolean;
  };
  
  // Revocation preferences
  credentialRevocation: {
    automatic: boolean;
    notificationRequired: boolean;
    gracePeriod: number;              // Days
  };
}

// Decentralized Violation Types
export interface DecentralizedViolation {
  id: string;
  type: 'reputation-slash' | 'attestation-dispute' | 'proof-invalidity' | 'community-report';
  severity: RiskLevel;
  description: string;
  evidence: ViolationEvidence[];
  reportedBy?: string;                  // DID of reporter
  detectedAt: Date;
  
  // Resolution
  status: 'open' | 'disputed' | 'resolved' | 'dismissed';
  resolution?: string;
  resolvedAt?: Date;
  appealable: boolean;
  
  // Impact
  reputationImpact: number;
  restrictionsImposed: UserRestriction[];
}

export interface ViolationEvidence {
  type: 'transaction-data' | 'attestation-conflict' | 'proof-verification' | 'community-report';
  description: string;
  data: any;
  submittedBy: string;                  // DID of evidence submitter
  timestamp: Date;
  verified: boolean;
}

// Biometric Types (Privacy-Preserving)
export interface BiometricHash {
  type: 'iris' | 'facial' | 'voice' | 'palm' | 'fingerprint';
  hash: string;                         // Cryptographic hash of biometric template
  algorithm: string;                    // Hashing algorithm used
  provider: string;                     // Trusted biometric provider
  accuracy: number;                     // Accuracy score (0-100)
  liveness: boolean;                    // Liveness detection passed
  uniqueness: number;                   // Uniqueness score (0-100)
  registeredAt: Date;
  expiresAt?: Date;
  revoked: boolean;
}

// Social Recovery
export interface SocialRecoveryConfig {
  enabled: boolean;
  guardians: SocialGuardian[];
  threshold: number;                    // Number of guardians required for recovery
  recoveryMethods: RecoveryMethod[];
  timelock: number;                     // Timelock period in seconds
  lastRecovery?: Date;
}

export interface SocialGuardian {
  did: string;
  name?: string;                        // Optional display name
  relationship: 'family' | 'friend' | 'colleague' | 'institution' | 'service';
  trustLevel: number;                   // Trust level (0-100)
  addedAt: Date;
  lastContact: Date;
  publicKey: string;
  active: boolean;
}

export interface RecoveryMethod {
  type: 'social-consensus' | 'biometric-backup' | 'hardware-key' | 'time-delay' | 'multi-signature';
  config: Record<string, any>;
  enabled: boolean;
  priority: number;                     // Priority order (1 = highest)
}

// Transaction Types for Decentralized Users
export interface DecentralizedTransaction {
  id: string;
  userId: string;                       // DID instead of traditional user ID
  type: DecentralizedTransactionType;
  
  // Privacy-preserving transaction data
  amountCategory: 'micro' | 'small' | 'medium' | 'large' | 'institutional';
  currency: string;
  
  // Zero-knowledge proofs
  zkProofs: {
    amountProof?: ZKAmountProof;        // Prove amount is within limits without revealing exact amount
    complianceProof?: ZKComplianceProof; // Prove compliance without revealing identity
    sanctionsProof?: ZKSanctionsProof;  // Prove not sanctioned without revealing identity
  };
  
  // Decentralized compliance
  complianceStatus: DecentralizedComplianceStatus;
  reputationImpact: number;
  
  timestamp: Date;
  blockNumber?: number;
  transactionHash?: string;
}

export type DecentralizedTransactionType = 
  | 'anonymous-transfer'
  | 'shielded-yield-deposit'
  | 'private-yield-withdrawal'
  | 'zk-trade'
  | 'confidential-bridge'
  | 'private-staking'
  | 'anonymous-lending'
  | 'shielded-borrowing';

export interface ZKAmountProof {
  withinLimits: boolean;
  thresholdCategory: 'below-reporting' | 'requires-monitoring' | 'requires-approval';
  proof: string;
  circuit: 'amount-threshold-v1';
  verifiedAt: Date;
}

export interface ZKComplianceProof {
  compliant: boolean;
  complianceLevel: KYCLevel;
  proof: string;
  circuit: 'compliance-verification-v1';
  verifiedAt: Date;
}

export interface DecentralizedComplianceStatus {
  approved: boolean;
  riskScore: number;
  flags: PrivacyPreservingFlag[];
  automatedApproval: boolean;
  reviewRequired: boolean;
  restrictions: string[];
  verifiedAt: Date;
}

export interface PrivacyPreservingFlag {
  type: 'velocity-anomaly' | 'amount-threshold' | 'reputation-check' | 'pattern-analysis';
  severity: RiskLevel;
  description: string;
  confidence: number;
  automated: boolean;
  timestamp: Date;
}

// Authentication and Session Types
export interface DecentralizedAuthSession {
  sessionId: string;
  did: string;
  walletAddress: string;
  
  // Session proof
  proof: SessionProof;
  
  // Capabilities (what the session can do)
  capabilities: SessionCapability[];
  
  // Session metadata
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress?: string;                   // Optional for privacy
  userAgent?: string;                   // Optional for privacy
  
  // Session status
  active: boolean;
  revoked: boolean;
  revokedAt?: Date;
  revokeReason?: string;
}

export interface SessionProof {
  type: 'wallet-signature' | 'did-auth' | 'zk-proof';
  challenge: string;
  response: string;
  timestamp: Date;
  signature: string;
}

export interface SessionCapability {
  action: string;                       // What action is allowed
  resource: string;                     // What resource it applies to
  conditions?: string[];                // Conditions that must be met
  expiresAt?: Date;                     // When this capability expires
}

// Export all types
export * from './index';  // Re-export base types