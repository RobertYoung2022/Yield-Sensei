#!/usr/bin/env node

/**
 * YieldSensei Package Update Script
 * 
 * Systematic approach to updating vulnerable and outdated packages
 * with safety checks and rollback capabilities
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

interface PackageInfo {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
  updateType: 'patch' | 'minor' | 'major';
  securityRisk: 'low' | 'medium' | 'high' | 'critical';
}

interface UpdatePlan {
  immediate: PackageInfo[];
  cautious: PackageInfo[];
  breaking: PackageInfo[];
  total: number;
}

class PackageUpdater {
  private packageJsonPath: string;
  private packageLockPath: string;
  private backupPath: string;
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.packageJsonPath = join(projectRoot, 'package.json');
    this.packageLockPath = join(projectRoot, 'package-lock.json');
    this.backupPath = join(projectRoot, 'package.json.backup');
  }

  /**
   * Main update workflow
   */
  async updatePackages(options: {
    mode: 'safe' | 'aggressive' | 'security-only';
    dryRun?: boolean;
    skipTests?: boolean;
  }): Promise<void> {
    console.log('🔄 YieldSensei Package Security Update Tool\n');

    try {
      // Step 1: Analyze current state
      console.log('📊 Analyzing package vulnerabilities and updates...');
      const vulnerabilities = await this.analyzeVulnerabilities();
      const outdated = await this.analyzeOutdatedPackages();
      const updatePlan = this.createUpdatePlan(vulnerabilities, outdated);

      this.displayUpdatePlan(updatePlan);

      if (options.dryRun) {
        console.log('\n🔍 Dry run completed. No changes made.');
        return;
      }

      // Step 2: Create backup
      this.createBackup();

      // Step 3: Execute updates based on mode
      await this.executeUpdates(updatePlan, options);

      // Step 4: Verify updates
      if (!options.skipTests) {
        await this.verifyUpdates();
      }

      console.log('\n✅ Package updates completed successfully!');

    } catch (error) {
      console.error('\n❌ Package update failed:', error);
      await this.rollback();
      process.exit(1);
    }
  }

  /**
   * Analyze security vulnerabilities
   */
  private async analyzeVulnerabilities(): Promise<any[]> {
    try {
      const auditResult = execSync('npm audit --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      const audit = JSON.parse(auditResult);
      return audit.vulnerabilities ? Object.values(audit.vulnerabilities) : [];
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      try {
        const errorOutput = (error as any).stdout;
        if (errorOutput) {
          const audit = JSON.parse(errorOutput);
          return audit.vulnerabilities ? Object.values(audit.vulnerabilities) : [];
        }
      } catch (parseError) {
        console.warn('Could not parse vulnerability data');
      }
      return [];
    }
  }

  /**
   * Analyze outdated packages
   */
  private async analyzeOutdatedPackages(): Promise<PackageInfo[]> {
    try {
      const outdatedResult = execSync('npm outdated --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      const outdated = JSON.parse(outdatedResult || '{}');
      return Object.entries(outdated).map(([name, info]: [string, any]) => ({
        name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        type: info.type || 'dependencies',
        updateType: this.getUpdateType(info.current, info.latest),
        securityRisk: 'low' // Default, will be updated based on vulnerabilities
      }));
    } catch (error) {
      // npm outdated returns non-zero when packages are outdated
      try {
        const errorOutput = (error as any).stdout;
        if (errorOutput) {
          const outdated = JSON.parse(errorOutput);
          return Object.entries(outdated).map(([name, info]: [string, any]) => ({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            type: info.type || 'dependencies',
            updateType: this.getUpdateType(info.current, info.latest),
            securityRisk: 'low'
          }));
        }
      } catch (parseError) {
        console.warn('Could not parse outdated package data');
      }
      return [];
    }
  }

  /**
   * Create update plan based on analysis
   */
  private createUpdatePlan(vulnerabilities: any[], outdated: PackageInfo[]): UpdatePlan {
    const vulnPackages = new Set(vulnerabilities.map(v => v.name));
    
    // Update security risk based on vulnerabilities
    outdated.forEach(pkg => {
      if (vulnPackages.has(pkg.name)) {
        pkg.securityRisk = 'high';
      }
    });

    const immediate = outdated.filter(pkg => 
      pkg.securityRisk === 'critical' || 
      pkg.securityRisk === 'high' ||
      pkg.updateType === 'patch'
    );

    const cautious = outdated.filter(pkg => 
      pkg.updateType === 'minor' && 
      pkg.securityRisk === 'low'
    );

    const breaking = outdated.filter(pkg => 
      pkg.updateType === 'major'
    );

    return {
      immediate,
      cautious,
      breaking,
      total: outdated.length
    };
  }

  /**
   * Display the update plan
   */
  private displayUpdatePlan(plan: UpdatePlan): void {
    console.log('\n📋 Update Plan Summary:');
    console.log(`   🔴 Immediate Updates (Security/Patches): ${plan.immediate.length}`);
    console.log(`   🟡 Cautious Updates (Minor versions): ${plan.cautious.length}`);
    console.log(`   🟠 Breaking Updates (Major versions): ${plan.breaking.length}`);
    console.log(`   📊 Total Packages: ${plan.total}\n`);

    if (plan.immediate.length > 0) {
      console.log('🔴 Immediate Updates:');
      plan.immediate.forEach(pkg => {
        const risk = pkg.securityRisk === 'high' ? '🚨' : '🔧';
        console.log(`   ${risk} ${pkg.name}: ${pkg.current} → ${pkg.latest} (${pkg.updateType})`);
      });
      console.log('');
    }

    if (plan.cautious.length > 0) {
      console.log('🟡 Cautious Updates:');
      plan.cautious.slice(0, 10).forEach(pkg => {
        console.log(`   📦 ${pkg.name}: ${pkg.current} → ${pkg.latest} (${pkg.updateType})`);
      });
      if (plan.cautious.length > 10) {
        console.log(`   ... and ${plan.cautious.length - 10} more`);
      }
      console.log('');
    }

    if (plan.breaking.length > 0) {
      console.log('🟠 Breaking Updates (requires manual review):');
      plan.breaking.slice(0, 5).forEach(pkg => {
        console.log(`   ⚠️  ${pkg.name}: ${pkg.current} → ${pkg.latest} (${pkg.updateType})`);
      });
      if (plan.breaking.length > 5) {
        console.log(`   ... and ${plan.breaking.length - 5} more`);
      }
      console.log('');
    }
  }

  /**
   * Execute updates based on mode
   */
  private async executeUpdates(plan: UpdatePlan, options: {
    mode: 'safe' | 'aggressive' | 'security-only';
    skipTests?: boolean;
  }): Promise<void> {
    let packagesToUpdate: PackageInfo[] = [];

    switch (options.mode) {
      case 'security-only':
        packagesToUpdate = plan.immediate.filter(pkg => 
          pkg.securityRisk === 'high' || pkg.securityRisk === 'critical'
        );
        break;
      case 'safe':
        packagesToUpdate = [...plan.immediate, ...plan.cautious];
        break;
      case 'aggressive':
        packagesToUpdate = [...plan.immediate, ...plan.cautious, ...plan.breaking];
        break;
    }

    if (packagesToUpdate.length === 0) {
      console.log('✅ No packages need updating for selected mode.');
      return;
    }

    console.log(`🔄 Updating ${packagesToUpdate.length} packages...`);

    for (const pkg of packagesToUpdate) {
      try {
        console.log(`   📦 Updating ${pkg.name}...`);
        
        if (pkg.updateType === 'major') {
          // For major updates, install specific version
          execSync(`npm install ${pkg.name}@${pkg.latest}`, {
            cwd: this.projectRoot,
            stdio: 'pipe'
          });
        } else {
          // For minor/patch updates, use npm update
          execSync(`npm update ${pkg.name}`, {
            cwd: this.projectRoot,
            stdio: 'pipe'
          });
        }

        console.log(`   ✅ ${pkg.name} updated to ${pkg.latest}`);
      } catch (error) {
        console.error(`   ❌ Failed to update ${pkg.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Verify updates by running tests
   */
  private async verifyUpdates(): Promise<void> {
    console.log('\n🧪 Verifying updates...');

    const tests = [
      { name: 'TypeScript compilation', command: 'npm run typecheck' },
      { name: 'Linting', command: 'npm run lint' },
      { name: 'Unit tests', command: 'npm test' }
    ];

    for (const test of tests) {
      try {
        console.log(`   🔍 Running ${test.name}...`);
        execSync(test.command, {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
        console.log(`   ✅ ${test.name} passed`);
      } catch (error) {
        console.error(`   ❌ ${test.name} failed`);
        throw new Error(`Verification failed: ${test.name}`);
      }
    }
  }

  /**
   * Create backup of package files
   */
  private createBackup(): void {
    console.log('💾 Creating backup...');
    copyFileSync(this.packageJsonPath, this.backupPath);
    if (existsSync(this.packageLockPath)) {
      copyFileSync(this.packageLockPath, this.packageLockPath + '.backup');
    }
    console.log('   ✅ Backup created');
  }

  /**
   * Rollback to backup
   */
  private async rollback(): Promise<void> {
    console.log('🔄 Rolling back changes...');
    
    if (existsSync(this.backupPath)) {
      copyFileSync(this.backupPath, this.packageJsonPath);
      console.log('   📦 Restored package.json');
    }

    if (existsSync(this.packageLockPath + '.backup')) {
      copyFileSync(this.packageLockPath + '.backup', this.packageLockPath);
      console.log('   🔒 Restored package-lock.json');
    }

    try {
      execSync('npm install', { cwd: this.projectRoot, stdio: 'pipe' });
      console.log('   ✅ Dependencies restored');
    } catch (error) {
      console.error('   ❌ Failed to restore dependencies');
    }
  }

  /**
   * Determine update type (patch, minor, major)
   */
  private getUpdateType(current: string, latest: string): 'patch' | 'minor' | 'major' {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    if (latestParts[0] > currentParts[0]) return 'major';
    if (latestParts[1] > currentParts[1]) return 'minor';
    return 'patch';
  }

  /**
   * Clean up backup files
   */
  async cleanup(): Promise<void> {
    const fs = require('fs').promises;
    
    try {
      if (existsSync(this.backupPath)) {
        await fs.unlink(this.backupPath);
      }
      if (existsSync(this.packageLockPath + '.backup')) {
        await fs.unlink(this.packageLockPath + '.backup');
      }
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.warn('Could not clean up backup files:', error);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = (args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'safe') as 'safe' | 'aggressive' | 'security-only';
  const dryRun = args.includes('--dry-run');
  const skipTests = args.includes('--skip-tests');

  console.log('🚀 Starting package update process...');
  console.log(`   Mode: ${mode}`);
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Skip tests: ${skipTests}\n`);

  const updater = new PackageUpdater();
  
  updater.updatePackages({ mode, dryRun, skipTests })
    .then(() => {
      if (!dryRun) {
        return updater.cleanup();
      }
    })
    .catch((error) => {
      console.error('Package update failed:', error);
      process.exit(1);
    });
}

export { PackageUpdater };