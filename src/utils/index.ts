/**
 * Type-safe utilities for YieldSensei
 * Consolidated exports for all type safety, error handling, and utility functions
 */

// Type guards and validation utilities
export * from './type-guards';

// Safe property and data access utilities  
export * from './safe-access';

// Error handling and Result type utilities
export * from './error-handling';

// Type replacements for eliminating 'any' usage
export * from './type-replacements';

// Legacy type safety utilities (comprehensive set)
export * from './type-safety';

/**
 * Quick access to commonly used utility functions
 * Import this for the most frequently needed type-safe operations
 */
export const TypeSafeUtils = {
  // Type guards
  hasProperty: (obj: any, key: string) => 
    obj != null && typeof obj === 'object' && key in obj && obj[key] !== undefined,
  isString: (value: unknown): value is string => typeof value === 'string',
  isNumber: (value: unknown): value is number => typeof value === 'number' && !isNaN(value),
  isArray: <T>(value: unknown): value is T[] => Array.isArray(value),
  isDefined: <T>(value: T | null | undefined): value is T => value !== null && value !== undefined,

  // Safe access
  safeGet: <T, K extends keyof T>(obj: T, key: K, fallback: T[K]): T[K] => obj?.[key] ?? fallback,
  safeArrayAccess: <T>(array: T[], index: number): T | undefined => 
    index >= 0 && index < array.length ? array[index] : undefined,
  safeIndexAccess: <T extends Record<string, any>>(obj: T, key: string, fallback: T[string]): T[string] => 
    obj[key] ?? fallback,

  // Error handling
  handleCatchError: (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error occurred';
  },
  createSuccess: <T>(data: T) => ({ success: true as const, data }),
  createError: <E>(error: E) => ({ success: false as const, error }),

  // Common patterns
  markUnused: (..._params: any[]): void => {
    // Intentionally empty - marks parameters as used for TS6133
  },
  safeBigInt: (value: bigint | null | undefined): bigint => value ?? BigInt(0)
} as const;

/**
 * Re-export commonly needed types
 */
export type {
  // From error-handling
  Result,
  
  // From type-replacements
  UnknownFunction,
  UnknownRecord,
  JsonValue,
  TypedRequest,
  TypedResponse,
  ApiResponse,
  
  // From safe-access
  AsyncResult
} from './error-handling';

export type {
  UnknownFunction as AnyFunction,
  UnknownRecord as AnyObject,
  JsonValue as AnyJson
} from './type-replacements';