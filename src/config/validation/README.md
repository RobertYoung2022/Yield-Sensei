# Configuration Validation and Drift Detection System

A comprehensive system for validating configuration integrity, detecting drift from baseline configurations, and monitoring configuration changes in real-time for the YieldSensei platform.

## Overview

The Configuration Validation and Drift Detection System provides:

- **Deep Configuration Validation**: Type checking, constraint validation, and security checks
- **Drift Detection**: Automated detection of configuration changes from established baselines
- **Real-time Monitoring**: Continuous validation and drift detection with alerting
- **Risk Assessment**: Automatic evaluation of configuration change risks
- **Compliance Reporting**: Detailed reports for audit and compliance requirements

## Architecture

### Core Components

1. **ConfigValidator** - Performs deep validation of configuration structures
2. **DriftDetector** - Detects and analyzes configuration drift from baselines
3. **ConfigMonitor** - Orchestrates validation and drift detection with alerting

### System Flow

```
Configuration Source
        |
        v
   ConfigLoader
        |
        v
  ConfigValidator
        |
   +----+----+
   |         |
   v         v
Validation  DriftDetector
Results        |
   |           |
   +-----+-----+
         |
         v
   ConfigMonitor
         |
    +----+----+
    |         |
    v         v
 Alerts   Reports
```

## Features

### Configuration Validation

#### Built-in Validation Rules

- **Database Configuration**
  - PostgreSQL: host, port, credentials, SSL settings
  - ClickHouse: connection parameters, timeouts
  - Redis: connection, authentication, TTL settings
  - Vector DB: API keys, endpoints

- **Security Configuration**
  - JWT: secret length, expiration, algorithms
  - Encryption: key strength, algorithm validation
  - CORS: origin validation, method restrictions
  - Rate Limiting: window sizes, request limits

- **API Configuration**
  - Server: port ranges, host validation, timeouts
  - Body limits, trust proxy settings

- **Satellite Configuration**
  - Bridge: chain validation, optimization settings
  - Performance: sampling rates, retention periods

#### Custom Validation

```typescript
import { ConfigValidator, ValidationRule } from './config/validation';
import * as Joi from 'joi';

const validator = new ConfigValidator();

// Add custom validation rule
validator.addRule({
  path: 'custom.myService',
  schema: Joi.object({
    apiKey: Joi.string().min(32).required(),
    endpoint: Joi.string().uri().required(),
    timeout: Joi.number().min(1000).default(30000)
  }),
  description: 'My custom service configuration',
  severity: 'error',
  environments: ['production', 'staging']
});

// Add custom validator function
validator.addCustomValidator('api-key-format', (value, config) => {
  const apiKeys = extractApiKeys(config);
  const errors = [];
  
  for (const [name, key] of Object.entries(apiKeys)) {
    if (!isValidApiKeyFormat(key)) {
      errors.push({
        path: `apiKeys.${name}`,
        message: 'Invalid API key format',
        type: 'format',
        timestamp: new Date()
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    statistics: { /* ... */ }
  };
});
```

### Drift Detection

#### Baseline Management

```typescript
import { createConfigBaseline, checkConfigDrift } from './config/validation';

// Create baseline from current configuration
createConfigBaseline();

// Create baseline with custom path
createConfigBaseline('/path/to/baseline.json');

// Check for drift
const driftReport = await checkConfigDrift();
if (driftReport && driftReport.driftDetected) {
  console.log('Configuration drift detected!');
  console.log('Risk level:', driftReport.riskAssessment.overallRisk);
}
```

#### Risk Assessment

The system automatically assesses risk levels for configuration changes:

- **Critical Risk**: Multiple high-risk changes or critical security modifications
- **High Risk**: Changes to security, authentication, or critical infrastructure
- **Medium Risk**: Changes to database connections, API settings
- **Low Risk**: Changes to non-critical settings like timeouts, logging levels

#### Ignored Patterns

Configure patterns to ignore during drift detection:

```typescript
const driftConfig = {
  ignorePatterns: [
    'monitoring.performance.metricsInterval',
    'api.server.timeout',
    '.*\\.cache.*',
    'logging.level'
  ]
};
```

### Real-time Monitoring

