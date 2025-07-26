/**
 * Type-safe replacements for common 'any' usage patterns
 * Provides strongly-typed alternatives to reduce any type usage in the codebase
 */

/**
 * Generic function type that accepts any arguments and returns any value
 * Use instead of: (...args: any[]) => any
 */
export type UnknownFunction = (...args: unknown[]) => unknown;

/**
 * Generic async function type
 * Use instead of: (...args: any[]) => Promise<any>
 */
export type UnknownAsyncFunction = (...args: unknown[]) => Promise<unknown>;

/**
 * Object with string keys and unknown values
 * Use instead of: { [key: string]: any }
 */
export type UnknownRecord = Record<string, unknown>;

/**
 * Array of unknown elements
 * Use instead of: any[]
 */
export type UnknownArray = unknown[];

/**
 * JSON-serializable value type
 * Use instead of 'any' for JSON data
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonObject 
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

/**
 * HTTP request/response types to replace Express any types
 */
export interface TypedRequest<
  TBody = unknown,
  TQuery = UnknownRecord,
  TParams = UnknownRecord
> {
  body: TBody;
  query: TQuery;
  params: TParams;
  headers: Record<string, string | string[] | undefined>;
  user?: unknown;
  [key: string]: unknown;
}

export interface TypedResponse<TBody = unknown> {
  status(code: number): this;
  json(body: TBody): this;
  send(body?: unknown): this;
  setHeader(name: string, value: string | number | string[]): this;
  [key: string]: unknown;
}

/**
 * Database entity with common fields
 * Use instead of any for database records
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

/**
 * API response wrapper
 * Use instead of any for API responses
 */
export interface ApiResponse<TData = unknown> {
  success: boolean;
  data: TData;
  message?: string;
  errors?: string[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: unknown;
  };
}

/**
 * Event emitter event map
 * Use instead of any for event definitions
 */
export type EventMap = Record<string, unknown[]>;

/**
 * Configuration object with validation
 * Use instead of any for config objects
 */
export interface TypedConfig<T extends UnknownRecord = UnknownRecord> {
  readonly config: T;
  readonly isValid: boolean;
  readonly errors: string[];
  validate(): boolean;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
}

/**
 * Factory function type
 * Use instead of any for factory patterns
 */
export type Factory<T, TArgs extends unknown[] = unknown[]> = (...args: TArgs) => T;

/**
 * Constructor type
 * Use instead of any for constructor patterns
 */
export type Constructor<T = unknown, TArgs extends unknown[] = unknown[]> = new (...args: TArgs) => T;

/**
 * Middleware function type for Express-like frameworks
 * Use instead of any for middleware
 */
export type Middleware<
  TReq = TypedRequest,
  TRes = TypedResponse,
  TNext = UnknownFunction
> = (req: TReq, res: TRes, next: TNext) => void | Promise<void>;

/**
 * Service interface with common methods
 * Use instead of any for service definitions
 */
