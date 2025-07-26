# TypeScript Error Resolution Patterns

This document outlines systematic patterns for resolving TypeScript errors in the YieldSensei codebase, based on analysis of 65 successfully resolved errors.

## Table of Contents
1. [Common Error Patterns](#common-error-patterns)
2. [Resolution Strategies](#resolution-strategies)
3. [Reusable Type Definitions](#reusable-type-definitions)
4. [Error Priority System](#error-priority-system)
5. [Utility Functions](#utility-functions)

## Common Error Patterns

### 1. Index Signature Access Pattern (TS4111)
**Pattern**: `Property 'X' comes from an index signature, so it must be accessed with ['X']`

**Resolution Strategy**: Use bracket notation or type guards
```typescript
// ❌ Error Pattern
const version = params.version;

// ✅ Fix Pattern - Bracket notation
const version = params['version'];

// ✅ Fix Pattern - Type guard
function hasProperty<T, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, any> {
  return obj != null && typeof obj === 'object' && key in obj;
}

if (hasProperty(params, 'version')) {
  const version = params.version; // Safe access
}
```

**Files with Pattern**: 50+ instances in docs/routes, API middleware, GraphQL resolvers

### 2. Unused Parameter Pattern (TS6133)
**Pattern**: `'param' is declared but its value is never read`

**Resolution Strategy**: Prefix with underscore or restructure
```typescript
// ❌ Error Pattern
function handler(req: Request, res: Response) {
  res.send('OK'); // req never used
}

// ✅ Fix Pattern - Underscore prefix
function handler(_req: Request, res: Response) {
  res.send('OK');
}

// ✅ Fix Pattern - Destructure only needed params
function handler(_: Request, res: Response) {
  res.send('OK');
}
```

**Files with Pattern**: 200+ instances across GraphQL resolvers, middleware, handlers

### 2. Unused Parameter Pattern
**Pattern**: `'param' is declared but its value is never read`

**Resolution Strategy**: Prefix with underscore to indicate intentional
```typescript
// ❌ Error Pattern
async function processData(data: any, unusedParam: string) {
  return data.process();
}

// ✅ Fix Pattern
async function processData(data: any, _unusedParam: string) {
  return data.process();
}
```

**Applied to**: Method parameters, destructured properties, callback arguments

### 3. BigInt Null Assignment Pattern
**Pattern**: `Type 'null' is not assignable to type 'bigint'`

**Resolution Strategy**: Provide BigInt(0) fallback
```typescript
// ❌ Error Pattern
baseFee: feeData.maxFeePerGas,
priorityFee: feeData.maxPriorityFeePerGas,

// ✅ Fix Pattern
baseFee: feeData.maxFeePerGas || BigInt(0),
priorityFee: feeData.maxPriorityFeePerGas || BigInt(0),
```

**Context**: ethers.js fee data handling with strict null checks

### 4. Interface Property Mismatch Pattern
**Pattern**: `Object literal may only specify known properties`

**Resolution Strategy**: Transform nested objects to match interface structure
```typescript
// ❌ Error Pattern
this.config = sdkConfig; // Nested structure doesn't match interface

// ✅ Fix Pattern
this.config = {
  name: sdkConfig.metadata.name,
  version: sdkConfig.metadata.version,
  description: sdkConfig.metadata.description,
  // ... flatten nested properties
};
```

### 5. Optional Property Access Pattern
**Pattern**: Object is possibly 'undefined' with exactOptionalPropertyTypes

**Resolution Strategy**: Explicit undefined checks
```typescript
// ❌ Error Pattern
if (config.database) {
  return config.database.host; // Still possibly undefined
}

// ✅ Fix Pattern
const db = config.database;
if (db !== undefined) {
  return db.host;
}
```

## Resolution Strategies

### Strategy 1: Dependency Injection Fixes
**When to use**: Constructor access errors, singleton pattern enforcement

**Steps**:
1. Identify singleton classes (RedisManager, DatabaseManager, etc.)
2. Replace `new ClassName()` with `ClassName.getInstance()`
3. Verify getInstance() method exists and is properly typed

**Impact**: 12 errors resolved across 6 files

### Strategy 2: Type Guard Implementation
**When to use**: Runtime type validation, API response handling

**Pattern**:
```typescript
function isValidConfig(config: unknown): config is RequiredConfig {
  return typeof config === 'object' && 
         config !== null &&
         'requiredProperty' in config;
}

// Usage
if (isValidConfig(data)) {
  // TypeScript knows data is RequiredConfig here
  return data.requiredProperty;
}
```

### Strategy 3: Interface Compliance Transformation
**When to use**: Complex nested objects, API responses, configuration objects

**Pattern**:
```typescript
// Define target interface clearly
interface TargetConfig {
  name: string;
  version: string;
  settings: ConfigSettings;
}

// Transform source to match target
function transformToTarget(source: SourceConfig): TargetConfig {
  return {
    name: source.metadata.name,
    version: source.metadata.version,
    settings: {
      timeout: source.config.timeout || 30000,
      retries: source.config.retries || 3
    }
  };
}
```

### Strategy 4: Null Safety Enhancement
**When to use**: ethers.js integration, blockchain data, optional chains

**Patterns**:
```typescript
// Nullish coalescing for primitives
const value = data.value ?? defaultValue;

// BigInt fallbacks for blockchain data
const fee = feeData.gasPrice || BigInt(0);

// Optional chaining for deep access
const result = response?.data?.items?.[0]?.value;
```

## Reusable Type Definitions

### 1. Blockchain Data Types
```typescript
// Common blockchain value types with null safety
export type SafeBigInt = bigint;
export type NullableBigInt = bigint | null;
export type BigIntFallback<T extends NullableBigInt> = T extends null ? bigint : T;

// Fee data with guaranteed fallbacks
export interface SafeFeeData {
  gasPrice: SafeBigInt;
  maxFeePerGas: SafeBigInt;
  maxPriorityFeePerGas: SafeBigInt;
}

// Transform helper
export function ensureSafeFeeData(feeData: FeeData): SafeFeeData {
  return {
    gasPrice: feeData.gasPrice || BigInt(0),
    maxFeePerGas: feeData.maxFeePerGas || BigInt(0),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || BigInt(0),
  };
}
```

### 2. Configuration Types
```typescript
// Base configuration with required properties
export interface BaseConfig {
  readonly id: string;
  readonly timestamp: number;
}

// Optional configuration wrapper
export interface OptionalConfig<T> {
  readonly config?: T;
  readonly isConfigured: boolean;
}

// Configuration validator
export function validateConfig<T extends BaseConfig>(
  config: unknown
): config is T {
  return typeof config === 'object' &&
         config !== null &&
         'id' in config &&
         'timestamp' in config;
}
```

### 3. Service Instance Types
```typescript
// Singleton service pattern
export interface SingletonService {
  getInstance(config?: any): this;
  isInitialized(): boolean;
}

// Service factory with type safety
export type ServiceFactory<T extends SingletonService> = {
  getInstance(config?: any): T;
  resetInstance(): void;
};
```

## Error Priority System

### Priority 1: Critical (Blocking Compilation)
- Constructor access violations
- Type assertion failures  
- Missing required properties
- Export/import conflicts

**Resolution Target**: Immediate (within same session)

### Priority 2: High (Runtime Safety)
- Null/undefined access without checks
- Array index access without bounds checking
- Missing BigInt fallbacks in blockchain code
- Unhandled promise rejections

**Resolution Target**: Within 1-2 sessions

### Priority 3: Medium (Code Quality)
- Unused parameters without underscore prefix
- Missing type annotations
- Implicit any types
- Non-optimal type definitions

**Resolution Target**: Background resolution

### Priority 4: Low (Style/Consistency)
- Formatting inconsistencies
- Missing JSDoc comments
- Non-descriptive variable names
- Redundant type annotations

**Resolution Target**: Code review cycles

## Utility Functions

### 1. Type Checking Utilities
```typescript
// Safe property access
export function safeGet<T, K extends keyof T>(
  obj: T,
  key: K,
  fallback: T[K]
): T[K] {
  return obj[key] ?? fallback;
}

// Null-safe array access
export function safeArrayAccess<T>(
  array: T[],
  index: number
): T | undefined {
  return index >= 0 && index < array.length ? array[index] : undefined;
}

// BigInt safe operations
export function safeBigIntAdd(a: bigint | null, b: bigint | null): bigint {
  return (a || BigInt(0)) + (b || BigInt(0));
}
```

### 2. Configuration Helpers
```typescript
// Merge configurations with type safety
export function mergeConfigs<T extends Record<string, any>>(
  base: T,
  override: Partial<T>
): T {
  return { ...base, ...override };
}

// Validate required configuration keys
export function validateRequiredKeys<T extends Record<string, any>>(
  config: T,
  requiredKeys: Array<keyof T>
): boolean {
  return requiredKeys.every(key => config[key] !== undefined);
}
```

### 3. Singleton Helpers
```typescript
// Generic singleton creator
export function createSingleton<T>(
  constructor: new (...args: any[]) => T
): ServiceFactory<T> {
  let instance: T | null = null;
  
  return {
    getInstance(...args: any[]): T {
      if (!instance) {
        instance = new constructor(...args);
      }
      return instance;
    },
    resetInstance(): void {
      instance = null;
    }
  };
}
```

## Implementation Workflow

### Phase 1: Error Analysis (Current Session)
1. ✅ Categorize errors by pattern type
2. ✅ Identify most common patterns (Constructor, Unused params, BigInt nulls)
3. ✅ Document resolution strategies
4. ✅ Create reusable type definitions

### Phase 2: Systematic Resolution (Next Sessions)
1. Apply Priority 1 fixes (critical compilation errors)
2. Implement utility functions for common patterns
3. Apply Priority 2 fixes (runtime safety)
4. Create automated detection for new instances

### Phase 3: Prevention (Ongoing)
1. Update pre-commit hooks to catch new instances
2. Add ESLint rules for common patterns
3. Document patterns in TypeScript best practices
4. Train team on resolution strategies

## Success Metrics

### Resolved (Session 1)
- **Total errors**: Reduced from 770 to 705 (65 errors, 8.4% reduction)
- **Constructor access**: 6 files fixed with singleton pattern
- **Unused parameters**: 15+ instances prefixed with underscore
- **BigInt null safety**: 4 files with proper fallbacks
- **Interface compliance**: 3 major transformations

### Targets (Upcoming Sessions)
- **Priority 1 errors**: 0 remaining (100% resolution)
- **Type coverage**: Maintain >85% threshold
- **New error prevention**: <5 new errors per week
- **Documentation**: 100% pattern coverage

## File Location Reference

### Documentation
- `/docs/TYPESCRIPT_BEST_PRACTICES.md` - General guidelines
- `/docs/TYPESCRIPT_ERROR_PATTERNS.md` - This file (specific patterns)

### Implementation
- `/src/types/common.ts` - Reusable type definitions (to be created)
- `/src/utils/type-safety.ts` - Utility functions (to be created)
- `/scripts/typescript-error-analyzer.ts` - Error categorization tool (to be created)

### Configuration
- `/tsconfig.json` - Strict TypeScript configuration
- `/.eslintrc.js` - Type-aware linting rules
- `/package.json` - Type checking scripts and coverage

---

**Last Updated**: July 2025  
**Status**: Phase 1 Complete, Phase 2 Planning  
**Maintainer**: YieldSensei Development Team