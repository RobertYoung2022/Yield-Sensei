use crate::security::{Vulnerability, VulnerabilitySeverity, VulnerabilityCategory};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use log::{info, warn, error, debug};

/// Risk intelligence query types
#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum RiskQueryType {
    ProtocolVulnerability,
    MarketSentiment,
    RegulatoryRisk,
    LiquidationRisk,
    SmartContractRisk,
    DeFiContagion,
    MEVThreat,
    FlashLoanAttack,
    OracleManipulation,
    CrossChainRisk,
    Custom(String),
}

/// Risk intelligence query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskIntelligenceQuery {
    pub query_type: RiskQueryType,
    pub target: String, // Protocol, asset, or entity name
    pub time_window: Option<u32>, // Days to look back
    pub jurisdiction: Option<String>,
    pub risk_factors: Vec<String>,
    pub custom_prompt: Option<String>,
    pub include_sentiment: bool,
    pub include_credibility: bool,
    pub max_results: Option<u32>,
}

/// Risk intelligence response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskIntelligenceResponse {
    pub query: RiskIntelligenceQuery,
    pub risk_score: f64,
    pub risk_level: RiskLevel,
    pub risk_factors: Vec<RiskFactor>,
    pub sentiment_analysis: SentimentAnalysis,
    pub credibility_score: f64,
    pub recommendations: Vec<RiskRecommendation>,
    pub sources: Vec<RiskSource>,
    pub timestamp: DateTime<Utc>,
    pub confidence: f64,
}

/// Risk levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
    Unknown,
}

/// Risk factor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub factor: String,
    pub description: String,
    pub impact_score: f64,
    pub probability: f64,
    pub time_horizon: TimeHorizon,
    pub mitigation_strategies: Vec<String>,
    pub sources: Vec<String>,
}

/// Time horizons for risk factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeHorizon {
    Immediate, // 0-24 hours
    ShortTerm, // 1-7 days
    MediumTerm, // 1-4 weeks
    LongTerm, // 1-12 months
    Unknown,
}

/// Sentiment analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentAnalysis {
    pub overall_sentiment: Sentiment,
    pub sentiment_score: f64, // -1.0 to 1.0
    pub confidence: f64,
    pub key_phrases: Vec<SentimentPhrase>,
    pub trend_direction: TrendDirection,
    pub volatility_indicator: bool,
}

/// Sentiment types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Sentiment {
    VeryNegative,
    Negative,
    Neutral,
    Positive,
    VeryPositive,
}

/// Sentiment phrase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentPhrase {
    pub phrase: String,
    pub sentiment: Sentiment,
    pub score: f64,
    pub frequency: u32,
}

/// Trend direction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Declining,
    Stable,
    Improving,
    Volatile,
    Unknown,
}

/// Risk recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskRecommendation {
    pub recommendation: String,
    pub priority: RecommendationPriority,
    pub expected_impact: f64,
    pub implementation_difficulty: ImplementationDifficulty,
    pub time_to_implement: TimeHorizon,
    pub cost_estimate: Option<f64>,
}

/// Recommendation priority
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Implementation difficulty
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImplementationDifficulty {
    Easy,
    Moderate,
    Difficult,
    VeryDifficult,
}

/// Risk source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskSource {
    pub url: String,
    pub title: String,
    pub credibility_score: f64,
    pub publication_date: Option<DateTime<Utc>>,
    pub source_type: SourceType,
    pub relevance_score: f64,
}

/// Source types
#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum SourceType {
    NewsArticle,
    ResearchPaper,
    SocialMedia,
    GovernmentReport,
    IndustryReport,
    BlogPost,
    ForumDiscussion,
    Unknown,
}

/// Perplexity API configuration for risk intelligence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskIntelligenceConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f64,
    pub timeout_seconds: u32,
    pub retry_attempts: u32,
    pub cache_duration_minutes: u32,
    pub enable_sentiment_analysis: bool,
    pub enable_credibility_scoring: bool,
    pub risk_prompts: HashMap<RiskQueryType, String>,
}

