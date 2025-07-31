/**
 * Data Anonymizer
 * Advanced data anonymization and privacy utilities for test data
 */

import crypto from 'crypto';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface AnonymizationConfig {
  strategy: 'mask' | 'hash' | 'fake' | 'shuffle' | 'nullify' | 'range' | 'custom';
  preserveFormat?: boolean;
  preserveLength?: boolean;
  preserveType?: boolean;
  customFunction?: (value: any) => any;
  parameters?: Record<string, any>;
}

export interface FieldConfig {
  fieldPath: string; // Dot notation path to field (e.g., 'user.email', 'transactions[].amount')
  config: AnonymizationConfig;
  condition?: (record: any) => boolean; // Optional condition for when to apply
}

export interface AnonymizationRule {
  name: string;
  description: string;
  fields: FieldConfig[];
  preserveRelationships?: boolean;
  consistencyGroups?: string[][]; // Fields that should maintain consistency
}

export interface AnonymizationResult {
  originalRecordCount: number;
  anonymizedRecordCount: number;
  fieldsProcessed: string[];
  preservedRelationships: string[];
  processingTime: number;
  warnings: string[];
  statistics: {
    maskedFields: number;
    hashedFields: number;
    fakedFields: number;
    nullifiedFields: number;
    shuffledFields: number;
    customProcessed: number;
  };
}

