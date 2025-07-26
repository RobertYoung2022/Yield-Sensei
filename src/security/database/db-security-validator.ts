/**
 * Database Security Validator
 * 
 * Comprehensive database security testing including:
 * - Connection security
 * - SQL injection prevention
 * - Access control validation
 * - Encryption at rest/transit
 * - Query monitoring
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface DbTestResult {
  testName: string;
  category: 'connection' | 'injection' | 'access' | 'encryption' | 'monitoring';
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  error?: string;
  details?: Record<string, any>;
  recommendations: string[];
}

export interface DbValidationSummary {
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

export class DatabaseSecurityValidator {
  private results: DbTestResult[] = [];
  private dbConfig: any;


  constructor(private projectRoot: string = process.cwd()) {
    this.loadDatabaseConfig();
  }

  /**
   * Run comprehensive database security validation
   */
  async validateAll(): Promise<DbValidationSummary> {
    this.results = [];

    console.log('🗄️  Starting database security validation...\n');

    // Core database security tests
    await this.testConnectionSecurity();
    await this.testSqlInjectionPrevention();
    await this.testAccessControls();
    await this.testEncryption();
    await this.testQueryMonitoring();
    await this.testDatabaseConfiguration();
    await this.testBackupSecurity();

    return this.generateSummary();
  }

  /**
   * Test database connection security
   */
  private async testConnectionSecurity(): Promise<void> {
    console.log('🔐 Testing connection security...');

    const issues: string[] = [];
    let connectionAttempts = 0;

    try {
      // Test SSL/TLS enforcement
      if (!this.dbConfig.ssl && process.env['NODE_ENV'] === 'production') {
        issues.push('SSL not enforced in production');
      }

      // Test connection string security
      const connectionString = this.dbConfig.connectionString || process.env['DATABASE_URL'];
      if (connectionString && connectionString.includes('sslmode=disable')) {
        issues.push('SSL explicitly disabled in connection string');
      }

      // Test connection timeout
      if (!this.dbConfig.connectionTimeoutMillis || this.dbConfig.connectionTimeoutMillis > 30000) {
        issues.push('Connection timeout too high or not set');
      }

      // Test for connection pooling
      if (!this.dbConfig.max || this.dbConfig.max > 100) {
        issues.push('Connection pool size not configured or too high');
      }

      // Attempt connection test
      if (this.dbConfig.host && this.dbConfig.port) {
        connectionAttempts++;
      }

    } catch (error) {
      issues.push(`Connection test failed: ${error}`);
    }

    this.results.push({
      testName: 'Database connection security',
      category: 'connection',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'high' : 'low',
      details: { 
        issues, 
        connectionAttempts,
        sslConfigured: !!this.dbConfig.ssl 
      },
      recommendations: issues.length > 0 ? [
        'Enable SSL/TLS for all database connections',
        'Configure appropriate connection timeouts',
        'Implement proper connection pooling',
        'Use secure connection strings'
      ] : ['Database connection security looks good']
    });
  }

  /**
   * Test SQL injection prevention
   */
  private async testSqlInjectionPrevention(): Promise<void> {
    console.log('💉 Testing SQL injection prevention...');

    const vulnerablePatterns: string[] = [];
    const sourceFiles = this.getSourceFiles();

    // Scan source code for vulnerable query patterns
    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        // Look for string concatenation in SQL queries
        const concatPatterns = [
          /\.query\s*\(\s*['"`][^'"`]*\+/g,
          /\.query\s*\(\s*`[^`]*\$\{/g,
          /SELECT.*\+.*FROM/gi,
          /INSERT.*\+.*VALUES/gi,
          /UPDATE.*SET.*\+/gi,
          /DELETE.*WHERE.*\+/gi
        ];

        for (const pattern of concatPatterns) {
          if (pattern.test(content)) {
            vulnerablePatterns.push(`Potential SQL injection in ${file}`);
            break;
          }
        }

        // Look for direct user input in queries
        if (content.includes('req.params') || content.includes('req.query')) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line && line.includes('query(') && 
                (line.includes('req.params') || line.includes('req.query'))) {
              vulnerablePatterns.push(`Direct user input in query at ${file}:${i + 1}`);
            }
          }
        }

      } catch (error) {
        continue;
      }
    }

    // Test parameterized query usage
    let parameterizedQueryCount = 0;
    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        // Count parameterized queries ($1, $2, etc.)
        const matches = content.match(/\$\d+/g);
        if (matches) {
          parameterizedQueryCount += matches.length;
        }
      } catch (error) {
        continue;
      }
    }

    this.results.push({
      testName: 'SQL injection prevention',
      category: 'injection',
      passed: vulnerablePatterns.length === 0,
      severity: vulnerablePatterns.length > 0 ? 'critical' : 'low',
      details: {
        vulnerablePatterns: vulnerablePatterns.slice(0, 10),
        parameterizedQueries: parameterizedQueryCount,
        filesScanned: sourceFiles.length
      },
      recommendations: vulnerablePatterns.length > 0 ? [
        'Use parameterized queries exclusively',
        'Validate and sanitize all user inputs',
        'Implement query whitelisting',
        'Use ORM with built-in protection'
      ] : ['SQL injection prevention looks good']
    });
  }

  /**
   * Test database access controls
   */
  private async testAccessControls(): Promise<void> {
    console.log('🔒 Testing access controls...');

    const accessIssues: string[] = [];

    try {
      // Check for overprivileged database users
      const dbUser = this.dbConfig.user || process.env['DB_USER'] || process.env['DATABASE_USER'];
      if (dbUser === 'root' || dbUser === 'postgres' || dbUser === 'admin') {
        accessIssues.push('Using privileged database user account');
      }

      // Check for default passwords
      const dbPassword = this.dbConfig.password || process.env['DB_PASSWORD'] || process.env['DATABASE_PASSWORD'];
      if (dbPassword && ['password', 'admin', 'postgres', '123456'].includes(dbPassword.toLowerCase())) {
        accessIssues.push('Using default or weak database password');
      }

      // Check for role-based access control implementation
      const hasRBAC = this.checkRBACImplementation();
      if (!hasRBAC) {
        accessIssues.push('No role-based access control detected');
      }

      // Check for audit logging
      const hasAuditLog = this.checkAuditLogging();
      if (!hasAuditLog) {
        accessIssues.push('Database audit logging not implemented');
      }

    } catch (error) {
      accessIssues.push(`Access control validation failed: ${error}`);
    }

    this.results.push({
      testName: 'Database access controls',
      category: 'access',
      passed: accessIssues.length === 0,
      severity: accessIssues.length > 2 ? 'critical' : accessIssues.length > 0 ? 'high' : 'low',
      details: { accessIssues },
      recommendations: accessIssues.length > 0 ? [
        'Use least-privilege database accounts',
        'Implement role-based access control',
        'Enable database audit logging',
        'Use strong, unique passwords'
      ] : ['Database access controls look secure']
    });
  }

  /**
   * Test database encryption
   */
  private async testEncryption(): Promise<void> {
    console.log('🔐 Testing database encryption...');

    const encryptionIssues: string[] = [];

    try {
      // Check SSL/TLS configuration
      if (!this.dbConfig.ssl) {
        encryptionIssues.push('Database SSL/TLS not configured');
      }

      // Check for encryption at rest configuration
      const hasEncryptionAtRest = this.checkEncryptionAtRest();
      if (!hasEncryptionAtRest) {
        encryptionIssues.push('Encryption at rest not detected');
      }

      // Check for sensitive data encryption in columns
      const hasSensitiveDataEncryption = this.checkSensitiveDataEncryption();
      if (!hasSensitiveDataEncryption) {
        encryptionIssues.push('Sensitive data column encryption not implemented');
      }

      // Check backup encryption
      const hasBackupEncryption = this.checkBackupEncryption();
      if (!hasBackupEncryption) {
        encryptionIssues.push('Database backup encryption not configured');
      }

    } catch (error) {
      encryptionIssues.push(`Encryption validation failed: ${error}`);
    }

    this.results.push({
      testName: 'Database encryption',
      category: 'encryption',
      passed: encryptionIssues.length === 0,
      severity: encryptionIssues.length > 2 ? 'high' : encryptionIssues.length > 0 ? 'medium' : 'low',
      details: { encryptionIssues },
      recommendations: encryptionIssues.length > 0 ? [
        'Enable SSL/TLS for database connections',
        'Implement encryption at rest',
        'Encrypt sensitive data columns',
        'Enable backup encryption'
      ] : ['Database encryption configuration looks good']
    });
  }

  /**
   * Test query monitoring and logging
   */
  private async testQueryMonitoring(): Promise<void> {
    console.log('📊 Testing query monitoring...');

    const monitoringIssues: string[] = [];

    try {
      // Check for query logging implementation
      const hasQueryLogging = this.checkQueryLogging();
      if (!hasQueryLogging) {
        monitoringIssues.push('Query logging not implemented');
      }

      // Check for slow query monitoring
      const hasSlowQueryMonitoring = this.checkSlowQueryMonitoring();
      if (!hasSlowQueryMonitoring) {
        monitoringIssues.push('Slow query monitoring not detected');
      }

      // Check for suspicious query detection
      const hasSuspiciousQueryDetection = this.checkSuspiciousQueryDetection();
      if (!hasSuspiciousQueryDetection) {
        monitoringIssues.push('Suspicious query detection not implemented');
      }

      // Check for connection monitoring
      const hasConnectionMonitoring = this.checkConnectionMonitoring();
      if (!hasConnectionMonitoring) {
        monitoringIssues.push('Database connection monitoring not detected');
      }

    } catch (error) {
      monitoringIssues.push(`Query monitoring validation failed: ${error}`);
    }

    this.results.push({
      testName: 'Database query monitoring',
      category: 'monitoring',
      passed: monitoringIssues.length === 0,
      severity: monitoringIssues.length > 2 ? 'medium' : 'low',
      details: { monitoringIssues },
      recommendations: monitoringIssues.length > 0 ? [
        'Implement comprehensive query logging',
        'Set up slow query monitoring',
        'Add suspicious query detection',
        'Monitor database connections'
      ] : ['Database monitoring looks comprehensive']
    });
  }

  /**
   * Test database configuration security
   */
  private async testDatabaseConfiguration(): Promise<void> {
    console.log('⚙️ Testing database configuration...');

    const configIssues: string[] = [];

    try {
      // Check for secure configuration defaults
      if (this.dbConfig.port === 5432 || this.dbConfig.port === 3306) {
        configIssues.push('Using default database port');
      }

      // Check for connection limits
      if (!this.dbConfig.max || this.dbConfig.max > 200) {
        configIssues.push('Connection pool not properly limited');
      }

      // Check for query timeout
      if (!this.dbConfig.statement_timeout && !this.dbConfig.query_timeout) {
        configIssues.push('Query timeout not configured');
      }

      // Check for idle connection timeout
      if (!this.dbConfig.idleTimeoutMillis || this.dbConfig.idleTimeoutMillis > 300000) {
        configIssues.push('Idle connection timeout too high or not set');
      }

    } catch (error) {
      configIssues.push(`Configuration validation failed: ${error}`);
    }

    this.results.push({
      testName: 'Database configuration security',
      category: 'connection',
      passed: configIssues.length === 0,
      severity: configIssues.length > 2 ? 'medium' : 'low',
      details: { configIssues },
      recommendations: configIssues.length > 0 ? [
        'Use non-default database ports',
        'Configure appropriate connection limits',
        'Set query and idle timeouts',
        'Review all security configurations'
      ] : ['Database configuration looks secure']
    });
  }

  /**
   * Test backup security
   */
  private async testBackupSecurity(): Promise<void> {
    console.log('💾 Testing backup security...');

    const backupIssues: string[] = [];

    try {
      // Check for backup configuration
      const hasBackupConfig = this.checkBackupConfiguration();
      if (!hasBackupConfig) {
        backupIssues.push('Backup configuration not detected');
      }

      // Check for backup encryption
      const hasBackupEncryption = this.checkBackupEncryption();
      if (!hasBackupEncryption) {
        backupIssues.push('Backup encryption not configured');
      }

      // Check for backup access controls
      const hasBackupAccessControls = this.checkBackupAccessControls();
      if (!hasBackupAccessControls) {
        backupIssues.push('Backup access controls not implemented');
      }

    } catch (error) {
      backupIssues.push(`Backup security validation failed: ${error}`);
    }

    this.results.push({
      testName: 'Database backup security',
      category: 'encryption',
      passed: backupIssues.length === 0,
      severity: backupIssues.length > 1 ? 'medium' : 'low',
      details: { backupIssues },
      recommendations: backupIssues.length > 0 ? [
        'Configure automated secure backups',
        'Enable backup encryption',
        'Implement backup access controls',
        'Test backup restoration procedures'
      ] : ['Database backup security looks good']
    });
  }

  // Helper methods
  private loadDatabaseConfig(): void {
    this.dbConfig = {};
    
    // Load from environment variables
    this.dbConfig.host = process.env['DB_HOST'] || process.env['DATABASE_HOST'];
    this.dbConfig.port = parseInt(process.env['DB_PORT'] || process.env['DATABASE_PORT'] || '5432');
    this.dbConfig.database = process.env['DB_NAME'] || process.env['DATABASE_NAME'];
    this.dbConfig.user = process.env['DB_USER'] || process.env['DATABASE_USER'];
    this.dbConfig.password = process.env['DB_PASSWORD'] || process.env['DATABASE_PASSWORD'];
    this.dbConfig.ssl = process.env['DB_SSL'] === 'true' || process.env['DATABASE_SSL'] === 'true';
    this.dbConfig.connectionString = process.env['DATABASE_URL'];

    // Try to load from config files
    const configPaths = [
      join(this.projectRoot, 'knexfile.js'),
      join(this.projectRoot, 'config', 'database.js'),
      join(this.projectRoot, 'src', 'config', 'database.ts')
    ];

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf8');
          // Extract connection configuration (basic parsing)
          if (content.includes('ssl:') && content.includes('true')) {
            this.dbConfig.ssl = true;
          }
          if (content.includes('max:')) {
            const match = content.match(/max:\s*(\d+)/);
            if (match && match[1]) {
              this.dbConfig.max = parseInt(match[1]);
            }
          }
        } catch (error) {
          // Continue with next config file
        }
      }
    }
  }

  private getSourceFiles(): string[] {
    const files: string[] = [];
    const dirs = ['src', 'lib', 'models', 'database', 'db'];
    const extensions = ['.js', '.ts'];

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
      const fs = require('fs');
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item === 'node_modules') continue;
        
        const fullPath = join(dir, item);
        const stat = fs.statSync(fullPath);
        
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

  private checkRBACImplementation(): boolean {
    const files = this.getSourceFiles();
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        if (content.includes('role') && content.includes('permission')) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  private checkAuditLogging(): boolean {
    const files = this.getSourceFiles();
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        if (content.includes('audit') || content.includes('log')) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  private checkEncryptionAtRest(): boolean {
    return !!(process.env['DB_ENCRYPTION_KEY'] || process.env['DATABASE_ENCRYPTION_KEY']);
  }

  private checkSensitiveDataEncryption(): boolean {
    const files = this.getSourceFiles();
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        if (content.includes('encrypt') && content.includes('decrypt')) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  private checkBackupEncryption(): boolean {
    return !!(process.env['BACKUP_ENCRYPTION_KEY'] || process.env['DB_BACKUP_ENCRYPTION']);
  }

  private checkQueryLogging(): boolean {
    return !!(this.dbConfig.log || process.env['DB_LOG_QUERIES']);
  }

  private checkSlowQueryMonitoring(): boolean {
    return !!(this.dbConfig.slowQueryThreshold || process.env['DB_SLOW_QUERY_THRESHOLD']);
  }

  private checkSuspiciousQueryDetection(): boolean {
    const files = this.getSourceFiles();
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        if (content.includes('suspicious') || content.includes('anomaly')) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
  }

  private checkConnectionMonitoring(): boolean {
    return !!(this.dbConfig.connectionMonitoring || process.env['DB_CONNECTION_MONITORING']);
  }

  private checkBackupConfiguration(): boolean {
    return !!(process.env['DB_BACKUP_ENABLED'] || process.env['BACKUP_SCHEDULE']);
  }

  private checkBackupAccessControls(): boolean {
    return !!(process.env['BACKUP_ACCESS_KEY'] || process.env['BACKUP_ROLE']);
  }

  /**
   * Generate validation summary
   */
  private generateSummary(): DbValidationSummary {
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
  getResults(): DbTestResult[] {
    return [...this.results];
  }

  /**
   * Generate detailed report
   */
  generateReport(): string {
    const summary = this.generateSummary();
    
    let report = '# Database Security Report\n\n';
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