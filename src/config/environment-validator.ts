/**
 * Environment Configuration Validator
 * 
 * Validates environment variables and provides detailed error reporting
 * for missing or invalid configuration values.
 */

import { config } from './environment';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingVariables: string[];
  invalidVariables: string[];
}

export interface EnvironmentRequirement {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'secret';
  description: string;
  validation?: (value: string) => boolean;
  defaultValue?: string;
  environment?: 'development' | 'staging' | 'production' | 'all';
}

/**
 * Environment variable requirements definition
 */
export const ENVIRONMENT_REQUIREMENTS: EnvironmentRequirement[] = [
  // Critical Security Variables (Always Required)
  {
    name: 'JWT_SECRET',
    required: true,
    type: 'secret',
    description: 'JWT signing secret for authentication tokens',
    validation: (value) => value.length >= 32,
    environment: 'all'
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    type: 'secret',
    description: 'Encryption key for message bus and sensitive data',
    validation: (value) => value.length >= 32,
    environment: 'all'
  },

  // Database Configuration
  {
    name: 'POSTGRES_HOST',
    required: true,
    type: 'string',
    description: 'PostgreSQL database host',
    defaultValue: 'localhost',
    environment: 'all'
  },
  {
    name: 'POSTGRES_PORT',
    required: false,
    type: 'number',
    description: 'PostgreSQL database port',
    defaultValue: '5432',
    environment: 'all'
  },
  {
    name: 'POSTGRES_DB',
    required: true,
    type: 'string',
    description: 'PostgreSQL database name',
    defaultValue: 'yieldsensei',
    environment: 'all'
  },
  {
    name: 'POSTGRES_USER',
    required: true,
    type: 'string',
    description: 'PostgreSQL database user',
    defaultValue: 'yieldsensei_app',
    environment: 'all'
  },
  {
    name: 'POSTGRES_PASSWORD',
    required: true,
    type: 'secret',
    description: 'PostgreSQL database password',
    environment: 'all'
  },
  {
    name: 'POSTGRES_SSL',
    required: false,
    type: 'boolean',
    description: 'Enable SSL for PostgreSQL connections',
    defaultValue: 'false',
    environment: 'all'
  },

  // ClickHouse Configuration
  {
    name: 'CLICKHOUSE_HOST',
    required: true,
    type: 'string',
    description: 'ClickHouse database host',
    defaultValue: 'localhost',
    environment: 'all'
  },
  {
    name: 'CLICKHOUSE_PORT',
    required: false,
    type: 'number',
    description: 'ClickHouse database port',
    defaultValue: '8123',
    environment: 'all'
  },
  {
    name: 'CLICKHOUSE_DATABASE',
    required: true,
    type: 'string',
    description: 'ClickHouse database name',
    defaultValue: 'yieldsensei',
    environment: 'all'
  },
  {
    name: 'CLICKHOUSE_USER',
    required: true,
    type: 'string',
    description: 'ClickHouse database user',
    defaultValue: 'yieldsensei',
    environment: 'all'
  },
  {
    name: 'CLICKHOUSE_PASSWORD',
    required: true,
    type: 'secret',
    description: 'ClickHouse database password',
    environment: 'all'
  },

  // Redis Configuration
  {
    name: 'REDIS_HOST',
    required: true,
    type: 'string',
    description: 'Redis cache host',
    defaultValue: 'localhost',
    environment: 'all'
  },
  {
    name: 'REDIS_PORT',
    required: false,
    type: 'number',
    description: 'Redis cache port',
    defaultValue: '6379',
    environment: 'all'
  },
  {
    name: 'REDIS_PASSWORD',
    required: false,
    type: 'secret',
    description: 'Redis cache password',
    environment: 'all'
  },
  {
    name: 'REDIS_DB',
    required: false,
    type: 'number',
    description: 'Redis database number',
    defaultValue: '0',
    environment: 'all'
  },

  // Vector Database Configuration
  {
    name: 'VECTOR_DB_HOST',
    required: true,
    type: 'string',
    description: 'Vector database host',
    defaultValue: 'localhost',
    environment: 'all'
  },
  {
    name: 'VECTOR_DB_PORT',
    required: false,
    type: 'number',
    description: 'Vector database port',
    defaultValue: '6333',
    environment: 'all'
  },
  {
    name: 'VECTOR_DB_API_KEY',
    required: true,
    type: 'secret',
    description: 'Vector database API key',
    environment: 'all'
  },

  // Application Configuration
  {
    name: 'NODE_ENV',
    required: true,
    type: 'string',
    description: 'Node.js environment',
    defaultValue: 'development',
    validation: (value) => ['development', 'staging', 'production', 'test'].includes(value),
    environment: 'all'
  },
  {
    name: 'PORT',
    required: false,
    type: 'number',
    description: 'Application port',
    defaultValue: '3000',
    environment: 'all'
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    type: 'string',
    description: 'Logging level',
    defaultValue: 'info',
    validation: (value) => ['error', 'warn', 'info', 'debug', 'trace'].includes(value),
    environment: 'all'
  },

  // Performance Configuration
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    required: false,
    type: 'number',
    description: 'Rate limiting window in milliseconds',
    defaultValue: '60000',
    environment: 'all'
  },
  {
    name: 'RATE_LIMIT_MAX_REQUESTS',
    required: false,
    type: 'number',
    description: 'Maximum requests per rate limit window',
    defaultValue: '100',
    environment: 'all'
  },

  // Monitoring Configuration
  {
    name: 'PERFORMANCE_MONITORING_ENABLED',
    required: false,
    type: 'boolean',
    description: 'Enable performance monitoring',
    defaultValue: 'false',
    environment: 'all'
  },
  {
    name: 'METRICS_COLLECTION_INTERVAL',
    required: false,
    type: 'number',
    description: 'Metrics collection interval in milliseconds',
    defaultValue: '60000',
    environment: 'all'
  },

  // Optional API Keys (Development/Staging)
  {
    name: 'ANTHROPIC_API_KEY',
    required: false,
    type: 'secret',
    description: 'Anthropic API key for AI capabilities',
    environment: 'development'
  },
  {
    name: 'PERPLEXITY_API_KEY',
    required: false,
    type: 'secret',
    description: 'Perplexity API key for research capabilities',
    environment: 'development'
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    type: 'secret',
    description: 'OpenAI API key for AI capabilities',
    environment: 'development'
  },
  {
    name: 'GOOGLE_API_KEY',
    required: false,
    type: 'secret',
    description: 'Google API key for external services',
    environment: 'development'
  },

  // Blockchain Configuration (Optional)
  {
    name: 'ETHEREUM_RPC_URL',
    required: false,
    type: 'url',
    description: 'Ethereum RPC endpoint URL',
    environment: 'development'
  },
  {
    name: 'POLYGON_RPC_URL',
    required: false,
    type: 'url',
    description: 'Polygon RPC endpoint URL',
    environment: 'development'
  },
  {
    name: 'ARBITRUM_RPC_URL',
    required: false,
    type: 'url',
    description: 'Arbitrum RPC endpoint URL',
    environment: 'development'
  },
  {
    name: 'OPTIMISM_RPC_URL',
    required: false,
    type: 'url',
    description: 'Optimism RPC endpoint URL',
    environment: 'development'
  },

  // Development Configuration
  {
    name: 'DEBUG_MODE',
    required: false,
    type: 'boolean',
    description: 'Enable debug mode',
    defaultValue: 'false',
    environment: 'development'
  },
  {
    name: 'MOCK_EXTERNAL_APIS',
    required: false,
    type: 'boolean',
    description: 'Mock external API calls',
    defaultValue: 'false',
    environment: 'development'
  }
];

