/**
 * Legal Entity Types and Structures
 * Comprehensive type definitions for multi-jurisdictional legal entity management
 */

import { Jurisdiction } from '../../types';

export type EntityType = 
  | 'corporation' 
  | 'llc' 
  | 'partnership' 
  | 'trust' 
  | 'foundation' 
  | 'branch' 
  | 'subsidiary' 
  | 'representative_office'
  | 'joint_venture'
  | 'cooperative'
  | 'special_purpose_vehicle';

export type EntityStatus = 
  | 'active' 
  | 'inactive' 
  | 'pending_formation' 
  | 'pending_dissolution' 
  | 'dissolved' 
  | 'suspended' 
  | 'under_investigation'
  | 'compliance_review';

export type GovernanceRole = 
  | 'board_chairman' 
  | 'board_member' 
  | 'ceo' 
  | 'cfo' 
  | 'cto' 
  | 'general_counsel' 
  | 'compliance_officer' 
  | 'managing_director'
  | 'secretary'
  | 'treasurer'
  | 'auditor'
  | 'authorized_signatory';

export type OwnershipType = 
  | 'direct' 
  | 'indirect' 
  | 'beneficial' 
  | 'voting' 
  | 'non_voting' 
  | 'preferred' 
  | 'common'
  | 'convertible'
  | 'warrant'
  | 'option';

export type ComplianceRequirementType = 
  | 'registration' 
  | 'licensing' 
  | 'reporting' 
  | 'tax_filing' 
  | 'audit' 
  | 'disclosure' 
  | 'kyc_aml'
  | 'data_protection'
  | 'consumer_protection'
  | 'financial_services'
  | 'securities'
  | 'anti_corruption';

export interface LegalEntity {
  id: string;
  name: string;
  legalName: string;
  entityType: EntityType;
  jurisdiction: Jurisdiction;
  registrationNumber?: string;
  taxId?: string;
  formationDate: Date;
  status: EntityStatus;
  parentEntityId?: string;
  businessPurpose: string;
  registeredAddress: Address;
  businessAddress?: Address;
  website?: string;
  contactEmail: string;
  contactPhone?: string;
  
  // Regulatory information
  licenses: License[];
  complianceRequirements: ComplianceRequirement[];
  regulatoryFilings: RegulatoryFiling[];
  
  // Governance structure
  governance: GovernanceStructure;
  
  // Ownership structure
  ownership: OwnershipStructure;
  
  // Financial information
  authorizedCapital?: number;
  issuedCapital?: number;
  currency: string;
  
  // Operational information
  employees?: number;
  operationalSince?: Date;
  fiscalYearEnd: string; // MM-DD format
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastComplianceReview?: Date;
  nextComplianceReview: Date;
  