export class DataAnonymizer {
  private logger: Logger;
  private consistencyCache: Map<string, Map<string, any>> = new Map();
  private fakeDataProviders: Map<string, any> = new Map();

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/data-anonymizer.log' })
      ],
    });

    this.initializeFakeDataProviders();
  }

  async anonymizeData(data: any[], rule: AnonymizationRule): Promise<{
    data: any[];
    result: AnonymizationResult;
  }> {
    const startTime = Date.now();
    this.logger.info(`Starting anonymization with rule: ${rule.name}`);

    const result: AnonymizationResult = {
      originalRecordCount: data.length,
      anonymizedRecordCount: 0,
      fieldsProcessed: [],
      preservedRelationships: [],
      processingTime: 0,
      warnings: [],
      statistics: {
        maskedFields: 0,
        hashedFields: 0,
        fakedFields: 0,
        nullifiedFields: 0,
        shuffledFields: 0,
        customProcessed: 0,
      },
    };

    // Reset consistency cache for this anonymization run
    this.consistencyCache.clear();

    // Setup consistency groups
    if (rule.consistencyGroups) {
      for (const group of rule.consistencyGroups) {
        const groupKey = group.join('|');
        this.consistencyCache.set(groupKey, new Map());
      }
    }

    // Process data
    const anonymizedData = [];
    
    for (const record of data) {
      try {
        const anonymizedRecord = await this.anonymizeRecord(record, rule, result);
        anonymizedData.push(anonymizedRecord);
        result.anonymizedRecordCount++;
      } catch (error) {
        result.warnings.push(`Failed to anonymize record: ${(error as Error).message}`);
        this.logger.warn(`Record anonymization failed:`, error);
      }
    }

    // Handle field shuffling (needs to be done across all records)
    for (const fieldConfig of rule.fields) {
      if (fieldConfig.config.strategy === 'shuffle') {
        this.shuffleFieldAcrossRecords(anonymizedData, fieldConfig.fieldPath);
        result.statistics.shuffledFields++;
      }
    }

    result.processingTime = Date.now() - startTime;
    result.fieldsProcessed = Array.from(new Set(rule.fields.map(f => f.fieldPath)));

    this.logger.info(`Anonymization completed in ${result.processingTime}ms`);
    return { data: anonymizedData, result };
  }

  private async anonymizeRecord(
    record: any,
    rule: AnonymizationRule,
    result: AnonymizationResult
  ): Promise<any> {
    const anonymized = JSON.parse(JSON.stringify(record)); // Deep clone

    for (const fieldConfig of rule.fields) {
      // Check condition if present
      if (fieldConfig.condition && !fieldConfig.condition(record)) {
        continue;
      }

      try {
        const fieldValue = this.getNestedValue(anonymized, fieldConfig.fieldPath);
        
        if (fieldValue !== undefined && fieldValue !== null) {
          const anonymizedValue = await this.anonymizeField(
            fieldValue,
            fieldConfig,
            record,
            result
          );
          
          this.setNestedValue(anonymized, fieldConfig.fieldPath, anonymizedValue);
          this.updateStatistics(fieldConfig.config.strategy, result);
        }
      } catch (error) {
        result.warnings.push(
          `Failed to anonymize field ${fieldConfig.fieldPath}: ${(error as Error).message}`
        );
      }
    }

    return anonymized;
  }

  private async anonymizeField(
    value: any,
    fieldConfig: FieldConfig,
    originalRecord: any,
    result: AnonymizationResult
  ): Promise<any> {
    const config = fieldConfig.config;
    const consistencyKey = this.getConsistencyKey(fieldConfig.fieldPath, originalRecord);

    // Check consistency cache first
    if (consistencyKey && this.consistencyCache.has(consistencyKey)) {
      const cached = this.consistencyCache.get(consistencyKey)!.get(value);
      if (cached !== undefined) {
        return cached;
      }
    }

    let anonymizedValue: any;

    switch (config.strategy) {
      case 'mask':
        anonymizedValue = this.maskValue(value, config);
        break;
      case 'hash':
        anonymizedValue = this.hashValue(value, config);
        break;
      case 'fake':
        anonymizedValue = await this.generateFakeValue(value, fieldConfig.fieldPath, config);
        break;
      case 'nullify':
        anonymizedValue = null;
        break;
      case 'range':
        anonymizedValue = this.generateRangeValue(value, config);
        break;
      case 'custom':
        if (config.customFunction) {
          anonymizedValue = config.customFunction(value);
        } else {
          throw new Error('Custom function not provided');
        }
        break;
      case 'shuffle':
        // Shuffling is handled at the dataset level
        anonymizedValue = value;
        break;
      default:
        throw new Error(`Unknown anonymization strategy: ${config.strategy}`);
    }

    // Cache for consistency
    if (consistencyKey && this.consistencyCache.has(consistencyKey)) {
      this.consistencyCache.get(consistencyKey)!.set(value, anonymizedValue);
    }

    return anonymizedValue;
  }

  private maskValue(value: any, config: AnonymizationConfig): any {
    if (typeof value !== 'string') {
      value = String(value);
    }

    const maskChar = config.parameters?.maskChar || '*';
    const preserveFormat = config.preserveFormat ?? true;
    const preserveLength = config.preserveLength ?? true;

    if (preserveFormat) {
      // Preserve format (e.g., email, phone, credit card patterns)
      if (this.isEmail(value)) {
        return this.maskEmail(value, maskChar);
      } else if (this.isPhoneNumber(value)) {
        return this.maskPhoneNumber(value, maskChar);
      } else if (this.isCreditCard(value)) {
        return this.maskCreditCard(value, maskChar);
      } else if (this.isSSN(value)) {
        return this.maskSSN(value, maskChar);
      }
    }

    if (preserveLength) {
      return maskChar.repeat(value.length);
    }

    const visibleChars = Math.min(2, Math.floor(value.length * 0.2));
    const maskedLength = value.length - visibleChars;
    
    return value.substring(0, visibleChars) + maskChar.repeat(maskedLength);
  }

  private hashValue(value: any, config: AnonymizationConfig): string {
    const algorithm = config.parameters?.algorithm || 'sha256';
    const salt = config.parameters?.salt || 'default-salt';
    const truncate = config.parameters?.truncate;

    const hash = crypto.createHmac(algorithm, salt)
      .update(String(value))
      .digest('hex');

    return truncate ? hash.substring(0, truncate) : hash;
  }

  private async generateFakeValue(value: any, fieldPath: string, config: AnonymizationConfig): Promise<any> {
    const fieldType = this.inferFieldType(fieldPath, value);
    const provider = this.fakeDataProviders.get(fieldType);

    if (provider) {
      return provider.generate(config.parameters);
    }

    // Fallback based on field type
    switch (fieldType) {
      case 'email':
        return this.generateFakeEmail();
      case 'name':
        return this.generateFakeName();
      case 'phone':
        return this.generateFakePhone();
      case 'address':
        return this.generateFakeAddress();
      case 'date':
        return this.generateFakeDate(config.parameters);
      case 'number':
        return this.generateFakeNumber(config.parameters);
      case 'boolean':
        return Math.random() > 0.5;
      case 'uuid':
        return crypto.randomUUID();
      default:
        return this.generateFakeString(config.parameters);
    }
  }

  private generateRangeValue(value: any, config: AnonymizationConfig): any {
    if (typeof value === 'number') {
      const variance = config.parameters?.variance || 0.1; // 10% variance
      const minValue = value * (1 - variance);
      const maxValue = value * (1 + variance);
      return Number((Math.random() * (maxValue - minValue) + minValue).toFixed(2));
    }

    if (value instanceof Date) {
      const varianceDays = config.parameters?.varianceDays || 30;
      const minTime = value.getTime() - (varianceDays * 24 * 60 * 60 * 1000);
      const maxTime = value.getTime() + (varianceDays * 24 * 60 * 60 * 1000);
      return new Date(Math.random() * (maxTime - minTime) + minTime);
    }

    return value; // Return original if type not supported
  }

  private shuffleFieldAcrossRecords(data: any[], fieldPath: string): void {
    // Extract all values for the field
    const values = data.map(record => this.getNestedValue(record, fieldPath))
      .filter(val => val !== undefined && val !== null);

    // Shuffle the values
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    // Assign shuffled values back
    let valueIndex = 0;
    for (const record of data) {
      const currentValue = this.getNestedValue(record, fieldPath);
      if (currentValue !== undefined && currentValue !== null) {
        this.setNestedValue(record, fieldPath, values[valueIndex]);
        valueIndex++;
      }
    }
  }

  private getConsistencyKey(fieldPath: string, record: any): string | null {
    // Find if this field is part of any consistency group
    for (const [groupKey, _] of this.consistencyCache) {
      const fields = groupKey.split('|');
      if (fields.includes(fieldPath)) {
        return groupKey;
      }
    }
    return null;
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        // Handle array notation like 'items[0]' or 'items[]'
        const [arrayKey, indexPart] = key.split('[');
        const index = indexPart.replace(']', '');
        
        current = current[arrayKey];
        if (!Array.isArray(current)) return undefined;
        
        if (index === '') {
          // Return the array itself for processing
          return current;
        } else {
          current = current[parseInt(index)];
        }
      } else {
        current = current[key];
      }

      if (current === undefined || current === null) {
        return undefined;
      }
    }

    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i] || '';
      
      if (key.includes('[') && key.includes(']')) {
        const [arrayKey, indexPart] = key.split('[');
        const index = indexPart.replace(']', '');
        
        if (!current[arrayKey]) current[arrayKey] = [];
        if (index !== '') {
          const idx = parseInt(index);
          if (!current[arrayKey][idx]) current[arrayKey][idx] = {};
          current = current[arrayKey][idx];
        } else {
          current = current[arrayKey];
        }
      } else {
        if (!current[key]) current[key] = {};
        current = current[key];
      }
    }

    const lastKey = keys[keys.length - 1] || '';
    if (lastKey.includes('[') && lastKey.includes(']')) {
      const [arrayKey, indexPart] = lastKey.split('[');
      const index = indexPart.replace(']', '');
      
      if (!current[arrayKey]) current[arrayKey] = [];
      if (index !== '') {
        current[arrayKey][parseInt(index)] = value;
      }
    } else {
      current[lastKey] = value;
    }
  }

  private inferFieldType(fieldPath: string, value: any): string {
    const lowerPath = fieldPath.toLowerCase();
    
    if (lowerPath.includes('email')) return 'email';
    if (lowerPath.includes('name')) return 'name';
    if (lowerPath.includes('phone') || lowerPath.includes('mobile')) return 'phone';
    if (lowerPath.includes('address')) return 'address';
    if (lowerPath.includes('date') || lowerPath.includes('time')) return 'date';
    if (lowerPath.includes('id') && typeof value === 'string' && value.includes('-')) return 'uuid';
    
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    
    return 'string';
  }

  private updateStatistics(strategy: string, result: AnonymizationResult): void {
    switch (strategy) {
      case 'mask':
        result.statistics.maskedFields++;
        break;
      case 'hash':
        result.statistics.hashedFields++;
        break;
      case 'fake':
        result.statistics.fakedFields++;
        break;
      case 'nullify':
        result.statistics.nullifiedFields++;
        break;
      case 'shuffle':
        result.statistics.shuffledFields++;
        break;
      case 'custom':
        result.statistics.customProcessed++;
        break;
    }
  }

  // Format detection helpers
  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private isPhoneNumber(value: string): boolean {
    return /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ''));
  }

  private isCreditCard(value: string): boolean {
    return /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(value);
  }

  private isSSN(value: string): boolean {
    return /^\d{3}-\d{2}-\d{4}$/.test(value);
  }

  // Format-specific masking
  private maskEmail(email: string, maskChar: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username[0] + maskChar.repeat(username.length - 2) + username[username.length - 1]
      : maskChar.repeat(username.length);
    return `${maskedUsername}@${domain}`;
  }

  private maskPhoneNumber(phone: string, maskChar: string): string {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const masked = cleanPhone.substring(0, 3) + maskChar.repeat(cleanPhone.length - 6) + cleanPhone.substring(cleanPhone.length - 3);
    return phone.replace(/\d/g, (match, index) => {
      const cleanIndex = phone.substring(0, index).replace(/[^\d]/g, '').length;
      return masked[cleanIndex] || match;
    });
  }

  private maskCreditCard(card: string, maskChar: string): string {
    const cleanCard = card.replace(/[\s\-]/g, '');
    const masked = maskChar.repeat(12) + cleanCard.substring(12);
    return card.replace(/\d/g, (match, index) => {
      const cleanIndex = card.substring(0, index).replace(/[^\d]/g, '').length;
      return masked[cleanIndex] || match;
    });
  }

  private maskSSN(ssn: string, maskChar: string): string {
    return `${maskChar.repeat(3)}-${maskChar.repeat(2)}-${ssn.substring(7)}`;
  }

  // Fake data generators
  private generateFakeEmail(): string {
    const domains = ['example.com', 'test.org', 'fake.net', 'demo.co'];
    const username = Math.random().toString(36).substring(2, 10);
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${username}@${domain}`;
  }

  private generateFakeName(): string {
    const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
  }

  private generateFakePhone(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `(${areaCode}) ${exchange}-${number}`;
  }

  private generateFakeAddress(): string {
    const streetNumbers = Math.floor(Math.random() * 9999) + 1;
    const streetNames = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'First St', 'Second Ave'];
    const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
    return `${streetNumbers} ${streetName}`;
  }

  private generateFakeDate(parameters?: any): Date {
    const start = parameters?.start ? new Date(parameters.start) : new Date('1990-01-01');
    const end = parameters?.end ? new Date(parameters.end) : new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  private generateFakeNumber(parameters?: any): number {
    const min = parameters?.min || 0;
    const max = parameters?.max || 1000;
    const decimals = parameters?.decimals || 0;
    const value = Math.random() * (max - min) + min;
    return decimals > 0 ? Number(value.toFixed(decimals)) : Math.floor(value);
  }

  private generateFakeString(parameters?: any): string {
    const length = parameters?.length || 10;
    const chars = parameters?.chars || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private initializeFakeDataProviders(): void {
    // Initialize custom fake data providers
    // These can be extended with more sophisticated providers
    this.fakeDataProviders.set('email', {
      generate: () => this.generateFakeEmail(),
    });
    
    this.fakeDataProviders.set('name', {
      generate: () => this.generateFakeName(),
    });
    
    this.fakeDataProviders.set('phone', {
      generate: () => this.generateFakePhone(),
    });
  }

  // Predefined anonymization rules
  static getPredefinedRules(): Record<string, AnonymizationRule> {
    return {
      gdprCompliant: {
        name: 'GDPR Compliant',
        description: 'Anonymization rule that complies with GDPR requirements',
        fields: [
          {
            fieldPath: 'email',
            config: { strategy: 'hash', preserveFormat: true },
          },
          {
            fieldPath: 'firstName',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'lastName',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'phoneNumber',
            config: { strategy: 'mask', preserveFormat: true },
          },
          {
            fieldPath: 'address',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'dateOfBirth',
            config: { strategy: 'range', parameters: { varianceDays: 365 } },
          },
        ],
        preserveRelationships: true,
        consistencyGroups: [['email', 'userId']],
      },

      financialData: {
        name: 'Financial Data Protection',
        description: 'Anonymization for financial and trading data',
        fields: [
          {
            fieldPath: 'accountNumber',
            config: { strategy: 'hash' },
          },
          {
            fieldPath: 'amount',
            config: { strategy: 'range', parameters: { variance: 0.15 } },
          },
          {
            fieldPath: 'balance',
            config: { strategy: 'range', parameters: { variance: 0.2 } },
          },
          {
            fieldPath: 'transactions[].amount',
            config: { strategy: 'range', parameters: { variance: 0.1 } },
          },
          {
            fieldPath: 'portfolio.totalValue',
            config: { strategy: 'range', parameters: { variance: 0.25 } },
          },
          {
            fieldPath: 'user.email',
            config: { strategy: 'hash' },
          },
        ],
        preserveRelationships: true,
      },

      testingOptimized: {
        name: 'Testing Optimized',
        description: 'Optimized for testing while maintaining data utility',
        fields: [
          {
            fieldPath: 'email',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'firstName',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'lastName',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'phoneNumber',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'ssn',
            config: { strategy: 'fake' },
          },
          {
            fieldPath: 'ipAddress',
            config: { strategy: 'shuffle' },
          },
        ],
        preserveRelationships: false,
      },
    };
  }
}