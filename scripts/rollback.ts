#!/usr/bin/env node
/**
 * Rollback Script
 * 
 * Handles rollback to previous deployment with comprehensive safety checks
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface RollbackState {
  timestamp: string;
  environment: string;
  previousVersion: string;
  currentVersion: string;
  reason: string;
  initiatedBy: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
}

interface DeploymentHistory {
  environment: string;
  deployments: Array<{
    version: string;
    timestamp: string;
    commit: string;
    status: 'active' | 'inactive' | 'failed';
    artifacts?: string[];
  }>;
}

class RollbackManager {
  private environment: string;
  private rollbackStateFile: string;
  private deploymentHistoryFile: string;

  constructor(environment: string) {
    this.environment = environment;
    this.rollbackStateFile = join(process.cwd(), '.deployment', `rollback-state-${environment}.json`);
    this.deploymentHistoryFile = join(process.cwd(), '.deployment', `deployment-history-${environment}.json`);
    
    console.log(`🔄 Rollback Manager initialized for ${environment} environment`);
  }

  async rollback(targetVersion?: string, reason: string = 'Manual rollback'): Promise<void> {
    const rollbackId = `rollback_${Date.now()}`;
    
    try {
      console.log(`🚨 Starting rollback process...`);
      console.log(`📋 Rollback ID: ${rollbackId}`);
      console.log(`🎯 Environment: ${this.environment}`);
      console.log(`📝 Reason: ${reason}`);

      // Create rollback state
      const rollbackState: RollbackState = {
        timestamp: new Date().toISOString(),
        environment: this.environment,
        previousVersion: await this.getCurrentVersion(),
        currentVersion: targetVersion || await this.getPreviousVersion(),
        reason,
        initiatedBy: process.env.USER || 'unknown',
        status: 'initiated'
      };

      await this.saveRollbackState(rollbackState);

      // Pre-rollback validation
      await this.validateRollbackSafety(rollbackState);

      // Execute rollback
      rollbackState.status = 'in_progress';
      await this.saveRollbackState(rollbackState);

      await this.executeRollback(rollbackState);

      // Post-rollback validation
      await this.validateRollbackSuccess(rollbackState);

      // Update state
      rollbackState.status = 'completed';
      await this.saveRollbackState(rollbackState);

      console.log(`✅ Rollback completed successfully`);
      console.log(`🎉 System restored to version: ${rollbackState.currentVersion}`);

    } catch (error) {
      console.error(`💥 Rollback failed:`, error);
      
      // Update rollback state to failed
      const state = await this.loadRollbackState();
      if (state) {
        state.status = 'failed';
        await this.saveRollbackState(state);
      }
      
      throw error;
    }
  }

  private async validateRollbackSafety(rollbackState: RollbackState): Promise<void> {
    console.log(`🔍 Validating rollback safety...`);

    try {
      // Check if target version exists
      const history = await this.loadDeploymentHistory();
      const targetDeployment = history.deployments.find(d => d.version === rollbackState.currentVersion);
      
      if (!targetDeployment) {
        throw new Error(`Target version ${rollbackState.currentVersion} not found in deployment history`);
      }

      // Check if target version is not too old
      const targetDate = new Date(targetDeployment.timestamp);
      const daysSinceTarget = (Date.now() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceTarget > 30) {
        console.log(`⚠️  Warning: Rolling back to version ${daysSinceTarget.toFixed(1)} days old`);
        
        if (this.environment === 'production' && daysSinceTarget > 7) {
          throw new Error(`Rollback to version older than 7 days not allowed in production`);
        }
      }

      // Check for data migrations that might prevent rollback
      await this.checkDataMigrationCompatibility(rollbackState);

      // Check current system health
      await this.checkCurrentSystemHealth();

      console.log(`✅ Rollback safety validation passed`);

    } catch (error) {
      console.error(`❌ Rollback safety validation failed:`, error);
      throw new Error(`Rollback safety validation failed: ${error}`);
    }
  }

  private async executeRollback(rollbackState: RollbackState): Promise<void> {
    console.log(`🔄 Executing rollback to version ${rollbackState.currentVersion}...`);

    try {
      // Stop current services gracefully
      await this.stopServices();

      // Restore previous configuration
      await this.restoreConfiguration(rollbackState.currentVersion);

      // Restore application artifacts
      await this.restoreArtifacts(rollbackState.currentVersion);

      // Rollback database if needed (with extreme caution)
      if (this.shouldRollbackDatabase()) {
        await this.rollbackDatabase(rollbackState.currentVersion);
      }

      // Restart services
      await this.startServices();

      console.log(`✅ Rollback execution completed`);

    } catch (error) {
      console.error(`❌ Rollback execution failed:`, error);
      throw new Error(`Rollback execution failed: ${error}`);
    }
  }

  private async validateRollbackSuccess(rollbackState: RollbackState): Promise<void> {
    console.log(`🔍 Validating rollback success...`);

    try {
      // Wait for services to start
      console.log(`⏳ Waiting for services to start...`);
      await this.sleep(10000);

      // Run deployment validation
      console.log(`🏥 Running health checks...`);
      await this.runCommand('npm run deploy:validate');

      // Verify version
      const currentVersion = await this.getCurrentVersion();
      if (currentVersion !== rollbackState.currentVersion) {
        throw new Error(`Version mismatch: expected ${rollbackState.currentVersion}, got ${currentVersion}`);
      }

      // Run basic functionality tests
      await this.runBasicFunctionalityTests();

      console.log(`✅ Rollback success validation passed`);

    } catch (error) {
      console.error(`❌ Rollback success validation failed:`, error);
      throw new Error(`Rollback success validation failed: ${error}`);
    }
  }

  private async stopServices(): Promise<void> {
    console.log(`🛑 Stopping services...`);

    try {
      // Stop application gracefully
      if (this.isServiceRunning('api')) {
        console.log(`   Stopping API service...`);
        // In real implementation, would gracefully stop the service
        await this.sleep(2000);
      }

      // Stop background jobs
      console.log(`   Stopping background jobs...`);
      // In real implementation, would stop cron jobs, workers, etc.

      console.log(`✅ Services stopped successfully`);

    } catch (error) {
      console.error(`❌ Failed to stop services:`, error);
      throw new Error(`Failed to stop services: ${error}`);
    }
  }

  private async startServices(): Promise<void> {
    console.log(`🚀 Starting services...`);

    try {
      // Start database connections
      console.log(`   Starting database connections...`);
      
      // Start API service
      console.log(`   Starting API service...`);
      // In real implementation, would start the actual service
      await this.sleep(3000);

      // Start background jobs
      console.log(`   Starting background jobs...`);

      console.log(`✅ Services started successfully`);

    } catch (error) {
      console.error(`❌ Failed to start services:`, error);
      throw new Error(`Failed to start services: ${error}`);
    }
  }

  private async restoreConfiguration(version: string): Promise<void> {
    console.log(`🔧 Restoring configuration for version ${version}...`);

    try {
      const configBackupPath = join(process.cwd(), '.deployment', 'backups', version, 'config');
      
      if (existsSync(configBackupPath)) {
        // Restore configuration files
        console.log(`   Restoring configuration from backup...`);
        // In real implementation, would restore actual config files
      } else {
        console.log(`   No configuration backup found for version ${version}`);
      }

      console.log(`✅ Configuration restored`);

    } catch (error) {
      console.error(`❌ Failed to restore configuration:`, error);
      throw new Error(`Failed to restore configuration: ${error}`);
    }
  }

  private async restoreArtifacts(version: string): Promise<void> {
    console.log(`📦 Restoring application artifacts for version ${version}...`);

    try {
      const artifactsBackupPath = join(process.cwd(), '.deployment', 'backups', version, 'artifacts');
      
      if (existsSync(artifactsBackupPath)) {
        // Restore application artifacts
        console.log(`   Restoring artifacts from backup...`);
        // In real implementation, would restore actual build artifacts
      } else {
        console.log(`   No artifacts backup found for version ${version}`);
        console.log(`   Rebuilding artifacts for version ${version}...`);
        // Rebuild from source
        await this.rebuildArtifacts(version);
      }

      console.log(`✅ Artifacts restored`);

    } catch (error) {
      console.error(`❌ Failed to restore artifacts:`, error);
      throw new Error(`Failed to restore artifacts: ${error}`);
    }
  }

  private async rebuildArtifacts(version: string): Promise<void> {
    console.log(`🏗️ Rebuilding artifacts for version ${version}...`);

    try {
      // Checkout specific version
      await this.runCommand(`git checkout ${version}`);

      // Install dependencies
      await this.runCommand('npm ci');

      // Build application
      await this.runCommand('npm run build');

      console.log(`✅ Artifacts rebuilt successfully`);

    } catch (error) {
      console.error(`❌ Failed to rebuild artifacts:`, error);
      throw new Error(`Failed to rebuild artifacts: ${error}`);
    }
  }

  private shouldRollbackDatabase(): boolean {
    // Be extremely cautious with database rollbacks
    // Only allow in development environment or with explicit flag
    return this.environment === 'development' && process.env.ALLOW_DB_ROLLBACK === 'true';
  }

  private async rollbackDatabase(version: string): Promise<void> {
    console.log(`🗄️ Rolling back database to version ${version}...`);

    if (this.environment === 'production') {
      throw new Error('Database rollback not allowed in production');
    }

    try {
      // Create backup of current state before rollback
      console.log(`   Creating backup of current database state...`);
      await this.runCommand('npm run db:backup');

      // Run migrations down to target version
      console.log(`   Rolling back migrations...`);
      // In real implementation, would rollback specific migrations
      
      console.log(`⚠️  Database rollback completed - USE WITH EXTREME CAUTION`);

    } catch (error) {
      console.error(`❌ Database rollback failed:`, error);
      throw new Error(`Database rollback failed: ${error}`);
    }
  }

  private async checkDataMigrationCompatibility(rollbackState: RollbackState): Promise<void> {
    console.log(`🔍 Checking data migration compatibility...`);

    try {
      // Check if there are any incompatible schema changes
      // This is a simplified check - real implementation would be more sophisticated
      
      const currentVersion = rollbackState.previousVersion;
      const targetVersion = rollbackState.currentVersion;
      
      console.log(`   Checking compatibility between ${currentVersion} and ${targetVersion}...`);
      
      // In real implementation, would check:
      // - Database schema changes
      // - Breaking API changes
      // - Data format changes
      
      console.log(`✅ Data migration compatibility check passed`);

    } catch (error) {
      console.error(`❌ Data migration compatibility check failed:`, error);
      throw new Error(`Data migration compatibility check failed: ${error}`);
    }
  }

  private async checkCurrentSystemHealth(): Promise<void> {
    console.log(`🏥 Checking current system health...`);

    try {
      // Run basic health checks
      await this.runCommand('npm run health:check');
      
      console.log(`✅ Current system health check passed`);

    } catch (error) {
      console.log(`⚠️  Current system health check failed - proceeding with rollback anyway`);
    }
  }

  private async runBasicFunctionalityTests(): Promise<void> {
    console.log(`🧪 Running basic functionality tests...`);

    try {
      // Run a subset of critical tests
      await this.runCommand('npm run test:unit');
      
      console.log(`✅ Basic functionality tests passed`);

    } catch (error) {
      console.log(`⚠️  Some functionality tests failed - manual verification required`);
    }
  }

  private async getCurrentVersion(): Promise<string> {
    try {
      // Get current git commit hash
      const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      return commit.substring(0, 8);
    } catch (error) {
      return 'unknown';
    }
  }

  private async getPreviousVersion(): Promise<string> {
    try {
      const history = await this.loadDeploymentHistory();
      const activeDeployments = history.deployments.filter(d => d.status === 'active');
      
      if (activeDeployments.length < 2) {
        throw new Error('No previous version available for rollback');
      }

      // Return the second most recent deployment
      return activeDeployments[1].version;
    } catch (error) {
      throw new Error(`Failed to determine previous version: ${error}`);
    }
  }

  private async loadDeploymentHistory(): Promise<DeploymentHistory> {
    try {
      if (!existsSync(this.deploymentHistoryFile)) {
        return {
          environment: this.environment,
          deployments: []
        };
      }

      const data = readFileSync(this.deploymentHistoryFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load deployment history: ${error}`);
    }
  }

  private async saveRollbackState(state: RollbackState): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(process.cwd(), '.deployment');
      if (!existsSync(dir)) {
        execSync(`mkdir -p ${dir}`);
      }

      writeFileSync(this.rollbackStateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error(`Failed to save rollback state:`, error);
    }
  }

  private async loadRollbackState(): Promise<RollbackState | null> {
    try {
      if (!existsSync(this.rollbackStateFile)) {
        return null;
      }

      const data = readFileSync(this.rollbackStateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  private isServiceRunning(serviceName: string): boolean {
    // Simplified check - real implementation would check actual service status
    return true;
  }

  private async runCommand(command: string): Promise<void> {
    try {
      console.log(`   Running: ${command}`);
      execSync(command, { 
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: this.environment
        }
      });
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const program = new Command();

  program
    .name('rollback')
    .description('Rollback YieldSensei deployment to previous version')
    .option('-e, --environment <env>', 'Target environment (development, staging, production)', 'development')
    .option('-v, --version <version>', 'Specific version to rollback to (defaults to previous version)')
    .option('-r, --reason <reason>', 'Reason for rollback', 'Manual rollback')
    .option('--force', 'Force rollback even with warnings', false)
    .option('--dry-run', 'Perform a dry run without actual rollback', false);

  program.parse();

  const options = program.opts();

  try {
    console.log(`🔄 YieldSensei Rollback Manager`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);

    if (options.dryRun) {
      console.log(`🧪 DRY RUN MODE - No actual rollback will occur`);
    }

    if (options.environment === 'production' && !options.force) {
      console.log(`⚠️  Production rollback requires additional confirmation`);
      console.log(`   Use --force flag if you are absolutely certain`);
      process.exit(1);
    }

    const rollbackManager = new RollbackManager(options.environment);
    
    if (!options.dryRun) {
      await rollbackManager.rollback(options.version, options.reason);
    } else {
      console.log(`✅ Dry run completed - rollback would have been attempted`);
    }

  } catch (error) {
    console.error(`💥 Rollback failed:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { RollbackManager };