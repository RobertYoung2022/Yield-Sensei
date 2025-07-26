/**
 * Legal Entity Management Service
 * Comprehensive service for managing legal entities across multiple jurisdictions
 * with automated compliance monitoring and governance controls
 */

import { EventEmitter } from 'events';
import Logger from '../../shared/logging/logger';
import { DatabaseManager } from '../../shared/database/manager';
import { JurisdictionComplianceMapper } from './jurisdiction-compliance-mapper';
import { AuditTrail } from '../reporting/audit-trail';
import { AlertManager } from '../monitoring/alert-manager';
import {
  LegalEntity,
  EntityType,
  EntityStatus,
  ComplianceRequirement,
  RegulatoryFiling,
  GovernanceStructure,
  OwnershipStructure,
  EntityRiskProfile,
  EntityComplianceStatus,
  Address,
  License
} from './types/entity-types';
import { Jurisdiction } from '../types';

const logger = Logger.getLogger('entity-manager');

export interface EntitySearchCriteria {
  jurisdiction?: Jurisdiction;
  entityType?: EntityType;
  status?: EntityStatus;
  parentEntityId?: string;
  complianceStatus?: EntityComplianceStatus;
  riskLevel?: string;
  businessPurpose?: string;
  nameSearch?: string;
}

export interface EntityCreationRequest {
  name: string;
  legalName: string;
  entityType: EntityType;
  jurisdiction: Jurisdiction;
  businessPurpose: string;
  registeredAddress: Address;
  businessAddress?: Address;
  contactEmail: string;
  contactPhone?: string;
  parentEntityId?: string;
  authorizedCapital?: number;
  currency: string;
  fiscalYearEnd: string;
  website?: string;
  governance: Partial<GovernanceStructure>;
  ownership: Partial<OwnershipStructure>;
}

export interface EntityUpdateRequest {
  id: string;
  updates: Partial<Omit<LegalEntity, 'id' | 'createdAt' | 'formationDate'>>;
  updateReason: string;
  updatedBy: string;
}

export interface ComplianceReviewRequest {
  entityId: string;
  reviewType: 'scheduled' | 'ad_hoc' | 'regulatory_change' | 'incident_triggered';
  reviewedBy: string;
  reviewNotes?: string;
}

export interface EntityRelationship {
  parentId: string;
  childId: string;
  relationshipType: 'subsidiary' | 'branch' | 'joint_venture' | 'partnership';
  ownershipPercentage?: number;
  establishedDate: Date;
  status: 'active' | 'inactive' | 'pending_approval';
}

export class LegalEntityManager extends EventEmitter {
  private databaseManager: DatabaseManager;
  private complianceMapper: JurisdictionComplianceMapper;
  private auditTrail: AuditTrail;
  private alertManager: AlertManager;
  private isInitialized = false;
  private entities: Map<string, LegalEntity> = new Map();
  private entityRelationships: Map<string, EntityRelationship[]> = new Map();

  // Performance tracking
  private stats = {
    entitiesCreated: 0,
    entitiesUpdated: 0,
    complianceReviewsCompleted: 0,
    complianceViolationsDetected: 0,
    governanceControlsTriggered: 0
  };

  constructor(
    databaseManager: DatabaseManager,
    complianceMapper: JurisdictionComplianceMapper,
    auditTrail: AuditTrail,
    alertManager: AlertManager
  ) {
    super();
    this.databaseManager = databaseManager;
    this.complianceMapper = complianceMapper;
    this.auditTrail = auditTrail;
    this.alertManager = alertManager;
  }

