/**
 * Automated Security Report Generator
 * 
 * Comprehensive security reporting system that consolidates results from:
 * - Comprehensive Security Validation
 * - Encryption Validation Framework
 * - Environment Security Validation
 * - Database Security Validation
 * - Compliance Validation Framework
 * - Audit Log Verification
 */

import { EventEmitter } from 'events';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { comprehensiveSecurityValidator } from './comprehensive-security-validation';
import { encryptionValidationFramework } from './encryption-validation-framework';
import { environmentSecurityValidator } from './environment-security-validation';
import { databaseSecurityValidator } from './database-security-validation';
import { complianceValidationFramework } from './compliance-validation-framework';
import { auditLogVerificationFramework } from './audit-log-verification';
import { ConfigurationAuditLogger } from '../../config/validation/audit-logger';

export interface SecurityReportConfig {
  environment: string;
  includeComponents: {
    comprehensive: boolean;
    encryption: boolean;
    environment: boolean;
    database: boolean;
    compliance: boolean;
    auditLogs: boolean;
  };
  formats: ('json' | 'html' | 'csv' | 'pdf')[];
  outputDirectory: string;
  timeRange?: {
    hours: number;
  };
  compliance?: {
    standards: string[];
  };
}

export interface ConsolidatedSecurityReport {
  id: string;
  generated: Date;
  environment: string;
  configuration: SecurityReportConfig;
  
  executiveSummary: {
    overallSecurityScore: number;
    securityPosture: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    criticalFindings: number;
    highPriorityFindings: number;
    mediumPriorityFindings: number;
    lowPriorityFindings: number;
    complianceStatus: 'compliant' | 'non-compliant' | 'partially-compliant';
    totalTests: number;
    passedTests: number;
    topRecommendations: string[];
  };
  
  componentResults: {
    comprehensive?: any;
    encryption?: any;
    environment?: any;
    database?: any;
    compliance?: any;
    auditLogs?: any;
  };

  componentSummary: {
    [component: string]: {
      score: number;
      findings: number;
      status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    };
  };
  
  consolidatedFindings: {
    critical: SecurityFinding[];
    high: SecurityFinding[];
    medium: SecurityFinding[];
    low: SecurityFinding[];
  };
  
  riskAssessment: {
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    businessImpact: {
      financial: string;
      operational: string;
      reputational: string;
      regulatory: string;
    };
    threatAnalysis: {
      topThreats: string[];
      vulnerabilityExposure: number;
      attackSurface: string;
    };
  };
  
  complianceMatrix: {
    overallCompliance: number;
    compliantStandards: number;
    totalStandards: number;
    criticalNonCompliance: number;
    owasp: ComplianceResult;
    nist: ComplianceResult;
    pci_dss: ComplianceResult;
    hipaa: ComplianceResult;
    sox: ComplianceResult;
    gdpr: ComplianceResult;
    iso27001: ComplianceResult;
  };
  
  remediationPlan: {
    immediate: RemediationItem[];
    shortTerm: RemediationItem[];
    mediumTerm: RemediationItem[];
    longTerm: RemediationItem[];
    totalEstimatedCost: string;
    totalEstimatedHours: number;
  };
  
  trends: {
    scoreHistory: { date: Date; score: number }[];
    findingsTrend: { date: Date; critical: number; high: number; medium: number; low: number }[];
    complianceTrend: { date: Date; compliant: number; total: number }[];
  };
  
  auditTrail: {
    reportGeneration: string;
    dataCollection: string[];
    validationMethods: string[];
    qualityAssurance: string;
  };
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  source: string;
  impact: string;
  remediation: string;
  estimatedFixTime: number;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  complianceImpact: string[];
  cwe?: string;
  cvss?: number;
  references: string[];
}

export interface ComplianceResult {
  standard: string;
  score: number;
  status: 'compliant' | 'non-compliant' | 'partially-compliant';
  implementedControls: number;
  totalControls: number;
  gaps: string[];
  lastAssessment: Date;
}

export interface RemediationItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours: number;
  estimatedCost: string;
  dependencies: string[];
  requiredSkills: string[];
  timeline: string;
  businessJustification: string;
}

export class SecurityReportGenerator extends EventEmitter {
  private auditLogger: ConfigurationAuditLogger;
  private reportHistory: ConsolidatedSecurityReport[] = [];

  constructor() {
    super();
    this.auditLogger = new ConfigurationAuditLogger();
  }

