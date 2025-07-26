use crate::types::{RiskAlert, RiskLevel, PositionId, AlertType};
use async_trait::async_trait;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock, Notify};
use tokio::time::{interval, Instant};
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfiguration {
    pub escalation_rules: HashMap<RiskLevel, EscalationRule>,
    pub notification_channels: Vec<NotificationChannel>,
    pub rate_limiting: RateLimitConfig,
    pub acknowledgment_timeout: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscalationRule {
    pub initial_delay: Duration,
    pub repeat_interval: Duration,
    pub max_escalations: u32,
    pub escalation_multiplier: f64,
    pub required_acknowledgment: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationChannel {
    pub channel_type: ChannelType,
    pub config: ChannelConfig,
    pub enabled_for_levels: Vec<RiskLevel>,
    pub priority: u8, // 1-10, higher is more important
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChannelType {
    Email,
    Slack,
    Discord,
    Webhook,
    SMS,
    PagerDuty,
    Console,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    pub endpoint: Option<String>,
    pub auth_token: Option<String>,
    pub recipients: Vec<String>,
    pub rate_limit_per_minute: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub alerts_per_minute: u32,
    pub alerts_per_hour: u32,
    pub burst_allowance: u32,
}

impl Default for AlertConfiguration {
    fn default() -> Self {
        let mut escalation_rules = HashMap::new();
        
        escalation_rules.insert(RiskLevel::Warning, EscalationRule {
            initial_delay: Duration::from_secs(60),
            repeat_interval: Duration::from_secs(300), // 5 minutes
            max_escalations: 3,
            escalation_multiplier: 1.5,
            required_acknowledgment: false,
        });

        escalation_rules.insert(RiskLevel::Critical, EscalationRule {
            initial_delay: Duration::from_secs(30),
            repeat_interval: Duration::from_secs(120), // 2 minutes
            max_escalations: 5,
            escalation_multiplier: 1.2,
            required_acknowledgment: true,
        });

        escalation_rules.insert(RiskLevel::Emergency, EscalationRule {
            initial_delay: Duration::from_secs(0), // Immediate
            repeat_interval: Duration::from_secs(60), // 1 minute
            max_escalations: 10,
            escalation_multiplier: 1.0, // No escalation delay increase
            required_acknowledgment: true,
        });

        Self {
            escalation_rules,
            notification_channels: vec![
                NotificationChannel {
                    channel_type: ChannelType::Console,
                    config: ChannelConfig {
                        endpoint: None,
                        auth_token: None,
                        recipients: vec![],
                        rate_limit_per_minute: Some(60),
                    },
                    enabled_for_levels: vec![RiskLevel::Warning, RiskLevel::Critical, RiskLevel::Emergency],
                    priority: 1,
                }
            ],
            rate_limiting: RateLimitConfig {
                alerts_per_minute: 60,
                alerts_per_hour: 1000,
                burst_allowance: 10,
            },
            acknowledgment_timeout: Duration::from_secs(600), // 10 minutes
        }
    }
}

#[derive(Debug, Clone)]
struct AlertState {
    pub alert: RiskAlert,
    pub escalation_count: u32,
    pub last_sent: Instant,
    pub next_escalation: Instant,
    pub acknowledgment_required: bool,
}

pub struct EscalatingAlertSystem {
    config: Arc<RwLock<AlertConfiguration>>,
    active_alerts: DashMap<Uuid, AlertState>,
    alert_history: DashMap<Uuid, RiskAlert>,
    notification_sender: mpsc::UnboundedSender<AlertNotification>,
    rate_limiter: RateLimiter,
    escalation_notify: Arc<Notify>,
}

#[derive(Debug, Clone)]
struct AlertNotification {
    alert: RiskAlert,
    channel: NotificationChannel,
    escalation_level: u32,
    is_escalation: bool,
}

impl EscalatingAlertSystem {
    pub fn new(config: AlertConfiguration) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let rate_limiter = RateLimiter::new(config.rate_limiting.clone());
        let escalation_notify = Arc::new(Notify::new());

        let system = Self {
            config: Arc::new(RwLock::new(config)),
            active_alerts: DashMap::new(),
            alert_history: DashMap::new(),
            notification_sender: tx,
            rate_limiter,
            escalation_notify: escalation_notify.clone(),
        };

        // Start background tasks
        tokio::spawn(Self::notification_worker(rx));
        tokio::spawn(Self::escalation_worker(
            system.active_alerts.clone(),
            system.config.clone(),
            system.notification_sender.clone(),
            escalation_notify,
        ));

        system
    }

    async fn escalation_worker(
        active_alerts: DashMap<Uuid, AlertState>,
        config: Arc<RwLock<AlertConfiguration>>,
        notification_sender: mpsc::UnboundedSender<AlertNotification>,
        escalation_notify: Arc<Notify>,
    ) {
        let mut escalation_interval = interval(Duration::from_secs(30));
        
        loop {
            tokio::select! {
                _ = escalation_interval.tick() => {
                    Self::process_escalations(&active_alerts, &config, &notification_sender).await;
                }
                _ = escalation_notify.notified() => {
                    // Process immediately when notified
                    Self::process_escalations(&active_alerts, &config, &notification_sender).await;
                }
            }
        }
    }

    async fn process_escalations(
        active_alerts: &DashMap<Uuid, AlertState>,
        config: &Arc<RwLock<AlertConfiguration>>,
        notification_sender: &mpsc::UnboundedSender<AlertNotification>,
    ) {
        let now = Instant::now();
        let config_guard = config.read().await;

        for mut alert_state_ref in active_alerts.iter_mut() {
            let alert_state = alert_state_ref.value_mut();
            
            if now >= alert_state.next_escalation {
                let escalation_rule = config_guard.escalation_rules.get(&alert_state.alert.risk_level);
                
                if let Some(rule) = escalation_rule {
                    if alert_state.escalation_count < rule.max_escalations {
                        // Send escalation
                        for channel in &config_guard.notification_channels {
                            if channel.enabled_for_levels.contains(&alert_state.alert.risk_level) {
                                let notification = AlertNotification {
                                    alert: alert_state.alert.clone(),
                                    channel: channel.clone(),
                                    escalation_level: alert_state.escalation_count + 1,
                                    is_escalation: true,
                                };
                                
                                if let Err(e) = notification_sender.send(notification) {
                                    error!("Failed to send escalation notification: {}", e);
                                }
                            }
                        }

                        // Update escalation state
                        alert_state.escalation_count += 1;
                        alert_state.last_sent = now;
                        
                        let next_interval = Duration::from_secs_f64(
                            rule.repeat_interval.as_secs_f64() * 
                            rule.escalation_multiplier.powi(alert_state.escalation_count as i32)
                        );
                        alert_state.next_escalation = now + next_interval;

                        info!("Escalated alert {} to level {}", 
                              alert_state.alert.id, alert_state.escalation_count);
                    }
                }
            }
        }
    }

    async fn notification_worker(mut rx: mpsc::UnboundedReceiver<AlertNotification>) {
        while let Some(notification) = rx.recv().await {
            if let Err(e) = Self::send_notification(&notification).await {
                error!("Failed to send notification for alert {}: {}", 
                       notification.alert.id, e);
            }
        }
    }

    async fn send_notification(notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match notification.channel.channel_type {
            ChannelType::Console => {
                Self::send_console_notification(notification).await
            }
            ChannelType::Email => {
                Self::send_email_notification(notification).await
            }
            ChannelType::Slack => {
                Self::send_slack_notification(notification).await
            }
            ChannelType::Discord => {
                Self::send_discord_notification(notification).await
            }
            ChannelType::Webhook => {
                Self::send_webhook_notification(notification).await
            }
            ChannelType::SMS => {
                Self::send_sms_notification(notification).await
            }
            ChannelType::PagerDuty => {
                Self::send_pagerduty_notification(notification).await
            }
        }
    }

    async fn send_console_notification(notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let prefix = if notification.is_escalation {
            format!("🔺 ESCALATION #{}", notification.escalation_level)
        } else {
            "🚨 NEW ALERT".to_string()
        };

        let urgency_emoji = match notification.alert.risk_level {
            RiskLevel::Safe => "✅",
            RiskLevel::Warning => "⚠️",
            RiskLevel::Critical => "🔥",
            RiskLevel::Emergency => "💀",
        };

        println!("{} {} [{}] Position {}: {}", 
                prefix,
                urgency_emoji,
                notification.alert.risk_level.to_string().to_uppercase(),
                notification.alert.position_id,
                notification.alert.message);

        if notification.alert.risk_level == RiskLevel::Emergency {
            println!("🚨🚨🚨 IMMEDIATE ACTION REQUIRED 🚨🚨🚨");
        }

        Ok(())
    }

    async fn send_email_notification(_notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for email implementation
        debug!("Email notification would be sent here");
        Ok(())
    }

    async fn send_slack_notification(_notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for Slack implementation
        debug!("Slack notification would be sent here");
        Ok(())
    }

    async fn send_discord_notification(_notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for Discord implementation
        debug!("Discord notification would be sent here");
        Ok(())
    }

    async fn send_webhook_notification(_notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for webhook implementation
        debug!("Webhook notification would be sent here");
        Ok(())
    }

    async fn send_sms_notification(_notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for SMS implementation
        debug!("SMS notification would be sent here");
        Ok(())
    }

    async fn send_pagerduty_notification(_notification: &AlertNotification) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for PagerDuty implementation
        debug!("PagerDuty notification would be sent here");
        Ok(())
    }
}

#[async_trait]
impl crate::liquidation::AlertSystem for EscalatingAlertSystem {
    async fn send_alert(&self, alert: RiskAlert) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Check rate limiting
        if !self.rate_limiter.allow_alert().await {
            warn!("Alert rate limited: {}", alert.id);
            return Ok(());
        }

        let config = self.config.read().await;
        let escalation_rule = config.escalation_rules.get(&alert.risk_level);

        // Store in history
        self.alert_history.insert(alert.id, alert.clone());

        // Create alert state for escalation tracking
        if let Some(rule) = escalation_rule {
            let now = Instant::now();
            let alert_state = AlertState {
                alert: alert.clone(),
                escalation_count: 0,
                last_sent: now,
                next_escalation: now + rule.initial_delay,
                acknowledgment_required: rule.required_acknowledgment,
            };
            self.active_alerts.insert(alert.id, alert_state);
        }

        // Send initial notifications
        for channel in &config.notification_channels {
            if channel.enabled_for_levels.contains(&alert.risk_level) {
                let notification = AlertNotification {
                    alert: alert.clone(),
                    channel: channel.clone(),
                    escalation_level: 0,
                    is_escalation: false,
                };
                
                if let Err(e) = self.notification_sender.send(notification) {
                    error!("Failed to send initial alert notification: {}", e);
                }
            }
        }

        // Notify escalation worker for immediate processing if needed
        if alert.risk_level == RiskLevel::Emergency {
            self.escalation_notify.notify_one();
        }

        info!("Alert {} sent for position {}", alert.id, alert.position_id);
        Ok(())
    }

    async fn get_alerts(&self, position_id: Option<PositionId>) -> Result<Vec<RiskAlert>, Box<dyn std::error::Error + Send + Sync>> {
        let alerts: Vec<RiskAlert> = if let Some(pos_id) = position_id {
            self.alert_history.iter()
                .filter(|entry| entry.value().position_id == pos_id)
                .map(|entry| entry.value().clone())
                .collect()
        } else {
            self.alert_history.iter()
                .map(|entry| entry.value().clone())
                .collect()
        };

        Ok(alerts)
    }

    async fn acknowledge_alert(&self, alert_id: Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(mut alert_state) = self.active_alerts.get_mut(&alert_id) {
            if let Some(mut alert) = self.alert_history.get_mut(&alert_id) {
                alert.acknowledged = true;
                info!("Alert {} acknowledged", alert_id);
            }
            
            // Remove from active alerts to stop escalation
            drop(alert_state);
            self.active_alerts.remove(&alert_id);
            
            info!("Alert {} removed from active escalation", alert_id);
        }

        Ok(())
    }
}

