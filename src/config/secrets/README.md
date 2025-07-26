# YieldSensei Cryptographic Key Management System

A comprehensive cryptographic key generation and management system providing secure key lifecycle management, automatic rotation, and role-based access control for the YieldSensei platform.

## Architecture Overview

The system consists of four main components working together:

### Core Components

1. **VaultManager** - Secure secret storage with encryption
2. **AccessControlManager** - Role-based access control (RBAC)
3. **RotationManager** - Automatic and manual secret rotation
4. **KeyManager** - Cryptographic key generation and management

### System Integration

```typescript
import { SecretManager, createDefaultSecretManagerConfig } from './config/secrets';

const config = createDefaultSecretManagerConfig();
const secretManager = new SecretManager(config);
await secretManager.initialize();
```

## Key Management Features

### Supported Key Types

#### Symmetric Keys
- **AES-256-GCM** - For encryption/decryption operations
- **HMAC-SHA256** - For message authentication and signing

#### Asymmetric Keys
- **RSA-2048/4096** - For public key encryption and digital signatures
- **Ed25519** - For high-performance digital signatures
- **secp256k1** - For blockchain and cryptocurrency operations

#### Key Derivation Functions
- **Scrypt** - For deriving keys from master keys
- Configurable iterations and salt for security

### Key Purposes

- **Encryption** - Data encryption keys (365-day expiration)
- **JWT** - JSON Web Token signing keys (30-day expiration)
- **API** - API authentication keys (90-day expiration)
- **Database** - Database encryption keys (180-day expiration)
- **Authentication** - General authentication keys (90-day expiration)

## Usage Examples

### Basic Key Generation

```typescript
import { KeyManager, KeySpec } from './config/secrets/key-manager';

// Initialize the system
const secretManager = new SecretManager(config);
await secretManager.initialize();
const keyManager = secretManager.getKeyManager();

// Generate symmetric encryption key
const encryptionKeySpec: KeySpec = {
  type: 'symmetric',
  algorithm: 'aes-256-gcm',
  purpose: 'encryption',
  environment: 'production'
};

const key = await keyManager.generateKey(encryptionKeySpec, userId, {
  description: 'Main application encryption key',
  rotationPolicy: {
    enabled: true,
    intervalDays: 90,
    autoRotate: true,
    gracePeriodDays: 7,
    notificationDays: [30, 7, 1]
  }
});
```

### Asymmetric Key Generation

```typescript
// Generate RSA key pair for encryption
const rsaKeySpec: KeySpec = {
  type: 'asymmetric',
  algorithm: 'rsa-2048',
  purpose: 'encryption',
  environment: 'production'
};

const rsaKey = await keyManager.generateKey(rsaKeySpec, userId);
console.log('Public Key:', rsaKey.publicKey);
console.log('Private Key:', rsaKey.privateKey);

// Generate Ed25519 signing key
const signingKeySpec: KeySpec = {
  type: 'signing',
  algorithm: 'ed25519',
  purpose: 'signing',
  environment: 'production'
};

const signingKey = await keyManager.generateKey(signingKeySpec, userId);
```

### Key Derivation

```typescript
// Generate master key for derivation
const masterKeySpec: KeySpec = {
  type: 'derivation',
  algorithm: 'aes-256-gcm',
  purpose: 'kdf',
  environment: 'production'
};

const masterKey = await keyManager.generateKey(masterKeySpec, userId);

// Derive specific-purpose keys
const derivedKey = await keyManager.deriveKey(
  masterKey.id,
  {
    masterKey: masterKey.symmetricKey!,
    salt: 'unique-purpose-salt',
    keyLength: 32,
    iterations: 100000
  },
  userId
);
```

### Key Retrieval and Management

```typescript
// Retrieve a key
const key = await keyManager.getKey(keyId, userId);

// List keys with filtering
const encryptionKeys = await keyManager.listKeys(userId, {
  type: 'symmetric',
  purpose: 'encryption',
  environment: 'production'
});

// Rotate a key
const rotationResult = await keyManager.rotateKey(keyId, userId);
if (rotationResult.success) {
  console.log(`Key rotated: ${rotationResult.oldKeyId} -> ${rotationResult.newKeyId}`);
}

// Delete a key
await keyManager.deleteKey(keyId, userId);
```

## Access Control

### Role-Based Access Control

The system implements comprehensive RBAC with predefined roles:

#### Built-in Roles

- **admin** - Full access to all operations
- **developer** - Limited access to development secrets
- **readonly** - Read-only access to allowed secrets
- **rotation_manager** - Manages secret rotation operations

#### Custom Roles

```typescript
const accessControl = secretManager.getAccessControlManager();

// Create custom role
const customRole = accessControl.createRole({
  name: 'API Manager',
  description: 'Manages API keys only',
  permissions: [
    { resource: 'secret', action: 'read', conditions: [{ type: 'secret_type', value: 'api', operator: 'equals' }] },
    { resource: 'secret', action: 'rotate', conditions: [{ type: 'secret_type', value: 'api', operator: 'equals' }] }
  ],
  environment: 'all',
  isActive: true
});

// Create user with custom role
const user = accessControl.createUser({
  username: 'apimanager',
  email: 'api@company.com',
  roles: [customRole.id],
  environment: 'production',
  isActive: true,
  metadata: { department: 'DevOps' }
});
```