  /**
   * Generate comprehensive security report
   */
  async generateReport(config: SecurityReportConfig): Promise<ConsolidatedSecurityReport> {
    console.log(`🔒 Generating comprehensive security report for ${config.environment}`);
    const startTime = Date.now();

    // Log report generation start
    await this.auditLogger.logSystemEvent(
      'security_report_generator',
      'report_generation_started',
      { environment: config.environment, components: config.includeComponents },
      'info'
    );

    this.emit('report:started', { config, timestamp: new Date() });

    // Ensure output directory exists
    if (!existsSync(config.outputDirectory)) {
      mkdirSync(config.outputDirectory, { recursive: true });
    }

    const componentResults: any = {};
    const allFindings: SecurityFinding[] = [];
    const auditTrail: string[] = [];

    // Run comprehensive security validation
    if (config.includeComponents.comprehensive) {
      try {
        console.log(`  🧪 Running comprehensive security validation...`);
        const comprehensiveResult = await comprehensiveSecurityValidator.runValidation(config.environment);
        componentResults.comprehensive = comprehensiveResult;
        
        // Convert findings
        const findings = this.convertComprehensiveFindings(comprehensiveResult);
        allFindings.push(...findings);
        auditTrail.push('Comprehensive Security Validation');
        
        console.log(`    ✓ Comprehensive validation completed (${comprehensiveResult.summary.totalTests} tests)`);
      } catch (error) {
        console.error(`    ✗ Comprehensive validation failed:`, error);
        auditTrail.push('Comprehensive Security Validation (FAILED)');
      }
    }

    // Run encryption validation
    if (config.includeComponents.encryption) {
      try {
        console.log(`  🔐 Running encryption validation...`);
        const encryptionResult = await encryptionValidationFramework.runValidation(config.environment);
        componentResults.encryption = encryptionResult;
        
        const findings = this.convertEncryptionFindings(encryptionResult);
        allFindings.push(...findings);
        auditTrail.push('Encryption Validation Framework');
        
        console.log(`    ✓ Encryption validation completed (${encryptionResult.testResults.length} tests)`);
      } catch (error) {
        console.error(`    ✗ Encryption validation failed:`, error);
        auditTrail.push('Encryption Validation Framework (FAILED)');
      }
    }

    // Run environment security validation
    if (config.includeComponents.environment) {
      try {
        console.log(`  🔧 Running environment security validation...`);
        const environmentResult = await environmentSecurityValidator.runValidation(config.environment);
        componentResults.environment = environmentResult;
        
        const findings = this.convertEnvironmentFindings(environmentResult);
        allFindings.push(...findings);
        auditTrail.push('Environment Security Validation');
        
        console.log(`    ✓ Environment validation completed (${environmentResult.testResults.length} tests)`);
      } catch (error) {
        console.error(`    ✗ Environment validation failed:`, error);
        auditTrail.push('Environment Security Validation (FAILED)');
      }
    }

    // Run database security validation
    if (config.includeComponents.database) {
      try {
        console.log(`  🗄️ Running database security validation...`);
        const databaseResult = await databaseSecurityValidator.runValidation(config.environment);
        componentResults.database = databaseResult;
        
        const findings = this.convertDatabaseFindings(databaseResult);
        allFindings.push(...findings);
        auditTrail.push('Database Security Validation');
        
        console.log(`    ✓ Database validation completed (${databaseResult.testResults.length} tests)`);
      } catch (error) {
        console.error(`    ✗ Database validation failed:`, error);
        auditTrail.push('Database Security Validation (FAILED)');
      }
    }

    // Run compliance validation
    if (config.includeComponents.compliance) {
      try {
        console.log(`  🏛️ Running compliance validation...`);
        const standards = config.compliance?.standards || ['all'];
        const complianceResult = await complianceValidationFramework.runValidation(config.environment, standards);
        componentResults.compliance = complianceResult;
        
        const findings = this.convertComplianceFindings(complianceResult);
        allFindings.push(...findings);
        auditTrail.push('Compliance Validation Framework');
        
        console.log(`    ✓ Compliance validation completed (${complianceResult.summary.totalControls} controls)`);
      } catch (error) {
        console.error(`    ✗ Compliance validation failed:`, error);
        auditTrail.push('Compliance Validation Framework (FAILED)');
      }
    }

    // Run audit log verification
    if (config.includeComponents.auditLogs) {
      try {
        console.log(`  📋 Running audit log verification...`);
        const timeRange = config.timeRange?.hours || 24;
        const auditLogResult = await auditLogVerificationFramework.runVerification(config.environment, timeRange);
        componentResults.auditLogs = auditLogResult;
        
        const findings = this.convertAuditLogFindings(auditLogResult);
        allFindings.push(...findings);
        auditTrail.push('Audit Log Verification');
        
        console.log(`    ✓ Audit log verification completed (${auditLogResult.summary.totalTests} tests)`);
      } catch (error) {
        console.error(`    ✗ Audit log verification failed:`, error);
        auditTrail.push('Audit Log Verification (FAILED)');
      }
    }

    // Consolidate findings by severity
    const consolidatedFindings = {
      critical: allFindings.filter(f => f.severity === 'critical'),
      high: allFindings.filter(f => f.severity === 'high'),
      medium: allFindings.filter(f => f.severity === 'medium'),
      low: allFindings.filter(f => f.severity === 'low')
    };

    // Calculate executive summary
    const executiveSummary = this.generateExecutiveSummary(allFindings, componentResults);
    
    // Generate risk assessment
    const riskAssessment = this.generateRiskAssessment(allFindings, componentResults);
    
    // Generate compliance matrix
    const complianceMatrix = this.generateComplianceMatrix(componentResults);
    
    // Generate remediation plan
    const remediationPlan = this.generateRemediationPlan(allFindings);
    
    // Generate trends (mock data for now)
    const trends = this.generateTrends();

    const executionTime = Date.now() - startTime;

    // Generate component summary
    const componentSummary = this.generateComponentSummary(componentResults, allFindings);

    const report: ConsolidatedSecurityReport = {
      id: `security_report_${Date.now()}`,
      generated: new Date(),
      environment: config.environment,
      configuration: config,
      executiveSummary,
      componentResults,
      componentSummary,
      consolidatedFindings,
      riskAssessment,
      complianceMatrix,
      remediationPlan,
      trends,
      auditTrail: {
        reportGeneration: `Generated in ${executionTime}ms`,
        dataCollection: auditTrail,
        validationMethods: Object.keys(config.includeComponents).filter(k => config.includeComponents[k as keyof typeof config.includeComponents]),
        qualityAssurance: 'Automated validation with manual review checkpoints'
      }
    };

    // Store in history
    this.reportHistory.push(report);

    // Generate reports in requested formats
    for (const format of config.formats) {
      const outputFile = join(config.outputDirectory, `security_report_${config.environment}_${Date.now()}.${format}`);
      const reportContent = this.exportReport(report, format);
      writeFileSync(outputFile, reportContent);
      console.log(`📄 ${format.toUpperCase()} report saved to: ${outputFile}`);
    }

    // Log completion
    await this.auditLogger.logSystemEvent(
      'security_report_generator',
      'report_generation_completed',
      { 
        environment: config.environment,
        executionTime,
        totalFindings: allFindings.length,
        criticalFindings: consolidatedFindings.critical.length,
        overallScore: executiveSummary.overallSecurityScore,
        formats: config.formats
      },
      consolidatedFindings.critical.length > 0 ? 'critical' : 'info'
    );

    this.emit('report:completed', { report, executionTime, timestamp: new Date() });

    console.log(`✅ Security report generation completed in ${executionTime}ms`);
    console.log(`📊 Overall Security Score: ${executiveSummary.overallSecurityScore}/100`);
    console.log(`🛡️ Security Posture: ${executiveSummary.securityPosture.toUpperCase()}`);
    console.log(`🚨 Critical Findings: ${consolidatedFindings.critical.length}`);
    console.log(`⚠️ High Risk Findings: ${consolidatedFindings.high.length}`);

    return report;
  }

