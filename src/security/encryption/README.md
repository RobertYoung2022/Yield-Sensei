# Encryption Validation System

Comprehensive validation and testing framework for all encryption mechanisms used throughout the YieldSensei platform.

## Overview

The encryption validation system provides automated testing and validation of:

- **Core Encryption Algorithms**: AES-256-GCM, RSA, HMAC, Scrypt, PBKDF2
- **System Integration**: VaultManager, KeyManager, SecretManager
- **Security Properties**: Timing attack resistance, key/IV reuse detection
- **Edge Cases**: Invalid inputs, large data, empty data
- **Performance**: Encryption/decryption timing and throughput

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the validation system
npm run build
```

### Basic Usage

```bash
# Run quick validation (core algorithms only)
npm run encryption:validate-quick

# Run full validation suite
npm run encryption:validate

# Generate detailed report
npm run encryption:report
```

### Command Line Interface

```bash
# Run validation with custom options
npx tsx src/security/encryption/validation-runner.ts validate \
  --output encryption-results.json \
  --format json \
  --verbose

# Quick validation for CI/CD
npx tsx src/security/encryption/validation-runner.ts quick

# Generate comprehensive report
npx tsx src/security/encryption/validation-runner.ts report \
  --output encryption-audit.md \
  --format markdown
```

## Architecture

### Core Components

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  EncryptionValidator│    │   ValidationRunner  │    │   Test Results      │
│                     │    │                     │    │                     │
│ - Algorithm Tests   │◄──►│ - CLI Interface     │◄──►│ - JSON Reports      │
│ - Integration Tests │    │ - Report Generation │    │ - Markdown Reports  │
│ - Security Tests    │    │ - Performance Metrics│   │ - Console Output    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
        │                            │                            │
        │                            │                            │
        ▼                            ▼                            ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   System Under Test │    │   Configuration     │    │   CI/CD Integration │
│                     │    │                     │    │                     │
│ - VaultManager      │    │ - Test Parameters   │    │ - Automated Testing │
│ - KeyManager        │    │ - Output Formats    │    │ - Quality Gates     │
│ - SecretManager     │    │ - Validation Rules  │    │ - Security Audits   │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Test Categories

#### 1. Core Algorithm Testing
- **AES-256-GCM**: Symmetric encryption with authentication
- **RSA**: Asymmetric encryption with multiple key sizes
- **HMAC**: Message authentication (SHA-256, SHA-512)
- **Scrypt**: Password hashing and key derivation
- **PBKDF2**: Alternative key derivation function

#### 2. System Integration Testing
- **VaultManager**: Secret storage and retrieval encryption
- **KeyManager**: Cryptographic key generation and management
- **SecretManager**: End-to-end secret management workflow

#### 3. Security Testing
- **Timing Attack Resistance**: Consistent operation timing
- **Key Reuse Detection**: Unique key generation validation
- **IV Reuse Detection**: Initialization vector uniqueness
- **Tampering Detection**: HMAC integrity verification

#### 4. Edge Case Testing
- **Empty Data**: Zero-length input handling
- **Large Data**: Multi-megabyte encryption performance
- **Invalid Keys**: Error handling for malformed keys
- **Boundary Conditions**: Edge cases and limits

## API Reference

### EncryptionValidator Class

```typescript
class EncryptionValidator {
  constructor(
    vaultManager?: VaultManager,
    keyManager?: KeyManager,
    secretManager?: SecretManager
  )

  // Run complete validation suite
  async validateAll(): Promise<ValidationSummary>

  // Get detailed test results
  getResults(): EncryptionTestResult[]

