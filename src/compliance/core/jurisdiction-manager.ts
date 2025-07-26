/**
 * Jurisdiction Manager
 * Manages regulatory requirements and configurations across multiple jurisdictions
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import {
  Jurisdiction,
  JurisdictionConfig,
  ComplianceCategory,
  User,
  Transaction,
  ComplianceRule,
  RiskLevel
} from '../types';
import { JURISDICTION_CONFIGS, RISK_SCORING_MATRICES } from '../config';

const logger = Logger.getLogger('jurisdiction-manager');

export class JurisdictionManager extends EventEmitter {
  private jurisdictions: Map<Jurisdiction, JurisdictionConfig> = new Map();
  private activeJurisdictions: Set<Jurisdiction> = new Set();
  private isInitialized = false;

  constructor(jurisdictionConfigs: JurisdictionConfig[]) {
    super();
    this.loadJurisdictions(jurisdictionConfigs);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Jurisdiction Manager already initialized');
      return;
    }

    try {
      logger.info('Initializing Jurisdiction Manager...');

      // Validate jurisdiction configurations
      await this.validateJurisdictions();

      // Set up monitoring for regulatory changes
      await this.setupRegulatoryMonitoring();

      this.isInitialized = true;
      logger.info('✅ Jurisdiction Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Jurisdiction Manager:', error);
      throw error;
    }
  }

  async updateConfiguration(newJurisdictions: JurisdictionConfig[]): Promise<void> {
    const previousActive = new Set(this.activeJurisdictions);
    
    this.jurisdictions.clear();
    this.activeJurisdictions.clear();
    this.loadJurisdictions(newJurisdictions);

    await this.validateJurisdictions();

    // Detect changes and emit events
    const changes = this.detectConfigurationChanges(previousActive);
    if (changes.length > 0) {
      this.emit('configuration_changed', {
        changes,
        timestamp: new Date()
      });
    }

    logger.info('Jurisdiction Manager configuration updated');
  }

  /**
   * Get jurisdiction configuration
   */
  getJurisdiction(jurisdiction: Jurisdiction): JurisdictionConfig | undefined {
    return this.jurisdictions.get(jurisdiction);
  }

  /**
   * Get all active jurisdictions
   */
  getActiveJurisdictions(): Jurisdiction[] {
    return Array.from(this.activeJurisdictions);
  }

  /**
   * Check if jurisdiction is supported and active
   */
  isJurisdictionActive(jurisdiction: Jurisdiction): boolean {
    return this.activeJurisdictions.has(jurisdiction);
  }

  /**
   * Get requirements for a specific jurisdiction and category
   */
  getRequirements(jurisdiction: Jurisdiction, category: ComplianceCategory): any[] {
    const jurisdictionConfig = this.jurisdictions.get(jurisdiction);
    if (!jurisdictionConfig) {
      throw new Error(`Jurisdiction not found: ${jurisdiction}`);
    }

    return jurisdictionConfig.requirements.filter(req => req.category === category);
  }

  /**
   * Get thresholds for a jurisdiction
   */
  getThresholds(jurisdiction: Jurisdiction): any[] {
    const jurisdictionConfig = this.jurisdictions.get(jurisdiction);
    if (!jurisdictionConfig) {
      throw new Error(`Jurisdiction not found: ${jurisdiction}`);
    }

    return jurisdictionConfig.thresholds;
  }

  /**
   * Get reporting requirements for a jurisdiction
   */
  getReportingRequirements(jurisdiction: Jurisdiction): any[] {
    const jurisdictionConfig = this.jurisdictions.get(jurisdiction);
    if (!jurisdictionConfig) {
      throw new Error(`Jurisdiction not found: ${jurisdiction}`);
    }

    return jurisdictionConfig.reporting;
  }

  /**
   * Determine primary jurisdiction for a user
   */
  determinePrimaryJurisdiction(user: User): Jurisdiction {
    // Primary logic: user's declared jurisdiction
    if (this.isJurisdictionActive(user.jurisdiction)) {
      return user.jurisdiction;
    }

    // Fallback logic: residence country mapping
    const residenceJurisdiction = this.mapCountryToJurisdiction(user.residenceCountry);
    if (residenceJurisdiction && this.isJurisdictionActive(residenceJurisdiction)) {
      return residenceJurisdiction;
    }

    // Final fallback: first citizenship that maps to active jurisdiction
    for (const citizenship of user.citizenships) {
      const citizenshipJurisdiction = this.mapCountryToJurisdiction(citizenship);
      if (citizenshipJurisdiction && this.isJurisdictionActive(citizenshipJurisdiction)) {
        return citizenshipJurisdiction;
      }
    }

    // Default to US if no other jurisdiction applies
    return 'US';
  }

  /**
   * Get all applicable jurisdictions for a user
   */
  getApplicableJurisdictions(user: User): Jurisdiction[] {
    const jurisdictions = new Set<Jurisdiction>();

    // Add primary jurisdiction
    jurisdictions.add(this.determinePrimaryJurisdiction(user));

    // Add jurisdictions based on citizenship
    for (const citizenship of user.citizenships) {
      const jurisdiction = this.mapCountryToJurisdiction(citizenship);
      if (jurisdiction && this.isJurisdictionActive(jurisdiction)) {
        jurisdictions.add(jurisdiction);
      }
    }

    // Add jurisdiction based on residence
    const residenceJurisdiction = this.mapCountryToJurisdiction(user.residenceCountry);
    if (residenceJurisdiction && this.isJurisdictionActive(residenceJurisdiction)) {
      jurisdictions.add(residenceJurisdiction);
    }

    return Array.from(jurisdictions);
  }

  /**
   * Get jurisdictional risk score for a user
   */
  calculateJurisdictionalRisk(user: User): number {
    let totalRisk = 0;
    let jurisdictionCount = 0;

    const applicableJurisdictions = this.getApplicableJurisdictions(user);

    for (const jurisdiction of applicableJurisdictions) {
      const riskScore = RISK_SCORING_MATRICES.country[jurisdiction] || 50;
      totalRisk += riskScore;
      jurisdictionCount++;
    }

    // Add risk for high-risk countries in user profile
    for (const country of user.riskProfile.highRiskCountries) {
      const riskScore = RISK_SCORING_MATRICES.country[country] || 90;
      totalRisk += riskScore * 0.5; // Weight high-risk countries less than primary jurisdictions
    }

    return jurisdictionCount > 0 ? totalRisk / jurisdictionCount : 50;
  }

  /**
   * Check if transaction crosses jurisdictional boundaries
   */
  isCrossBorderTransaction(transaction: Transaction, user: User): boolean {
    const userJurisdictions = this.getApplicableJurisdictions(user);
    
    // Check if transaction involves addresses from different jurisdictions
    if (transaction.fromAddress || transaction.toAddress) {
      // This would need integration with address analysis services
      // For now, return false - this is a placeholder
      return false;
    }

    // Check if transaction involves multiple currencies from different jurisdictions
    const transactionJurisdiction = this.getCurrencyJurisdiction(transaction.currency);
    if (transactionJurisdiction && !userJurisdictions.includes(transactionJurisdiction)) {
      return true;
    }

    return false;
  }

  /**
   * Get regulatory business hours for a jurisdiction
   */
  getBusinessHours(jurisdiction: Jurisdiction): any {
    return JURISDICTION_CONFIGS[jurisdiction]?.businessHours || {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };
  }

  /**
   * Get supported languages for a jurisdiction
   */
  getSupportedLanguages(jurisdiction: Jurisdiction): string[] {
    return JURISDICTION_CONFIGS[jurisdiction]?.languages || ['en'];
  }

  /**
   * Get regulators for a jurisdiction
   */
  getRegulators(jurisdiction: Jurisdiction): string[] {
    return JURISDICTION_CONFIGS[jurisdiction]?.regulators || [];
  }

  /**
   * Get timezone for a jurisdiction
   */
  getTimezone(jurisdiction: Jurisdiction): string {
    return JURISDICTION_CONFIGS[jurisdiction]?.timezone || 'UTC';
  }

  /**
   * Get reporting requirements for a jurisdiction
   */
  getJurisdictionReportingRequirements(jurisdiction: Jurisdiction): any {
    return JURISDICTION_CONFIGS[jurisdiction]?.reportingRequirements || {};
  }

  /**
   * Check if it's currently business hours in a jurisdiction
   */
  isBusinessHours(jurisdiction: Jurisdiction): boolean {
    const timezone = this.getTimezone(jurisdiction);
    const businessHours = this.getBusinessHours(jurisdiction);
    
    const now = new Date();
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      hour12: false
    }).formatToParts(now);

    const currentHour = localTime.find(part => part.type === 'hour')?.value;
    const currentMinute = localTime.find(part => part.type === 'minute')?.value;
    const currentDay = localTime.find(part => part.type === 'weekday')?.value;

    if (!currentHour || !currentMinute || !currentDay) {
      return false;
    }

    const currentTime = `${currentHour}:${currentMinute}`;
    
    return businessHours.days.includes(currentDay) &&
           currentTime >= businessHours.start &&
           currentTime <= businessHours.end;
  }

  /**
   * Get manager status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      totalJurisdictions: this.jurisdictions.size,
      activeJurisdictions: this.activeJurisdictions.size,
      jurisdictionList: Array.from(this.activeJurisdictions),
      configurationSummary: Array.from(this.jurisdictions.entries()).map(([jurisdiction, config]) => ({
        jurisdiction,
        enabled: config.enabled,
        requirementsCount: config.requirements.length,
        thresholdsCount: config.thresholds.length,
        reportingCount: config.reporting.length
      }))
    };
  }

  // Private methods

  private loadJurisdictions(jurisdictionConfigs: JurisdictionConfig[]): void {
    for (const config of jurisdictionConfigs) {
      this.jurisdictions.set(config.jurisdiction, config);
      if (config.enabled) {
        this.activeJurisdictions.add(config.jurisdiction);
      }
    }

    logger.info('Loaded jurisdictions', {
      total: this.jurisdictions.size,
      active: this.activeJurisdictions.size
    });
  }

  private async validateJurisdictions(): Promise<void> {
    for (const [jurisdiction, config] of this.jurisdictions) {
      if (config.enabled) {
        await this.validateJurisdictionConfig(jurisdiction, config);
      }
    }
  }

  private async validateJurisdictionConfig(jurisdiction: Jurisdiction, config: JurisdictionConfig): Promise<void> {
    // Validate required fields
    if (!config.requirements || config.requirements.length === 0) {
      logger.warn(`No requirements defined for jurisdiction: ${jurisdiction}`);
    }

    if (!config.thresholds || config.thresholds.length === 0) {
      logger.warn(`No thresholds defined for jurisdiction: ${jurisdiction}`);
    }

    if (!config.reporting || config.reporting.length === 0) {
      logger.warn(`No reporting requirements defined for jurisdiction: ${jurisdiction}`);
    }

    // Validate threshold values
    for (const threshold of config.thresholds) {
      if (threshold.value <= 0) {
        throw new Error(`Invalid threshold value for ${jurisdiction}: ${threshold.name}`);
      }
    }

    logger.debug(`Validated jurisdiction configuration: ${jurisdiction}`);
  }

  private async setupRegulatoryMonitoring(): Promise<void> {
    // Set up monitoring for regulatory changes
    // This would integrate with regulatory data feeds
    logger.info('Setting up regulatory monitoring for active jurisdictions');
  }

  private detectConfigurationChanges(previousActive: Set<Jurisdiction>): string[] {
    const changes: string[] = [];
    
    // Check for newly activated jurisdictions
    for (const jurisdiction of this.activeJurisdictions) {
      if (!previousActive.has(jurisdiction)) {
        changes.push(`Activated jurisdiction: ${jurisdiction}`);
      }
    }

    // Check for deactivated jurisdictions
    for (const jurisdiction of previousActive) {
      if (!this.activeJurisdictions.has(jurisdiction)) {
        changes.push(`Deactivated jurisdiction: ${jurisdiction}`);
      }
    }

    return changes;
  }

  private mapCountryToJurisdiction(country: string): Jurisdiction | null {
    // Mapping of countries to regulatory jurisdictions
    const countryMapping: Record<string, Jurisdiction> = {
      'United States': 'US',
      'US': 'US',
      'USA': 'US',
      'United Kingdom': 'UK',
      'UK': 'UK',
      'Great Britain': 'UK',
      'Germany': 'EU',
      'France': 'EU',
      'Italy': 'EU',
      'Spain': 'EU',
      'Netherlands': 'EU',
      'Belgium': 'EU',
      'Portugal': 'EU',
      'Austria': 'EU',
      'Ireland': 'EU',
      'Luxembourg': 'EU',
      'Singapore': 'Singapore',
      'SG': 'Singapore',
      'Switzerland': 'Switzerland',
      'CH': 'Switzerland',
      'Japan': 'Japan',
      'JP': 'Japan',
      'Canada': 'Canada',
      'CA': 'Canada',
      'Australia': 'Australia',
      'AU': 'Australia',
      'Hong Kong': 'Hong Kong',
      'HK': 'Hong Kong',
      'Dubai': 'Dubai',
      'UAE': 'Dubai',
      'Cayman Islands': 'Cayman Islands',
      'KY': 'Cayman Islands',
      'British Virgin Islands': 'BVI',
      'VG': 'BVI'
    };

    return countryMapping[country] || null;
  }

  private getCurrencyJurisdiction(currency: string): Jurisdiction | null {
    const currencyMapping: Record<string, Jurisdiction> = {
      'USD': 'US',
      'EUR': 'EU',
      'GBP': 'UK',
      'SGD': 'Singapore',
      'CHF': 'Switzerland',
      'JPY': 'Japan',
      'CAD': 'Canada',
      'AUD': 'Australia',
      'HKD': 'Hong Kong'
    };

    return currencyMapping[currency] || null;
  }
}