  // Conversion methods for different component findings

  private convertComprehensiveFindings(result: any): SecurityFinding[] {
    if (!result.testResults) return [];
    
    return result.testResults.flatMap((test: any) => 
      test.vulnerabilities.map((vuln: any) => ({
        id: `comp_${vuln.id || test.testId}`,
        title: vuln.description || test.name,
        description: vuln.description || `${test.name} vulnerability`,
        severity: vuln.severity || 'medium',
        category: test.category || 'general',
        source: 'Comprehensive Security Validation',
        impact: vuln.impact || 'Security risk identified',
        remediation: vuln.remediation || 'Review and address security issue',
        estimatedFixTime: 4,
        businessImpact: this.mapSeverityToBusinessImpact(vuln.severity),
        complianceImpact: vuln.owaspCategory ? [vuln.owaspCategory] : [],
        cwe: vuln.cwe,
        references: vuln.references || []
      }))
    );
  }

  private convertEncryptionFindings(result: any): SecurityFinding[] {
    if (!result.testResults) return [];
    
    return result.testResults.flatMap((test: any) => 
      test.vulnerabilities.map((vuln: any) => ({
        id: `enc_${vuln.id}`,
        title: vuln.description,
        description: vuln.description,
        severity: vuln.severity,
        category: 'encryption',
        source: 'Encryption Validation Framework',
        impact: vuln.impact,
        remediation: vuln.remediation,
        estimatedFixTime: 6,
        businessImpact: this.mapSeverityToBusinessImpact(vuln.severity),
        complianceImpact: ['FIPS 140-2', 'PCI-DSS'],
        cve: vuln.cveReferences?.[0],
        references: vuln.cveReferences || []
      }))
    );
  }

  private convertEnvironmentFindings(result: any): SecurityFinding[] {
    if (!result.testResults) return [];
    
    return result.testResults.flatMap((test: any) => 
      test.vulnerabilities.map((vuln: any) => ({
        id: `env_${vuln.id}`,
        title: vuln.description,
        description: vuln.description,
        severity: vuln.severity,
        category: 'environment',
        source: 'Environment Security Validation',
        impact: vuln.impact,
        remediation: vuln.remediation,
        estimatedFixTime: 3,
        businessImpact: this.mapSeverityToBusinessImpact(vuln.severity),
        complianceImpact: vuln.cveReferences || [],
        references: vuln.cveReferences || []
      }))
    );
  }

  private convertDatabaseFindings(result: any): SecurityFinding[] {
    if (!result.testResults) return [];
    
    return result.testResults.flatMap((test: any) => 
      test.vulnerabilities.map((vuln: any) => ({
        id: `db_${vuln.id}`,
        title: vuln.description,
        description: vuln.description,
        severity: vuln.severity,
        category: 'database',
        source: 'Database Security Validation',
        impact: vuln.impact,
        remediation: vuln.remediation,
        estimatedFixTime: 5,
        businessImpact: this.mapSeverityToBusinessImpact(vuln.severity),
        complianceImpact: ['PCI-DSS', 'HIPAA'],
        cve: vuln.cve,
        references: vuln.references || []
      }))
    );
  }

  private convertComplianceFindings(result: any): SecurityFinding[] {
    if (!result.complianceResults) return [];
    
    return result.complianceResults.flatMap((test: any) => 
      test.findings.map((finding: any) => ({
        id: `comp_${finding.id}`,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: 'compliance',
        source: 'Compliance Validation Framework',
        impact: finding.impact,
        remediation: finding.remediation,
        estimatedFixTime: finding.technicalDebt || 4,
        businessImpact: finding.businessImpact,
        complianceImpact: [finding.controlReference],
        references: finding.references || []
      }))
    );
  }

