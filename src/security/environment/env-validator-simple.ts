/**
 * Simplified Environment Variable Security Validator
 * 
 * Core environment variable security testing with essential functionality
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface EnvTestResult {
  testName: string;
  category: 'secrets' | 'configuration' | 'validation';
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  error?: string;
  details?: Record<string, any>;
  recommendations: string[];
}

export interface EnvValidationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  recommendations: string[];
}

export class SimpleEnvironmentValidator {
  private results: EnvTestResult[] = [];
  private processEnv: Record<string, string | undefined>;

  // Common secret patterns to detect
  private readonly SECRET_PATTERNS: RegExp[] = [
    /(?:password|passwd|pwd)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:secret|key|token)\s*[:=]\s*['"]\w{8,}['"]/gi,
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"]\w+['"]/gi,
    /(?:jwt[_-]?secret|jwtsecret)\s*[:=]\s*['"]\w+['"]/gi,
  ];

  // Required environment variables for YieldSensei
  private readonly REQUIRED_ENV_VARS: string[] = [
    'NODE_ENV',
    'JWT_SECRET',
    'VAULT_ENCRYPTION_KEY'
  ];

  // Sensitive variable names
  private readonly SENSITIVE_VARS: string[] = [
    'PASSWORD', 'SECRET', 'KEY', 'TOKEN',
    'API_KEY', 'JWT_SECRET', 'VAULT_ENCRYPTION_KEY'
  ];

  constructor(private projectRoot: string = process.cwd()) {
    this.processEnv = { ...process.env };
  }

  /**
   * Run core environment variable security validation
   */
  async validateAll(): Promise<EnvValidationSummary> {
    this.results = [];

    console.log('🔍 Starting environment variable security validation...\n');

    // Core tests
    await this.testHardcodedSecrets();
    await this.testEnvFileSecrets();
    await this.testRequiredVariables();
    await this.testDefaultValues();
    await this.testNamingConventions();

    return this.generateSummary();
  }

  /**
   * Test for hardcoded secrets in source code
   */
  private async testHardcodedSecrets(): Promise<void> {
    console.log('🔐 Testing for hardcoded secrets...');

    const sourceFiles = this.getSourceFiles();
    let foundSecrets = 0;
    const affectedFiles: string[] = [];

    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        for (const pattern of this.SECRET_PATTERNS) {
          const matches = content.match(pattern);
          if (matches) {
            foundSecrets += matches.length;
            affectedFiles.push(file);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }

    this.results.push({
      testName: 'Hardcoded secrets scan',
      category: 'secrets',
      passed: foundSecrets === 0,
      severity: foundSecrets > 0 ? 'critical' : 'low',
      details: { 
        secretsFound: foundSecrets,
        affectedFiles: affectedFiles.slice(0, 5),
        filesScanned: sourceFiles.length
      },
      recommendations: foundSecrets > 0 ? [
        'Move secrets to environment variables',
        'Use secure secret management system',
        'Review and remove hardcoded credentials'
      ] : ['Continue using environment variables for secrets']
    });
  }

  /**
   * Test .env file security
   */
  private async testEnvFileSecrets(): Promise<void> {
    console.log('📄 Testing .env file security...');

    const envFiles = ['.env', '.env.local', '.env.development'];
    let totalIssues = 0;
    const fileIssues: Record<string, string[]> = {};

    for (const envFile of envFiles) {
      const filePath = join(this.projectRoot, envFile);
      
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          const issues: string[] = [];

          lines.forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const [key, value] = trimmed.split('=', 2);
              
              if (value && this.isWeakValue(value)) {
                issues.push(`Weak value for ${key}`);
                totalIssues++;
              }
            }
          });

          if (issues.length > 0) {
            fileIssues[envFile] = issues;
          }
        } catch (error) {
          continue;
        }
      }
    }

    this.results.push({
      testName: 'Environment file security',
      category: 'secrets',
      passed: totalIssues === 0,
      severity: totalIssues > 0 ? 'high' : 'low',
      details: { fileIssues, totalIssues },
      recommendations: totalIssues > 0 ? [
        'Use strong, unique values for all secrets',
        'Ensure .env files are in .gitignore',
        'Consider using a secret management system'
      ] : ['Environment files look secure']
    });
  }

  /**
   * Test required environment variables
   */
  private async testRequiredVariables(): Promise<void> {
    console.log('✅ Testing required variables...');

    const missing: string[] = [];
    const tooShort: string[] = [];

    for (const varName of this.REQUIRED_ENV_VARS) {
      const value = this.processEnv[varName];
      
      if (!value) {
        missing.push(varName);
      } else if (this.isSensitiveVariable(varName) && value.length < 8) {
        tooShort.push(varName);
      }
    }

    const hasProblem = missing.length > 0 || tooShort.length > 0;

    this.results.push({
      testName: 'Required environment variables',
      category: 'configuration',
      passed: !hasProblem,
      severity: missing.length > 0 ? 'critical' : tooShort.length > 0 ? 'high' : 'low',
      details: { missing, tooShort, totalRequired: this.REQUIRED_ENV_VARS.length },
      recommendations: hasProblem ? [
        'Set all required environment variables',
        'Ensure secret values are sufficiently long',
        'Use secure random values for secrets'
      ] : ['All required variables are properly set']
    });
  }

  /**
   * Test for default/weak values
   */
  private async testDefaultValues(): Promise<void> {
    console.log('🔒 Testing for default values...');

    const defaultValues = ['changeme', 'password', 'secret', 'test', 'demo', '123456'];
    const foundDefaults: string[] = [];

    for (const [key, value] of Object.entries(this.processEnv)) {
      if (value && defaultValues.some(def => 
        value.toLowerCase().includes(def.toLowerCase())
      )) {
        foundDefaults.push(key);
      }
    }

    this.results.push({
      testName: 'Default value detection',
      category: 'configuration',
      passed: foundDefaults.length === 0,
      severity: foundDefaults.length > 0 ? 'high' : 'low',
      details: { foundDefaults },
      recommendations: foundDefaults.length > 0 ? [
        'Replace default values with secure alternatives',
        'Generate strong random values for secrets',
        'Use environment-specific configurations'
      ] : ['No default values detected']
    });
  }

  /**
   * Test naming conventions
   */
  private async testNamingConventions(): Promise<void> {
    console.log('📝 Testing naming conventions...');

    const namingIssues: string[] = [];
    
    for (const key of Object.keys(this.processEnv)) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        namingIssues.push(key);
      }
    }

    this.results.push({
      testName: 'Variable naming conventions',
      category: 'validation',
      passed: namingIssues.length === 0,
      severity: 'low',
      details: { namingIssues: namingIssues.slice(0, 10) },
      recommendations: namingIssues.length > 0 ? [
        'Use UPPER_SNAKE_CASE for environment variables',
        'Follow consistent naming patterns',
        'Avoid conflicts with system variables'
      ] : ['Naming conventions look good']
    });
  }

  // Helper methods
  private getSourceFiles(): string[] {
    const files: string[] = [];
    const dirs = ['src', 'lib', 'config', 'scripts'];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];

    for (const dir of dirs) {
      const dirPath = join(this.projectRoot, dir);
      if (existsSync(dirPath)) {
        this.scanDirectory(dirPath, files, extensions);
      }
    }

    return files;
  }

  private scanDirectory(dir: string, files: string[], extensions: string[]): void {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        if (item === 'node_modules') continue;
        
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.scanDirectory(fullPath, files, extensions);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private isSensitiveVariable(name: string): boolean {
    const upperName = name.toUpperCase();
    return this.SENSITIVE_VARS.some(sensitive => 
      upperName.includes(sensitive)
    );
  }

  private isWeakValue(value: string): boolean {
    const weakValues = ['password', 'secret', 'changeme', '123456', 'admin', 'test'];
    return weakValues.some(weak => 
      value.toLowerCase().includes(weak)
    ) || value.length < 8;
  }

  /**
   * Generate validation summary
   */
  private generateSummary(): EnvValidationSummary {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = totalTests - passed;
    const successRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    const criticalIssues = this.results.filter(r => !r.passed && r.severity === 'critical').length;
    const highIssues = this.results.filter(r => !r.passed && r.severity === 'high').length;
    const mediumIssues = this.results.filter(r => !r.passed && r.severity === 'medium').length;
    const lowIssues = this.results.filter(r => !r.passed && r.severity === 'low').length;

    const recommendations = this.results
      .filter(r => !r.passed)
      .flatMap(r => r.recommendations)
      .filter((rec, index, arr) => arr.indexOf(rec) === index)
      .slice(0, 10);

    return {
      totalTests,
      passed,
      failed,
      successRate,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      recommendations
    };
  }

  /**
   * Get detailed test results
   */
  getResults(): EnvTestResult[] {
    return [...this.results];
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const summary = this.generateSummary();
    
    let report = '# Environment Variable Security Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Project:** ${this.projectRoot}\n\n`;
    
    report += '## Executive Summary\n\n';
    report += `- **Total Tests:** ${summary.totalTests}\n`;
    report += `- **Passed:** ${summary.passed}\n`;
    report += `- **Failed:** ${summary.failed}\n`;
    report += `- **Success Rate:** ${summary.successRate.toFixed(2)}%\n\n`;
    
    report += '### Issues by Severity\n\n';
    report += `- **Critical:** ${summary.criticalIssues}\n`;
    report += `- **High:** ${summary.highIssues}\n`;
    report += `- **Medium:** ${summary.mediumIssues}\n`;
    report += `- **Low:** ${summary.lowIssues}\n\n`;

    if (summary.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      summary.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '## Test Results\n\n';
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const severity = result.severity.toUpperCase();
      report += `${status} **${result.testName}** (${severity})\n`;
      
      if (result.error) {
        report += `   - Error: ${result.error}\n`;
      }
      
      if (result.details) {
        const details = Object.entries(result.details)
          .slice(0, 3)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : value}`)
          .join(', ');
        if (details) {
          report += `   - Details: ${details}\n`;
        }
      }

      if (result.recommendations.length > 0) {
        report += `   - Recommendations: ${result.recommendations[0]}\n`;
      }
      
      report += '\n';
    });
    
    return report;
  }
}