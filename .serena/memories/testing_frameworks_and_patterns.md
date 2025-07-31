# YieldSensei Testing Frameworks and Patterns

## Primary Testing Framework
- **Jest**: Main testing framework with comprehensive configuration
- **ts-jest**: TypeScript integration with ESM module support
- **Test Environment**: Node.js environment
- **Test Patterns**: `tests/**/*.ts` and `tests/**/*.mts`

## Testing Architecture Patterns

### 1. Test Organization
```
tests/
├── security/           # Security validation tests
├── integration/        # Integration tests
├── satellites/         # Satellite-specific tests
├── performance/        # Load and stress tests
├── e2e/               # End-to-end tests
└── wasm-integration.test.mts  # WebAssembly tests
```

### 2. Mock Strategy
- **Comprehensive Mocking**: Extensive use of Jest mocks for external dependencies
- **Mock Directory**: `__mocks__/` for shared mocks (e.g., Qdrant client)
- **Component Isolation**: Database, messaging, and external API mocking

### 3. Security Testing Framework
- **Custom Security Validators**: Comprehensive security validation system
- **OWASP Compliance Testing**: Automated security standard compliance
- **Multiple Security Categories**: Authentication, authorization, injection, XSS, CSRF, etc.
- **CLI-Based Testing**: Command-line security validation tools

## Rust Testing
- **Native Rust Tests**: Using `#[cfg(test)]` and `#[tokio::test]` patterns
- **Comprehensive Coverage**: Unit tests for simulation and stress testing
- **Integration with TypeScript**: Rust components tested independently

## Testing Utilities and Helpers
- **Mock Frameworks**: Custom mock implementations for complex scenarios
- **Test Data Generators**: Comprehensive test data factories
- **Performance Testing**: Custom mock framework for load testing
- **Event Testing**: Event emission and handling validation

## Jest Configuration Features
- **Module Mapping**: Path aliases for clean imports (`@/core`, `@/shared`, etc.)
- **TypeScript Support**: Full TypeScript integration with ts-jest
- **Coverage**: Built-in coverage reporting
- **Watch Mode**: Development-friendly watch mode testing

## Test Categories
1. **Unit Tests**: Component and function-level testing
2. **Integration Tests**: Multi-component interaction testing
3. **Security Tests**: Comprehensive security validation
4. **Performance Tests**: Load, stress, and failover testing
5. **E2E Tests**: Full application workflow testing
6. **Satellite Tests**: Individual satellite system testing