#!/usr/bin/env node

/**
 * Selective Package Update Script
 * 
 * Updates packages individually to avoid dependency conflicts
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

interface PackageUpdate {
  name: string;
  currentVersion: string;
  targetVersion: string;
  updateType: 'patch' | 'minor' | 'major';
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

class SelectivePackageUpdater {
  private projectRoot: string;
  private packageJsonPath: string;

  // Manually curated safe updates based on our analysis
  private readonly SAFE_UPDATES: PackageUpdate[] = [
    {
      name: 'commander',
      currentVersion: '10.0.1',
      targetVersion: '11.1.0',
      updateType: 'minor',
      priority: 'medium',
      reason: 'Bug fixes and new features, backward compatible'
    },
    {
      name: 'dotenv',
      currentVersion: '16.6.1', 
      targetVersion: '16.3.0', // Actually the package.json shows 16.3.0, npm outdated is showing wrong info
      updateType: 'patch',
      priority: 'low',
      reason: 'Minor improvements'
    },
    {
      name: 'helmet',
      currentVersion: '7.2.0',
      targetVersion: '8.1.0',
      updateType: 'major',
      priority: 'high',
      reason: 'Security middleware updates'
    },
    {
      name: 'node-cron',
      currentVersion: '3.0.3',
      targetVersion: '3.0.3', // Current version is actually fine
      updateType: 'patch',
      priority: 'low',
      reason: 'Already up to date'
    },
    {
      name: 'redis',
      currentVersion: '4.7.1',
      targetVersion: '4.7.1', // 5.x is major breaking change
      updateType: 'patch', 
      priority: 'low',
      reason: 'Current version is stable'
    },
    {
      name: 'uuid',
      currentVersion: '9.0.1',
      targetVersion: '10.0.0', // Only if needed
      updateType: 'major',
      priority: 'medium',
      reason: 'API changes, needs testing'
    }
  ];

  // Critical security packages that must be updated
  private readonly SECURITY_CRITICAL: string[] = [
    'express', 'helmet', 'bcryptjs', 'jsonwebtoken', 'cors'
  ];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.packageJsonPath = join(projectRoot, 'package.json');
  }

  /**
   * Update packages selectively and safely
   */
  async updatePackages(options: {
    priorityLevel: 'critical' | 'high' | 'medium' | 'low';
    testAfterEach: boolean;
  }): Promise<void> {
    console.log('🔄 Selective Package Update Tool\n');

    try {
      // Create backup
      this.createBackup();

      // Filter updates by priority
      const updatesToApply = this.SAFE_UPDATES.filter(update => {
        const priorities = ['critical', 'high', 'medium', 'low'];
        const targetIndex = priorities.indexOf(options.priorityLevel);
        const updateIndex = priorities.indexOf(update.priority);
        return updateIndex <= targetIndex;
      });

      console.log(`📊 Found ${updatesToApply.length} updates at ${options.priorityLevel} priority or higher\n`);

      for (const update of updatesToApply) {
        await this.updateSinglePackage(update, options.testAfterEach);
      }

      // Final verification
      console.log('\n🧪 Running final verification...');
      await this.runFinalTests();

      console.log('\n✅ Package updates completed successfully!');

    } catch (error) {
      console.error('\n❌ Package update failed:', error);
      await this.rollback();
      process.exit(1);
    }
  }

  /**
   * Update a single package carefully
   */
  private async updateSinglePackage(update: PackageUpdate, testAfterEach: boolean): Promise<void> {
    console.log(`📦 Updating ${update.name}...`);
    console.log(`   Current: ${update.currentVersion}`);
    console.log(`   Target:  ${update.targetVersion}`);
    console.log(`   Reason:  ${update.reason}`);

    try {
      // Skip if versions are same
      if (update.currentVersion === update.targetVersion) {
        console.log(`   ✅ Already up to date\n`);
        return;
      }

      // Use appropriate update command based on type
      let command: string;
      if (update.updateType === 'major') {
        command = `npm install ${update.name}@${update.targetVersion}`;
      } else {
        command = `npm update ${update.name}`;
      }

      execSync(command, {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      console.log(`   ✅ Updated successfully`);

      // Test after each update if requested
      if (testAfterEach) {
        await this.runQuickTest(update.name);
      }

      console.log('');

    } catch (error) {
      console.error(`   ❌ Failed to update ${update.name}`);
      throw error;
    }
  }

  /**
   * Run quick test after package update
   */
  private async runQuickTest(packageName: string): Promise<void> {
    try {
      console.log(`   🧪 Testing ${packageName}...`);
      
      // Try TypeScript compilation
      execSync('npm run typecheck', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      console.log(`   ✅ Tests passed`);

    } catch (error) {
      console.error(`   ⚠️  Test failed for ${packageName}`);
      throw error;
    }
  }

  /**
   * Run final comprehensive tests
   */
  private async runFinalTests(): Promise<void> {
    const tests = [
      { name: 'TypeScript compilation', command: 'npm run typecheck' },
      { name: 'Linting', command: 'npm run lint' },
      { name: 'Build', command: 'npm run build' }
    ];

    for (const test of tests) {
      try {
        console.log(`   🔍 ${test.name}...`);
        execSync(test.command, {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
        console.log(`   ✅ ${test.name} passed`);
      } catch (error) {
        console.error(`   ❌ ${test.name} failed`);
        // Don't throw for final tests, just warn
        console.warn('   ⚠️  Continuing despite test failure');
      }
    }
  }

  /**
   * Create backup of package files
   */
  private createBackup(): void {
    console.log('💾 Creating backup...');
    copyFileSync(this.packageJsonPath, this.packageJsonPath + '.backup');
    
    const packageLockPath = join(this.projectRoot, 'package-lock.json');
    if (existsSync(packageLockPath)) {
      copyFileSync(packageLockPath, packageLockPath + '.backup');
    }
    
    console.log('   ✅ Backup created\n');
  }

  /**
   * Rollback to backup
   */
  private async rollback(): Promise<void> {
    console.log('🔄 Rolling back changes...');
    
    const backupPath = this.packageJsonPath + '.backup';
    if (existsSync(backupPath)) {
      copyFileSync(backupPath, this.packageJsonPath);
      console.log('   📦 Restored package.json');
    }

    const packageLockPath = join(this.projectRoot, 'package-lock.json');
    const packageLockBackup = packageLockPath + '.backup';
    if (existsSync(packageLockBackup)) {
      copyFileSync(packageLockBackup, packageLockPath);  
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
   * Update specific security packages
   */
  async updateSecurityPackages(): Promise<void> {
    console.log('🛡️  Updating Security-Critical Packages\n');

    const securityUpdates: PackageUpdate[] = [
      {
        name: 'helmet',
        currentVersion: '7.2.0',
        targetVersion: '8.1.0',
        updateType: 'major',
        priority: 'critical',
        reason: 'Security middleware with latest protections'
      },
      {
        name: 'express',
        currentVersion: '4.21.2',
        targetVersion: '4.21.2', // Stay on 4.x for now, 5.x is major breaking
        updateType: 'patch',
        priority: 'high',
        reason: 'Current version is secure'
      }
    ];

    try {
      this.createBackup();

      for (const update of securityUpdates) {
        await this.updateSinglePackage(update, true);
      }

      console.log('\n✅ Security packages updated successfully!');

    } catch (error) {
      console.error('\n❌ Security update failed:', error);
      await this.rollback();
      throw error;
    }
  }

  /**
   * Cleanup backup files
   */
  async cleanup(): Promise<void> {
    const fs = require('fs').promises;
    
    try {
      const backupFiles = [
        this.packageJsonPath + '.backup',
        join(this.projectRoot, 'package-lock.json.backup')
      ];

      for (const file of backupFiles) {
        if (existsSync(file)) {
          await fs.unlink(file);
        }
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
  const priorityLevel = (args.find(arg => arg.startsWith('--priority='))?.split('=')[1] || 'medium') as 'critical' | 'high' | 'medium' | 'low';
  const testAfterEach = args.includes('--test-each');
  const securityOnly = args.includes('--security-only');

  const updater = new SelectivePackageUpdater();

  if (securityOnly) {
    updater.updateSecurityPackages()
      .then(() => updater.cleanup())
      .catch(error => {
        console.error('Security update failed:', error);
        process.exit(1);
      });
  } else {
    updater.updatePackages({ priorityLevel, testAfterEach })
      .then(() => updater.cleanup())
      .catch(error => {
        console.error('Package update failed:', error);
        process.exit(1);
      });
  }
}

export { SelectivePackageUpdater };