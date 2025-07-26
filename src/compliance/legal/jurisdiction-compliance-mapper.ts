/**
 * Jurisdiction-Specific Compliance Requirements Mapper
 * Maps legal entities to jurisdiction-specific compliance requirements
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { Jurisdiction } from '../types';
import {
  EntityType,
  ComplianceRequirement,
  ComplianceRequirementType,
  LegalEntity
} from './types/entity-types';

const logger = Logger.getLogger('jurisdiction-compliance-mapper');

export interface JurisdictionProfile {
  jurisdiction: Jurisdiction;
  name: string;
  regulatoryFramework: string;
  primaryRegulator: string;
  businessFormationRequirements: BusinessFormationRequirement[];
  ongoingComplianceRequirements: OngoingComplianceRequirement[];
  financialServicesRegulation: FinancialServicesRegulation;
  taxRequirements: TaxRequirement[];
  reportingRequirements: ReportingRequirement[];
  dataProtectionRequirements: DataProtectionRequirement;
  amlKycRequirements: AMLKYCRequirement;
  specializedRequirements: SpecializedRequirement[];
  reciprocityAgreements: string[]; // Other jurisdiction codes
  treatyNetwork: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: Date;
}

export interface BusinessFormationRequirement {
  entityType: EntityType;
  minimumCapital?: number;
  minimumDirectors: number;
  minimumShareholders: number;
  residentDirectorRequired: boolean;
  localAddressRequired: boolean;
  registrationTimeframe: number; // days
  registrationCost: number;
  currency: string;
  requiredDocuments: string[];
  prohibitedActivities: string[];
  restrictedOwnership?: OwnershipRestriction[];
}

export interface OwnershipRestriction {
  industry: string;
  maxForeignOwnership: number;
  requiresGovernmentApproval: boolean;
  additionalRequirements: string[];
}

export interface OngoingComplianceRequirement {
  type: ComplianceRequirementType;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'ongoing';
  description: string;
  regulator: string;
  penaltyForNonCompliance: string;
  deadline: string; // Relative to fiscal year end or absolute date
  applicableEntityTypes: EntityType[];
  minimumThresholds?: {
    revenue?: number;
    employees?: number;
    assets?: number;
  };
}

export interface FinancialServicesRegulation {
  primaryRegulator: string;
  licensingRequired: boolean;
  licenseTypes: LicenseType[];
  capitalRequirements: CapitalRequirement[];
  conductRules: ConductRule[];
  reportingStandards: string[]; // e.g., "IFRS", "GAAP"
  auditRequirements: AuditRequirement;
}

export interface LicenseType {
  name: string;
  code: string;
  description: string;
  activities: string[];
  minimumCapital: number;
  currency: string;
  validityPeriod: number; // years
  renewalRequired: boolean;
  fees: number;
  processingTime: number; // days
  requirements: string[];
}

export interface CapitalRequirement {
  licenseType: string;
  minimumCapital: number;
  riskBasedCapital?: boolean;
  bufferRequirements: number;
  currency: string;
  calculationMethod: string;
}

export interface ConductRule {
  category: string;
  description: string;
  applicableActivities: string[];
  penaltyType: 'fine' | 'suspension' | 'revocation' | 'criminal';
  maxPenalty?: number;
}

export interface AuditRequirement {
  required: boolean;
  frequency: 'annual' | 'semi_annual';
  auditorQualifications: string[];
  auditStandards: string[];
  filingDeadline: string;
  publicDisclosure: boolean;
}

export interface TaxRequirement {
  taxType: 'corporate' | 'vat' | 'withholding' | 'payroll' | 'other';
  rate: number;
  description: string;
  frequency: 'annual' | 'quarterly' | 'monthly';
  filingDeadline: string;
  paymentDeadline: string;
  penalties: string;
  exemptions?: string[];
  treatyBenefits?: boolean;
}

export interface ReportingRequirement {
  type: 'financial' | 'regulatory' | 'statistical' | 'beneficial_ownership' | 'transaction';
  regulator: string;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'real_time';
  description: string;
  format: string;
  deadline: string;
  publicDisclosure: boolean;
  applicableThresholds?: {
    revenue?: number;
    assets?: number;
    employees?: number;
    transactions?: number;
  };
}

export interface DataProtectionRequirement {
  regulation: string; // e.g., "GDPR", "CCPA", "PIPEDA"
  applicabilityThreshold: string;
  dataLocalisation: boolean;
  consentRequirements: string[];
  retentionLimits: Record<string, number>; // data type -> days
  breachNotificationTime: number; // hours
  dpoRequired: boolean;
  assessmentRequired: boolean;
  crossBorderTransferRestrictions: string[];
}

export interface AMLKYCRequirement {
  primaryRegulator: string;
  kycTiers: KYCTier[];
  transactionMonitoring: TransactionMonitoringRequirement;
  sarReporting: SARReportingRequirement;
  recordKeeping: RecordKeepingRequirement;
  training: TrainingRequirement;
  auditFrequency: 'annual' | 'semi_annual' | 'quarterly';
}

export interface KYCTier {
  level: 'basic' | 'enhanced' | 'professional' | 'institutional';
  description: string;
  documentRequirements: string[];
  verificationMethods: string[];
  refreshFrequency: number; // days
  transactionLimits?: {
    daily?: number;
    monthly?: number;
    annual?: number;
  };
}

export interface TransactionMonitoringRequirement {
  thresholds: {
    cash: number;
    wire: number;
    crypto: number;
  };
  monitoringScope: string[];
  alertGeneration: boolean;
  investigationTimeframe: number; // days
  reportingThresholds: {
    suspicious: number;
    large: number;
  };
}

export interface SARReportingRequirement {
  reportingTimeframe: number; // days
  reportingFormat: string;
  reportingMethod: 'electronic' | 'paper' | 'both';
  followUpRequired: boolean;
  confidentialityRequirements: string[];
}

export interface RecordKeepingRequirement {
  retentionPeriod: number; // years
  recordTypes: string[];
  accessRequirements: string[];
  destructionRequirements: string[];
  backupRequirements: string[];
}

export interface TrainingRequirement {
  frequency: 'annual' | 'semi_annual' | 'quarterly';
  minimumHours: number;
  recordKeeping: boolean;
  certificationRequired: boolean;
  roleBasedTraining: boolean;
}

export interface SpecializedRequirement {
  category: 'fintech' | 'crypto' | 'investment' | 'insurance' | 'banking' | 'payment' | 'other';
  description: string;
  regulator: string;
  requirements: string[];
  licenseRequired: boolean;
  capitalRequirements?: number;
  currency?: string;
  operationalRequirements: string[];
  reportingRequirements: string[];
}

export class JurisdictionComplianceMapper extends EventEmitter {
  private jurisdictionProfiles: Map<Jurisdiction, JurisdictionProfile> = new Map();
  private complianceTemplates: Map<string, ComplianceRequirement[]> = new Map();
  private isInitialized = false;

  private stats = {
    jurisdictionsLoaded: 0,
    entitiesAssessed: 0,
    requirementsGenerated: 0,
    complianceIssuesDetected: 0
  };

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Jurisdiction Compliance Mapper already initialized');
      return;
    }

    try {
      logger.info('Initializing Jurisdiction Compliance Mapper...');

      // Load jurisdiction profiles
      await this.loadJurisdictionProfiles();

      // Initialize compliance templates
      await this.initializeComplianceTemplates();

      this.isInitialized = true;
      logger.info('✅ Jurisdiction Compliance Mapper initialized successfully');

      this.emit('mapper_initialized', {
        jurisdictionsLoaded: this.jurisdictionProfiles.size,
        templatesLoaded: this.complianceTemplates.size,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to initialize Jurisdiction Compliance Mapper:', error);
      throw error;
    }
  }

  /**
   * Get compliance requirements for an entity based on its jurisdiction and type
   */
  async getComplianceRequirements(entity: LegalEntity): Promise<ComplianceRequirement[]> {
    try {
      this.stats.entitiesAssessed++;

      const profile = this.jurisdictionProfiles.get(entity.jurisdiction);
      if (!profile) {
        throw new Error(`Jurisdiction profile not found: ${entity.jurisdiction}`);
      }

      logger.debug('Generating compliance requirements', {
        entityId: entity.id,
        jurisdiction: entity.jurisdiction,
        entityType: entity.entityType
      });

      const requirements: ComplianceRequirement[] = [];

      // Formation requirements (one-time)
      const formationReqs = this.generateFormationRequirements(entity, profile);
      requirements.push(...formationReqs);

      // Ongoing compliance requirements
      const ongoingReqs = this.generateOngoingRequirements(entity, profile);
      requirements.push(...ongoingReqs);

      // Financial services requirements
      if (this.isFinancialServicesEntity(entity)) {
        const finServicesReqs = this.generateFinancialServicesRequirements(entity, profile);
        requirements.push(...finServicesReqs);
      }

      // Tax requirements
      const taxReqs = this.generateTaxRequirements(entity, profile);
      requirements.push(...taxReqs);

      // Reporting requirements
      const reportingReqs = this.generateReportingRequirements(entity, profile);
      requirements.push(...reportingReqs);

      // Data protection requirements
      const dataProtectionReqs = this.generateDataProtectionRequirements(entity, profile);
      requirements.push(...dataProtectionReqs);

      // AML/KYC requirements
      const amlKycReqs = this.generateAMLKYCRequirements(entity, profile);
      requirements.push(...amlKycReqs);

      // Specialized requirements
      const specializedReqs = this.generateSpecializedRequirements(entity, profile);
      requirements.push(...specializedReqs);

      this.stats.requirementsGenerated += requirements.length;

      logger.info('Compliance requirements generated', {
        entityId: entity.id,
        jurisdiction: entity.jurisdiction,
        requirementsCount: requirements.length
      });

      this.emit('requirements_generated', {
        entityId: entity.id,
        jurisdiction: entity.jurisdiction,
        requirementsCount: requirements.length,
        timestamp: new Date()
      });

      return requirements;

    } catch (error) {
      logger.error('Error generating compliance requirements:', error);
      throw error;
    }
  }

  /**
   * Assess compliance status for an entity
   */
  async assessComplianceStatus(entity: LegalEntity): Promise<{
    overallStatus: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
    requirementStatuses: Record<string, 'met' | 'unmet' | 'overdue' | 'pending'>;
    criticalIssues: string[];
    recommendations: string[];
    nextActions: { requirement: string; dueDate: Date; priority: string }[];
  }> {
    try {
      const requirements = await this.getComplianceRequirements(entity);
      const requirementStatuses: Record<string, 'met' | 'unmet' | 'overdue' | 'pending'> = {};
      const criticalIssues: string[] = [];
      const recommendations: string[] = [];
      const nextActions: { requirement: string; dueDate: Date; priority: string }[] = [];

      let compliantCount = 0;
      let totalCount = requirements.length;

      for (const req of requirements) {
        const status = this.evaluateRequirementStatus(entity, req);
        requirementStatuses[req.id] = status;

        if (status === 'met') {
          compliantCount++;
        } else if (status === 'overdue' && req.priority === 'critical') {
          criticalIssues.push(`${req.description} is overdue`);
        }

        if (status !== 'met') {
          const nextAction = this.generateNextAction(req);
          if (nextAction) {
            nextActions.push(nextAction);
          }
        }
      }

      // Generate recommendations
      recommendations.push(...this.generateComplianceRecommendations(entity, requirements));

      // Determine overall status
      let overallStatus: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
      if (compliantCount === totalCount) {
        overallStatus = 'compliant';
      } else if (compliantCount === 0) {
        overallStatus = 'non_compliant';
      } else {
        overallStatus = 'partial';
      }

      if (criticalIssues.length > 0) {
        this.stats.complianceIssuesDetected += criticalIssues.length;
      }

      logger.info('Compliance assessment completed', {
        entityId: entity.id,
        overallStatus,
        compliantCount,
        totalCount,
        criticalIssues: criticalIssues.length
      });

      return {
        overallStatus,
        requirementStatuses,
        criticalIssues,
        recommendations,
        nextActions: nextActions.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      };

    } catch (error) {
      logger.error('Error assessing compliance status:', error);
      throw error;
    }
  }

  /**
   * Get jurisdiction profile
   */
  getJurisdictionProfile(jurisdiction: Jurisdiction): JurisdictionProfile | undefined {
    return this.jurisdictionProfiles.get(jurisdiction);
  }

  /**
   * Update jurisdiction profile
   */
  async updateJurisdictionProfile(jurisdiction: Jurisdiction, updates: Partial<JurisdictionProfile>): Promise<void> {
    const existing = this.jurisdictionProfiles.get(jurisdiction);
    if (!existing) {
      throw new Error(`Jurisdiction profile not found: ${jurisdiction}`);
    }

    const updated = { ...existing, ...updates, lastUpdated: new Date() };
    this.jurisdictionProfiles.set(jurisdiction, updated);

    logger.info('Jurisdiction profile updated', { jurisdiction });

    this.emit('profile_updated', {
      jurisdiction,
      updates: Object.keys(updates),
      timestamp: new Date()
    });
  }

  /**
   * Get supported jurisdictions
   */
  getSupportedJurisdictions(): Jurisdiction[] {
    return Array.from(this.jurisdictionProfiles.keys());
  }

  /**
   * Get mapper statistics
   */
  getStatistics(): any {
    return {
      ...this.stats,
      jurisdictionsSupported: this.jurisdictionProfiles.size,
      templatesAvailable: this.complianceTemplates.size
    };
  }

  // Private methods

  private async loadJurisdictionProfiles(): Promise<void> {
    // Load major jurisdiction profiles
    const jurisdictions: Partial<JurisdictionProfile>[] = [
      {
        jurisdiction: 'US',
        name: 'United States',
        regulatoryFramework: 'Federal and State',
        primaryRegulator: 'SEC/CFTC/FinCEN',
        riskLevel: 'medium'
      },
      {
        jurisdiction: 'UK',
        name: 'United Kingdom',
        regulatoryFramework: 'FCA/PRA',
        primaryRegulator: 'Financial Conduct Authority',
        riskLevel: 'low'
      },
      {
        jurisdiction: 'DE',
        name: 'Germany',
        regulatoryFramework: 'BaFin',
        primaryRegulator: 'Federal Financial Supervisory Authority',
        riskLevel: 'low'
      },
      {
        jurisdiction: 'SG',
        name: 'Singapore',
        regulatoryFramework: 'MAS',
        primaryRegulator: 'Monetary Authority of Singapore',
        riskLevel: 'low'
      },
      {
        jurisdiction: 'CH',
        name: 'Switzerland',
        regulatoryFramework: 'FINMA',
        primaryRegulator: 'Swiss Financial Market Supervisory Authority',
        riskLevel: 'low'
      },
      {
        jurisdiction: 'AU',
        name: 'Australia',
        regulatoryFramework: 'ASIC/APRA',
        primaryRegulator: 'Australian Securities and Investments Commission',
        riskLevel: 'low'
      }
    ];

    for (const partial of jurisdictions) {
      const profile = await this.createFullJurisdictionProfile(partial);
      this.jurisdictionProfiles.set(profile.jurisdiction, profile);
    }

    this.stats.jurisdictionsLoaded = this.jurisdictionProfiles.size;
  }

  private async createFullJurisdictionProfile(partial: Partial<JurisdictionProfile>): Promise<JurisdictionProfile> {
    // Create full profile with defaults and jurisdiction-specific requirements
    return {
      jurisdiction: partial.jurisdiction!,
      name: partial.name!,
      regulatoryFramework: partial.regulatoryFramework!,
      primaryRegulator: partial.primaryRegulator!,
      businessFormationRequirements: this.getDefaultBusinessFormationRequirements(partial.jurisdiction!),
      ongoingComplianceRequirements: this.getDefaultOngoingRequirements(partial.jurisdiction!),
      financialServicesRegulation: this.getDefaultFinancialServicesRegulation(partial.jurisdiction!),
      taxRequirements: this.getDefaultTaxRequirements(partial.jurisdiction!),
      reportingRequirements: this.getDefaultReportingRequirements(partial.jurisdiction!),
      dataProtectionRequirements: this.getDefaultDataProtectionRequirements(partial.jurisdiction!),
      amlKycRequirements: this.getDefaultAMLKYCRequirements(partial.jurisdiction!),
      specializedRequirements: this.getDefaultSpecializedRequirements(partial.jurisdiction!),
      reciprocityAgreements: [],
      treatyNetwork: [],
      riskLevel: partial.riskLevel || 'medium',
      lastUpdated: new Date()
    };
  }

  private async initializeComplianceTemplates(): Promise<void> {
    // Initialize templates for common compliance scenarios
    const templates = [
      'financial_services_basic',
      'financial_services_advanced',
      'fintech_startup',
      'crypto_exchange',
      'investment_firm',
      'payment_processor'
    ];

    for (const template of templates) {
      this.complianceTemplates.set(template, this.generateTemplateRequirements(template));
    }
  }

  private generateFormationRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    const formationReq = profile.businessFormationRequirements.find(req => req.entityType === entity.entityType);
    if (formationReq) {
      requirements.push({
        id: `formation_${entity.jurisdiction}_${entity.entityType}`,
        type: 'registration',
        jurisdiction: entity.jurisdiction,
        regulator: profile.primaryRegulator,
        description: `Entity formation and registration requirements for ${entity.entityType}`,
        frequency: 'one_time',
        status: entity.registrationNumber ? 'compliant' : 'pending',
        priority: 'critical',
        automatable: false
      });
    }

    return requirements;
  }

  private generateOngoingRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    return profile.ongoingComplianceRequirements
      .filter(req => req.applicableEntityTypes.includes(entity.entityType))
      .map(req => ({
        id: `ongoing_${req.type}_${entity.jurisdiction}`,
        type: req.type,
        jurisdiction: entity.jurisdiction,
        regulator: req.regulator,
        description: req.description,
        frequency: req.frequency,
        status: 'pending', // Would be determined by actual compliance data
        priority: this.determinePriority(req.type),
        automatable: this.isAutomatable(req.type)
      }));
  }

  private generateFinancialServicesRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    if (profile.financialServicesRegulation.licensingRequired) {
      requirements.push({
        id: `financial_license_${entity.jurisdiction}`,
        type: 'licensing',
        jurisdiction: entity.jurisdiction,
        regulator: profile.financialServicesRegulation.primaryRegulator,
        description: 'Financial services licensing requirement',
        frequency: 'one_time',
        status: 'pending',
        priority: 'critical',
        automatable: false
      });
    }

    return requirements;
  }

  private generateTaxRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    return profile.taxRequirements.map(tax => ({
      id: `tax_${tax.taxType}_${entity.jurisdiction}`,
      type: 'tax_filing',
      jurisdiction: entity.jurisdiction,
      regulator: 'Tax Authority',
      description: `${tax.taxType} tax filing requirement`,
      frequency: tax.frequency,
      status: 'pending',
      priority: 'high',
      automatable: true
    }));
  }

  private generateReportingRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    return profile.reportingRequirements.map(report => ({
      id: `reporting_${report.type}_${entity.jurisdiction}`,
      type: 'reporting',
      jurisdiction: entity.jurisdiction,
      regulator: report.regulator,
      description: `${report.type} reporting requirement`,
      frequency: report.frequency,
      status: 'pending',
      priority: 'medium',
      automatable: true
    }));
  }

  private generateDataProtectionRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    const dpReq = profile.dataProtectionRequirements;
    if (dpReq.regulation) {
      requirements.push({
        id: `data_protection_${entity.jurisdiction}`,
        type: 'data_protection',
        jurisdiction: entity.jurisdiction,
        regulator: 'Data Protection Authority',
        description: `${dpReq.regulation} compliance requirement`,
        frequency: 'ongoing',
        status: 'pending',
        priority: 'high',
        automatable: false
      });
    }

    return requirements;
  }

  private generateAMLKYCRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    requirements.push({
      id: `aml_kyc_${entity.jurisdiction}`,
      type: 'kyc_aml',
      jurisdiction: entity.jurisdiction,
      regulator: profile.amlKycRequirements.primaryRegulator,
      description: 'AML/KYC compliance program',
      frequency: 'ongoing',
      status: 'pending',
      priority: 'critical',
      automatable: true
    });

    return requirements;
  }

  private generateSpecializedRequirements(entity: LegalEntity, profile: JurisdictionProfile): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    // Determine if entity needs specialized requirements based on business purpose
    const businessKeywords = entity.businessPurpose.toLowerCase();
    
    for (const specialReq of profile.specializedRequirements) {
      if (this.matchesSpecializedCategory(businessKeywords, specialReq.category)) {
        requirements.push({
          id: `specialized_${specialReq.category}_${entity.jurisdiction}`,
          type: 'licensing',
          jurisdiction: entity.jurisdiction,
          regulator: specialReq.regulator,
          description: specialReq.description,
          frequency: 'ongoing',
          status: 'pending',
          priority: 'critical',
          automatable: false
        });
      }
    }

    return requirements;
  }

  private isFinancialServicesEntity(entity: LegalEntity): boolean {
    const businessKeywords = entity.businessPurpose.toLowerCase();
    const financialKeywords = ['financial', 'banking', 'investment', 'trading', 'exchange', 'payment', 'lending', 'custody'];
    return financialKeywords.some(keyword => businessKeywords.includes(keyword));
  }

  private matchesSpecializedCategory(businessPurpose: string, category: string): boolean {
    const categoryKeywords: Record<string, string[]> = {
      'fintech': ['fintech', 'financial technology', 'neobank', 'digital bank'],
      'crypto': ['crypto', 'cryptocurrency', 'blockchain', 'digital asset', 'token'],
      'investment': ['investment', 'fund', 'asset management', 'portfolio'],
      'insurance': ['insurance', 'underwriting', 'actuarial'],
      'banking': ['banking', 'deposit', 'commercial bank'],
      'payment': ['payment', 'remittance', 'money transfer', 'wallet']
    };

    const keywords = categoryKeywords[category] || [];
    return keywords.some(keyword => businessPurpose.includes(keyword));
  }

  private evaluateRequirementStatus(entity: LegalEntity, requirement: ComplianceRequirement): 'met' | 'unmet' | 'overdue' | 'pending' {
    // This would check against actual compliance data
    // For now, return status from entity's compliance requirements
    const entityReq = entity.complianceRequirements.find(req => req.id === requirement.id);
    if (entityReq) {
      switch (entityReq.status) {
        case 'compliant': return 'met';
        case 'overdue': return 'overdue';
        case 'pending': return 'pending';
        default: return 'unmet';
      }
    }
    return 'unmet';
  }

  private generateNextAction(requirement: ComplianceRequirement): { requirement: string; dueDate: Date; priority: string } | null {
    if (!requirement.nextDueDate) return null;

    return {
      requirement: requirement.description,
      dueDate: requirement.nextDueDate,
      priority: requirement.priority
    };
  }

  private generateComplianceRecommendations(entity: LegalEntity, requirements: ComplianceRequirement[]): string[] {
    const recommendations: string[] = [];
    
    const overdueReqs = requirements.filter(req => this.evaluateRequirementStatus(entity, req) === 'overdue');
    if (overdueReqs.length > 0) {
      recommendations.push(`Address ${overdueReqs.length} overdue compliance requirements immediately`);
    }

    const automatableReqs = requirements.filter(req => req.automatable && this.evaluateRequirementStatus(entity, req) !== 'met');
    if (automatableReqs.length > 3) {
      recommendations.push('Consider implementing automated compliance monitoring for routine requirements');
    }

    return recommendations;
  }

  private determinePriority(type: ComplianceRequirementType): 'critical' | 'high' | 'medium' | 'low' {
    const priorityMap: Record<ComplianceRequirementType, 'critical' | 'high' | 'medium' | 'low'> = {
      'registration': 'critical',
      'licensing': 'critical',
      'kyc_aml': 'critical',
      'tax_filing': 'high',
      'reporting': 'medium',
      'audit': 'medium',
      'disclosure': 'medium',
      'data_protection': 'high',
      'consumer_protection': 'medium',
      'financial_services': 'high',
      'securities': 'high',
      'anti_corruption': 'high'
    };

    return priorityMap[type] || 'medium';
  }

  private isAutomatable(type: ComplianceRequirementType): boolean {
    const automatableTypes: ComplianceRequirementType[] = [
      'reporting',
      'tax_filing',
      'kyc_aml',
      'data_protection'
    ];

    return automatableTypes.includes(type);
  }

  private generateTemplateRequirements(template: string): ComplianceRequirement[] {
    // Generate template requirements based on common scenarios
    const baseRequirements: ComplianceRequirement[] = [];
    
    // Add template-specific requirements
    switch (template) {
      case 'financial_services_basic':
        baseRequirements.push(
          this.createTemplateRequirement('licensing', 'Financial services license'),
          this.createTemplateRequirement('kyc_aml', 'AML/KYC program'),
          this.createTemplateRequirement('reporting', 'Financial reporting')
        );
        break;
      case 'crypto_exchange':
        baseRequirements.push(
          this.createTemplateRequirement('licensing', 'Digital asset exchange license'),
          this.createTemplateRequirement('kyc_aml', 'Enhanced AML/KYC for crypto'),
          this.createTemplateRequirement('reporting', 'Transaction reporting'),
          this.createTemplateRequirement('securities', 'Securities compliance')
        );
        break;
    }

    return baseRequirements;
  }

  private createTemplateRequirement(type: ComplianceRequirementType, description: string): ComplianceRequirement {
    return {
      id: `template_${type}_${Date.now()}`,
      type,
      jurisdiction: 'US', // Default
      regulator: 'Various',
      description,
      frequency: 'ongoing',
      status: 'pending',
      priority: this.determinePriority(type),
      automatable: this.isAutomatable(type)
    };
  }

  // Default requirement generators for different jurisdictions
  private getDefaultBusinessFormationRequirements(jurisdiction: Jurisdiction): BusinessFormationRequirement[] {
    // Return jurisdiction-specific formation requirements
    return [
      {
        entityType: 'corporation',
        minimumCapital: jurisdiction === 'US' ? 1000 : 25000,
        minimumDirectors: 1,
        minimumShareholders: 1,
        residentDirectorRequired: jurisdiction !== 'US',
        localAddressRequired: true,
        registrationTimeframe: 7,
        registrationCost: 500,
        currency: jurisdiction === 'US' ? 'USD' : 'EUR',
        requiredDocuments: ['articles_of_incorporation', 'bylaws', 'director_consent'],
        prohibitedActivities: ['illegal_activities'],
        restrictedOwnership: []
      }
    ];
  }

  private getDefaultOngoingRequirements(jurisdiction: Jurisdiction): OngoingComplianceRequirement[] {
    return [
      {
        type: 'reporting',
        frequency: 'annual',
        description: 'Annual corporate filing',
        regulator: 'Corporate Registry',
        penaltyForNonCompliance: 'Fines and potential dissolution',
        deadline: '12-31',
        applicableEntityTypes: ['corporation', 'llc']
      }
    ];
  }

  private getDefaultFinancialServicesRegulation(jurisdiction: Jurisdiction): FinancialServicesRegulation {
    return {
      primaryRegulator: jurisdiction === 'US' ? 'SEC/CFTC' : 'Financial Authority',
      licensingRequired: true,
      licenseTypes: [],
      capitalRequirements: [],
      conductRules: [],
      reportingStandards: ['IFRS'],
      auditRequirements: {
        required: true,
        frequency: 'annual',
        auditorQualifications: ['CPA'],
        auditStandards: ['GAAS'],
        filingDeadline: '03-31',
        publicDisclosure: false
      }
    };
  }

  private getDefaultTaxRequirements(jurisdiction: Jurisdiction): TaxRequirement[] {
    return [
      {
        taxType: 'corporate',
        rate: jurisdiction === 'US' ? 21 : 25,
        description: 'Corporate income tax',
        frequency: 'annual',
        filingDeadline: '03-15',
        paymentDeadline: '03-15',
        penalties: 'Late filing and payment penalties apply'
      }
    ];
  }

  private getDefaultReportingRequirements(jurisdiction: Jurisdiction): ReportingRequirement[] {
    return [
      {
        type: 'financial',
        regulator: 'Corporate Registry',
        frequency: 'annual',
        description: 'Annual financial statements',
        format: 'PDF',
        deadline: '12-31',
        publicDisclosure: false
      }
    ];
  }

  private getDefaultDataProtectionRequirements(jurisdiction: Jurisdiction): DataProtectionRequirement {
    const isEU = ['DE', 'FR', 'IT', 'ES', 'NL'].includes(jurisdiction);
    
    return {
      regulation: isEU ? 'GDPR' : jurisdiction === 'US' ? 'CCPA' : 'Local',
      applicabilityThreshold: 'Processing personal data',
      dataLocalisation: isEU,
      consentRequirements: ['explicit_consent'],
      retentionLimits: { 'personal_data': 2555 }, // 7 years
      breachNotificationTime: isEU ? 72 : 24,
      dpoRequired: isEU,
      assessmentRequired: isEU,
      crossBorderTransferRestrictions: isEU ? ['adequacy_decision_required'] : []
    };
  }

  private getDefaultAMLKYCRequirements(jurisdiction: Jurisdiction): AMLKYCRequirement {
    return {
      primaryRegulator: jurisdiction === 'US' ? 'FinCEN' : 'Financial Intelligence Unit',
      kycTiers: [
        {
          level: 'basic',
          description: 'Basic customer identification',
          documentRequirements: ['government_id'],
          verificationMethods: ['document_verification'],
          refreshFrequency: 365
        }
      ],
      transactionMonitoring: {
        thresholds: {
          cash: 10000,
          wire: 3000,
          crypto: 1000
        },
        monitoringScope: ['all_transactions'],
        alertGeneration: true,
        investigationTimeframe: 30,
        reportingThresholds: {
          suspicious: 5000,
          large: 10000
        }
      },
      sarReporting: {
        reportingTimeframe: 30,
        reportingFormat: 'FinCEN_SAR',
        reportingMethod: 'electronic',
        followUpRequired: false,
        confidentialityRequirements: ['no_tipping_off']
      },
      recordKeeping: {
        retentionPeriod: 5,
        recordTypes: ['transaction_records', 'customer_records'],
        accessRequirements: ['authorized_personnel_only'],
        destructionRequirements: ['secure_destruction'],
        backupRequirements: ['secure_backup']
      },
      training: {
        frequency: 'annual',
        minimumHours: 8,
        recordKeeping: true,
        certificationRequired: false,
        roleBasedTraining: true
      },
      auditFrequency: 'annual'
    };
  }

  private getDefaultSpecializedRequirements(jurisdiction: Jurisdiction): SpecializedRequirement[] {
    return [
      {
        category: 'fintech',
        description: 'Fintech regulatory sandbox participation',
        regulator: 'Financial Authority',
        requirements: ['innovation_plan', 'risk_assessment'],
        licenseRequired: false,
        operationalRequirements: ['consumer_protection'],
        reportingRequirements: ['monthly_reports']
      }
    ];
  }
}