  // Generate human-readable report
  generateReport(): string
}
```

### Test Result Interface

```typescript
interface EncryptionTestResult {
  algorithm: string;           // Algorithm being tested
  testName: string;           // Descriptive test name
  passed: boolean;            // Test pass/fail status
  error?: string;             // Error message if failed
  performance?: {             // Performance metrics
    encryptionTime: number;   // Time in milliseconds
    decryptionTime: number;   // Time in milliseconds
    dataSize: number;         // Data size in bytes
  };
  metadata?: Record<string, any>; // Additional test metadata
}
```

### Validation Summary Interface

```typescript
interface ValidationSummary {
  totalTests: number;         // Total number of tests run
  passed: number;             // Number of tests passed
  failed: number;             // Number of tests failed
  successRate: number;        // Success rate percentage
  criticalFailures: string[]; // Critical failures requiring attention
  warnings: string[];         // Non-critical warnings
  recommendations: string[];  // Actionable recommendations
}
```

## Usage Examples

### Programmatic Usage

```typescript
import { EncryptionValidator } from './encryption-validator';
import { SecretManager } from '../../config/secrets';

// Initialize with full system integration
const secretManager = new SecretManager(config);
await secretManager.initialize();

const validator = new EncryptionValidator(
  secretManager.getVaultManager(),
  secretManager.getKeyManager(),
  secretManager
);

// Run validation
const summary = await validator.validateAll();

console.log(`Success Rate: ${summary.successRate}%`);
console.log(`Critical Failures: ${summary.criticalFailures.length}`);

// Generate detailed report
const report = validator.generateReport();
console.log(report);
```

### Standalone Testing

```typescript
// Test core algorithms without system dependencies
const validator = new EncryptionValidator();
const summary = await validator.validateAll();

// Focus on specific algorithm
await validator['testAESEncryption']();
const results = validator.getResults();
const aesResults = results.filter(r => r.algorithm === 'AES-256-GCM');
```

### CI/CD Integration

```bash
#!/bin/bash
# ci-encryption-validation.sh

echo "Running encryption validation..."

# Quick validation for fast feedback
npx tsx src/security/encryption/validation-runner.ts quick

if [ $? -ne 0 ]; then
  echo "❌ Quick validation failed"
  exit 1
fi

# Full validation for comprehensive testing
npx tsx src/security/encryption/validation-runner.ts validate \
  --output encryption-results.json \
  --format json

if [ $? -ne 0 ]; then
  echo "❌ Full validation failed"
  exit 1
fi

echo "✅ Encryption validation passed"
```

## Configuration

### Environment Variables

```bash
# Secret management configuration
NODE_ENV=production
VAULT_ENCRYPTION_KEY=your-32-character-encryption-key

# Validation options
ENCRYPTION_VALIDATION_VERBOSE=true
ENCRYPTION_VALIDATION_INCLUDE_PERFORMANCE=true
ENCRYPTION_VALIDATION_QUICK_MODE=false
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "encryption:validate": "tsx src/security/encryption/validation-runner.ts validate",
    "encryption:validate-quick": "tsx src/security/encryption/validation-runner.ts quick",
    "encryption:report": "tsx src/security/encryption/validation-runner.ts report",
    "encryption:test": "jest src/security/encryption/__tests__/",
    "ci:encryption": "npm run encryption:validate-quick && npm run encryption:validate"
  }
}
```

## Test Results Interpretation

### Success Criteria

- **Success Rate ≥ 95%**: All critical encryption functions working
- **Zero Critical Failures**: Core algorithms (AES, HMAC) must pass
- **Performance Acceptable**: Encryption times within reasonable bounds

### Warning Indicators

- **Success Rate 90-94%**: Some non-critical tests failing
- **Slow Performance**: Encryption times > 1000ms for small data
- **Missing Integration**: System components not fully tested

### Failure Scenarios

- **Success Rate < 90%**: Major encryption issues
- **Critical Failures Present**: Core security compromised
- **Integration Failures**: System-level encryption broken

### Sample Output

```
📊 Encryption Validation Results
================================

✅ Tests Passed:     47/50
❌ Tests Failed:     3/50
📈 Success Rate:     94.00%
⏱️  Duration:         2,341ms

💡 Recommendations:
   - Review and fix failing encryption tests
   - Consider optimizing slow encryption operations

