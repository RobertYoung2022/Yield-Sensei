/**
 * Simplified Database Security Validator
 * 
 * Core database security testing with essential functionality
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
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

export class SimpleDatabaseSecurityValidator {
  private results: DbTestResult[] = [];
  private processEnv: Record<string, string | undefined>;

  // Common SQL injection patterns to detect
  private readonly SECRET_PATTERNS: RegExp[] = [
    /\.query\s*\(\s*['"`][^'"`]*\+/g,
    /\.query\s*\(\s*`[^`]*\$\{/g,
    /SELECT.*\+.*FROM/gi,
    /INSERT.*\+.*VALUES/gi,
    /UPDATE.*SET.*\+/gi,
    /DELETE.*WHERE.*\+/gi
  ];

  // Required database environment variables
  private readonly REQUIRED_DB_VARS: string[] = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  // Sensitive database users that should be avoided
  private readonly PRIVILEGED_USERS: string[] = [
    'root', 'postgres', 'admin', 'sa', 'mysql'
  ];

  constructor(private projectRoot: string = process.cwd()) {
    this.processEnv = { ...process.env };
  }

  /**
   * Run core database security validation
   */
  async validateAll(): Promise<DbValidationSummary> {
    this.results = [];

    console.log('🗄️  Starting database security validation...\n');

    // Core database security tests
    await this.testConnectionSecurity();
    await this.testSqlInjectionPrevention();
    await this.testAccessControls();
    await this.testEncryptionConfiguration();
    await this.testDatabaseConfiguration();

    return this.generateSummary();
  }

  /**
   * Test database connection security
   */
  private async testConnectionSecurity(): Promise<void> {
    console.log('🔐 Testing connection security...');

    const issues: string[] = [];
    const dbConfig = this.getDatabaseConfig();

    // Test SSL/TLS enforcement in production
    const nodeEnv = this.processEnv['NODE_ENV'];
    const sslEnabled = this.processEnv['DB_SSL'] === 'true' || 
                      this.processEnv['DATABASE_SSL'] === 'true';
    
    if (nodeEnv === 'production' && !sslEnabled) {
      issues.push('SSL not enforced in production environment');
    }

    // Test connection string security
    const connectionString = this.processEnv['DATABASE_URL'] || this.processEnv['DB_CONNECTION_STRING'];
    if (connectionString && connectionString.includes('sslmode=disable')) {
      issues.push('SSL explicitly disabled in connection string');
    }

    // Test for default ports
    const dbPort = this.processEnv['DB_PORT'] || this.processEnv['DATABASE_PORT'];
    if (dbPort === '5432' || dbPort === '3306' || dbPort === '1433') {
      issues.push('Using default database port');
    }

    // Test for missing connection configuration
    if (!dbConfig['host'] && !connectionString) {
      issues.push('Database connection not configured');
    }

    this.results.push({
      testName: 'Database connection security',
      category: 'connection',
      passed: issues.length === 0,
      severity: issues.length > 2 ? 'high' : issues.length > 0 ? 'medium' : 'low',
      details: { 
        issues, 
        sslEnabled,
        nodeEnv,
        portConfigured: !!dbPort
      },
      recommendations: issues.length > 0 ? [
        'Enable SSL/TLS for all database connections',
        'Use non-default database ports',
        'Configure secure connection strings',
        'Set appropriate connection timeouts'
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
    let parameterizedQueryCount = 0;

    // Scan source code for vulnerable query patterns
    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        
        // Look for SQL injection vulnerabilities
        for (const pattern of this.SECRET_PATTERNS) {
          if (pattern.test(content)) {
            vulnerablePatterns.push(`Potential SQL injection in ${file}`);
            break;
          }
        }

        // Count parameterized queries ($1, $2, etc.)
        const matches = content.match(/\$\d+/g);
        if (matches) {
          parameterizedQueryCount += matches.length;
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

    // Check for privileged database users
    const dbUser = this.processEnv['DB_USER'] || this.processEnv['DATABASE_USER'];
    if (dbUser && this.PRIVILEGED_USERS.includes(dbUser.toLowerCase())) {
      accessIssues.push(`Using privileged database user: ${dbUser}`);
    }

    // Check for weak passwords
    const dbPassword = this.processEnv['DB_PASSWORD'] || this.processEnv['DATABASE_PASSWORD'];
    if (dbPassword && this.isWeakPassword(dbPassword)) {
      accessIssues.push('Using weak database password');
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

    this.results.push({
      testName: 'Database access controls',
      category: 'access',
      passed: accessIssues.length === 0,
      severity: accessIssues.length > 2 ? 'critical' : accessIssues.length > 0 ? 'high' : 'low',
      details: { accessIssues, hasRBAC, hasAuditLog },
      recommendations: accessIssues.length > 0 ? [
        'Use least-privilege database accounts',
        'Implement role-based access control',
        'Enable database audit logging',
        'Use strong, unique passwords'
      ] : ['Database access controls look secure']
    });
  }

  /**
   * Test database encryption configuration
   */
  private async testEncryptionConfiguration(): Promise<void> {
    console.log('🔐 Testing encryption configuration...');

    const encryptionIssues: string[] = [];

    // Check SSL/TLS configuration
    const sslEnabled = this.processEnv['DB_SSL'] === 'true' || 
                      this.processEnv['DATABASE_SSL'] === 'true';
    if (!sslEnabled) {
      encryptionIssues.push('Database SSL/TLS not configured');
    }

    // Check for encryption at rest configuration
    const encryptionKey = this.processEnv['DB_ENCRYPTION_KEY'] || 
                         this.processEnv['DATABASE_ENCRYPTION_KEY'];
    if (!encryptionKey) {
      encryptionIssues.push('Encryption at rest not configured');
    }

    // Check for sensitive data encryption in application
    const hasSensitiveDataEncryption = this.checkSensitiveDataEncryption();
    if (!hasSensitiveDataEncryption) {
      encryptionIssues.push('Sensitive data encryption not implemented');
    }

    // Check backup encryption
    const backupEncryption = this.processEnv['BACKUP_ENCRYPTION_KEY'] || 
                            this.processEnv['DB_BACKUP_ENCRYPTION'];
    if (!backupEncryption) {
      encryptionIssues.push('Database backup encryption not configured');
    }

    this.results.push({
      testName: 'Database encryption',
      category: 'encryption',
      passed: encryptionIssues.length === 0,
      severity: encryptionIssues.length > 2 ? 'high' : encryptionIssues.length > 0 ? 'medium' : 'low',
      details: { 
        encryptionIssues, 
        sslEnabled, 
        hasEncryptionKey: !!encryptionKey,
        hasBackupEncryption: !!backupEncryption
      },
      recommendations: encryptionIssues.length > 0 ? [
        'Enable SSL/TLS for database connections',
        'Implement encryption at rest',
        'Encrypt sensitive data columns',
        'Enable backup encryption'
      ] : ['Database encryption configuration looks good']
    });
  }

  /**
   * Test database configuration security
   */
  private async testDatabaseConfiguration(): Promise<void> {
    console.log('⚙️ Testing database configuration...');

    const configIssues: string[] = [];

    // Check for required configuration
    const missingVars: string[] = [];
    for (const varName of this.REQUIRED_DB_VARS) {
      if (!this.processEnv[varName] && !this.processEnv[`DATABASE_${varName.split('_')[1]}`]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      configIssues.push(`Missing required database variables: ${missingVars.join(', ')}`);
    }

    // Check for monitoring configuration
    const hasQueryLogging = this.processEnv['DB_LOG_QUERIES'] === 'true';
    if (!hasQueryLogging) {
      configIssues.push('Query logging not enabled');
    }

    const hasSlowQueryMonitoring = !!this.processEnv['DB_SLOW_QUERY_THRESHOLD'];
    if (!hasSlowQueryMonitoring) {
      configIssues.push('Slow query monitoring not configured');
    }

    // Check for backup configuration
    const hasBackupConfig = this.processEnv['DB_BACKUP_ENABLED'] === 'true' || 
                           !!this.processEnv['BACKUP_SCHEDULE'];
    if (!hasBackupConfig) {
      configIssues.push('Database backup not configured');
    }

    this.results.push({
      testName: 'Database configuration security',
      category: 'monitoring',
      passed: configIssues.length === 0,
      severity: configIssues.length > 3 ? 'medium' : 'low',
      details: { 
        configIssues, 
        missingVars,
        hasQueryLogging,
        hasSlowQueryMonitoring,
        hasBackupConfig
      },
      recommendations: configIssues.length > 0 ? [
        'Configure all required database variables',
        'Enable query and slow query logging',
        'Set up automated database backups',
        'Implement connection monitoring'
      ] : ['Database configuration looks secure']
    });
  }

  // Helper methods
  private getDatabaseConfig(): Record<string, any> {
    return {
      host: this.processEnv['DB_HOST'] || this.processEnv['DATABASE_HOST'],
      port: this.processEnv['DB_PORT'] || this.processEnv['DATABASE_PORT'],
      database: this.processEnv['DB_NAME'] || this.processEnv['DATABASE_NAME'],
      user: this.processEnv['DB_USER'] || this.processEnv['DATABASE_USER'],
      password: this.processEnv['DB_PASSWORD'] || this.processEnv['DATABASE_PASSWORD']
    };
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

  private isWeakPassword(password: string): boolean {
    const weakPasswords = ['password', 'admin', 'secret', '123456', 'changeme'];
    return weakPasswords.some(weak => 
      password.toLowerCase().includes(weak)
    ) || password.length < 12; // Increased minimum length for better security
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
        if (content.includes('audit') && content.includes('log')) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }
    return false;
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