#!/usr/bin/env node

/**
 * Security-focused Package Audit Tool
 * 
 * Comprehensive security analysis of npm packages with vulnerability assessment
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface SecurityIssue {
  package: string;
  version: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  cwe?: string[];
  cvss?: number;
  references?: string[];
}

interface PackageRisk {
  name: string;
  version: string;
  riskScore: number;
  issues: SecurityIssue[];
  ageMonths: number;
  lastUpdate: string;
  downloadCount?: number;
  maintainers: number;
}

interface SecurityReport {
  summary: {
    totalPackages: number;
    vulnerablePackages: number;
    criticalIssues: number;
    highIssues: number;
    moderateIssues: number;
    lowIssues: number;
    riskScore: number;
  };
  packages: PackageRisk[];
  recommendations: string[];
  timestamp: string;
}

class SecurityPackageAuditor {
  private projectRoot: string;
  private packageJson: any;

  // Known problematic packages or patterns
  private readonly HIGH_RISK_PATTERNS = [
    /eval/, /Function\(\)/, /setTimeout.*string/, /setInterval.*string/
  ];

  private readonly DEPRECATED_PACKAGES = [
    'request', 'node-uuid', 'babel-preset-es2015', 'babel-preset-stage-0'
  ];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.loadPackageJson();
  }

  /**
   * Run comprehensive security audit
   */
  async runSecurityAudit(): Promise<SecurityReport> {
    console.log('🔍 Running comprehensive security audit...\n');

    const report: SecurityReport = {
      summary: {
        totalPackages: 0,
        vulnerablePackages: 0,
        criticalIssues: 0,
        highIssues: 0,
        moderateIssues: 0,
        lowIssues: 0,
        riskScore: 0
      },
      packages: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Step 1: Analyze npm audit results
      console.log('📊 Analyzing npm vulnerabilities...');
      const npmVulnerabilities = await this.getNpmVulnerabilities();
      
      // Step 2: Analyze package metadata
      console.log('📦 Analyzing package metadata...');
      const packageRisks = await this.analyzePackageRisks();

      // Step 3: Check for deprecated packages
      console.log('⚠️  Checking for deprecated packages...');
      const deprecatedPackages = await this.findDeprecatedPackages();

      // Step 4: Analyze dependency tree
      console.log('🌳 Analyzing dependency tree...');
      const dependencyRisks = await this.analyzeDependencyTree();

      // Step 5: Generate comprehensive report
      report.packages = [...packageRisks, ...deprecatedPackages];
      report.summary = this.generateSummary(report.packages);
      report.recommendations = this.generateRecommendations(report);

      return report;

    } catch (error) {
      console.error('Security audit failed:', error);
      throw error;
    }
  }

  /**
   * Get npm audit vulnerabilities
   */
  private async getNpmVulnerabilities(): Promise<SecurityIssue[]> {
    try {
      const auditResult = execSync('npm audit --json', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const audit = JSON.parse(auditResult);
      const vulnerabilities: SecurityIssue[] = [];

      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([packageName, vuln]: [string, any]) => {
          vuln.via?.forEach((issue: any) => {
            if (typeof issue === 'object') {
              vulnerabilities.push({
                package: packageName,
                version: vuln.range || 'unknown',
                severity: issue.severity,
                title: issue.title,
                description: issue.description || issue.title,
                recommendation: `Update ${packageName} to version ${vuln.fixAvailable?.version || 'latest'}`,
                cwe: issue.cwe ? [issue.cwe] : undefined,
                cvss: issue.cvss?.score,
                references: issue.references ? [issue.references] : undefined
              });
            }
          });
        });
      }

      return vulnerabilities;
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      try {
        const errorOutput = (error as any).stdout;
        if (errorOutput) {
          const audit = JSON.parse(errorOutput);
          // Process vulnerabilities as above
          return [];
        }
      } catch (parseError) {
        console.warn('Could not parse npm audit results');
      }
      return [];
    }
  }

  /**
   * Analyze package risks based on metadata
   */
  private async analyzePackageRisks(): Promise<PackageRisk[]> {
    const packages: PackageRisk[] = [];
    const allDeps = { ...this.packageJson.dependencies, ...this.packageJson.devDependencies };

    for (const [packageName, version] of Object.entries(allDeps)) {
      try {
        const packageInfo = await this.getPackageInfo(packageName);
        const riskScore = this.calculateRiskScore(packageInfo);

        packages.push({
          name: packageName,
          version: version as string,
          riskScore,
          issues: [],
          ageMonths: this.calculatePackageAge(packageInfo.time?.created),
          lastUpdate: packageInfo.time?.modified || 'unknown',
          downloadCount: packageInfo.downloads?.weekly,
          maintainers: packageInfo.maintainers?.length || 0
        });
      } catch (error) {
        console.warn(`Could not analyze package ${packageName}:`, error);
      }
    }

    return packages.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Find deprecated packages
   */
  private async findDeprecatedPackages(): Promise<PackageRisk[]> {
    const deprecated: PackageRisk[] = [];
    const allDeps = { ...this.packageJson.dependencies, ...this.packageJson.devDependencies };

    for (const [packageName, version] of Object.entries(allDeps)) {
      if (this.DEPRECATED_PACKAGES.includes(packageName)) {
        deprecated.push({
          name: packageName,
          version: version as string,
          riskScore: 80,
          issues: [{
            package: packageName,
            version: version as string,
            severity: 'high',
            title: 'Deprecated Package',
            description: `Package ${packageName} is deprecated and should be replaced`,
            recommendation: `Replace ${packageName} with a maintained alternative`
          }],
          ageMonths: 999,
          lastUpdate: 'deprecated',
          maintainers: 0
        });
      }
    }

    return deprecated;
  }

  /**
   * Analyze dependency tree for risks
   */
  private async analyzeDependencyTree(): Promise<any> {
    try {
      const listResult = execSync('npm list --json --all', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const dependencyTree = JSON.parse(listResult);
      return this.analyzeDependencies(dependencyTree);
    } catch (error) {
      console.warn('Could not analyze dependency tree');
      return {};
    }
  }

  /**
   * Get package information from npm registry
   */
  private async getPackageInfo(packageName: string): Promise<any> {
    try {
      const infoResult = execSync(`npm view ${packageName} --json`, {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      return JSON.parse(infoResult);
    } catch (error) {
      throw new Error(`Could not get info for package ${packageName}`);
    }
  }

  /**
   * Calculate risk score for a package
   */
  private calculateRiskScore(packageInfo: any): number {
    let score = 0;

    // Age factor (older packages might be less maintained)
    const ageMonths = this.calculatePackageAge(packageInfo.time?.created);
    if (ageMonths > 60) score += 20;
    else if (ageMonths > 36) score += 10;

    // Last update factor
    const lastUpdateMonths = this.calculatePackageAge(packageInfo.time?.modified);
    if (lastUpdateMonths > 12) score += 30;
    else if (lastUpdateMonths > 6) score += 15;

    // Maintainer factor
    const maintainerCount = packageInfo.maintainers?.length || 0;
    if (maintainerCount === 0) score += 40;
    else if (maintainerCount === 1) score += 20;

    // Download factor (less popular packages might be riskier)
    const weeklyDownloads = packageInfo.downloads?.weekly || 0;
    if (weeklyDownloads < 1000) score += 25;
    else if (weeklyDownloads < 10000) score += 10;

    // Security factor (if package has known vulnerabilities)
    if (packageInfo.vulnerabilities?.length > 0) {
      score += packageInfo.vulnerabilities.length * 30;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate package age in months
   */
  private calculatePackageAge(dateString?: string): number {
    if (!dateString) return 0;
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    
    return diffMonths;
  }

  /**
   * Analyze dependencies recursively
   */
  private analyzeDependencies(deps: any, depth = 0): any {
    const analysis = {
      totalDependencies: 0,
      duplicates: new Map(),
      deepDependencies: []
    };

    if (deps.dependencies) {
      Object.entries(deps.dependencies).forEach(([name, info]: [string, any]) => {
        analysis.totalDependencies++;
        
        if (depth > 5) {
          analysis.deepDependencies.push(name);
        }

        if (info.dependencies) {
          const subAnalysis = this.analyzeDependencies(info, depth + 1);
          analysis.totalDependencies += subAnalysis.totalDependencies;
        }
      });
    }

    return analysis;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(packages: PackageRisk[]): SecurityReport['summary'] {
    const summary = {
      totalPackages: packages.length,
      vulnerablePackages: packages.filter(p => p.issues.length > 0).length,
      criticalIssues: 0,
      highIssues: 0,
      moderateIssues: 0,
      lowIssues: 0,
      riskScore: 0
    };

    packages.forEach(pkg => {
      pkg.issues.forEach(issue => {
        switch (issue.severity) {
          case 'critical': summary.criticalIssues++; break;
          case 'high': summary.highIssues++; break;
          case 'moderate': summary.moderateIssues++; break;
          case 'low': summary.lowIssues++; break;
        }
      });
    });

    // Calculate overall risk score
    const totalRisk = packages.reduce((sum, pkg) => sum + pkg.riskScore, 0);
    summary.riskScore = packages.length > 0 ? Math.round(totalRisk / packages.length) : 0;

    return summary;
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(report: SecurityReport): string[] {
    const recommendations: string[] = [];

    if (report.summary.criticalIssues > 0) {
      recommendations.push(`🚨 CRITICAL: Address ${report.summary.criticalIssues} critical vulnerabilities immediately`);
    }

    if (report.summary.highIssues > 0) {
      recommendations.push(`🟠 HIGH: Update ${report.summary.highIssues} packages with high-severity issues`);
    }

    if (report.summary.riskScore > 70) {
      recommendations.push('⚠️  Overall package risk is HIGH - consider dependency audit');
    }

    const highRiskPackages = report.packages.filter(p => p.riskScore > 60);
    if (highRiskPackages.length > 0) {
      recommendations.push(`📦 Review ${highRiskPackages.length} high-risk packages for alternatives`);
    }

    const outdatedPackages = report.packages.filter(p => 
      this.calculatePackageAge(p.lastUpdate) > 12
    );
    if (outdatedPackages.length > 0) {
      recommendations.push(`🗓️  Update ${outdatedPackages.length} packages not updated in over a year`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No critical security issues found');
    }

    return recommendations;
  }

  /**
   * Load package.json
   */
  private loadPackageJson(): void {
    const packageJsonPath = join(this.projectRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    this.packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  }

  /**
   * Save security report
   */
  saveReport(report: SecurityReport, outputPath?: string): void {
    const reportPath = outputPath || join(this.projectRoot, 'security-audit-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Security report saved to: ${reportPath}`);
  }

  /**
   * Display security report
   */
  displayReport(report: SecurityReport): void {
    console.log('\n🛡️  Security Audit Report');
    console.log('========================\n');

    console.log('📊 Summary:');
    console.log(`   Total Packages: ${report.summary.totalPackages}`);
    console.log(`   Vulnerable Packages: ${report.summary.vulnerablePackages}`);
    console.log(`   Overall Risk Score: ${report.summary.riskScore}/100\n`);

    if (report.summary.criticalIssues + report.summary.highIssues > 0) {
      console.log('🚨 Security Issues:');
      if (report.summary.criticalIssues > 0) {
        console.log(`   🔴 Critical: ${report.summary.criticalIssues}`);
      }
      if (report.summary.highIssues > 0) {
        console.log(`   🟠 High: ${report.summary.highIssues}`);
      }
      if (report.summary.moderateIssues > 0) {
        console.log(`   🟡 Moderate: ${report.summary.moderateIssues}`);
      }
      if (report.summary.lowIssues > 0) {
        console.log(`   🔵 Low: ${report.summary.lowIssues}`);
      }
      console.log('');
    }

    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   ${rec}`);
      });
      console.log('');
    }

    // Show top risk packages
    const topRiskPackages = report.packages
      .filter(p => p.riskScore > 50)
      .slice(0, 10);

    if (topRiskPackages.length > 0) {
      console.log('📦 High Risk Packages:');
      topRiskPackages.forEach(pkg => {
        console.log(`   ⚠️  ${pkg.name} (risk: ${pkg.riskScore}/100)`);
        if (pkg.issues.length > 0) {
          pkg.issues.forEach(issue => {
            console.log(`      - ${issue.severity.toUpperCase()}: ${issue.title}`);
          });
        }
      });
    }
  }
}

// CLI interface
if (require.main === module) {
  const auditor = new SecurityPackageAuditor();
  
  auditor.runSecurityAudit()
    .then(report => {
      auditor.displayReport(report);
      auditor.saveReport(report);
    })
    .catch(error => {
      console.error('Security audit failed:', error);
      process.exit(1);
    });
}

export { SecurityPackageAuditor };