struct RateLimiter {
    config: RateLimitConfig,
    minute_counter: Arc<RwLock<(DateTime<Utc>, u32)>>,
    hour_counter: Arc<RwLock<(DateTime<Utc>, u32)>>,
}

impl RateLimiter {
    fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            minute_counter: Arc::new(RwLock::new((Utc::now(), 0))),
            hour_counter: Arc::new(RwLock::new((Utc::now(), 0))),
        }
    }

    async fn allow_alert(&self) -> bool {
        let now = Utc::now();

        // Check minute limit
        {
            let mut minute_guard = self.minute_counter.write().await;
            if now.signed_duration_since(minute_guard.0).num_seconds() >= 60 {
                minute_guard.0 = now;
                minute_guard.1 = 0;
            }
            
            if minute_guard.1 >= self.config.alerts_per_minute {
                return false;
            }
            minute_guard.1 += 1;
        }

        // Check hour limit
        {
            let mut hour_guard = self.hour_counter.write().await;
            if now.signed_duration_since(hour_guard.0).num_seconds() >= 3600 {
                hour_guard.0 = now;
                hour_guard.1 = 0;
            }
            
            if hour_guard.1 >= self.config.alerts_per_hour {
                return false;
            }
            hour_guard.1 += 1;
        }

        true
    }
}

impl ToString for RiskLevel {
    fn to_string(&self) -> String {
        match self {
            RiskLevel::Safe => "safe".to_string(),
            RiskLevel::Warning => "warning".to_string(),
            RiskLevel::Critical => "critical".to_string(),
            RiskLevel::Emergency => "emergency".to_string(),
        }
    }
}