impl Default for RiskIntelligenceConfig {
    fn default() -> Self {
        let mut risk_prompts = HashMap::new();
        
        // Protocol vulnerability prompt
        risk_prompts.insert(RiskQueryType::ProtocolVulnerability, 
            "Analyze the security and vulnerability risks for the DeFi protocol {target}. Focus on smart contract vulnerabilities, economic attacks, governance risks, and potential exploits. Provide specific risk factors, their likelihood, and mitigation strategies. Include recent security incidents and audit findings.".to_string());
        
        // Market sentiment prompt
        risk_prompts.insert(RiskQueryType::MarketSentiment,
            "Analyze market sentiment and risk factors for {target}. Consider social media sentiment, news coverage, trading volume patterns, and market indicators. Identify potential market manipulation, liquidity risks, and sentiment-driven price movements.".to_string());
        
        // Regulatory risk prompt
        risk_prompts.insert(RiskQueryType::RegulatoryRisk,
            "Assess regulatory risks for {target} in {jurisdiction}. Consider current regulations, pending legislation, enforcement actions, and compliance requirements. Identify potential regulatory changes that could impact the protocol or asset.".to_string());
        
        // Liquidation risk prompt
        risk_prompts.insert(RiskQueryType::LiquidationRisk,
            "Analyze liquidation risks for {target}. Consider collateral volatility, liquidation thresholds, market depth, and potential cascading effects. Identify scenarios that could trigger mass liquidations and their impact.".to_string());
        
        // Smart contract risk prompt
        risk_prompts.insert(RiskQueryType::SmartContractRisk,
            "Evaluate smart contract risks for {target}. Focus on code vulnerabilities, upgrade mechanisms, access controls, and potential attack vectors. Consider recent exploits and security best practices.".to_string());
        
        // DeFi contagion prompt
        risk_prompts.insert(RiskQueryType::DeFiContagion,
            "Assess DeFi contagion risks for {target}. Consider inter-protocol dependencies, shared vulnerabilities, and potential cascading failures. Identify protocols that could be affected by issues with this protocol.".to_string());
        
        // MEV threat prompt
        risk_prompts.insert(RiskQueryType::MEVThreat,
            "Analyze MEV (Maximal Extractable Value) threats for {target}. Consider sandwich attacks, frontrunning, backrunning, and other MEV extraction methods. Assess the protocol's vulnerability to MEV attacks.".to_string());
        
        // Flash loan attack prompt
        risk_prompts.insert(RiskQueryType::FlashLoanAttack,
            "Evaluate flash loan attack risks for {target}. Consider the protocol's exposure to flash loan attacks, potential attack vectors, and historical incidents. Assess the effectiveness of existing protections.".to_string());
        
        // Oracle manipulation prompt
        risk_prompts.insert(RiskQueryType::OracleManipulation,
            "Analyze oracle manipulation risks for {target}. Consider the protocol's oracle dependencies, potential manipulation vectors, and historical oracle failures. Assess the robustness of oracle systems.".to_string());
        
        // Cross-chain risk prompt
        risk_prompts.insert(RiskQueryType::CrossChainRisk,
            "Assess cross-chain risks for {target}. Consider bridge vulnerabilities, cross-chain dependencies, and potential failure modes. Identify risks associated with cross-chain operations and asset transfers.".to_string());

        Self {
            api_key: String::new(),
            base_url: "https://api.perplexity.ai".to_string(),
            model: "llama-3.1-70b-instruct".to_string(),
            max_tokens: 4000,
            temperature: 0.3,
            timeout_seconds: 30,
            retry_attempts: 3,
            cache_duration_minutes: 60,
            enable_sentiment_analysis: true,
            enable_credibility_scoring: true,
            risk_prompts,
        }
    }
}

/// Risk Intelligence System
pub struct RiskIntelligenceSystem {
    config: RiskIntelligenceConfig,
    cache: Arc<RwLock<HashMap<String, CachedRiskResponse>>>,
    http_client: reqwest::Client,
    sentiment_analyzer: Arc<SentimentAnalyzer>,
    credibility_scorer: Arc<CredibilityScorer>,
}

