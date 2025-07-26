# CI/CD Secret Management Integration

Comprehensive integration between the YieldSensei secret management system and various CI/CD platforms including GitHub Actions, GitLab CI, Jenkins, and Azure DevOps.

## Overview

The CI/CD integration provides:

- **Multi-Platform Support**: GitHub Actions, GitLab CI, Jenkins, Azure DevOps
- **Automated Secret Deployment**: Sync secrets from vault to CI/CD platforms
- **Secret Rotation**: Automated and manual secret rotation with pipeline updates
- **Audit Trail**: Complete deployment and rotation history
- **Security**: Encrypted secret storage and masked sensitive data in logs
- **Validation**: Configuration validation and compliance checking

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Secret Vault  │    │  CI/CD Platform │    │   Deployment    │
│   (YieldSensei) │◄──►│   Integration   │◄──►│    Pipeline     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │              ┌─────────────────┐               │
        └──────────────►│  Audit & Report │◄──────────────┘
                       └─────────────────┘
```

## Quick Start

### 1. Installation and Setup

```bash
# Install dependencies
npm install

# Initialize secret management system
npm run secrets:init

# Validate configuration
npm run secrets:validate
```

### 2. Environment Configuration

Set the following environment variables:

```bash
# Required
export NODE_ENV=production
export CICD_PLATFORM=github
export PROJECT_ID=your-org/your-repo
export VAULT_ENCRYPTION_KEY=your-32-character-encryption-key

# Platform-specific
export GITHUB_TOKEN=your-github-token        # For GitHub Actions
export GITLAB_TOKEN=your-gitlab-token        # For GitLab CI
export JENKINS_API_TOKEN=your-jenkins-token  # For Jenkins
export AZURE_DEVOPS_TOKEN=your-azure-token   # For Azure DevOps
```

### 3. Basic Usage

```bash
# Sync all secrets to CI/CD platform
npm run secrets:sync

# Rotate specific secrets
npm run secrets:rotate -- --secrets "JWT_SECRET,DATABASE_PASSWORD"

# Generate audit report
npm run secrets:audit -- --format markdown --output audit-report.md
```

## Platform Integration

### GitHub Actions

#### Automated Workflow Setup

The integration automatically generates a GitHub Actions workflow for secret management:

```yaml
# .github/workflows/secret-management.yml
name: Secret Management

on:
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        type: choice
        options: [sync, rotate, validate, audit]
      environment:
        description: 'Target environment'
        type: choice
        options: [development, staging, production]

jobs:
  secret-management:
    runs-on: ubuntu-latest
    steps:
      - name: Sync secrets
        run: npm run secrets:sync
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VAULT_ENCRYPTION_KEY: ${{ secrets.VAULT_ENCRYPTION_KEY }}
```

#### Required Secrets

Configure these secrets in your GitHub repository:

- `VAULT_ENCRYPTION_KEY`: 32-character encryption key for the secret vault
- `GITHUB_TOKEN`: GitHub token with appropriate permissions

#### Manual Deployment

```bash
# Deploy specific secrets to GitHub
npm run secrets:deploy -- --secrets "API_KEY,DATABASE_URL" --environment production
```

### GitLab CI

#### Pipeline Configuration

Automatically generated `.gitlab-ci.yml`:

```yaml
stages:
  - validate
  - sync
  - audit

variables:
  CICD_PLATFORM: "gitlab"
  PROJECT_ID: "$CI_PROJECT_PATH"

sync_secrets:
  stage: sync
  script:
    - npm run secrets:sync -- --environment $ENVIRONMENT
  when: manual