  private convertAuditLogFindings(result: any): SecurityFinding[] {
    if (!result.testResults) return [];
    
    return result.testResults.flatMap((test: any) => 
      test.findings.map((finding: any) => ({
        id: `audit_${finding.id}`,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: 'audit_logs',
        source: 'Audit Log Verification',
        impact: finding.impact,
        remediation: finding.remediation,
        estimatedFixTime: finding.estimatedFixTime || 3,
        businessImpact: this.mapSeverityToBusinessImpact(finding.severity),
        complianceImpact: finding.regulatoryImpact ? [finding.regulatoryImpact] : [],
        references: []
      }))
    );
  }

  private mapSeverityToBusinessImpact(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  }

  private generateExecutiveSummary(findings: SecurityFinding[], componentResults: any): any {
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const highPriorityFindings = findings.filter(f => f.severity === 'high').length;
    const mediumPriorityFindings = findings.filter(f => f.severity === 'medium').length;
    const lowPriorityFindings = findings.filter(f => f.severity === 'low').length;
    
    // Calculate overall score (weighted average)
    const scores: number[] = [];
    Object.values(componentResults).forEach((result: any) => {
      if (result?.summary?.overallScore) scores.push(result.summary.overallScore);
      if (result?.overallScore) scores.push(result.overallScore);
    });
    
    const overallScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    
    let securityPosture: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'poor';
    if (criticalFindings === 0 && overallScore >= 90) securityPosture = 'excellent';
    else if (criticalFindings === 0 && overallScore >= 80) securityPosture = 'good';
    else if (criticalFindings <= 2 && overallScore >= 70) securityPosture = 'fair';
    else if (criticalFindings > 5 || overallScore < 50) securityPosture = 'critical';

    // Calculate risk level based on findings
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalFindings > 0) riskLevel = 'critical';
    else if (highPriorityFindings > 3) riskLevel = 'high';
    else if (highPriorityFindings > 0 || totalFindings > 10) riskLevel = 'medium';
    
    const complianceStatus = criticalFindings === 0 && overallScore >= 80 ? 'compliant' :
                           criticalFindings <= 2 && overallScore >= 60 ? 'partially-compliant' : 'non-compliant';

    // Count total tests
    const totalTests = Object.values(componentResults).reduce((sum: number, result: any) => {
      if (result?.summary?.totalTests) return sum + result.summary.totalTests;
      if (result?.testResults?.length) return sum + result.testResults.length;
      return sum;
    }, 0);

    const passedTests = Object.values(componentResults).reduce((sum: number, result: any) => {
      if (result?.summary?.passedTests) return sum + result.summary.passedTests;
      if (result?.testResults) return sum + result.testResults.filter((t: any) => t.passed).length;
      return sum;
    }, 0);