  /**
   * Initialize the entity manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Legal Entity Manager');
      
      // Load existing entities from database
      await this.loadEntitiesFromDatabase();
      
      // Initialize compliance mapper
      await this.complianceMapper.initialize();
      
      // Set up monitoring intervals
      this.setupComplianceMonitoring();
      this.setupGovernanceMonitoring();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Legal Entity Manager initialized successfully', {
        entitiesLoaded: this.entities.size
      });
    } catch (error) {
      logger.error('Failed to initialize Legal Entity Manager', { error });
      throw error;
    }
  }

  /**
   * Create a new legal entity
   */
  async createEntity(request: EntityCreationRequest, createdBy: string): Promise<LegalEntity> {
    try {
      this.validateInitialized();
      
      logger.info('Creating new legal entity', {
        name: request.name,
        entityType: request.entityType,
        jurisdiction: request.jurisdiction,
        createdBy
      });

      // Generate unique ID
      const entityId = this.generateEntityId(request.jurisdiction, request.entityType);
      
      // Get compliance requirements for this entity type and jurisdiction
      const tempEntity: LegalEntity = this.buildEntityFromRequest(entityId, request);
      const complianceRequirements = await this.complianceMapper.getComplianceRequirements(tempEntity);
      
      // Create the entity
      const entity: LegalEntity = {
        ...tempEntity,
        complianceRequirements,
        status: 'pending_formation',
        createdAt: new Date(),
        updatedAt: new Date(),
        nextComplianceReview: this.calculateNextComplianceReview(complianceRequirements),
        riskProfile: await this.assessEntityRisk(tempEntity),
        complianceStatus: this.initializeComplianceStatus(complianceRequirements)
      };

      // Validate entity before creation
      await this.validateEntityCreation(entity);
      
      // Store entity
      await this.storeEntity(entity);
      this.entities.set(entity.id, entity);
      
      // Handle parent-child relationships
      if (entity.parentEntityId) {
        await this.establishEntityRelationship({
          parentId: entity.parentEntityId,
          childId: entity.id,
          relationshipType: this.determineRelationshipType(entity),
          establishedDate: new Date(),
          status: 'pending_approval'
        });
      }

      // Log audit trail
      await this.auditTrail.recordAction({
        entityType: 'legal_entity',
        entityId: entity.id,
        action: 'entity_created',
        details: {
          entityName: entity.name,
          entityType: entity.entityType,
          jurisdiction: entity.jurisdiction,
          createdBy
        },
        userId: createdBy,
        compliance: true
      });

      this.stats.entitiesCreated++;
      this.emit('entityCreated', entity);
      
      logger.info('Legal entity created successfully', {
        entityId: entity.id,
        name: entity.name
      });

      return entity;
    } catch (error) {
      logger.error('Failed to create legal entity', { 
        request, 
        createdBy, 
        error 
      });
      throw error;
    }
  }