```

#### Setup

1. Set CI/CD variables in GitLab:
   - `VAULT_ENCRYPTION_KEY`
   - `GITLAB_TOKEN`

2. Configure project ID:
   ```bash
   export PROJECT_ID="group/project"
   export CICD_PLATFORM="gitlab"
   ```

### Jenkins

#### Pipeline Integration

Generated `Jenkinsfile`:

```groovy
pipeline {
    agent any
    
    parameters {
        choice(name: 'ACTION', choices: ['sync', 'rotate', 'validate'])
        choice(name: 'ENVIRONMENT', choices: ['development', 'staging', 'production'])
    }
    
    stages {
        stage('Sync Secrets') {
            steps {
                withCredentials([
                    string(credentialsId: 'vault-encryption-key', variable: 'VAULT_ENCRYPTION_KEY')
                ]) {
                    sh "npm run secrets:sync -- --environment ${params.ENVIRONMENT}"
                }
            }
        }
    }
}
```

#### Setup

1. Install Jenkins credentials:
   - `vault-encryption-key`: Secret text credential
   - `jenkins-api-token`: API token for Jenkins

2. Create parameterized build job

### Azure DevOps

#### Pipeline Configuration

Generated `azure-pipelines.yml`:

```yaml
parameters:
  - name: action
    type: string
    default: 'sync'
    values: [sync, rotate, validate]
  - name: environment
    type: string
    default: 'staging'
    values: [development, staging, production]

stages:
  - stage: SecretManagement
    jobs:
      - job: ManageSecrets
        steps:
          - script: npm run secrets:sync -- --environment ${{ parameters.environment }}
            env:
              AZURE_DEVOPS_TOKEN: $(System.AccessToken)
              VAULT_ENCRYPTION_KEY: $(VAULT_ENCRYPTION_KEY)
```

#### Setup

1. Configure pipeline variables:
   - `VAULT_ENCRYPTION_KEY`
   - Enable "Allow scripts to access the OAuth token"

## CLI Reference

### Core Commands

#### `secrets:sync`
Synchronize secrets from vault to CI/CD platform

```bash
npm run secrets:sync [options]

Options:
  --environment <env>    Target environment (development, staging, production)
  --dry-run             Show what would be synced without making changes
  --force               Force sync even if secrets are up to date
```

#### `secrets:deploy`
Deploy specific secrets to CI/CD platform

```bash
npm run secrets:deploy [options]

Options:
  --file <file>         Secrets configuration file
  --secrets <names>     Comma-separated list of secret names
  --exclude <names>     Comma-separated list of secrets to exclude
  --environment <env>   Target environment
```

#### `secrets:rotate`
Rotate secrets and update CI/CD platform

```bash
npm run secrets:rotate [options]

Options:
  --secrets <names>     Comma-separated list of secret names to rotate
  --all                 Rotate all secrets
  --dry-run            Show what would be rotated without making changes
  --environment <env>   Target environment
```

#### `secrets:validate`
Validate CI/CD configuration and secrets

```bash
npm run secrets:validate [options]

Options:
  --secrets-only       Validate only secrets, not CI/CD config
  --fix                Attempt to fix validation issues
  --environment <env>  Target environment
```

#### `secrets:audit`
Generate audit report for secret deployments

```bash
npm run secrets:audit [options]

Options:
  --output <file>      Output file path (default: ./secret-audit-report.json)
  --format <format>    Output format (json, markdown)
  --days <days>        Number of days to include in report
  --environment <env>  Target environment
```

#### `secrets:status`
Show status of secrets and CI/CD integration

```bash
npm run secrets:status
```

### Configuration Commands

#### `secrets:init`
Initialize CI/CD integration configuration

```bash
npm run secrets:init [options]

Options:
  --platform <platform>  CI/CD platform (github, gitlab, jenkins, azure)
  --interactive          Interactive configuration setup
