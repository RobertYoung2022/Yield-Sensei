/**
 * Type safety utility functions for YieldSensei
 * Common patterns extracted from TypeScript error resolution
 */

import { 
  SafeBigInt, 
  NullableBigInt, 
  SafeFeeData, 
  Result, 
  ValidationError,
  TypeGuard,
  BaseConfig,
  ServiceFactory,
  SingletonService
} from '../types/common.js';

// =============================================================================
// BIGINT SAFETY UTILITIES
// =============================================================================

/**
 * Convert nullable BigInt to safe BigInt with fallback
 * Resolves: Type 'null' is not assignable to type 'bigint'
 */
export function ensureSafeBigInt(value: NullableBigInt, fallback: SafeBigInt = BigInt(0)): SafeBigInt {
  return value ?? fallback;
}

/**
 * Safe BigInt arithmetic operations
 */
export const SafeBigIntMath = {
  add: (a: NullableBigInt, b: NullableBigInt): SafeBigInt => 
    ensureSafeBigInt(a) + ensureSafeBigInt(b),
  
  subtract: (a: NullableBigInt, b: NullableBigInt): SafeBigInt => 
    ensureSafeBigInt(a) - ensureSafeBigInt(b),
  
  multiply: (a: NullableBigInt, b: NullableBigInt): SafeBigInt => 
    ensureSafeBigInt(a) * ensureSafeBigInt(b),
  
  divide: (a: NullableBigInt, b: NullableBigInt): SafeBigInt => {
    const denominator = ensureSafeBigInt(b);
    if (denominator === BigInt(0)) {
      throw new Error('Division by zero');
    }
    return ensureSafeBigInt(a) / denominator;
  },
  
  max: (a: NullableBigInt, b: NullableBigInt): SafeBigInt => 
    ensureSafeBigInt(a) > ensureSafeBigInt(b) ? ensureSafeBigInt(a) : ensureSafeBigInt(b),
  
  min: (a: NullableBigInt, b: NullableBigInt): SafeBigInt => 
    ensureSafeBigInt(a) < ensureSafeBigInt(b) ? ensureSafeBigInt(a) : ensureSafeBigInt(b)
};

/**
 * Transform ethers.js FeeData to SafeFeeData
 * Resolves: BigInt null assignment errors in blockchain operations
 */
export function ensureSafeFeeData(feeData: {
  gasPrice?: NullableBigInt;
  maxFeePerGas?: NullableBigInt;
  maxPriorityFeePerGas?: NullableBigInt;
  lastBaseFeePerGas?: NullableBigInt;
}): SafeFeeData {
  return {
    gasPrice: ensureSafeBigInt(feeData.gasPrice),
    maxFeePerGas: ensureSafeBigInt(feeData.maxFeePerGas),
    maxPriorityFeePerGas: ensureSafeBigInt(feeData.maxPriorityFeePerGas),
    ...(feeData.lastBaseFeePerGas && { lastBaseFeePerGas: ensureSafeBigInt(feeData.lastBaseFeePerGas) })
  };
}

// =============================================================================
// SAFE PROPERTY ACCESS
// =============================================================================

/**
 * Safe property access with fallback
 * Resolves: Object is possibly 'undefined' errors
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback: T[K]
): T[K] {
  return obj?.[key] ?? fallback;
}

/**
 * Safe nested property access
 */
export function safeGetNested<T, K1 extends keyof T, K2 extends keyof T[K1]>(
  obj: T | null | undefined,
  key1: K1,
  key2: K2,
  fallback: T[K1][K2]
): T[K1][K2] {
  return obj?.[key1]?.[key2] ?? fallback;
}

/**
 * Safe array access with bounds checking
 * Resolves: Element implicitly has 'any' type with noUncheckedIndexedAccess
 */
export function safeArrayAccess<T>(
  array: T[] | null | undefined,
  index: number
): T | undefined {
  if (!array || index < 0 || index >= array.length) {
    return undefined;
  }
  return array[index];
}

/**
 * Safe array operations
 */
export const SafeArray = {
  first: <T>(array: T[] | null | undefined): T | undefined => 
    safeArrayAccess(array, 0),
  
  last: <T>(array: T[] | null | undefined): T | undefined => 
    array && array.length > 0 ? array[array.length - 1] : undefined,
  
  nth: <T>(array: T[] | null | undefined, index: number): T | undefined => 
    safeArrayAccess(array, index),
  
  isEmpty: <T>(array: T[] | null | undefined): boolean => 
    !array || array.length === 0,
  
  isNotEmpty: <T>(array: T[] | null | undefined): array is T[] => 
    Boolean(array && array.length > 0)
};

// =============================================================================
// CONFIGURATION UTILITIES
// =============================================================================

/**
 * Merge configurations with type safety
 * Resolves: Object literal may only specify known properties
 */
export function mergeConfigs<T extends Record<string, any>>(
  base: T,
  override: Partial<T>
): T {
  return { ...base, ...override };
}

/**
 * Validate required configuration keys
 */