/// Cached risk response
#[derive(Debug, Clone)]
pub struct CachedRiskResponse {
    pub response: RiskIntelligenceResponse,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Sentiment analyzer
#[derive(Debug, Clone)]
pub struct SentimentAnalyzer {
    pub positive_keywords: Vec<String>,
    pub negative_keywords: Vec<String>,
    pub neutral_keywords: Vec<String>,
}

impl SentimentAnalyzer {
    pub fn new() -> Self {
        Self {
            positive_keywords: vec![
                "secure", "safe", "audited", "trusted", "reliable", "stable",
                "growth", "adoption", "innovation", "success", "profitable",
                "regulated", "compliant", "transparent", "decentralized",
            ],
            negative_keywords: vec![
                "vulnerable", "exploit", "hack", "breach", "attack", "risk",
                "danger", "unsafe", "unstable", "volatile", "crash", "failure",
                "suspicious", "manipulation", "fraud", "scam", "rug pull",
            ],
            neutral_keywords: vec![
                "update", "change", "modify", "implement", "deploy", "launch",
                "announce", "release", "version", "feature", "improvement",
            ],
        }
    }

    pub async fn analyze_sentiment(&self, text: &str) -> SentimentAnalysis {
        let text_lower = text.to_lowercase();
        let words: Vec<&str> = text_lower.split_whitespace().collect();
        
        let mut positive_count = 0;
        let mut negative_count = 0;
        let mut neutral_count = 0;
        
        for word in &words {
            if self.positive_keywords.iter().any(|kw| word.contains(kw)) {
                positive_count += 1;
            } else if self.negative_keywords.iter().any(|kw| word.contains(kw)) {
                negative_count += 1;
            } else if self.neutral_keywords.iter().any(|kw| word.contains(kw)) {
                neutral_count += 1;
            }
        }
        
        let total_sentiment_words = positive_count + negative_count + neutral_count;
        let sentiment_score = if total_sentiment_words > 0 {
            (positive_count as f64 - negative_count as f64) / total_sentiment_words as f64
        } else {
            0.0
        };
        
        let overall_sentiment = match sentiment_score {
            s if s >= 0.3 => Sentiment::Positive,
            s if s <= -0.3 => Sentiment::Negative,
            s if s >= 0.1 => Sentiment::Neutral,
            s if s <= -0.1 => Sentiment::Neutral,
            _ => Sentiment::Neutral,
        };
        
        let confidence = (positive_count + negative_count) as f64 / total_sentiment_words.max(1) as f64;
        
        SentimentAnalysis {
            overall_sentiment,
            sentiment_score,
            confidence,
            key_phrases: self.extract_key_phrases(&text_lower).await,
            trend_direction: self.determine_trend_direction(sentiment_score).await,
            volatility_indicator: self.detect_volatility(&text_lower).await,
        }
    }
    
    async fn extract_key_phrases(&self, text: &str) -> Vec<SentimentPhrase> {
        let mut phrases = Vec::new();
        
        // Simple phrase extraction based on keyword presence
        for keyword in &self.positive_keywords {
            if text.contains(keyword) {
                phrases.push(SentimentPhrase {
                    phrase: keyword.clone(),
                    sentiment: Sentiment::Positive,
                    score: 0.5,
                    frequency: text.matches(keyword).count() as u32,
                });
            }
        }
        
        for keyword in &self.negative_keywords {
            if text.contains(keyword) {
                phrases.push(SentimentPhrase {
                    phrase: keyword.clone(),
                    sentiment: Sentiment::Negative,
                    score: -0.5,
                    frequency: text.matches(keyword).count() as u32,
                });
            }
        }
        
        phrases
    }
    
    async fn determine_trend_direction(&self, sentiment_score: f64) -> TrendDirection {
        match sentiment_score {
            s if s > 0.2 => TrendDirection::Improving,
            s if s < -0.2 => TrendDirection::Declining,
            s if s.abs() < 0.1 => TrendDirection::Stable,
            _ => TrendDirection::Volatile,
        }
    }
    
