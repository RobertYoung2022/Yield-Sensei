/**
 * Coverage Reporter
 * Unified test coverage reporting for TypeScript and Rust components
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

export interface CoverageReport {
  language: 'typescript' | 'rust';
  project: string;
  timestamp: string;
  summary: CoverageSummary;
  files: FileCoverage[];
}

export interface CoverageSummary {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface FileCoverage {
  file: string;
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
  uncoveredLines: number[];
}

export class CoverageReporter {
  private logger: Logger;
  private outputDir: string;

  constructor(outputDir: string = 'coverage') {
    this.outputDir = outputDir;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console()
      ],
    });
  }

  async generateTypeScriptCoverage(projectRoot: string): Promise<CoverageReport> {
    this.logger.info('Generating TypeScript coverage report...');

    const jestCoveragePath = join(projectRoot, 'coverage', 'coverage-final.json');
    
    if (!existsSync(jestCoveragePath)) {
      throw new Error('Jest coverage file not found. Run tests with --coverage first.');
    }

    const jestCoverage = JSON.parse(readFileSync(jestCoveragePath, 'utf8'));
    const files: FileCoverage[] = [];
    let totalLines = 0, coveredLines = 0;
    let totalFunctions = 0, coveredFunctions = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalStatements = 0, coveredStatements = 0;

    for (const [filePath, fileData] of Object.entries(jestCoverage) as any) {
      const relativePath = filePath.replace(projectRoot, '');
      
      const lines = this.calculateCoverage(fileData.s);
      const functions = this.calculateCoverage(fileData.f);
      const branches = this.calculateCoverage(fileData.b.flat());
      const statements = this.calculateCoverage(fileData.s);

      files.push({
        file: relativePath,
        lines,
        functions,
        branches,
        statements,
        uncoveredLines: this.getUncoveredLines(fileData.statementMap, fileData.s),
      });

      totalLines += lines.total;
      coveredLines += lines.covered;
      totalFunctions += functions.total;
      coveredFunctions += functions.covered;
      totalBranches += branches.total;
      coveredBranches += branches.covered;
      totalStatements += statements.total;
      coveredStatements += statements.covered;
    }

    const report: CoverageReport = {
      language: 'typescript',
      project: 'YieldSensei',
      timestamp: new Date().toISOString(),
      summary: {
        lines: this.createMetric(totalLines, coveredLines),
        functions: this.createMetric(totalFunctions, coveredFunctions),
        branches: this.createMetric(totalBranches, coveredBranches),
        statements: this.createMetric(totalStatements, coveredStatements),
      },
      files,
    };

    await this.saveReport(report, 'typescript-coverage.json');
    return report;
  }

  async generateRustCoverage(cargoProjectPath: string): Promise<CoverageReport> {
    this.logger.info('Generating Rust coverage report...');

    // For Rust, we'll use tarpaulin or llvm-cov
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const process = spawn('cargo', ['tarpaulin', '--out', 'Json'], {
        cwd: cargoProjectPath,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const tarpaulinOutput = JSON.parse(stdout);
            const report = this.parseTarpaulinOutput(tarpaulinOutput, cargoProjectPath);
            this.saveReport(report, 'rust-coverage.json');
            resolve(report);
          } catch (error) {
            reject(new Error(`Failed to parse tarpaulin output: ${error}`));
          }
        } else {
          reject(new Error(`Tarpaulin failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseTarpaulinOutput(tarpaulinData: any, projectPath: string): CoverageReport {
    const files: FileCoverage[] = [];
    let totalLines = 0, coveredLines = 0;

    for (const file of tarpaulinData.files || []) {
      const relativePath = file.path.replace(projectPath, '');
      const lines = file.lines || [];
      
      const lineTotal = lines.length;
      const lineCovered = lines.filter((line: any) => line.count > 0).length;

      files.push({
        file: relativePath,
        lines: this.createMetric(lineTotal, lineCovered),
        functions: this.createMetric(0, 0), // Tarpaulin doesn't provide function coverage
        branches: this.createMetric(0, 0),  // Tarpaulin doesn't provide branch coverage
        statements: this.createMetric(lineTotal, lineCovered),
        uncoveredLines: lines
          .filter((line: any) => line.count === 0)
          .map((line: any) => line.line_number),
      });

      totalLines += lineTotal;
      coveredLines += lineCovered;
    }

    return {
      language: 'rust',
      project: 'YieldSensei',
      timestamp: new Date().toISOString(),
      summary: {
        lines: this.createMetric(totalLines, coveredLines),
        functions: this.createMetric(0, 0),
        branches: this.createMetric(0, 0),
        statements: this.createMetric(totalLines, coveredLines),
      },
      files,
    };
  }

  private calculateCoverage(coverageData: Record<string, number> | number[]): CoverageMetric {
    const values = Array.isArray(coverageData) ? coverageData : Object.values(coverageData);
    const total = values.length;
    const covered = values.filter(v => v > 0).length;
    
    return this.createMetric(total, covered);
  }

  private createMetric(total: number, covered: number): CoverageMetric {
    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 0,
    };
  }

  private getUncoveredLines(statementMap: any, statements: Record<string, number>): number[] {
    const uncovered: number[] = [];
    
    for (const [statementId, count] of Object.entries(statements)) {
      if (count === 0 && statementMap[statementId]) {
        uncovered.push(statementMap[statementId].start.line);
      }
    }

    return Array.from(new Set(uncovered)).sort((a, b) => a - b);
  }

  async generateUnifiedReport(reports: CoverageReport[]): Promise<void> {
    this.logger.info('Generating unified coverage report...');

    const htmlReport = this.generateHtmlReport(reports);
    const csvReport = this.generateCsvReport(reports);
    const summary = this.generateSummaryReport(reports);

    await Promise.all([
      this.saveFile('unified-coverage.html', htmlReport),
      this.saveFile('unified-coverage.csv', csvReport),
      this.saveReport(summary, 'unified-coverage-summary.json'),
    ]);

    this.logger.info('Unified coverage report generated');
  }

  private generateHtmlReport(reports: CoverageReport[]): string {
    const timestamp = new Date().toLocaleString();
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>YieldSensei Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .project { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 5px; }
        .project-header { background: #e9e9e9; padding: 15px; font-weight: bold; }
        .metrics { display: flex; gap: 20px; padding: 15px; }
        .metric { text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .metric-label { color: #666; }
        .files { margin: 15px; }
        .file { padding: 10px; border-bottom: 1px solid #eee; }
        .high { color: #28a745; }
        .medium { color: #ffc107; }
        .low { color: #dc3545; }
    </style>
</head>
<body>
    <h1>YieldSensei Coverage Report</h1>
    <p>Generated: ${timestamp}</p>
`;

    for (const report of reports) {
      html += `
        <div class="project">
            <div class="project-header">${report.language.toUpperCase()} - ${report.project}</div>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value ${this.getCoverageClass(report.summary.lines.percentage)}">${report.summary.lines.percentage.toFixed(1)}%</div>
                    <div class="metric-label">Lines</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${this.getCoverageClass(report.summary.functions.percentage)}">${report.summary.functions.percentage.toFixed(1)}%</div>
                    <div class="metric-label">Functions</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${this.getCoverageClass(report.summary.branches.percentage)}">${report.summary.branches.percentage.toFixed(1)}%</div>
                    <div class="metric-label">Branches</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${this.getCoverageClass(report.summary.statements.percentage)}">${report.summary.statements.percentage.toFixed(1)}%</div>
                    <div class="metric-label">Statements</div>
                </div>
            </div>
        </div>
`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  private generateCsvReport(reports: CoverageReport[]): string {
    let csv = 'Language,Project,File,Lines%,Functions%,Branches%,Statements%\n';
    
    for (const report of reports) {
      for (const file of report.files) {
        csv += `${report.language},${report.project},${file.file},${file.lines.percentage.toFixed(2)},${file.functions.percentage.toFixed(2)},${file.branches.percentage.toFixed(2)},${file.statements.percentage.toFixed(2)}\n`;
      }
    }

    return csv;
  }

  private generateSummaryReport(reports: CoverageReport[]) {
    return {
      timestamp: new Date().toISOString(),
      projects: reports.map(r => ({
        language: r.language,
        project: r.project,
        summary: r.summary,
        fileCount: r.files.length,
      })),
      overall: this.calculateOverallCoverage(reports),
    };
  }

  private calculateOverallCoverage(reports: CoverageReport[]) {
    let totalLines = 0, coveredLines = 0;
    let totalFunctions = 0, coveredFunctions = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalStatements = 0, coveredStatements = 0;

    for (const report of reports) {
      totalLines += report.summary.lines.total;
      coveredLines += report.summary.lines.covered;
      totalFunctions += report.summary.functions.total;
      coveredFunctions += report.summary.functions.covered;
      totalBranches += report.summary.branches.total;
      coveredBranches += report.summary.branches.covered;
      totalStatements += report.summary.statements.total;
      coveredStatements += report.summary.statements.covered;
    }

    return {
      lines: this.createMetric(totalLines, coveredLines),
      functions: this.createMetric(totalFunctions, coveredFunctions),
      branches: this.createMetric(totalBranches, coveredBranches),
      statements: this.createMetric(totalStatements, coveredStatements),
    };
  }

  private getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 60) return 'medium';
    return 'low';
  }

  private async saveReport(report: any, filename: string): Promise<void> {
    await this.saveFile(filename, JSON.stringify(report, null, 2));
  }

  private async saveFile(filename: string, content: string): Promise<void> {
    const { mkdir } = await import('fs/promises');
    await mkdir(this.outputDir, { recursive: true });
    
    const filepath = join(this.outputDir, filename);
    writeFileSync(filepath, content, 'utf8');
    this.logger.info(`Saved ${filename} to ${filepath}`);
  }
}