```

## Configuration

### Secret Configuration File

Create `.secrets-config.json`:

```json
{
  "platform": "github",
  "projectId": "your-org/your-repo",
  "environments": ["development", "staging", "production"],
  "encryptionEnabled": true,
  "auditLogging": true,
  "secrets": {
    "JWT_SECRET": {
      "description": "JWT signing secret",
      "environments": ["production", "staging"],
      "rotationPolicy": {
        "enabled": true,
        "intervalDays": 90
      }
    },
    "DATABASE_PASSWORD": {
      "description": "Database connection password",
      "environments": ["production", "staging"],
      "rotationPolicy": {
        "enabled": true,
        "intervalDays": 60
      }
    },
    "API_KEY": {
      "description": "External API key",
      "environments": ["production", "staging", "development"],
      "rotationPolicy": {
        "enabled": false
      }
    }
  }
}
```

### Environment-Specific Configuration

Configure different settings per environment:

```json
{
  "environments": {
    "development": {
      "encryptionEnabled": false,
      "auditLogging": false,
      "secretsScope": "repository"
    },
    "staging": {
      "encryptionEnabled": true,
      "auditLogging": true,
      "secretsScope": "repository"
    },
    "production": {
      "encryptionEnabled": true,
      "auditLogging": true,
      "secretsScope": "organization"
    }
  }
}
```

## Security Best Practices

### 1. Encryption

- All secrets are encrypted at rest using AES-256-GCM
- Encryption keys are stored separately from secrets
- Platform-specific encryption for GitHub Actions, etc.

### 2. Access Control

- Role-based access control (RBAC) for secret operations
- Service accounts for CI/CD operations
- Audit logging for all secret access

### 3. Rotation Policies

```typescript
{
  "rotationPolicy": {
    "enabled": true,
    "intervalDays": 90,           // Rotate every 90 days
    "gracePeriodDays": 7,         // Keep old secrets for 7 days
    "notificationDays": [30, 7, 1] // Notify 30, 7, and 1 days before
  }
}
```

### 4. Environment Separation

- Separate secret stores per environment
- Environment-specific encryption keys
- Isolated CI/CD pipelines

## Monitoring and Alerting

### Automated Validation

Daily validation runs check:
- Secret integrity
- Configuration compliance
- Platform connectivity
- Access permissions

### Alert Conditions

Alerts are triggered for:
- Secret rotation failures
- Configuration drift
- Validation failures
- Unauthorized access attempts

### Metrics and Reporting

Track these metrics:
- Deployment success rate
- Rotation frequency
- Access patterns
- Compliance status

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

```bash
# Check token permissions
npm run secrets:validate

# Test platform connectivity
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

#### 2. Encryption Errors

```bash
# Verify encryption key
echo $VAULT_ENCRYPTION_KEY | wc -c  # Should be 33 (32 chars + newline)

# Reset encryption key
npm run secrets:init -- --reset-encryption
```

#### 3. Sync Failures

```bash
# Debug sync process
npm run secrets:sync -- --verbose

# Check vault status
npm run secrets:status
```

#### 4. Permission Errors

```bash
# Check user permissions
npm run secrets:validate -- --check-permissions

# List available roles
npm run secrets:audit -- --show-roles
```

### Debug Mode

Enable verbose logging:

```bash
export DEBUG=secrets:*
npm run secrets:sync -- --verbose
```

### Log Analysis

Check logs for common patterns:

```bash
# Successful deployments
grep "✅.*deployed" ~/.secrets/logs/deployment.log

# Failed rotations
grep "❌.*rotation" ~/.secrets/logs/rotation.log

# Access denied errors
grep "Access denied" ~/.secrets/logs/audit.log
```

## API Reference

### CICDIntegration Class

```typescript
class CICDIntegration {
  // Deploy secrets to CI/CD platform
  async deploySecrets(
    secrets: PipelineSecret[],
    targetEnvironment: string,
    userId: string
  ): Promise<DeploymentResult>

  // Rotate secrets and update pipelines
  async rotateSecrets(
    secretNames: string[],
    environment: string,
    userId: string
  ): Promise<RotationEvent[]>

  // Sync all secrets from vault
  async syncSecrets(
    environment: string,
    userId: string
  ): Promise<DeploymentResult>

  // Validate pipeline configuration
  async validatePipelineConfig(): Promise<ValidationResult>

  // Generate pipeline configuration files
  async generatePipelineFiles(outputDir: string): Promise<void>

  // Get deployment history
  getDeploymentHistory(filter?: HistoryFilter): SecretDeployment[]

  // Generate deployment report
  generateDeploymentReport(): string
}
```

### PipelineSecret Interface

```typescript
interface PipelineSecret {
  name: string;
  description: string;
  value: string;
  isEncrypted: boolean;
  scope: 'repository' | 'organization' | 'environment';
  environments: string[];
  rotationPolicy?: {
    enabled: boolean;
    intervalDays: number;
  };
}
```

