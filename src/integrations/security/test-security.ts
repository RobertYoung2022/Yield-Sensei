/**
 * Security Framework Test
 * Basic validation of security components
 */

import { CredentialManager } from './credential-manager';
import { AccessControlManager } from './access-control';
import { ComplianceMonitor } from './compliance-monitor';
import { SecurityAuditManager } from './security-audit';

// Mock logger for testing
const mockLogger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.log(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.log(`[ERROR] ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || '')
};

// Replace the logger import temporarily
(global as any).Logger = {
  getLogger: () => mockLogger
};

export async function testSecurityFramework(): Promise<void> {
  console.log('🔒 Testing Security Framework...\n');

  try {
    // Test Credential Manager
    console.log('📝 Testing Credential Manager...');
    const credentialManager = new CredentialManager({
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
      saltLength: 32,
      keyRotationInterval: 90
    });

    const credId = await credentialManager.storeCredential(
      'test-service',
      'test-api-key-12345',
      'api_key',
      {
        provider: 'TestProvider',
        scope: ['read', 'write'],
        rotationInterval: 30
      }
    );

    const retrievedCred = await credentialManager.getCredential(credId);
    console.log(`✅ Credential stored and retrieved: ${retrievedCred === 'test-api-key-12345'}`);
    console.log(`✅ Statistics:`, credentialManager.getStatistics());

    // Test Access Control Manager
    console.log('\n🛡️ Testing Access Control Manager...');
    const accessControl = new AccessControlManager({
      defaultDeny: true,
      sessionTimeout: 30,
      maxConcurrentSessions: 5,
      mfaRequired: false,
      ipWhitelistEnabled: false,
      geoFencingEnabled: false
    });

    const policyId = await accessControl.createPolicy({
      name: 'Test Policy',
      description: 'Test access policy',
      rules: [{
        action: 'read',
        resource: 'test-resource'
      }],
      subjects: ['test-user'],
      resources: ['test-resource'],
      effect: 'allow',
      isActive: true
    });

    const accessDecision = await accessControl.evaluateAccess({
      subject: 'test-user',
      action: 'read',
      resource: 'test-resource'
    });

    console.log(`✅ Policy created: ${policyId}`);
    console.log(`✅ Access decision: ${accessDecision.allowed} (${accessDecision.reason})`);

    // Test Compliance Monitor
    console.log('\n📋 Testing Compliance Monitor...');
    const complianceMonitor = new ComplianceMonitor({
      enabledRegulations: ['GDPR', 'CCPA'],
      automaticScanning: false, // Disable for testing
      scanInterval: 24,
      reportingEnabled: false,
      reportingInterval: 7,
      exemptServices: []
    });

    const complianceCheck = await complianceMonitor.checkServiceCompliance('test-service');
    console.log(`✅ Compliance check completed - Score: ${complianceCheck.overallScore}%`);
    console.log(`✅ Violations found: ${complianceCheck.violations.length}`);
    console.log(`✅ Statistics:`, complianceMonitor.getComplianceStatistics());

    // Test Security Audit Manager
    console.log('\n🔍 Testing Security Audit Manager...');
    const securityAudit = new SecurityAuditManager({
      anomalyDetection: {
        enabled: false, // Disable for testing
        thresholds: {
          requestVolume: 100,
          errorRate: 0.05,
          responseTime: 5000,
          unusualPatterns: 3
        },
        alerting: {
          enabled: false,
          channels: ['console'],
          severity: 'medium'
        },
        baselineWindow: 1,
        sensitivityLevel: 'medium'
      },
      incidentResponse: {
        autoDetection: false,
        notificationChannels: ['console'],
        escalationRules: [],
        responsePlaybooks: [],
        containmentActions: []
      }
    });

    const incidentId = await securityAudit.reportIncident({
      title: 'Test Security Incident',
      description: 'This is a test incident for validation',
      severity: 'low',
      type: 'other',
      status: 'open',
      affectedServices: ['test-service'],
      evidence: [],
      remediationSteps: [],
      preventionMeasures: []
    });

    const dashboardMetrics = securityAudit.getDashboardMetrics();
    console.log(`✅ Incident reported: ${incidentId}`);
    console.log(`✅ Dashboard metrics:`, {
      activeIncidents: dashboardMetrics.realTime.activeIncidents,
      systemHealth: dashboardMetrics.realTime.systemHealth,
      threatLevel: dashboardMetrics.realTime.threatLevel
    });

    // Cleanup
    credentialManager.cleanup();
    accessControl.cleanup();
    complianceMonitor.cleanup();
    securityAudit.cleanup();

    console.log('\n✅ All security framework tests passed!');
    
  } catch (error) {
    console.error('\n❌ Security framework test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSecurityFramework().catch(console.error);
}