/**
 * Decentralized KYC Workflow Tests
 * Comprehensive test suite for decentralized identity and KYC functionality
 */

import { DecentralizedIdentityService } from '../kyc/decentralized-identity.service';
import { DecentralizedKYCWorkflow } from '../kyc/decentralized-kyc-workflow';
import { DecentralizedAuthService } from '../../auth/services/decentralized-auth.service';
import { UnifiedComplianceEngine } from '../core/unified-compliance-engine';
import {
  DecentralizedUser,
  DecentralizedKYCConfig,
  VerifiableCredential,
  ProofOfPersonhood,
  ZKAgeProof,
  CommunityAttestation
} from '../types/decentralized-types';

describe('DecentralizedIdentityService', () => {
  let identityService: DecentralizedIdentityService;

  beforeEach(async () => {
    identityService = new DecentralizedIdentityService();
    await identityService.initialize();
  });

  describe('Identity Creation', () => {
    it('should create a new decentralized identity', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      
      const identity = await identityService.createDecentralizedIdentity(walletAddress);

      expect(identity.did).toBe(`did:ethr:${walletAddress.toLowerCase()}`);
      expect(identity.walletAddress).toBe(walletAddress.toLowerCase());
      expect(identity.verifiableCredentials).toEqual([]);
      expect(identity.reputation.overall).toBe(100);
      expect(identity.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique DIDs for different wallet addresses', async () => {
      const wallet1 = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const wallet2 = '0x8ba1f109551bD432803012645Hac136c1c71C93A';

      const identity1 = await identityService.createDecentralizedIdentity(wallet1);
      const identity2 = await identityService.createDecentralizedIdentity(wallet2);

      expect(identity1.did).not.toBe(identity2.did);
      expect(identity1.walletAddress).not.toBe(identity2.walletAddress);
    });
  });

  describe('DID Verification', () => {
    it('should verify a valid DID', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      
      const result = await identityService.verifyDID(did);

      expect(result.valid).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.confidence).toBeGreaterThan(90);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid DID format', async () => {
      const invalidDID = 'invalid:did:format';
      
      const result = await identityService.verifyDID(invalidDID);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Verifiable Credentials', () => {
    it('should verify a valid credential', async () => {
      const credential: VerifiableCredential = {
        id: 'cred_123',
        type: ['VerifiableCredential', 'KYCCredential'],
        issuer: {
          id: 'did:ethr:0x1234567890123456789012345678901234567890',
          name: 'Jumio Decentralized',
          type: 'regulated-kyc-provider',
          jurisdiction: 'US',
          reputation: 95,
          publicKey: '0x1234...abcd',
          endpoints: {
            verification: 'https://api.jumio.com/kyc/verify',
            revocation: 'https://api.jumio.com/kyc/revocation',
            schema: 'https://api.jumio.com/kyc/schema'
          }
        },
        issuanceDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        credentialSubject: {
          id: 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC',
          kycLevel: 'enhanced',
          verificationMethod: {
            type: 'document',
            details: { documentType: 'passport' },
            timestamp: new Date(),
            location: 'online'
          },
          attributes: {
            personhood: true,
            uniqueness: true,
            jurisdiction: 'US',
            sanctions: false,
            pep: false
          }
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date(),
          verificationMethod: 'did:ethr:0x1234...#keys-1',
          proofPurpose: 'assertionMethod',
          signature: 'base64signature...'
        },
        status: 'active',
        jurisdiction: 'US',
        kycLevel: 'enhanced',
        revoked: false
      };

      const result = await identityService.verifyCredential(credential);

      expect(result.valid).toBe(true);
      expect(result.issuerTrusted).toBe(true);
      expect(result.signatureValid).toBe(true);
      expect(result.notRevoked).toBe(true);
      expect(result.notExpired).toBe(true);
      expect(result.confidence).toBeGreaterThan(80);
    });

    it('should reject expired credentials', async () => {
      const expiredCredential: VerifiableCredential = {
        id: 'cred_expired',
        type: ['VerifiableCredential', 'KYCCredential'],
        issuer: {
          id: 'did:ethr:0x1234567890123456789012345678901234567890',
          name: 'Test Issuer',
          type: 'regulated-kyc-provider',
          jurisdiction: 'US',
          reputation: 95,
          publicKey: '0x1234...abcd',
          endpoints: {
            verification: 'https://api.test.com/verify',
            revocation: 'https://api.test.com/revocation',
            schema: 'https://api.test.com/schema'
          }
        },
        issuanceDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        credentialSubject: {
          id: 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC',
          kycLevel: 'basic',
          verificationMethod: {
            type: 'document',
            details: {},
            timestamp: new Date()
          },
          attributes: {
            personhood: true,
            uniqueness: true,
            jurisdiction: 'US',
            sanctions: false,
            pep: false
          }
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date(),
          verificationMethod: 'did:ethr:0x1234...#keys-1',
          proofPurpose: 'assertionMethod',
          signature: 'base64signature...'
        },
        status: 'expired',
        jurisdiction: 'US',
        kycLevel: 'basic',
        revoked: false
      };

      const result = await identityService.verifyCredential(expiredCredential);

      expect(result.valid).toBe(false);
      expect(result.notExpired).toBe(false);
      expect(result.errors).toContain('Credential has expired');
    });
  });

  describe('Proof of Personhood', () => {
    it('should create WorldCoin proof of personhood', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const mockProofData = { orb_verified: true, nullifier_hash: 'test123' };

      const proof = await identityService.createProofOfPersonhood(
        'worldcoin',
        walletAddress,
        mockProofData
      );

      expect(proof.provider).toBe('worldcoin');
      expect(proof.uniquenessScore).toBeGreaterThan(90);
      expect(proof.humanityScore).toBeGreaterThan(90);
      expect(proof.verifiedAt).toBeInstanceOf(Date);
      expect(proof.metadata.orb_verified).toBe(true);
    });

    it('should create BrightID proof of personhood', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const mockProofData = { context_id: 'YieldSensei', verification_level: 'gold' };

      const proof = await identityService.createProofOfPersonhood(
        'brightid',
        walletAddress,
        mockProofData
      );

      expect(proof.provider).toBe('brightid');
      expect(proof.uniquenessScore).toBeGreaterThan(85);
      expect(proof.humanityScore).toBeGreaterThan(85);
      expect(proof.metadata.verification_level).toBe('gold');
    });
  });

  describe('KYC Level Calculation', () => {
    it('should calculate correct KYC level from credentials', async () => {
      const credentials: VerifiableCredential[] = [
        {
          id: 'cred_basic',
          type: ['VerifiableCredential', 'KYCCredential'],
          issuer: {
            id: 'did:ethr:0x1234567890123456789012345678901234567890',
            name: 'Test KYC Provider',
            type: 'regulated-kyc-provider',
            jurisdiction: 'US',
            reputation: 90,
            publicKey: '0x1234...abcd',
            endpoints: {
              verification: 'https://api.test.com/verify',
              revocation: 'https://api.test.com/revocation',
              schema: 'https://api.test.com/schema'
            }
          },
          issuanceDate: new Date(),
          credentialSubject: {
            id: 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC',
            kycLevel: 'enhanced',
            verificationMethod: {
              type: 'biometric',
              details: { biometric_type: 'facial' },
              timestamp: new Date()
            },
            attributes: {
              personhood: true,
              uniqueness: true,
              jurisdiction: 'US',
              sanctions: false,
              pep: false
            }
          },
          proof: {
            type: 'Ed25519Signature2020',
            created: new Date(),
            verificationMethod: 'did:ethr:0x1234...#keys-1',
            proofPurpose: 'assertionMethod',
            signature: 'signature...'
          },
          status: 'active',
          jurisdiction: 'US',
          kycLevel: 'enhanced',
          revoked: false
        }
      ];

      const result = identityService.calculateKYCLevel(credentials);

      expect(result.level).toBe('enhanced');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.missingRequirements).toEqual([]);
    });

    it('should identify missing requirements for institutional level', async () => {
      const credentials: VerifiableCredential[] = [
        {
          id: 'cred_basic_only',
          type: ['VerifiableCredential', 'KYCCredential'],
          issuer: {
            id: 'did:ethr:0x1234567890123456789012345678901234567890',
            name: 'Test KYC Provider',
            type: 'regulated-kyc-provider',
            jurisdiction: 'US',
            reputation: 90,
            publicKey: '0x1234...abcd',
            endpoints: {
              verification: 'https://api.test.com/verify',
              revocation: 'https://api.test.com/revocation',
              schema: 'https://api.test.com/schema'
            }
          },
          issuanceDate: new Date(),
          credentialSubject: {
            id: 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC',
            kycLevel: 'institutional',
            verificationMethod: {
              type: 'document',
              details: {},
              timestamp: new Date()
            },
            attributes: {
              personhood: true,
              uniqueness: true,
              jurisdiction: 'US',
              sanctions: false,
              pep: false
            }
          },
          proof: {
            type: 'Ed25519Signature2020',
            created: new Date(),
            verificationMethod: 'did:ethr:0x1234...#keys-1',
            proofPurpose: 'assertionMethod',
            signature: 'signature...'
          },
          status: 'active',
          jurisdiction: 'US',
          kycLevel: 'institutional',
          revoked: false
        }
      ];

      const result = identityService.calculateKYCLevel(credentials);

      expect(result.level).toBe('institutional');
      expect(result.missingRequirements).toContain('Accredited investor verification');
    });
  });
});

