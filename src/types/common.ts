/**
 * Common TypeScript type definitions for YieldSensei
 * Based on error resolution patterns analysis
 */

// =============================================================================
// BLOCKCHAIN DATA TYPES
// =============================================================================

/** Safe BigInt type that never allows null */
export type SafeBigInt = bigint;

/** BigInt that may be null (from external APIs) */
export type NullableBigInt = bigint | null;

/** Transform nullable BigInt to safe BigInt */
export type BigIntFallback<T extends NullableBigInt> = T extends null ? bigint : T;

/** Fee data with guaranteed non-null values */
export interface SafeFeeData {
  readonly gasPrice: SafeBigInt;
  readonly maxFeePerGas: SafeBigInt;
  readonly maxPriorityFeePerGas: SafeBigInt;
  readonly lastBaseFeePerGas?: SafeBigInt;
}

/** Transaction data with safe BigInt handling */
export interface SafeTransactionData {
  readonly value: SafeBigInt;
  readonly gasLimit: SafeBigInt;
  readonly gasPrice: SafeBigInt;
  readonly maxFeePerGas?: SafeBigInt;
  readonly maxPriorityFeePerGas?: SafeBigInt;
  readonly nonce: number;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/** Base configuration interface with required identification */
export interface BaseConfig {
  readonly id: string;
  readonly timestamp: number;
  readonly version?: string;
}

/** Configuration with optional settings */
export interface OptionalConfig<T> {
  readonly config?: T;
  readonly isConfigured: boolean;
  readonly lastUpdated: number;
}

/** Database connection configuration */
export interface DatabaseConfig extends BaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly credentials: {
    readonly username: string;
    readonly password: string;
  };
  readonly pool?: {
    readonly min: number;
    readonly max: number;
    readonly idleTimeoutMillis: number;
  };
}

/** Redis configuration with fallbacks */
export interface RedisConfig extends BaseConfig {
  readonly host: string;
  readonly port: number;
  readonly keyPrefix?: string;
  readonly password?: string;
  readonly db?: number;
  readonly retryDelayOnFailover?: number;
  readonly maxRetriesPerRequest?: number;
}

/** Service configuration with timeout and retry settings */
export interface ServiceConfig extends BaseConfig {
  readonly timeout: number;
  readonly maxRetries: number;
  readonly retryDelay: number;
  readonly enableLogging: boolean;
}

// =============================================================================
// SINGLETON SERVICE TYPES
// =============================================================================

/** Base singleton service interface */
export interface SingletonService {
  getInstance(config?: any): this;
  isInitialized(): boolean;
  destroy(): Promise<void>;
}

/** Service factory with type safety */
export interface ServiceFactory<T extends SingletonService> {
  getInstance(config?: any): T;
  resetInstance(): void;
  hasInstance(): boolean;
}

/** Service status enumeration */
export enum ServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed'
}

/** Service with lifecycle management */
export interface ManagedService extends SingletonService {
  readonly status: ServiceStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data: T;
  readonly message?: string;
  readonly timestamp: string;
  readonly requestId?: string;
}

/** Error response structure */
export interface ErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, any>;
  };
  readonly timestamp: string;
  readonly requestId?: string;
}

/** Result type for operations that may fail */
export type Result<T, E = Error> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/** Paginated response structure */
export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

// =============================================================================
// BRIDGE AND ARBITRAGE TYPES
// =============================================================================

/** Asset identifier with chain information */
export interface AssetID {
  readonly symbol: string;
  readonly address: string;
  readonly chainId: number;
  readonly decimals: number;
}

/** Trading pair definition */
export interface AssetPair {
  readonly base: AssetID;
  readonly quote: AssetID;
  readonly id: string;
}

/** Arbitrage opportunity with safety guarantees */
export interface ArbitrageOpportunity {
  readonly id: string;
  readonly assetPair: AssetPair;
  readonly profitMargin: number;
  readonly executionTime: number;
  readonly riskScore: number;
  readonly sourceExchange: string;
  readonly targetExchange: string;
  readonly minAmount: SafeBigInt;
  readonly maxAmount: SafeBigInt;
  readonly estimatedGasCost: SafeBigInt;
  readonly timestamp: number;
}

/** Bridge transaction status */
export enum BridgeStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/** Cross-chain bridge transaction */
export interface BridgeTransaction {
  readonly id: string;
  readonly sourceChain: number;
  readonly targetChain: number;
  readonly asset: AssetID;
  readonly amount: SafeBigInt;
  readonly status: BridgeStatus;
  readonly sourceHash?: string;
  readonly targetHash?: string;
  readonly timestamp: number;
  readonly estimatedTime: number;
  readonly actualTime?: number;
}

// =============================================================================
// VALIDATION AND SAFETY TYPES
// =============================================================================

/** Type guard function signature */
export type TypeGuard<T> = (value: unknown) => value is T;

/** Validator function that returns validation result */
export type Validator<T> = (value: T) => Result<T, ValidationError>;

/** Validation error with detailed information */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly constraint: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Safe property access result */
export type SafePropertyAccess<T, K extends keyof T> = T[K] extends undefined 
  ? T[K] | undefined 
  : T[K];

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Make all properties of T required and readonly */
export type RequiredReadonly<T> = {
  readonly [P in keyof Required<T>]: T[P];
};

/** Extract non-function properties from a type */
export type DataOnly<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : T[K];
};

/** Create a type with optional properties made required */
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Create a partial type but keep some properties required */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/** Deep readonly type */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Event emitter event map */
export interface EventMap {
  [event: string]: (...args: any[]) => void;
}

/** Typed event emitter interface */
export interface TypedEventEmitter<T extends EventMap> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  off<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
}

// =============================================================================
// BRANDED TYPES FOR BETTER TYPE SAFETY
// =============================================================================

/** Brand a type to prevent accidental mixing */
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

/** Branded string types for IDs */
export type UserId = Brand<string, 'UserId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type ChainId = Brand<number, 'ChainId'>;
export type Address = Brand<string, 'Address'>;

/** Helper to create branded values */
export function createUserId(id: string): UserId {
  return id as UserId;
}

export function createTransactionId(id: string): TransactionId {
  return id as TransactionId;
}

export function createChainId(id: number): ChainId {
  return id as ChainId;
}

export function createAddress(address: string): Address {
  return address as Address;
}

// All types and functions are already exported inline above
// No need for additional export blocks that cause conflicts