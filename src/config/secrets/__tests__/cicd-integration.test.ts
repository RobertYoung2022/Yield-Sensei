/**
 * CI/CD Integration Test Suite
 */

import { CICDIntegration, CICDConfig, PipelineSecret } from '../cicd-integration';
import { SecretManager, createDefaultSecretManagerConfig } from '../index';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('CICDIntegration', () => {
  let secretManager: SecretManager;
  let cicdIntegration: CICDIntegration;
  let testConfig: CICDConfig;
  let testDir: string;

  beforeAll(async () => {
    // Setup test directory
    testDir = join(process.cwd(), 'test-data', 'cicd-integration');
    mkdirSync(testDir, { recursive: true });

    // Initialize secret manager
    const secretConfig = createDefaultSecretManagerConfig();
    if (secretConfig.vault.localConfig) {
      secretConfig.vault.localConfig.vaultPath = join(testDir, 'vault');
      secretConfig.vault.localConfig.encryptionKey = 'test-encryption-key-32-characters';
    }

    secretManager = new SecretManager(secretConfig);
    await secretManager.initialize();

    // Setup CI/CD integration config
    testConfig = {
      platform: 'github',
      environment: 'development',
      projectId: 'test-org/test-repo',
      baseUrl: 'https://api.github.com',
      secretsScope: 'repository',
      encryptionEnabled: true,
      auditLogging: true
    };

    cicdIntegration = new CICDIntegration(testConfig, secretManager);
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Validation', () => {
    test('should validate valid CI/CD configuration', async () => {
      const result = await cicdIntegration.validatePipelineConfig();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing API token', async () => {
      const invalidConfig = { ...testConfig, apiToken: undefined };
      const invalidIntegration = new CICDIntegration(invalidConfig, secretManager);
      
      const result = await invalidIntegration.validatePipelineConfig();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('API token'))).toBe(true);
    });

    test('should validate project ID requirement', async () => {
      const invalidConfig = { ...testConfig, projectId: '' };
      const invalidIntegration = new CICDIntegration(invalidConfig, secretManager);
      
      const result = await invalidIntegration.validatePipelineConfig();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Project ID'))).toBe(true);
    });
  });

  describe('Secret Deployment', () => {
    test('should deploy secrets successfully', async () => {
      const secrets: PipelineSecret[] = [
        {
          name: 'TEST_SECRET_1',
          description: 'Test secret 1',
          value: 'secret-value-1',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        },
        {
          name: 'TEST_SECRET_2',
          description: 'Test secret 2',
          value: 'secret-value-2',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      const result = await cicdIntegration.deploySecrets(
        secrets,
        'development',
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.secretsDeployed).toBe(2);
      expect(result.secretsUpdated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.deploymentId).toBeDefined();
    });

    test('should handle deployment errors gracefully', async () => {
      const secrets: PipelineSecret[] = [
        {
          name: '', // Invalid empty name
          description: 'Invalid secret',
          value: 'test-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      const result = await cicdIntegration.deploySecrets(
        secrets,
        'development',
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate secrets before deployment', async () => {
      const invalidSecrets: PipelineSecret[] = [
        {
          name: 'VALID_SECRET',
          description: 'Valid secret',
          value: '',  // Empty value should fail validation
          isEncrypted: true,
          scope: 'repository',
          environments: []  // Empty environments should fail validation
        }
      ];

      const result = await cicdIntegration.deploySecrets(
        invalidSecrets,
        'development',
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });
  });

  describe('Secret Rotation', () => {
    beforeEach(async () => {
      // Add some test secrets to vault
      const vaultManager = secretManager.getVaultManager();
      
      await vaultManager.storeSecret('ROTATABLE_SECRET_1', 'old-value-1', {
        description: 'Test rotatable secret 1',
        type: 'api',
        environment: 'development'
      });

      await vaultManager.storeSecret('ROTATABLE_SECRET_2', 'old-value-2', {
        description: 'Test rotatable secret 2',
        type: 'api',
        environment: 'development'
      });
    });

    test('should rotate secrets successfully', async () => {
      const secretNames = ['ROTATABLE_SECRET_1', 'ROTATABLE_SECRET_2'];
      
      const events = await cicdIntegration.rotateSecrets(
        secretNames,
        'development',
        'test-user'
      );

      expect(events).toHaveLength(2);
      expect(events.every(e => e.pipelineUpdated)).toBe(true);
      expect(events.every(e => e.rotatedBy === 'test-user')).toBe(true);
    });

    test('should handle rotation failures', async () => {
      const nonExistentSecrets = ['NON_EXISTENT_SECRET'];
      
      const events = await cicdIntegration.rotateSecrets(
        nonExistentSecrets,
        'development',
        'test-user'
      );

      expect(events).toHaveLength(1);
      expect(events[0].pipelineUpdated).toBe(false);
      expect(events[0].oldValue).toBe('error');
      expect(events[0].newValue).toBe('error');
    });
  });

  describe('Secret Synchronization', () => {
    beforeEach(async () => {
      // Add secrets to vault for sync testing
      const vaultManager = secretManager.getVaultManager();
      
      await vaultManager.storeSecret('SYNC_SECRET_1', 'sync-value-1', {
        description: 'Test sync secret 1',
        type: 'api',
        environment: 'development'
      });

      await vaultManager.storeSecret('SYNC_SECRET_2', 'sync-value-2', {
        description: 'Test sync secret 2',
        type: 'database',
        environment: 'all'
      });
    });

    test('should sync secrets from vault to CI/CD platform', async () => {
      const result = await cicdIntegration.syncSecrets('development', 'test-user');

      expect(result.success).toBe(true);
      expect(result.secretsDeployed).toBeGreaterThan(0);
      expect(result.deploymentId).toBeDefined();
    });

    test('should filter secrets by environment', async () => {
      // Add a production-only secret
      const vaultManager = secretManager.getVaultManager();
      await vaultManager.storeSecret('PROD_ONLY_SECRET', 'prod-value', {
        description: 'Production only secret',
        type: 'api',
        environment: 'production'
      });

      const devResult = await cicdIntegration.syncSecrets('development', 'test-user');
      
      // Should not include the production-only secret in development sync
      expect(devResult.success).toBe(true);
    });
  });

  describe('Pipeline File Generation', () => {
    test('should generate GitHub Actions workflow', async () => {
      const outputDir = join(testDir, 'github-actions');
      
      await cicdIntegration.generatePipelineFiles(outputDir);
      
      expect(existsSync(join(outputDir, 'secret-management.yml'))).toBe(true);
    });

    test('should generate GitLab CI configuration', async () => {
      const gitlabConfig = { ...testConfig, platform: 'gitlab' as const };
      const gitlabIntegration = new CICDIntegration(gitlabConfig, secretManager);
      const outputDir = join(testDir, 'gitlab-ci');
      
      await gitlabIntegration.generatePipelineFiles(outputDir);
      
      expect(existsSync(join(outputDir, '.gitlab-ci.yml'))).toBe(true);
    });

    test('should generate Jenkins pipeline', async () => {
      const jenkinsConfig = { ...testConfig, platform: 'jenkins' as const };
      const jenkinsIntegration = new CICDIntegration(jenkinsConfig, secretManager);
      const outputDir = join(testDir, 'jenkins');
      
      await jenkinsIntegration.generatePipelineFiles(outputDir);
      
      expect(existsSync(join(outputDir, 'Jenkinsfile'))).toBe(true);
    });

    test('should generate Azure Pipelines configuration', async () => {
      const azureConfig = { ...testConfig, platform: 'azure' as const };
      const azureIntegration = new CICDIntegration(azureConfig, secretManager);
      const outputDir = join(testDir, 'azure-pipelines');
      
      await azureIntegration.generatePipelineFiles(outputDir);
      
      expect(existsSync(join(outputDir, 'azure-pipelines.yml'))).toBe(true);
    });
  });

  describe('Deployment History', () => {
    test('should track deployment history', async () => {
      const secrets: PipelineSecret[] = [
        {
          name: 'HISTORY_TEST_SECRET',
          description: 'Test secret for history',
          value: 'test-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      await cicdIntegration.deploySecrets(secrets, 'development', 'test-user');
      
      const history = cicdIntegration.getDeploymentHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const latestDeployment = history[history.length - 1];
      expect(latestDeployment.name).toBe('HISTORY_TEST_SECRET');
      expect(latestDeployment.deployedBy).toBe('test-user');
      expect(latestDeployment.environment).toBe('development');
    });

    test('should filter deployment history', async () => {
      const startDate = new Date();
      
      // Deploy a secret
      const secrets: PipelineSecret[] = [
        {
          name: 'FILTER_TEST_SECRET',
          description: 'Test secret for filtering',
          value: 'test-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      await cicdIntegration.deploySecrets(secrets, 'development', 'test-user');
      
      // Filter by date
      const filteredHistory = cicdIntegration.getDeploymentHistory({
        startDate,
        environment: 'development'
      });
      
      expect(filteredHistory.length).toBeGreaterThan(0);
      expect(filteredHistory.every(d => d.environment === 'development')).toBe(true);
      expect(filteredHistory.every(d => d.deployedAt >= startDate)).toBe(true);
    });
  });

  describe('Reporting', () => {
    test('should generate deployment report', () => {
      const report = cicdIntegration.generateDeploymentReport();
      
      expect(report).toContain('CI/CD Secret Deployment Report');
      expect(report).toContain(`Platform: ${testConfig.platform}`);
      expect(report).toContain(`Project: ${testConfig.projectId}`);
      expect(report).toContain('## Deployments by Environment');
    });
  });

  describe('Platform-Specific Features', () => {
    test('should handle GitHub platform specifics', async () => {
      const githubConfig = { ...testConfig, platform: 'github' as const };
      const githubIntegration = new CICDIntegration(githubConfig, secretManager);
      
      const secrets: PipelineSecret[] = [
        {
          name: 'GITHUB_SECRET',
          description: 'GitHub specific secret',
          value: 'github-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      const result = await githubIntegration.deploySecrets(
        secrets,
        'development',
        'test-user'
      );

      expect(result.success).toBe(true);
    });

    test('should handle GitLab platform specifics', async () => {
      const gitlabConfig = { 
        ...testConfig, 
        platform: 'gitlab' as const,
        baseUrl: 'https://gitlab.com/api/v4'
      };
      const gitlabIntegration = new CICDIntegration(gitlabConfig, secretManager);
      
      const secrets: PipelineSecret[] = [
        {
          name: 'GITLAB_SECRET',
          description: 'GitLab specific secret',
          value: 'gitlab-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      const result = await gitlabIntegration.deploySecrets(
        secrets,
        'development',
        'test-user'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle access control violations', async () => {
      // Create user with limited permissions
      const accessControl = secretManager.getAccessControlManager();
      const limitedUser = accessControl.createUser({
        username: 'limited-user',
        email: 'limited@test.com',
        roles: ['readonly'],
        environment: 'development',
        isActive: true,
        metadata: { test: true }
      });

      const secrets: PipelineSecret[] = [
        {
          name: 'PROTECTED_SECRET',
          description: 'Protected secret',
          value: 'protected-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      const result = await cicdIntegration.deploySecrets(
        secrets,
        'development',
        limitedUser.id
      );

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Access denied'))).toBe(true);
    });

    test('should handle network/API failures gracefully', async () => {
      // This would require mocking the HTTP client
      // For now, we test that the structure handles errors properly
      const secrets: PipelineSecret[] = [
        {
          name: 'API_FAILURE_TEST',
          description: 'Test API failure handling',
          value: 'test-value',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      // The current implementation mocks API calls, so this should succeed
      const result = await cicdIntegration.deploySecrets(
        secrets,
        'development',
        'test-user'
      );

      expect(result).toBeDefined();
      expect(result.deploymentId).toBeDefined();
    });
  });

  describe('Security Features', () => {
    test('should encrypt secrets when encryption is enabled', async () => {
      const secrets: PipelineSecret[] = [
        {
          name: 'ENCRYPTED_SECRET',
          description: 'Test encrypted secret',
          value: 'sensitive-data',
          isEncrypted: true,
          scope: 'repository',
          environments: ['development']
        }
      ];

      await cicdIntegration.deploySecrets(secrets, 'development', 'test-user');
      
      const history = cicdIntegration.getDeploymentHistory({
        secretName: 'ENCRYPTED_SECRET'
      });

      expect(history.length).toBeGreaterThan(0);
      const deployment = history[0];
      expect(deployment.metadata.encrypted).toBe(true);
    });

    test('should mask sensitive values in logs', async () => {
      const secretNames = ['ROTATABLE_SECRET_1'];
      
      const events = await cicdIntegration.rotateSecrets(
        secretNames,
        'development',
        'test-user'
      );

      expect(events[0].oldValue).toContain('***');
      expect(events[0].newValue).toContain('***');
    });
  });
});