describe('DecentralizedKYCWorkflow', () => {
  let identityService: DecentralizedIdentityService;
  let kycWorkflow: DecentralizedKYCWorkflow;
  let config: DecentralizedKYCConfig;

  beforeEach(async () => {
    config = {
      requiredSteps: {
        retail: ['proof-of-personhood'],
        professional: ['proof-of-personhood', 'community-attestation'],
        institutional: ['proof-of-personhood', 'biometric-verification', 'community-attestation'],
        'high-net-worth': ['proof-of-personhood', 'zk-kyc-proof']
      },
      minimumAttestations: {
        retail: 0,
        professional: 2,
        institutional: 5,
        'high-net-worth': 3
      },
      reputationThresholds: {
        retail: 100,
        professional: 300,
        institutional: 500,
        'high-net-worth': 400
      },
      zkCircuits: {
        'age-verification-v1': {
          circuitId: 'age-verification-v1',
          name: 'Age Verification',
          description: 'Prove age without revealing exact age',
          verificationKey: 'vk_age_123',
          trusted: true,
          jurisdiction: ['US', 'EU']
        }
      },
      trustedBiometricProviders: ['worldcoin', 'civic'],
      communityDAOs: [
        {
          did: 'did:ethr:0xDAO123',
          name: 'Test DAO',
          jurisdiction: 'US',
          minimumStake: 1000,
          reputation: 95,
          attestationTypes: ['personhood', 'reputation']
        }
      ]
    };

    identityService = new DecentralizedIdentityService();
    await identityService.initialize();

    kycWorkflow = new DecentralizedKYCWorkflow(identityService, config);
    await kycWorkflow.initialize();
  });

  describe('KYC Assessment', () => {
    it('should assess KYC compliance for retail user', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const assessment = await kycWorkflow.assessDecentralizedKYC(did, 'retail');

      expect(assessment.did).toBe(did);
      expect(assessment.level).toBeDefined();
      expect(assessment.confidence).toBeGreaterThanOrEqual(0);
      expect(assessment.proofOfPersonhood).toBeDefined();
      expect(assessment.recommendations).toBeInstanceOf(Array);
      expect(assessment.nextActions).toBeInstanceOf(Array);
    });

    it('should require additional steps for professional users', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const assessment = await kycWorkflow.assessDecentralizedKYC(did, 'professional');

      expect(assessment.nextActions.length).toBeGreaterThan(0);
      expect(assessment.recommendations).toContain('Complete community attestation');
    });

    it('should have higher requirements for institutional users', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const assessment = await kycWorkflow.assessDecentralizedKYC(did, 'institutional');

      expect(assessment.nextActions.length).toBeGreaterThanOrEqual(2);
      const actionString = assessment.nextActions.join(' ');
      expect(actionString).toMatch(/biometric|attestation/i);
    });
  });

  describe('Verification Process', () => {
    it('should start verification process', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const sessionId = await kycWorkflow.startVerificationProcess(did, 'professional');

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_/);

      const status = kycWorkflow.getVerificationStatus(sessionId);
      expect(status.did).toBe(did);
      expect(status.targetLevel).toBe('professional');
      expect(status.status).toBe('in-progress');
      expect(status.progress.total).toBeGreaterThan(0);
    });

    it('should update progress when steps are completed', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const sessionId = await kycWorkflow.startVerificationProcess(did, 'retail');

      // Submit proof of personhood
      await kycWorkflow.submitProofOfPersonhood(sessionId, 'worldcoin', {
        orb_verified: true,
        nullifier_hash: 'test123'
      });

      const status = kycWorkflow.getVerificationStatus(sessionId);
      expect(status.progress.completed).toBeGreaterThan(0);
    });
  });

  describe('Community Attestation', () => {
    it('should request community attestation', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const requestId = await kycWorkflow.requestCommunityAttestation(did, 'personhood');

      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^req_/);
    });

    it('should specify preferred attester', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const preferredAttester = 'did:ethr:0xAttester123';

      const requestId = await kycWorkflow.requestCommunityAttestation(
        did,
        'reputation',
        preferredAttester
      );

      expect(requestId).toBeDefined();
    });
  });

  describe('Zero-Knowledge Proofs', () => {
    it('should submit valid ZK proof', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const sessionId = await kycWorkflow.startVerificationProcess(did, 'high-net-worth');

      const zkProof = {
        type: 'age-verification',
        proof: 'zk_proof_data_123',
        publicInputs: ['over18', 'over21'],
        verificationKey: 'vk_age_123',
        circuit: 'age-verification-v1',
        timestamp: new Date()
      };

      await expect(
        kycWorkflow.submitZKProof(sessionId, 'age-verification', zkProof)
      ).resolves.not.toThrow();
    });

    it('should reject invalid ZK proof', async () => {
      const did = 'did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const sessionId = await kycWorkflow.startVerificationProcess(did, 'professional');

      const invalidProof = {
        type: 'age-verification',
        proof: '', // Empty proof
        publicInputs: [],
        verificationKey: 'invalid_key',
        circuit: 'unknown-circuit',
        timestamp: new Date()
      };

      await expect(
        kycWorkflow.submitZKProof(sessionId, 'age-verification', invalidProof)
      ).rejects.toThrow();
    });
  });
});

