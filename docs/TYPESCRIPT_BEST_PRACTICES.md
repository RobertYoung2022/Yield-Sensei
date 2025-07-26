# TypeScript Best Practices for YieldSensei

This document outlines TypeScript best practices and coding standards for the YieldSensei project to maintain high code quality and type safety.

## Table of Contents
1. [Type Safety Standards](#type-safety-standards)
2. [Coding Conventions](#coding-conventions)
3. [Error Prevention](#error-prevention)
4. [Build System Integration](#build-system-integration)
5. [Tools and Automation](#tools-and-automation)

## Type Safety Standards

### Strict Mode Configuration
Our `tsconfig.json` enforces strict type checking:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noImplicitThis": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### Type Annotation Guidelines

#### ✅ DO: Use explicit types for function parameters and return values
```typescript
function calculateYield(amount: number, rate: number): number {
  return amount * rate;
}

interface PortfolioConfig {
  riskTolerance: 'low' | 'medium' | 'high';
  maxAllocation: number;
}
```

#### ❌ DON'T: Rely on implicit any types
```typescript
// Bad
function processData(data) { // implicit any
  return data.someProperty;
}

// Good  
function processData(data: PortfolioData): ProcessedResult {
  return {
    value: data.totalValue,
    risk: data.riskScore
  };
}
```

### Optional Properties and Null Safety

#### ✅ DO: Handle optional properties safely
```typescript
interface UserConfig {
  apiKey?: string;
  timeout?: number;
}

function initializeUser(config: UserConfig): void {
  // Use nullish coalescing for defaults
  const apiKey = config.apiKey ?? 'default-key';
  const timeout = config.timeout ?? 5000;
  
  // Check for existence before use
  if (config.apiKey) {
    authenticateWithKey(config.apiKey);
  }
}
```

#### ❌ DON'T: Access optional properties without checking
```typescript
// Bad - may throw at runtime
function badExample(config: UserConfig): void {
  const key = config.apiKey.toUpperCase(); // Error if undefined
}
```

### Array and Index Access Safety

With `noUncheckedIndexedAccess` enabled, array access requires safety checks:

#### ✅ DO: Check array bounds or use optional chaining
```typescript
function getFirstItem<T>(items: T[]): T | undefined {
  return items[0]; // TypeScript knows this could be undefined
}

function processArray(items: string[]): void {
  const first = items[0];
  if (first) {
    console.log(first.toUpperCase());
  }
  
  // Or use optional chaining
  console.log(items[0]?.toUpperCase());
}
```

## Coding Conventions

### Interface Design

#### ✅ DO: Use descriptive interface names with clear purposes
```typescript
interface ArbitrageOpportunity {
  readonly id: string;
  readonly assetPair: {
    base: AssetID;
    quote: AssetID;
  };
  profitMargin: number;
  executionTime: number;
  riskScore: number;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  credentials: {
    username: string;
    password: string;
  };
}
```

### Generic Types

#### ✅ DO: Use meaningful generic constraints
```typescript
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<boolean>;
}

interface ApiResponse<TData = unknown> {
  success: boolean;
  data: TData;
  message?: string;
  timestamp: string;
}
```

### Error Handling

#### ✅ DO: Use discriminated unions for error handling
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function fetchPortfolio(id: string): Promise<Result<Portfolio, PortfolioError>> {
  try {
    const portfolio = await portfolioService.getById(id);
    return { success: true, data: portfolio };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof PortfolioError 
        ? error 
        : new PortfolioError('Unknown error', error) 
    };
  }
}
```

## Error Prevention

### Common Pitfalls to Avoid

#### 1. Type Assertions vs Type Guards
```typescript
// ❌ Bad - unsafe type assertion
const user = data as User;

// ✅ Good - type guard
function isUser(data: unknown): data is User {
  return typeof data === 'object' && 
         data !== null && 
         'id' in data && 
         'email' in data;
}

if (isUser(data)) {
  // TypeScript knows data is User here
  console.log(data.email);
}
```

#### 2. Non-null Assertions
```typescript
// ❌ Use sparingly and only when certain
const element = document.getElementById('my-element')!;

// ✅ Better - handle the null case
const element = document.getElementById('my-element');
if (!element) {
  throw new Error('Required element not found');
}
```

#### 3. Object Property Access
```typescript
// ❌ Bad - may fail with exactOptionalPropertyTypes
interface Config {
  database?: DatabaseConfig;
}

function badAccess(config: Config) {
  if (config.database) {
    // Still might be undefined with exact optional properties
    return config.database.host;
  }
}

// ✅ Good - explicit handling
function goodAccess(config: Config) {
  const db = config.database;
  if (db !== undefined) {
    return db.host;
  }
  return 'localhost';
}
```

## Build System Integration

### Pre-commit Hooks
Our Husky configuration runs type checking before commits:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write", 
      "bash -c 'npm run typecheck'"
    ]
  }
}
```

### CI Pipeline
The type safety workflow ensures:
- ✅ TypeScript compilation succeeds
- ✅ Type coverage meets minimum threshold (85%)
- ✅ ESLint type-aware rules pass
- ✅ Limited use of `any` types (≤50 instances)

### Scripts for Type Safety
```bash
# Type checking
npm run typecheck

# Type coverage analysis
npm run type-coverage
npm run type-coverage:check

# Full type safety check
npm run lint && npm run typecheck && npm run type-coverage:check
```

## Tools and Automation

### Recommended VSCode Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.eslint",
    "usernamehw.errorlens"
  ]
}
```

### TypeScript Configuration for Development
```json
{
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.preferences.strictNullChecks": true,
  "typescript.preferences.noImplicitAny": true,
  "typescript.suggest.autoImports": true,
  "typescript.preferences.includePackageJsonAutoImports": "auto"
}
```

### Debugging Type Issues

#### 1. Type Coverage Analysis
```bash
# Get detailed type coverage report
npm run type-coverage

# Check specific files
npx type-coverage --detail src/specific-file.ts
```

#### 2. TypeScript Compiler Diagnostics
```bash
# Verbose compilation errors
npx tsc --noEmit --listFiles --extendedDiagnostics

# Show config resolution
npx tsc --showConfig
```

#### 3. ESLint Type-Aware Rules
```bash
# Run only TypeScript-specific rules
npx eslint src/**/*.ts --ext .ts --config .eslintrc.js
```

## Metrics and Monitoring

### Type Safety KPIs
- **Type Coverage**: Target ≥85%
- **Any Type Usage**: Target ≤50 instances
- **TypeScript Errors**: Target 0 in CI
- **Build Success Rate**: Target 100%

### Reporting
- Type coverage reports generated on every CI run
- Monthly type safety health reports
- Automated alerts for type coverage drops

## Migration Guidelines

### Gradual Type Safety Improvements
1. **Phase 1**: Enable strict mode incrementally
2. **Phase 2**: Eliminate `any` types systematically  
3. **Phase 3**: Add comprehensive type guards
4. **Phase 4**: Implement type-safe database layers

### Legacy Code Integration
- Use `@ts-expect-error` with detailed comments for temporary issues
- Create migration tickets for each `any` type removal
- Document type assumptions in legacy interfaces

## Resources

### TypeScript Documentation
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Strict Type Checking Options](https://www.typescriptlang.org/tsconfig#strict)
- [Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

### YieldSensei Specific
- [Type Definitions](./src/types/index.ts)
- [Database Types](./src/shared/database/types.ts)
- [API Types](./src/api/types/schemas.ts)

---

**Last Updated**: July 2025  
**Version**: 1.0  
**Maintainers**: YieldSensei Development Team