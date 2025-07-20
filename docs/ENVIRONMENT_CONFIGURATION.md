# Environment Configuration Guide

This document provides comprehensive guidance for setting up and managing environment configuration for YieldSensei across different deployment environments.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [Security Requirements](#security-requirements)
5. [Environment-Specific Configurations](#environment-specific-configurations)
6. [Validation System](#validation-system)
7. [Secret Management](#secret-management)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## Overview

YieldSensei uses a comprehensive environment configuration system that provides:

- **Environment-specific configurations** for development, staging, and production
- **Automatic validation** of required environment variables
- **Security enforcement** with different requirements per environment
- **Comprehensive reporting** on configuration status
- **CLI tools** for validation and management

## Quick Start

### 1. Set Up Environment File

```bash
# Copy the template to create your environment file
cp env.template .env

# Edit the .env file with your actual values
nano .env
```

### 2. Generate Required Secrets

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Generate database passwords
POSTGRES_PASSWORD=$(openssl rand -base64 24)
CLICKHOUSE_PASSWORD=$(openssl rand -base64 24)
```

### 3. Validate Configuration

```bash
# Validate current environment
npm run validate-env

# Validate specific environment
npm run validate-env:dev
npm run validate-env:staging
npm run validate-env:prod
```

## Environment Variables

### Critical Security Variables

| Variable | Required | Type | Description | Min Length |
|----------|----------|------|-------------|------------|
| `JWT_SECRET` | ✅ | Secret | JWT signing secret | 32 (prod), 16 (dev) |
| `ENCRYPTION_KEY` | ✅ | Secret | Encryption key for message bus | 32 (prod), 16 (dev) |

### Database Configuration

#### PostgreSQL
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=yieldsensei
POSTGRES_USER=yieldsensei_app
POSTGRES_PASSWORD=your_secure_password
POSTGRES_SSL=false  # true in production
```

#### ClickHouse
```bash
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=yieldsensei
CLICKHOUSE_USER=yieldsensei
CLICKHOUSE_PASSWORD=your_secure_password
```

#### Redis
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

#### Vector Database (Qdrant)
```bash
VECTOR_DB_HOST=localhost
VECTOR_DB_PORT=6333
VECTOR_DB_API_KEY=your_api_key
```

### Application Configuration

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Optional API Keys

```bash
# AI/ML Services
ANTHROPIC_API_KEY=your_anthropic_key
PERPLEXITY_API_KEY=your_perplexity_key
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key

# Blockchain RPCs
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your_key
POLYGON_RPC_URL=https://polygon-mainnet.alchemyapi.io/v2/your_key
ARBITRUM_RPC_URL=https://arb-mainnet.alchemyapi.io/v2/your_key
OPTIMISM_RPC_URL=https://opt-mainnet.alchemyapi.io/v2/your_key

# External Services
ELIZAOS_API_KEY=your_elizaos_key
TWITTER_API_KEY=your_twitter_key
DISCORD_BOT_TOKEN=your_discord_token
TELEGRAM_BOT_TOKEN=your_telegram_token
```

## Security Requirements

### Development Environment

- **Minimum secret length**: 16 characters
- **Localhost connections**: Allowed
- **SSL/TLS**: Optional
- **Debug mode**: Can be enabled
- **Mock APIs**: Can be enabled

### Staging Environment

- **Minimum secret length**: 32 characters
- **Localhost connections**: Not allowed
- **SSL/TLS**: Required
- **Debug mode**: Disabled
- **Mock APIs**: Disabled

### Production Environment

- **Minimum secret length**: 32 characters
- **Localhost connections**: Not allowed
- **SSL/TLS**: Required
- **Debug mode**: Disabled
- **Mock APIs**: Disabled
- **External API keys**: Must be valid
- **Rate limiting**: Strict configuration
- **Monitoring**: Enabled

## Environment-Specific Configurations

### Development Configuration

The development configuration (`src/config/environments/development.ts`) provides:

- Relaxed security requirements
- Higher rate limits for convenience
- Debug mode enabled
- Mock external APIs
- More frequent metrics collection

### Production Configuration

The production configuration (`src/config/environments/production.ts`) enforces:

- Strict security requirements
- No localhost connections
- SSL/TLS for all connections
- Disabled debug features
- Strict rate limiting
- Comprehensive monitoring

## Validation System

### Automatic Validation

The validation system automatically checks:

1. **Required variables**: All required variables are present
2. **Type validation**: Variables match expected types
3. **Value validation**: Values meet security requirements
4. **Environment-specific rules**: Different rules per environment

### Validation Commands

```bash
# Validate current environment
npm run validate-env

# Validate specific environment
npm run validate-env:dev
npm run validate-env:staging
npm run validate-env:prod

# Generate validation report
npm run validate-env -- --output=config-report.md
```

### Validation Output

The validation system provides:

- ✅ **Success indicators** for valid configurations
- ❌ **Error messages** for invalid configurations
- ⚠️ **Warning messages** for potential issues
- 📊 **Detailed reports** with configuration status
- 🔒 **Security checklist** with compliance status

## Secret Management

### Secret Generation

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
CLICKHOUSE_PASSWORD=$(openssl rand -base64 24)
```

### Secret Storage

**Development:**
- Store secrets in `.env` file
- Never commit `.env` to version control
- Use different secrets for each developer

**Staging/Production:**
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly (every 90 days)
- Use environment-specific secrets
- Monitor secret usage and access

### Secret Rotation

1. **Generate new secrets** using secure methods
2. **Update configuration** with new secrets
3. **Restart services** to use new secrets
4. **Verify functionality** after rotation
5. **Archive old secrets** securely

## Troubleshooting

### Common Issues

#### Missing Required Variables

```
❌ Missing required environment variable: JWT_SECRET - JWT signing secret for authentication tokens
```

**Solution:** Set the required environment variable in your `.env` file.

#### Weak Secrets

```
⚠️ Weak secret for JWT_SECRET: should be at least 32 characters
```

**Solution:** Generate a stronger secret using `openssl rand -base64 32`.

#### Invalid Environment

```
❌ Unknown environment: invalid_env
```

**Solution:** Use one of: `development`, `staging`, `production`, `test`.

#### Localhost in Production

```
❌ POSTGRES_HOST cannot use localhost in production
```

**Solution:** Use proper database hostnames in production.

### Validation Errors

#### Type Errors

```
❌ Environment variable POSTGRES_PORT must be a number, got: invalid
```

**Solution:** Ensure the variable contains a valid number.

#### URL Errors

```
❌ Environment variable ETHEREUM_RPC_URL must be a valid URL, got: invalid_url
```

**Solution:** Ensure the variable contains a valid URL.

### Debug Mode

Enable debug mode for detailed validation information:

```bash
DEBUG_MODE=true npm run validate-env
```

## Best Practices

### 1. Environment Separation

- Use different `.env` files for each environment
- Never share secrets between environments
- Use environment-specific validation rules

### 2. Secret Management

- Generate secrets using cryptographically secure methods
- Rotate secrets regularly
- Use secret management systems in production
- Monitor secret access and usage

### 3. Configuration Validation

- Validate configuration before deployment
- Include validation in CI/CD pipelines
- Generate and review configuration reports
- Test configuration changes in staging first

### 4. Security Hardening

- Use strong passwords (minimum 32 characters)
- Enable SSL/TLS for all connections
- Disable debug features in production
- Implement proper rate limiting
- Monitor and audit access

### 5. Documentation

- Document all environment variables
- Maintain configuration templates
- Update documentation when adding new variables
- Include examples and validation rules

### 6. Monitoring

- Monitor configuration changes
- Alert on configuration errors
- Track secret usage and rotation
- Audit configuration compliance

## Integration with CI/CD

### Pre-deployment Validation

```yaml
# Example GitHub Actions workflow
- name: Validate Environment Configuration
  run: |
    npm run validate-env:staging
    npm run validate-env:prod
```

### Configuration Reports

```yaml
# Generate and store configuration reports
- name: Generate Configuration Report
  run: npm run validate-env:prod -- --output=config-report.md
- name: Upload Configuration Report
  uses: actions/upload-artifact@v2
  with:
    name: config-report
    path: config-report.md
```

## Support

For issues with environment configuration:

1. Check the validation output for specific errors
2. Review the security requirements for your environment
3. Ensure all required variables are set
4. Verify secret strength and format
5. Check environment-specific validation rules

For additional help, refer to:
- [Security Best Practices](../docs/SECURITY_BEST_PRACTICES.md)
- [Database Schema](../docs/DATABASE_SCHEMA.md)
- [Deployment Guide](../docs/DEPLOYMENT.md) 