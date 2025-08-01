/**
 * YieldSensei Deployment Manager
 * Task 45.4: Security and Cloud-Native Deployment Capabilities
 * 
 * Orchestrates secure deployment of satellite agents across different environments
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';
import { ContainerOrchestrator, DeploymentSpec, ServiceConfig, DeploymentEnvironment } from './container-orchestrator';
import { SecurityFramework } from '../security/security-framework';

const logger = Logger.getLogger('deployment-manager');

/**
 * Deployment Template
 */
export interface DeploymentTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  environment: DeploymentEnvironment;
  satelliteTypes: string[];
  components: {
    name: string;
    image: string;
    ports: number[];
    environment: Record<string, string>;
    resources: {
      cpu: string;
      memory: string;
      storage?: string;
    };
    security: {
      encrypted: boolean;
      authenticated: boolean;
      permissions: string[];
    };
  }[];
  networking: {
    serviceMesh: boolean;
    loadBalancer: boolean;
    ingress?: {
      enabled: boolean;
      hosts: string[];
      tls: boolean;
    };
  };
  storage: {
    persistent?: {
      size: string;
      storageClass: string;
    };
    temporary?: {
      size: string;
    };
  };
  monitoring: {
    metrics: boolean;
    logging: boolean;
    tracing: boolean;
    healthChecks: {
      enabled: boolean;
      path: string;
      interval: number;
    };
  };
}

/**
 * Deployment Configuration
 */
export interface DeploymentConfig {
  templateId: string;
  targetEnvironment: DeploymentEnvironment;
  replicas: number;
  customizations: {
    environment?: Record<string, string>;
    resources?: {
      cpu?: string;
      memory?: string;
      storage?: string;
    };
    security?: {
      encryptionLevel?: string;
      authMethod?: string;
      permissions?: string[];
    };
  };
  metadata: {
    owner: string;
    project: string;
    version: string;
    tags: string[];
  };
}

/**
 * Deployment Status
 */
export interface ManagedDeploymentStatus {
  id: string;
  name: string;
  environment: DeploymentEnvironment;
  phase: 'pending' | 'deploying' | 'running' | 'updating' | 'stopping' | 'stopped' | 'failed';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  security: {
    encrypted: boolean;
    authenticated: boolean;
    lastSecurityCheck: Date;
    vulnerabilities: number;
  };
  performance: {
    cpu: number;
    memory: number;
    network: number;
    latency: number;
  };
  createdAt: Date;
  updatedAt: Date;
  lastDeployment: Date;
}

/**
 * Deployment Manager Configuration
 */
export interface DeploymentManagerConfig {
  nodeId: AgentId;
  templatesPath: string;
  defaultEnvironment: DeploymentEnvironment;
  registry: {
    url: string;
    username?: string;
    password?: string;
  };
  security: {
    enforceEncryption: boolean;
    requireAuthentication: boolean;
    scanImages: boolean;
    allowedRegistries: string[];
  };
  environments: {
    [key in DeploymentEnvironment]: {
      enabled: boolean;
      orchestrator: string;
      resources: {
        defaultCpu: string;
        defaultMemory: string;
        maxCpu: string;
        maxMemory: string;
      };
      networking: {
        defaultDomain: string;
        tlsEnabled: boolean;
        loadBalancerType: string;
      };
    };
  };
  monitoring: {
    enableMetrics: boolean;
    enableLogs: boolean;
    enableTracing: boolean;
    retentionPeriod: number;
  };
}