### Permission Conditions

Access can be restricted based on various conditions:

```typescript
const conditionalPermission: Permission = {
  resource: 'secret',
  action: 'read',
  conditions: [
    { type: 'environment', value: 'development', operator: 'equals' },
    { type: 'time', value: ['09:00', '17:00'], operator: 'between' },
    { type: 'ip', value: ['192.168.1.0/24'], operator: 'in' }
  ]
};
```

## Automatic Rotation

### Rotation Policies

```typescript
const rotationPolicy: RotationPolicy = {
  enabled: true,
  intervalDays: 90,           // Rotate every 90 days
  autoRotate: true,           // Enable automatic rotation
  gracePeriodDays: 7,         // 7-day grace period for old keys
  notificationDays: [30, 7, 1] // Send notifications 30, 7, and 1 days before rotation
};
```

### Manual Rotation

```typescript
const rotationManager = secretManager.getRotationManager();

// Schedule rotation
await rotationManager.scheduleRotation('my-secret', rotationPolicy, userId);

// Manual rotation
const result = await rotationManager.rotateSecret('my-secret', newValue, userId);

// Check rotation status
const dueRotations = await rotationManager.checkRotationNeeded();
```

### Automatic Processing

```typescript
// Process all due rotations
const results = await rotationManager.processAutomaticRotations();

// Send rotation notifications
await rotationManager.sendNotifications();
```

## Security Features

### Encryption at Rest

- **AES-256-GCM** encryption for all stored secrets
- Unique initialization vectors (IVs) for each encryption operation
- Authentication tags for integrity verification

### Key Derivation

- **Scrypt** key derivation function with configurable parameters
- Unique salts for each derived key
- High iteration counts for brute-force resistance

### Integrity Verification

- **SHA-256 HMAC** fingerprints for all keys
- Automatic integrity checks on key retrieval
- Tamper detection and error reporting

### Access Logging

All access attempts are logged with:
- User identification
- Timestamp
- Resource and action
- IP address and user agent
- Success/failure status
- Audit trail

## Configuration

### Environment-Based Configuration

```typescript
const config: SecretManagerConfig = {
  vault: {
    type: 'local', // or 'hashicorp', 'aws', 'azure'
    localConfig: {
      vaultPath: process.env.VAULT_PATH || './data/secrets',
      encryptionKey: process.env.VAULT_ENCRYPTION_KEY
    }
  },
  defaultRotationPolicy: {
    enabled: process.env.NODE_ENV === 'production',
    intervalDays: 90,
    autoRotate: true,
    gracePeriodDays: 7,
    notificationDays: [30, 7, 1]
  },
  keyGeneration: {
    defaultKeySpecs: {
      encryption: { type: 'symmetric', algorithm: 'aes-256-gcm', purpose: 'encryption', environment: 'all' },
      signing: { type: 'signing', algorithm: 'hmac-sha256', purpose: 'authentication', environment: 'all' },
      jwt: { type: 'signing', algorithm: 'hmac-sha256', purpose: 'jwt', environment: 'all' }
    },
    enableAutoRotation: process.env.NODE_ENV === 'production',
    rotationCheckInterval: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

### Environment Variables

```bash
# Vault Configuration
VAULT_PATH=/secure/vault/path
VAULT_ENCRYPTION_KEY=your-secure-encryption-key

# Rotation Settings
ENABLE_AUTO_ROTATION=true
ROTATION_CHECK_INTERVAL=86400000  # 24 hours in milliseconds

# Environment
NODE_ENV=production
```

## Monitoring and Reporting

### Health Checks

```typescript
const healthCheck = await secretManager.healthCheck();
console.log('System Status:', healthCheck.status); // 'healthy' | 'warning' | 'critical'

// Detailed check results
Object.entries(healthCheck.checks).forEach(([component, result]) => {
  console.log(`${component}: ${result.status} - ${result.message}`);
});
```

### System Reports

```typescript
// Comprehensive system report
const systemReport = await secretManager.generateSystemReport();

// Key-specific report
const keyReport = await keyManager.generateKeyReport(startDate, endDate);

// Rotation report
const rotationReport = rotationManager.generateRotationReport(startDate, endDate);

// Access control audit
const accessReport = accessControl.generateAuditReport(startDate, endDate);
```

### Metrics and Alerts

The system provides metrics for:
- Key generation rates
- Rotation success/failure rates
- Access attempt patterns
- System health status
- Key expiration warnings

## Testing

### Unit Tests

```bash
# Run key manager tests
npm test src/config/secrets/__tests__/key-manager.test.ts

