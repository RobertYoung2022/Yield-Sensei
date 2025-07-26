/**
 * API Documentation and Versioning System Types
 * Comprehensive type definitions for documentation, versioning, and SDK generation
 */

// ============================================================================
// API VERSIONING TYPES
// ============================================================================

export interface ApiVersion {
  version: string;
  status: 'stable' | 'beta' | 'alpha' | 'deprecated' | 'sunset';
  releaseDate: Date;
  sunsetDate?: Date;
  breakingChanges: BreakingChange[];
  newFeatures: string[];
  bugFixes: string[];
  migrationGuide?: string;
}

export interface BreakingChange {
  type: 'endpoint' | 'parameter' | 'response' | 'authentication' | 'rate-limit';
  description: string;
  oldValue?: string;
  newValue?: string;
  migrationSteps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface VersioningConfig {
  defaultVersion: string;
  supportedVersions: string[];
  versionHeader: string;
  versionParam: string;
  sunsetWarningDays: number;
  deprecationWarningDays: number;
}

// ============================================================================
// OPENAPI/SWAGGER TYPES
// ============================================================================

export interface OpenApiConfig {
  title: string;
  version: string;
  description: string;
  contact: {
    name: string;
    email: string;
    url: string;
  };
  license: {
    name: string;
    url: string;
  };
  servers: OpenApiServer[];
  securitySchemes: Record<string, OpenApiSecurityScheme>;
  tags: OpenApiTag[];
  externalDocs?: {
    description: string;
    url: string;
  };
}

export interface OpenApiServer {
  url: string;
  description: string;
  variables?: Record<string, OpenApiServerVariable>;
}

export interface OpenApiServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface OpenApiSecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, OpenApiOAuthFlow>;
  openIdConnectUrl?: string;
}

export interface OpenApiOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OpenApiTag {
  name: string;
  description: string;
  externalDocs?: {
    description: string;
    url: string;
  };
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  security: string[][];
  deprecated?: boolean;
  deprecatedSince?: string;
  sunsetDate?: string;
}

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description: string;
  required: boolean;
  schema: ApiSchema;
  example?: any;
  deprecated?: boolean;
}

export interface ApiRequestBody {
  description: string;
  required: boolean;
  content: Record<string, ApiContent>;
}

export interface ApiContent {
  schema: ApiSchema;
  example?: any;
  examples?: Record<string, ApiExample>;
}

export interface ApiExample {
  summary: string;
  description?: string;
  value: any;
  externalValue?: string;
}

export interface ApiResponse {
  description: string;
  content?: Record<string, ApiContent>;
  headers?: Record<string, ApiHeader>;
  links?: Record<string, ApiLink>;
}

export interface ApiHeader {
  description: string;
  schema: ApiSchema;
}

export interface ApiLink {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: OpenApiServer;
}

export interface ApiSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  $ref?: string;
  format?: string;
  description?: string;
  example?: any;
  enum?: any[];
  default?: any;
  nullable?: boolean;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  required?: string[];
  properties?: Record<string, ApiSchema>;
  items?: ApiSchema;
  allOf?: ApiSchema[];
  anyOf?: ApiSchema[];
  oneOf?: ApiSchema[];
  not?: ApiSchema;
  discriminator?: ApiDiscriminator;
  xml?: ApiXml;
  externalDocs?: {
    description: string;
    url: string;
  };
}

