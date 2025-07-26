/**
 * CI/CD Pipeline Integration for Secret Management
 * 
 * Provides secure integration between the secret management system and
 * various CI/CD platforms including GitHub Actions, GitLab CI, Jenkins,
 * and Azure DevOps.
 */

import { SecretManager } from './index';
import { KeyManager } from './key-manager';
import { VaultManager } from './vault-manager';
import { AccessControlManager } from './access-control';
import { createHash, randomBytes } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
// Removed unused imports: KeySpec, readFileSync, existsSync
import { join } from 'path';

export interface CICDConfig {
  platform: 'github' | 'gitlab' | 'jenkins' | 'azure' | 'custom';
  environment: 'development' | 'staging' | 'production';
  projectId: string;
  baseUrl?: string;
  apiToken?: string;
  secretsScope: 'repository' | 'organization' | 'environment';
  encryptionEnabled: boolean;
  auditLogging: boolean;
}

export interface SecretDeployment {
  id: string;
  name: string;
  value: string;
  scope: 'repository' | 'organization' | 'environment';
  environment?: string;
  expiresAt?: Date;
  metadata: Record<string, any>;
  deployedAt: Date;
  deployedBy: string;
}

export interface PipelineSecret {
  name: string;
  description: string;
  value: string;
  isEncrypted: boolean;
  scope: 'environment' | 'repository' | 'organization';
  environments: string[];
  rotationPolicy?: {
    enabled: boolean;
    intervalDays: number;
  };
}

export interface DeploymentResult {
  success: boolean;
  secretsDeployed: number;
  secretsUpdated: number;
  secretsSkipped: number;
  errors: string[];
  deploymentId: string;
  timestamp: Date;
}

export interface RotationEvent {
  secretName: string;
  oldValue: string;
  newValue: string;
  environment: string;
  rotatedAt: Date;
  rotatedBy: string;
  pipelineUpdated: boolean;
}

export class CICDIntegration {
  private config: CICDConfig;
  private keyManager: KeyManager;
  private vaultManager: VaultManager;
  private accessControl: AccessControlManager;
  private deploymentHistory: SecretDeployment[] = [];

  constructor(config: CICDConfig, secretManager: SecretManager) {
    this.config = config;
    this.keyManager = secretManager.getKeyManager();
    this.vaultManager = secretManager.getVaultManager();
    this.accessControl = secretManager.getAccessControlManager();
  }

