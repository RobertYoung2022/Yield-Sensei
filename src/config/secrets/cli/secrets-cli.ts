#!/usr/bin/env node

/**
 * Secrets Management CLI for CI/CD Integration
 * 
 * Command-line interface for managing secrets in CI/CD pipelines
 */

import { Command } from 'commander';
import { SecretManager, createDefaultSecretManagerConfig } from '../index';
import { CICDIntegration, CICDConfig, PipelineSecret } from '../cicd-integration';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CLIConfig {
  platform: string;
  environment: string;
  projectId: string;
  baseUrl?: string;
  configFile?: string;
  verbose: boolean;
}

class SecretsCLI {
  private config: CLIConfig;
  private secretManager: SecretManager;
  private cicdIntegration: CICDIntegration;

  constructor() {
    this.config = {
      platform: process.env.CICD_PLATFORM || 'github',
      environment: process.env.NODE_ENV || 'development',
      projectId: process.env.PROJECT_ID || '',
      baseUrl: process.env.CICD_BASE_URL,
      verbose: false
    };
  }

  async initialize(): Promise<void> {
    // Initialize secret manager
    const secretConfig = createDefaultSecretManagerConfig();
    this.secretManager = new SecretManager(secretConfig);
    await this.secretManager.initialize();

    // Initialize CI/CD integration
    const cicdConfig: CICDConfig = {
      platform: this.config.platform as any,
      environment: this.config.environment as any,
      projectId: this.config.projectId,
      baseUrl: this.config.baseUrl,
      apiToken: process.env.CICD_API_TOKEN || process.env.GITHUB_TOKEN || process.env.GITLAB_TOKEN,
      secretsScope: 'repository',
      encryptionEnabled: true,
      auditLogging: true
    };

    this.cicdIntegration = new CICDIntegration(cicdConfig, this.secretManager);
  }

  setupCommands(): Command {
    const program = new Command();

    program
      .name('secrets-cli')
      .description('YieldSensei Secrets Management CLI for CI/CD')
      .version('1.0.0')
      .option('-p, --platform <platform>', 'CI/CD platform (github, gitlab, jenkins, azure)', 'github')
      .option('-e, --environment <env>', 'Target environment', 'development')
      .option('--project-id <id>', 'Project ID')
      .option('--base-url <url>', 'Base URL for API')
      .option('-c, --config <file>', 'Configuration file path')
      .option('-v, --verbose', 'Verbose output', false)
      .hook('preAction', (thisCommand) => {
        const opts = thisCommand.opts();
        this.config = { ...this.config, ...opts };
        
        if (this.config.configFile && existsSync(this.config.configFile)) {
          const fileConfig = JSON.parse(readFileSync(this.config.configFile, 'utf8'));
          this.config = { ...this.config, ...fileConfig };
        }
      });

    // Sync command
    program
      .command('sync')
      .description('Sync secrets from vault to CI/CD platform')
      .option('--dry-run', 'Show what would be synced without actually syncing')
      .option('--force', 'Force sync even if secrets are up to date')
      .action(async (options) => {
        await this.initialize();
        await this.syncSecrets(options);
      });

    // Deploy command
    program
      .command('deploy')
      .description('Deploy specific secrets to CI/CD platform')
      .option('-f, --file <file>', 'Secrets configuration file')
      .option('--secrets <names>', 'Comma-separated list of secret names')
      .option('--exclude <names>', 'Comma-separated list of secrets to exclude')
      .action(async (options) => {
        await this.initialize();
        await this.deploySecrets(options);
      });

    // Rotate command
    program
      .command('rotate')
      .description('Rotate secrets and update CI/CD platform')
      .option('--secrets <names>', 'Comma-separated list of secret names to rotate')
      .option('--all', 'Rotate all secrets')
      .option('--dry-run', 'Show what would be rotated without actually rotating')
      .action(async (options) => {
        await this.initialize();
        await this.rotateSecrets(options);
      });

    // Validate command
    program
      .command('validate')
      .description('Validate CI/CD configuration and secrets')
      .option('--secrets-only', 'Validate only secrets, not CI/CD config')
      .option('--fix', 'Attempt to fix validation issues')
      .action(async (options) => {
        await this.initialize();
        await this.validateConfig(options);
      });

    // Audit command
    program
      .command('audit')
      .description('Generate audit report for secret deployments')
      .option('-o, --output <file>', 'Output file path', './secret-audit-report.json')
      .option('--format <format>', 'Output format (json, markdown)', 'json')
      .option('--days <days>', 'Number of days to include in report', '30')
      .action(async (options) => {
        await this.initialize();
        await this.generateAuditReport(options);
      });

    // Init command
    program
      .command('init')
      .description('Initialize CI/CD integration configuration')
      .option('--platform <platform>', 'CI/CD platform')
      .option('--interactive', 'Interactive configuration setup')
      .action(async (options) => {
        await this.initializeConfig(options);
      });

    // Status command
    program
      .command('status')
      .description('Show status of secrets and CI/CD integration')
      .action(async () => {
        await this.initialize();
        await this.showStatus();
      });

    return program;
  }

