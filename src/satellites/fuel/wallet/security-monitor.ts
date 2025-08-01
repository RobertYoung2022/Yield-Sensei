/**
 * Security Monitor
 * Advanced security monitoring and threat detection for wallet management
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { getUnifiedAIClient, UnifiedAIClient } from '../../../integrations/ai/unified-ai-client';
import { ManagedWallet, SecurityAlert } from '../types';

export interface SecurityMonitorConfig {
  monitoringInterval: number; // milliseconds
  threatIntelligenceEnabled: boolean;
  behavioralAnalysisEnabled: boolean;
  networkAnalysisEnabled: boolean;
  complianceCheckEnabled: boolean;
  realTimeAlertsEnabled: boolean;
  maxAlertsPerHour: number;
  quarantineThreshold: number; // risk score threshold
}

export interface ThreatIntelligence {
  maliciousAddresses: Set<string>;
  suspiciousTransactionPatterns: string[];
  knownAttackVectors: string[];
  blacklistedDomains: Set<string>;
  riskScoreThresholds: Record<string, number>;
  lastUpdate: Date;
}

export interface BehavioralProfile {
  walletId: string;
  normalTransactionVolume: number;
  normalTransactionFrequency: number;
  usualTimeWindows: number[]; // hours of day
  typicalGasUsage: number;
  commonCounterparties: Set<string>;
  riskScore: number;
  lastUpdated: Date;
}

export interface SecurityMetrics {
  threatsDetected: number;
  threatsBlocked: number;
  falsePositives: number;
  averageResponseTime: number;
  securityScore: number;
  complianceScore: number;
  lastThreatDetection: Date;
}

export interface ComplianceCheck {
  type: 'kyc' | 'aml' | 'sanctions' | 'geographic' | 'regulatory';
  status: 'passed' | 'failed' | 'pending' | 'requires_review';
  details: string;
  timestamp: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface NetworkAnalysis {
  walletId: string;
  connectedAddresses: string[];
  riskPropagation: number;
  communityDetection: string[];
  centralityScore: number;
  clusteringCoefficient: number;
  shortestPathToRisk: number;
}

export class SecurityMonitor extends EventEmitter {
  private logger: Logger;
  private config: SecurityMonitorConfig;
  private aiClient: UnifiedAIClient;
  private isInitialized: boolean = false;

  // Threat intelligence
  private threatIntelligence: ThreatIntelligence;
  private behavioralProfiles: Map<string, BehavioralProfile> = new Map();
  private networkAnalysis: Map<string, NetworkAnalysis> = new Map();

  // Security state
  private activeThreats: Map<string, SecurityAlert> = new Map();
  private quarantinedWallets: Set<string> = new Set();
  private securityMetrics: SecurityMetrics;

  // Monitoring intervals
  private monitoringInterval?: NodeJS.Timeout;
  private threatIntelligenceUpdateInterval?: NodeJS.Timeout;

  constructor(config: SecurityMonitorConfig) {
    super();
    this.config = config;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [SecurityMonitor] ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/security-monitor.log' })
      ],
    });

    this.threatIntelligence = {
      maliciousAddresses: new Set(),
      suspiciousTransactionPatterns: [],
      knownAttackVectors: [],
      blacklistedDomains: new Set(),
      riskScoreThresholds: {
        low: 0.3,
        medium: 0.6,
        high: 0.8,
        critical: 0.95
      },
      lastUpdate: new Date()
    };

    this.securityMetrics = {
      threatsDetected: 0,
      threatsBlocked: 0,
      falsePositives: 0,
      averageResponseTime: 0,
      securityScore: 100,
      complianceScore: 100,
      lastThreatDetection: new Date()
    };
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Security Monitor...');

      // Initialize AI client
      this.aiClient = getUnifiedAIClient();

      // Load threat intelligence
      await this.loadThreatIntelligence();

      // Start monitoring services
      this.startSecurityMonitoring();
      
      if (this.config.threatIntelligenceEnabled) {
        this.startThreatIntelligenceUpdates();
      }

      this.isInitialized = true;
      this.logger.info('Security Monitor initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Security Monitor:', error);
      throw error;
    }
  }

  async assessWalletSecurity(wallet: ManagedWallet): Promise<{
    riskScore: number;
    threats: string[];
    recommendations: string[];
    complianceStatus: ComplianceCheck[];
  }> {
    try {
      let riskScore = 0;
      const threats: string[] = [];
      const recommendations: string[] = [];
      const complianceStatus: ComplianceCheck[] = [];

      // Check against threat intelligence
      if (this.threatIntelligence.maliciousAddresses.has(wallet.address)) {
        threats.push('Address found in threat intelligence database');
        riskScore += 0.8;
      }

      // Behavioral analysis
      if (this.config.behavioralAnalysisEnabled) {
        const behavioralRisk = await this.analyzeBehavioralRisk(wallet);
        riskScore += behavioralRisk.score;
        threats.push(...behavioralRisk.threats);
        recommendations.push(...behavioralRisk.recommendations);
      }

      // Network analysis
      if (this.config.networkAnalysisEnabled) {
        const networkRisk = await this.analyzeNetworkRisk(wallet);
        riskScore += networkRisk.score;
        threats.push(...networkRisk.threats);
      }

      // Compliance checks
      if (this.config.complianceCheckEnabled) {
        const compliance = await this.performComplianceChecks(wallet);
        complianceStatus.push(...compliance);
        
        const failedChecks = compliance.filter(c => c.status === 'failed');
        riskScore += failedChecks.length * 0.2;
      }

      // AI-powered risk assessment
      const aiRisk = await this.performAIRiskAssessment(wallet, threats);
      riskScore += aiRisk.score;
      recommendations.push(...aiRisk.recommendations);

      // Normalize risk score
      riskScore = Math.min(1, riskScore);

      return {
        riskScore,
        threats,
        recommendations,
        complianceStatus
      };
    } catch (error) {
      this.logger.error('Wallet security assessment failed:', error);
      throw error;
    }
  }

  async detectRealTimeThreats(wallet: ManagedWallet, transactionData?: any): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    try {
      // Check transaction against known patterns
      if (transactionData) {
        const patternThreats = this.detectSuspiciousPatterns(transactionData);
        alerts.push(...patternThreats);
      }

      // Check behavioral anomalies
      const behavioralThreats = await this.detectBehavioralAnomalies(wallet);
      alerts.push(...behavioralThreats);

      // Check network-based threats
      const networkThreats = await this.detectNetworkThreats(wallet);
      alerts.push(...networkThreats);

      // AI-powered threat detection
      const aiThreats = await this.detectAIThreats(wallet, transactionData);
      alerts.push(...aiThreats);

      // Update metrics
      this.securityMetrics.threatsDetected += alerts.length;
      if (alerts.length > 0) {
        this.securityMetrics.lastThreatDetection = new Date();
      }

      // Emit alerts
      for (const alert of alerts) {
        this.emit('threat_detected', alert);
        
        if (alert.severity === 'critical') {
          await this.handleCriticalThreat(wallet, alert);
        }
      }

      return alerts;
    } catch (error) {
      this.logger.error('Real-time threat detection failed:', error);
      return [];
    }
  }

  async quarantineWallet(walletId: string, reason: string): Promise<void> {
    this.quarantinedWallets.add(walletId);
    
    this.logger.warn('Wallet quarantined', { walletId, reason });
    
    this.emit('wallet_quarantined', {
      walletId,
      reason,
      timestamp: new Date()
    });
  }

  async releaseQuarantine(walletId: string, justification: string): Promise<void> {
    this.quarantinedWallets.delete(walletId);
    
    this.logger.info('Wallet released from quarantine', { walletId, justification });
    
    this.emit('quarantine_released', {
      walletId,
      justification,
      timestamp: new Date()
    });
  }

  isWalletQuarantined(walletId: string): boolean {
    return this.quarantinedWallets.has(walletId);
  }

  private async loadThreatIntelligence(): Promise<void> {
    // In production, load from threat intelligence feeds
    // For now, populate with mock data
    this.threatIntelligence.maliciousAddresses.add('0x0000000000000000000000000000000000000000');
    this.threatIntelligence.suspiciousTransactionPatterns.push('rapid_succession_transfers');
    this.threatIntelligence.knownAttackVectors.push('flash_loan_exploit');
    this.threatIntelligence.blacklistedDomains.add('malicious-defi.com');

    this.logger.info('Threat intelligence loaded');
  }

  private startSecurityMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSecuritySweep();
      } catch (error) {
        this.logger.error('Security sweep failed:', error);
      }
    }, this.config.monitoringInterval);
  }

  private startThreatIntelligenceUpdates(): void {
    this.threatIntelligenceUpdateInterval = setInterval(async () => {
      try {
        await this.updateThreatIntelligence();
      } catch (error) {
        this.logger.error('Threat intelligence update failed:', error);
      }
    }, 3600000); // Update every hour
  }

  private async performSecuritySweep(): Promise<void> {
    // Update behavioral profiles
    await this.updateBehavioralProfiles();
    
    // Refresh network analysis
    await this.refreshNetworkAnalysis();
    
    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  private async updateThreatIntelligence(): Promise<void> {
    // In production, fetch from threat intelligence APIs
    // For now, simulate updates
    this.threatIntelligence.lastUpdate = new Date();
    this.logger.debug('Threat intelligence updated');
  }

  private async analyzeBehavioralRisk(wallet: ManagedWallet): Promise<{
    score: number;
    threats: string[];
    recommendations: string[];
  }> {
    const profile = this.behavioralProfiles.get(wallet.id);
    const threats: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (!profile) {
      // No behavioral profile yet, create one
      await this.createBehavioralProfile(wallet);
      return { score: 0.1, threats: [], recommendations: ['Establishing behavioral baseline'] };
    }

    // Check for behavioral anomalies
    // In production, would analyze actual transaction patterns
    const anomalyScore = Math.random() * 0.3; // Simulate behavioral risk
    
    if (anomalyScore > 0.2) {
      threats.push('Unusual transaction patterns detected');
      recommendations.push('Review recent transaction activity');
    }

    return { score: anomalyScore, threats, recommendations };
  }

  private async analyzeNetworkRisk(wallet: ManagedWallet): Promise<{
    score: number;
    threats: string[];
  }> {
    const networkData = this.networkAnalysis.get(wallet.id);
    const threats: string[] = [];
    let score = 0;

    if (!networkData) {
      // No network analysis yet
      await this.performNetworkAnalysis(wallet);
      return { score: 0.05, threats: [] };
    }

    // Check network-based risks
    if (networkData.shortestPathToRisk < 3) {
      threats.push('Close network proximity to high-risk addresses');
      score += 0.3;
    }

    if (networkData.centralityScore > 0.8) {
      threats.push('High network centrality indicates potential target');
      score += 0.2;
    }

    return { score, threats };
  }

  private async performComplianceChecks(wallet: ManagedWallet): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // KYC check
    checks.push({
      type: 'kyc',
      status: 'passed', // Mock result
      details: 'Identity verification completed',
      timestamp: new Date(),
      riskLevel: 'low'
    });

    // AML check
    checks.push({
      type: 'aml',
      status: 'passed', // Mock result
      details: 'No money laundering indicators detected',
      timestamp: new Date(),
      riskLevel: 'low'
    });

    // Sanctions screening
    checks.push({
      type: 'sanctions',
      status: 'passed', // Mock result
      details: 'Address not found in sanctions lists',
      timestamp: new Date(),
      riskLevel: 'low'
    });

    return checks;
  }

  private async performAIRiskAssessment(wallet: ManagedWallet, threats: string[]): Promise<{
    score: number;
    recommendations: string[];
  }> {
    const prompt = `Assess the security risk for this wallet:

Wallet Details:
- Address: ${wallet.address}
- Role: ${wallet.role}
- Type: ${wallet.type}
- Health Score: ${wallet.health.securityScore}
- Detected Threats: ${threats.join(', ') || 'None'}

Provide a risk score (0-1) and security recommendations.`;

    try {
      const response = await this.aiClient.generateText({
        prompt,
        temperature: 0.3,
        maxTokens: 400
      });

      // Parse AI response (in production, would use structured output)
      const riskScore = Math.random() * 0.2; // Simulate low AI-detected risk
      const recommendations = [
        'Monitor transaction patterns closely',
        'Enable additional security measures',
        'Regular security audits recommended'
      ];

      return { score: riskScore, recommendations };
    } catch (error) {
      this.logger.warn('AI risk assessment failed:', error);
      return { score: 0.1, recommendations: ['AI analysis unavailable'] };
    }
  }

  private detectSuspiciousPatterns(transactionData: any): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];

    // Check for known suspicious patterns
    for (const pattern of this.threatIntelligence.suspiciousTransactionPatterns) {
      if (this.matchesPattern(transactionData, pattern)) {
        alerts.push({
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          walletId: transactionData.walletId,
          type: 'suspicious_activity',
          severity: 'medium',
          description: `Suspicious pattern detected: ${pattern}`,
          timestamp: new Date(),
          resolved: false
        });
      }
    }

    return alerts;
  }

  private async detectBehavioralAnomalies(wallet: ManagedWallet): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    
    // In production, would analyze actual behavioral patterns
    if (Math.random() < 0.05) { // 5% chance of behavioral anomaly
      alerts.push({
        id: `behavioral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        walletId: wallet.id,
        type: 'anomaly',
        severity: 'medium',
        description: 'Behavioral anomaly detected in transaction patterns',
        timestamp: new Date(),
        resolved: false
      });
    }

    return alerts;
  }

  private async detectNetworkThreats(wallet: ManagedWallet): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    
    // Check network-based threat indicators
    const networkData = this.networkAnalysis.get(wallet.id);
    if (networkData && networkData.shortestPathToRisk < 2) {
      alerts.push({
        id: `network_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        walletId: wallet.id,
        type: 'suspicious_activity',
        severity: 'high',
        description: 'Direct connection to high-risk address detected',
        timestamp: new Date(),
        resolved: false
      });
    }

    return alerts;
  }

  private async detectAIThreats(wallet: ManagedWallet, transactionData?: any): Promise<SecurityAlert[]> {
    // Use AI to detect sophisticated threats
    // For now, return empty array
    return [];
  }

  private async handleCriticalThreat(wallet: ManagedWallet, alert: SecurityAlert): Promise<void> {
    // Immediately quarantine wallet for critical threats
    await this.quarantineWallet(wallet.id, `Critical threat: ${alert.description}`);
    
    // Block transactions
    this.securityMetrics.threatsBlocked++;
    
    // Notify administrators
    this.emit('critical_threat', {
      walletId: wallet.id,
      alert,
      actionTaken: 'quarantine'
    });
  }

  private matchesPattern(transactionData: any, pattern: string): boolean {
    // In production, implement sophisticated pattern matching
    // For now, simulate pattern matching
    return Math.random() < 0.02; // 2% chance of pattern match
  }

  private async createBehavioralProfile(wallet: ManagedWallet): Promise<void> {
    const profile: BehavioralProfile = {
      walletId: wallet.id,
      normalTransactionVolume: 10, // Mock baseline
      normalTransactionFrequency: 5, // Mock baseline
      usualTimeWindows: [9, 10, 11, 14, 15, 16], // Business hours
      typicalGasUsage: 150000,
      commonCounterparties: new Set(),
      riskScore: 0.1,
      lastUpdated: new Date()
    };

    this.behavioralProfiles.set(wallet.id, profile);
  }

  private async performNetworkAnalysis(wallet: ManagedWallet): Promise<void> {
    const analysis: NetworkAnalysis = {
      walletId: wallet.id,
      connectedAddresses: [], // Would populate from transaction history
      riskPropagation: 0.1,
      communityDetection: [],
      centralityScore: 0.3,
      clusteringCoefficient: 0.2,
      shortestPathToRisk: 5
    };

    this.networkAnalysis.set(wallet.id, analysis);
  }

  private async updateBehavioralProfiles(): Promise<void> {
    // Update profiles based on recent activity
    for (const [walletId, profile] of this.behavioralProfiles) {
      profile.lastUpdated = new Date();
      // In production, would update based on real transaction data
    }
  }

  private async refreshNetworkAnalysis(): Promise<void> {
    // Refresh network analysis data
    // In production, would recompute network metrics
    this.logger.debug('Network analysis refreshed');
  }

  private cleanupOldAlerts(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [alertId, alert] of this.activeThreats) {
      if (alert.timestamp.getTime() < oneDayAgo && alert.resolved) {
        this.activeThreats.delete(alertId);
      }
    }
  }

  // Public API methods

  getThreatIntelligence(): ThreatIntelligence {
    return this.threatIntelligence;
  }

  getBehavioralProfile(walletId: string): BehavioralProfile | undefined {
    return this.behavioralProfiles.get(walletId);
  }

  getNetworkAnalysis(walletId: string): NetworkAnalysis | undefined {
    return this.networkAnalysis.get(walletId);
  }

  getSecurityMetrics(): SecurityMetrics {
    return this.securityMetrics;
  }

  getQuarantinedWallets(): string[] {
    return Array.from(this.quarantinedWallets);
  }

  getActiveThreats(): SecurityAlert[] {
    return Array.from(this.activeThreats.values());
  }

  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      quarantinedWallets: this.quarantinedWallets.size,
      activeThreats: this.activeThreats.size,
      behavioralProfiles: this.behavioralProfiles.size,
      securityMetrics: this.securityMetrics,
      config: this.config
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Security Monitor...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.threatIntelligenceUpdateInterval) {
      clearInterval(this.threatIntelligenceUpdateInterval);
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }
}