export interface ApiDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface ApiXml {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

// ============================================================================
// GRAPHQL DOCUMENTATION TYPES
// ============================================================================

export interface GraphQLSchemaDoc {
  types: GraphQLTypeDoc[];
  queries: GraphQLQueryDoc[];
  mutations: GraphQLMutationDoc[];
  subscriptions: GraphQLSubscriptionDoc[];
  directives: GraphQLDirectiveDoc[];
  scalars: GraphQLScalarDoc[];
}

export interface GraphQLTypeDoc {
  name: string;
  description: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  fields?: GraphQLFieldDoc[];
  interfaces?: string[];
  possibleTypes?: string[];
  enumValues?: GraphQLEnumValueDoc[];
  inputFields?: GraphQLInputFieldDoc[];
  directives: GraphQLDirectiveDoc[];
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLFieldDoc {
  name: string;
  description: string;
  type: GraphQLTypeRef;
  args: GraphQLArgumentDoc[];
  directives: GraphQLDirectiveDoc[];
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLArgumentDoc {
  name: string;
  description: string;
  type: GraphQLTypeRef;
  defaultValue?: any;
  directives: GraphQLDirectiveDoc[];
}

export interface GraphQLInputFieldDoc {
  name: string;
  description: string;
  type: GraphQLTypeRef;
  defaultValue?: any;
  directives: GraphQLDirectiveDoc[];
}

export interface GraphQLTypeRef {
  kind: 'NON_NULL' | 'LIST' | 'NAMED';
  name?: string;
  ofType?: GraphQLTypeRef;
}

export interface GraphQLQueryDoc {
  name: string;
  description: string;
  type: GraphQLTypeRef;
  args: GraphQLArgumentDoc[];
  directives: GraphQLDirectiveDoc[];
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLMutationDoc {
  name: string;
  description: string;
  type: GraphQLTypeRef;
  args: GraphQLArgumentDoc[];
  directives: GraphQLDirectiveDoc[];
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLSubscriptionDoc {
  name: string;
  description: string;
  type: GraphQLTypeRef;
  args: GraphQLArgumentDoc[];
  directives: GraphQLDirectiveDoc[];
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLDirectiveDoc {
  name: string;
  description: string;
  locations: string[];
  args: GraphQLArgumentDoc[];
}

export interface GraphQLScalarDoc {
  name: string;
  description: string;
  directives: GraphQLDirectiveDoc[];
}

export interface GraphQLEnumValueDoc {
  name: string;
  description: string;
  directives: GraphQLDirectiveDoc[];
  deprecated?: boolean;
  deprecationReason?: string;
}

// ============================================================================
// API PLAYGROUND TYPES
// ============================================================================

export interface ApiPlayground {
  id: string;
  name: string;
  description: string;
  type: 'rest' | 'graphql' | 'websocket';
  config: PlaygroundConfig;
  examples: PlaygroundExample[];
  templates: PlaygroundTemplate[];
  settings: PlaygroundSettings;
}

export interface PlaygroundConfig {
  baseUrl: string;
  headers: Record<string, string>;
  auth: PlaygroundAuth;
  timeout: number;
  maxRetries: number;
}

export interface PlaygroundAuth {
  type: 'none' | 'bearer' | 'api-key' | 'oauth2' | 'basic';
  token?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
}

export interface PlaygroundExample {
  id: string;
  name: string;
  description: string;
  category: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  params: Record<string, any>;
  body?: any;
  response?: any;
  tags: string[];
}

export interface PlaygroundTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: PlaygroundVariable[];
  tags: string[];
}

export interface PlaygroundVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: any;
  options?: any[];
}

export interface PlaygroundSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  enableAutoComplete: boolean;
  enableSyntaxHighlighting: boolean;
  enableResponseFormatting: boolean;
  enableHistory: boolean;
  maxHistoryItems: number;
  enableCollections: boolean;
  enableEnvironmentVariables: boolean;
}

// ============================================================================
// SDK GENERATION TYPES
// ============================================================================

export interface SdkConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  repository: string;
  homepage: string;
  keywords: string[];
  languages: SdkLanguage[];
  targets: SdkTarget[];
}

export interface SdkLanguage {
  name: string;
  version: string;
  extensions: string[];
  packageManager: string;
  buildTool: string;
  testFramework: string;
}

export interface SdkTarget {
  language: string;
  platform: string;
  outputDir: string;
  template: string;
  config: Record<string, any>;
}

export interface SdkTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  version: string;
  files: SdkTemplateFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export interface SdkTemplateFile {
  path: string;
  content: string;
  type: 'template' | 'static' | 'generated';
  variables: string[];
}

// ============================================================================
// DOCUMENTATION TESTING TYPES
// ============================================================================

export interface DocTest {
  id: string;
  name: string;
  description: string;
  type: 'endpoint' | 'schema' | 'example' | 'sdk';
  config: DocTestConfig;
  assertions: DocTestAssertion[];
  setup?: DocTestSetup;
  teardown?: DocTestTeardown;
}

export interface DocTestConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
  auth: DocTestAuth;
}

export interface DocTestAuth {
  type: 'none' | 'bearer' | 'api-key' | 'oauth2';
  token?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface DocTestAssertion {
  type: 'status' | 'header' | 'body' | 'schema' | 'performance' | 'custom';
  description: string;
  condition: string;
  expected: any;
  actual?: any;
  passed: boolean;
  error?: string;
}

export interface DocTestSetup {
  steps: DocTestStep[];
  variables: Record<string, any>;
}

export interface DocTestTeardown {
  steps: DocTestStep[];
}

export interface DocTestStep {
  type: 'request' | 'wait' | 'extract' | 'validate' | 'custom';
  description: string;
  config: Record<string, any>;
  result?: any;
  error?: string;
}

// ============================================================================
// DEPRECATION POLICY TYPES
// ============================================================================

export interface DeprecationPolicy {
  version: string;
  policy: DeprecationPolicyConfig;
  notifications: DeprecationNotification[];
  timeline: DeprecationTimeline;
}

export interface DeprecationPolicyConfig {
  deprecationPeriod: number; // days
  sunsetPeriod: number; // days
  breakingChangeGracePeriod: number; // days
  notificationChannels: string[];
  autoMigration: boolean;
  rollbackSupport: boolean;
}

export interface DeprecationNotification {
  id: string;
  type: 'deprecation' | 'sunset' | 'breaking-change' | 'migration';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: string[];
  schedule: NotificationSchedule;
  recipients: string[];
  sent: boolean;
  sentAt?: Date;
}

export interface NotificationSchedule {
  type: 'immediate' | 'scheduled' | 'recurring';
  startDate: Date;
  endDate?: Date;
  interval?: number; // days
  times: string[]; // HH:mm format
}

export interface DeprecationTimeline {
  deprecationDate: Date;
  sunsetDate: Date;
  breakingChanges: BreakingChange[];
  migrationMilestones: MigrationMilestone[];
}

export interface MigrationMilestone {
  date: Date;
  description: string;
  type: 'announcement' | 'deprecation' | 'breaking-change' | 'sunset';
  status: 'pending' | 'in-progress' | 'completed';
  notes?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DocumentationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DocumentationError';
  }
}

export class VersioningError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'VersioningError';
  }
}

export class SdkGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SdkGenerationError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface DocumentationStats {
  totalEndpoints: number;
  totalTypes: number;
  totalExamples: number;
  coverage: number;
  lastUpdated: Date;
  version: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warning';
}

export interface ValidationSuggestion {
  path: string;
  message: string;
  code: string;
  severity: 'info';
} 