# Run all secret management tests
npm test src/config/secrets/__tests__/
```

### Integration Tests

```bash
# Run integration tests
npm test src/config/secrets/__tests__/secret-manager.integration.test.ts
```

### Test Coverage

The test suite covers:
- All key generation algorithms
- Access control scenarios
- Rotation workflows
- Error handling
- Performance testing
- Security validation

## Best Practices

### Key Generation

1. **Use appropriate key sizes**: Minimum AES-256 for symmetric keys
2. **Set proper expiration dates**: Based on key purpose and risk assessment
3. **Enable rotation policies**: Especially for production environments
4. **Use strong entropy sources**: System provides cryptographically secure random generation

### Access Control

1. **Principle of least privilege**: Grant minimum necessary permissions
2. **Regular access reviews**: Audit user roles and permissions
3. **Environment separation**: Separate development, staging, and production access
4. **Conditional access**: Use IP, time, and other restrictions where appropriate

### Rotation Management

1. **Automated rotation**: Enable for production environments
2. **Grace periods**: Allow time for applications to update to new keys
3. **Notification systems**: Alert relevant personnel before rotations
4. **Rollback procedures**: Plan for rotation failures

### Security

1. **Encrypt at rest**: All secrets are encrypted in storage
2. **Secure communications**: Use TLS for all API communications
3. **Audit logging**: Enable comprehensive access logging
4. **Regular updates**: Keep cryptographic libraries updated
5. **Key escrow**: Consider backup procedures for critical keys

## Troubleshooting

### Common Issues

#### Key Generation Failures
```typescript
// Check user permissions
const permission = accessControl.checkPermission(userId, 'secret', 'create');
if (!permission.granted) {
  console.log('Permission denied:', permission.reason);
}

// Verify key specification
const validAlgorithms = ['aes-256-gcm', 'rsa-2048', 'rsa-4096', 'ed25519', 'hmac-sha256'];
if (!validAlgorithms.includes(keySpec.algorithm)) {
  throw new Error(`Unsupported algorithm: ${keySpec.algorithm}`);
}
```

#### Rotation Failures
```typescript
// Check rotation status
const schedules = await rotationManager.checkRotationNeeded();
console.log('Due rotations:', schedules.length);

// Manual rotation with error handling
try {
  const result = await rotationManager.rotateSecret(secretName, newValue, userId);
  if (!result.success) {
    console.error('Rotation failed:', result.error);
  }
} catch (error) {
  console.error('Rotation error:', error);
}
```

#### Access Denied Errors
```typescript
// Debug access control
const user = accessControl.getUser(userId);
console.log('User roles:', user?.roles);

const permission = accessControl.checkPermission(userId, resource, action);
console.log('Permission check:', permission);
```

### Performance Optimization

1. **Key caching**: Cache frequently accessed keys in memory
2. **Batch operations**: Group multiple key operations together
3. **Async processing**: Use async/await for all operations
4. **Resource cleanup**: Properly dispose of key material

### Security Incidents

1. **Key compromise**: Immediately rotate affected keys
2. **Access violations**: Review and update access policies
3. **System breaches**: Audit logs for unauthorized access
4. **Compliance issues**: Generate reports for auditing

## API Reference

### KeyManager

```typescript
class KeyManager {
  // Generate new cryptographic key
  async generateKey(spec: KeySpec, userId: string, metadata?: Partial<SecretMetadata>): Promise<GeneratedKey>
  
  // Retrieve existing key
  async getKey(keyId: string, userId: string): Promise<GeneratedKey>
  
  // Derive key from master key
  async deriveKey(masterKeyId: string, options: KeyDerivationOptions, userId: string): Promise<Buffer>
  
  // Rotate existing key
  async rotateKey(keyId: string, userId: string): Promise<KeyRotationResult>
  
  // List keys with optional filtering
  async listKeys(userId: string, filters?: KeyFilter): Promise<GeneratedKey[]>
  
  // Delete key
  async deleteKey(keyId: string, userId: string): Promise<void>
  
  // Generate usage report
  async generateKeyReport(startDate: Date, endDate: Date): Promise<string>
}
```

### VaultManager

```typescript
class VaultManager {
  // Store secret
  async storeSecret(name: string, value: string, metadata: Partial<SecretMetadata>): Promise<SecretValue>
  
  // Retrieve secret
  async getSecret(name: string, role?: string): Promise<string>
  
  // Rotate secret
  async rotateSecret(name: string, newValue: string, role?: string): Promise<SecretValue>
  
  // List secrets
  async listSecrets(role?: string): Promise<SecretMetadata[]>
  
  // Delete secret
  async deleteSecret(name: string, role?: string): Promise<void>
}
```

### AccessControlManager

```typescript
class AccessControlManager {
  // Create role
  createRole(role: Omit<Role, 'id' | 'created' | 'lastModified'>): Role
  
  // Create user
  createUser(user: Omit<User, 'id' | 'created' | 'lastLogin'>): User
  
  // Check permissions
  checkPermission(userId: string, resource: string, action: string, context?: Record<string, any>): AccessResult
  
  // Update user roles
  updateUserRoles(userId: string, roles: string[]): User
}
```

## Changelog

### Version 1.0.0
- Initial implementation
- Complete key management system
- RBAC implementation
- Automatic rotation support
- Comprehensive test suite
- Production-ready security features

## License

This cryptographic key management system is part of the YieldSensei platform and is subject to the project's licensing terms.