✅ Encryption validation completed successfully
```

## Performance Benchmarks

### Expected Performance Ranges

| Algorithm | Data Size | Expected Time | Max Acceptable |
|-----------|-----------|---------------|----------------|
| AES-256-GCM | 1KB | 1-5ms | 50ms |
| AES-256-GCM | 1MB | 10-50ms | 500ms |
| RSA-2048 | 256 bytes | 5-20ms | 100ms |
| HMAC-SHA256 | 1KB | 0.1-1ms | 10ms |
| Scrypt | Password | 50-200ms | 1000ms |

### Performance Optimization

```typescript
// Example: Optimizing large data encryption
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

function encryptLargeData(data: Buffer, key: Buffer): Buffer {
  const chunks = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    chunks.push(encryptChunk(chunk, key));
  }
  return Buffer.concat(chunks);
}
```

## Security Considerations

### Critical Security Properties

1. **Confidentiality**: Data encrypted with strong algorithms
2. **Integrity**: HMAC authentication prevents tampering
3. **Authentication**: Proper key management and access control
4. **Non-repudiation**: Audit trails for all operations

### Security Best Practices

- **Key Management**: Proper key generation, storage, and rotation
- **Algorithm Selection**: Use approved cryptographic algorithms
- **Implementation**: Avoid common crypto implementation pitfalls
- **Validation**: Regular testing of encryption mechanisms

### Common Vulnerabilities Tested

```typescript
// Timing attack resistance
async testTimingAttackResistance(): Promise<void> {
  // Measure timing variance across operations
  // Ensure consistent timing regardless of input
}

// Key reuse detection
async testKeyReuseDetection(): Promise<void> {
  // Verify unique key generation
  // Detect inappropriate key reuse
}

// IV reuse detection
async testIVReuseDetection(): Promise<void> {
  // Ensure IV uniqueness
  // Prevent cryptographic vulnerabilities
}
```

## Troubleshooting

### Common Issues

#### 1. Test Failures

```bash
# Check system dependencies
npm run encryption:validate-quick

# Review detailed error messages
npm run encryption:validate --verbose

# Test specific algorithms
npx tsx -e "
import { EncryptionValidator } from './src/security/encryption/encryption-validator';
const v = new EncryptionValidator();
await v['testAESEncryption']();
console.log(v.getResults());
"
```

#### 2. Performance Issues

```bash
# Profile encryption performance
npm run encryption:validate --include-performance

# Test with different data sizes
npm run encryption:report --verbose
```

#### 3. Integration Failures

```bash
# Check secret manager initialization
npm run secrets:status

# Verify vault encryption key
echo $VAULT_ENCRYPTION_KEY | wc -c  # Should be 33 (32 chars + newline)

# Test vault connectivity
npm run secrets:validate
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=encryption:*
npm run encryption:validate --verbose

# Trace specific test execution
export NODE_OPTIONS="--trace-warnings"
npm run encryption:validate
```

## Contributing

### Adding New Tests

1. **Extend EncryptionValidator**: Add new test methods
2. **Update Test Suite**: Add corresponding unit tests
3. **Update Documentation**: Document new validation capabilities
4. **Performance Baseline**: Establish performance expectations

### Test Categories

```typescript
// Core algorithm test
private async testNewAlgorithm(): Promise<void> {
  // Implementation
}

// Integration test
private async testNewIntegration(): Promise<void> {
  // Implementation
}

// Security property test
private async testNewSecurityProperty(): Promise<void> {
  // Implementation
}
```

### Code Quality

- **Type Safety**: All functions properly typed
- **Error Handling**: Graceful failure handling
- **Performance**: Measure and optimize test execution
- **Documentation**: Comprehensive inline documentation

## License

This encryption validation system is part of the YieldSensei platform and is subject to the project's licensing terms.

## Security Disclosure

If you discover security vulnerabilities in the encryption validation system or identify gaps in testing coverage, please report them according to the project's security disclosure policy.