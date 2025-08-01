/**
 * Wallet Manager
 * Advanced multi-wallet management with security monitoring and role-based access
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { getUnifiedAIClient, UnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import {
  WalletManagementConfig,
  ManagedWallet,
  WalletType,
  WalletRole,
  WalletHealth,
  BackupStrategy,
  PendingTransaction,
  TransactionType,
  TransactionPriority
} from '../types';

export interface WalletManagerConfig extends WalletManagementConfig {
  securityCheckInterval: number; // milliseconds
  balanceCheckInterval: number; // milliseconds
  autoRotationEnabled: boolean;
  emergencyPauseThreshold: number; // suspicious activity threshold
  encryptionLevel: 'basic' | 'advanced' | 'military';
  auditTrailEnabled: boolean;
  complianceMode: 'standard' | 'institutional' | 'enterprise';
}

export interface WalletCreationRequest {
  name: string;
  role: WalletRole;
  type: WalletType;
  chain: string;
  initialBalance?: Record<string, bigint>;
  metadata?: Record<string, any>;
  backupStrategy?: BackupStrategy;
}

export interface SecurityAlert {
  id: string;
  walletId: string;
  type: 'anomaly' | 'breach' | 'suspicious_activity' | 'balance_drain' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  resolved: boolean;
  actionTaken?: string;
}

export interface WalletRotationPlan {
  id: string;
  currentWallet: ManagedWallet;
  newWallet: ManagedWallet;
  transferTransactions: PendingTransaction[];
  scheduledTime: Date;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  reason: string;
}

export interface AnomalyDetectionRule {
  name: string;
  description: string;
  threshold: number;
  timeWindow: number; // milliseconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'pause' | 'rotate' | 'emergency_stop';
  enabled: boolean;
}

export interface WalletAuditEntry {
  id: string;
  walletId: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
  initiator: string;
  result: 'success' | 'failure' | 'pending';
}

export class WalletManager extends EventEmitter {
  private logger: Logger;
  private config: WalletManagerConfig;
  private aiClient: UnifiedAIClient;
  private isInitialized: boolean = false;

  // Wallet storage
  private managedWallets: Map<string, ManagedWallet> = new Map();
  private walletsByRole: Map<WalletRole, ManagedWallet[]> = new Map();
  private walletsByChain: Map<string, ManagedWallet[]> = new Map();

  // Security and monitoring
  private securityAlerts: Map<string, SecurityAlert> = new Map();
  private anomalyRules: AnomalyDetectionRule[] = [];
  private rotationPlans: Map<string, WalletRotationPlan> = new Map();
  private auditTrail: WalletAuditEntry[] = [];

  // Performance tracking
  private totalWalletsManaged: number = 0;
  private securityIncidents: number = 0;
  private rotationsPerformed: number = 0;
  private averageSecurityScore: number = 0;

  // Monitoring intervals
  private securityCheckInterval?: NodeJS.Timeout;
  private balanceCheckInterval?: NodeJS.Timeout;
  private rotationCheckInterval?: NodeJS.Timeout;

  constructor(config: WalletManagerConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [WalletManager] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/wallet-manager.log' })
      ],
    });
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Wallet Manager...');

      // Initialize AI client
      this.aiClient = getUnifiedAIClient();

      // Initialize anomaly detection rules
      this.initializeAnomalyDetectionRules();

      // Load existing wallets
      await this.loadManagedWallets();

      // Start monitoring services
      this.startSecurityMonitoring();
      this.startBalanceMonitoring();

      if (this.config.autoRotationEnabled) {
        this.startRotationService();
      }

      this.isInitialized = true;
      this.logger.info('Wallet Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Wallet Manager:', error);
      throw error;
    }
  }

  async createWallet(request: WalletCreationRequest): Promise<ManagedWallet> {
    try {
      this.logger.info('Creating new managed wallet', {
        name: request.name,
        role: request.role,
        type: request.type,
        chain: request.chain
      });

      // Check if we've reached the maximum wallets per chain
      const chainWallets = this.walletsByChain.get(request.chain) || [];
      if (chainWallets.length >= this.config.maxWalletsPerChain) {
        throw new Error(`Maximum wallets per chain (${this.config.maxWalletsPerChain}) reached for chain ${request.chain}`);
      }

      // Generate wallet (in production, would use secure key generation)
      const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const address = this.generateWalletAddress();

      const wallet: ManagedWallet = {
        id: walletId,
        address,
        name: request.name,
        chain: request.chain,
        type: request.type,
        role: request.role,
        balance: request.initialBalance || {},
        nonce: 0,
        health: {
          status: 'healthy',
          issues: [],
          lastCheck: new Date(),
          securityScore: 100
        },
        lastActivity: new Date(),
        metadata: {
          createdAt: new Date(),
          backupStrategy: request.backupStrategy || this.config.backupStrategy,
          encryptionLevel: this.config.encryptionLevel,
          ...request.metadata
        }
      };

      // Store wallet
      this.managedWallets.set(walletId, wallet);
      this.addWalletToRoleMap(wallet);
      this.addWalletToChainMap(wallet);

      // Create backup
      await this.createWalletBackup(wallet);

      // Log audit entry
      this.logAuditEntry({
        walletId,
        action: 'wallet_created',
        details: {
          name: request.name,
          role: request.role,
          type: request.type,
          chain: request.chain
        },
        initiator: 'system',
        result: 'success'
      });

      this.totalWalletsManaged++;

      this.emit('wallet_created', {
        walletId,
        address,
        role: request.role,
        chain: request.chain
      });

      return wallet;
    } catch (error) {
      this.logger.error('Failed to create wallet:', error);
      throw error;
    }
  }

  async rotateWallet(walletId: string, reason: string = 'scheduled'): Promise<WalletRotationPlan> {
    const wallet = this.managedWallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }

    try {
      this.logger.info('Initiating wallet rotation', {
        walletId,
        currentAddress: wallet.address,
        reason
      });

      // Create new wallet with same configuration
      const newWallet = await this.createWallet({
        name: `${wallet.name}_rotated`,
        role: wallet.role,
        type: wallet.type,
        chain: wallet.chain,
        metadata: {
          ...wallet.metadata,
          rotatedFrom: walletId,
          rotationReason: reason
        }
      });

      // Create transfer transactions
      const transferTxs = await this.createTransferTransactions(wallet, newWallet);

      const rotationPlan: WalletRotationPlan = {
        id: `rotation_${Date.now()}`,
        currentWallet: wallet,
        newWallet,
        transferTransactions: transferTxs,
        scheduledTime: new Date(Date.now() + 300000), // 5 minutes from now
        status: 'planned',
        reason
      };

      this.rotationPlans.set(rotationPlan.id, rotationPlan);

      // Schedule execution
      setTimeout(() => {
        this.executeWalletRotation(rotationPlan.id);
      }, 300000);

      this.emit('wallet_rotation_planned', {
        rotationId: rotationPlan.id,
        walletId,
        newWalletId: newWallet.id,
        reason
      });

      return rotationPlan;
    } catch (error) {
      this.logger.error('Failed to initiate wallet rotation:', error);
      throw error;
    }
  }

  async checkWalletSecurity(walletId: string): Promise<WalletHealth> {
    const wallet = this.managedWallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }

    try {
      const issues: string[] = [];
      let securityScore = 100;

      // Check for anomalous activity
      const anomalies = await this.detectWalletAnomalies(wallet);
      if (anomalies.length > 0) {
        issues.push(`${anomalies.length} anomalies detected`);
        securityScore -= anomalies.length * 10;
      }

      // Check balance consistency
      const balanceCheck = await this.verifyWalletBalance(wallet);
      if (!balanceCheck.consistent) {
        issues.push('Balance inconsistency detected');
        securityScore -= 20;
      }

      // Check for unusual transaction patterns
      const patternCheck = await this.analyzeTransactionPatterns(wallet);
      if (patternCheck.suspicious) {
        issues.push('Suspicious transaction patterns');
        securityScore -= 15;
      }

      // AI-powered security analysis
      const aiAnalysis = await this.performAISecurityAnalysis(wallet);
      if (aiAnalysis.riskScore > 0.7) {
        issues.push('AI detected high-risk indicators');
        securityScore -= 25;
      }

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (securityScore < 70) {
        status = 'critical';
      } else if (securityScore < 85) {
        status = 'warning';
      }

      const health: WalletHealth = {
        status,
        issues,
        lastCheck: new Date(),
        securityScore: Math.max(0, securityScore)
      };

      // Update wallet health
      wallet.health = health;

      // Create alerts for critical issues
      if (status === 'critical') {
        await this.createSecurityAlert(walletId, 'anomaly', 'critical', 
          `Critical security issues detected: ${issues.join(', ')}`);
      }

      return health;
    } catch (error) {
      this.logger.error('Security check failed:', error);
      throw error;
    }
  }

  async getWalletsByRole(role: WalletRole): Promise<ManagedWallet[]> {
    return this.walletsByRole.get(role) || [];
  }

  async getWalletsByChain(chain: string): Promise<ManagedWallet[]> {
    return this.walletsByChain.get(chain) || [];
  }

  async getOptimalWalletForTransaction(
    transaction: Partial<PendingTransaction>
  ): Promise<ManagedWallet> {
    const chainWallets = await this.getWalletsByChain(transaction.chainId || '1');
    
    if (chainWallets.length === 0) {
      throw new Error(`No wallets available for chain: ${transaction.chainId}`);
    }

    // Filter by role if transaction type suggests a specific role
    let candidateWallets = chainWallets;
    
    if (transaction.type === TransactionType.DEPLOYMENT) {
      const operationalWallets = chainWallets.filter(w => w.role === WalletRole.OPERATIONS);
      if (operationalWallets.length > 0) {
        candidateWallets = operationalWallets;
      }
    }

    // Score wallets based on multiple factors
    const scoredWallets = candidateWallets.map(wallet => ({
      wallet,
      score: this.calculateWalletScore(wallet, transaction)
    }));

    // Sort by score (highest first)
    scoredWallets.sort((a, b) => b.score - a.score);

    return scoredWallets[0].wallet;
  }

  private async loadManagedWallets(): Promise<void> {
    // In production, load from secure storage
    // For now, create some mock wallets
    const mockWallets: WalletCreationRequest[] = [
      {
        name: 'Primary Operations Wallet',
        role: WalletRole.OPERATIONS,
        type: WalletType.HOT,
        chain: '1',
        initialBalance: { ETH: BigInt('1000000000000000000') } // 1 ETH
      },
      {
        name: 'Treasury Vault',
        role: WalletRole.TREASURY,
        type: WalletType.COLD,
        chain: '1',
        initialBalance: { ETH: BigInt('10000000000000000000') } // 10 ETH
      },
      {
        name: 'Yield Farming Wallet',
        role: WalletRole.YIELD_FARMING,
        type: WalletType.WARM,
        chain: '1',
        initialBalance: { ETH: BigInt('5000000000000000000') } // 5 ETH
      }
    ];

    for (const request of mockWallets) {
      await this.createWallet(request);
    }

    this.logger.info('Managed wallets loaded', { count: mockWallets.length });
  }

  private generateWalletAddress(): string {
    // In production, would use proper cryptographic key generation
    return '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private addWalletToRoleMap(wallet: ManagedWallet): void {
    if (!this.walletsByRole.has(wallet.role)) {
      this.walletsByRole.set(wallet.role, []);
    }
    this.walletsByRole.get(wallet.role)!.push(wallet);
  }

  private addWalletToChainMap(wallet: ManagedWallet): void {
    if (!this.walletsByChain.has(wallet.chain)) {
      this.walletsByChain.set(wallet.chain, []);
    }  
    this.walletsByChain.get(wallet.chain)!.push(wallet);
  }

  private async createWalletBackup(wallet: ManagedWallet): Promise<void> {
    // In production, implement secure backup based on strategy
    this.logger.info('Wallet backup created', {
      walletId: wallet.id,
      strategy: wallet.metadata.backupStrategy
    });
  }

  private initializeAnomalyDetectionRules(): void {
    this.anomalyRules = [
      {
        name: 'unusual_transaction_volume',
        description: 'Detect unusually high transaction volume',
        threshold: 10, // transactions per hour
        timeWindow: 3600000, // 1 hour
        severity: 'medium',
        action: 'alert',
        enabled: true
      },
      {
        name: 'large_balance_change',
        description: 'Detect sudden large balance changes',
        threshold: 0.5, // 50% balance change
        timeWindow: 600000, // 10 minutes
        severity: 'high',
        action: 'pause',
        enabled: true
      },
      {
        name: 'failed_transaction_spike',
        description: 'Detect spike in failed transactions',
        threshold: 5, // failed transactions
        timeWindow: 1800000, // 30 minutes
        severity: 'medium',
        action: 'alert',
        enabled: true
      },
      {
        name: 'unauthorized_access_attempt',
        description: 'Detect potential unauthorized access',
        threshold: 3, // access attempts
        timeWindow: 300000, // 5 minutes
        severity: 'critical',
        action: 'emergency_stop',
        enabled: true
      }
    ];
  }

  private startSecurityMonitoring(): void {
    this.securityCheckInterval = setInterval(async () => {
      try {
        await this.performSecuritySweep();
      } catch (error) {
        this.logger.error('Security sweep failed:', error);
      }
    }, this.config.securityCheckInterval);
  }

  private startBalanceMonitoring(): void {
    this.balanceCheckInterval = setInterval(async () => {
      try {
        await this.performBalanceCheck();
      } catch (error) {
        this.logger.error('Balance check failed:', error);
      }
    }, this.config.balanceCheckInterval);
  }

  private startRotationService(): void {
    this.rotationCheckInterval = setInterval(async () => {
      try {
        await this.checkRotationSchedule();
      } catch (error) {
        this.logger.error('Rotation check failed:', error);
      }
    }, this.config.rotationInterval);
  }

  private async performSecuritySweep(): Promise<void> {
    for (const [walletId, wallet] of this.managedWallets) {
      try {
        await this.checkWalletSecurity(walletId);
      } catch (error) {
        this.logger.error(`Security check failed for wallet ${walletId}:`, error);
      }
    }

    // Update average security score
    const scores = Array.from(this.managedWallets.values())
      .map(w => w.health.securityScore);
    this.averageSecurityScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private async performBalanceCheck(): Promise<void> {
    for (const [walletId, wallet] of this.managedWallets) {
      try {
        const balanceCheck = await this.verifyWalletBalance(wallet);
        if (!balanceCheck.consistent) {
          await this.createSecurityAlert(walletId, 'balance_drain', 'high',
            'Balance inconsistency detected during routine check');
        }
      } catch (error) {
        this.logger.error(`Balance check failed for wallet ${walletId}:`, error);
      }
    }
  }

  private async checkRotationSchedule(): Promise<void> {
    if (!this.config.enableRotation) return;

    const now = Date.now();
    for (const [walletId, wallet] of this.managedWallets) {
      const lastRotation = wallet.metadata.lastRotation || wallet.metadata.createdAt;
      const timeSinceRotation = now - lastRotation.getTime();

      if (timeSinceRotation >= this.config.rotationInterval) {
        await this.rotateWallet(walletId, 'scheduled_rotation');
      }
    }
  }

  private async detectWalletAnomalies(wallet: ManagedWallet): Promise<string[]> {
    const anomalies: string[] = [];

    // Check against each anomaly rule
    for (const rule of this.anomalyRules.filter(r => r.enabled)) {
      const detected = await this.checkAnomalyRule(wallet, rule);
      if (detected) {
        anomalies.push(rule.name);
      }
    }

    return anomalies;
  }

  private async checkAnomalyRule(wallet: ManagedWallet, rule: AnomalyDetectionRule): Promise<boolean> {
    // In production, would check actual transaction history and patterns
    // For now, simulate anomaly detection
    const randomValue = Math.random();
    return randomValue < 0.1; // 10% chance of anomaly
  }

  private async verifyWalletBalance(wallet: ManagedWallet): Promise<{ consistent: boolean; details?: string }> {
    // In production, would verify against blockchain
    // For now, simulate balance verification
    return { consistent: Math.random() > 0.05 }; // 95% consistent
  }

  private async analyzeTransactionPatterns(wallet: ManagedWallet): Promise<{ suspicious: boolean; patterns?: string[] }> {
    // In production, would analyze actual transaction patterns
    // For now, simulate pattern analysis
    return { suspicious: Math.random() < 0.05 }; // 5% suspicious
  }

  private async performAISecurityAnalysis(wallet: ManagedWallet): Promise<{ riskScore: number; insights?: string }> {
    const prompt = `Analyze the security profile of this wallet:

Wallet Information:
- ID: ${wallet.id}
- Address: ${wallet.address}
- Role: ${wallet.role}
- Type: ${wallet.type}
- Health Score: ${wallet.health.securityScore}
- Issues: ${wallet.health.issues.join(', ') || 'None'}
- Last Activity: ${wallet.lastActivity.toISOString()}

Assess the risk level and provide security insights.`;

    try {
      const response = await this.aiClient.generateText({
        prompt,
        temperature: 0.2,
        maxTokens: 300
      });

      // Parse AI response to extract risk score
      // In production, would use structured output
      const riskScore = Math.random() * 0.3; // Simulate low risk

      return {
        riskScore,
        insights: response.data?.text || 'AI analysis unavailable'
      };
    } catch (error) {
      this.logger.warn('AI security analysis failed:', error);
      return { riskScore: 0.1 }; // Default low risk
    }
  }

  private async createSecurityAlert(
    walletId: string,
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    description: string
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      walletId,
      type,
      severity,
      description,
      timestamp: new Date(),
      resolved: false
    };

    this.securityAlerts.set(alert.id, alert);
    this.securityIncidents++;

    this.emit('security_alert', alert);

    this.logger.warn('Security alert created', {
      alertId: alert.id,
      walletId,
      type,
      severity,
      description
    });
  }

  private calculateWalletScore(wallet: ManagedWallet, transaction: Partial<PendingTransaction>): number {
    let score = 0;

    // Health score factor (40% weight)
    score += wallet.health.securityScore * 0.4;

    // Balance adequacy (30% weight)
    const hasBalance = Object.keys(wallet.balance).length > 0;
    score += hasBalance ? 30 : 0;

    // Activity recency (20% weight)
    const hoursSinceActivity = (Date.now() - wallet.lastActivity.getTime()) / (1000 * 60 * 60);
    const activityScore = Math.max(0, 20 - hoursSinceActivity);
    score += activityScore;

    // Type preference (10% weight)
    if (transaction.priority === TransactionPriority.CRITICAL && wallet.type === WalletType.HOT) {
      score += 10;
    } else if (transaction.priority === TransactionPriority.LOW && wallet.type === WalletType.COLD) {
      score += 5;
    }

    return score;
  }

  private async createTransferTransactions(
    fromWallet: ManagedWallet,
    toWallet: ManagedWallet
  ): Promise<PendingTransaction[]> {
    const transactions: PendingTransaction[] = [];

    // Create transfer transactions for each asset
    for (const [asset, balance] of Object.entries(fromWallet.balance)) {
      if (balance > 0n) {
        const tx: PendingTransaction = {
          id: `transfer_${fromWallet.id}_${toWallet.id}_${asset}_${Date.now()}`,
          type: TransactionType.WITHDRAWAL,
          from: fromWallet.address,
          to: toWallet.address,
          value: balance,
          data: '0x',
          chainId: fromWallet.chain,
          priority: TransactionPriority.HIGH
        };
        transactions.push(tx);
      }
    }

    return transactions;
  }

  private async executeWalletRotation(rotationId: string): Promise<void> {
    const plan = this.rotationPlans.get(rotationId);
    if (!plan) {
      throw new Error(`Rotation plan not found: ${rotationId}`);
    }

    try {
      plan.status = 'executing';

      // Execute transfer transactions
      for (const tx of plan.transferTransactions) {
        // In production, would execute actual transactions
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate execution
      }

      // Update wallet status
      plan.currentWallet.metadata.rotatedAt = new Date();
      plan.currentWallet.metadata.rotatedTo = plan.newWallet.id;

      plan.status = 'completed';
      this.rotationsPerformed++;

      this.emit('wallet_rotated', {
        rotationId,
        oldWalletId: plan.currentWallet.id,
        newWalletId: plan.newWallet.id
      });

      this.logger.info('Wallet rotation completed', {
        rotationId,
        oldWallet: plan.currentWallet.id,
        newWallet: plan.newWallet.id
      });
    } catch (error) {
      plan.status = 'failed';
      this.logger.error('Wallet rotation failed:', error);
      throw error;
    }
  }

  private logAuditEntry(entry: Omit<WalletAuditEntry, 'id' | 'timestamp'>): void {
    if (!this.config.auditTrailEnabled) return;

    const auditEntry: WalletAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry
    };

    this.auditTrail.push(auditEntry);

    // Keep only recent entries (last 10000)
    if (this.auditTrail.length > 10000) {
      this.auditTrail = this.auditTrail.slice(-10000);
    }
  }

  // Public API methods

  getAllWallets(): ManagedWallet[] {
    return Array.from(this.managedWallets.values());
  }

  getWallet(walletId: string): ManagedWallet | undefined {
    return this.managedWallets.get(walletId);
  }

  getSecurityAlerts(resolved: boolean = false): SecurityAlert[] {
    return Array.from(this.securityAlerts.values())
      .filter(alert => alert.resolved === resolved);
  }

  getRotationPlans(): WalletRotationPlan[] {
    return Array.from(this.rotationPlans.values());
  }

  getAuditTrail(walletId?: string): WalletAuditEntry[] {
    if (walletId) {
      return this.auditTrail.filter(entry => entry.walletId === walletId);
    }
    return this.auditTrail;
  }

  async resolveSecurityAlert(alertId: string, actionTaken: string): Promise<void> {
    const alert = this.securityAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Security alert not found: ${alertId}`);
    }

    alert.resolved = true;
    alert.actionTaken = actionTaken;

    this.logAuditEntry({
      walletId: alert.walletId,
      action: 'security_alert_resolved',
      details: { alertId, actionTaken },
      initiator: 'system',
      result: 'success'
    });
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      totalWalletsManaged: this.totalWalletsManaged,
      activeWallets: this.managedWallets.size,
      securityIncidents: this.securityIncidents,
      rotationsPerformed: this.rotationsPerformed,
      averageSecurityScore: this.averageSecurityScore,
      pendingAlerts: this.getSecurityAlerts(false).length,
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Wallet Manager...');

    if (this.securityCheckInterval) {
      clearInterval(this.securityCheckInterval);
    }

    if (this.balanceCheckInterval) {
      clearInterval(this.balanceCheckInterval);
    }

    if (this.rotationCheckInterval) {
      clearInterval(this.rotationCheckInterval);
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }
}