/**
 * Validates environment variables against requirements
 */
export function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    missingVariables: [],
    invalidVariables: []
  };

  const currentEnv = process.env['NODE_ENV'] || 'development';

  for (const requirement of ENVIRONMENT_REQUIREMENTS) {
    // Skip if not applicable to current environment
    if (requirement.environment && requirement.environment !== 'all' && requirement.environment !== currentEnv) {
      continue;
    }

    const value = process.env[requirement.name];
    const hasValue = value !== undefined && value !== '';

    // Check if required variable is missing
    if (requirement.required && !hasValue) {
      result.isValid = false;
      result.errors.push(`Missing required environment variable: ${requirement.name} - ${requirement.description}`);
      result.missingVariables.push(requirement.name);
      continue;
    }

    // If not required and no value, use default
    if (!hasValue && requirement.defaultValue) {
      continue; // Will use default value
    }

    // Validate value if present
    if (hasValue && requirement.validation) {
      try {
        if (!requirement.validation(value!)) {
          result.isValid = false;
          result.errors.push(`Invalid value for environment variable: ${requirement.name} - ${requirement.description}`);
          result.invalidVariables.push(requirement.name);
        }
      } catch (error) {
        result.isValid = false;
        result.errors.push(`Validation error for environment variable: ${requirement.name} - ${error}`);
        result.invalidVariables.push(requirement.name);
      }
    }

    // Type-specific validation
    if (hasValue) {
      const typeError = validateType(requirement.name, value!, requirement.type);
      if (typeError) {
        result.isValid = false;
        result.errors.push(typeError);
        result.invalidVariables.push(requirement.name);
      }
    }

    // Security warnings for development
    if (currentEnv === 'development' && requirement.type === 'secret' && hasValue) {
      if (value!.length < 32) {
        result.warnings.push(`Weak secret for ${requirement.name}: should be at least 32 characters`);
      }
    }
  }

  return result;
}