    async fn detect_volatility(&self, text: &str) -> bool {
        let volatility_indicators = [
            "volatile", "unstable", "fluctuating", "uncertain", "unpredictable",
            "wild", "turbulent", "chaotic", "erratic", "inconsistent",
        ];
        
        volatility_indicators.iter().any(|indicator| text.contains(indicator))
    }
}

/// Credibility scorer
#[derive(Debug, Clone)]
pub struct CredibilityScorer {
    pub trusted_domains: Vec<String>,
    pub low_credibility_domains: Vec<String>,
    pub source_weights: HashMap<SourceType, f64>,
}

impl CredibilityScorer {
    pub fn new() -> Self {
        let mut source_weights = HashMap::new();
        source_weights.insert(SourceType::GovernmentReport, 0.95);
        source_weights.insert(SourceType::ResearchPaper, 0.90);
        source_weights.insert(SourceType::IndustryReport, 0.85);
        source_weights.insert(SourceType::NewsArticle, 0.75);
        source_weights.insert(SourceType::BlogPost, 0.60);
        source_weights.insert(SourceType::SocialMedia, 0.40);
        source_weights.insert(SourceType::ForumDiscussion, 0.30);
        source_weights.insert(SourceType::Unknown, 0.50);

        Self {
            trusted_domains: vec![
                "reuters.com", "bloomberg.com", "coindesk.com", "cointelegraph.com",
                "github.com", "medium.com", "arxiv.org", "ssrn.com",
            ],
            low_credibility_domains: vec![
                "4chan.org", "reddit.com", "twitter.com", "telegram.org",
            ],
            source_weights,
        }
    }
    
    pub async fn score_credibility(&self, source: &RiskSource) -> f64 {
        let mut score = 0.5; // Base score
        
        // Adjust based on source type
        if let Some(weight) = self.source_weights.get(&source.source_type) {
            score = *weight;
        }
        
        // Adjust based on domain
        let domain = self.extract_domain(&source.url);
        if self.trusted_domains.iter().any(|d| domain.contains(d)) {
            score += 0.2;
        } else if self.low_credibility_domains.iter().any(|d| domain.contains(d)) {
            score -= 0.3;
        }
        
        // Adjust based on publication date (newer is better)
        if let Some(pub_date) = source.publication_date {
            let days_old = (Utc::now() - pub_date).num_days();
            if days_old <= 7 {
                score += 0.1;
            } else if days_old > 365 {
                score -= 0.1;
            }
        }
        
        // Adjust based on relevance score
        score += source.relevance_score * 0.2;
        
        score.max(0.0).min(1.0)
    }
    