describe('DecentralizedAuthService', () => {
  let identityService: DecentralizedIdentityService;
  let authService: DecentralizedAuthService;

  beforeEach(async () => {
    identityService = new DecentralizedIdentityService();
    await identityService.initialize();

    authService = new DecentralizedAuthService(identityService);
    await authService.initialize();
  });

  describe('Wallet Authentication', () => {
    it('should generate authentication challenge', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const challenge = authService.generateChallenge(walletAddress);

      expect(challenge).toContain('YieldSensei');
      expect(challenge).toContain(walletAddress);
      expect(challenge).toContain(Date.now().toString().slice(0, -3)); // Rough timestamp check
    });

    it('should authenticate user with valid wallet signature', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      const challenge = authService.generateChallenge(walletAddress);

      // Set up a decentralized user first
      await authService.setupDecentralizedUser(walletAddress, {
        privacyLevel: 'balanced',
        dataSharing: true,
        anonymousMode: false
      });

      const authRequest = {
        walletAddress,
        chainId: 1,
        signature: 'valid_signature_data',
        message: challenge,
        timestamp: Date.now()
      };

      const result = await authService.authenticateWithWallet(authRequest);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user?.did).toBe(`did:ethr:${walletAddress.toLowerCase()}`);
    });

    it('should require setup for new users', async () => {
      const walletAddress = '0x8ba1f109551bD432803012645Hac136c1c71C93A';
      const challenge = authService.generateChallenge(walletAddress);

      const authRequest = {
        walletAddress,
        chainId: 1,
        signature: 'valid_signature_data',
        message: challenge,
        timestamp: Date.now()
      };

      const result = await authService.authenticateWithWallet(authRequest);

      expect(result.success).toBe(false);
      expect(result.requiresSetup).toBe(true);
      expect(result.setupSteps).toBeDefined();
      expect(result.setupSteps!.length).toBeGreaterThan(0);
    });
  });

  describe('User Setup', () => {
    it('should set up new decentralized user', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const { user, setupInstructions } = await authService.setupDecentralizedUser(
        walletAddress,
        {
          privacyLevel: 'maximum',
          dataSharing: false,
          anonymousMode: true
        }
      );

      expect(user.did).toBe(`did:ethr:${walletAddress.toLowerCase()}`);
      expect(user.walletAddress).toBe(walletAddress.toLowerCase());
      expect(user.authenticationMethod).toBe('decentralized');
      expect(user.decentralizedIdentity.privacySettings.anonymousMode).toBe(true);
      expect(user.decentralizedIdentity.privacySettings.dataMinimization).toBe(true);
      expect(setupInstructions).toBeInstanceOf(Array);
      expect(setupInstructions.length).toBeGreaterThan(0);
    });

    it('should apply different privacy preferences', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      const { user } = await authService.setupDecentralizedUser(walletAddress, {
        privacyLevel: 'minimal',
        dataSharing: true,
        anonymousMode: false
      });

      expect(user.decentralizedIdentity.privacySettings.anonymousMode).toBe(false);
      expect(user.decentralizedIdentity.privacySettings.dataMinimization).toBe(false);
      expect(user.decentralizedIdentity.privacySettings.dataSharing.marketing).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should validate active session', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      
      // Set up user and authenticate
      await authService.setupDecentralizedUser(walletAddress, {
        privacyLevel: 'balanced',
        dataSharing: true,
        anonymousMode: false
      });

      const challenge = authService.generateChallenge(walletAddress);
      const authResult = await authService.authenticateWithWallet({
        walletAddress,
        chainId: 1,
        signature: 'valid_signature',
        message: challenge,
        timestamp: Date.now()
      });

      expect(authResult.success).toBe(true);
      const sessionId = authResult.session!.sessionId;

      // Validate session
      const validation = await authService.validateSession(sessionId);

      expect(validation.valid).toBe(true);
      expect(validation.session).toBeDefined();
      expect(validation.user).toBeDefined();
      expect(validation.capabilities.length).toBeGreaterThan(0);
    });

    it('should reject invalid session', async () => {
      const invalidSessionId = 'invalid_session_123';

      const validation = await authService.validateSession(invalidSessionId);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Session not found');
      expect(validation.capabilities).toEqual([]);
    });

    it('should revoke session', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';
      
      // Set up user and authenticate
      await authService.setupDecentralizedUser(walletAddress, {
        privacyLevel: 'balanced',
        dataSharing: true,
        anonymousMode: false
      });

      const challenge = authService.generateChallenge(walletAddress);
      const authResult = await authService.authenticateWithWallet({
        walletAddress,
        chainId: 1,
        signature: 'valid_signature',
        message: challenge,
        timestamp: Date.now()
      });

      const sessionId = authResult.session!.sessionId;

      // Revoke session
      await authService.revokeSession(sessionId, 'User logout');

      // Should fail validation after revocation
      const validation = await authService.validateSession(sessionId);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Session revoked');
    });
  });
});

