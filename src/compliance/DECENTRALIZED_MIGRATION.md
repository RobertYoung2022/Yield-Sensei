# Decentralized KYC Migration Guide

This guide outlines the transition from centralized KYC to a fully decentralized self-sovereign identity system.

## Overview

YieldSensei has migrated from traditional centralized KYC to a fully decentralized approach using:
- **Self-Sovereign Identity (SSI)** with DIDs
- **Verifiable Credentials** for KYC data
- **Zero-Knowledge Proofs** for privacy-preserving verification
- **Community Attestation** for reputation-based verification
- **Biometric Verification** without storing biometric data
- **Cross-Chain Identity** linking

## Architecture Changes

### Before (Centralized)
```typescript
// Traditional user with centralized KYC
interface User {
  id: string;
  email: string;
  kycStatus: CentralizedKYCStatus;
  documents: StoredDocuments[];
}

// KYC handled by third-party providers
const kycResult = await jumio.verifyUser(user, documents);
```

### After (Decentralized)
```typescript
// Decentralized user with DID
interface DecentralizedUser {
  did: string; // did:ethr:0x...
  walletAddress: string;
  decentralizedIdentity: DecentralizedIdentity;
  kycStatus: DecentralizedKYCStatus;
}

// KYC handled via verifiable credentials
const kycResult = await decentralizedKYC.assessDecentralizedKYC(did, 'institutional');
```

## Key Components

### 1. Decentralized Identity Service
- **File**: `src/compliance/kyc/decentralized-identity.service.ts`
- **Purpose**: Manages DIDs, verifiable credentials, and proof verification
- **Key Methods**:
  - `createDecentralizedIdentity()` - Create new DID-based identity
  - `verifyCredential()` - Verify verifiable credentials
  - `createProofOfPersonhood()` - Verify proof of personhood

### 2. Decentralized KYC Workflow
- **File**: `src/compliance/kyc/decentralized-kyc-workflow.ts`
- **Purpose**: Orchestrates decentralized KYC verification process
- **Key Methods**:
  - `assessDecentralizedKYC()` - Assess KYC compliance
  - `startVerificationProcess()` - Begin verification journey
  - `submitZKProof()` - Submit zero-knowledge proofs

### 3. Decentralized Authentication
- **File**: `src/auth/services/decentralized-auth.service.ts`
- **Purpose**: Handle DID-based authentication and session management
- **Key Methods**:
  - `authenticateWithWallet()` - Wallet signature authentication
  - `authenticateWithDID()` - DID-based authentication
  - `setupDecentralizedUser()` - Onboard new users

## Verification Methods

### 1. Proof of Personhood
Verify users are unique humans without revealing identity:

```typescript
// WorldCoin integration
const proof = await identityService.createProofOfPersonhood(
  'worldcoin',
  walletAddress,
  worldcoinProof
);

// BrightID integration
const proof = await identityService.createProofOfPersonhood(
  'brightid',
  walletAddress,
  brightidProof
);
```

### 2. Zero-Knowledge Proofs
Prove attributes without revealing them:

```typescript
// Prove age without revealing exact age
const ageProof: ZKAgeProof = {
  over18: true,
  over21: true,
  ageGroup: '26-40',
  proof: zkProofData,
  circuit: 'age-verification-v1'
};

// Prove jurisdiction without revealing location
const jurisdictionProof: ZKJurisdictionProof = {
  allowedJurisdictions: ['US', 'EU'],
  complianceLevel: 'high',
  proof: zkProofData,
  circuit: 'jurisdiction-verification-v1'
};
```

### 3. Community Attestation
Reputation-based verification through community vouching:

```typescript
// Request community attestation
const requestId = await kycWorkflow.requestCommunityAttestation(
  userDID,
  'personhood',
  optionalAttesterDID
);

// Community member provides attestation
const attestation: CommunityAttestation = {
  attester: attesterDID,
  attestationType: 'personhood',
  stake: 1000, // Tokens staked
  confidence: 95,
  timestamp: new Date(),
  signature: attestationSignature
};
```

### 4. Biometric Verification
Verify biometrics without storing biometric data:

```typescript
const biometricProof: BiometricProof = {
  type: 'iris-scan',
  provider: 'worldcoin',
  templateHash: sha256(biometricTemplate), // Only hash stored
  liveness: true,
  uniqueness: 98,
  timestamp: new Date(),
  proof: cryptographicProof
};
```

## Privacy Features

### Selective Disclosure
Users control what information to share:

```typescript
const privacySettings: PrivacySettings = {
  selectiveDisclosure: {
    age: 'threshold',      // Only share "over 18/21"
    jurisdiction: 'category', // Only share "high-compliance region"
    income: 'threshold',   // Only share "meets minimum"
    identity: 'pseudonymous' // Use pseudonym
  }
};
```

### Anonymous Transactions
Support for privacy-preserving transactions:

```typescript
const transaction: DecentralizedTransaction = {
  type: 'anonymous-transfer',
  amountCategory: 'medium', // Don't reveal exact amount
  zkProofs: {
    amountProof: withinLimitsProof,
    complianceProof: kycCompliantProof,
    sanctionsProof: sanctionsClearProof
  }
};
```

## Migration Steps

### Phase 1: Infrastructure Setup
1. **Deploy Decentralized Components**
   ```bash
   # Install dependencies
   npm install did-resolver @spruceid/didkit
   
   # Initialize services
   const identityService = new DecentralizedIdentityService();
   const kycWorkflow = new DecentralizedKYCWorkflow(identityService, config);
   const authService = new DecentralizedAuthService(identityService);
   ```

2. **Configure Trusted Issuers**
   ```typescript
   const trustedIssuers = [
     {
       id: 'did:ethr:0x123...abc',
       name: 'Jumio Decentralized',
       type: 'regulated-kyc-provider',
       reputation: 95
     },
     {
       id: 'did:web:worldcoin.org',
       name: 'WorldCoin',
       type: 'biometric-provider',
       reputation: 90
     }
   ];
   ```

### Phase 2: User Migration
1. **Existing Users**
   - Offer migration to decentralized identity
   - Maintain backward compatibility
   - Provide migration incentives

2. **New Users**
   - Default to decentralized onboarding
   - Guided setup process
   - Privacy preference selection

### Phase 3: Feature Rollout
1. **Basic Features**
   - DID creation and management
   - Wallet-based authentication
   - Basic verifiable credentials

2. **Advanced Features**
   - Zero-knowledge proofs
   - Community attestation
   - Cross-chain identity linking
   - Social recovery

### Phase 4: Full Migration
1. **Deprecate Centralized KYC**
   - Mark old KYC workflow as deprecated
   - Migrate all users to decentralized system
   - Remove centralized infrastructure

## Configuration

### Environment Variables
```bash
# Required for decentralized identity
WORLDCOIN_API_KEY=your_worldcoin_key
BRIGHTID_API_KEY=your_brightid_key
GITCOIN_PASSPORT_KEY=your_gitcoin_key

# ZK Proof circuits
ZK_CIRCUITS_PATH=/path/to/circuits
ZK_PROVING_KEY_PATH=/path/to/proving/keys
ZK_VERIFICATION_KEY_PATH=/path/to/verification/keys

# IPFS for credential storage
IPFS_GATEWAY_URL=https://ipfs.infura.io
IPFS_API_KEY=your_ipfs_key

# Ceramic for DID storage
CERAMIC_API_URL=https://ceramic.network
CERAMIC_SEED=your_ceramic_seed
```

### Decentralized KYC Configuration
```typescript
const decentralizedKYCConfig: DecentralizedKYCConfig = {
  requiredSteps: {
    retail: ['proof-of-personhood', 'wallet-age-verification'],
    professional: ['proof-of-personhood', 'community-attestation', 'zk-kyc-proof'],
    institutional: ['proof-of-personhood', 'biometric-verification', 'zk-kyc-proof', 'community-attestation'],
    'high-net-worth': ['proof-of-personhood', 'biometric-verification', 'zk-kyc-proof']
  },
  minimumAttestations: {
    retail: 1,
    professional: 3,
    institutional: 5,
    'high-net-worth': 3
  },
  reputationThresholds: {
    retail: 100,
    professional: 300,
    institutional: 500,
    'high-net-worth': 400
  }
};
```

