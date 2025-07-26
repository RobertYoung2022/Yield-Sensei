/**
 * Safe access utilities for handling strict TypeScript compilation errors
 * Provides type-safe alternatives to common error-prone operations
 */

import { hasProperty, isArray, isDefined, isError } from './type-guards';

/**
 * Safely access array elements with bounds checking
 * @template T - Array element type
 * @param array - The array to access
 * @param index - The index to access
 * @returns The element at index or undefined if out of bounds
 * 
 * @example
 * ```typescript
 * const first = safeArrayAccess(items, 0); // T | undefined
 * if (first) {
 *   // TypeScript knows first is defined
 *   console.log(first.property);
 * }
 * ```
 */
export function safeArrayAccess<T>(array: T[], index: number): T | undefined {
  return index >= 0 && index < array.length ? array[index] : undefined;
}

/**
 * Safely access the first element of an array
 * @template T - Array element type
 * @param array - The array to access
 * @returns The first element or undefined if array is empty
 */
export function safeFirst<T>(array: T[]): T | undefined {
  return safeArrayAccess(array, 0);
}

/**
 * Safely access the last element of an array
 * @template T - Array element type
 * @param array - The array to access
 * @returns The last element or undefined if array is empty
 */
export function safeLast<T>(array: T[]): T | undefined {
  return array.length > 0 ? array[array.length - 1] : undefined;
}

/**
 * Safely access nested object properties with type checking
 * @template T - Object type
 * @template K1, K2, K3 - Property key types for nested access
 * @param obj - The object to access
 * @param key1 - First level property key
 * @param key2 - Second level property key (optional)
 * @param key3 - Third level property key (optional)
 * @returns The nested property value or undefined
 * 
 * @example
 * ```typescript
 * const value = safeNestedAccess(response, 'data', 'items', 0);
 * // Equivalent to: response?.data?.items?.[0]
 * ```
 */
export function safeNestedAccess<T extends Record<string, any>, K1 extends keyof T>(
  obj: T,
  key1: K1
): T[K1] | undefined;

export function safeNestedAccess<
  T extends Record<string, any>,
  K1 extends keyof T,
  K2 extends keyof NonNullable<T[K1]>
>(
  obj: T,
  key1: K1,
  key2: K2
): NonNullable<T[K1]>[K2] | undefined;

export function safeNestedAccess<
  T extends Record<string, any>,
  K1 extends keyof T,
  K2 extends keyof NonNullable<T[K1]>,
  K3 extends keyof NonNullable<NonNullable<T[K1]>[K2]>
>(
  obj: T,
  key1: K1,
  key2: K2,
  key3: K3
): NonNullable<NonNullable<T[K1]>[K2]>[K3] | undefined;

