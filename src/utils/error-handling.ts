/**
 * Type-safe error handling utilities
 * Provides consistent patterns for error handling in strict TypeScript mode
 */

import { isError, isDefined } from './type-guards';

/**
 * Result type for operations that can fail
 * @template T - Success data type
 * @template E - Error type
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a successful result
 * @template T - Data type
 * @param data - The success data
 * @returns Success result
 */
export function createSuccess<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create an error result
 * @template E - Error type
 * @param error - The error
 * @returns Error result
 */
export function createError<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Safely handle errors in catch blocks with proper typing
 * @param error - Unknown error from catch block
 * @returns Typed error message
 * 
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const message = handleCatchError(error);
 *   console.error(message);
 * }
 * ```
 */
export function handleCatchError(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error != null && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Convert unknown error to Error instance
 * @param error - Unknown error value
 * @param defaultMessage - Default message if error cannot be converted
 * @returns Error instance
 */
export function toError(error: unknown, defaultMessage: string = 'Unknown error'): Error {
  if (isError(error)) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (error != null && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }
  return new Error(defaultMessage);
}

/**
 * Wrap a function to return Result type instead of throwing
 * @template TArgs - Function arguments type
 * @template TReturn - Function return type
 * @param fn - Function to wrap
 * @returns Wrapped function that returns Result
 * 
 * @example
 * ```typescript
 * const safeParse = wrapWithResult(JSON.parse);
 * const result = safeParse('{"key": "value"}');
 * if (result.success) {
 *   console.log(result.data); // Parsed object
 * } else {
 *   console.error(result.error.message); // Parse error
 * }
 * ```
 */
export function wrapWithResult<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => Result<TReturn, Error> {
  return (...args: TArgs) => {
    try {
      const data = fn(...args);
      return createSuccess(data);
    } catch (error) {
      return createError(toError(error));
    }
  };
}

/**
 * Wrap an async function to return Result type instead of rejecting
 * @template TArgs - Function arguments type
 * @template TReturn - Function return type
 * @param fn - Async function to wrap
 * @returns Wrapped async function that returns Result
 */
export function wrapAsyncWithResult<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<Result<TReturn, Error>> {
  return async (...args: TArgs) => {
    try {
      const data = await fn(...args);
      return createSuccess(data);
    } catch (error) {
      return createError(toError(error));
    }
  };
}

/**
 * Chain multiple Result operations together
 * @template T - Current data type
 * @template U - Next data type
 * @template E - Error type
 * @param result - Current result
 * @param fn - Function to apply if current result is success
 * @returns Chained result
 * 
 * @example
 * ```typescript
 * const result = chainResult(parseResult, (data) => 
 *   data.items.length > 0 
 *     ? createSuccess(data.items[0]) 
 *     : createError(new Error('No items'))
 * );
 * ```
 */
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (result.success) {
    return fn(result.data);
  }
  return result;
}

/**
 * Map over the success value of a Result
 * @template T - Current data type
 * @template U - Mapped data type
 * @template E - Error type
 * @param result - Result to map over
 * @param fn - Mapping function
 * @returns Mapped result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.success) {
    return createSuccess(fn(result.data));
  }
  return result;
}

/**
 * Map over the error value of a Result
 * @template T - Data type
 * @template E1 - Current error type
 * @template E2 - Mapped error type
 * @param result - Result to map error over
 * @param fn - Error mapping function
 * @returns Result with mapped error
 */
export function mapError<T, E1, E2>(
  result: Result<T, E1>,
  fn: (error: E1) => E2
): Result<T, E2> {
  if (result.success) {
    return result;
  }
  return createError(fn(result.error));
}

/**
 * Unwrap a Result, throwing the error if it failed
 * @template T - Data type
 * @template E - Error type
 * @param result - Result to unwrap
 * @returns The success data
 * @throws The error if result failed
 */
export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  throw result.error;
}

/**
 * Unwrap a Result with a default value if it failed
 * @template T - Data type
 * @template E - Error type
 * @param result - Result to unwrap
 * @param defaultValue - Default value if result failed
 * @returns The success data or default value
 */
export function unwrapResultOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.success ? result.data : defaultValue;
}

/**
 * Collect multiple Results into a single Result with an array
 * @template T - Data type
 * @template E - Error type
 * @param results - Array of results to collect
 * @returns Result with array of success data or first error
 * 
 * @example
 * ```typescript
 * const results = [result1, result2, result3];
 * const collected = collectResults(results);
 * if (collected.success) {
 *   console.log(collected.data); // [data1, data2, data3]
 * }
 * ```
 */
export function collectResults<T, E>(results: Array<Result<T, E>>): Result<T[], E> {
  const data: T[] = [];
  
  for (const result of results) {
    if (!result.success) {
      return result;
    }
    data.push(result.data);
  }
  
  return createSuccess(data);
}

/**
 * Execute multiple async operations and collect results
 * @template T - Data type
 * @param operations - Array of async operations
 * @returns Result with array of success data or first error
 */
export async function collectAsyncResults<T>(
  operations: Array<() => Promise<T>>
): Promise<Result<T[], Error>> {
  try {
    const data = await Promise.all(operations.map(op => op()));
    return createSuccess(data);
  } catch (error) {
    return createError(toError(error));
  }
}

/**
 * Retry an operation with exponential backoff
 * @template T - Return type
 * @param operation - Operation to retry
 * @param maxAttempts - Maximum number of attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the operation
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<Result<T, Error>> {
  let lastError: Error = new Error('Max attempts reached');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return createSuccess(result);
    } catch (error) {
      lastError = toError(error);
      
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return createError(lastError);
}

/**
 * Create a typed error class with additional properties
 * @template T - Additional properties type
 */
export class TypedError<T extends Record<string, any> = {}> extends Error {
  constructor(message: string, public readonly details: T) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Create an error handler that catches specific error types
 * @template E - Specific error type to catch
 * @param ErrorClass - Error class to catch
 * @param handler - Handler function for the specific error
 * @returns Error handler function
 */
export function createErrorHandler<E extends Error>(
  ErrorClass: new (...args: any[]) => E,
  handler: (error: E) => void
): (error: unknown) => void {
  return (error: unknown) => {
    if (error instanceof ErrorClass) {
      handler(error);
    } else {
      throw error; // Re-throw if not the expected error type
    }
  };
}

/**
 * Validate that all required properties exist on an object
 * @template T - Object type
 * @param obj - Object to validate
 * @param requiredProps - Array of required property names
 * @param errorMessage - Custom error message
 * @returns Result indicating validation success/failure
 */
export function validateRequired<T extends Record<string, any>>(
  obj: T,
  requiredProps: Array<keyof T>,
  errorMessage?: string
): Result<T, Error> {
  const missing = requiredProps.filter(prop => !isDefined(obj[prop]));
  
  if (missing.length > 0) {
    const message = errorMessage || `Missing required properties: ${missing.join(', ')}`;
    return createError(new Error(message));
  }
  
  return createSuccess(obj);
}