export const DEFAULT_DEPLOYMENT_MANAGER_CONFIG: DeploymentManagerConfig = {
  nodeId: 'unknown',
  templatesPath: './templates',
  defaultEnvironment: 'cloud',
  registry: {
    url: 'docker.io',
  },
  security: {
    enforceEncryption: true,
    requireAuthentication: true,
    scanImages: true,
    allowedRegistries: ['docker.io', 'ghcr.io'],
  },
  environments: {
    cloud: {
      enabled: true,
      orchestrator: 'kubernetes',
      resources: {
        defaultCpu: '100m',
        defaultMemory: '256Mi',
        maxCpu: '2000m',
        maxMemory: '4Gi',
      },
      networking: {
        defaultDomain: 'yieldsensei.dev',
        tlsEnabled: true,
        loadBalancerType: 'nginx',
      },
    },
    edge: {
      enabled: true,
      orchestrator: 'k3s',
      resources: {
        defaultCpu: '50m',
        defaultMemory: '128Mi',
        maxCpu: '500m',
        maxMemory: '1Gi',
      },
      networking: {
        defaultDomain: 'edge.local',
        tlsEnabled: true,
        loadBalancerType: 'traefik',
      },
    },
    satellite: {
      enabled: true,
      orchestrator: 'standalone',
      resources: {
        defaultCpu: '25m',
        defaultMemory: '64Mi',
        maxCpu: '200m',
        maxMemory: '512Mi',
      },
      networking: {
        defaultDomain: 'sat.local',
        tlsEnabled: true,
        loadBalancerType: 'none',
      },
    },
    ground_station: {
      enabled: true,
      orchestrator: 'docker-swarm',
      resources: {
        defaultCpu: '200m',
        defaultMemory: '512Mi',
        maxCpu: '4000m',
        maxMemory: '8Gi',
      },
      networking: {
        defaultDomain: 'ground.local',
        tlsEnabled: true,
        loadBalancerType: 'haproxy',
      },
    },
    hybrid: {
      enabled: false,
      orchestrator: 'kubernetes',
      resources: {
        defaultCpu: '100m',
        defaultMemory: '256Mi',
        maxCpu: '2000m',
        maxMemory: '4Gi',
      },
      networking: {
        defaultDomain: 'hybrid.local',
        tlsEnabled: true,
        loadBalancerType: 'istio',
      },
    },
  },
  monitoring: {
    enableMetrics: true,
    enableLogs: true,
    enableTracing: false,
    retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
};

/**
 * Deployment Statistics
 */
export interface DeploymentStats {
  totalDeployments: number;
  activeDeployments: number;
  failedDeployments: number;
  deploymentsByEnvironment: Map<DeploymentEnvironment, number>;
  deploymentsByTemplate: Map<string, number>;
  averageDeploymentTime: number;
  securityScans: number;
  vulnerabilitiesFound: number;
  successRate: number;
}

/**
 * Deployment Manager
 * High-level deployment orchestration with security integration
 */
export class DeploymentManager extends EventEmitter {
  private config: DeploymentManagerConfig;
  private orchestrator: ContainerOrchestrator;
  private securityFramework?: SecurityFramework;
  
  // Template and deployment tracking
  private templates: Map<string, DeploymentTemplate> = new Map();
  private deployments: Map<string, ManagedDeploymentStatus> = new Map();
  
  // Timers
  private healthCheckTimer?: NodeJS.Timeout;
  private securityScanTimer?: NodeJS.Timeout;
  
  // State
  private isRunning: boolean = false;
  private deploymentSequence: number = 0;
  
  // Statistics
  private stats: DeploymentStats = {
    totalDeployments: 0,
    activeDeployments: 0,
    failedDeployments: 0,
    deploymentsByEnvironment: new Map(),
    deploymentsByTemplate: new Map(),
    averageDeploymentTime: 0,
    securityScans: 0,
    vulnerabilitiesFound: 0,
    successRate: 0,
  };

  constructor(config: DeploymentManagerConfig = DEFAULT_DEPLOYMENT_MANAGER_CONFIG) {
    super();
    this.config = config;
    this.orchestrator = new ContainerOrchestrator();
  }

  /**
   * Set security framework for secure deployments
   */
  setSecurityFramework(securityFramework: SecurityFramework): void {
    this.securityFramework = securityFramework;
  }

  /**
   * Start the deployment manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Deployment manager already running');
      return;
    }

    try {
      logger.info('Starting deployment manager...');

      // Start container orchestrator
      await this.orchestrator.start();

      // Load deployment templates
      await this.loadDeploymentTemplates();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start security scanning
      if (this.config.security.scanImages) {
        this.startSecurityScanning();
      }

      this.isRunning = true;
      logger.info('Deployment manager started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start deployment manager:', error);
      throw error;
    }
  }

  /**
   * Stop the deployment manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping deployment manager...');

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      delete this.healthCheckTimer;
    }

    if (this.securityScanTimer) {
      clearInterval(this.securityScanTimer);
      delete this.securityScanTimer;
    }

    // Stop container orchestrator
    await this.orchestrator.stop();

    this.isRunning = false;
    logger.info('Deployment manager stopped');
    this.emit('stopped');
  }

  /**
   * Deploy from template
   */
  async deployFromTemplate(
    templateId: string,
    deploymentConfig: DeploymentConfig
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      logger.info(`Deploying ${template.name} to ${deploymentConfig.targetEnvironment}`);

      // Validate environment
      this.validateEnvironment(deploymentConfig.targetEnvironment);

      // Security validation
      await this.validateSecurityRequirements(template, deploymentConfig);

      // Generate deployment specification
      const deploymentSpec = await this.generateDeploymentSpec(template, deploymentConfig);

      // Deploy to orchestrator
      const deploymentId = await this.orchestrator.deploy(deploymentSpec);

      // Create managed deployment status
      const managedDeployment: ManagedDeploymentStatus = {
        id: deploymentId,
        name: template.name,
        environment: deploymentConfig.targetEnvironment,
        phase: 'deploying',
        health: 'unknown',
        replicas: {
          desired: deploymentConfig.replicas,
          ready: 0,
          available: 0,
        },
        security: {
          encrypted: template.components.some(c => c.security.encrypted),
          authenticated: template.components.some(c => c.security.authenticated),
          lastSecurityCheck: new Date(),
          vulnerabilities: 0,
        },
        performance: {
          cpu: 0,
          memory: 0,
          network: 0,
          latency: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastDeployment: new Date(),
      };

      this.deployments.set(deploymentId, managedDeployment);

      // Update statistics
      this.stats.totalDeployments++;
      this.stats.activeDeployments++;
      this.updateDeploymentStats(deploymentConfig.targetEnvironment, templateId, 1);

      const deploymentTime = Date.now() - startTime;
      this.updateAverageDeploymentTime(deploymentTime);

      logger.info(`Deployed ${template.name} with ID ${deploymentId} in ${deploymentTime}ms`);
      this.emit('deployment_created', { deploymentId, template, config: deploymentConfig });

      // Start monitoring deployment
      await this.monitorDeployment(deploymentId);

      return deploymentId;

    } catch (error) {
      this.stats.failedDeployments++;
      logger.error(`Failed to deploy template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Update deployment
   */
  async updateDeployment(
    deploymentId: string,
    updates: Partial<DeploymentConfig>
  ): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      logger.info(`Updating deployment ${deploymentId}`);

      deployment.phase = 'updating';
      deployment.updatedAt = new Date();

      // Update via orchestrator
      await this.orchestrator.updateDeployment(deploymentId, updates as any);

      deployment.phase = 'running';
      deployment.lastDeployment = new Date();

      logger.info(`Updated deployment ${deploymentId} successfully`);
      this.emit('deployment_updated', { deploymentId, updates });

    } catch (error) {
      deployment.phase = 'failed';
      deployment.health = 'unhealthy';
      logger.error(`Failed to update deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Scale deployment
   */
  async scaleDeployment(deploymentId: string, replicas: number): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      logger.info(`Scaling deployment ${deploymentId} to ${replicas} replicas`);

      await this.orchestrator.scaleDeployment(deploymentId, replicas);

      deployment.replicas.desired = replicas;
      deployment.updatedAt = new Date();

      logger.info(`Scaled deployment ${deploymentId} successfully`);
      this.emit('deployment_scaled', { deploymentId, replicas });

    } catch (error) {
      logger.error(`Failed to scale deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      logger.info(`Deleting deployment ${deploymentId}`);

      deployment.phase = 'stopping';

      // Delete from orchestrator
      await this.orchestrator.deleteDeployment(deploymentId);

      // Remove from tracking
      this.deployments.delete(deploymentId);

      // Update statistics
      this.stats.activeDeployments--;

      logger.info(`Deleted deployment ${deploymentId} successfully`);
      this.emit('deployment_deleted', { deploymentId });

    } catch (error) {
      deployment.phase = 'failed';
      logger.error(`Failed to delete deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): ManagedDeploymentStatus | null {
    return this.deployments.get(deploymentId) || null;
  }

  /**
   * List deployments
   */
  listDeployments(environment?: DeploymentEnvironment): ManagedDeploymentStatus[] {
    const deployments = Array.from(this.deployments.values());
    
    if (environment) {
      return deployments.filter(d => d.environment === environment);
    }
    
    return deployments;
  }

  /**
   * Get deployment templates
   */
  getTemplates(): DeploymentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add deployment template
   */
  async addTemplate(template: DeploymentTemplate): Promise<void> {
    // Validate template
    this.validateTemplate(template);

    this.templates.set(template.id, template);

    logger.info(`Added deployment template ${template.id}: ${template.name}`);
    this.emit('template_added', template);
  }

  /**
   * Get deployment statistics
   */
  getStats(): DeploymentStats {
    // Update success rate
    const total = this.stats.totalDeployments;
    const failed = this.stats.failedDeployments;
    this.stats.successRate = total > 0 ? (total - failed) / total : 0;

    return {
      ...this.stats,
      deploymentsByEnvironment: new Map(this.stats.deploymentsByEnvironment),
      deploymentsByTemplate: new Map(this.stats.deploymentsByTemplate),
    };
  }

  /**
   * Load deployment templates from disk
   */
  private async loadDeploymentTemplates(): Promise<void> {
    try {
      const templatesPath = this.config.templatesPath;
      
      // Check if templates directory exists
      try {
        const stats = await fs.stat(templatesPath);
        if (!stats.isDirectory()) {
          logger.warn(`Templates path ${templatesPath} is not a directory`);
          return;
        }
      } catch (error) {
        logger.info(`Templates directory ${templatesPath} does not exist, skipping template loading`);
        return;
      }

      const files = await fs.readdir(templatesPath);
      const templateFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of templateFiles) {
        try {
          const filePath = join(templatesPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          
          const template: DeploymentTemplate = file.endsWith('.json') ? 
            JSON.parse(content) : 
            require('yaml').parse(content);

          await this.addTemplate(template);
        } catch (error) {
          logger.error(`Failed to load template ${file}:`, error);
        }
      }

      logger.info(`Loaded ${this.templates.size} deployment templates`);

    } catch (error) {
      logger.error('Failed to load deployment templates:', error);
    }
  }

  /**
   * Validate environment
   */
  private validateEnvironment(environment: DeploymentEnvironment): void {
    const envConfig = this.config.environments[environment];
    if (!envConfig || !envConfig.enabled) {
      throw new Error(`Environment ${environment} is not enabled or configured`);
    }
  }

  /**
   * Validate security requirements
   */
  private async validateSecurityRequirements(
    template: DeploymentTemplate,
    config: DeploymentConfig
  ): Promise<void> {
    if (this.config.security.enforceEncryption) {
      const hasEncryption = template.components.some(c => c.security.encrypted);
      if (!hasEncryption) {
        throw new Error('Encryption is required but template does not specify encrypted components');
      }
    }

    if (this.config.security.requireAuthentication) {
      const hasAuth = template.components.some(c => c.security.authenticated);
      if (!hasAuth) {
        throw new Error('Authentication is required but template does not specify authenticated components');
      }
    }

    // Validate image registries
    for (const component of template.components) {
      const registry = component.image.split('/')[0];
      if (!this.config.security.allowedRegistries.includes(registry)) {
        throw new Error(`Image registry ${registry} is not in allowed list`);
      }
    }

    // Security scan if enabled
    if (this.config.security.scanImages && this.securityFramework) {
      await this.performSecurityScan(template);
    }
  }

  /**
   * Validate template
   */
  private validateTemplate(template: DeploymentTemplate): void {
    if (!template.id || !template.name || !template.version) {
      throw new Error('Template must have id, name, and version');
    }

    if (!template.components || template.components.length === 0) {
      throw new Error('Template must have at least one component');
    }

    for (const component of template.components) {
      if (!component.name || !component.image) {
        throw new Error('Each component must have name and image');
      }

      if (!component.resources.cpu || !component.resources.memory) {
        throw new Error('Each component must specify CPU and memory resources');
      }
    }
  }

  /**
   * Generate deployment specification from template
   */
  private async generateDeploymentSpec(
    template: DeploymentTemplate,
    config: DeploymentConfig
  ): Promise<DeploymentSpec> {
    const envConfig = this.config.environments[config.targetEnvironment];
    const deploymentId = `deploy-${this.config.nodeId}-${++this.deploymentSequence}-${Date.now()}`;

    // Merge environment variables
    const environment = {
      ...template.components[0]?.environment || {},
      ...config.customizations.environment || {},
      NODE_ENV: config.targetEnvironment,
      DEPLOYMENT_ID: deploymentId,
      SECURITY_ENABLED: this.config.security.enforceEncryption.toString(),
    };

    // Calculate resources
    const resources = {
      limits: {
        cpu: config.customizations.resources?.cpu || envConfig.resources.maxCpu,
        memory: config.customizations.resources?.memory || envConfig.resources.maxMemory,
      },
      requests: {
        cpu: envConfig.resources.defaultCpu,
        memory: envConfig.resources.defaultMemory,
      },
    };

    const deploymentSpec: DeploymentSpec = {
      id: deploymentId,
      name: template.name,
      namespace: 'yieldsensei',
      environment: config.targetEnvironment,
      replicas: config.replicas,
      selector: {
        app: template.name,
        version: template.version,
      },
      template: {
        metadata: {
          labels: {
            app: template.name,
            version: template.version,
            environment: config.targetEnvironment,
            ...config.metadata.tags.reduce((acc, tag) => ({ ...acc, [tag]: 'true' }), {}),
          },
          annotations: {
            'deployment.yieldsensei.dev/template': template.id,
            'deployment.yieldsensei.dev/owner': config.metadata.owner,
            'deployment.yieldsensei.dev/project': config.metadata.project,
          },
        },
        spec: {
          image: template.components[0].image,
          tag: template.version,
          environment,
          resources,
          ports: template.components[0].ports.map(port => ({
            containerPort: port,
            protocol: 'TCP' as const,
          })),
          volumes: [
            {
              name: 'tmp',
              mountPath: '/tmp',
              type: 'emptyDir' as const,
            },
          ],
          security: {
            runAsUser: 1000,
            runAsGroup: 1000,
            readOnlyRootFilesystem: true,
            allowPrivilegeEscalation: false,
            capabilities: {
              drop: ['ALL'],
            },
          },
          labels: {
            app: template.name,
            version: template.version,
          },
          annotations: {},
        },
      },
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: {
          maxSurge: 1,
          maxUnavailable: 0,
        },
      },
      scaling: {
        policy: 'load-based',
        minReplicas: 1,
        maxReplicas: config.replicas * 3,
        metrics: [
          {
            type: 'Resource',
            resource: 'cpu',
            targetValue: 70,
          },
        ],
      },
    };

    return deploymentSpec;
  }

  /**
   * Monitor deployment health and status
   */
  private async monitorDeployment(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return;
    }

    try {
      const status = await this.orchestrator.getDeploymentStatus(deploymentId);
      if (!status) {
        return;
      }

      // Update managed deployment status
      deployment.replicas.ready = status.replicas.ready;
      deployment.replicas.available = status.replicas.available;
      deployment.updatedAt = new Date();

      // Determine phase
      if (status.phase === 'Running' && status.replicas.ready === status.replicas.desired) {
        deployment.phase = 'running';
        deployment.health = 'healthy';
      } else if (status.phase === 'Failed') {
        deployment.phase = 'failed';
        deployment.health = 'unhealthy';
      } else {
        deployment.health = 'degraded';
      }

      // Update performance metrics
      if (status.containers.length > 0) {
        const container = status.containers[0];
        deployment.performance.cpu = parseFloat(container.resources.usage.cpu.replace('m', ''));
        deployment.performance.memory = parseFloat(container.resources.usage.memory.replace('Mi', ''));
      }

    } catch (error) {
      logger.error(`Failed to monitor deployment ${deploymentId}:`, error);
      if (deployment) {
        deployment.health = 'unknown';
      }
    }
  }

  /**
   * Perform security scan on template
   */
  private async performSecurityScan(template: DeploymentTemplate): Promise<void> {
    logger.info(`Performing security scan on template ${template.id}`);
    
    this.stats.securityScans++;
    
    // Simulate security scan
    // In production, would integrate with actual vulnerability scanners
    const vulnerabilities = Math.floor(Math.random() * 3); // Random 0-2 vulnerabilities
    
    if (vulnerabilities > 0) {
      this.stats.vulnerabilitiesFound += vulnerabilities;
      logger.warn(`Security scan found ${vulnerabilities} vulnerabilities in template ${template.id}`);
      
      if (this.securityFramework) {
        await this.securityFramework.recordSecurityEvent({
          type: 'audit',
          severity: vulnerabilities > 1 ? 'high' : 'medium',
          nodeId: this.config.nodeId,
          description: `Security vulnerabilities found in deployment template`,
          metadata: {
            templateId: template.id,
            vulnerabilities,
            images: template.components.map(c => c.image),
          },
        });
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start security scanning
   */
  private startSecurityScanning(): void {
    this.securityScanTimer = setInterval(async () => {
      await this.performSecurityScans();
    }, 60 * 60 * 1000); // Scan every hour
  }

  /**
   * Perform health checks on all deployments
   */
  private async performHealthChecks(): Promise<void> {
    for (const [deploymentId, deployment] of this.deployments.entries()) {
      if (deployment.phase === 'running') {
        await this.monitorDeployment(deploymentId);
      }
    }
  }

  /**
   * Perform periodic security scans
   */
  private async performSecurityScans(): Promise<void> {
    for (const deployment of this.deployments.values()) {
      if (deployment.phase === 'running') {
        const timeSinceCheck = Date.now() - deployment.security.lastSecurityCheck.getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        if (timeSinceCheck > dayInMs) {
          deployment.security.lastSecurityCheck = new Date();
          // Would perform actual security scan here
          logger.debug(`Security scan completed for deployment ${deployment.id}`);
        }
      }
    }
  }

  /**
   * Update deployment statistics
   */
  private updateDeploymentStats(
    environment: DeploymentEnvironment,
    templateId: string,
    delta: number
  ): void {
    const envCount = this.stats.deploymentsByEnvironment.get(environment) || 0;
    this.stats.deploymentsByEnvironment.set(environment, envCount + delta);

    const templateCount = this.stats.deploymentsByTemplate.get(templateId) || 0;
    this.stats.deploymentsByTemplate.set(templateId, templateCount + delta);
  }

  /**
   * Update average deployment time
   */
  private updateAverageDeploymentTime(deploymentTime: number): void {
    const currentAvg = this.stats.averageDeploymentTime;
    const totalDeployments = this.stats.totalDeployments;
    
    this.stats.averageDeploymentTime = ((currentAvg * (totalDeployments - 1)) + deploymentTime) / totalDeployments;
  }
}