export function safeNestedAccess<T extends Record<string, any>>(
  obj: T,
  ...keys: Array<string | number>
): any {
  let current: any = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Safely convert unknown values to specific types with fallbacks
 * @template T - Target type
 * @param value - The value to convert
 * @param converter - Function to convert the value
 * @param fallback - Fallback value if conversion fails
 * @returns Converted value or fallback
 * 
 * @example
 * ```typescript
 * const num = safeConvert(userInput, Number, 0);
 * const str = safeConvert(data, String, '');
 * ```
 */
export function safeConvert<T>(
  value: unknown,
  converter: (v: unknown) => T,
  fallback: T
): T {
  try {
    const result = converter(value);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safely parse JSON with error handling
 * @template T - Expected JSON type
 * @param jsonString - The JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T = unknown>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringify values to JSON
 * @param value - The value to stringify
 * @param fallback - Fallback string if stringification fails
 * @returns JSON string or fallback
 */
export function safeJsonStringify(value: unknown, fallback: string = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/**
 * Safely access object properties using index signature safe access
 * Resolves TS4111 errors for index signature access
 * @template T - Object type
 * @param obj - The object to access
 * @param key - The property key as string
 * @param fallback - Fallback value if property doesn't exist
 * @returns Property value or fallback
 * 
 * @example
 * ```typescript
 * // Instead of: const version = params.version; // TS4111 error
 * const version = safeIndexAccess(params, 'version', 'unknown');
 * ```
 */
export function safeIndexAccess<T extends Record<string, any>>(
  obj: T,
  key: string,
  fallback: T[string]
): T[string] {
  return obj[key] ?? fallback;
}

/**
 * Safely handle async operations with error catching
 * @template T - Return type of async operation
 * @template E - Error type
 * @param operation - Async operation to execute
 * @returns Promise resolving to Result type
 */
export type AsyncResult<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>;

export async function safeAsync<T, E = Error>(
  operation: () => Promise<T>
): AsyncResult<T, E> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: (isError(error) ? error : new Error(String(error))) as E 
    };
  }
}

/**
 * Safely merge objects with type checking
 * @template T - Base object type
 * @template U - Override object type
 * @param base - Base object
 * @param override - Object to merge in
 * @returns Merged object with combined type
 */
export function safeMerge<T extends Record<string, any>, U extends Record<string, any>>(
  base: T,
  override: U
): T & U {
  return { ...base, ...override };
}

/**
 * Safely filter array with type predicate
 * @template T - Array element type
 * @template U - Filtered type
 * @param array - Array to filter
 * @param predicate - Type predicate function
 * @returns Filtered array with narrowed type
 */
export function safeFilter<T, U extends T>(
  array: T[],
  predicate: (item: T) => item is U
): U[] {
  return array.filter(predicate);
}

/**
 * Safely map array with error handling for mapper function
 * @template T - Source array element type
 * @template U - Mapped array element type
 * @param array - Array to map
 * @param mapper - Mapping function
 * @param errorHandler - Function to handle mapping errors
 * @returns Mapped array with error handling
 */
export function safeMap<T, U>(
  array: T[],
  mapper: (item: T, index: number) => U,
  errorHandler?: (error: unknown, item: T, index: number) => U
): U[] {
  return array.map((item, index) => {
    try {
      return mapper(item, index);
    } catch (error) {
      if (errorHandler) {
        return errorHandler(error, item, index);
      }
      throw error;
    }
  });
}

/**
 * Safely reduce array with error handling
 * @template T - Array element type
 * @template U - Accumulator type
 * @param array - Array to reduce
 * @param reducer - Reducer function
 * @param initialValue - Initial accumulator value
 * @param errorHandler - Function to handle reduction errors
 * @returns Reduced value with error handling
 */
export function safeReduce<T, U>(
  array: T[],
  reducer: (acc: U, item: T, index: number) => U,
  initialValue: U,
  errorHandler?: (error: unknown, acc: U, item: T, index: number) => U
): U {
  return array.reduce((acc, item, index) => {
    try {
      return reducer(acc, item, index);
    } catch (error) {
      if (errorHandler) {
        return errorHandler(error, acc, item, index);
      }
      throw error;
    }
  }, initialValue);
}

/**
 * Create a safe getter function for consistent property access
 * @template T - Object type
 * @template K - Property key type
 * @param key - Property key to create getter for
 * @param fallback - Default value for missing properties
 * @returns Getter function
 * 
 * @example
 * ```typescript
 * const getId = createSafeGetter('id', 'unknown-id');
 * const id = getId(user); // string, never undefined
 * ```
 */
export function createSafeGetter<T extends Record<string, any>, K extends keyof T>(
  key: K,
  fallback: T[K]
): (obj: T) => T[K] {
  return (obj: T) => obj[key] ?? fallback;
}

/**
 * Safely handle function calls with parameter validation
 * @template TArgs - Function arguments type
 * @template TReturn - Function return type
 * @param fn - Function to call safely
 * @param args - Arguments to pass to function
 * @param validator - Optional validator for arguments
 * @param fallback - Fallback value if call fails
 * @returns Function result or fallback
 */
export function safeFunctionCall<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  args: TArgs,
  validator?: (args: TArgs) => boolean,
  fallback?: TReturn
): TReturn | undefined {
  try {
    if (validator && !validator(args)) {
      return fallback;
    }
    return fn(...args);
  } catch {
    return fallback;
  }
}