  private async syncSecrets(options: any): Promise<void> {
    this.log('🔄 Starting secret synchronization...');
    
    try {
      if (options.dryRun) {
        this.log('📋 DRY RUN - No changes will be made');
      }

      const result = await this.cicdIntegration.syncSecrets(
        this.config.environment,
        'system'
      );

      if (result.success) {
        this.log(`✅ Sync completed successfully:`);
        this.log(`   - Deployed: ${result.secretsDeployed}`);
        this.log(`   - Updated: ${result.secretsUpdated}`);
        this.log(`   - Skipped: ${result.secretsSkipped}`);
      } else {
        this.error('❌ Sync failed:');
        result.errors.forEach(error => this.error(`   - ${error}`));
        process.exit(1);
      }

    } catch (error) {
      this.error(`❌ Sync failed: ${error}`);
      process.exit(1);
    }
  }

  private async deploySecrets(options: any): Promise<void> {
    this.log('🚀 Starting secret deployment...');

    try {
      let secrets: PipelineSecret[] = [];

      if (options.file) {
        // Load secrets from file
        const secretsConfig = JSON.parse(readFileSync(options.file, 'utf8'));
        secrets = secretsConfig.secrets || [];
      } else if (options.secrets) {
        // Load specific secrets from vault
        const secretNames = options.secrets.split(',').map((s: string) => s.trim());
        const vaultManager = this.secretManager.getVaultManager();
        
        for (const name of secretNames) {
          const value = await vaultManager.getSecret(name, 'system');
          secrets.push({
            name,
            description: `Secret ${name}`,
            value,
            isEncrypted: true,
            scope: 'repository',
            environments: [this.config.environment]
          });
        }
      } else {
        this.error('❌ Either --file or --secrets must be specified');
        process.exit(1);
      }

      // Filter out excluded secrets
      if (options.exclude) {
        const excludeList = options.exclude.split(',').map((s: string) => s.trim());
        secrets = secrets.filter(s => !excludeList.includes(s.name));
      }

      const result = await this.cicdIntegration.deploySecrets(
        secrets,
        this.config.environment,
        'system'
      );

      if (result.success) {
        this.log(`✅ Deployment completed successfully:`);
        this.log(`   - Deployed: ${result.secretsDeployed}`);
        this.log(`   - Updated: ${result.secretsUpdated}`);
        this.log(`   - Deployment ID: ${result.deploymentId}`);
      } else {
        this.error('❌ Deployment failed:');
        result.errors.forEach(error => this.error(`   - ${error}`));
        process.exit(1);
      }

    } catch (error) {
      this.error(`❌ Deployment failed: ${error}`);
      process.exit(1);
    }
  }

  private async rotateSecrets(options: any): Promise<void> {
    this.log('🔄 Starting secret rotation...');

    try {
      let secretNames: string[] = [];

      if (options.all) {
        // Get all secrets from vault
        const vaultManager = this.secretManager.getVaultManager();
        const secrets = await vaultManager.listSecrets('system');
        secretNames = secrets.map(s => s.name);
      } else if (options.secrets) {
        secretNames = options.secrets.split(',').map((s: string) => s.trim());
      } else {
        this.error('❌ Either --all or --secrets must be specified');
        process.exit(1);
      }

      if (options.dryRun) {
        this.log('📋 DRY RUN - No changes will be made');
        this.log(`Would rotate ${secretNames.length} secrets:`);
        secretNames.forEach(name => this.log(`   - ${name}`));
        return;
      }

      const events = await this.cicdIntegration.rotateSecrets(
        secretNames,
        this.config.environment,
        'system'
      );

      const successful = events.filter(e => e.pipelineUpdated).length;
      const failed = events.length - successful;

      this.log(`✅ Rotation completed:`);
      this.log(`   - Successful: ${successful}`);
      this.log(`   - Failed: ${failed}`);

      if (failed > 0) {
        this.log('\n❌ Failed rotations:');
        events
          .filter(e => !e.pipelineUpdated)
          .forEach(e => this.log(`   - ${e.secretName}`));
      }

    } catch (error) {
      this.error(`❌ Rotation failed: ${error}`);
      process.exit(1);
    }
  }

  private async validateConfig(options: any): Promise<void> {
    this.log('🔍 Validating configuration...');

    try {
      // Validate CI/CD configuration
      const validation = await this.cicdIntegration.validatePipelineConfig();

      if (validation.valid) {
        this.log('✅ CI/CD configuration is valid');
      } else {
        this.error('❌ CI/CD configuration validation failed:');
        validation.errors.forEach(error => this.error(`   - ${error}`));
      }

      if (validation.warnings.length > 0) {
        this.log('⚠️ Configuration warnings:');
        validation.warnings.forEach(warning => this.log(`   - ${warning}`));
      }

      // Validate secrets if not secrets-only
      if (!options.secretsOnly) {
        const secretManager = this.secretManager;
        const healthCheck = await secretManager.healthCheck();

        if (healthCheck.status === 'healthy') {
          this.log('✅ Secret management system is healthy');
        } else {
          this.error(`❌ Secret management system status: ${healthCheck.status}`);
          
          Object.entries(healthCheck.checks).forEach(([component, check]) => {
            if (check.status === 'fail') {
              this.error(`   - ${component}: ${check.message}`);
            }
          });
        }
      }

      if (!validation.valid || (options.secretsOnly && validation.errors.length > 0)) {
        process.exit(1);
      }

    } catch (error) {
      this.error(`❌ Validation failed: ${error}`);
      process.exit(1);
    }
  }