export interface TypedService<TEntity extends BaseEntity = BaseEntity> {
  findById(id: string): Promise<TEntity | null>;
  findMany(criteria: Partial<TEntity>): Promise<TEntity[]>;
  create(data: Omit<TEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TEntity>;
  update(id: string, data: Partial<TEntity>): Promise<TEntity | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * Repository pattern interface
 * Use instead of any for repository definitions
 */
export interface TypedRepository<TEntity extends BaseEntity = BaseEntity> {
  save(entity: TEntity): Promise<TEntity>;
  findById(id: string): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  findBy(criteria: Partial<TEntity>): Promise<TEntity[]>;
  deleteById(id: string): Promise<boolean>;
  count(criteria?: Partial<TEntity>): Promise<number>;
}

/**
 * Cache interface to replace any cache implementations
 */
export interface TypedCache<TValue = unknown> {
  get(key: string): Promise<TValue | null>;
  set(key: string, value: TValue, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
}

/**
 * Logger interface to replace console.log with any
 */
export interface TypedLogger {
  debug(message: string, meta?: UnknownRecord): void;
  info(message: string, meta?: UnknownRecord): void;
  warn(message: string, meta?: UnknownRecord): void;
  error(message: string | Error, meta?: UnknownRecord): void;
  child(meta: UnknownRecord): TypedLogger;
}

/**
 * Validator function type
 * Use instead of any for validation functions
 */
export type Validator<T> = (value: unknown) => value is T;

/**
 * Transformer function type
 * Use instead of any for data transformation
 */
export type Transformer<TInput, TOutput> = (input: TInput) => TOutput;

/**
 * Serializer interface
 * Use instead of any for serialization
 */
export interface TypedSerializer<T> {
  serialize(value: T): string;
  deserialize(data: string): T;
  canSerialize(value: unknown): value is T;
}

/**
 * Plugin interface for extensible systems
 * Use instead of any for plugin definitions
 */
export interface TypedPlugin<TConfig = UnknownRecord> {
  readonly name: string;
  readonly version: string;
  readonly config: TConfig;
  initialize(context: UnknownRecord): Promise<void>;
  teardown(): Promise<void>;
  isInitialized(): boolean;
}

/**
 * Metrics collector interface
 * Use instead of any for metrics
 */
export interface TypedMetrics {
  counter(name: string, value?: number, labels?: UnknownRecord): void;
  gauge(name: string, value: number, labels?: UnknownRecord): void;
  histogram(name: string, value: number, labels?: UnknownRecord): void;
  timer(name: string): () => void;
}

/**
 * Queue interface for job processing
 * Use instead of any for queue systems
 */
export interface TypedQueue<TJob = UnknownRecord> {
  add(job: TJob, options?: { delay?: number; priority?: number }): Promise<string>;
  process(handler: (job: TJob) => Promise<void>): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getWaiting(): Promise<TJob[]>;
  getActive(): Promise<TJob[]>;
  getCompleted(): Promise<TJob[]>;
  getFailed(): Promise<Array<{ job: TJob; error: Error }>>
}

/**
 * State machine interface
 * Use instead of any for state management
 */
export interface TypedStateMachine<
  TState extends string = string,
  TEvent extends string = string,
  TContext = UnknownRecord
> {
  currentState: TState;
  context: TContext;
  transition(event: TEvent, payload?: unknown): Promise<void>;
  canTransition(event: TEvent): boolean;
  onEnter(state: TState, handler: (context: TContext) => void): void;
  onExit(state: TState, handler: (context: TContext) => void): void;
}

/**
 * WebSocket connection interface
 * Use instead of any for WebSocket handling
 */
export interface TypedWebSocket<TMessage = UnknownRecord> {
  readonly id: string;
  readonly readyState: number;
  send(message: TMessage): void;
  close(code?: number, reason?: string): void;
  ping(data?: Buffer): void;
  on(event: 'message', listener: (data: TMessage) => void): void;
  on(event: 'close', listener: (code: number, reason: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'ping' | 'pong', listener: (data: Buffer) => void): void;
}

/**
 * Utility type to convert any to unknown in existing types
 */
export type ReplaceAny<T> = T extends any
  ? unknown extends T
    ? unknown
    : T
  : T;

/**
 * Helper to create typed versions of commonly used any types
 */
export namespace TypedHelpers {
  /**
   * Create a typed request handler
   */
  export function createHandler<TBody = unknown, TQuery = UnknownRecord, TParams = UnknownRecord>(
    handler: (req: TypedRequest<TBody, TQuery, TParams>, res: TypedResponse) => void | Promise<void>
  ): Middleware<TypedRequest<TBody, TQuery, TParams>, TypedResponse> {
    return handler;
  }

  /**
   * Create a typed service factory
   */
  export function createService<T extends TypedService>(
    ServiceClass: Constructor<T>,
    ...args: unknown[]
  ): T {
    return new ServiceClass(...args);
  }

  /**
   * Create a typed validator
   */
  export function createValidator<T>(
    predicate: (value: unknown) => boolean
  ): Validator<T> {
    return (value: unknown): value is T => predicate(value);
  }

  /**
   * Create a typed configuration object
   */
  export function createConfig<T extends UnknownRecord>(
    config: T,
    validator?: Validator<T>
  ): TypedConfig<T> {
    const errors: string[] = [];
    const isValid = validator ? validator(config) : true;

    return {
      config,
      isValid,
      errors,
      validate() {
        return validator ? validator(this.config) : true;
      },
      get<K extends keyof T>(key: K): T[K] {
        return this.config[key];
      },
      set<K extends keyof T>(key: K, value: T[K]): void {
        (this.config as any)[key] = value;
      }
    };
  }

  /**
   * Create a typed API response
   */
  export function createApiResponse<T>(
    data: T,
    success: boolean = true,
    message?: string
  ): ApiResponse<T> {
    return {
      success,
      data,
      ...(message && { message })
    };
  }
}

/**
 * Common type aliases to replace any usage
 */
export type {
  UnknownFunction as AnyFunction,
  UnknownAsyncFunction as AnyAsyncFunction,
  UnknownRecord as AnyObject,
  UnknownArray as AnyArray,
  JsonValue as AnyJson
};