/**
 * YieldSensei Container Orchestrator
 * Task 45.4: Security and Cloud-Native Deployment Capabilities
 * 
 * Manages containerized deployment of satellite agents across cloud and edge environments
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';

const logger = Logger.getLogger('container-orchestrator');

/**
 * Deployment Environment
 */
export type DeploymentEnvironment = 'cloud' | 'edge' | 'satellite' | 'ground_station' | 'hybrid';

/**
 * Container Status
 */
export type ContainerStatus = 'pending' | 'creating' | 'running' | 'stopping' | 'stopped' | 'failed' | 'unknown';

/**
 * Scaling Policy
 */
export type ScalingPolicy = 'manual' | 'cpu-based' | 'memory-based' | 'load-based' | 'predictive';

/**
 * Container Configuration
 */
export interface ContainerConfig {
  image: string;
  tag: string;
  command?: string[];
  args?: string[];
  environment: Record<string, string>;
  resources: {
    limits: {
      cpu: string;
      memory: string;
      storage?: string;
    };
    requests: {
      cpu: string;
      memory: string;
      storage?: string;
    };
  };
  ports: {
    containerPort: number;
    hostPort?: number;
    protocol: 'TCP' | 'UDP';
  }[];
  volumes: {
    name: string;
    mountPath: string;
    readOnly?: boolean;
    type: 'emptyDir' | 'hostPath' | 'configMap' | 'secret' | 'persistentVolume';
    source?: string;
  }[];
  security: {
    runAsUser?: number;
    runAsGroup?: number;
    readOnlyRootFilesystem?: boolean;
    allowPrivilegeEscalation?: boolean;
    capabilities?: {
      add?: string[];
      drop?: string[];
    };
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

/**
 * Deployment Specification
 */
export interface DeploymentSpec {
  id: string;
  name: string;
  namespace: string;
  environment: DeploymentEnvironment;
  replicas: number;
  selector: Record<string, string>;
  template: {
    metadata: {
      labels: Record<string, string>;
      annotations: Record<string, string>;
    };
    spec: ContainerConfig;
  };
  strategy: {
    type: 'RollingUpdate' | 'Recreate' | 'BlueGreen';
    rollingUpdate?: {
      maxSurge: number;
      maxUnavailable: number;
    };
  };
  scaling: {
    policy: ScalingPolicy;
    minReplicas: number;
    maxReplicas: number;
    metrics: {
      type: 'Resource' | 'Pods' | 'Object' | 'External';
      resource?: string;
      targetValue: number;
    }[];
  };
}

/**
 * Service Configuration
 */
export interface ServiceConfig {
  id: string;
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector: Record<string, string>;
  ports: {
    name: string;
    port: number;
    targetPort: number;
    protocol: 'TCP' | 'UDP';
    nodePort?: number;
  }[];
  loadBalancer?: {
    ingress: {
      ip?: string;
      hostname?: string;
    }[];
  };
  annotations: Record<string, string>;
}

/**
 * Deployment Status
 */
export interface DeploymentStatus {
  id: string;
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
  replicas: {
    desired: number;
    current: number;
    ready: number;
    available: number;
    unavailable: number;
  };
  conditions: {
    type: string;
    status: 'True' | 'False' | 'Unknown';
    lastTransitionTime: Date;
    reason?: string;
    message?: string;
  }[];
  containers: {
    name: string;
    status: ContainerStatus;
    restartCount: number;
    lastStartTime?: Date;
    image: string;
    resources: {
      usage: {
        cpu: string;
        memory: string;
      };
      limits: {
        cpu: string;
        memory: string;
      };
    };
  }[];
}

/**
 * Container Orchestrator Configuration
 */
export interface OrchestratorConfig {
  nodeId: AgentId;
  platform: 'kubernetes' | 'docker-swarm' | 'nomad' | 'standalone';
  registry: {
    url: string;
    username?: string;
    password?: string;
    insecure?: boolean;
  };
  cluster: {
    apiEndpoint?: string;
    credentials?: {
      token?: string;
      certificate?: string;
      key?: string;
    };
    namespace: string;
  };
  deployment: {
    defaultEnvironment: DeploymentEnvironment;
    imagePullPolicy: 'Always' | 'IfNotPresent' | 'Never';
    restartPolicy: 'Always' | 'OnFailure' | 'Never';
    terminationGracePeriodSeconds: number;
  };
  monitoring: {
    enableMetrics: boolean;
    enableLogs: boolean;
    enableTracing: boolean;
    healthCheckInterval: number;
  };
  security: {
    enablePodSecurityPolicy: boolean;
    enableNetworkPolicy: boolean;
    enableServiceMesh: boolean;
    defaultSecurityContext: ContainerConfig['security'];
  };
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  nodeId: 'unknown',
  platform: 'kubernetes',
  registry: {
    url: 'docker.io',
    insecure: false,
  },
  cluster: {
    namespace: 'yieldsensei',
  },
  deployment: {
    defaultEnvironment: 'cloud',
    imagePullPolicy: 'IfNotPresent',
    restartPolicy: 'Always',
    terminationGracePeriodSeconds: 30,
  },
  monitoring: {
    enableMetrics: true,
    enableLogs: true,
    enableTracing: false,
    healthCheckInterval: 30000,
  },
  security: {
    enablePodSecurityPolicy: true,
    enableNetworkPolicy: true,
    enableServiceMesh: false,
    defaultSecurityContext: {
      runAsUser: 1000,
      runAsGroup: 1000,
      readOnlyRootFilesystem: true,
      allowPrivilegeEscalation: false,
      capabilities: {
        drop: ['ALL'],
      },
    },
  },
};

/**
 * Orchestrator Statistics
 */
export interface OrchestratorStats {
  totalDeployments: number;
  runningDeployments: number;
  failedDeployments: number;
  totalContainers: number;
  runningContainers: number;
  averageStartupTime: number;
  deploymentsByEnvironment: Map<DeploymentEnvironment, number>;
  resourceUtilization: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

/**
 * Container Orchestrator
 * Manages containerized deployments across different environments
 */
export class ContainerOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  
  // Deployment tracking
  private deployments: Map<string, DeploymentSpec> = new Map();
  private services: Map<string, ServiceConfig> = new Map();
  private deploymentStatuses: Map<string, DeploymentStatus> = new Map();
  
  // Timers
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  // State
  private isRunning: boolean = false;
  
  // Statistics
  private stats: OrchestratorStats = {
    totalDeployments: 0,
    runningDeployments: 0,
    failedDeployments: 0,
    totalContainers: 0,
    runningContainers: 0,
    averageStartupTime: 0,
    deploymentsByEnvironment: new Map(),
    resourceUtilization: {
      cpu: 0,
      memory: 0,
      storage: 0,
    },
  };

  constructor(config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Start the container orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Container orchestrator already running');
      return;
    }

    try {
      logger.info('Starting container orchestrator...');

      // Validate cluster connectivity
      await this.validateClusterConnection();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start metrics collection
      this.startMetricsCollection();

      this.isRunning = true;
      logger.info('Container orchestrator started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start container orchestrator:', error);
      throw error;
    }
  }

  /**
   * Stop the container orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping container orchestrator...');

    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      delete this.healthCheckTimer;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      delete this.metricsTimer;
    }

    this.isRunning = false;
    logger.info('Container orchestrator stopped');
    this.emit('stopped');
  }

  /**
   * Deploy application
   */
  async deploy(spec: DeploymentSpec): Promise<string> {
    try {
      logger.info(`Deploying ${spec.name} to ${spec.environment} environment`);

      // Validate deployment specification
      this.validateDeploymentSpec(spec);

      // Generate deployment manifests
      const manifests = await this.generateManifests(spec);

      // Apply deployment
      await this.applyDeployment(spec, manifests);

      // Store deployment spec
      this.deployments.set(spec.id, spec);

      // Update statistics
      this.stats.totalDeployments++;
      this.updateDeploymentStats(spec.environment, 1);

      logger.info(`Deployment ${spec.id} created successfully`);
      this.emit('deployment_created', spec);

      return spec.id;

    } catch (error) {
      this.stats.failedDeployments++;
      logger.error(`Failed to deploy ${spec.name}:`, error);
      throw error;
    }
  }

  /**
   * Update deployment
   */
  async updateDeployment(deploymentId: string, updates: Partial<DeploymentSpec>): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      logger.info(`Updating deployment ${deploymentId}`);

      // Merge updates
      const updatedSpec: DeploymentSpec = { ...deployment, ...updates };

      // Validate updated specification
      this.validateDeploymentSpec(updatedSpec);

      // Generate updated manifests
      const manifests = await this.generateManifests(updatedSpec);

      // Apply updates
      await this.applyDeployment(updatedSpec, manifests);

      // Update stored spec
      this.deployments.set(deploymentId, updatedSpec);

      logger.info(`Deployment ${deploymentId} updated successfully`);
      this.emit('deployment_updated', { deploymentId, updates });

    } catch (error) {
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

      // Validate scaling constraints
      if (replicas < deployment.scaling.minReplicas || replicas > deployment.scaling.maxReplicas) {
        throw new Error(`Replica count ${replicas} outside allowed range [${deployment.scaling.minReplicas}, ${deployment.scaling.maxReplicas}]`);
      }

      // Update deployment
      await this.updateDeployment(deploymentId, { replicas });

      logger.info(`Deployment ${deploymentId} scaled to ${replicas} replicas`);
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

      // Delete from cluster
      await this.deleteFromCluster(deployment);

      // Remove from tracking
      this.deployments.delete(deploymentId);
      this.deploymentStatuses.delete(deploymentId);

      // Update statistics
      this.stats.totalDeployments--;
      this.updateDeploymentStats(deployment.environment, -1);

      logger.info(`Deployment ${deploymentId} deleted successfully`);
      this.emit('deployment_deleted', { deploymentId });

    } catch (error) {
      logger.error(`Failed to delete deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Create service
   */
  async createService(serviceConfig: ServiceConfig): Promise<string> {
    try {
      logger.info(`Creating service ${serviceConfig.name}`);

      // Generate service manifest
      const manifest = this.generateServiceManifest(serviceConfig);

      // Apply service
      await this.applyService(serviceConfig, manifest);

      // Store service config
      this.services.set(serviceConfig.id, serviceConfig);

      logger.info(`Service ${serviceConfig.id} created successfully`);
      this.emit('service_created', serviceConfig);

      return serviceConfig.id;

    } catch (error) {
      logger.error(`Failed to create service ${serviceConfig.name}:`, error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return null;
    }

    // Fetch current status from cluster
    const status = await this.fetchDeploymentStatus(deployment);
    this.deploymentStatuses.set(deploymentId, status);

    return status;
  }

  /**
   * List deployments
   */
  listDeployments(environment?: DeploymentEnvironment): DeploymentSpec[] {
    const deployments = Array.from(this.deployments.values());
    
    if (environment) {
      return deployments.filter(d => d.environment === environment);
    }
    
    return deployments;
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): OrchestratorStats {
    return {
      ...this.stats,
      deploymentsByEnvironment: new Map(this.stats.deploymentsByEnvironment),
    };
  }

  /**
   * Validate cluster connection
   */
  private async validateClusterConnection(): Promise<void> {
    // Platform-specific connection validation
    switch (this.config.platform) {
      case 'kubernetes':
        await this.validateKubernetesConnection();
        break;
      case 'docker-swarm':
        await this.validateDockerSwarmConnection();
        break;
      case 'standalone':
        logger.info('Running in standalone mode');
        break;
      default:
        throw new Error(`Unsupported platform: ${this.config.platform}`);
    }
  }

  /**
   * Validate Kubernetes connection
   */
  private async validateKubernetesConnection(): Promise<void> {
    // Simplified validation - in production would use kubectl or k8s client
    logger.debug('Validating Kubernetes cluster connection');
    
    // Check if namespace exists, create if not
    await this.ensureNamespace(this.config.cluster.namespace);
  }

  /**
   * Validate Docker Swarm connection
   */
  private async validateDockerSwarmConnection(): Promise<void> {
    // Simplified validation
    logger.debug('Validating Docker Swarm connection');
  }

  /**
   * Ensure namespace exists
   */
  private async ensureNamespace(namespace: string): Promise<void> {
    logger.debug(`Ensuring namespace ${namespace} exists`);
    // In production, would create namespace if it doesn't exist
  }

  /**
   * Validate deployment specification
   */
  private validateDeploymentSpec(spec: DeploymentSpec): void {
    if (!spec.name || !spec.id) {
      throw new Error('Deployment must have name and id');
    }

    if (spec.replicas < 0) {
      throw new Error('Replicas must be non-negative');
    }

    if (!spec.template.spec.image) {
      throw new Error('Container image is required');
    }

    // Validate resource requirements
    const resources = spec.template.spec.resources;
    if (!resources.requests.cpu || !resources.requests.memory) {
      throw new Error('CPU and memory requests are required');
    }
  }

  /**
   * Generate deployment manifests
   */
  private async generateManifests(spec: DeploymentSpec): Promise<any[]> {
    const manifests: any[] = [];

    switch (this.config.platform) {
      case 'kubernetes':
        manifests.push(this.generateKubernetesDeploymentManifest(spec));
        break;
      case 'docker-swarm':
        manifests.push(this.generateDockerSwarmManifest(spec));
        break;
      case 'standalone':
        manifests.push(this.generateDockerComposeManifest(spec));
        break;
    }

    return manifests;
  }

  /**
   * Generate Kubernetes deployment manifest
   */
  private generateKubernetesDeploymentManifest(spec: DeploymentSpec): any {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: spec.name,
        namespace: spec.namespace,
        labels: spec.template.metadata.labels,
        annotations: spec.template.metadata.annotations,
      },
      spec: {
        replicas: spec.replicas,
        selector: {
          matchLabels: spec.selector,
        },
        strategy: {
          type: spec.strategy.type,
          rollingUpdate: spec.strategy.rollingUpdate,
        },
        template: {
          metadata: {
            labels: { ...spec.selector, ...spec.template.metadata.labels },
            annotations: spec.template.metadata.annotations,
          },
          spec: {
            containers: [{
              name: spec.name,
              image: `${spec.template.spec.image}:${spec.template.spec.tag}`,
              command: spec.template.spec.command,
              args: spec.template.spec.args,
              env: Object.entries(spec.template.spec.environment).map(([name, value]) => ({
                name,
                value,
              })),
              ports: spec.template.spec.ports.map(port => ({
                containerPort: port.containerPort,
                protocol: port.protocol,
              })),
              resources: spec.template.spec.resources,
              volumeMounts: spec.template.spec.volumes.map(vol => ({
                name: vol.name,
                mountPath: vol.mountPath,
                readOnly: vol.readOnly,
              })),
              securityContext: spec.template.spec.security,
            }],
            volumes: spec.template.spec.volumes.map(vol => ({
              name: vol.name,
              ...(vol.type === 'emptyDir' ? { emptyDir: {} } : {}),
              ...(vol.type === 'hostPath' ? { hostPath: { path: vol.source } } : {}),
              ...(vol.type === 'configMap' ? { configMap: { name: vol.source } } : {}),
              ...(vol.type === 'secret' ? { secret: { secretName: vol.source } } : {}),
            })),
            imagePullPolicy: this.config.deployment.imagePullPolicy,
            restartPolicy: this.config.deployment.restartPolicy,
            terminationGracePeriodSeconds: this.config.deployment.terminationGracePeriodSeconds,
            securityContext: this.config.security.defaultSecurityContext,
          },
        },
      },
    };
  }

  /**
   * Generate Docker Swarm manifest
   */
  private generateDockerSwarmManifest(spec: DeploymentSpec): any {
    return {
      version: '3.8',
      services: {
        [spec.name]: {
          image: `${spec.template.spec.image}:${spec.template.spec.tag}`,
          command: spec.template.spec.command,
          environment: spec.template.spec.environment,
          ports: spec.template.spec.ports.map(port => 
            `${port.hostPort || port.containerPort}:${port.containerPort}/${port.protocol.toLowerCase()}`
          ),
          volumes: spec.template.spec.volumes.map(vol => 
            `${vol.source}:${vol.mountPath}${vol.readOnly ? ':ro' : ''}`
          ),
          deploy: {
            replicas: spec.replicas,
            resources: {
              limits: spec.template.spec.resources.limits,
              reservations: spec.template.spec.resources.requests,
            },
            restart_policy: {
              condition: 'any',
              delay: '5s',
              max_attempts: 3,
            },
            update_config: {
              parallelism: spec.strategy.rollingUpdate?.maxSurge || 1,
              failure_action: 'rollback',
            },
            labels: spec.template.metadata.labels,
          },
        },
      },
    };
  }

  /**
   * Generate Docker Compose manifest
   */
  private generateDockerComposeManifest(spec: DeploymentSpec): any {
    return {
      version: '3.8',
      services: {
        [spec.name]: {
          image: `${spec.template.spec.image}:${spec.template.spec.tag}`,
          command: spec.template.spec.command,
          environment: spec.template.spec.environment,
          ports: spec.template.spec.ports.map(port => 
            `${port.hostPort || port.containerPort}:${port.containerPort}`
          ),
          volumes: spec.template.spec.volumes.map(vol => 
            `${vol.source}:${vol.mountPath}${vol.readOnly ? ':ro' : ''}`
          ),
          restart: 'unless-stopped',
          labels: spec.template.metadata.labels,
          deploy: {
            resources: {
              limits: spec.template.spec.resources.limits,
              reservations: spec.template.spec.resources.requests,
            },
          },
        },
      },
    };
  }

  /**
   * Generate service manifest
   */
  private generateServiceManifest(serviceConfig: ServiceConfig): any {
    switch (this.config.platform) {
      case 'kubernetes':
        return {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: serviceConfig.name,
            namespace: serviceConfig.namespace,
            annotations: serviceConfig.annotations,
          },
          spec: {
            type: serviceConfig.type,
            selector: serviceConfig.selector,
            ports: serviceConfig.ports.map(port => ({
              name: port.name,
              port: port.port,
              targetPort: port.targetPort,
              protocol: port.protocol,
              nodePort: port.nodePort,
            })),
          },
        };
      default:
        throw new Error(`Service generation not supported for platform: ${this.config.platform}`);
    }
  }

  /**
   * Apply deployment to cluster
   */
  private async applyDeployment(spec: DeploymentSpec, manifests: any[]): Promise<void> {
    logger.debug(`Applying deployment ${spec.name} with ${manifests.length} manifests`);
    
    // In production, would use platform-specific APIs or CLI tools
    // For now, simulate deployment application
    await this.simulateDeploymentApplication(spec, manifests);
  }

  /**
   * Apply service to cluster
   */
  private async applyService(serviceConfig: ServiceConfig, manifest: any): Promise<void> {
    logger.debug(`Applying service ${serviceConfig.name}`);
    
    // In production, would use platform-specific APIs or CLI tools
    await this.simulateServiceApplication(serviceConfig, manifest);
  }

  /**
   * Delete deployment from cluster
   */
  private async deleteFromCluster(deployment: DeploymentSpec): Promise<void> {
    logger.debug(`Deleting deployment ${deployment.name} from cluster`);
    
    // In production, would use platform-specific deletion
    await this.simulateDeploymentDeletion(deployment);
  }

  /**
   * Fetch deployment status from cluster
   */
  private async fetchDeploymentStatus(deployment: DeploymentSpec): Promise<DeploymentStatus> {
    // In production, would fetch real status from cluster
    return this.simulateDeploymentStatus(deployment);
  }

  /**
   * Simulate deployment application (for testing)
   */
  private async simulateDeploymentApplication(spec: DeploymentSpec, manifests: any[]): Promise<void> {
    // Simulate deployment process
    logger.debug(`Simulating deployment of ${spec.name}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Simulate service application (for testing)
   */
  private async simulateServiceApplication(serviceConfig: ServiceConfig, manifest: any): Promise<void> {
    logger.debug(`Simulating service creation of ${serviceConfig.name}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Simulate deployment deletion (for testing)
   */
  private async simulateDeploymentDeletion(deployment: DeploymentSpec): Promise<void> {
    logger.debug(`Simulating deletion of ${deployment.name}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Simulate deployment status (for testing)
   */
  private simulateDeploymentStatus(deployment: DeploymentSpec): DeploymentStatus {
    return {
      id: deployment.id,
      phase: 'Running',
      replicas: {
        desired: deployment.replicas,
        current: deployment.replicas,
        ready: deployment.replicas,
        available: deployment.replicas,
        unavailable: 0,
      },
      conditions: [
        {
          type: 'Available',
          status: 'True',
          lastTransitionTime: new Date(),
          reason: 'MinimumReplicasAvailable',
          message: 'Deployment has minimum availability.',
        },
      ],
      containers: [
        {
          name: deployment.name,
          status: 'running',
          restartCount: 0,
          lastStartTime: new Date(),
          image: `${deployment.template.spec.image}:${deployment.template.spec.tag}`,
          resources: {
            usage: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: deployment.template.spec.resources.limits,
          },
        },
      ],
    };
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Collect every minute
  }

  /**
   * Perform health checks on deployments
   */
  private async performHealthChecks(): Promise<void> {
    for (const [deploymentId, deployment] of this.deployments.entries()) {
      try {
        const status = await this.fetchDeploymentStatus(deployment);
        this.deploymentStatuses.set(deploymentId, status);

        // Check for unhealthy deployments
        if (status.phase === 'Failed' || status.replicas.available < status.replicas.desired) {
          this.emit('deployment_unhealthy', { deploymentId, status });
        }
      } catch (error) {
        logger.error(`Health check failed for deployment ${deploymentId}:`, error);
      }
    }
  }

  /**
   * Collect metrics
   */
  private collectMetrics(): void {
    let runningDeployments = 0;
    let failedDeployments = 0;
    let totalContainers = 0;
    let runningContainers = 0;

    for (const status of this.deploymentStatuses.values()) {
      if (status.phase === 'Running') {
        runningDeployments++;
      } else if (status.phase === 'Failed') {
        failedDeployments++;
      }

      totalContainers += status.containers.length;
      runningContainers += status.containers.filter(c => c.status === 'running').length;
    }

    this.stats.runningDeployments = runningDeployments;
    this.stats.failedDeployments = failedDeployments;
    this.stats.totalContainers = totalContainers;
    this.stats.runningContainers = runningContainers;

    this.emit('metrics_collected', this.stats);
  }

  /**
   * Update deployment statistics by environment
   */
  private updateDeploymentStats(environment: DeploymentEnvironment, delta: number): void {
    const current = this.stats.deploymentsByEnvironment.get(environment) || 0;
    this.stats.deploymentsByEnvironment.set(environment, Math.max(0, current + delta));
  }
}