  /**
   * Deploy secrets to CI/CD platform
   */
  async deploySecrets(
    secrets: PipelineSecret[],
    targetEnvironment: string,
    userId: string
  ): Promise<DeploymentResult> {
    console.log(`🚀 Deploying ${secrets.length} secrets to ${this.config.platform} (${targetEnvironment})`);

    const result: DeploymentResult = {
      success: false,
      secretsDeployed: 0,
      secretsUpdated: 0,
      secretsSkipped: 0,
      errors: [],
      deploymentId: this.generateDeploymentId(),
      timestamp: new Date()
    };

    try {
      // Verify user permissions
      const permission = this.accessControl.checkPermission(userId, 'secret', 'write');
      if (!permission.granted) {
        result.errors.push(`Access denied: ${permission.reason}`);
        return result;
      }

      // Validate secrets before deployment
      const validationResult = await this.validateSecrets(secrets);
      if (!validationResult.valid) {
        result.errors.push(...validationResult.errors);
        return result;
      }

      // Deploy secrets based on platform
      switch (this.config.platform) {
        case 'github':
          await this.deployToGitHub(secrets, targetEnvironment, result);
          break;
        case 'gitlab':
          await this.deployToGitLab(secrets, targetEnvironment, result);
          break;
        case 'jenkins':
          await this.deployToJenkins(secrets, targetEnvironment, result);
          break;
        case 'azure':
          await this.deployToAzure(secrets, targetEnvironment, result);
          break;
        default:
          await this.deployToCustomPlatform(secrets, targetEnvironment, result);
      }

      // Record deployment history
      for (const secret of secrets) {
        const deployment: SecretDeployment = {
          id: this.generateSecretId(),
          name: secret.name,
          value: this.config.encryptionEnabled ? this.encryptValue(secret.value) : secret.value,
          scope: secret.scope,
          metadata: {
            deploymentId: result.deploymentId,
            platform: this.config.platform,
            encrypted: this.config.encryptionEnabled
          },
          deployedAt: new Date(),
          deployedBy: userId
        };
        
        if (targetEnvironment) {
          deployment.environment = targetEnvironment;
        }
        
        if (secret.rotationPolicy) {
          deployment.expiresAt = this.calculateExpiration(secret.rotationPolicy.intervalDays);
        }
        
        this.recordDeployment(deployment);
      }

      result.success = result.errors.length === 0;
      console.log(`✅ Deployment ${result.deploymentId} completed: ${result.secretsDeployed} deployed, ${result.secretsUpdated} updated`);

    } catch (error) {
      result.errors.push(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Secret deployment failed:', error);
    }

    return result;
  }

  /**
   * Rotate secrets in CI/CD pipeline
   */
  async rotateSecrets(
    secretNames: string[],
    environment: string,
    userId: string
  ): Promise<RotationEvent[]> {
    console.log(`🔄 Rotating ${secretNames.length} secrets in ${environment}`);

    const events: RotationEvent[] = [];

    for (const secretName of secretNames) {
      try {
        // Get current secret
        const currentValue = await this.vaultManager.getSecret(secretName, userId);
        
        // Generate new secret value
        const newValue = await this.generateSecretValue(secretName);
        
        // Rotate in vault
        await this.vaultManager.rotateSecret(secretName, newValue, userId);
        
        // Update in CI/CD platform
        const pipelineUpdated = await this.updateSecretInPipeline(secretName, newValue, environment);
        
        events.push({
          secretName,
          oldValue: currentValue.substring(0, 8) + '***', // Masked for security
          newValue: newValue.substring(0, 8) + '***', // Masked for security
          environment,
          rotatedAt: new Date(),
          rotatedBy: userId,
          pipelineUpdated
        });

        console.log(`✅ Rotated secret: ${secretName}`);

      } catch (error) {
        console.error(`❌ Failed to rotate secret ${secretName}:`, error);
        events.push({
          secretName,
          oldValue: 'error',
          newValue: 'error',
          environment,
          rotatedAt: new Date(),
          rotatedBy: userId,
          pipelineUpdated: false
        });
      }
    }

    return events;
  }

  /**
   * Sync secrets from vault to CI/CD platform
   */
  async syncSecrets(environment: string, userId: string): Promise<DeploymentResult> {
    console.log(`🔄 Syncing secrets for ${environment} environment`);

    try {
      // Get all secrets from vault
      const vaultSecrets = await this.vaultManager.listSecrets(userId);
      
      // Filter secrets for target environment
      const environmentSecrets = vaultSecrets.filter(s => 
        s.environment === environment || s.environment === 'all'
      );

      // Convert to pipeline secrets format
      const pipelineSecrets: PipelineSecret[] = [];
      
      for (const secret of environmentSecrets) {
        const secretValue = await this.vaultManager.getSecret(secret.name, userId);
        
        const pipelineSecret: PipelineSecret = {
          name: secret.name,
          description: secret.description,
          value: secretValue,
          isEncrypted: this.config.encryptionEnabled,
          scope: this.config.secretsScope,
          environments: [environment],
        };
        
        if (secret.rotationPolicy.enabled) {
          pipelineSecret.rotationPolicy = {
            enabled: true,
            intervalDays: secret.rotationPolicy.intervalDays
          };
        }
        
        pipelineSecrets.push(pipelineSecret);
      }

      return this.deploySecrets(pipelineSecrets, environment, userId);

    } catch (error) {
      console.error('❌ Secret sync failed:', error);
      return {
        success: false,
        secretsDeployed: 0,
        secretsUpdated: 0,
        secretsSkipped: 0,
        errors: [`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        deploymentId: this.generateDeploymentId(),
        timestamp: new Date()
      };
    }
  }

  /**
   * Validate pipeline configuration
   */
  async validatePipelineConfig(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate platform configuration
    if (!this.config.apiToken && this.config.platform !== 'custom') {
      errors.push('API token is required for platform integration');
    }

    // Validate project ID
    if (!this.config.projectId) {
      errors.push('Project ID is required');
    }

    // Check if encryption key exists
    try {
      const encryptionKeys = await this.keyManager.listKeys('system', {
        purpose: 'encryption',
        type: 'symmetric'
      });
      
      if (encryptionKeys.length === 0 && this.config.encryptionEnabled) {
        errors.push('Encryption enabled but no encryption keys found');
      }
    } catch (error) {
      warnings.push('Could not verify encryption keys');
    }

    // Platform-specific validation
    switch (this.config.platform) {
      case 'github':
        if (!this.config.baseUrl) {
          this.config.baseUrl = 'https://api.github.com';
        }
        break;
      case 'gitlab':
        if (!this.config.baseUrl) {
          errors.push('GitLab base URL is required');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate CI/CD configuration files
   */
  async generatePipelineFiles(outputDir: string): Promise<void> {
    mkdirSync(outputDir, { recursive: true });

    switch (this.config.platform) {
      case 'github':
        await this.generateGitHubActions(outputDir);
        break;
      case 'gitlab':
        await this.generateGitLabCI(outputDir);
        break;
      case 'jenkins':
        await this.generateJenkinsfile(outputDir);
        break;
      case 'azure':
        await this.generateAzurePipelines(outputDir);
        break;
    }

    console.log(`✅ Pipeline configuration files generated in ${outputDir}`);
  }

  // Platform-specific deployment methods

  /**
   * Deploy secrets to GitHub Actions
   */
  private async deployToGitHub(
    secrets: PipelineSecret[],
    environment: string,
    result: DeploymentResult
  ): Promise<void> {
    // This would use GitHub's REST API to create/update secrets
    for (const secret of secrets) {
      try {
        // Mock GitHub API call
        console.log(`📤 [GitHub] Deploying secret: ${secret.name} to ${environment}`);
        
        // In production, this would be:
        // await this.githubClient.rest.actions.createOrUpdateRepoSecret({
        //   owner: this.config.projectId.split('/')[0],
        //   repo: this.config.projectId.split('/')[1],
        //   secret_name: secret.name,
        //   encrypted_value: this.encryptForGitHub(secret.value)
        // });

        result.secretsDeployed++;
        
      } catch (error) {
        result.errors.push(`GitHub deployment failed for ${secret.name}: ${error}`);
      }
    }
  }

  /**
   * Deploy secrets to GitLab CI
   */
  private async deployToGitLab(
    secrets: PipelineSecret[],
    environment: string,
    result: DeploymentResult
  ): Promise<void> {
    for (const secret of secrets) {
      try {
        console.log(`📤 [GitLab] Deploying secret: ${secret.name} to ${environment}`);
        
        // In production, this would use GitLab API:
        // await this.gitlabClient.ProjectVariables.create(
        //   this.config.projectId,
        //   {
        //     key: secret.name,
        //     value: secret.value,
        //     protected: true,
        //     masked: true,
        //     environment_scope: environment
        //   }
        // );

        result.secretsDeployed++;
        
      } catch (error) {
        result.errors.push(`GitLab deployment failed for ${secret.name}: ${error}`);
      }
    }
  }

  /**
   * Deploy secrets to Jenkins
   */
  private async deployToJenkins(
    secrets: PipelineSecret[],
    environment: string,
    result: DeploymentResult
  ): Promise<void> {
    for (const secret of secrets) {
      try {
        console.log(`📤 [Jenkins] Deploying secret: ${secret.name} to ${environment}`);
        
        // Jenkins credential store integration would go here
        result.secretsDeployed++;
        
      } catch (error) {
        result.errors.push(`Jenkins deployment failed for ${secret.name}: ${error}`);
      }
    }
  }

  /**
   * Deploy secrets to Azure DevOps
   */
  private async deployToAzure(
    secrets: PipelineSecret[],
    environment: string,
    result: DeploymentResult
  ): Promise<void> {
    for (const secret of secrets) {
      try {
        console.log(`📤 [Azure] Deploying secret: ${secret.name} to ${environment}`);
        
        // Azure DevOps API integration would go here
        result.secretsDeployed++;
        
      } catch (error) {
        result.errors.push(`Azure deployment failed for ${secret.name}: ${error}`);
      }
    }
  }

  /**
   * Deploy to custom platform
   */
  private async deployToCustomPlatform(
    secrets: PipelineSecret[],
    environment: string,
    result: DeploymentResult
  ): Promise<void> {
    // Custom deployment logic
    for (const secret of secrets) {
      console.log(`📤 [Custom] Deploying secret: ${secret.name} to ${environment}`);
      result.secretsDeployed++;
    }
  }

  // Configuration file generators

  /**
   * Generate GitHub Actions workflow
   */
  private async generateGitHubActions(outputDir: string): Promise<void> {
    const workflow = `name: Secret Management

on:
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        required: true
        default: 'sync'
        type: choice
        options:
          - sync
          - rotate
          - validate
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - development
          - staging
          - production

jobs:
  secret-management:
    runs-on: ubuntu-latest
    environment: \${{ github.event.inputs.environment }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup environment
        run: |
          echo "NODE_ENV=\${{ github.event.inputs.environment }}" >> $GITHUB_ENV
          echo "CICD_PLATFORM=github" >> $GITHUB_ENV
          echo "PROJECT_ID=\${{ github.repository }}" >> $GITHUB_ENV
          
      - name: Validate secrets configuration
        if: github.event.inputs.action == 'validate'
        run: npm run secrets:validate
        env:
          VAULT_ENCRYPTION_KEY: \${{ secrets.VAULT_ENCRYPTION_KEY }}
          
      - name: Sync secrets
        if: github.event.inputs.action == 'sync'
        run: npm run secrets:sync -- --environment \${{ github.event.inputs.environment }}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          VAULT_ENCRYPTION_KEY: \${{ secrets.VAULT_ENCRYPTION_KEY }}
          
      - name: Rotate secrets
        if: github.event.inputs.action == 'rotate'
        run: npm run secrets:rotate -- --environment \${{ github.event.inputs.environment }}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          VAULT_ENCRYPTION_KEY: \${{ secrets.VAULT_ENCRYPTION_KEY }}
          
      - name: Generate audit report
        if: always()
        run: npm run secrets:audit -- --output ./secret-audit-report.json
        
      - name: Upload audit report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: secret-audit-report-\${{ github.event.inputs.environment }}
          path: secret-audit-report.json
          retention-days: 30`;

    writeFileSync(join(outputDir, 'secret-management.yml'), workflow);
  }

  /**
   * Generate GitLab CI configuration
   */
  private async generateGitLabCI(outputDir: string): Promise<void> {
    const config = `stages:
  - validate
  - sync
  - audit

variables:
  CICD_PLATFORM: "gitlab"
  PROJECT_ID: "\$CI_PROJECT_PATH"

.secret_management_base:
  image: node:18-alpine
  before_script:
    - npm ci
    - export NODE_ENV=\${ENVIRONMENT}
  only:
    - schedules
    - web

validate_secrets:
  extends: .secret_management_base
  stage: validate
  script:
    - npm run secrets:validate
  parallel:
    matrix:
      - ENVIRONMENT: [development, staging, production]
  artifacts:
    reports:
      junit: validation-report.xml
    when: always

sync_secrets:
  extends: .secret_management_base
  stage: sync
  script:
    - npm run secrets:sync -- --environment \$ENVIRONMENT
  parallel:
    matrix:
      - ENVIRONMENT: [development, staging, production]
  when: manual
  
generate_audit:
  extends: .secret_management_base
  stage: audit
  script:
    - npm run secrets:audit -- --output ./secret-audit-report.json
  artifacts:
    paths:
      - secret-audit-report.json
    expire_in: 30 days
  when: always`;

    writeFileSync(join(outputDir, '.gitlab-ci.yml'), config);
  }

  /**
   * Generate Jenkinsfile
   */
  private async generateJenkinsfile(outputDir: string): Promise<void> {
    const jenkinsfile = `pipeline {
    agent any
    
    parameters {
        choice(name: 'ACTION', choices: ['sync', 'rotate', 'validate'], description: 'Action to perform')
        choice(name: 'ENVIRONMENT', choices: ['development', 'staging', 'production'], description: 'Target environment')
    }
    
    environment {
        NODE_ENV = "\${params.ENVIRONMENT}"
        CICD_PLATFORM = "jenkins"
        PROJECT_ID = "\${env.JOB_NAME}"
    }
    
    stages {
        stage('Setup') {
            steps {
                nodejs('18') {
                    sh 'npm ci'
                }
            }
        }
        
        stage('Validate') {
            when {
                expression { params.ACTION == 'validate' }
            }
            steps {
                nodejs('18') {
                    sh 'npm run secrets:validate'
                }
            }
        }
        
        stage('Sync Secrets') {
            when {
                expression { params.ACTION == 'sync' }
            }
            steps {
                nodejs('18') {
                    withCredentials([string(credentialsId: 'vault-encryption-key', variable: 'VAULT_ENCRYPTION_KEY')]) {
                        sh "npm run secrets:sync -- --environment \${params.ENVIRONMENT}"
                    }
                }
            }
        }
        
        stage('Rotate Secrets') {
            when {
                expression { params.ACTION == 'rotate' }
            }
            steps {
                nodejs('18') {
                    withCredentials([string(credentialsId: 'vault-encryption-key', variable: 'VAULT_ENCRYPTION_KEY')]) {
                        sh "npm run secrets:rotate -- --environment \${params.ENVIRONMENT}"
                    }
                }
            }
        }
        
        stage('Audit') {
            steps {
                nodejs('18') {
                    sh 'npm run secrets:audit -- --output ./secret-audit-report.json'
                    archiveArtifacts artifacts: 'secret-audit-report.json', fingerprint: true
                }
            }
        }
    }
    
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.',
                reportFiles: 'secret-audit-report.json',
                reportName: 'Secret Audit Report'
            ])
        }
    }
}`;

    writeFileSync(join(outputDir, 'Jenkinsfile'), jenkinsfile);
  }

  /**
   * Generate Azure Pipelines configuration
   */
  private async generateAzurePipelines(outputDir: string): Promise<void> {
    const pipeline = `trigger: none

parameters:
  - name: action
    displayName: 'Action to perform'
    type: string
    default: 'sync'
    values:
      - sync
      - rotate
      - validate
  - name: environment
    displayName: 'Target environment'
    type: string
    default: 'staging'
    values:
      - development
      - staging
      - production

variables:
  - name: NODE_ENV
    value: \${{ parameters.environment }}
  - name: CICD_PLATFORM
    value: 'azure'
  - name: PROJECT_ID
    value: '$(Build.Repository.Name)'

stages:
  - stage: SecretManagement
    displayName: 'Secret Management'
    jobs:
      - job: ManageSecrets
        displayName: 'Manage Secrets'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18'
            displayName: 'Setup Node.js'
            
          - script: npm ci
            displayName: 'Install dependencies'
            
          - script: npm run secrets:validate
            displayName: 'Validate secrets'
            condition: eq('\${{ parameters.action }}', 'validate')
            env:
              VAULT_ENCRYPTION_KEY: $(VAULT_ENCRYPTION_KEY)
              
          - script: npm run secrets:sync -- --environment \${{ parameters.environment }}
            displayName: 'Sync secrets'
            condition: eq('\${{ parameters.action }}', 'sync')
            env:
              AZURE_DEVOPS_TOKEN: $(System.AccessToken)
              VAULT_ENCRYPTION_KEY: $(VAULT_ENCRYPTION_KEY)
              
          - script: npm run secrets:rotate -- --environment \${{ parameters.environment }}
            displayName: 'Rotate secrets'
            condition: eq('\${{ parameters.action }}', 'rotate')
            env:
              AZURE_DEVOPS_TOKEN: $(System.AccessToken)
              VAULT_ENCRYPTION_KEY: $(VAULT_ENCRYPTION_KEY)
              
          - script: npm run secrets:audit -- --output ./secret-audit-report.json
            displayName: 'Generate audit report'
            condition: always()
            
          - task: PublishBuildArtifacts@1
            inputs:
              pathToPublish: 'secret-audit-report.json'
              artifactName: 'SecretAuditReport'
            displayName: 'Publish audit report'
            condition: always()`;

    writeFileSync(join(outputDir, 'azure-pipelines.yml'), pipeline);
  }

  // Helper methods

  private async validateSecrets(secrets: PipelineSecret[]): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    for (const secret of secrets) {
      // Validate secret name
      if (!secret.name || secret.name.length === 0) {
        errors.push('Secret name cannot be empty');
      }

      // Validate secret value
      if (!secret.value || secret.value.length === 0) {
        errors.push(`Secret value cannot be empty for ${secret.name}`);
      }

      // Validate environments
      if (!secret.environments || secret.environments.length === 0) {
        errors.push(`At least one environment must be specified for ${secret.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private async updateSecretInPipeline(
    secretName: string,
    newValue: string,
    environment: string
  ): Promise<boolean> {
    try {
      // Platform-specific secret update logic would go here
      console.log(`🔄 Updating ${secretName} with value length ${newValue.length} in ${this.config.platform} for ${environment}`);
      return true;
    } catch (error) {
      console.error(`Failed to update ${secretName} in pipeline:`, error);
      return false;
    }
  }

  private async generateSecretValue(_secretName: string): Promise<string> {
    // Generate a new secure random value
    return randomBytes(32).toString('base64');
  }

  private encryptValue(value: string): string {
    if (!this.config.encryptionEnabled) {
      return value;
    }
    
    // This would use the actual encryption key from KeyManager
    const hash = createHash('sha256');
    hash.update(value + 'salt'); // Simple encryption for demo
    return hash.digest('base64');
  }

  private calculateExpiration(intervalDays: number): Date {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + intervalDays);
    return expiration;
  }

  private generateDeploymentId(): string {
    return `deploy_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private generateSecretId(): string {
    return `secret_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private recordDeployment(deployment: SecretDeployment): void {
    this.deploymentHistory.push(deployment);
    
    // Keep only last 1000 deployments
    if (this.deploymentHistory.length > 1000) {
      this.deploymentHistory = this.deploymentHistory.slice(-1000);
    }

    if (this.config.auditLogging) {
      console.log(`📝 Deployment recorded: ${deployment.name} (${deployment.id})`);
    }
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(filter?: {
    startDate?: Date;
    endDate?: Date;
    environment?: string;
    secretName?: string;
  }): SecretDeployment[] {
    let history = [...this.deploymentHistory];

    if (filter) {
      if (filter.startDate) {
        history = history.filter(d => d.deployedAt >= filter.startDate!);
      }
      if (filter.endDate) {
        history = history.filter(d => d.deployedAt <= filter.endDate!);
      }
      if (filter.environment) {
        history = history.filter(d => d.environment === filter.environment);
      }
      if (filter.secretName) {
        history = history.filter(d => d.name === filter.secretName);
      }
    }

    return history;
  }

  /**
   * Generate deployment report
   */
  generateDeploymentReport(): string {
    let report = `# CI/CD Secret Deployment Report\n\n`;
    report += `**Platform:** ${this.config.platform}\n`;
    report += `**Project:** ${this.config.projectId}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Deployments:** ${this.deploymentHistory.length}\n\n`;

    const environmentCounts = this.deploymentHistory.reduce((acc, deployment) => {
      const env = deployment.environment || 'unknown';
      acc[env] = (acc[env] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `## Deployments by Environment\n\n`;
    for (const [env, count] of Object.entries(environmentCounts)) {
      report += `- ${env}: ${count}\n`;
    }

    report += `\n## Recent Deployments (Last 10)\n\n`;
    const recent = this.deploymentHistory.slice(-10).reverse();
    
    for (const deployment of recent) {
      report += `### ${deployment.name}\n`;
      report += `- **ID:** ${deployment.id}\n`;
      report += `- **Environment:** ${deployment.environment || 'global'}\n`;
      report += `- **Deployed:** ${deployment.deployedAt.toISOString()}\n`;
      report += `- **Deployed By:** ${deployment.deployedBy}\n`;
      if (deployment.expiresAt) {
        report += `- **Expires:** ${deployment.expiresAt.toISOString()}\n`;
      }
      report += `\n`;
    }

    return report;
  }
}