  private async generateAuditReport(options: any): Promise<void> {
    this.log('📊 Generating audit report...');

    try {
      const deploymentReport = this.cicdIntegration.generateDeploymentReport();
      const systemReport = await this.secretManager.generateSystemReport();

      const auditReport = {
        generatedAt: new Date().toISOString(),
        platform: this.config.platform,
        environment: this.config.environment,
        projectId: this.config.projectId,
        deploymentReport,
        systemReport,
        summary: {
          totalDeployments: this.cicdIntegration.getDeploymentHistory().length,
          platform: this.config.platform,
          environment: this.config.environment
        }
      };

      let output: string;
      
      if (options.format === 'markdown') {
        output = this.formatReportAsMarkdown(auditReport);
      } else {
        output = JSON.stringify(auditReport, null, 2);
      }

      writeFileSync(options.output, output);
      this.log(`✅ Audit report saved to: ${options.output}`);

    } catch (error) {
      this.error(`❌ Failed to generate audit report: ${error}`);
      process.exit(1);
    }
  }

  private async initializeConfig(options: any): Promise<void> {
    this.log('🔧 Initializing CI/CD integration configuration...');

    const configPath = join(process.cwd(), '.secrets-config.json');
    
    const config = {
      platform: options.platform || 'github',
      projectId: this.config.projectId,
      environments: ['development', 'staging', 'production'],
      encryptionEnabled: true,
      auditLogging: true,
      secrets: {
        // Example secret configurations
        JWT_SECRET: {
          description: 'JWT signing secret',
          environments: ['production', 'staging'],
          rotationPolicy: {
            enabled: true,
            intervalDays: 90
          }
        },
        DATABASE_PASSWORD: {
          description: 'Database connection password',
          environments: ['production', 'staging'],
          rotationPolicy: {
            enabled: true,
            intervalDays: 60
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    this.log(`✅ Configuration initialized: ${configPath}`);

    // Generate pipeline files
    const pipelineDir = join(process.cwd(), '.cicd');
    await this.cicdIntegration.generatePipelineFiles(pipelineDir);
    this.log(`✅ Pipeline files generated: ${pipelineDir}`);
  }

  private async showStatus(): Promise<void> {
    this.log('📊 CI/CD Secrets Status\n');

    try {
      // Show CI/CD configuration
      this.log(`Platform: ${this.config.platform}`);
      this.log(`Environment: ${this.config.environment}`);
      this.log(`Project: ${this.config.projectId}`);
      
      // Show validation status
      const validation = await this.cicdIntegration.validatePipelineConfig();
      this.log(`Configuration: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);

      // Show secret manager status
      const health = await this.secretManager.healthCheck();
      this.log(`Secret Manager: ${health.status === 'healthy' ? '✅ Healthy' : `❌ ${health.status}`}`);

      // Show deployment history summary
      const deployments = this.cicdIntegration.getDeploymentHistory();
      this.log(`Total Deployments: ${deployments.length}`);

      if (deployments.length > 0) {
        const latest = deployments[deployments.length - 1];
        this.log(`Latest Deployment: ${latest.deployedAt.toISOString()}`);
      }

      this.log('\n📈 Recent Activity:');
      const recent = deployments.slice(-5).reverse();
      
      if (recent.length === 0) {
        this.log('   No recent deployments');
      } else {
        recent.forEach(deployment => {
          this.log(`   - ${deployment.name} (${deployment.environment}) - ${deployment.deployedAt.toLocaleString()}`);
        });
      }

    } catch (error) {
      this.error(`❌ Failed to get status: ${error}`);
      process.exit(1);
    }
  }

  private formatReportAsMarkdown(report: any): string {
    let markdown = `# Secret Management Audit Report\n\n`;
    markdown += `**Generated:** ${report.generatedAt}\n`;
    markdown += `**Platform:** ${report.platform}\n`;
    markdown += `**Environment:** ${report.environment}\n`;
    markdown += `**Project:** ${report.projectId}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- Total Deployments: ${report.summary.totalDeployments}\n`;
    markdown += `- Platform: ${report.summary.platform}\n`;
    markdown += `- Environment: ${report.summary.environment}\n\n`;
    
    markdown += `## Deployment Report\n\n`;
    markdown += report.deploymentReport + '\n\n';
    
    markdown += `## System Report\n\n`;
    markdown += report.systemReport;
    
    return markdown;
  }

  private log(message: string): void {
    if (this.config.verbose || !process.env.CI) {
      console.log(message);
    }
  }

  private error(message: string): void {
    console.error(message);
  }
}

// CLI execution
async function main() {
  const cli = new SecretsCLI();
  const program = cli.setupCommands();
  
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SecretsCLI };