    fn extract_domain(&self, url: &str) -> String {
        if let Some(domain) = url.split("//").nth(1) {
            if let Some(domain) = domain.split('/').next() {
                return domain.to_string();
            }
        }
        url.to_string()
    }
}

impl RiskIntelligenceSystem {
    pub fn new(config: RiskIntelligenceConfig) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds as u64))
            .build()?;

        Ok(Self {
            config,
            cache: Arc::new(RwLock::new(HashMap::new())),
            http_client,
            sentiment_analyzer: Arc::new(SentimentAnalyzer::new()),
            credibility_scorer: Arc::new(CredibilityScorer::new()),
        })
    }

    /// Query risk intelligence using Perplexity API
    pub async fn query_risk_intelligence(
        &self,
        query: RiskIntelligenceQuery,
    ) -> Result<RiskIntelligenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        let cache_key = self.generate_cache_key(&query);
        if let Some(cached_response) = self.get_cached_response(&cache_key).await? {
            return Ok(cached_response);
        }

        // Generate prompt
        let prompt = self.generate_prompt(&query).await?;
        
        // Query Perplexity API
        let perplexity_response = self.query_perplexity_api(&prompt).await?;
        
        // Parse and analyze response
        let risk_response = self.parse_risk_response(&perplexity_response, &query).await?;
        
        // Cache the response
        self.cache_response(&cache_key, &risk_response).await?;
        
        Ok(risk_response)
    }

    /// Generate cache key for query
    async fn generate_cache_key(&self, query: &RiskIntelligenceQuery) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        format!("{:?}", query.query_type).hash(&mut hasher);
        query.target.hash(&mut hasher);
        query.time_window.hash(&mut hasher);
        query.jurisdiction.hash(&mut hasher);
        
        format!("risk_intelligence_{:x}", hasher.finish())
    }

    /// Get cached response
    async fn get_cached_response(&self, cache_key: &str) -> Result<Option<RiskIntelligenceResponse>, Box<dyn std::error::Error + Send + Sync>> {
        let cache = self.cache.read().await;
        if let Some(cached) = cache.get(cache_key) {
            if Utc::now() < cached.expires_at {
                return Ok(Some(cached.response.clone()));
            }
        }
        Ok(None)
    }

    /// Cache response
    async fn cache_response(&self, cache_key: &str, response: &RiskIntelligenceResponse) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let expires_at = Utc::now() + chrono::Duration::minutes(self.config.cache_duration_minutes as i64);
        let cached_response = CachedRiskResponse {
            response: response.clone(),
            cached_at: Utc::now(),
            expires_at,
        };
        
        let mut cache = self.cache.write().await;
        cache.insert(cache_key.to_string(), cached_response);
        Ok(())
    }

    /// Generate prompt for Perplexity API
    async fn generate_prompt(&self, query: &RiskIntelligenceQuery) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let base_prompt = self.config.risk_prompts.get(&query.query_type)
            .ok_or("No prompt template found for query type")?;
        
        let mut prompt = base_prompt.clone();
        prompt = prompt.replace("{target}", &query.target);
        
        if let Some(jurisdiction) = &query.jurisdiction {
            prompt = prompt.replace("{jurisdiction}", jurisdiction);
        }
        
        // Add custom prompt if provided
        if let Some(custom) = &query.custom_prompt {
            prompt = format!("{}\n\nAdditional context: {}", prompt, custom);
        }
        
        // Add risk factors if specified
        if !query.risk_factors.is_empty() {
            let factors = query.risk_factors.join(", ");
            prompt = format!("{}\n\nFocus on these specific risk factors: {}", prompt, factors);
        }
        
        // Add time window if specified
        if let Some(window) = query.time_window {
            prompt = format!("{}\n\nFocus on events and developments from the last {} days.", prompt, window);
        }
        
        // Add output format requirements
        prompt = format!("{}\n\nPlease provide a structured analysis including:\n1. Overall risk assessment\n2. Specific risk factors with likelihood and impact\n3. Recent relevant events or incidents\n4. Mitigation strategies\n5. Credible sources and references", prompt);
        
        Ok(prompt)
    }

    /// Query Perplexity API
    async fn query_perplexity_api(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let request_body = serde_json::json!({
            "model": self.config.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "top_p": 0.9,
            "stream": false
        });

        let response = self.http_client
            .post(&format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Perplexity API error: {}", response.status()).into());
        }

        let response_json: serde_json::Value = response.json().await?;
        
        let content = response_json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("Invalid response format from Perplexity API")?;

        Ok(content.to_string())
    }

    /// Parse risk response from Perplexity API
    async fn parse_risk_response(
        &self,
        perplexity_response: &str,
        query: &RiskIntelligenceQuery,
    ) -> Result<RiskIntelligenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Extract risk factors
        let risk_factors = self.extract_risk_factors(perplexity_response).await?;
        
        // Calculate overall risk score
        let risk_score = self.calculate_risk_score(&risk_factors).await?;
        let risk_level = self.determine_risk_level(risk_score).await?;
        
        // Perform sentiment analysis if enabled
        let sentiment_analysis = if self.config.enable_sentiment_analysis {
            self.sentiment_analyzer.analyze_sentiment(perplexity_response).await
        } else {
            SentimentAnalysis {
                overall_sentiment: Sentiment::Neutral,
                sentiment_score: 0.0,
                confidence: 0.0,
                key_phrases: Vec::new(),
                trend_direction: TrendDirection::Unknown,
                volatility_indicator: false,
            }
        };
        
        // Extract sources
        let sources = self.extract_sources(perplexity_response).await?;
        
        // Calculate credibility score
        let credibility_score = if self.config.enable_credibility_scoring && !sources.is_empty() {
            let mut total_score = 0.0;
            for source in &sources {
                total_score += self.credibility_scorer.score_credibility(source).await;
            }
            total_score / sources.len() as f64
        } else {
            0.5 // Default credibility score
        };
        
        // Generate recommendations
        let recommendations = self.generate_recommendations(&risk_factors, risk_score).await?;
        
        Ok(RiskIntelligenceResponse {
            query: query.clone(),
            risk_score,
            risk_level,
            risk_factors,
            sentiment_analysis,
            credibility_score,
            recommendations,
            sources,
            timestamp: Utc::now(),
            confidence: self.calculate_confidence(perplexity_response, &sources).await?,
        })
    }

    /// Extract risk factors from response
    async fn extract_risk_factors(&self, response: &str) -> Result<Vec<RiskFactor>, Box<dyn std::error::Error + Send + Sync>> {
        let mut risk_factors = Vec::new();
        
        // Simple extraction based on keywords and patterns
        let risk_keywords = [
            "vulnerability", "exploit", "attack", "breach", "hack", "risk",
            "threat", "danger", "weakness", "flaw", "issue", "problem",
        ];
        
        let lines: Vec<&str> = response.lines().collect();
        for line in lines {
            for keyword in &risk_keywords {
                if line.to_lowercase().contains(keyword) {
                    risk_factors.push(RiskFactor {
                        factor: keyword.to_string(),
                        description: line.trim().to_string(),
                        impact_score: 0.5, // Default impact score
                        probability: 0.3, // Default probability
                        time_horizon: TimeHorizon::MediumTerm,
                        mitigation_strategies: vec!["Monitor closely".to_string()],
                        sources: Vec::new(),
                    });
                    break;
                }
            }
        }
        
        // If no risk factors found, create a generic one
        if risk_factors.is_empty() {
            risk_factors.push(RiskFactor {
                factor: "General Risk".to_string(),
                description: "General risk assessment based on available information".to_string(),
                impact_score: 0.3,
                probability: 0.2,
                time_horizon: TimeHorizon::Unknown,
                mitigation_strategies: vec!["Continue monitoring".to_string()],
                sources: Vec::new(),
            });
        }
        
        Ok(risk_factors)
    }

    /// Calculate risk score from risk factors
    async fn calculate_risk_score(&self, risk_factors: &[RiskFactor]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        if risk_factors.is_empty() {
            return Ok(0.0);
        }
        
        let total_score: f64 = risk_factors.iter()
            .map(|factor| factor.impact_score * factor.probability)
            .sum();
        
        let avg_score = total_score / risk_factors.len() as f64;
        Ok(avg_score.min(1.0))
    }

    /// Determine risk level from score
    async fn determine_risk_level(&self, risk_score: f64) -> Result<RiskLevel, Box<dyn std::error::Error + Send + Sync>> {
        match risk_score {
            s if s < 0.25 => Ok(RiskLevel::Low),
            s if s < 0.5 => Ok(RiskLevel::Medium),
            s if s < 0.75 => Ok(RiskLevel::High),
            _ => Ok(RiskLevel::Critical),
        }
    }

    /// Extract sources from response
    async fn extract_sources(&self, response: &str) -> Result<Vec<RiskSource>, Box<dyn std::error::Error + Send + Sync>> {
        let mut sources = Vec::new();
        
        // Simple URL extraction
        let url_pattern = regex::Regex::new(r"https?://[^\s]+")?;
        for cap in url_pattern.find_iter(response) {
            let url = cap.as_str();
            sources.push(RiskSource {
                url: url.to_string(),
                title: format!("Source: {}", url),
                credibility_score: 0.5,
                publication_date: None,
                source_type: self.classify_source_type(url).await?,
                relevance_score: 0.7,
            });
        }
        
        Ok(sources)
    }

    /// Classify source type based on URL
    async fn classify_source_type(&self, url: &str) -> Result<SourceType, Box<dyn std::error::Error + Send + Sync>> {
        let url_lower = url.to_lowercase();
        
        if url_lower.contains("gov") || url_lower.contains("government") {
            Ok(SourceType::GovernmentReport)
        } else if url_lower.contains("arxiv") || url_lower.contains("research") {
            Ok(SourceType::ResearchPaper)
        } else if url_lower.contains("news") || url_lower.contains("reuters") || url_lower.contains("bloomberg") {
            Ok(SourceType::NewsArticle)
        } else if url_lower.contains("twitter") || url_lower.contains("reddit") {
            Ok(SourceType::SocialMedia)
        } else if url_lower.contains("medium") || url_lower.contains("blog") {
            Ok(SourceType::BlogPost)
        } else {
            Ok(SourceType::Unknown)
        }
    }

    /// Generate recommendations based on risk factors
    async fn generate_recommendations(
        &self,
        risk_factors: &[RiskFactor],
        risk_score: f64,
    ) -> Result<Vec<RiskRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        let mut recommendations = Vec::new();
        
        // High risk recommendations
        if risk_score > 0.7 {
            recommendations.push(RiskRecommendation {
                recommendation: "Immediate action required: Implement enhanced security measures and monitoring".to_string(),
                priority: RecommendationPriority::Critical,
                expected_impact: 0.8,
                implementation_difficulty: ImplementationDifficulty::Difficult,
                time_to_implement: TimeHorizon::Immediate,
                cost_estimate: Some(10000.0),
            });
        }
        
        // Medium risk recommendations
        if risk_score > 0.4 {
            recommendations.push(RiskRecommendation {
                recommendation: "Enhanced monitoring and risk mitigation strategies recommended".to_string(),
                priority: RecommendationPriority::High,
                expected_impact: 0.6,
                implementation_difficulty: ImplementationDifficulty::Moderate,
                time_to_implement: TimeHorizon::ShortTerm,
                cost_estimate: Some(5000.0),
            });
        }
        
        // General recommendations
        recommendations.push(RiskRecommendation {
            recommendation: "Continue monitoring and maintain current security protocols".to_string(),
            priority: RecommendationPriority::Medium,
            expected_impact: 0.3,
            implementation_difficulty: ImplementationDifficulty::Easy,
            time_to_implement: TimeHorizon::MediumTerm,
            cost_estimate: Some(1000.0),
        });
        
        Ok(recommendations)
    }

    /// Calculate confidence in the analysis
    async fn calculate_confidence(&self, response: &str, sources: &[RiskSource]) -> Result<f64, Box<dyn std::error::Error + Send + Sync>> {
        let mut confidence = 0.5; // Base confidence
        
        // Increase confidence based on response length and detail
        if response.len() > 1000 {
            confidence += 0.2;
        }
        
        // Increase confidence based on number of sources
        if sources.len() > 3 {
            confidence += 0.2;
        } else if sources.len() > 1 {
            confidence += 0.1;
        }
        
        // Increase confidence based on source credibility
        if !sources.is_empty() {
            let avg_credibility: f64 = sources.iter().map(|s| s.credibility_score).sum::<f64>() / sources.len() as f64;
            confidence += avg_credibility * 0.1;
        }
        
        Ok(confidence.min(1.0))
    }

    /// Clear cache
    pub async fn clear_cache(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut cache = self.cache.write().await;
        cache.clear();
        info!("Risk intelligence cache cleared");
        Ok(())
    }

    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> Result<HashMap<String, usize>, Box<dyn std::error::Error + Send + Sync>> {
        let cache = self.cache.read().await;
        Ok(HashMap::from([
            ("total_entries".to_string(), cache.len()),
            ("cache_size".to_string(), cache.len()),
        ]))
    }
}

impl Default for RiskIntelligenceSystem {
    fn default() -> Self {
        Self::new(RiskIntelligenceConfig::default()).unwrap()
    }
}

impl Default for SentimentAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for CredibilityScorer {
    fn default() -> Self {
        Self::new()
    }
} 