export function validateRequiredKeys<T extends Record<string, any>>(
  config: T,
  requiredKeys: Array<keyof T>
): boolean {
  return requiredKeys.every(key => config[key] !== undefined);
}

/**
 * Transform nested config to flat structure
 * Resolves: Interface property mismatch patterns
 */
export function flattenConfig<TSource, TTarget>(
  source: TSource,
  mapper: (source: TSource) => TTarget
): TTarget {
  return mapper(source);
}

/**
 * Configuration validator with detailed error reporting
 */
export function createConfigValidator<T extends BaseConfig>(
  validator: (config: unknown) => config is T
): (config: unknown) => Result<T, ValidationError> {
  return (config: unknown) => {
    if (validator(config)) {
      return { success: true, data: config };
    }
    
    return {
      success: false,
      error: new ValidationError(
        'Configuration validation failed',
        'config',
        config,
        'BaseConfig interface compliance'
      )
    };
  };
}

// =============================================================================
// SINGLETON UTILITIES
// =============================================================================

/**
 * Generic singleton factory creator
 * Resolves: Constructor of class 'X' is private errors
 */
export function createSingleton<T extends SingletonService>(
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
    },
    
    hasInstance(): boolean {
      return instance !== null;
    }
  };
}

/**
 * Safe singleton access with initialization check
 */
export function safeSingletonAccess<T extends SingletonService>(
  factory: ServiceFactory<T>,
  config?: any
): T {
  try {
    return factory.getInstance(config);
  } catch (error) {
    throw new Error(
      `Failed to access singleton service: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Common type guards for validation
 */
export const TypeGuards = {
  isString: (value: unknown): value is string => 
    typeof value === 'string',
  
  isNumber: (value: unknown): value is number => 
    typeof value === 'number' && !isNaN(value),
  
  isBigInt: (value: unknown): value is bigint => 
    typeof value === 'bigint',
  
  isObject: (value: unknown): value is Record<string, unknown> => 
    typeof value === 'object' && value !== null && !Array.isArray(value),
  
  isArray: <T>(value: unknown): value is T[] => 
    Array.isArray(value),
  
  isNonEmptyString: (value: unknown): value is string => 
    typeof value === 'string' && value.length > 0,
  
  isPositiveNumber: (value: unknown): value is number => 
    typeof value === 'number' && value > 0 && !isNaN(value),
  
  isNonNullObject: <T>(value: T | null | undefined): value is T => 
    value !== null && value !== undefined,
  
  hasProperty: <T extends Record<string, unknown>, K extends string>(
    obj: T,
    key: K
  ): obj is T & Record<K, unknown> => 
    key in obj,
  
  hasRequiredProperties: <T extends Record<string, unknown>>(
    obj: T,
    keys: string[]
  ): boolean => 
    keys.every(key => key in obj && obj[key] !== undefined)
};

/**
 * Create composite type guard
 */
export function createTypeGuard<T>(
  guards: Array<(value: unknown) => boolean>,
  description: string
): TypeGuard<T> {
  return (value: unknown): value is T => {
    const isValid = guards.every(guard => guard(value));
    if (!isValid) {
      console.warn(`Type guard failed: ${description}`, value);
    }
    return isValid;
  };
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Safe function execution with error handling
 */
export function safeExecute<T, E = Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E
): Result<T, E> {
  try {
    const result = fn();
    return { success: true, data: result };
  } catch (error) {
    const handledError = errorHandler ? errorHandler(error) : error as E;
    return { success: false, error: handledError };
  }
}

/**
 * Safe async function execution
 */
export async function safeExecuteAsync<T, E = Error>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const result = await fn();
    return { success: true, data: result };
  } catch (error) {
    const handledError = errorHandler ? errorHandler(error) : error as E;
    return { success: false, error: handledError };
  }
}

/**
 * Retry mechanism for unreliable operations
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// =============================================================================
// PARAMETER HANDLING
// =============================================================================

/**
 * Mark parameters as intentionally unused
 * Resolves: 'param' is declared but its value is never read
 */
export function markUnused(..._params: any[]): void {
  // Intentionally empty - just marks parameters as used
}

/**
 * Extract used parameters and mark others as unused
 */
export function useParams<T extends Record<string, any>>(
  params: T,
  used: Array<keyof T>
): Pick<T, keyof T> {
  const unusedKeys = Object.keys(params).filter(key => !used.includes(key));
  markUnused(...unusedKeys.map(key => params[key]));
  return params;
}

// =============================================================================
// PROMISE UTILITIES
// =============================================================================

/**
 * Safe promise with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Safe promise all with partial failure handling
 */
export async function safePromiseAll<T>(
  promises: Promise<T>[]
): Promise<Array<Result<T, Error>>> {
  const results = await Promise.allSettled(promises);
  
  return results.map(result => 
    result.status === 'fulfilled'
      ? { success: true, data: result.value }
      : { success: false, error: result.reason }
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

// All functions are already exported above using individual export statements
// No need for additional export block that would cause conflicts