## API Changes

### Authentication Endpoints
```typescript
// New decentralized auth endpoints
POST /auth/decentralized/wallet-connect
POST /auth/decentralized/did-auth
POST /auth/decentralized/setup-user
GET /auth/decentralized/challenge/:walletAddress

// Request/Response examples
POST /auth/decentralized/wallet-connect
{
  "walletAddress": "0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC",
  "signature": "0x...",
  "message": "YieldSensei authentication challenge...",
  "timestamp": 1648739200000
}

Response:
{
  "success": true,
  "user": { /* DecentralizedUser */ },
  "session": { /* DecentralizedAuthSession */ }
}
```

### KYC Endpoints
```typescript
// New decentralized KYC endpoints
POST /kyc/decentralized/assess/:did
POST /kyc/decentralized/start-verification
POST /kyc/decentralized/submit-proof-of-personhood
POST /kyc/decentralized/submit-zk-proof
POST /kyc/decentralized/request-attestation
GET /kyc/decentralized/status/:sessionId

// Example: Start verification
POST /kyc/decentralized/start-verification
{
  "did": "did:ethr:0x742d35Cc6634C0532925a3b8D0C9cC8632c7E5fC",
  "targetLevel": "professional",
  "preferredMethods": ["proof-of-personhood", "community-attestation"]
}
```

## Testing

### Unit Tests
```typescript
describe('DecentralizedKYCWorkflow', () => {
  it('should assess KYC compliance correctly', async () => {
    const assessment = await kycWorkflow.assessDecentralizedKYC(
      'did:ethr:0x123...abc',
      'professional'
    );
    
    expect(assessment.compliant).toBe(true);
    expect(assessment.level).toBe('enhanced');
    expect(assessment.confidence).toBeGreaterThan(80);
  });
});
```

### Integration Tests
```typescript
describe('Decentralized Auth Flow', () => {
  it('should authenticate user with wallet signature', async () => {
    const challenge = authService.generateChallenge(walletAddress);
    const signature = await wallet.signMessage(challenge);
    
    const result = await authService.authenticateWithWallet({
      walletAddress,
      chainId: 1,
      signature,
      message: challenge,
      timestamp: Date.now()
    });
    
    expect(result.success).toBe(true);
    expect(result.user?.did).toBeDefined();
    expect(result.session?.sessionId).toBeDefined();
  });
});
```

## Security Considerations

### Private Key Management
- Users control their own private keys
- No central authority can revoke identity
- Social recovery for key recovery
- Hardware wallet integration recommended

### Privacy Protection
- Minimal data collection
- Zero-knowledge proofs for sensitive data
- Selective disclosure capabilities
- Anonymous transaction support

### Compliance Assurance
- Verifiable credentials from trusted issuers
- Community-based reputation systems
- Real-time compliance monitoring
- Automated violation detection

## Troubleshooting

### Common Issues

1. **DID Resolution Failures**
   ```typescript
   // Check DID resolver configuration
   const didDocument = await resolver.resolve(did);
   if (!didDocument) {
     throw new Error('DID resolution failed');
   }
   ```

2. **Credential Verification Failures**
   ```typescript
   // Verify issuer is trusted
   const issuer = trustedIssuers.get(credential.issuer.id);
   if (!issuer) {
     throw new Error('Untrusted credential issuer');
   }
   ```

3. **ZK Proof Verification Failures**
   ```typescript
   // Check circuit compatibility
   const verifier = zkVerifiers.get(proof.circuit);
   if (!verifier) {
     throw new Error('Unsupported ZK circuit');
   }
   ```

## Resources

- [DID Specification](https://www.w3.org/TR/did-core/)
- [Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [WorldCoin Documentation](https://docs.worldcoin.org/)
- [BrightID Documentation](https://brightid.gitbook.io/)
- [Zero-Knowledge Proofs Guide](https://zkp.science/)

## Support

For technical support during migration:
- GitHub Issues: Report bugs and feature requests
- Documentation: Comprehensive API documentation
- Community: Join our Discord for real-time support
- Professional Services: Enterprise migration assistance available