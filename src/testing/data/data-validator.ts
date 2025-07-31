/**
 * Data Validator
 * Comprehensive validation system for test data quality and consistency
 */

import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface ValidationRule {
  name: string;
  description: string;
  field?: string; // Field to validate, if not specified applies to entire record
  type: 'required' | 'type' | 'format' | 'range' | 'enum' | 'custom' | 'relationship' | 'uniqueness' | 'consistency';
  parameters: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  condition?: (record: any) => boolean; // Optional condition for when to apply
}

export interface ValidationSchema {
  name: string;
  version: string;
  description: string;
  rules: ValidationRule[];
  globalRules?: ValidationRule[]; // Rules that apply to the entire dataset
}

export interface ValidationError {
  rule: string;
  field?: string;
  recordIndex?: number;
  recordId?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  value?: any;
  expectedValue?: any;
}

export interface ValidationResult {
  valid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  statistics: {
    errorsByRule: Record<string, number>;
    errorsByField: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  };
  summary: {
    criticalIssues: number;
    dataQualityScore: number; // 0-100
    completenessScore: number; // 0-100
    consistencyScore: number; // 0-100
    validityScore: number; // 0-100
  };
  processingTime: number;
}

export class DataValidator {
  private logger: Logger;
  private customValidators: Map<string, (value: any, parameters: any, record: any) => boolean> = new Map();

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/data-validator.log' })
      ],
    });

    this.initializeCustomValidators();
  }

  async validateData(data: any[], schema: ValidationSchema): Promise<ValidationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting validation with schema: ${schema.name}`);

    const result: ValidationResult = {
      valid: true,
      totalRecords: data.length,
      validRecords: 0,
      invalidRecords: 0,
      errors: [],
      warnings: [],
      infos: [],
      statistics: {
        errorsByRule: {},
        errorsByField: {},
        errorsBySeverity: {},
      },
      summary: {
        criticalIssues: 0,
        dataQualityScore: 0,
        completenessScore: 0,
        consistencyScore: 0,
        validityScore: 0,
      },
      processingTime: 0,
    };

    // Validate individual records
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const recordErrors = await this.validateRecord(record, schema.rules, i);
      
      if (recordErrors.length > 0) {
        result.invalidRecords++;
        result.errors.push(...recordErrors.filter(e => e.severity === 'error'));
        result.warnings.push(...recordErrors.filter(e => e.severity === 'warning'));
        result.infos.push(...recordErrors.filter(e => e.severity === 'info'));
      } else {
        result.validRecords++;
      }
    }

    // Validate global rules (dataset-level validations)
    if (schema.globalRules) {
      const globalErrors = await this.validateGlobalRules(data, schema.globalRules);
      result.errors.push(...globalErrors.filter(e => e.severity === 'error'));
      result.warnings.push(...globalErrors.filter(e => e.severity === 'warning'));
      result.infos.push(...globalErrors.filter(e => e.severity === 'info'));
    }

    // Calculate statistics
    this.calculateStatistics(result);
    
    // Calculate quality scores
    this.calculateQualityScores(result);

    result.valid = result.errors.length === 0;
    result.processingTime = Date.now() - startTime;

    this.logger.info(`Validation completed in ${result.processingTime}ms. Valid: ${result.valid}`);
    return result;
  }

  private async validateRecord(
    record: any,
    rules: ValidationRule[],
    recordIndex: number
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      // Check condition if present
      if (rule.condition && !rule.condition(record)) {
        continue;
      }

      try {
        const error = await this.validateRule(record, rule, recordIndex);
        if (error) {
          errors.push(error);
        }
      } catch (validationError) {
        errors.push({
          rule: rule.name,
          field: rule.field,
          recordIndex,
          recordId: record.id || record._id,
          severity: 'error',
          message: `Validation rule failed: ${(validationError as Error).message}`,
        });
      }
    }

    return errors;
  }

  private async validateRule(
    record: any,
    rule: ValidationRule,
    recordIndex: number
  ): Promise<ValidationError | null> {
    const fieldValue = rule.field ? this.getNestedValue(record, rule.field) : record;

    switch (rule.type) {
      case 'required':
        return this.validateRequired(fieldValue, rule, record, recordIndex);
      case 'type':
        return this.validateType(fieldValue, rule, record, recordIndex);
      case 'format':
        return this.validateFormat(fieldValue, rule, record, recordIndex);
      case 'range':
        return this.validateRange(fieldValue, rule, record, recordIndex);
      case 'enum':
        return this.validateEnum(fieldValue, rule, record, recordIndex);
      case 'custom':
        return this.validateCustom(fieldValue, rule, record, recordIndex);
      case 'relationship':
        return this.validateRelationship(record, rule, recordIndex);
      case 'uniqueness':
        // This would need access to all records, handled at dataset level
        return null;
      case 'consistency':
        return this.validateConsistency(record, rule, recordIndex);
      default:
        throw new Error(`Unknown validation rule type: ${rule.type}`);
    }
  }

  private validateRequired(
    value: any,
    rule: ValidationRule,
    record: any,
    recordIndex: number
  ): ValidationError | null {
    if (value === undefined || value === null || value === '') {
      return {
        rule: rule.name,
        field: rule.field,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: `Required field '${rule.field}' is missing or empty`,
        value,
      };
    }
    return null;
  }

  private validateType(
    value: any,
    rule: ValidationRule,
    record: any,
    recordIndex: number
  ): ValidationError | null {
    if (value === undefined || value === null) {
      return null; // Skip type validation for missing values
    }

    const expectedType = rule.parameters.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    let isValid = false;

    switch (expectedType) {
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'integer':
        isValid = typeof value === 'number' && Number.isInteger(value);
        break;
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      case 'object':
        isValid = typeof value === 'object' && !Array.isArray(value);
        break;
      case 'date':
        isValid = value instanceof Date || !isNaN(Date.parse(value));
        break;
      case 'email':
        isValid = typeof value === 'string' && this.isValidEmail(value);
        break;
      case 'url':
        isValid = typeof value === 'string' && this.isValidUrl(value);
        break;
      case 'uuid':
        isValid = typeof value === 'string' && this.isValidUUID(value);
        break;
      default:
        isValid = actualType === expectedType;
    }

    if (!isValid) {
      return {
        rule: rule.name,
        field: rule.field,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: `Field '${rule.field}' has invalid type. Expected: ${expectedType}, got: ${actualType}`,
        value,
        expectedValue: expectedType,
      };
    }

    return null;
  }

  private validateFormat(
    value: any,
    rule: ValidationRule,
    record: any,
    recordIndex: number
  ): ValidationError | null {
    if (value === undefined || value === null || typeof value !== 'string') {
      return null; // Skip format validation for non-string values
    }

    const pattern = rule.parameters.pattern;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    if (!regex.test(value)) {
      return {
        rule: rule.name,
        field: rule.field,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: `Field '${rule.field}' does not match required format`,
        value,
        expectedValue: pattern.toString(),
      };
    }

    return null;
  }

  private validateRange(
    value: any,
    rule: ValidationRule,
    record: any,
    recordIndex: number
  ): ValidationError | null {
    if (value === undefined || value === null) {
      return null;
    }

    const { min, max, minLength, maxLength } = rule.parameters;

    // Numeric range validation
    if (typeof value === 'number') {
      if (min !== undefined && value < min) {
        return {
          rule: rule.name,
          field: rule.field,
          recordIndex,
          recordId: record.id || record._id,
          severity: rule.severity,
          message: `Field '${rule.field}' value ${value} is below minimum ${min}`,
          value,
          expectedValue: `>= ${min}`,
        };
      }
      if (max !== undefined && value > max) {
        return {
          rule: rule.name,
          field: rule.field,
          recordIndex,
          recordId: record.id || record._id,
          severity: rule.severity,
          message: `Field '${rule.field}' value ${value} is above maximum ${max}`,
          value,
          expectedValue: `<= ${max}`,
        };
      }
    }

    // String/Array length validation
    if (typeof value === 'string' || Array.isArray(value)) {
      const length = value.length;
      if (minLength !== undefined && length < minLength) {
        return {
          rule: rule.name,
          field: rule.field,
          recordIndex,
          recordId: record.id || record._id,
          severity: rule.severity,
          message: `Field '${rule.field}' length ${length} is below minimum ${minLength}`,
          value,
          expectedValue: `length >= ${minLength}`,
        };
      }
      if (maxLength !== undefined && length > maxLength) {
        return {
          rule: rule.name,
          field: rule.field,
          recordIndex,
          recordId: record.id || record._id,
          severity: rule.severity,
          message: `Field '${rule.field}' length ${length} is above maximum ${maxLength}`,
          value,
          expectedValue: `length <= ${maxLength}`,
        };
      }
    }

    return null;
  }

  private validateEnum(
    value: any,
    rule: ValidationRule,
    record: any,
    recordIndex: number
  ): ValidationError | null {
    if (value === undefined || value === null) {
      return null;
    }

    const allowedValues = rule.parameters.values;
    if (!Array.isArray(allowedValues)) {
      throw new Error('Enum validation requires "values" parameter as array');
    }

    if (!allowedValues.includes(value)) {
      return {
        rule: rule.name,
        field: rule.field,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: `Field '${rule.field}' has invalid value '${value}'. Allowed values: ${allowedValues.join(', ')}`,
        value,
        expectedValue: allowedValues,
      };
    }

    return null;
  }

  private validateCustom(
    value: any,
    rule: ValidationRule,
    record: any,
    recordIndex: number
  ): ValidationError | null {
    const validatorName = rule.parameters.validator;
    const validator = this.customValidators.get(validatorName);

    if (!validator) {
      throw new Error(`Custom validator '${validatorName}' not found`);
    }

    const isValid = validator(value, rule.parameters, record);
    if (!isValid) {
      return {
        rule: rule.name,
        field: rule.field,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: rule.parameters.message || `Custom validation failed for field '${rule.field}'`,
        value,
      };
    }

    return null;
  }

  private validateRelationship(
    record: any,
    rule: ValidationRule,
    recordIndex: number
  ): ValidationError | null {
    const { sourceField, targetField, relationship } = rule.parameters;
    const sourceValue = this.getNestedValue(record, sourceField);
    const targetValue = this.getNestedValue(record, targetField);

    if (sourceValue === undefined || targetValue === undefined) {
      return null; // Skip if either field is missing
    }

    let isValid = false;

    switch (relationship) {
      case 'greater_than':
        isValid = sourceValue > targetValue;
        break;
      case 'less_than':
        isValid = sourceValue < targetValue;
        break;
      case 'equal':
        isValid = sourceValue === targetValue;
        break;
      case 'not_equal':
        isValid = sourceValue !== targetValue;
        break;
      case 'contains':
        isValid = Array.isArray(sourceValue) && sourceValue.includes(targetValue);
        break;
      default:
        throw new Error(`Unknown relationship type: ${relationship}`);
    }

    if (!isValid) {
      return {
        rule: rule.name,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: `Relationship validation failed: ${sourceField} ${relationship} ${targetField}`,
        value: { [sourceField]: sourceValue, [targetField]: targetValue },
      };
    }

    return null;
  }

  private validateConsistency(
    record: any,
    rule: ValidationRule,
    recordIndex: number
  ): ValidationError | null {
    const { fields, consistencyType } = rule.parameters;
    
    if (!Array.isArray(fields) || fields.length < 2) {
      throw new Error('Consistency validation requires at least 2 fields');
    }

    const values = fields.map((field: string) => this.getNestedValue(record, field));
    let isConsistent = false;

    switch (consistencyType) {
      case 'all_equal':
        isConsistent = values.every(val => val === values[0]);
        break;
      case 'all_different':
        isConsistent = new Set(values).size === values.length;
        break;
      case 'sum_equals':
        const expectedSum = rule.parameters.expectedSum;
        const actualSum = values.reduce((sum, val) => sum + (val || 0), 0);
        isConsistent = actualSum === expectedSum;
        break;
      default:
        throw new Error(`Unknown consistency type: ${consistencyType}`);
    }

    if (!isConsistent) {
      return {
        rule: rule.name,
        recordIndex,
        recordId: record.id || record._id,
        severity: rule.severity,
        message: `Consistency validation failed for fields: ${fields.join(', ')}`,
        value: Object.fromEntries(fields.map((field: string, i: number) => [field, values[i]])),
      };
    }

    return null;
  }

  private async validateGlobalRules(data: any[], rules: ValidationRule[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      if (rule.type === 'uniqueness') {
        const uniquenessErrors = this.validateUniqueness(data, rule);
        errors.push(...uniquenessErrors);
      }
      // Add other global validation types as needed
    }

    return errors;
  }

  private validateUniqueness(data: any[], rule: ValidationRule): ValidationError[] {
    const errors: ValidationError[] = [];
    const field = rule.field!;
    const valueMap = new Map<any, number[]>();

    // Collect all values and their record indices
    data.forEach((record, index) => {
      const value = this.getNestedValue(record, field);
      if (value !== undefined && value !== null) {
        if (!valueMap.has(value)) {
          valueMap.set(value, []);
        }
        valueMap.get(value)!.push(index);
      }
    });

    // Find duplicates
    for (const [value, indices] of valueMap) {
      if (indices.length > 1) {
        for (let i = 1; i < indices.length; i++) { // Skip first occurrence
          const recordIndex = indices[i]!;
          const record = data[recordIndex];
          errors.push({
            rule: rule.name,
            field,
            recordIndex,
            recordId: record?.id || record?._id,
            severity: rule.severity,
            message: `Duplicate value '${value}' found in field '${field}'`,
            value,
          });
        }
      }
    }

    return errors;
  }

  private calculateStatistics(result: ValidationResult): void {
    const allErrors = [...result.errors, ...result.warnings, ...result.infos];

    // Count by rule
    for (const error of allErrors) {
      result.statistics.errorsByRule[error.rule] = 
        (result.statistics.errorsByRule[error.rule] || 0) + 1;
    }

    // Count by field
    for (const error of allErrors) {
      if (error.field) {
        result.statistics.errorsByField[error.field] = 
          (result.statistics.errorsByField[error.field] || 0) + 1;
      }
    }

    // Count by severity
    for (const error of allErrors) {
      result.statistics.errorsBySeverity[error.severity] = 
        (result.statistics.errorsBySeverity[error.severity] || 0) + 1;
    }
  }

  private calculateQualityScores(result: ValidationResult): void {
    const totalRecords = result.totalRecords;
    const criticalErrors = result.errors.length;
    const warnings = result.warnings.length;

    // Overall data quality score (penalize errors more than warnings)
    const errorPenalty = (criticalErrors / totalRecords) * 60;
    const warningPenalty = (warnings / totalRecords) * 30;
    result.summary.dataQualityScore = Math.max(0, 100 - errorPenalty - warningPenalty);

    // Completeness score (based on required field violations)
    const requiredFieldErrors = result.errors.filter(e => e.rule.includes('required')).length;
    const completenessPenalty = (requiredFieldErrors / totalRecords) * 100;
    result.summary.completenessScore = Math.max(0, 100 - completenessPenalty);

    // Consistency score (based on relationship and consistency violations)
    const consistencyErrors = result.errors.filter(e => 
      e.rule.includes('relationship') || e.rule.includes('consistency')
    ).length;
    const consistencyPenalty = (consistencyErrors / totalRecords) * 100;
    result.summary.consistencyScore = Math.max(0, 100 - consistencyPenalty);

    // Validity score (based on format, type, and range violations)
    const validityErrors = result.errors.filter(e => 
      e.rule.includes('format') || e.rule.includes('type') || e.rule.includes('range')
    ).length;
    const validityPenalty = (validityErrors / totalRecords) * 100;
    result.summary.validityScore = Math.max(0, 100 - validityPenalty);

    // Critical issues count
    result.summary.criticalIssues = result.errors.filter(e => e.severity === 'error').length;
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  }

  private initializeCustomValidators(): void {
    // Financial validators
    this.customValidators.set('positive_amount', (value: any) => {
      return typeof value === 'number' && value > 0;
    });

    this.customValidators.set('valid_symbol', (value: any) => {
      return typeof value === 'string' && /^[A-Z]{2,10}$/.test(value);
    });

    this.customValidators.set('valid_percentage', (value: any) => {
      return typeof value === 'number' && value >= 0 && value <= 100;
    });

    // Date validators
    this.customValidators.set('future_date', (value: any) => {
      const date = new Date(value);
      return date.getTime() > Date.now();
    });

    this.customValidators.set('past_date', (value: any) => {
      const date = new Date(value);
      return date.getTime() < Date.now();
    });

    // Portfolio validators
    this.customValidators.set('valid_portfolio_weight', (value: any, params: any, record: any) => {
      if (typeof value !== 'number') return false;
      
      // Check if weights sum to approximately 100%
      const positions = record.positions || [];
      const totalWeight = positions.reduce((sum: number, pos: any) => sum + (pos.weight || 0), 0);
      return Math.abs(totalWeight - 100) < 0.01; // Allow for small rounding errors
    });
  }

  // Predefined validation schemas
  static getPredefinedSchemas(): Record<string, ValidationSchema> {
    return {
      userSchema: {
        name: 'User Data Schema',
        version: '1.0.0',
        description: 'Validation schema for user data',
        rules: [
          {
            name: 'email_required',
            description: 'Email is required',
            field: 'email',
            type: 'required',
            parameters: {},
            severity: 'error',
          },
          {
            name: 'email_format',
            description: 'Email must be valid format',
            field: 'email',
            type: 'type',
            parameters: { type: 'email' },
            severity: 'error',
          },
          {
            name: 'username_required',
            description: 'Username is required',
            field: 'username',
            type: 'required',
            parameters: {},
            severity: 'error',
          },
          {
            name: 'username_length',
            description: 'Username must be 3-50 characters',
            field: 'username',
            type: 'range',
            parameters: { minLength: 3, maxLength: 50 },
            severity: 'error',
          },
          {
            name: 'age_range',
            description: 'Age must be between 18 and 120',
            field: 'age',
            type: 'range',
            parameters: { min: 18, max: 120 },
            severity: 'warning',
          },
        ],
        globalRules: [
          {
            name: 'email_uniqueness',
            description: 'Email addresses must be unique',
            field: 'email',
            type: 'uniqueness',
            parameters: {},
            severity: 'error',
          },
        ],
      },

      financialSchema: {
        name: 'Financial Data Schema',
        version: '1.0.0',
        description: 'Validation schema for financial data',
        rules: [
          {
            name: 'symbol_required',
            description: 'Trading symbol is required',
            field: 'symbol',
            type: 'required',
            parameters: {},
            severity: 'error',
          },
          {
            name: 'symbol_format',
            description: 'Symbol must be valid format',
            field: 'symbol',
            type: 'custom',
            parameters: { validator: 'valid_symbol' },
            severity: 'error',
          },
          {
            name: 'price_positive',
            description: 'Price must be positive',
            field: 'price',
            type: 'custom',
            parameters: { validator: 'positive_amount' },
            severity: 'error',
          },
          {
            name: 'volume_positive',
            description: 'Volume must be positive',
            field: 'volume',
            type: 'custom',
            parameters: { validator: 'positive_amount' },
            severity: 'error',
          },
          {
            name: 'change_percentage_valid',
            description: 'Change percentage must be valid',
            field: 'changePercent24h',
            type: 'range',
            parameters: { min: -100, max: 1000 },
            severity: 'warning',
          },
        ],
      },

      portfolioSchema: {
        name: 'Portfolio Data Schema',
        version: '1.0.0',
        description: 'Validation schema for portfolio data',
        rules: [
          {
            name: 'portfolio_name_required',
            description: 'Portfolio name is required',
            field: 'name',
            type: 'required',
            parameters: {},
            severity: 'error',
          },
          {
            name: 'total_value_positive',
            description: 'Total value must be positive',
            field: 'totalValue',
            type: 'custom',
            parameters: { validator: 'positive_amount' },
            severity: 'error',
          },
          {
            name: 'positions_required',
            description: 'Portfolio must have positions',
            field: 'positions',
            type: 'required',
            parameters: {},
            severity: 'warning',
          },
          {
            name: 'positions_not_empty',
            description: 'Portfolio must have at least one position',
            field: 'positions',
            type: 'range',
            parameters: { minLength: 1 },
            severity: 'warning',
          },
        ],
      },
    };
  }

  // Register custom validator
  registerCustomValidator(name: string, validator: (value: any, parameters: any, record: any) => boolean): void {
    this.customValidators.set(name, validator);
    this.logger.info(`Registered custom validator: ${name}`);
  }

  // Get available custom validators
  getCustomValidators(): string[] {
    return Array.from(this.customValidators.keys());
  }
}