  // Risk and compliance
  riskProfile: EntityRiskProfile;
  complianceStatus: EntityComplianceStatus;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface License {
  id: string;
  type: string;
  number: string;
  issuer: string;
  jurisdiction: Jurisdiction;
  issuedDate: Date;
  expiryDate?: Date;
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'pending';
  conditions?: string[];
  renewalRequired: boolean;
  autoRenewal: boolean;
}

export interface ComplianceRequirement {
  id: string;
  type: ComplianceRequirementType;
  jurisdiction: Jurisdiction;
  regulator: string;
  description: string;
  frequency: 'one_time' | 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'ongoing';
  nextDueDate?: Date;
  lastCompletedDate?: Date;
  status: 'compliant' | 'overdue' | 'pending' | 'not_applicable' | 'under_review';
  priority: 'critical' | 'high' | 'medium' | 'low';
  automatable: boolean;
  dependencies?: string[]; // Other requirement IDs
}

export interface RegulatoryFiling {
  id: string;
  entityId: string;
  type: string;
  jurisdiction: Jurisdiction;
  regulator: string;
  filingDate: Date;
  periodStart?: Date;
  periodEnd?: Date;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'under_review';
  confirmationNumber?: string;
  documentUrl?: string;
  metadata: Record<string, any>;
}

export interface GovernanceStructure {
  boardOfDirectors?: Person[];
  officers: Officer[];
  authorizedSignatories: AuthorizedSignatory[];
  committees?: Committee[];
  decisionMakingProcess: string;
  votingThresholds: Record<string, number>;
  meetingRequirements: MeetingRequirements;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: Date;
  nationality?: string;
  residency?: string;
  identificationDocuments: IdentificationDocument[];
  address?: Address;
  email?: string;
  phone?: string;
  isPEP: boolean; // Politically Exposed Person
  sanctions?: SanctionsRecord[];
  backgroundChecks?: BackgroundCheck[];
}

export interface Officer extends Person {
  title: GovernanceRole;
  appointmentDate: Date;
  terminationDate?: Date;
  compensation?: number;
  equity?: number;
  responsibilities: string[];
  reportingTo?: string; // Officer ID
}

export interface AuthorizedSignatory extends Person {
  authorizationLevel: 'single' | 'joint' | 'any_two' | 'any_three';
  maximumAmount?: number;
  currency?: string;
  restrictions?: string[];
  effectiveDate: Date;
  expiryDate?: Date;
}

export interface Committee {
  id: string;
  name: string;
  type: 'audit' | 'compensation' | 'nominating' | 'risk' | 'compliance' | 'investment' | 'other';
  members: string[]; // Person IDs
  chair: string; // Person ID
  charter: string;
  meetingFrequency: string;
}

export interface MeetingRequirements {
  boardMeetings: {
    minimumFrequency: string;
    quorum: number;
    noticePeriod: number; // days
  };
  shareholderMeetings: {
    annual: boolean;
    noticePeriod: number; // days
    quorum: number;
  };
}

export interface OwnershipStructure {
  shareholders: Shareholder[];
  sharesOutstanding: number;
  shareClasses: ShareClass[];
  votingAgreements?: VotingAgreement[];
  transferRestrictions?: string[];
  ultimateBeneficialOwners: BeneficialOwner[];
}

export interface Shareholder {
  id: string;
  entityId?: string; // If shareholder is an entity
  personId?: string; // If shareholder is a person
  shareClass: string;
  sharesOwned: number;
  ownershipPercentage: number;
  ownershipType: OwnershipType;
  acquisitionDate: Date;
  acquisitionPrice?: number;
  votingRights: boolean;
  transferRestrictions?: string[];
  pledged?: boolean;
}

export interface ShareClass {
  id: string;
  name: string;
  type: 'common' | 'preferred' | 'convertible' | 'other';
  votingRights: boolean;
  dividendRights: boolean;
  liquidationPreference?: number;
  conversionRatio?: number;
  sharesAuthorized: number;
  sharesIssued: number;
  parValue?: number;
}

export interface VotingAgreement {
  id: string;
  parties: string[]; // Shareholder IDs
  description: string;
  votingThreshold?: number;
  effectiveDate: Date;
  expiryDate?: Date;
  terms: string[];
}

export interface BeneficialOwner {
  personId: string;
  ownershipPercentage: number;
  controlPercentage: number;
  ownershipChain: OwnershipChainLink[];
  verificationDate: Date;
  verificationMethod: string;
}

export interface OwnershipChainLink {
  fromEntityId: string;
  toEntityId?: string;
  toPersonId?: string;
  ownershipPercentage: number;
  ownershipType: OwnershipType;
}

export interface IdentificationDocument {
  type: 'passport' | 'national_id' | 'drivers_license' | 'other';
  number: string;
  issuingCountry: string;
  issuedDate?: Date;
  expiryDate?: Date;
  verified: boolean;
  verificationDate?: Date;
}

export interface SanctionsRecord {
  listName: string;
  issuer: string;
  type: 'individual' | 'entity';
  reason: string;
  effectiveDate: Date;
  status: 'active' | 'removed' | 'under_review';
}

export interface BackgroundCheck {
  type: 'criminal' | 'financial' | 'regulatory' | 'civil' | 'other';
  provider: string;
  completedDate: Date;
  result: 'clear' | 'findings' | 'pending' | 'inconclusive';
  findings?: string[];
  expiryDate?: Date;
}

export interface EntityRiskProfile {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  lastAssessmentDate: Date;
  assessmentMethod: string;
  mitigationMeasures: string[];
}

export interface RiskFactor {
  category: 'jurisdictional' | 'operational' | 'regulatory' | 'financial' | 'governance' | 'reputational';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigated: boolean;
  mitigationMeasures?: string[];
}

export interface EntityComplianceStatus {
  overallStatus: 'compliant' | 'non_compliant' | 'under_review' | 'remediation_required';
  lastReviewDate: Date;
  nextReviewDate: Date;
  outstandingIssues: ComplianceIssue[];
  complianceScore: number; // 0-100
  trends: ComplianceTrend[];
}

export interface ComplianceIssue {
  id: string;
  category: ComplianceRequirementType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  discoveredDate: Date;
  dueDate?: Date;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  assignedTo?: string;
  remedationPlan?: string;
  resolutionDate?: Date;
}

export interface ComplianceTrend {
  period: string;
  score: number;
  issues: number;
  improvements: string[];
  deteriorations: string[];
}

// Entity relationship types
export interface EntityRelationship {
  id: string;
  parentEntityId: string;
  childEntityId: string;
  relationshipType: 'subsidiary' | 'branch' | 'joint_venture' | 'partnership' | 'affiliate' | 'holding';
  ownershipPercentage?: number;
  controlPercentage?: number;
  effectiveDate: Date;
  terminationDate?: Date;
  description?: string;
}

// Corporate action types
export interface CorporateAction {
  id: string;
  entityId: string;
  type: 'incorporation' | 'merger' | 'acquisition' | 'spin_off' | 'liquidation' | 'capital_increase' | 'capital_decrease' | 'name_change' | 'address_change' | 'share_split' | 'dividend';
  description: string;
  effectiveDate: Date;
  announcementDate?: Date;
  approvalDate?: Date;
  regulatoryApprovals?: string[];
  impact: string;
  documents: string[];
  status: 'planned' | 'announced' | 'approved' | 'executed' | 'cancelled';
}