  /**
   * Update an existing legal entity
   */
  async updateEntity(request: EntityUpdateRequest): Promise<LegalEntity> {
    try {
      this.validateInitialized();
      
      const existingEntity = this.entities.get(request.id);
      if (!existingEntity) {
        throw new Error(`Entity not found: ${request.id}`);
      }

      logger.info('Updating legal entity', {
        entityId: request.id,
        updateReason: request.updateReason,
        updatedBy: request.updatedBy
      });

      // Validate governance controls
      await this.validateGovernanceControls(existingEntity, request.updates, request.updatedBy);
      
      // Apply updates
      const updatedEntity: LegalEntity = {
        ...existingEntity,
        ...request.updates,
        updatedAt: new Date()
      };

      // Re-assess compliance if jurisdiction or entity type changed
      if (request.updates.jurisdiction || request.updates.entityType) {
        updatedEntity.complianceRequirements = await this.complianceMapper.getComplianceRequirements(updatedEntity);
        updatedEntity.nextComplianceReview = this.calculateNextComplianceReview(updatedEntity.complianceRequirements);
        updatedEntity.riskProfile = await this.assessEntityRisk(updatedEntity);
      }

      // Update compliance status
      updatedEntity.complianceStatus = await this.updateComplianceStatus(updatedEntity);
      
      // Store updated entity
      await this.storeEntity(updatedEntity);
      this.entities.set(updatedEntity.id, updatedEntity);

      // Log audit trail
      await this.auditTrail.logEvent({
        eventType: 'entity_updated',
        entityId: updatedEntity.id,
        details: {
          updates: request.updates,
          updateReason: request.updateReason,
          updatedBy: request.updatedBy
        },
        timestamp: new Date(),
        userId: request.updatedBy
      });

      this.stats.entitiesUpdated++;
      this.emit('entityUpdated', updatedEntity, existingEntity);
      
      logger.info('Legal entity updated successfully', {
        entityId: updatedEntity.id
      });

      return updatedEntity;
    } catch (error) {
      logger.error('Failed to update legal entity', { 
        request, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get entity by ID
   */
  getEntity(entityId: string): LegalEntity | null {
    this.validateInitialized();
    return this.entities.get(entityId) || null;
  }

  /**
   * Search entities by criteria
   */
  searchEntities(criteria: EntitySearchCriteria): LegalEntity[] {
    this.validateInitialized();
    
    const entities = Array.from(this.entities.values());
    
    return entities.filter(entity => {
      if (criteria.jurisdiction && entity.jurisdiction !== criteria.jurisdiction) return false;
      if (criteria.entityType && entity.entityType !== criteria.entityType) return false;
      if (criteria.status && entity.status !== criteria.status) return false;
      if (criteria.parentEntityId && entity.parentEntityId !== criteria.parentEntityId) return false;
      if (criteria.complianceStatus && entity.complianceStatus.overallStatus !== criteria.complianceStatus) return false;
      if (criteria.riskLevel && entity.riskProfile.overallRisk !== criteria.riskLevel) return false;
      if (criteria.businessPurpose && !entity.businessPurpose.toLowerCase().includes(criteria.businessPurpose.toLowerCase())) return false;
      if (criteria.nameSearch && !entity.name.toLowerCase().includes(criteria.nameSearch.toLowerCase()) && 
          !entity.legalName.toLowerCase().includes(criteria.nameSearch.toLowerCase())) return false;
      
      return true;
    });
  }

  /**
   * Get entity hierarchy (parent and children)
   */
  getEntityHierarchy(entityId: string): { parent?: LegalEntity; children: LegalEntity[] } {
    this.validateInitialized();
    
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const parent = entity.parentEntityId ? this.entities.get(entity.parentEntityId) : undefined;
    const children = Array.from(this.entities.values()).filter(e => e.parentEntityId === entityId);

    return { parent, children };
  }

  /**
   * Perform compliance review for an entity
   */
  async performComplianceReview(request: ComplianceReviewRequest): Promise<EntityComplianceStatus> {
    try {
      this.validateInitialized();
      
      const entity = this.entities.get(request.entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${request.entityId}`);
      }

      logger.info('Performing compliance review', {
        entityId: request.entityId,
        reviewType: request.reviewType,
        reviewedBy: request.reviewedBy
      });

      // Get latest compliance requirements
      const latestRequirements = await this.complianceMapper.getComplianceRequirements(entity);
      
      // Check compliance status
      const complianceStatus = await this.assessComplianceStatus(entity, latestRequirements);
      
      // Update entity with review results
      const updatedEntity = {
        ...entity,
        complianceRequirements: latestRequirements,
        complianceStatus,
        lastComplianceReview: new Date(),
        nextComplianceReview: this.calculateNextComplianceReview(latestRequirements),
        updatedAt: new Date()
      };

      await this.storeEntity(updatedEntity);
      this.entities.set(updatedEntity.id, updatedEntity);

      // Check for violations and trigger alerts
      const violations = complianceStatus.violations || [];
      if (violations.length > 0) {
        await this.handleComplianceViolations(updatedEntity, violations);
      }

      // Log audit trail
      await this.auditTrail.logEvent({
        eventType: 'compliance_review_completed',
        entityId: updatedEntity.id,
        details: {
          reviewType: request.reviewType,
          reviewedBy: request.reviewedBy,
          reviewNotes: request.reviewNotes,
          complianceStatus: complianceStatus.overallStatus,
          violationsFound: violations.length
        },
        timestamp: new Date(),
        userId: request.reviewedBy
      });

      this.stats.complianceReviewsCompleted++;
      this.emit('complianceReviewCompleted', updatedEntity, complianceStatus);
      
      return complianceStatus;
    } catch (error) {
      logger.error('Failed to perform compliance review', { 
        request, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get entities requiring compliance review
   */
  getEntitiesRequiringReview(): LegalEntity[] {
    this.validateInitialized();
    
    const now = new Date();
    return Array.from(this.entities.values()).filter(entity => 
      entity.nextComplianceReview <= now ||
      entity.complianceStatus.overallStatus === 'non_compliant' ||
      entity.complianceStatus.overallStatus === 'review_required'
    );
  }

  /**
   * Generate regulatory filing documentation
   */
  async generateRegulatoryFiling(entityId: string, filingType: string): Promise<RegulatoryFiling> {
    try {
      this.validateInitialized();
      
      const entity = this.entities.get(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      logger.info('Generating regulatory filing', {
        entityId,
        filingType
      });

      // Generate filing based on entity type and jurisdiction requirements
      const filing: RegulatoryFiling = {
        id: `filing-${Date.now()}`,
        entityId,
        filingType,
        jurisdiction: entity.jurisdiction,
        filingDate: new Date(),
        dueDate: this.calculateFilingDueDate(entity, filingType),
        status: 'draft',
        content: await this.generateFilingContent(entity, filingType),
        submittedBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add filing to entity
      entity.regulatoryFilings.push(filing);
      await this.storeEntity(entity);

      this.emit('regulatoryFilingGenerated', entity, filing);
      
      return filing;
    } catch (error) {
      logger.error('Failed to generate regulatory filing', { 
        entityId, 
        filingType, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalEntities: this.entities.size,
      entitiesByStatus: this.getEntitiesGroupedByStatus(),
      entitiesByJurisdiction: this.getEntitiesGroupedByJurisdiction(),
      entitiesRequiringReview: this.getEntitiesRequiringReview().length
    };
  }

  // Private helper methods

  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('LegalEntityManager not initialized');
    }
  }

  private generateEntityId(jurisdiction: Jurisdiction, entityType: EntityType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${jurisdiction}-${entityType}-${timestamp}-${random}`;
  }

  private buildEntityFromRequest(entityId: string, request: EntityCreationRequest): LegalEntity {
    return {
      id: entityId,
      name: request.name,
      legalName: request.legalName,
      entityType: request.entityType,
      jurisdiction: request.jurisdiction,
      businessPurpose: request.businessPurpose,
      registeredAddress: request.registeredAddress,
      businessAddress: request.businessAddress,
      contactEmail: request.contactEmail,
      contactPhone: request.contactPhone,
      parentEntityId: request.parentEntityId,
      authorizedCapital: request.authorizedCapital,
      currency: request.currency,
      fiscalYearEnd: request.fiscalYearEnd,
      website: request.website,
      formationDate: new Date(),
      status: 'pending_formation',
      licenses: [],
      complianceRequirements: [],
      regulatoryFilings: [],
      governance: request.governance as GovernanceStructure,
      ownership: request.ownership as OwnershipStructure,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextComplianceReview: new Date(),
      riskProfile: {} as EntityRiskProfile,
      complianceStatus: {} as EntityComplianceStatus
    };
  }

  private async loadEntitiesFromDatabase(): Promise<void> {
    // Implementation would load entities from database
    // For now, we'll initialize with empty map
    logger.info('Loading entities from database');
  }

  private async storeEntity(entity: LegalEntity): Promise<void> {
    // Implementation would store entity to database
    logger.debug('Storing entity to database', { entityId: entity.id });
  }

  private setupComplianceMonitoring(): void {
    // Set up periodic compliance monitoring
    setInterval(() => {
      this.performScheduledComplianceReviews();
    }, 24 * 60 * 60 * 1000); // Daily
  }

  private setupGovernanceMonitoring(): void {
    // Set up governance monitoring
    logger.info('Setting up governance monitoring');
  }

  private async performScheduledComplianceReviews(): Promise<void> {
    const entitiesRequiringReview = this.getEntitiesRequiringReview();
    
    for (const entity of entitiesRequiringReview) {
      try {
        await this.performComplianceReview({
          entityId: entity.id,
          reviewType: 'scheduled',
          reviewedBy: 'system'
        });
      } catch (error) {
        logger.error('Failed to perform scheduled compliance review', {
          entityId: entity.id,
          error
        });
      }
    }
  }

  private calculateNextComplianceReview(requirements: ComplianceRequirement[]): Date {
    // Calculate next review date based on requirements
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return thirtyDaysFromNow;
  }

  private async assessEntityRisk(entity: LegalEntity): Promise<EntityRiskProfile> {
    // Implementation would assess entity risk based on various factors
    return {
      overallRisk: 'medium',
      jurisdictionRisk: 'low',
      operationalRisk: 'medium',
      complianceRisk: 'low',
      financialRisk: 'medium',
      reputationalRisk: 'low',
      riskFactors: [],
      lastAssessment: new Date(),
      nextAssessment: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    } as EntityRiskProfile;
  }

  private initializeComplianceStatus(requirements: ComplianceRequirement[]): EntityComplianceStatus {
    return {
      overallStatus: 'pending_review',
      lastReviewDate: new Date(),
      nextReviewDate: this.calculateNextComplianceReview(requirements),
      violations: [],
      pendingActions: requirements.map(req => ({
        requirementId: req.id,
        description: req.description,
        dueDate: req.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending'
      }))
    } as EntityComplianceStatus;
  }

  private async validateEntityCreation(entity: LegalEntity): Promise<void> {
    // Validate entity creation requirements
    if (!entity.name || !entity.legalName) {
      throw new Error('Entity name and legal name are required');
    }

    if (!entity.jurisdiction || !entity.entityType) {
      throw new Error('Jurisdiction and entity type are required');
    }

    // Check for duplicate entities
    const existingEntity = Array.from(this.entities.values()).find(e => 
      e.legalName === entity.legalName && 
      e.jurisdiction === entity.jurisdiction &&
      e.status !== 'dissolved'
    );

    if (existingEntity) {
      throw new Error(`Entity with legal name "${entity.legalName}" already exists in jurisdiction ${entity.jurisdiction}`);
    }
  }

  private determineRelationshipType(entity: LegalEntity): 'subsidiary' | 'branch' | 'joint_venture' | 'partnership' {
    // Logic to determine relationship type based on entity type and other factors
    switch (entity.entityType) {
      case 'subsidiary':
        return 'subsidiary';
      case 'branch':
        return 'branch';
      case 'joint_venture':
        return 'joint_venture';
      case 'partnership':
        return 'partnership';
      default:
        return 'subsidiary';
    }
  }

  private async establishEntityRelationship(relationship: EntityRelationship): Promise<void> {
    if (!this.entityRelationships.has(relationship.parentId)) {
      this.entityRelationships.set(relationship.parentId, []);
    }

    this.entityRelationships.get(relationship.parentId)!.push(relationship);
    
    logger.info('Entity relationship established', {
      parentId: relationship.parentId,
      childId: relationship.childId,
      relationshipType: relationship.relationshipType
    });
  }

  private async validateGovernanceControls(
    entity: LegalEntity, 
    updates: Partial<LegalEntity>, 
    updatedBy: string
  ): Promise<void> {
    // Implement governance controls validation
    // This would check if the user has authority to make these changes
    logger.debug('Validating governance controls', {
      entityId: entity.id,
      updatedBy,
      updates: Object.keys(updates)
    });

    this.stats.governanceControlsTriggered++;
  }

  private async updateComplianceStatus(entity: LegalEntity): Promise<EntityComplianceStatus> {
    // Re-assess compliance status
    return await this.assessComplianceStatus(entity, entity.complianceRequirements);
  }

  private async assessComplianceStatus(
    entity: LegalEntity, 
    requirements: ComplianceRequirement[]
  ): Promise<EntityComplianceStatus> {
    // Implementation would assess current compliance status
    const pendingActions = requirements.filter(req => req.status !== 'completed');
    const violations = requirements.filter(req => req.status === 'violated');

    let overallStatus: EntityComplianceStatus['overallStatus'] = 'compliant';
    if (violations.length > 0) {
      overallStatus = 'non_compliant';
    } else if (pendingActions.length > 0) {
      overallStatus = 'review_required';
    }

    return {
      overallStatus,
      lastReviewDate: new Date(),
      nextReviewDate: this.calculateNextComplianceReview(requirements),
      violations: violations.map(v => ({
        requirementId: v.id,
        description: v.description,
        severity: v.priority || 'medium',
        detectedDate: new Date(),
        status: 'open'
      })),
      pendingActions: pendingActions.map(req => ({
        requirementId: req.id,
        description: req.description,
        dueDate: req.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending'
      }))
    } as EntityComplianceStatus;
  }

  private async handleComplianceViolations(entity: LegalEntity, violations: any[]): Promise<void> {
    this.stats.complianceViolationsDetected += violations.length;

    for (const violation of violations) {
      await this.alertManager.createAlert({
        type: 'compliance_violation',
        severity: violation.severity || 'high',
        title: `Compliance Violation: ${entity.name}`,
        description: `Entity ${entity.name} has a compliance violation: ${violation.description}`,
        entityId: entity.id,
        metadata: { violation },
        timestamp: new Date()
      });
    }

    logger.warn('Compliance violations detected', {
      entityId: entity.id,
      violationCount: violations.length
    });
  }

  private calculateFilingDueDate(entity: LegalEntity, filingType: string): Date {
    // Calculate due date based on filing type and jurisdiction
    const now = new Date();
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default
  }

  private async generateFilingContent(entity: LegalEntity, filingType: string): Promise<string> {
    // Generate filing content based on entity and filing type
    return `Generated filing content for ${entity.name} - ${filingType}`;
  }

  private getEntitiesGroupedByStatus(): Record<EntityStatus, number> {
    const groups: Record<EntityStatus, number> = {} as Record<EntityStatus, number>;
    
    for (const entity of this.entities.values()) {
      groups[entity.status] = (groups[entity.status] || 0) + 1;
    }
    
    return groups;
  }

  private getEntitiesGroupedByJurisdiction(): Record<Jurisdiction, number> {
    const groups: Record<Jurisdiction, number> = {} as Record<Jurisdiction, number>;
    
    for (const entity of this.entities.values()) {
      groups[entity.jurisdiction] = (groups[entity.jurisdiction] || 0) + 1;
    }
    
    return groups;
  }
} 