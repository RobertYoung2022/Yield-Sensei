# Encryption Validation Report

**Generated:** 2025-07-25T19:46:04.542Z

## Summary

- **Total Tests:** 45
- **Passed:** 34
- **Failed:** 11
- **Success Rate:** 75.56%

## ⚠️ Critical Failures

- VaultManager: Vault encryption/decryption - TEST_SECRET_1
- VaultManager: Vault encryption/decryption - TEST_SECRET_2
- VaultManager: Vault encryption/decryption - TEST_SECRET_3
- VaultManager: Vault encryption/decryption - TEST_SECRET_4

## Warnings

- Simplified test - real implementation should track key usage

## Recommendations

- Review and fix failing encryption tests
- Critical encryption failures detected - immediate attention required

## Detailed Results

### AES-256-GCM

✅ **Small data (16 bytes)**
   - Encryption Time: 0ms
   - Data Size: 16 bytes
   - Metadata: originalSize: 16, encryptedSize: 16, ivSize: 12, tagSize: 16

✅ **Medium data (1KB)**
   - Encryption Time: 0ms
   - Data Size: 1024 bytes
   - Metadata: originalSize: 1024, encryptedSize: 1024, ivSize: 12, tagSize: 16

✅ **Large data (1MB)**
   - Encryption Time: 1ms
   - Data Size: 1048576 bytes
   - Metadata: originalSize: 1048576, encryptedSize: 1048576, ivSize: 12, tagSize: 16

✅ **Empty data**
   - Encryption Time: 0ms
   - Data Size: 0 bytes
   - Metadata: originalSize: 0, encryptedSize: 0, ivSize: 12, tagSize: 16

✅ **UTF-8 text**
   - Encryption Time: 0ms
   - Data Size: 19 bytes
   - Metadata: originalSize: 19, encryptedSize: 19, ivSize: 12, tagSize: 16

✅ **Binary data**
   - Encryption Time: 0ms
   - Data Size: 256 bytes
   - Metadata: originalSize: 256, encryptedSize: 256, ivSize: 12, tagSize: 16

✅ **Empty data encryption**
   - Metadata: dataSize: 0

✅ **Large data encryption (10MB)**
   - Encryption Time: 6ms
   - Data Size: 10485760 bytes
   - Metadata: dataSize: 10MB

✅ **Invalid key handling (9 bytes)**
   - Metadata: keySize: 9, errorHandled: true

✅ **Invalid key handling (0 bytes)**
   - Metadata: keySize: 0, errorHandled: true

✅ **Invalid key handling (31 bytes)**
   - Metadata: keySize: 31, errorHandled: true

✅ **Invalid key handling (33 bytes)**
   - Metadata: keySize: 33, errorHandled: true

### AES-GCM

✅ **AES-256-GCM encryption**
   - Metadata: keySize: 256

❌ **AES-192-GCM encryption**
   - Error: Invalid key length

❌ **AES-128-GCM encryption**
   - Error: Invalid key length

### RSA

✅ **RSA-2048 key generation and encryption**
   - Encryption Time: 1ms
   - Data Size: 24 bytes
   - Metadata: keySize: 2048, generationTime: 122, originalSize: 24, encryptedSize: 256

✅ **RSA-4096 key generation and encryption**
   - Encryption Time: 0ms
   - Data Size: 24 bytes
   - Metadata: keySize: 4096, generationTime: 716, originalSize: 24, encryptedSize: 512

### HMAC

✅ **HMAC-SHA256**
   - Encryption Time: 0ms
   - Data Size: 24 bytes
   - Metadata: algorithm: SHA256

✅ **HMAC-SHA256 tampering detection**
   - Metadata: tamperingDetected: true, algorithm: SHA256

✅ **HMAC-SHA512**
   - Encryption Time: 1ms
   - Data Size: 24 bytes
   - Metadata: algorithm: SHA512

✅ **HMAC-SHA512 tampering detection**
   - Metadata: tamperingDetected: true, algorithm: SHA512

### Scrypt

✅ **Password hashing (14 chars)**
   - Encryption Time: 43ms
   - Data Size: 14 bytes
   - Metadata: passwordLength: 14, saltLength: 16, hashLength: 64

✅ **Wrong password detection**
   - Metadata: wrongPasswordDetected: true

✅ **Password hashing (19 chars)**
   - Encryption Time: 42ms
   - Data Size: 19 bytes
   - Metadata: passwordLength: 19, saltLength: 16, hashLength: 64

✅ **Wrong password detection**
   - Metadata: wrongPasswordDetected: true

✅ **Password hashing (10 chars)**
   - Encryption Time: 42ms
   - Data Size: 20 bytes
   - Metadata: passwordLength: 10, saltLength: 16, hashLength: 64

✅ **Wrong password detection**
   - Metadata: wrongPasswordDetected: true

✅ **Password hashing (100 chars)**
   - Encryption Time: 42ms
   - Data Size: 100 bytes
   - Metadata: passwordLength: 100, saltLength: 16, hashLength: 64

✅ **Wrong password detection**
   - Metadata: wrongPasswordDetected: true

✅ **Password hashing (43 chars)**
   - Encryption Time: 41ms
   - Data Size: 43 bytes
   - Metadata: passwordLength: 43, saltLength: 16, hashLength: 64

✅ **Wrong password detection**
   - Metadata: wrongPasswordDetected: true

✅ **Scrypt key derivation**
   - Encryption Time: 41ms
   - Data Size: 32 bytes
   - Metadata: keyLength: 32

✅ **Timing attack resistance**
   - Metadata: averageTime: 20.7984334, standardDeviation: 1.0877007951628246, coefficientOfVariation: 0.052297246347545796, timingConsistent: true

### PBKDF2

✅ **PBKDF2-SHA256 key derivation**
   - Encryption Time: 34ms
   - Data Size: 32 bytes
   - Metadata: iterations: 100000, keyLength: 32

### VaultManager

❌ **Vault encryption/decryption - TEST_SECRET_1**
   - Error: ENOENT: no such file or directory, open 'data/secrets/secret_test_secret_1_1753472764321.json'

❌ **Vault encryption/decryption - TEST_SECRET_2**
   - Error: ENOENT: no such file or directory, open 'data/secrets/secret_test_secret_2_1753472764322.json'

❌ **Vault encryption/decryption - TEST_SECRET_3**
   - Error: ENOENT: no such file or directory, open 'data/secrets/secret_test_secret_3_1753472764322.json'

❌ **Vault encryption/decryption - TEST_SECRET_4**
   - Error: ENOENT: no such file or directory, open 'data/secrets/secret_test_secret_4_1753472764322.json'

### KeyManager

❌ **Key generation/retrieval - symmetric/aes-256-gcm**
   - Error: Access denied: User not found or inactive

❌ **Key generation/retrieval - asymmetric/rsa-2048**
   - Error: Access denied: User not found or inactive

❌ **Key generation/retrieval - signing/ed25519**
   - Error: Access denied: User not found or inactive

❌ **Key generation/retrieval - derivation/hmac-sha256**
   - Error: Access denied: User not found or inactive

### SecretManager

❌ **System integration test**
   - Error: Access denied: User not found or inactive

### Key Generation

✅ **Key reuse detection**
   - Metadata: uniqueKeysGenerated: true, warning: Simplified test - real implementation should track key usage

### IV Generation

✅ **IV reuse detection**
   - Metadata: totalIVs: 10, uniqueIVs: 10, noDuplicates: true

