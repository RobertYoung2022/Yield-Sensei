/**
 * Type guard utilities for safe type checking and property access
 * Provides reusable functions to handle common TypeScript strict mode issues
 */

/**
 * Checks if an object has a specific property with type safety
 * @template T - The object type
 * @template K - The property key type
 * @param obj - The object to check
 * @param key - The property key to check for
 * @returns Type predicate indicating if the property exists
 * 
 * @example
 * ```typescript
 * if (hasProperty(params, 'version')) {
 *   // TypeScript knows params.version exists and is defined
 *   console.log(params.version);
 * }
 * ```
 */
export function hasProperty<T extends Record<string, any>, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, NonNullable<unknown>> {
  return obj != null && typeof obj === 'object' && key in obj && obj[key] !== undefined;
}

/**
 * Safely accesses object properties with bracket notation fallback
 * @template T - The object type
 * @template K - The property key type
 * @param obj - The object to access
 * @param key - The property key
 * @param fallback - Default value if property doesn't exist
 * @returns The property value or fallback
 * 
 * @example
 * ```typescript
 * const version = safeGetProperty(params, 'version', 'unknown');
 * // Equivalent to: params['version'] ?? 'unknown'
 * ```
 */
export function safeGetProperty<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  key: K,
  fallback: T[K]
): T[K] {
  return obj?.[key] ?? fallback;
}

/**
 * Type guard to check if a value is a non-null object
 * @param value - The value to check
 * @returns Type predicate for non-null object
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if a value is a string
 * @param value - The value to check
 * @returns Type predicate for string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 * @param value - The value to check
 * @returns Type predicate for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is a boolean
 * @param value - The value to check
 * @returns Type predicate for boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if a value is an array
 * @template T - The array element type
 * @param value - The value to check
 * @param elementGuard - Optional type guard for array elements
 * @returns Type predicate for array
 */
export function isArray<T = unknown>(
  value: unknown,
  elementGuard?: (element: unknown) => element is T
): value is T[] {
  if (!Array.isArray(value)) {
    return false;
  }
  
  if (elementGuard) {
    return value.every(elementGuard);
  }
  
  return true;
}

/**
 * Type guard for checking if a value matches a specific interface structure
 * @template T - The target interface type
 * @param value - The value to check
 * @param requiredKeys - Array of required property keys
 * @returns Type predicate for interface
 * 
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   email: string;
 *   name?: string;
 * }
 * 
 * if (hasRequiredProperties(data, ['id', 'email'])) {
 *   // TypeScript knows data has id and email properties
 *   const user = data as User;
 * }
 * ```
 */
export function hasRequiredProperties<T extends Record<string, any>>(
  value: unknown,
  requiredKeys: Array<keyof T>
): value is T {
  if (!isNonNullObject(value)) {
    return false;
  }
  
  return requiredKeys.every(key => key in value && value[key] !== undefined);
}

/**
 * Type guard to check for valid enum values
 * @template T - The enum type
 * @param value - The value to check
 * @param enumObject - The enum object to check against
 * @returns Type predicate for enum value
 * 
 * @example
 * ```typescript
 * enum Status { Active = 'active', Inactive = 'inactive' }
 * 
 * if (isEnumValue(userInput, Status)) {
 *   // TypeScript knows userInput is Status
 *   console.log(`Status is: ${userInput}`);
 * }
 * ```
 */
export function isEnumValue<T extends Record<string | number, string | number>>(
  value: unknown,
  enumObject: T
): value is T[keyof T] {
  return Object.values(enumObject).includes(value as T[keyof T]);
}

/**
 * Type guard for nullable values with defined check
 * @template T - The non-null type
 * @param value - The value to check
 * @returns Type predicate for non-null value
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for checking if an error is an instance of Error
 * @param error - The error value to check
 * @returns Type predicate for Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard for checking if a value is a valid Date
 * @param value - The value to check
 * @returns Type predicate for valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard for BigInt values
 * @param value - The value to check
 * @returns Type predicate for BigInt
 */
export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/**
 * Type guard for checking if a value is a function
 * @template T - The function type
 * @param value - The value to check
 * @returns Type predicate for function
 */
export function isFunction<T extends (...args: any[]) => any>(value: unknown): value is T {
  return typeof value === 'function';
}

/**
 * Combined type guard for checking multiple conditions
 * @template T - The target type
 * @param value - The value to check
 * @param guards - Array of type guard functions
 * @returns Type predicate if all guards pass
 * 
 * @example
 * ```typescript
 * if (satisfiesAll(value, [isNonNullObject, v => hasProperty(v, 'id')])) {
 *   // Value is a non-null object with an 'id' property
 * }
 * ```
 */
export function satisfiesAll<T>(
  value: unknown,
  guards: Array<(v: unknown) => v is T>
): value is T {
  return guards.every(guard => guard(value));
}

/**
 * Union type guard for checking if a value matches any of multiple types
 * @template T - The union type
 * @param value - The value to check
 * @param guards - Array of type guard functions for each union member
 * @returns Type predicate if any guard passes
 */
export function satisfiesAny<T>(
  value: unknown,
  guards: Array<(v: unknown) => v is T>
): value is T {
  return guards.some(guard => guard(value));
}