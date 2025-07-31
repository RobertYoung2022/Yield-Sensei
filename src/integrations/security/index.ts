/**
 * Security Integration Module
 * Central export point for all security components
 */

// Core security managers
export { CredentialManager } from './credential-manager';
export { AccessControlManager } from './access-control';
export { ComplianceMonitor } from './compliance-monitor';
export { SecurityAuditManager } from './security-audit';

// Types and interfaces
export * from './types';

// Re-export specific interfaces for easier access
export type {
  SecureCredential,
  AccessControlPolicy,
  ComplianceRule,
  SecurityIncident,
  SecurityMetrics,
  SecurityConfiguration
} from './types';

// Access request types
export type { AccessRequest, AccessDecision } from './access-control';

// Compliance types
export type { ComplianceViolation, ComplianceReport, DataProcessingActivity } from './compliance-monitor';

// Audit types
export type { AnomalyAlert, SecurityDashboardMetrics, VulnerabilityAssessment } from './security-audit';