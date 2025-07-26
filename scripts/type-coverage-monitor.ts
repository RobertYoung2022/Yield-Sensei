#!/usr/bin/env tsx
/**
 * Automated type coverage monitoring script
 * Tracks type coverage metrics and sends alerts for significant changes
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface CoverageMetrics {
  timestamp: string;
  totalFiles: number;
  coveredFiles: number;
  coveragePercentage: number;
  uncoveredLines: number;
  uncoveredFiles: string[];
  fileBreakdown: Record<string, number>;
  trends: {
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
  };
}

interface CoverageAlert {
  type: 'improvement' | 'degradation' | 'threshold' | 'critical';
  message: string;
  oldValue: number;
  newValue: number;
  threshold?: number;
}

class TypeCoverageMonitor {
  private projectRoot: string;
  private metricsDir: string;
  private historyFile: string;
  private thresholds = {
    minimum: 85,
    warning: 80,
    critical: 75,
    dailyDropAlert: 2,
    weeklyDropAlert: 5
  };

  constructor() {
    this.projectRoot = process.cwd();
    this.metricsDir = join(this.projectRoot, 'reports', 'type-coverage');
    this.historyFile = join(this.metricsDir, 'coverage-history.json');
    
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  async monitor(): Promise<void> {
    console.log('📊 Starting type coverage monitoring...');

    const metrics = await this.collectMetrics();
    const alerts = await this.analyzeChanges(metrics);
    
    await this.saveMetrics(metrics);
    await this.generateReports(metrics);
    
    if (alerts.length > 0) {
      await this.handleAlerts(alerts);
    }

    this.printSummary(metrics, alerts);
  }

  private async collectMetrics(): Promise<CoverageMetrics> {
    console.log('📈 Collecting type coverage metrics...');

    const { coveragePercentage, totalFiles, coveredFiles, uncoveredLines } = await this.getBasicCoverage();
    const uncoveredFiles = await this.getUncoveredFiles();
    const fileBreakdown = await this.getFileBreakdown();
    const trends = await this.calculateTrends(coveragePercentage);

    return {
      timestamp: new Date().toISOString(),
      totalFiles,
      coveredFiles,
      coveragePercentage,
      uncoveredLines,
      uncoveredFiles,
      fileBreakdown,
      trends
    };
  }

  private async getBasicCoverage(): Promise<{
    coveragePercentage: number;
    totalFiles: number;
    coveredFiles: number;
    uncoveredLines: number;
  }> {
    try {
      const output = execSync('npx type-coverage --detail', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      // Parse the summary line
      const summaryMatch = output.match(/(\d+)\/(\d+)\s+(\d+\.?\d*)%/);
      if (!summaryMatch) {
        throw new Error('Could not parse type coverage output');
      }

      const coveredFiles = parseInt(summaryMatch[1]);
      const totalFiles = parseInt(summaryMatch[2]);
      const coveragePercentage = parseFloat(summaryMatch[3]);

      // Count uncovered lines
      const uncoveredLines = (output.match(/:\d+:\d+\s+error/g) || []).length;

      return {
        coveragePercentage,
        totalFiles,
        coveredFiles,
        uncoveredLines
      };
    } catch (error) {
      console.warn('⚠️ Could not get basic coverage metrics:', error);
      return {
        coveragePercentage: 0,
        totalFiles: 0,
        coveredFiles: 0,
        uncoveredLines: 0
      };
    }
  }

  private async getUncoveredFiles(): Promise<string[]> {
    try {
      const output = execSync('npx type-coverage --detail', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const files = new Set<string>();
      const lines = output.split('\n');
      
      for (const line of lines) {
        const fileMatch = line.match(/^(.+?):\d+:\d+\s+error/);
        if (fileMatch) {
          files.add(fileMatch[1]);
        }
      }

      return Array.from(files).sort();
    } catch {
      return [];
    }
  }

  private async getFileBreakdown(): Promise<Record<string, number>> {
    try {
      const output = execSync('npx type-coverage --detail', {
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const breakdown: Record<string, number> = {};
      const lines = output.split('\n');
      
      for (const line of lines) {
        const fileMatch = line.match(/^(.+?):\d+:\d+\s+error/);
        if (fileMatch) {
          const file = fileMatch[1];
          breakdown[file] = (breakdown[file] || 0) + 1;
        }
      }

      return breakdown;
    } catch {
      return {};
    }
  }

  private async calculateTrends(currentCoverage: number): Promise<{
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
  }> {
    const history = await this.loadHistory();
    
    if (history.length === 0) {
      return { dailyChange: 0, weeklyChange: 0, monthlyChange: 0 };
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const findClosest = (targetDate: Date) => {
      return history
        .filter(m => new Date(m.timestamp) <= targetDate)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    };

    const dailyBase = findClosest(oneDayAgo);
    const weeklyBase = findClosest(oneWeekAgo);
    const monthlyBase = findClosest(oneMonthAgo);

    return {
      dailyChange: dailyBase ? currentCoverage - dailyBase.coveragePercentage : 0,
      weeklyChange: weeklyBase ? currentCoverage - weeklyBase.coveragePercentage : 0,
      monthlyChange: monthlyBase ? currentCoverage - monthlyBase.coveragePercentage : 0
    };
  }

  private async analyzeChanges(metrics: CoverageMetrics): Promise<CoverageAlert[]> {
    const alerts: CoverageAlert[] = [];

    // Threshold alerts
    if (metrics.coveragePercentage < this.thresholds.critical) {
      alerts.push({
        type: 'critical',
        message: `Type coverage critically low: ${metrics.coveragePercentage.toFixed(1)}%`,
        oldValue: this.thresholds.critical,
        newValue: metrics.coveragePercentage,
        threshold: this.thresholds.critical
      });
    } else if (metrics.coveragePercentage < this.thresholds.warning) {
      alerts.push({
        type: 'threshold',
        message: `Type coverage below warning threshold: ${metrics.coveragePercentage.toFixed(1)}%`,
        oldValue: this.thresholds.warning,
        newValue: metrics.coveragePercentage,
        threshold: this.thresholds.warning
      });
    } else if (metrics.coveragePercentage < this.thresholds.minimum) {
      alerts.push({
        type: 'threshold',
        message: `Type coverage below target: ${metrics.coveragePercentage.toFixed(1)}%`,
        oldValue: this.thresholds.minimum,
        newValue: metrics.coveragePercentage,
        threshold: this.thresholds.minimum
      });
    }

    // Trend alerts
    if (metrics.trends.dailyChange < -this.thresholds.dailyDropAlert) {
      alerts.push({
        type: 'degradation',
        message: `Significant daily coverage drop: ${metrics.trends.dailyChange.toFixed(1)}%`,
        oldValue: metrics.coveragePercentage - metrics.trends.dailyChange,
        newValue: metrics.coveragePercentage
      });
    }

    if (metrics.trends.weeklyChange < -this.thresholds.weeklyDropAlert) {
      alerts.push({
        type: 'degradation',
        message: `Significant weekly coverage drop: ${metrics.trends.weeklyChange.toFixed(1)}%`,
        oldValue: metrics.coveragePercentage - metrics.trends.weeklyChange,
        newValue: metrics.coveragePercentage
      });
    }

    // Improvement alerts
    if (metrics.trends.dailyChange > 2) {
      alerts.push({
        type: 'improvement',
        message: `Great daily coverage improvement: +${metrics.trends.dailyChange.toFixed(1)}%`,
        oldValue: metrics.coveragePercentage - metrics.trends.dailyChange,
        newValue: metrics.coveragePercentage
      });
    }

    return alerts;
  }

  private async saveMetrics(metrics: CoverageMetrics): Promise<void> {
    const history = await this.loadHistory();
    history.push(metrics);

    // Keep only last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const filteredHistory = history.filter(m => 
      new Date(m.timestamp) >= ninetyDaysAgo
    );

    writeFileSync(this.historyFile, JSON.stringify(filteredHistory, null, 2));

    // Save current metrics
    const currentFile = join(this.metricsDir, 'current.json');
    writeFileSync(currentFile, JSON.stringify(metrics, null, 2));
  }

  private async loadHistory(): Promise<CoverageMetrics[]> {
    if (!existsSync(this.historyFile)) {
      return [];
    }

    try {
      const content = readFileSync(this.historyFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async generateReports(metrics: CoverageMetrics): Promise<void> {
    // Generate markdown report
    const reportContent = this.generateMarkdownReport(metrics);
    const reportFile = join(this.metricsDir, `coverage-report-${new Date().toISOString().split('T')[0]}.md`);
    writeFileSync(reportFile, reportContent);

    // Generate JSON report for programmatic access
    const jsonReport = {
      ...metrics,
      thresholds: this.thresholds,
      analysis: this.analyzeFileBreakdown(metrics.fileBreakdown)
    };
    
    const jsonFile = join(this.metricsDir, 'detailed-report.json');
    writeFileSync(jsonFile, JSON.stringify(jsonReport, null, 2));

    console.log(`📄 Reports generated: ${reportFile}`);
  }

  private generateMarkdownReport(metrics: CoverageMetrics): string {
    const date = new Date(metrics.timestamp).toLocaleDateString();
    
    return `# Type Coverage Report - ${date}

## Summary
- **Coverage**: ${metrics.coveragePercentage.toFixed(1)}%
- **Files**: ${metrics.coveredFiles}/${metrics.totalFiles}
- **Uncovered Lines**: ${metrics.uncoveredLines}

## Trends
- **Daily Change**: ${metrics.trends.dailyChange >= 0 ? '+' : ''}${metrics.trends.dailyChange.toFixed(1)}%
- **Weekly Change**: ${metrics.trends.weeklyChange >= 0 ? '+' : ''}${metrics.trends.weeklyChange.toFixed(1)}%
- **Monthly Change**: ${metrics.trends.monthlyChange >= 0 ? '+' : ''}${metrics.trends.monthlyChange.toFixed(1)}%

## Status
${metrics.coveragePercentage >= this.thresholds.minimum ? '✅' : '❌'} **Target**: ≥${this.thresholds.minimum}%
${metrics.coveragePercentage >= this.thresholds.warning ? '✅' : '⚠️'} **Warning**: ≥${this.thresholds.warning}%
${metrics.coveragePercentage >= this.thresholds.critical ? '✅' : '🚨'} **Critical**: ≥${this.thresholds.critical}%

## Files Needing Attention
${this.generateFileList(metrics.uncoveredFiles.slice(0, 10))}

## Most Problematic Files
${this.generateProblematicFilesList(metrics.fileBreakdown)}

---
*Generated by Type Coverage Monitor*
`;
  }

  private generateFileList(files: string[]): string {
    if (files.length === 0) {
      return '✅ All files have good type coverage!';
    }
    
    return files.map(file => `- \`${file}\``).join('\n');
  }

  private generateProblematicFilesList(breakdown: Record<string, number>): string {
    const sorted = Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    if (sorted.length === 0) {
      return '✅ No files with significant coverage issues!';
    }
    
    return sorted.map(([file, count]) => `- \`${file}\`: ${count} uncovered lines`).join('\n');
  }

  private analyzeFileBreakdown(breakdown: Record<string, number>): {
    totalProblematicFiles: number;
    worstOffenders: Array<{ file: string; issues: number }>;
    averageIssuesPerFile: number;
  } {
    const entries = Object.entries(breakdown);
    const totalIssues = entries.reduce((sum, [, count]) => sum + count, 0);
    
    return {
      totalProblematicFiles: entries.length,
      worstOffenders: entries
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([file, issues]) => ({ file, issues })),
      averageIssuesPerFile: entries.length > 0 ? totalIssues / entries.length : 0
    };
  }

  private async handleAlerts(alerts: CoverageAlert[]): Promise<void> {
    console.log(`🚨 ${alerts.length} alert(s) detected`);
    
    for (const alert of alerts) {
      console.log(`  ${this.getAlertIcon(alert.type)} ${alert.message}`);
    }

    // Save alerts for external processing
    const alertsFile = join(this.metricsDir, 'latest-alerts.json');
    writeFileSync(alertsFile, JSON.stringify(alerts, null, 2));

    // In a real implementation, you might send notifications here
    // await this.sendSlackNotification(alerts);
    // await this.sendEmailAlert(alerts);
  }

  private getAlertIcon(type: CoverageAlert['type']): string {
    switch (type) {
      case 'critical': return '🚨';
      case 'degradation': return '📉';
      case 'threshold': return '⚠️';
      case 'improvement': return '📈';
      default: return 'ℹ️';
    }
  }

  private printSummary(metrics: CoverageMetrics, alerts: CoverageAlert[]): void {
    console.log('\n📊 Type Coverage Summary');
    console.log('==========================');
    console.log(`Coverage: ${metrics.coveragePercentage.toFixed(1)}%`);
    console.log(`Files: ${metrics.coveredFiles}/${metrics.totalFiles}`);
    console.log(`Uncovered Lines: ${metrics.uncoveredLines}`);
    
    if (metrics.trends.dailyChange !== 0) {
      const trend = metrics.trends.dailyChange > 0 ? '📈' : '📉';
      console.log(`Daily Trend: ${trend} ${metrics.trends.dailyChange.toFixed(1)}%`);
    }

    if (alerts.length > 0) {
      console.log(`\n🚨 Alerts: ${alerts.length}`);
      alerts.forEach(alert => {
        console.log(`  ${this.getAlertIcon(alert.type)} ${alert.message}`);
      });
    } else {
      console.log('\n✅ No alerts - coverage is healthy!');
    }

    console.log(`\nReports: ${this.metricsDir}/`);
  }
}

// CLI interface
async function main() {
  const monitor = new TypeCoverageMonitor();
  await monitor.monitor();
}

if (require.main === module) {
  main().catch(console.error);
}

export { TypeCoverageMonitor };