#### Starting the Monitor

```typescript
import { createConfigMonitor } from './config/validation';

const monitor = createConfigMonitor({
  validationInterval: 300000, // 5 minutes
  driftCheckInterval: 600000, // 10 minutes
  alerting: {
    enabled: true,
    channels: [
      {
        type: 'console',
        config: {},
        severity: ['high', 'critical']
      },
      {
        type: 'webhook',
        config: { url: 'https://alerts.example.com/config' },
        severity: ['medium', 'high', 'critical']
      }
    ],
    thresholds: {
      errorCount: 3,
      warningCount: 10,
      driftSeverity: 'medium'
    }
  }
});

await monitor.start();
```

#### Scheduled Tasks

Configure automated tasks:

```typescript
schedules: [
  {
    name: 'daily-validation',
    cron: '0 2 * * *', // 2 AM daily
    action: 'validate'
  },
  {
    name: 'hourly-drift-check',
    cron: '0 * * * *', // Every hour
    action: 'drift-check'
  },
  {
    name: 'weekly-report',
    cron: '0 9 * * 1', // Monday 9 AM
    action: 'report',
    config: { 
      recipients: ['ops@example.com'],
      includeHistory: true
    }
  }
]
```

### Alerting

#### Alert Channels

1. **Console** - Immediate console output for critical issues
2. **File** - JSON files for audit trails
3. **Webhook** - HTTP POST to external systems
4. **Slack** - Direct Slack integration
5. **PagerDuty** - Incident creation for critical issues

#### Alert Configuration

```typescript
alerting: {
  enabled: true,
  channels: [
    {
      type: 'slack',
      config: {
        webhook: process.env.SLACK_WEBHOOK,
        channel: '#ops-alerts',
        username: 'Config Monitor'
      },
      severity: ['high', 'critical']
    },
    {
      type: 'pagerduty',
      config: {
        routingKey: process.env.PAGERDUTY_KEY,
        dedupKey: 'config-drift'
      },
      severity: ['critical']
    }
  ]
}
```

## Usage

### CLI Commands

```bash
# Validate current configuration
npm run config:validate

# Check for configuration drift
npm run config:drift

# Start configuration monitor
npm run config:monitor

# Create configuration baseline
npm run config:baseline
```

### Programmatic Usage

```typescript
import { 
  validateCurrentConfig,
  checkConfigDrift,
  createConfigMonitor 
} from './config/validation';

// Quick validation
const validationResult = await validateCurrentConfig();
if (!validationResult.valid) {
  console.error('Configuration errors:', validationResult.errors);
}

// Check drift
const driftReport = await checkConfigDrift();
if (driftReport?.driftDetected) {
  console.warn('Drift detected:', driftReport.changes);
}

// Start monitoring
const monitor = createConfigMonitor();
monitor.on('drift-detected', (event) => {
  console.log('Drift event:', event);
});
monitor.on('validation-failed', (result) => {
  console.error('Validation failed:', result);
});
await monitor.start();
```

### Integration with CI/CD

#### GitHub Actions Example

```yaml
name: Configuration Validation

on:
  push:
    paths:
      - 'src/config/**'
      - '.env.example'
  pull_request:
    paths:
      - 'src/config/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Validate configuration
        run: npm run config:validate
        
      - name: Check configuration drift
        run: npm run config:drift
        
      - name: Upload validation report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: config-validation-report
          path: .config/validation-report.md
```

#### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Validating configuration..."
npm run config:validate --silent

if [ $? -ne 0 ]; then
  echo "❌ Configuration validation failed. Please fix errors before committing."
  exit 1
fi

echo "✅ Configuration validation passed"
```

## Reports

### Validation Report

Generated reports include:

- Validation status and timestamp
- Summary statistics
- Detailed error listings with paths and suggestions
- Warning analysis with recommendations
- Security check results

### Drift Report

Drift reports contain:

- Baseline comparison details
- List of all configuration changes
- Risk assessment for each change
- Overall risk evaluation
- Specific recommendations for remediation

### Example Report Output

```markdown
# Configuration Validation Report

**Timestamp:** 2024-01-20T10:30:00Z
**Status:** ❌ INVALID

