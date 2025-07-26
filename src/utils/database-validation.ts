/**
 * Database Validation Utilities
 * Type-safe validation for database operations using comprehensive schema definitions
 */

import type {
  DatabaseSchema,
  TableName,
  TableSchemaMap,
  FieldValidation,
  TableValidationSchema,
  QueryFilter,
  QueryOptions,
} from '../types/database-schemas.js';

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: any;
}

export interface ValidationWarning {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: any;
}

// =============================================================================
// FIELD VALIDATORS
// =============================================================================

/**
 * Validate a single field value against validation rules
 */
export function validateField(
  fieldName: string,
  value: any,
  validation: FieldValidation
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required validation
  if (validation.required && (value === null || value === undefined || value === '')) {
    errors.push({
      field: fieldName,
      message: `Field '${fieldName}' is required`,
      code: 'REQUIRED_FIELD_MISSING',
      value,
    });
    return { isValid: false, errors, warnings };
  }

  // Skip further validation if value is null/undefined and not required
  if (value === null || value === undefined) {
    return { isValid: true, errors, warnings };
  }

  // Type validation
  if (validation.type) {
    const isValidType = validateType(value, validation.type);
    if (!isValidType) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be of type '${validation.type}'`,
        code: 'INVALID_TYPE',
        value,
      });
    }
  }

  // String validations
  if (typeof value === 'string') {
    if (validation.minLength && value.length < validation.minLength) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be at least ${validation.minLength} characters long`,
        code: 'MIN_LENGTH_VIOLATION',
        value,
      });
    }

    if (validation.maxLength && value.length > validation.maxLength) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be no more than ${validation.maxLength} characters long`,
        code: 'MAX_LENGTH_VIOLATION',
        value,
      });
    }

    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' does not match required pattern`,
          code: 'PATTERN_MISMATCH',
          value,
        });
      }
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be at least ${validation.min}`,
        code: 'MIN_VALUE_VIOLATION',
        value,
      });
    }

    if (validation.max !== undefined && value > validation.max) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be no more than ${validation.max}`,
        code: 'MAX_VALUE_VIOLATION',
        value,
      });
    }
  }

  // Enum validation
  if (validation.enum && !validation.enum.includes(value)) {
    errors.push({
      field: fieldName,
      message: `Field '${fieldName}' must be one of: ${validation.enum.join(', ')}`,
      code: 'INVALID_ENUM_VALUE',
      value,
    });
  }

  // Custom validation
  if (validation.custom) {
    const customResult = validation.custom(value);
    if (customResult !== true) {
      errors.push({
        field: fieldName,
        message: typeof customResult === 'string' ? customResult : `Field '${fieldName}' failed custom validation`,
        code: 'CUSTOM_VALIDATION_FAILED',
        value,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate type of a value
 */
function validateType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    case 'bigint':
      return typeof value === 'bigint' || (typeof value === 'string' && /^\d+$/.test(value));
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

// =============================================================================
// SCHEMA VALIDATORS
// =============================================================================

/**
 * Validate an entire record against a table schema
 */
export function validateRecord<T extends DatabaseSchema>(
  tableName: TableName,
  record: Partial<T>,
  schema: TableValidationSchema<T>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate each field
  for (const [fieldName, validation] of Object.entries(schema.fields)) {
    const fieldValue = (record as any)[fieldName];
    const fieldResult = validateField(fieldName, fieldValue, validation);
    
    errors.push(...fieldResult.errors);
    warnings.push(...fieldResult.warnings);
  }

  // Check for unknown fields
  for (const fieldName of Object.keys(record)) {
    if (!(fieldName in schema.fields)) {
      warnings.push({
        field: fieldName,
        message: `Unknown field '${fieldName}' in table '${tableName}'`,
        code: 'UNKNOWN_FIELD',
        value: (record as any)[fieldName],
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate query filters
 */
export function validateQueryFilters<T extends DatabaseSchema>(
  filters: QueryFilter<T>[],
  schema: TableValidationSchema<T>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const filter of filters) {
    const fieldName = String(filter.field);
    
    // Check if field exists in schema
    if (!(fieldName in schema.fields)) {
      errors.push({
        field: fieldName,
        message: `Unknown field '${fieldName}' in filter`,
        code: 'UNKNOWN_FILTER_FIELD',
        value: filter.value,
      });
      continue;
    }

    // Validate filter value against field type
    const fieldValidation = schema.fields[filter.field];
    if (fieldValidation) {
      const valueResult = validateField(fieldName, filter.value, fieldValidation);
      errors.push(...valueResult.errors);
      warnings.push(...valueResult.warnings);
    }

    // Validate operator compatibility
    const validOperators = getValidOperatorsForType(fieldValidation?.type);
    if (validOperators && !validOperators.includes(filter.operator)) {
      errors.push({
        field: fieldName,
        message: `Operator '${filter.operator}' is not valid for field type '${fieldValidation?.type}'`,
        code: 'INVALID_FILTER_OPERATOR',
        value: filter.operator,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get valid operators for a field type
 */
function getValidOperatorsForType(type?: string): string[] | null {
  if (!type) return null;

  switch (type) {
    case 'string':
      return ['eq', 'ne', 'in', 'nin', 'like'];
    case 'number':
    case 'bigint':
    case 'date':
      return ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'between'];
    case 'boolean':
      return ['eq', 'ne'];
    case 'array':
      return ['in', 'nin'];
    default:
      return ['eq', 'ne', 'in', 'nin'];
  }
}

// =============================================================================
// PREDEFINED VALIDATION SCHEMAS
// =============================================================================

/**
 * Common field validations
 */
export const CommonValidations = {
  id: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 255,
  },
  
  address: {
    required: true,
    type: 'string' as const,
    pattern: '^0x[a-fA-F0-9]{40}$',
  },
  
  chainId: {
    required: true,
    type: 'string' as const,
    enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche', 'fantom'],
  },
  
  percentage: {
    required: true,
    type: 'number' as const,
    min: 0,
    max: 100,
  },
  
  apy: {
    required: true,
    type: 'number' as const,
    min: 0,
    max: 10000, // 100x return max
  },
  
  riskScore: {
    required: true,
    type: 'number' as const,
    min: 0,
    max: 100,
  },
  
  timestamp: {
    required: true,
    type: 'date' as const,
  },
  
  bigintAmount: {
    required: true,
    type: 'bigint' as const,
    min: 0,
  },
  
  url: {
    type: 'string' as const,
    pattern: '^https?:\\/\\/.+',
  },
  
  email: {
    type: 'string' as const,
    pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
  },
} as const;

/**
 * Type guard to check if a value is a valid database schema
 */
export function isDatabaseSchema(value: any): value is DatabaseSchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'created_at' in value &&
    'updated_at' in value
  );
}

/**
 * Type guard to check if a table name is valid
 */
export function isValidTableName(value: string): value is TableName {
  const validTableNames: TableName[] = [
    'protocols',
    'assets',
    'chains',
    'price_data',
    'ohlcv_data',
    'pools',
    'yield_opportunities',
    'bridge_routes',
    'bridge_transactions',
    'arbitrage_opportunities',
    'user_portfolios',
    'protocol_tvl',
    'market_sentiment',
    'security_audits',
  ];
  
  return validTableNames.includes(value as TableName);
}

/**
 * Sanitize user input for database operations
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential SQL injection patterns
    return input
      .replace(/[';\\x00-\\x1f\\x7f-\\x9f]/g, '') // Remove control characters and semicolons
      .replace(/--.*$/gm, '') // Remove SQL comments
      .replace(/\/\*.*?\*\//g, '') // Remove SQL block comments
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeInput(key);
      if (typeof sanitizedKey === 'string' && sanitizedKey.length > 0) {
        sanitized[sanitizedKey] = sanitizeInput(value);
      }
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Create a type-safe query builder
 */
export class QueryBuilder<T extends DatabaseSchema> {
  private filters: QueryFilter<T>[] = [];
  
  constructor(
    private tableName: TableName,
    private schema: TableValidationSchema<T>
  ) {}
  
  where(field: keyof T, operator: QueryFilter<T>['operator'], value: any): this {
    this.filters.push({ field, operator, value });
    return this;
  }
  
  validate(): ValidationResult {
    return validateQueryFilters(this.filters, this.schema);
  }
  
  build(): QueryOptions<T> {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid query: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    return {
      filters: this.filters,
    };
  }
}

/**
 * Database operation guard with comprehensive validation
 */
export function validateDatabaseOperation<T extends DatabaseSchema>(
  operation: 'create' | 'read' | 'update' | 'delete',
  tableName: TableName,
  data: Partial<T>,
  schema: TableValidationSchema<T>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Sanitize input data
  const sanitizedData = sanitizeInput(data);
  
  // Validate record structure
  const recordValidation = validateRecord(tableName, sanitizedData, schema);
  errors.push(...recordValidation.errors);
  warnings.push(...recordValidation.warnings);
  
  // Operation-specific validations
  if (operation === 'create') {
    // Ensure required fields are present for creation
    const requiredFields = Object.entries(schema.fields)
      .filter(([_, validation]) => validation.required)
      .map(([fieldName, _]) => fieldName);
    
    for (const fieldName of requiredFields) {
      if (!(fieldName in sanitizedData) || sanitizedData[fieldName as keyof typeof sanitizedData] === undefined) {
        errors.push({
          field: fieldName,
          message: `Required field '${fieldName}' is missing for create operation`,
          code: 'CREATE_MISSING_REQUIRED_FIELD',
        });
      }
    }
  }
  
  if (operation === 'update') {
    // Ensure at least one field is being updated
    const updateFields = Object.keys(sanitizedData).filter(
      key => key !== 'id' && key !== 'created_at'
    );
    
    if (updateFields.length === 0) {
      warnings.push({
        field: '_operation',
        message: 'Update operation has no fields to update',
        code: 'UPDATE_NO_FIELDS',
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}