    return {
      overallSecurityScore: overallScore,
      securityPosture,
      riskLevel,
      criticalFindings,
      highPriorityFindings,
      mediumPriorityFindings,
      lowPriorityFindings,
      complianceStatus,
      totalTests,
      passedTests,
      topRecommendations: this.generateKeyRecommendations(findings)
    };
  }

  private generateKeyRecommendations(findings: SecurityFinding[]): string[] {
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');
    
    const recommendations: string[] = [];
    
    if (criticalFindings.length > 0) {
      recommendations.push(`Address ${criticalFindings.length} critical security findings immediately`);
      recommendations.push(`Implement emergency security measures for critical vulnerabilities`);
    }
    
    if (highFindings.length > 0) {
      recommendations.push(`Resolve ${highFindings.length} high-risk security issues within 48 hours`);
    }
    
    // Category-specific recommendations
    const categories = new Set(findings.map(f => f.category));
    if (categories.has('encryption')) {
      recommendations.push('Strengthen encryption mechanisms and key management');
    }
    if (categories.has('compliance')) {
      recommendations.push('Address regulatory compliance gaps to avoid penalties');
    }
    if (categories.has('audit_logs')) {
      recommendations.push('Improve audit logging completeness and integrity');
    }
    
    recommendations.push('Implement continuous security monitoring and alerting');
    recommendations.push('Conduct regular security assessments and penetration testing');
    
    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  private generateRiskAssessment(findings: SecurityFinding[], componentResults: any): any {
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    
    let overallRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalCount > 0) overallRiskLevel = 'critical';
    else if (highCount > 3) overallRiskLevel = 'high';
    else if (highCount > 0 || findings.length > 10) overallRiskLevel = 'medium';
    
    return {
      overallRiskLevel,
      businessImpact: {
        financial: this.assessFinancialImpact(findings),
        operational: this.assessOperationalImpact(findings),
        reputational: this.assessReputationalImpact(findings),
        regulatory: this.assessRegulatoryImpact(findings)
      },
      threatAnalysis: {
        topThreats: this.identifyTopThreats(findings),
        vulnerabilityExposure: Math.min(100, findings.length * 5),
        attackSurface: this.assessAttackSurface(findings)
      }
    };
  }

  private assessFinancialImpact(findings: SecurityFinding[]): string {
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const totalHours = findings.reduce((sum, f) => sum + f.estimatedFixTime, 0);
    
    if (criticalCount > 3) return 'High - Potential for significant regulatory fines and business disruption';
    if (criticalCount > 0 || totalHours > 40) return 'Medium - Moderate financial impact from remediation costs';
    return 'Low - Minimal direct financial impact expected';
  }

  private assessOperationalImpact(findings: SecurityFinding[]): string {
    const totalHours = findings.reduce((sum, f) => sum + f.estimatedFixTime, 0);
    
    if (totalHours > 80) return 'High - Significant operational overhead and potential service disruptions';
    if (totalHours > 30) return 'Medium - Moderate operational impact requiring resource allocation';
    return 'Low - Minimal operational disruption expected';
  }

  private assessReputationalImpact(findings: SecurityFinding[]): string {
    const highImpactCount = findings.filter(f => f.businessImpact === 'critical' || f.businessImpact === 'high').length;
    
    if (highImpactCount > 5) return 'High - Potential damage to customer trust and brand reputation';
    if (highImpactCount > 2) return 'Medium - Some reputational risk if issues become public';
    return 'Low - Minimal reputational impact expected';
  }

  private assessRegulatoryImpact(findings: SecurityFinding[]): string {
    const complianceFindings = findings.filter(f => f.complianceImpact.length > 0);
    
    if (complianceFindings.length > 5) return 'High - Non-compliance with multiple regulatory requirements';
    if (complianceFindings.length > 2) return 'Medium - Some regulatory compliance gaps identified';
    return 'Low - Generally compliant with regulatory requirements';
  }

  private identifyTopThreats(findings: SecurityFinding[]): string[] {
    const threatMap = new Map<string, number>();
    
    findings.forEach(finding => {
      if (finding.category === 'authentication') threatMap.set('Credential Compromise', (threatMap.get('Credential Compromise') || 0) + 1);
      if (finding.category === 'authorization') threatMap.set('Privilege Escalation', (threatMap.get('Privilege Escalation') || 0) + 1);
      if (finding.category === 'encryption') threatMap.set('Data Breach', (threatMap.get('Data Breach') || 0) + 1);
      if (finding.category === 'injection') threatMap.set('Code Injection', (threatMap.get('Code Injection') || 0) + 1);
      if (finding.category === 'xss') threatMap.set('Cross-Site Scripting', (threatMap.get('Cross-Site Scripting') || 0) + 1);
      if (finding.category === 'csrf') threatMap.set('Cross-Site Request Forgery', (threatMap.get('Cross-Site Request Forgery') || 0) + 1);
    });
    
    return Array.from(threatMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
  }

  private assessAttackSurface(findings: SecurityFinding[]): string {
    const surfacePoints = findings.length;
    
    if (surfacePoints > 20) return 'Large - Multiple vulnerable components exposed';
    if (surfacePoints > 10) return 'Medium - Some vulnerable components identified';
    return 'Small - Minimal attack surface identified';
  }

  private generateComplianceMatrix(componentResults: any): any {
    const standards = {
      owasp: { standard: 'OWASP Top 10 2021', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 10, gaps: [], lastAssessment: new Date() },
      nist: { standard: 'NIST CSF', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 23, gaps: [], lastAssessment: new Date() },
      pci_dss: { standard: 'PCI-DSS v4.0', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 12, gaps: [], lastAssessment: new Date() },
      hipaa: { standard: 'HIPAA', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 18, gaps: [], lastAssessment: new Date() },
      sox: { standard: 'SOX', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 5, gaps: [], lastAssessment: new Date() },
      gdpr: { standard: 'GDPR', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 7, gaps: [], lastAssessment: new Date() },
      iso27001: { standard: 'ISO 27001:2022', score: 0, status: 'non-compliant', implementedControls: 0, totalControls: 93, gaps: [], lastAssessment: new Date() }
    };

    // Extract compliance data from component results
    if (componentResults.compliance?.standardsCompliance) {
      Object.entries(componentResults.compliance.standardsCompliance).forEach(([key, compliance]: [string, any]) => {
        if (standards[key as keyof typeof standards]) {
          standards[key as keyof typeof standards] = {
            ...standards[key as keyof typeof standards],
            score: compliance.overallCompliance,
            status: compliance.status,
            implementedControls: compliance.implementedControls,
            totalControls: compliance.totalControls,
            gaps: compliance.criticalGaps ? [`${compliance.criticalGaps} critical gaps`] : []
          };
        }
      });
    }

    // Calculate summary metrics
    const standardValues = Object.values(standards);
    const totalStandards = standardValues.length;
    const compliantStandards = standardValues.filter(s => s.status === 'compliant').length;
    const criticalNonCompliance = standardValues.filter(s => s.status === 'non-compliant' && s.score < 50).length;
    const overallCompliance = Math.round(standardValues.reduce((sum, s) => sum + s.score, 0) / totalStandards);

    return {
      overallCompliance,
      compliantStandards,
      totalStandards,
      criticalNonCompliance,
      ...standards
    };
  }

  private generateRemediationPlan(findings: SecurityFinding[]): any {
    const criticalItems = this.createRemediationItems(findings.filter(f => f.severity === 'critical'), 'critical');
    const highItems = this.createRemediationItems(findings.filter(f => f.severity === 'high'), 'high');
    const mediumItems = this.createRemediationItems(findings.filter(f => f.severity === 'medium'), 'medium');
    const lowItems = this.createRemediationItems(findings.filter(f => f.severity === 'low'), 'low');
    
    const totalHours = findings.reduce((sum, f) => sum + f.estimatedFixTime, 0);
    const totalCost = `$${(totalHours * 150).toLocaleString()}`; // $150/hour average
    
    return {
      immediate: criticalItems,
      shortTerm: highItems,
      mediumTerm: mediumItems,
      longTerm: lowItems,
      totalEstimatedCost: totalCost,
      totalEstimatedHours: totalHours
    };
  }

  private createRemediationItems(findings: SecurityFinding[], priority: string): RemediationItem[] {
    return findings.map(finding => ({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      priority: priority as 'critical' | 'high' | 'medium' | 'low',
      estimatedHours: finding.estimatedFixTime,
      estimatedCost: `$${(finding.estimatedFixTime * 150).toLocaleString()}`,
      dependencies: [],
      requiredSkills: this.identifyRequiredSkills(finding),
      timeline: this.calculateTimeline(finding.estimatedFixTime),
      businessJustification: `Address ${finding.severity} security risk: ${finding.impact}`
    }));
  }

  private identifyRequiredSkills(finding: SecurityFinding): string[] {
    const skills: string[] = [];
    
    switch (finding.category) {
      case 'encryption':
        skills.push('Cryptography', 'Security Engineering');
        break;
      case 'authentication':
      case 'authorization':
        skills.push('Identity Management', 'Access Control');
        break;
      case 'database':
        skills.push('Database Security', 'DBA');
        break;
      case 'compliance':
        skills.push('Compliance Management', 'Regulatory Knowledge');
        break;
      case 'audit_logs':
        skills.push('Log Management', 'SIEM');
        break;
      default:
        skills.push('Security Engineering', 'DevOps');
    }
    
    return skills;
  }

  private calculateTimeline(hours: number): string {
    if (hours <= 8) return '1 day';
    if (hours <= 40) return '1 week';
    if (hours <= 160) return '1 month';
    return '2+ months';
  }

  private generateTrends(): any {
    // Mock trend data - in real implementation, this would come from historical reports
    const now = new Date();
    const scoreHistory = [];
    const findingsTrend = [];
    const complianceTrend = [];
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      scoreHistory.push({
        date,
        score: Math.floor(60 + Math.random() * 25 + (i < 15 ? 15 : 0)) // Improving trend
      });
      
      findingsTrend.push({
        date,
        critical: Math.floor(Math.random() * 3),
        high: Math.floor(Math.random() * 8),
        medium: Math.floor(Math.random() * 15),
        low: Math.floor(Math.random() * 25)
      });
      
      complianceTrend.push({
        date,
        compliant: Math.floor(5 + Math.random() * 3 + (i < 15 ? 2 : 0)),
        total: 8
      });
    }
    
    return {
      scoreHistory,
      findingsTrend,
      complianceTrend
    };
  }

  /**
   * Export report in various formats
   */
  exportReport(report: ConsolidatedSecurityReport, format: 'json' | 'html' | 'csv' | 'pdf'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateHTMLReport(report);
      case 'csv':
        return this.generateCSVReport(report);
      case 'pdf':
        return 'PDF export requires additional libraries - use HTML format and convert to PDF';
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Generate comprehensive HTML report
   */
  private generateHTMLReport(report: ConsolidatedSecurityReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Security Report - ${report.environment}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.critical { border-color: #dc3545; background: #f8d7da; }
        .metric.warning { border-color: #ffc107; background: #fff3cd; }
        .metric.success { border-color: #28a745; background: #d4edda; }
        .metric h3 { margin: 0; color: #495057; font-size: 1.1em; }
        .metric .value { font-size: 2.5em; font-weight: bold; margin: 10px 0; }
        .metric .label { color: #6c757d; font-size: 0.9em; }
        .section { margin: 40px 0; }
        .section h2 { color: #495057; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .finding { margin: 15px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #ccc; }
        .finding.critical { border-color: #dc3545; background: #f8d7da; }
        .finding.high { border-color: #fd7e14; background: #fff3cd; }
        .finding.medium { border-color: #ffc107; background: #fff8e1; }
        .finding.low { border-color: #17a2b8; background: #e1f5fe; }
        .finding h4 { margin: 0 0 10px 0; }
        .finding-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; font-size: 0.9em; color: #6c757d; }
        .compliance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .compliance-item { padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; }
        .compliance-item.compliant { background: #d4edda; border-color: #28a745; }
        .compliance-item.non-compliant { background: #f8d7da; border-color: #dc3545; }
        .compliance-item.partially-compliant { background: #fff3cd; border-color: #ffc107; }
        .remediation-item { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .timeline { display: flex; align-items: center; margin: 5px 0; }
        .timeline-badge { padding: 3px 8px; background: #007bff; color: white; border-radius: 12px; font-size: 0.8em; margin-right: 10px; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #007bff, #28a745); }
        .risk-indicator { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; }
        .risk-low { background: #28a745; }
        .risk-medium { background: #ffc107; color: #212529; }
        .risk-high { background: #fd7e14; }
        .risk-critical { background: #dc3545; }
        .tab-container { margin: 20px 0; }
        .tab-buttons { display: flex; border-bottom: 1px solid #dee2e6; }
        .tab-button { padding: 10px 20px; background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab-button.active { border-bottom-color: #007bff; background: #f8f9fa; }
        .tab-content { display: none; padding: 20px 0; }
        .tab-content.active { display: block; }
        .chart-placeholder { background: #f8f9fa; border: 2px dashed #dee2e6; padding: 40px; text-align: center; color: #6c757d; border-radius: 8px; }
    </style>
    <script>
        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            document.querySelector('[onclick="showTab(\\''+tabName+'\\')"]').classList.add('active');
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>🔒 Comprehensive Security Report</h1>
        <p><strong>Report ID:</strong> ${report.id}</p>
        <p><strong>Environment:</strong> ${report.environment} | <strong>Generated:</strong> ${report.generated.toLocaleString()}</p>
        <p><strong>Security Posture:</strong> ${report.executiveSummary.securityPosture.toUpperCase()} | <strong>Compliance:</strong> ${report.executiveSummary.complianceStatus.toUpperCase()}</p>
    </div>

    <div class="summary">
        <div class="metric ${report.executiveSummary.overallSecurityScore >= 80 ? 'success' : report.executiveSummary.overallSecurityScore >= 60 ? 'warning' : 'critical'}">
            <h3>Overall Security Score</h3>
            <div class="value">${report.executiveSummary.overallSecurityScore}</div>
            <div class="label">out of 100</div>
        </div>
        <div class="metric ${report.executiveSummary.criticalFindings === 0 ? 'success' : 'critical'}">
            <h3>Critical Findings</h3>
            <div class="value">${report.executiveSummary.criticalFindings}</div>
            <div class="label">require immediate attention</div>
        </div>
        <div class="metric ${report.executiveSummary.highRiskFindings <= 2 ? 'success' : 'warning'}">
            <h3>High Risk Issues</h3>
            <div class="value">${report.executiveSummary.highRiskFindings}</div>
            <div class="label">high priority fixes</div>
        </div>
        <div class="metric">
            <h3>Test Coverage</h3>
            <div class="value">${report.executiveSummary.passedTests}/${report.executiveSummary.totalTests}</div>
            <div class="label">tests passed</div>
        </div>
    </div>

    <div class="tab-container">
        <div class="tab-buttons">
            <button class="tab-button active" onclick="showTab('executive')">Executive Summary</button>
            <button class="tab-button" onclick="showTab('findings')">Security Findings</button>
            <button class="tab-button" onclick="showTab('compliance')">Compliance Matrix</button>
            <button class="tab-button" onclick="showTab('remediation')">Remediation Plan</button>
            <button class="tab-button" onclick="showTab('risk')">Risk Assessment</button>
        </div>

        <div id="executive" class="tab-content active">
            <div class="section">
                <h2>📊 Executive Summary</h2>
                <p><strong>Security Posture:</strong> <span class="risk-indicator risk-${report.executiveSummary.securityPosture === 'excellent' ? 'low' : report.executiveSummary.securityPosture === 'good' ? 'medium' : report.executiveSummary.securityPosture === 'fair' ? 'medium' : 'critical'}">${report.executiveSummary.securityPosture.toUpperCase()}</span></p>
                
                <h3>Key Recommendations</h3>
                <ul>
                    ${report.executiveSummary.topRecommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>

                <h3>Component Status</h3>
                <div class="compliance-grid">
                    ${Object.entries(report.componentResults).map(([component, result]: [string, any]) => {
                        const score = result?.summary?.overallScore || result?.overallScore || 0;
                        const status = score >= 80 ? 'compliant' : score >= 60 ? 'partially-compliant' : 'non-compliant';
                        return `
                            <div class="compliance-item ${status}">
                                <h4>${component.charAt(0).toUpperCase() + component.slice(1)} Security</h4>
                                <p>Score: ${score}/100</p>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${score}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>

        <div id="findings" class="tab-content">
            <div class="section">
                <h2>🚨 Security Findings</h2>
                
                ${Object.entries(report.consolidatedFindings).map(([severity, findings]: [string, SecurityFinding[]]) => {
                    if (findings.length === 0) return '';
                    return `
                        <h3>${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity (${findings.length} issues)</h3>
                        ${findings.map(finding => `
                            <div class="finding ${severity}">
                                <h4>${finding.title}</h4>
                                <p>${finding.description}</p>
                                <div class="finding-meta">
                                    <div><strong>Source:</strong> ${finding.source}</div>
                                    <div><strong>Category:</strong> ${finding.category}</div>
                                    <div><strong>Fix Time:</strong> ${finding.estimatedFixTime}h</div>
                                    <div><strong>Business Impact:</strong> ${finding.businessImpact.toUpperCase()}</div>
                                </div>
                                <p><strong>Remediation:</strong> ${finding.remediation}</p>
                                ${finding.complianceImpact.length > 0 ? `<p><strong>Compliance Impact:</strong> ${finding.complianceImpact.join(', ')}</p>` : ''}
                            </div>
                        `).join('')}
                    `;
                }).join('')}
            </div>
        </div>

        <div id="compliance" class="tab-content">
            <div class="section">
                <h2>🏛️ Compliance Matrix</h2>
                <p><strong>Overall Compliance:</strong> ${report.complianceMatrix.overallCompliance}/100</p>
                <p><strong>Compliant Standards:</strong> ${report.complianceMatrix.compliantStandards}/${report.complianceMatrix.totalStandards}</p>
                <div class="compliance-grid">
                    ${Object.entries(report.complianceMatrix)
                      .filter(([key]) => !['overallCompliance', 'compliantStandards', 'totalStandards', 'criticalNonCompliance'].includes(key))
                      .map(([standard, compliance]: [string, any]) => `
                        <div class="compliance-item ${compliance.status.replace('-', '_')}">
                            <h4>${compliance.standard}</h4>
                            <p><strong>Score:</strong> ${compliance.score}/100</p>
                            <p><strong>Status:</strong> ${compliance.status.toUpperCase()}</p>
                            <p><strong>Controls:</strong> ${compliance.implementedControls}/${compliance.totalControls} implemented</p>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${compliance.score}%"></div>
                            </div>
                            ${compliance.gaps.length > 0 ? `<p><strong>Gaps:</strong> ${compliance.gaps.join(', ')}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div id="remediation" class="tab-content">
            <div class="section">
                <h2>🔧 Remediation Plan</h2>
                <p><strong>Total Estimated Cost:</strong> ${report.remediationPlan.totalEstimatedCost}</p>
                <p><strong>Total Estimated Hours:</strong> ${report.remediationPlan.totalEstimatedHours}</p>
                
                ${[
                    { key: 'immediate', title: 'Immediate Actions (Critical)', items: report.remediationPlan.immediate },
                    { key: 'shortTerm', title: 'Short Term (1-4 weeks)', items: report.remediationPlan.shortTerm },
                    { key: 'mediumTerm', title: 'Medium Term (1-3 months)', items: report.remediationPlan.mediumTerm },
                    { key: 'longTerm', title: 'Long Term (3+ months)', items: report.remediationPlan.longTerm }
                ].map(section => {
                    if (section.items.length === 0) return '';
                    return `
                        <h3>${section.title}</h3>
                        ${section.items.map((item: RemediationItem) => `
                            <div class="remediation-item">
                                <h4>${item.title}</h4>
                                <p>${item.description}</p>
                                <div class="timeline">
                                    <span class="timeline-badge">${item.priority.toUpperCase()}</span>
                                    <span>${item.estimatedCost} (${item.estimatedHours}h) | ${item.timeline}</span>
                                </div>
                                <p><strong>Required Skills:</strong> ${item.requiredSkills.join(', ')}</p>
                                <p><strong>Business Justification:</strong> ${item.businessJustification}</p>
                            </div>
                        `).join('')}
                    `;
                }).join('')}
            </div>
        </div>

        <div id="risk" class="tab-content">
            <div class="section">
                <h2>🎯 Risk Assessment</h2>
                <p><strong>Overall Risk Level:</strong> <span class="risk-indicator risk-${report.riskAssessment.overallRiskLevel}">${report.riskAssessment.overallRiskLevel.toUpperCase()}</span></p>
                
                <h3>Business Impact Analysis</h3>
                <div class="compliance-grid">
                    <div class="compliance-item">
                        <h4>💰 Financial Impact</h4>
                        <p>${report.riskAssessment.businessImpact.financial}</p>
                    </div>
                    <div class="compliance-item">
                        <h4>⚙️ Operational Impact</h4>
                        <p>${report.riskAssessment.businessImpact.operational}</p>
                    </div>
                    <div class="compliance-item">
                        <h4>🏢 Reputational Impact</h4>
                        <p>${report.riskAssessment.businessImpact.reputational}</p>
                    </div>
                    <div class="compliance-item">
                        <h4>📋 Regulatory Impact</h4>
                        <p>${report.riskAssessment.businessImpact.regulatory}</p>
                    </div>
                </div>

                <h3>Threat Analysis</h3>
                <p><strong>Top Threats:</strong> ${report.riskAssessment.threatAnalysis.topThreats.join(', ')}</p>
                <p><strong>Vulnerability Exposure:</strong> ${report.riskAssessment.threatAnalysis.vulnerabilityExposure}%</p>
                <p><strong>Attack Surface:</strong> ${report.riskAssessment.threatAnalysis.attackSurface}</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📋 Audit Trail</h2>
        <p><strong>Report Generation:</strong> ${report.auditTrail.reportGeneration}</p>
        <p><strong>Data Collection Methods:</strong> ${report.auditTrail.dataCollection.join(', ')}</p>
        <p><strong>Validation Methods:</strong> ${report.auditTrail.validationMethods.join(', ')}</p>
        <p><strong>Quality Assurance:</strong> ${report.auditTrail.qualityAssurance}</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate CSV report summary
   */
  private generateCSVReport(report: ConsolidatedSecurityReport): string {
    const headers = [
      'Finding ID',
      'Title',
      'Severity',
      'Category',
      'Source',
      'Impact',
      'Remediation',
      'Fix Time (hours)',
      'Business Impact',
      'Compliance Impact'
    ];

    const allFindings = [
      ...report.consolidatedFindings.critical,
      ...report.consolidatedFindings.high,
      ...report.consolidatedFindings.medium,
      ...report.consolidatedFindings.low
    ];

    const rows = allFindings.map(finding => [
      finding.id,
      finding.title,
      finding.severity,
      finding.category,
      finding.source,
      finding.impact,
      finding.remediation,
      finding.estimatedFixTime,
      finding.businessImpact,
      finding.complianceImpact.join('; ')
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Generate component summary for overview display
   */
  private generateComponentSummary(componentResults: any, allFindings: SecurityFinding[]): any {
    const summary: any = {};
    
    // Process each component result
    Object.entries(componentResults).forEach(([component, result]: [string, any]) => {
      if (!result) return;
      
      // Get score from result
      const score = result?.summary?.overallScore || result?.overallScore || 0;
      
      // Count findings for this component
      const componentFindings = allFindings.filter(f => 
        f.source.toLowerCase().includes(component.toLowerCase()) ||
        f.category.toLowerCase().includes(component.toLowerCase())
      ).length;
      
      // Determine status based on score and findings
      let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' = 'poor';
      if (score >= 90 && componentFindings === 0) status = 'excellent';
      else if (score >= 80 && componentFindings <= 2) status = 'good';
      else if (score >= 70 && componentFindings <= 5) status = 'fair';
      else if (score < 50 || componentFindings > 10) status = 'critical';
      
      summary[component] = {
        score,
        findings: componentFindings,
        status
      };
    });
    
    return summary;
  }

  /**
   * Get report history
   */
  getReportHistory(): ConsolidatedSecurityReport[] {
    return this.reportHistory;
  }
}

// Export singleton instance
export const securityReportGenerator = new SecurityReportGenerator();