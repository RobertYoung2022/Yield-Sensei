use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;
use std::collections::{HashMap, HashSet};
use std::time::{Instant, Duration as StdDuration};
use uuid::Uuid;
use serde::{Serialize, Deserialize};

// Import the actual Aegis satellite types and components
extern crate aegis_satellite;
use aegis_satellite::{
    AegisSatellite, AegisConfig, AegisStatistics,
    types::{Position, PositionId, PositionError, HealthFactor, CalculationError, RiskAlert},
    config::validation::{ConfigValidator, ValidationResult, SecurityConfig},
    monitoring::AlertSystem,
};

#[cfg(test)]
mod access_control_comprehensive_tests {
    use super::*;

    // Access Control Types and Structures
    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    enum AccessLevel {
        None,
        Read,
        Write,
        Execute,
        Admin,
        SuperAdmin,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct Role {
        role_id: String,
        name: String,
        description: String,
        permissions: HashSet<Permission>,
        access_level: AccessLevel,
        constraints: Vec<AccessConstraint>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
    struct Permission {
        resource: String,
        action: String,
        scope: PermissionScope,
    }

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
    enum PermissionScope {
        Global,
        Organization(String),
        Team(String),
        User(String),
        Resource(String),
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AccessConstraint {
        constraint_type: ConstraintType,
        parameters: HashMap<String, String>,
        enforcement_mode: EnforcementMode,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum ConstraintType {
        TimeWindow,
        IpWhitelist,
        GeographicLocation,
        DeviceType,
        NetworkZone,
        RateLimiting,
        MultiFactorRequired,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum EnforcementMode {
        Strict,      // Deny access if constraint not met
        Warning,     // Allow but log warning
        Adaptive,    // Adjust based on risk score
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct User {
        user_id: String,
        username: String,
        roles: Vec<String>,
        attributes: HashMap<String, String>,
        last_login: Option<chrono::DateTime<Utc>>,
        failed_attempts: u32,
        locked_until: Option<chrono::DateTime<Utc>>,
        mfa_enabled: bool,
        risk_score: f64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AccessRequest {
        request_id: String,
        user_id: String,
        resource: String,
        action: String,
        timestamp: chrono::DateTime<Utc>,
        context: AccessContext,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AccessContext {
        ip_address: String,
        user_agent: String,
        location: Option<GeographicLocation>,
        device_id: String,
        session_id: String,
        risk_indicators: Vec<RiskIndicator>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct GeographicLocation {
        country: String,
        region: String,
        city: String,
        latitude: f64,
        longitude: f64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct RiskIndicator {
        indicator_type: String,
        severity: RiskSeverity,
        description: String,
        score_impact: f64,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum RiskSeverity {
        Low,
        Medium,
        High,
        Critical,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AccessDecision {
        request_id: String,
        granted: bool,
        reason: String,
        applied_policies: Vec<String>,
        risk_score: f64,
        additional_requirements: Vec<AdditionalRequirement>,
        audit_metadata: HashMap<String, String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AdditionalRequirement {
        requirement_type: RequirementType,
        description: String,
        mandatory: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum RequirementType {
        MultiFactorAuthentication,
        SupervisorApproval,
        JustificationRequired,
        TimeLimitedAccess,
        AuditNotification,
    }

    // Policy structures
    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AccessPolicy {
        policy_id: String,
        name: String,
        description: String,
        rules: Vec<PolicyRule>,
        priority: u32,
        enabled: bool,
        effective_date: chrono::DateTime<Utc>,
        expiry_date: Option<chrono::DateTime<Utc>>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct PolicyRule {
        rule_id: String,
        condition: PolicyCondition,
        effect: PolicyEffect,
        obligations: Vec<PolicyObligation>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum PolicyCondition {
        Always,
        UserHasRole(String),
        UserHasPermission(Permission),
        TimeWindow { start: String, end: String },
        IpInRange(String),
        RiskScoreBelow(f64),
        And(Vec<PolicyCondition>),
        Or(Vec<PolicyCondition>),
        Not(Box<PolicyCondition>),
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum PolicyEffect {
        Allow,
        Deny,
        RequireMfa,
        RequireApproval,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct PolicyObligation {
        obligation_type: ObligationType,
        parameters: HashMap<String, String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    enum ObligationType {
        LogAccess,
        NotifyAdmin,
        RecordJustification,
        EnforceTimeLimit,
        TriggerAlert,
    }

    // Test implementations
    struct AccessControlSystem {
        users: HashMap<String, User>,
        roles: HashMap<String, Role>,
        policies: Vec<AccessPolicy>,
        active_sessions: HashMap<String, SessionInfo>,
        audit_log: Vec<AuditEntry>,
    }

    #[derive(Debug, Clone)]
    struct SessionInfo {
        session_id: String,
        user_id: String,
        created_at: chrono::DateTime<Utc>,
        last_activity: chrono::DateTime<Utc>,
        ip_address: String,
        mfa_verified: bool,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    struct AuditEntry {
        entry_id: String,
        timestamp: chrono::DateTime<Utc>,
        user_id: String,
        action: String,
        resource: String,
        result: String,
        metadata: HashMap<String, String>,
    }

    impl AccessControlSystem {
        fn new() -> Self {
            Self {
                users: HashMap::new(),
                roles: HashMap::new(),
                policies: Vec::new(),
                active_sessions: HashMap::new(),
                audit_log: Vec::new(),
            }
        }

        fn create_test_roles() -> HashMap<String, Role> {
            let mut roles = HashMap::new();

            // Admin role
            roles.insert("admin".to_string(), Role {
                role_id: "admin".to_string(),
                name: "Administrator".to_string(),
                description: "Full system access".to_string(),
                permissions: HashSet::from([
                    Permission {
                        resource: "*".to_string(),
                        action: "*".to_string(),
                        scope: PermissionScope::Global,
                    },
                ]),
                access_level: AccessLevel::Admin,
                constraints: vec![
                    AccessConstraint {
                        constraint_type: ConstraintType::MultiFactorRequired,
                        parameters: HashMap::new(),
                        enforcement_mode: EnforcementMode::Strict,
                    },
                ],
            });

            // Risk Manager role
            roles.insert("risk_manager".to_string(), Role {
                role_id: "risk_manager".to_string(),
                name: "Risk Manager".to_string(),
                description: "Manage risk monitoring and alerts".to_string(),
                permissions: HashSet::from([
                    Permission {
                        resource: "positions".to_string(),
                        action: "read".to_string(),
                        scope: PermissionScope::Global,
                    },
                    Permission {
                        resource: "alerts".to_string(),
                        action: "manage".to_string(),
                        scope: PermissionScope::Global,
                    },
                    Permission {
                        resource: "risk_parameters".to_string(),
                        action: "update".to_string(),
                        scope: PermissionScope::Organization("default".to_string()),
                    },
                ]),
                access_level: AccessLevel::Write,
                constraints: vec![],
            });

            // Read-only user role
            roles.insert("viewer".to_string(), Role {
                role_id: "viewer".to_string(),
                name: "Viewer".to_string(),
                description: "Read-only access to public data".to_string(),
                permissions: HashSet::from([
                    Permission {
                        resource: "positions".to_string(),
                        action: "read".to_string(),
                        scope: PermissionScope::Team("public".to_string()),
                    },
                    Permission {
                        resource: "statistics".to_string(),
                        action: "read".to_string(),
                        scope: PermissionScope::Global,
                    },
                ]),
                access_level: AccessLevel::Read,
                constraints: vec![
                    AccessConstraint {
                        constraint_type: ConstraintType::RateLimiting,
                        parameters: HashMap::from([
                            ("requests_per_minute".to_string(), "60".to_string()),
                        ]),
                        enforcement_mode: EnforcementMode::Strict,
                    },
                ],
            });

            roles
        }

        fn create_test_users() -> HashMap<String, User> {
            let mut users = HashMap::new();

            users.insert("admin_user".to_string(), User {
                user_id: "admin_user".to_string(),
                username: "admin@aegis.com".to_string(),
                roles: vec!["admin".to_string()],
                attributes: HashMap::from([
                    ("department".to_string(), "security".to_string()),
                    ("clearance".to_string(), "top_secret".to_string()),
                ]),
                last_login: Some(Utc::now() - Duration::hours(2)),
                failed_attempts: 0,
                locked_until: None,
                mfa_enabled: true,
                risk_score: 0.1,
            });

            users.insert("risk_manager_1".to_string(), User {
                user_id: "risk_manager_1".to_string(),
                username: "risk1@aegis.com".to_string(),
                roles: vec!["risk_manager".to_string()],
                attributes: HashMap::from([
                    ("department".to_string(), "risk".to_string()),
                    ("team".to_string(), "defi_monitoring".to_string()),
                ]),
                last_login: Some(Utc::now() - Duration::minutes(30)),
                failed_attempts: 0,
                locked_until: None,
                mfa_enabled: true,
                risk_score: 0.2,
            });

            users.insert("viewer_user".to_string(), User {
                user_id: "viewer_user".to_string(),
                username: "viewer@public.com".to_string(),
                roles: vec!["viewer".to_string()],
                attributes: HashMap::new(),
                last_login: Some(Utc::now() - Duration::days(1)),
                failed_attempts: 1,
                locked_until: None,
                mfa_enabled: false,
                risk_score: 0.5,
            });

            users.insert("malicious_user".to_string(), User {
                user_id: "malicious_user".to_string(),
                username: "hacker@evil.com".to_string(),
                roles: vec![],
                attributes: HashMap::new(),
                last_login: None,
                failed_attempts: 10,
                locked_until: Some(Utc::now() + Duration::hours(24)),
                mfa_enabled: false,
                risk_score: 0.95,
            });

            users
        }

        fn create_test_policies() -> Vec<AccessPolicy> {
            vec![
                // Deny access to locked accounts
                AccessPolicy {
                    policy_id: "deny_locked".to_string(),
                    name: "Deny Locked Accounts".to_string(),
                    description: "Prevent access from locked user accounts".to_string(),
                    rules: vec![
                        PolicyRule {
                            rule_id: "locked_check".to_string(),
                            condition: PolicyCondition::Always,
                            effect: PolicyEffect::Deny,
                            obligations: vec![
                                PolicyObligation {
                                    obligation_type: ObligationType::LogAccess,
                                    parameters: HashMap::from([
                                        ("severity".to_string(), "warning".to_string()),
                                    ]),
                                },
                            ],
                        },
                    ],
                    priority: 100, // High priority
                    enabled: true,
                    effective_date: Utc::now() - Duration::days(30),
                    expiry_date: None,
                },
                // Require MFA for sensitive operations
                AccessPolicy {
                    policy_id: "mfa_sensitive".to_string(),
                    name: "MFA for Sensitive Operations".to_string(),
                    description: "Require multi-factor authentication for sensitive resources".to_string(),
                    rules: vec![
                        PolicyRule {
                            rule_id: "mfa_check".to_string(),
                            condition: PolicyCondition::Or(vec![
                                PolicyCondition::UserHasRole("admin".to_string()),
                                PolicyCondition::UserHasPermission(Permission {
                                    resource: "risk_parameters".to_string(),
                                    action: "update".to_string(),
                                    scope: PermissionScope::Global,
                                }),
                            ]),
                            effect: PolicyEffect::RequireMfa,
                            obligations: vec![
                                PolicyObligation {
                                    obligation_type: ObligationType::NotifyAdmin,
                                    parameters: HashMap::new(),
                                },
                            ],
                        },
                    ],
                    priority: 90,
                    enabled: true,
                    effective_date: Utc::now() - Duration::days(7),
                    expiry_date: None,
                },
                // Time-based access restrictions
                AccessPolicy {
                    policy_id: "business_hours".to_string(),
                    name: "Business Hours Access".to_string(),
                    description: "Restrict certain operations to business hours".to_string(),
                    rules: vec![
                        PolicyRule {
                            rule_id: "time_check".to_string(),
                            condition: PolicyCondition::And(vec![
                                PolicyCondition::TimeWindow {
                                    start: "09:00".to_string(),
                                    end: "18:00".to_string(),
                                },
                                PolicyCondition::Not(Box::new(
                                    PolicyCondition::UserHasRole("admin".to_string())
                                )),
                            ]),
                            effect: PolicyEffect::Allow,
                            obligations: vec![],
                        },
                    ],
                    priority: 50,
                    enabled: true,
                    effective_date: Utc::now() - Duration::days(14),
                    expiry_date: None,
                },
                // High risk score denial
                AccessPolicy {
                    policy_id: "risk_threshold".to_string(),
                    name: "High Risk Denial".to_string(),
                    description: "Deny access for users with high risk scores".to_string(),
                    rules: vec![
                        PolicyRule {
                            rule_id: "risk_check".to_string(),
                            condition: PolicyCondition::RiskScoreBelow(0.8),
                            effect: PolicyEffect::Allow,
                            obligations: vec![
                                PolicyObligation {
                                    obligation_type: ObligationType::TriggerAlert,
                                    parameters: HashMap::from([
                                        ("alert_type".to_string(), "security".to_string()),
                                    ]),
                                },
                            ],
                        },
                    ],
                    priority: 95,
                    enabled: true,
                    effective_date: Utc::now(),
                    expiry_date: None,
                },
            ]
        }

        async fn evaluate_access(&mut self, request: &AccessRequest) -> AccessDecision {
            let mut decision = AccessDecision {
                request_id: request.request_id.clone(),
                granted: false,
                reason: "Access evaluation in progress".to_string(),
                applied_policies: Vec::new(),
                risk_score: 0.0,
                additional_requirements: Vec::new(),
                audit_metadata: HashMap::new(),
            };

            // Check if user exists
            let user = match self.users.get(&request.user_id) {
                Some(u) => u,
                None => {
                    decision.reason = "User not found".to_string();
                    self.audit_access(request, &decision).await;
                    return decision;
                }
            };

            // Check if account is locked
            if let Some(locked_until) = user.locked_until {
                if Utc::now() < locked_until {
                    decision.reason = format!("Account locked until {}", locked_until);
                    self.audit_access(request, &decision).await;
                    return decision;
                }
            }

            // Calculate risk score
            decision.risk_score = self.calculate_risk_score(user, &request.context).await;

            // Evaluate policies
            for policy in &self.policies {
                if !policy.enabled {
                    continue;
                }

                if let Some(expiry) = policy.expiry_date {
                    if Utc::now() > expiry {
                        continue;
                    }
                }

                decision.applied_policies.push(policy.policy_id.clone());

                for rule in &policy.rules {
                    let condition_met = self.evaluate_condition(&rule.condition, user, request).await;
                    
                    if condition_met {
                        match &rule.effect {
                            PolicyEffect::Allow => {
                                decision.granted = true;
                                decision.reason = format!("Allowed by policy: {}", policy.name);
                            }
                            PolicyEffect::Deny => {
                                decision.granted = false;
                                decision.reason = format!("Denied by policy: {}", policy.name);
                                self.audit_access(request, &decision).await;
                                return decision;
                            }
                            PolicyEffect::RequireMfa => {
                                decision.additional_requirements.push(AdditionalRequirement {
                                    requirement_type: RequirementType::MultiFactorAuthentication,
                                    description: "MFA verification required".to_string(),
                                    mandatory: true,
                                });
                            }
                            PolicyEffect::RequireApproval => {
                                decision.additional_requirements.push(AdditionalRequirement {
                                    requirement_type: RequirementType::SupervisorApproval,
                                    description: "Supervisor approval required".to_string(),
                                    mandatory: true,
                                });
                            }
                        }

                        // Apply obligations
                        for obligation in &rule.obligations {
                            self.apply_obligation(obligation, request, &decision).await;
                        }
                    }
                }
            }

            // Check role-based permissions
            if decision.granted || decision.applied_policies.is_empty() {
                decision.granted = self.check_rbac(user, request).await;
                if !decision.granted {
                    decision.reason = "Insufficient permissions".to_string();
                }
            }

            self.audit_access(request, &decision).await;
            decision
        }

        async fn calculate_risk_score(&self, user: &User, context: &AccessContext) -> f64 {
            let mut score = user.risk_score;

            // Adjust based on context
            for indicator in &context.risk_indicators {
                score += indicator.score_impact;
            }

            // Failed login attempts
            score += (user.failed_attempts as f64) * 0.05;

            // MFA status
            if !user.mfa_enabled {
                score += 0.1;
            }

            // Unusual access patterns
            if let Some(last_login) = user.last_login {
                let time_since_login = Utc::now() - last_login;
                if time_since_login > Duration::days(30) {
                    score += 0.15; // Dormant account reactivation
                }
            }

            score.min(1.0).max(0.0)
        }

        async fn evaluate_condition(&self, condition: &PolicyCondition, user: &User, request: &AccessRequest) -> bool {
            match condition {
                PolicyCondition::Always => true,
                PolicyCondition::UserHasRole(role) => user.roles.contains(role),
                PolicyCondition::UserHasPermission(perm) => {
                    self.user_has_permission(user, perm).await
                }
                PolicyCondition::TimeWindow { start, end } => {
                    self.is_within_time_window(start, end).await
                }
                PolicyCondition::IpInRange(range) => {
                    self.is_ip_in_range(&request.context.ip_address, range).await
                }
                PolicyCondition::RiskScoreBelow(threshold) => {
                    user.risk_score < *threshold
                }
                PolicyCondition::And(conditions) => {
                    for cond in conditions {
                        if !self.evaluate_condition(cond, user, request).await {
                            return false;
                        }
                    }
                    true
                }
                PolicyCondition::Or(conditions) => {
                    for cond in conditions {
                        if self.evaluate_condition(cond, user, request).await {
                            return true;
                        }
                    }
                    false
                }
                PolicyCondition::Not(condition) => {
                    !self.evaluate_condition(condition, user, request).await
                }
            }
        }

        async fn user_has_permission(&self, user: &User, required_perm: &Permission) -> bool {
            for role_id in &user.roles {
                if let Some(role) = self.roles.get(role_id) {
                    for perm in &role.permissions {
                        if self.permission_matches(perm, required_perm) {
                            return true;
                        }
                    }
                }
            }
            false
        }

        fn permission_matches(&self, user_perm: &Permission, required_perm: &Permission) -> bool {
            // Wildcard matching
            let resource_match = user_perm.resource == "*" || user_perm.resource == required_perm.resource;
            let action_match = user_perm.action == "*" || user_perm.action == required_perm.action;
            
            // Scope matching
            let scope_match = match (&user_perm.scope, &required_perm.scope) {
                (PermissionScope::Global, _) => true,
                (PermissionScope::Organization(org1), PermissionScope::Organization(org2)) => org1 == org2,
                (PermissionScope::Team(team1), PermissionScope::Team(team2)) => team1 == team2,
                (PermissionScope::User(user1), PermissionScope::User(user2)) => user1 == user2,
                (PermissionScope::Resource(res1), PermissionScope::Resource(res2)) => res1 == res2,
                _ => false,
            };

            resource_match && action_match && scope_match
        }

        async fn is_within_time_window(&self, start: &str, end: &str) -> bool {
            // Simple time window check (would be more sophisticated in production)
            true
        }

        async fn is_ip_in_range(&self, ip: &str, range: &str) -> bool {
            // IP range check (would use proper CIDR matching in production)
            true
        }

        async fn check_rbac(&self, user: &User, request: &AccessRequest) -> bool {
            let required_perm = Permission {
                resource: request.resource.clone(),
                action: request.action.clone(),
                scope: PermissionScope::Global, // Simplified for testing
            };

            self.user_has_permission(user, &required_perm).await
        }

        async fn apply_obligation(&mut self, obligation: &PolicyObligation, request: &AccessRequest, decision: &AccessDecision) {
            match obligation.obligation_type {
                ObligationType::LogAccess => {
                    println!("Logging access: {:?}", request);
                }
                ObligationType::NotifyAdmin => {
                    println!("Notifying admin of access request: {}", request.request_id);
                }
                ObligationType::RecordJustification => {
                    println!("Recording justification for request: {}", request.request_id);
                }
                ObligationType::EnforceTimeLimit => {
                    println!("Enforcing time limit on access");
                }
                ObligationType::TriggerAlert => {
                    println!("Triggering security alert for request: {}", request.request_id);
                }
            }
        }

        async fn audit_access(&mut self, request: &AccessRequest, decision: &AccessDecision) {
            let entry = AuditEntry {
                entry_id: Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                user_id: request.user_id.clone(),
                action: request.action.clone(),
                resource: request.resource.clone(),
                result: if decision.granted { "GRANTED" } else { "DENIED" }.to_string(),
                metadata: HashMap::from([
                    ("reason".to_string(), decision.reason.clone()),
                    ("risk_score".to_string(), decision.risk_score.to_string()),
                    ("ip_address".to_string(), request.context.ip_address.clone()),
                ]),
            };

            self.audit_log.push(entry);
        }

        async fn test_privilege_escalation(&mut self) -> Result<(), String> {
            // Test various privilege escalation attempts
            let viewer_user = self.users.get("viewer_user").unwrap().clone();
            
            // Attempt 1: Direct role manipulation
            let mut escalation_request = AccessRequest {
                request_id: Uuid::new_v4().to_string(),
                user_id: viewer_user.user_id.clone(),
                resource: "roles".to_string(),
                action: "update".to_string(),
                timestamp: Utc::now(),
                context: AccessContext {
                    ip_address: "192.168.1.100".to_string(),
                    user_agent: "Mozilla/5.0".to_string(),
                    location: None,
                    device_id: "device123".to_string(),
                    session_id: "session123".to_string(),
                    risk_indicators: vec![
                        RiskIndicator {
                            indicator_type: "privilege_escalation_attempt".to_string(),
                            severity: RiskSeverity::High,
                            description: "User attempting to modify roles".to_string(),
                            score_impact: 0.3,
                        },
                    ],
                },
            };

            let decision = self.evaluate_access(&escalation_request).await;
            if decision.granted {
                return Err("Privilege escalation vulnerability: viewer can update roles".to_string());
            }

            // Attempt 2: Resource traversal
            escalation_request.resource = "../admin/settings".to_string();
            let decision = self.evaluate_access(&escalation_request).await;
            if decision.granted {
                return Err("Path traversal vulnerability detected".to_string());
            }

            Ok(())
        }

        async fn test_session_hijacking(&mut self) -> Result<(), String> {
            // Create legitimate session
            let legitimate_session = SessionInfo {
                session_id: "legit123".to_string(),
                user_id: "risk_manager_1".to_string(),
                created_at: Utc::now() - Duration::minutes(10),
                last_activity: Utc::now() - Duration::minutes(1),
                ip_address: "10.0.0.5".to_string(),
                mfa_verified: true,
            };

            self.active_sessions.insert(legitimate_session.session_id.clone(), legitimate_session.clone());

            // Attempt hijacking from different IP
            let hijack_request = AccessRequest {
                request_id: Uuid::new_v4().to_string(),
                user_id: "risk_manager_1".to_string(),
                resource: "positions".to_string(),
                action: "update".to_string(),
                timestamp: Utc::now(),
                context: AccessContext {
                    ip_address: "192.168.100.200".to_string(), // Different IP
                    user_agent: "Mozilla/5.0".to_string(),
                    location: Some(GeographicLocation {
                        country: "Unknown".to_string(),
                        region: "Unknown".to_string(),
                        city: "Unknown".to_string(),
                        latitude: 0.0,
                        longitude: 0.0,
                    }),
                    device_id: "unknown_device".to_string(),
                    session_id: legitimate_session.session_id.clone(),
                    risk_indicators: vec![
                        RiskIndicator {
                            indicator_type: "ip_mismatch".to_string(),
                            severity: RiskSeverity::High,
                            description: "Session accessed from different IP".to_string(),
                            score_impact: 0.4,
                        },
                    ],
                },
            };

            let decision = self.evaluate_access(&hijack_request).await;
            if decision.granted && decision.additional_requirements.is_empty() {
                return Err("Session hijacking vulnerability: no additional verification required".to_string());
            }

            Ok(())
        }
    }

    // Test helper functions
    async fn setup_access_control_test() -> AccessControlSystem {
        let mut system = AccessControlSystem::new();
        system.users = AccessControlSystem::create_test_users();
        system.roles = AccessControlSystem::create_test_roles();
        system.policies = AccessControlSystem::create_test_policies();
        system
    }

    // Main test cases
    #[tokio::test]
    async fn test_comprehensive_access_control() {
        println!("\n=== Comprehensive Access Control Test ===");
        
        let mut system = setup_access_control_test().await;

        // Test 1: Admin access with MFA
        let admin_request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "admin_user".to_string(),
            resource: "risk_parameters".to_string(),
            action: "update".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "10.0.0.1".to_string(),
                user_agent: "AegisClient/1.0".to_string(),
                location: None,
                device_id: "admin_device".to_string(),
                session_id: "admin_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&admin_request).await;
        assert!(decision.granted || !decision.additional_requirements.is_empty());
        assert!(decision.additional_requirements.iter()
            .any(|req| matches!(req.requirement_type, RequirementType::MultiFactorAuthentication)));
        println!("Admin access test passed - MFA required");

        // Test 2: Risk manager normal access
        let risk_request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "risk_manager_1".to_string(),
            resource: "positions".to_string(),
            action: "read".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "10.0.0.5".to_string(),
                user_agent: "AegisClient/1.0".to_string(),
                location: None,
                device_id: "risk_device".to_string(),
                session_id: "risk_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&risk_request).await;
        assert!(decision.granted);
        println!("Risk manager access test passed");

        // Test 3: Viewer with rate limiting
        let viewer_request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "viewer_user".to_string(),
            resource: "statistics".to_string(),
            action: "read".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "192.168.1.100".to_string(),
                user_agent: "Mozilla/5.0".to_string(),
                location: None,
                device_id: "viewer_device".to_string(),
                session_id: "viewer_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&viewer_request).await;
        assert!(decision.granted);
        println!("Viewer access test passed");

        // Test 4: Locked account denial
        let locked_request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "malicious_user".to_string(),
            resource: "positions".to_string(),
            action: "read".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "192.168.100.200".to_string(),
                user_agent: "HackTool/1.0".to_string(),
                location: None,
                device_id: "unknown".to_string(),
                session_id: "hack_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&locked_request).await;
        assert!(!decision.granted);
        assert!(decision.reason.contains("locked"));
        println!("Locked account denial test passed");

        // Test 5: High risk score denial
        let high_risk_user = User {
            user_id: "high_risk_user".to_string(),
            username: "risky@test.com".to_string(),
            roles: vec!["viewer".to_string()],
            attributes: HashMap::new(),
            last_login: None,
            failed_attempts: 5,
            locked_until: None,
            mfa_enabled: false,
            risk_score: 0.85,
        };

        system.users.insert(high_risk_user.user_id.clone(), high_risk_user);

        let high_risk_request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "high_risk_user".to_string(),
            resource: "positions".to_string(),
            action: "read".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "192.168.200.100".to_string(),
                user_agent: "Unknown".to_string(),
                location: None,
                device_id: "suspicious".to_string(),
                session_id: "risk_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&high_risk_request).await;
        assert!(!decision.granted);
        println!("High risk score denial test passed");

        println!("\nAll access control tests passed!");
    }

    #[tokio::test]
    async fn test_privilege_escalation_prevention() {
        println!("\n=== Privilege Escalation Prevention Test ===");
        
        let mut system = setup_access_control_test().await;

        match system.test_privilege_escalation().await {
            Ok(_) => println!("Privilege escalation prevention: PASSED"),
            Err(e) => panic!("Privilege escalation vulnerability detected: {}", e),
        }
    }

    #[tokio::test]
    async fn test_session_security() {
        println!("\n=== Session Security Test ===");
        
        let mut system = setup_access_control_test().await;

        match system.test_session_hijacking().await {
            Ok(_) => println!("Session hijacking prevention: PASSED"),
            Err(e) => panic!("Session security vulnerability detected: {}", e),
        }
    }

    #[tokio::test]
    async fn test_rbac_inheritance() {
        println!("\n=== RBAC Inheritance Test ===");
        
        let mut system = setup_access_control_test().await;

        // Create user with multiple roles
        let multi_role_user = User {
            user_id: "multi_role_user".to_string(),
            username: "multi@test.com".to_string(),
            roles: vec!["viewer".to_string(), "risk_manager".to_string()],
            attributes: HashMap::new(),
            last_login: Some(Utc::now()),
            failed_attempts: 0,
            locked_until: None,
            mfa_enabled: true,
            risk_score: 0.2,
        };

        system.users.insert(multi_role_user.user_id.clone(), multi_role_user);

        // Test combined permissions
        let request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "multi_role_user".to_string(),
            resource: "risk_parameters".to_string(),
            action: "update".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "10.0.0.10".to_string(),
                user_agent: "AegisClient/1.0".to_string(),
                location: None,
                device_id: "multi_device".to_string(),
                session_id: "multi_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&request).await;
        assert!(decision.granted);
        println!("RBAC inheritance test passed - user has combined permissions");
    }

    #[tokio::test]
    async fn test_audit_trail_completeness() {
        println!("\n=== Audit Trail Completeness Test ===");
        
        let mut system = setup_access_control_test().await;

        // Perform various access attempts
        let test_requests = vec![
            ("admin_user", "positions", "update", true),
            ("viewer_user", "risk_parameters", "update", false),
            ("malicious_user", "positions", "read", false),
        ];

        for (user_id, resource, action, _expected) in test_requests {
            let request = AccessRequest {
                request_id: Uuid::new_v4().to_string(),
                user_id: user_id.to_string(),
                resource: resource.to_string(),
                action: action.to_string(),
                timestamp: Utc::now(),
                context: AccessContext {
                    ip_address: "10.0.0.1".to_string(),
                    user_agent: "Test/1.0".to_string(),
                    location: None,
                    device_id: "test_device".to_string(),
                    session_id: "test_session".to_string(),
                    risk_indicators: vec![],
                },
            };

            system.evaluate_access(&request).await;
        }

        // Verify audit log
        assert_eq!(system.audit_log.len(), 3);
        
        // Check audit entry completeness
        for entry in &system.audit_log {
            assert!(!entry.entry_id.is_empty());
            assert!(!entry.user_id.is_empty());
            assert!(!entry.action.is_empty());
            assert!(!entry.resource.is_empty());
            assert!(entry.metadata.contains_key("reason"));
            assert!(entry.metadata.contains_key("risk_score"));
            assert!(entry.metadata.contains_key("ip_address"));
        }

        println!("Audit trail completeness test passed - {} entries logged", system.audit_log.len());
    }

    #[tokio::test]
    async fn test_constraint_enforcement() {
        println!("\n=== Constraint Enforcement Test ===");
        
        let mut system = setup_access_control_test().await;

        // Test rate limiting constraint
        let viewer_id = "viewer_user".to_string();
        let mut request_count = 0;

        // Simulate rapid requests
        for i in 0..100 {
            let request = AccessRequest {
                request_id: Uuid::new_v4().to_string(),
                user_id: viewer_id.clone(),
                resource: "statistics".to_string(),
                action: "read".to_string(),
                timestamp: Utc::now(),
                context: AccessContext {
                    ip_address: "192.168.1.100".to_string(),
                    user_agent: "Test/1.0".to_string(),
                    location: None,
                    device_id: "test_device".to_string(),
                    session_id: "test_session".to_string(),
                    risk_indicators: vec![],
                },
            };

            let decision = system.evaluate_access(&request).await;
            if decision.granted {
                request_count += 1;
            }

            // Simulate time passing for rate limit window
            if i % 60 == 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }

        println!("Rate limiting test: {} requests granted out of 100", request_count);
        assert!(request_count <= 60); // Should respect rate limit
    }

    #[tokio::test]
    async fn test_policy_priority_ordering() {
        println!("\n=== Policy Priority Ordering Test ===");
        
        let mut system = setup_access_control_test().await;

        // Create conflicting policies
        let allow_policy = AccessPolicy {
            policy_id: "allow_test".to_string(),
            name: "Allow Test Resource".to_string(),
            description: "Allow access to test resource".to_string(),
            rules: vec![
                PolicyRule {
                    rule_id: "allow_rule".to_string(),
                    condition: PolicyCondition::Always,
                    effect: PolicyEffect::Allow,
                    obligations: vec![],
                },
            ],
            priority: 10, // Low priority
            enabled: true,
            effective_date: Utc::now(),
            expiry_date: None,
        };

        let deny_policy = AccessPolicy {
            policy_id: "deny_test".to_string(),
            name: "Deny Test Resource".to_string(),
            description: "Deny access to test resource".to_string(),
            rules: vec![
                PolicyRule {
                    rule_id: "deny_rule".to_string(),
                    condition: PolicyCondition::Always,
                    effect: PolicyEffect::Deny,
                    obligations: vec![],
                },
            ],
            priority: 90, // High priority
            enabled: true,
            effective_date: Utc::now(),
            expiry_date: None,
        };

        system.policies.push(allow_policy);
        system.policies.push(deny_policy);

        // Sort policies by priority (higher number = higher priority)
        system.policies.sort_by(|a, b| b.priority.cmp(&a.priority));

        let request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "viewer_user".to_string(),
            resource: "test_resource".to_string(),
            action: "read".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "10.0.0.1".to_string(),
                user_agent: "Test/1.0".to_string(),
                location: None,
                device_id: "test_device".to_string(),
                session_id: "test_session".to_string(),
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&request).await;
        assert!(!decision.granted); // Deny policy should take precedence
        assert!(decision.reason.contains("Deny Test Resource"));
        println!("Policy priority ordering test passed - deny policy took precedence");
    }

    #[tokio::test]
    async fn test_mfa_requirement_enforcement() {
        println!("\n=== MFA Requirement Enforcement Test ===");
        
        let mut system = setup_access_control_test().await;

        // Create session without MFA verification
        let session = SessionInfo {
            session_id: "no_mfa_session".to_string(),
            user_id: "admin_user".to_string(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
            ip_address: "10.0.0.1".to_string(),
            mfa_verified: false,
        };

        system.active_sessions.insert(session.session_id.clone(), session);

        let request = AccessRequest {
            request_id: Uuid::new_v4().to_string(),
            user_id: "admin_user".to_string(),
            resource: "risk_parameters".to_string(),
            action: "update".to_string(),
            timestamp: Utc::now(),
            context: AccessContext {
                ip_address: "10.0.0.1".to_string(),
                user_agent: "AegisClient/1.0".to_string(),
                location: None,
                device_id: "admin_device".to_string(),
                session_id: session.session_id,
                risk_indicators: vec![],
            },
        };

        let decision = system.evaluate_access(&request).await;
        assert!(!decision.additional_requirements.is_empty());
        
        let has_mfa_requirement = decision.additional_requirements.iter()
            .any(|req| matches!(req.requirement_type, RequirementType::MultiFactorAuthentication));
        assert!(has_mfa_requirement);
        
        println!("MFA requirement enforcement test passed");
    }

    #[tokio::test]
    async fn test_permission_wildcard_matching() {
        println!("\n=== Permission Wildcard Matching Test ===");
        
        let mut system = setup_access_control_test().await;

        // Admin should have wildcard permissions
        let admin_test_cases = vec![
            ("any_resource", "any_action", true),
            ("positions", "delete", true),
            ("system_config", "modify", true),
        ];

        for (resource, action, expected) in admin_test_cases {
            let request = AccessRequest {
                request_id: Uuid::new_v4().to_string(),
                user_id: "admin_user".to_string(),
                resource: resource.to_string(),
                action: action.to_string(),
                timestamp: Utc::now(),
                context: AccessContext {
                    ip_address: "10.0.0.1".to_string(),
                    user_agent: "Test/1.0".to_string(),
                    location: None,
                    device_id: "test_device".to_string(),
                    session_id: "test_session".to_string(),
                    risk_indicators: vec![],
                },
            };

            let decision = system.evaluate_access(&request).await;
            assert_eq!(decision.granted || !decision.additional_requirements.is_empty(), expected,
                "Admin wildcard test failed for {}/{}", resource, action);
        }

        println!("Permission wildcard matching test passed");
    }
}

// Re-export test module
pub use access_control_comprehensive_tests::*;

use rust_decimal::prelude::FromStr;