### DeploymentResult Interface

```typescript
interface DeploymentResult {
  success: boolean;
  secretsDeployed: number;
  secretsUpdated: number;
  secretsSkipped: number;
  errors: string[];
  deploymentId: string;
  timestamp: Date;
}
```

## Advanced Usage

### Custom Platform Integration

```typescript
import { CICDIntegration, CICDConfig } from './config/secrets/cicd-integration';

const customConfig: CICDConfig = {
  platform: 'custom',
  environment: 'production',
  projectId: 'my-project',
  encryptionEnabled: true,
  auditLogging: true
};

const integration = new CICDIntegration(customConfig, secretManager);

// Override platform-specific methods
class CustomCICDIntegration extends CICDIntegration {
  protected async deployToCustomPlatform(secrets, environment, result) {
    // Custom deployment logic
    for (const secret of secrets) {
      await this.customPlatformAPI.setSecret(secret.name, secret.value);
      result.secretsDeployed++;
    }
  }
}
```

### Batch Operations

```typescript
// Deploy multiple secret sets
const deploymentBatch = [
  { secrets: productionSecrets, environment: 'production' },
  { secrets: stagingSecrets, environment: 'staging' }
];

for (const batch of deploymentBatch) {
  const result = await integration.deploySecrets(
    batch.secrets,
    batch.environment,
    'batch-user'
  );
  console.log(`${batch.environment}: ${result.secretsDeployed} deployed`);
}
```

### Webhook Integration

Set up webhooks for deployment notifications:

```typescript
// Configure webhook notifications
const config = {
  ...baseConfig,
  notificationChannels: [
    {
      type: 'webhook',
      config: {
        url: 'https://your-webhook-endpoint.com/secrets',
        headers: {
          'Authorization': 'Bearer your-webhook-token'
        }
      }
    }
  ]
};
```

## Migration Guide

### From Manual Secret Management

1. **Audit Current Secrets**
   ```bash
   # List all environment variables in CI/CD
   npm run secrets:audit -- --scan-existing
   ```

2. **Import to Vault**
   ```bash
   # Import secrets from file
   npm run secrets:import -- --file existing-secrets.json
   ```

3. **Validate Migration**
   ```bash
   # Compare vault with CI/CD platform
   npm run secrets:validate -- --compare-with-platform
   ```

4. **Cut Over**
   ```bash
   # Replace CI/CD secrets with vault-managed ones
   npm run secrets:sync -- --replace-existing
   ```

### From Other Secret Management Tools

Support for importing from:
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Kubernetes Secrets

```bash
# Import from HashiCorp Vault
npm run secrets:import -- --source vault --path secret/myapp

# Import from AWS Secrets Manager
npm run secrets:import -- --source aws --region us-east-1 --prefix myapp/

# Import from Azure Key Vault
npm run secrets:import -- --source azure --vault-name myvault
```

## Performance Optimization

### Batching Operations

- Deploy secrets in batches of 50
- Use parallel API calls where supported
- Implement retry logic with exponential backoff

### Caching

- Cache platform tokens for session duration
- Store deployment state locally
- Use ETags for conditional requests

### Rate Limiting

- Respect platform API rate limits
- Implement circuit breakers
- Use exponential backoff for retries

## Compliance and Auditing

### SOC 2 Compliance

- Complete audit trails
- Encryption at rest and in transit
- Access controls and monitoring
- Regular security assessments

### GDPR Compliance

- Data retention policies
- Right to erasure support
- Privacy by design
- Consent management

### Industry Standards

- NIST Cybersecurity Framework
- ISO 27001 alignment
- PCI DSS compliance (where applicable)
- HIPAA compliance (where applicable)

## Contributing

When extending CI/CD integration:

1. Add platform support in `cicd-integration.ts`
2. Create platform-specific deployment methods
3. Generate appropriate configuration files
4. Add comprehensive tests
5. Update documentation
6. Consider security implications

## License

This CI/CD integration system is part of the YieldSensei platform and is subject to the project's licensing terms.