describe('Integration Tests', () => {
  let identityService: DecentralizedIdentityService;
  let kycWorkflow: DecentralizedKYCWorkflow;
  let authService: DecentralizedAuthService;
  let unifiedEngine: UnifiedComplianceEngine;

  beforeEach(async () => {
    const config = {
      traditional: {
        jurisdictions: [],
        monitoring: {
          realTime: true,
          intervals: {
            transactionScreening: 1000,
            userReview: 3600000,
            riskAssessment: 86400000,
            reportGeneration: 86400000
          },
          thresholds: {
            transactionAmount: { USD: 10000 },
            velocityLimits: { daily_transaction_count: 50 },
            riskScores: { low: 25, medium: 50, high: 75, critical: 90 }
          }
        },
        kyc: {
          providers: [],
          requirements: [],
          automation: {
            autoApprove: true,
            confidenceThreshold: 0.95,
            manualReviewTriggers: [],
            escalationRules: []
          }
        },
        screening: {
          providers: [],
          lists: [],
          matching: {
            exactMatch: true,
            fuzzyMatch: true,
            fuzzyThreshold: 0.85,
            aliasMatch: true,
            phoneticMatch: false
          }
        },
        reporting: {
          automated: true,
          schedules: [],
          storage: {
            retention: 2555,
            encryption: true,
            backup: true,
            archival: true
          },
          distribution: {
            email: true,
            secure: true,
            api: true,
            regulatoryPortal: false
          }
        },
        alerts: {
          channels: [],
          escalation: {
            enabled: true,
            levels: [],
            timeout: 3600000
          },
          suppression: {
            enabled: true,
            rules: []
          }
        }
      },
      decentralized: {
        requiredSteps: {
          retail: ['proof-of-personhood'],
          professional: ['proof-of-personhood', 'community-attestation'],
          institutional: ['proof-of-personhood', 'biometric-verification'],
          'high-net-worth': ['proof-of-personhood', 'zk-kyc-proof']
        },
        minimumAttestations: {
          retail: 0,
          professional: 2,
          institutional: 5,
          'high-net-worth': 3
        },
        reputationThresholds: {
          retail: 100,
          professional: 300,
          institutional: 500,
          'high-net-worth': 400
        },
        zkCircuits: {},
        trustedBiometricProviders: ['worldcoin'],
        communityDAOs: []
      },
      mode: 'decentralized-only' as const,
      migrationSettings: {
        enableMigration: true,
        autoMigrateUsers: false,
        migrationIncentives: true
      }
    };

    unifiedEngine = UnifiedComplianceEngine.getInstance(config);
    await unifiedEngine.initialize();
  });

  describe('End-to-End Decentralized Flow', () => {
    it('should complete full decentralized onboarding and compliance flow', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC';

      // 1. Set up decentralized user
      identityService = new DecentralizedIdentityService();
      authService = new DecentralizedAuthService(identityService);
      await identityService.initialize();
      await authService.initialize();

      const { user } = await authService.setupDecentralizedUser(walletAddress, {
        privacyLevel: 'balanced',
        dataSharing: true,
        anonymousMode: false
      });

      expect(user.did).toBeDefined();

      // 2. Start KYC verification
      kycWorkflow = new DecentralizedKYCWorkflow(identityService, {
        requiredSteps: {
          retail: ['proof-of-personhood'],
          professional: ['proof-of-personhood', 'community-attestation'],
          institutional: ['proof-of-personhood', 'biometric-verification'],
          'high-net-worth': ['proof-of-personhood', 'zk-kyc-proof']
        },
        minimumAttestations: {
          retail: 0,
          professional: 2,
          institutional: 5,
          'high-net-worth': 3
        },
        reputationThresholds: {
          retail: 100,
          professional: 300,
          institutional: 500,
          'high-net-worth': 400
        },
        zkCircuits: {},
        trustedBiometricProviders: ['worldcoin'],
        communityDAOs: []
      });
      await kycWorkflow.initialize();

      const sessionId = await kycWorkflow.startVerificationProcess(user.did, 'retail');
      expect(sessionId).toBeDefined();

      // 3. Submit proof of personhood
      await kycWorkflow.submitProofOfPersonhood(sessionId, 'worldcoin', {
        orb_verified: true,
        nullifier_hash: 'test123'
      });

      const status = kycWorkflow.getVerificationStatus(sessionId);
      expect(status.progress.completed).toBeGreaterThan(0);

      // 4. Assess compliance
      const assessment = await kycWorkflow.assessDecentralizedKYC(user.did, 'retail');
      expect(assessment.did).toBe(user.did);
      expect(assessment.proofOfPersonhood).toBe(true);

      // 5. Authenticate and create session
      const challenge = authService.generateChallenge(walletAddress);
      const authResult = await authService.authenticateWithWallet({
        walletAddress,
        chainId: 1,
        signature: 'valid_signature',
        message: challenge,
        timestamp: Date.now()
      });

      expect(authResult.success).toBe(true);
      expect(authResult.session).toBeDefined();

      // 6. Test unified compliance assessment
      const unifiedAssessment = await unifiedEngine.assessCompliance(user);
      expect(unifiedAssessment.userType).toBe('decentralized');
      expect(unifiedAssessment.decentralizedFeatures).toBeDefined();
    });
  });
});