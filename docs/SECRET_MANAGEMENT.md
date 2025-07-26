# Secret Management System

This document provides comprehensive guidance for the YieldSensei Secret Management System, which provides secure storage, access control, and rotation management for application secrets.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Vault Management](#vault-management)
5. [Access Control](#access-control)
6. [Secret Rotation](#secret-rotation)
7. [CLI Usage](#cli-usage)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

## Overview

The Secret Management System provides:

- **Secure Vault Storage**: Encrypted storage for secrets with support for multiple backends
- **Role-Based Access Control**: Fine-grained permissions and user management
- **Automatic Rotation**: Scheduled secret rotation with notifications
- **Audit Logging**: Comprehensive audit trails for all operations
- **CLI Interface**: Command-line tools for secret management
- **Health Monitoring**: System health checks and status reporting

## Architecture

### Components

1. **Vault Manager** (`src/config/secrets/vault-manager.ts`)
   - Handles secret storage and retrieval
   - Supports multiple backends (local, HashiCorp Vault, AWS Secrets Manager)
   - Provides encryption for local storage

2. **Access Control Manager** (`src/config/secrets/access-control.ts`)
   - Manages users and roles
   - Implements permission checking
   - Provides audit logging for access

3. **Rotation Manager** (`src/config/secrets/rotation-manager.ts`)
   - Handles automatic and manual secret rotation
   - Manages rotation schedules and policies
   - Sends notifications for rotation events

4. **Secret Manager** (`src/config/secrets/secret-manager.ts`)
   - Unified interface for all secret operations
   - Integrates all components
   - Provides high-level API

### Data Flow

```
User Request → Access Control → Secret Manager → Vault Manager
                                    ↓
                            Rotation Manager
                                    ↓
                            Audit Logging
```

## Quick Start

### 1. Initialize the System

```typescript
import { SecretManager, SecretManagerConfig } from './src/config/secrets/secret-manager';

const config: SecretManagerConfig = {
  vault: {
    type: 'local',
    localConfig: {
      vaultPath: './.vault/secrets',
      encryptionKey: process.env['VAULT_ENCRYPTION_KEY']
    }
  },
  defaultRotationPolicy: {
    enabled: true,
    intervalDays: 90,
    autoRotate: false,
    gracePeriodDays: 7,
    notificationDays: [30, 7, 1]
  },
  auditLogging: {
    enabled: true,
    logPath: './.vault/audit.log',
    retentionDays: 90
  }
};

const secretManager = new SecretManager(config);
await secretManager.initialize();
```

### 2. Store a Secret

```typescript
const secret = await secretManager.storeSecret(
  'JWT_SECRET',
  'your-secret-value',
  {
    type: 'jwt',
    description: 'JWT signing secret',
    environment: 'production',
    rotationPolicy: {
      enabled: true,
      intervalDays: 90,
      autoRotate: true,
      gracePeriodDays: 7,
      notificationDays: [30, 7, 1]
    }
  },
  'admin'
);
```

### 3. Retrieve a Secret

```typescript
const value = await secretManager.getSecret('JWT_SECRET', 'developer');
console.log('Secret value:', value);
```

## Vault Management

### Supported Backends

#### Local Vault (Development)

```typescript
const vaultConfig = {
  type: 'local',
  localConfig: {
    vaultPath: './.vault/secrets',
    encryptionKey: 'your-encryption-key-32-chars-minimum'
  }
};
```

#### HashiCorp Vault (Production)

```typescript
const vaultConfig = {
  type: 'hashicorp',
  hashicorpConfig: {
    url: 'https://vault.example.com',
    token: 'your-vault-token',
    mountPath: 'secret'
  }
};
```

#### AWS Secrets Manager

```typescript
const vaultConfig = {
  type: 'aws',
  awsConfig: {
    region: 'us-east-1',
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key'
  }
};
```

### Secret Types

- `jwt`: JWT signing secrets
- `encryption`: Encryption keys
- `database`: Database passwords
- `api`: API keys
- `webhook`: Webhook secrets
- `custom`: Custom secrets

## Access Control

### Default Roles

1. **Administrator** (`admin`)
   - Full access to all operations
   - Can manage users and roles
   - Can perform all secret operations

2. **Developer** (`developer`)
   - Read access to development secrets
   - Limited to development environment
   - Cannot access production secrets

3. **Read Only** (`readonly`)
   - Read-only access to secrets
   - Cannot modify or delete secrets
   - Can list secrets

4. **Rotation Manager** (`rotation_manager`)
   - Can read secrets
   - Can rotate secrets
   - Can manage rotation schedules
   - Can view audit logs

### Creating Custom Roles

```typescript
const customRole = secretManager.createRole({
  name: 'API Manager',
  description: 'Manages API keys and webhook secrets',
  permissions: [
    { resource: 'secret', action: 'read' },
    { resource: 'secret', action: 'write' },
    { resource: 'secret', action: 'rotate' }
  ],
  environment: 'production',
  isActive: true
});
```

### User Management

```typescript
// Create a new user
const user = secretManager.createUser({
  username: 'john.doe',
  email: 'john.doe@company.com',
  roles: ['developer'],
  environment: 'development',
  isActive: true,
  metadata: { department: 'engineering' }
});

// Update user roles
const updatedUser = secretManager.updateUserRoles(user.id, ['developer', 'readonly']);
```

## Secret Rotation

### Automatic Rotation

```typescript
// Schedule automatic rotation
await secretManager.scheduleRotation('JWT_SECRET', {
  enabled: true,
  intervalDays: 90,
  autoRotate: true,
  gracePeriodDays: 7,
  notificationDays: [30, 7, 1]
}, 'admin');

// Process automatic rotations
const results = await secretManager.processAutomaticRotations();
```

### Manual Rotation

```typescript
// Rotate a secret manually
const result = await secretManager.rotateSecret(
  'JWT_SECRET',
  'new-secret-value',
  'admin'
);

if (result.success) {
  console.log('Secret rotated successfully');
} else {
  console.error('Rotation failed:', result.error);
}
```

### Rotation Policies

```typescript
const rotationPolicy = {
  enabled: true,           // Enable rotation
  intervalDays: 90,        // Rotate every 90 days
  autoRotate: true,        // Automatic rotation
  gracePeriodDays: 7,      // Grace period after rotation
  notificationDays: [30, 7, 1]  // Notify 30, 7, and 1 days before
};
```

## CLI Usage

### Basic Commands

```bash
# Store a secret
npm run secrets:store JWT_SECRET "your-secret-value" --user admin --type jwt

# Retrieve a secret
npm run secrets:get JWT_SECRET --user developer

# Rotate a secret
npm run secrets:rotate JWT_SECRET "new-secret-value" --user admin

# List all secrets
npm run secrets:list --user admin

# Delete a secret
npm run secrets:delete JWT_SECRET --user admin
```

### Rotation Commands

```bash
# Schedule rotation
npm run secrets:schedule-rotation JWT_SECRET --interval 90 --user admin

# Process automatic rotations
npm run secrets:process-rotations

# Check system health
npm run secrets:health
```

### Audit and Management

```bash
# Generate audit report
npm run secrets:audit --start 2024-01-01 --end 2024-12-31 --output audit-report.md

# List users
npm run secrets:users

# List roles
npm run secrets:roles
```

### Examples

```bash
# Store a JWT secret for production
npm run secrets:store JWT_SECRET "super-secure-jwt-secret-32-chars" \
  --user admin \
  --type jwt \
  --description "JWT signing secret for production"

# Store a database password
npm run secrets:store POSTGRES_PASSWORD "secure-db-password" \
  --user admin \
  --type database \
  --description "PostgreSQL database password"

# Store an API key
npm run secrets:store OPENAI_API_KEY "sk-..." \
  --user admin \
  --type api \
  --description "OpenAI API key for AI features"

# Retrieve a secret as a developer
npm run secrets:get JWT_SECRET --user developer

# Rotate a secret
npm run secrets:rotate JWT_SECRET "new-jwt-secret-32-chars" --user admin

# Generate audit report for last month
npm run secrets:audit \
  --start $(date -d '1 month ago' -I) \
  --end $(date -I) \
  --output monthly-audit.md
```

## Security Best Practices

### 1. Secret Generation

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
DATABASE_PASSWORD=$(openssl rand -base64 24)
```

### 2. Access Control

- Use principle of least privilege
- Regularly review user permissions
- Implement role-based access control
- Monitor access patterns

### 3. Rotation Policies

- Rotate secrets regularly (90 days recommended)
- Use different rotation intervals for different secret types
- Implement grace periods for rotation
- Send notifications before rotation

### 4. Audit and Monitoring

- Enable comprehensive audit logging
- Monitor access patterns
- Review audit reports regularly
- Set up alerts for suspicious activity

### 5. Environment Separation

- Use different vaults for different environments
- Never share secrets between environments
- Use environment-specific rotation policies
- Implement proper access controls per environment

### 6. Backup and Recovery

- Backup vault data regularly
- Test recovery procedures
- Store backup encryption keys securely
- Document recovery procedures

## Troubleshooting

### Common Issues

#### Access Denied

```
❌ Access denied: Insufficient permissions
```

**Solution:** Check user roles and permissions. Ensure the user has the required role for the operation.

#### Secret Not Found

```
❌ Secret not found: JWT_SECRET
```

**Solution:** Verify the secret name and ensure it exists in the vault. Check if the user has access to the secret.

#### Rotation Failed

```
❌ Secret rotation failed: Access denied
```

**Solution:** Ensure the user has rotation permissions. Check if the secret exists and is accessible.

#### Vault Connection Issues

```
❌ Vault connection failed
```

**Solution:** Check vault configuration and connectivity. Verify encryption keys and paths.

### Debug Mode

Enable debug mode for detailed logging:

```bash
DEBUG=true npm run secrets:health
```

### Health Checks

```bash
# Check system health
npm run secrets:health

# Check for due rotations
npm run secrets:process-rotations

# Generate audit report
npm run secrets:audit --start 2024-01-01 --end 2024-12-31
```

## API Reference

### SecretManager

#### Methods

- `initialize()`: Initialize the secret management system
- `storeSecret(name, value, metadata, userId)`: Store a secret
- `getSecret(name, userId)`: Retrieve a secret
- `rotateSecret(name, newValue, userId)`: Rotate a secret
- `deleteSecret(name, userId)`: Delete a secret
- `listSecrets(userId)`: List all secrets
- `processAutomaticRotations()`: Process automatic rotations
- `generateAuditReport(startDate, endDate)`: Generate audit report
- `getHealthStatus()`: Get system health status

#### User Management

- `createUser(user)`: Create a new user
- `updateUserRoles(userId, roles)`: Update user roles
- `listUsers()`: List all users

#### Role Management

- `createRole(role)`: Create a new role
- `listRoles()`: List all roles

### Configuration

#### SecretManagerConfig

```typescript
interface SecretManagerConfig {
  vault: VaultConfig;
  defaultRotationPolicy: {
    enabled: boolean;
    intervalDays: number;
    autoRotate: boolean;
    gracePeriodDays: number;
    notificationDays: number[];
  };
  auditLogging: {
    enabled: boolean;
    logPath: string;
    retentionDays: number;
  };
}
```

### Environment Variables

- `VAULT_ENCRYPTION_KEY`: Encryption key for local vault
- `VAULT_URL`: HashiCorp Vault URL
- `VAULT_TOKEN`: HashiCorp Vault token
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region

## Integration Examples

### Express.js Integration

```typescript
import { SecretManager } from './src/config/secrets/secret-manager';

// Initialize secret manager
const secretManager = new SecretManager(config);
await secretManager.initialize();

// Middleware to inject secrets
app.use(async (req, res, next) => {
  try {
    const jwtSecret = await secretManager.getSecret('JWT_SECRET', 'app');
    req.secrets = { jwtSecret };
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to load secrets' });
  }
});
```

### Database Integration

```typescript
// Get database credentials
const dbPassword = await secretManager.getSecret('POSTGRES_PASSWORD', 'app');
const dbUrl = `postgresql://user:${dbPassword}@localhost:5432/db`;
```

### Scheduled Rotation

```typescript
// Set up scheduled rotation processing
setInterval(async () => {
  try {
    await secretManager.processAutomaticRotations();
    await secretManager.sendRotationNotifications();
  } catch (error) {
    console.error('Rotation processing failed:', error);
  }
}, 60 * 60 * 1000); // Every hour
```

## Support

For issues with the secret management system:

1. Check the health status: `npm run secrets:health`
2. Review audit logs: `npm run secrets:audit`
3. Check user permissions and roles
4. Verify vault configuration
5. Review rotation schedules

For additional help, refer to:
- [Environment Configuration](../docs/ENVIRONMENT_CONFIGURATION.md)
- [Security Best Practices](../docs/SECURITY_BEST_PRACTICES.md)
- [Deployment Guide](../docs/DEPLOYMENT.md) 