/**
 * Validates value type
 */
function validateType(name: string, value: string, type: string): string | null {
  switch (type) {
    case 'number':
      if (isNaN(Number(value))) {
        return `Environment variable ${name} must be a number, got: ${value}`;
      }
      break;
    case 'boolean':
      if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        return `Environment variable ${name} must be a boolean (true/false), got: ${value}`;
      }
      break;
    case 'url':
      try {
        new URL(value);
      } catch {
        return `Environment variable ${name} must be a valid URL, got: ${value}`;
      }
      break;
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `Environment variable ${name} must be a valid email, got: ${value}`;
      }
      break;
  }
  return null;
}

/**
 * Generates environment configuration report
 */
export function generateEnvironmentReport(): string {
  const validation = validateEnvironment();
  const currentEnv = process.env['NODE_ENV'] || 'development';
  
  let report = `# Environment Configuration Report\n\n`;
  report += `**Environment:** ${currentEnv}\n`;
  report += `**Validation Status:** ${validation.isValid ? '✅ Valid' : '❌ Invalid'}\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  if (validation.errors.length > 0) {
    report += `## ❌ Errors\n\n`;
    validation.errors.forEach(error => {
      report += `- ${error}\n`;
    });
    report += `\n`;
  }

  if (validation.warnings.length > 0) {
    report += `## ⚠️ Warnings\n\n`;
    validation.warnings.forEach(warning => {
      report += `- ${warning}\n`;
    });
    report += `\n`;
  }

  report += `## 📋 Environment Variables Summary\n\n`;
  report += `| Variable | Required | Type | Description | Status |\n`;
  report += `|----------|----------|------|-------------|--------|\n`;

  for (const requirement of ENVIRONMENT_REQUIREMENTS) {
    if (requirement.environment && requirement.environment !== 'all' && requirement.environment !== currentEnv) {
      continue;
    }

    const value = process.env[requirement.name];
    const hasValue = value !== undefined && value !== '';
    const status = requirement.required 
      ? (hasValue ? '✅ Set' : '❌ Missing')
      : (hasValue ? '✅ Set' : '⚪ Optional');

    report += `| ${requirement.name} | ${requirement.required ? 'Yes' : 'No'} | ${requirement.type} | ${requirement.description} | ${status} |\n`;
  }

  return report;
}

/**
 * Validates and throws error if environment is invalid
 */
export function validateEnvironmentOrThrow(): void {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    console.error('❌ Environment validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    throw new Error(`Environment validation failed with ${validation.errors.length} errors`);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  console.log('✅ Environment validation passed');
} 