## Summary
- Total Checks: 45
- Passed: 41
- Failed: 4
- Warnings: 7
- Duration: 125ms

## ❌ Errors (4)

### security.jwt.secret
- **Message:** String must contain at least 32 characters
- **Value:** "short_secret"
- **Type:** string.min
- **Time:** 2024-01-20T10:30:00Z

### database.postgres.ssl
- **Message:** SSL must be enabled for PostgreSQL in production
- **Type:** security
- **Time:** 2024-01-20T10:30:00Z

## ⚠️ Warnings (7)

### security.cors.origin
- **Message:** CORS origin set to wildcard (*) is insecure
- **Suggestion:** Specify allowed origins explicitly
- **Time:** 2024-01-20T10:30:00Z
```

## Security Considerations

### Sensitive Data Protection

1. **Secret Masking**: All sensitive values are masked in logs and reports
2. **Baseline Encryption**: Option to encrypt baseline files
3. **Audit Logging**: All configuration access is logged
4. **Access Control**: Integration with RBAC for configuration management

### Best Practices

1. **Environment Separation**: Maintain separate baselines for each environment
2. **Regular Baselines**: Update baselines after approved changes
3. **Drift Alerts**: Configure immediate alerts for production drift
4. **Compliance Reports**: Generate regular reports for audit requirements

## Performance

### Optimization Strategies

1. **Incremental Validation**: Only validate changed sections
2. **Caching**: Cache validation schemas and results
3. **Async Operations**: Non-blocking validation and drift checks
4. **Resource Limits**: Configurable memory and CPU limits

### Benchmarks

- Average validation time: < 100ms for standard configuration
- Drift detection: < 200ms for typical comparison
- Memory usage: < 50MB for monitoring process
- Concurrent validations: Supports 100+ simultaneous checks

## Troubleshooting

### Common Issues

#### Validation Failures

```bash
# Check detailed validation errors
npm run config:validate -- --verbose

# Validate specific configuration file
npm run config:validate -- --config ./config/custom.json
```

#### Drift Detection Issues

```bash
# Reset baseline after approved changes
npm run config:baseline -- --force

# Check drift with custom baseline
npm run config:drift -- --baseline ./baselines/prod.json
```

#### Monitor Not Starting

```bash
# Check monitor logs
npm run config:monitor -- --debug

# Verify file permissions
ls -la .config/
```

### Debug Mode

Enable debug logging:

```typescript
const monitor = createConfigMonitor({
  debug: true,
  logLevel: 'debug'
});
```

## API Reference

### ConfigValidator

```typescript
class ConfigValidator {
  validate(config: Record<string, any>, environment?: string): ValidationResult
  createSnapshot(config: Record<string, any>, metadata?: Record<string, any>): ConfigSnapshot
  compareSnapshots(snapshot1: ConfigSnapshot, snapshot2: ConfigSnapshot): ComparisonResult
  addRule(rule: ValidationRule): void
  addCustomValidator(name: string, validator: CustomValidator): void
  generateReport(result: ValidationResult): string
}
```

### DriftDetector

```typescript
class DriftDetector extends EventEmitter {
  start(): void
  stop(): void
  checkForDrift(currentConfig?: Record<string, any>): Promise<DriftReport | null>
  saveBaseline(config: Record<string, any>): void
  getDriftHistory(filter?: DriftHistoryFilter): DriftEvent[]
  generateHistoryReport(): string
}
```

### ConfigMonitor

```typescript
class ConfigMonitor extends EventEmitter {
  start(): Promise<void>
  stop(): void
  getStatus(): MonitorStatus
  generateReport(): Promise<string>
  createBaseline(config?: Record<string, any>): void
  validateConfig(config: Record<string, any>): Promise<ValidationResult>
  checkDrift(config: Record<string, any>): Promise<DriftReport | null>
}
```

## Contributing

When adding new validation rules:

1. Add the rule to the appropriate section in `config-validator.ts`
2. Include comprehensive test cases
3. Update this documentation
4. Consider environment-specific applicability
5. Add to the security checklist if applicable

## License

This configuration validation and drift detection system is part of the YieldSensei platform and is subject to the project's licensing terms.