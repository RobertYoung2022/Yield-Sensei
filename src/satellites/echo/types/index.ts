/**
 * Echo Satellite Types
 * Sentiment Analysis and Community Trend Analysis Types
 */

export interface SentimentData {
  id: string;
  source: SocialPlatform;
  content: string;
  author: {
    id: string;
    username: string;
    followersCount?: number;
    verified?: boolean;
    influence?: number;
  };
  timestamp: Date;
  engagement: {
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
    shares?: number;
  };
  metadata: {
    url?: string;
    threadId?: string;
    channelId?: string;
    language?: string;
    isRetweet?: boolean;
    parentId?: string;
  };
}

export interface SentimentAnalysis {
  id: string;
  content: string;
  sentiment: {
    overall: SentimentType;
    score: number; // -1 to 1
    confidence: number; // 0 to 1
    emotions: EmotionScores;
  };
  entities: EntityMention[];
  themes: Theme[];
  influence: {
    reach: number;
    amplification: number;
    credibility: number;
  };
  market: {
    bullish: number;
    bearish: number;
    neutral: number;
    fomo: number;
    fud: number;
  };
  timestamp: Date;
  processed: Date;
}

export interface EntityMention {
  entity: string;
  type: EntityType;
  confidence: number;
  sentiment: SentimentType;
  context: string;
  position: {
    start: number;
    end: number;
  };
  normalized?: string; // Canonical form
  metadata?: {
    ticker?: string;
    contractAddress?: string;
    protocol?: string;
    chain?: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  keywords: string[];
  sentiment: SentimentType;
  confidence: number;
  frequency: number;
  trending: boolean;
  impact: ThemeImpact;
}

export interface TrendAnalysis {
  id: string;
  timeframe: TimeFrame;
  period: {
    start: Date;
    end: Date;
  };
  entity?: string;
  theme?: string;
  platform?: SocialPlatform;
  metrics: {
    volume: number;
    sentiment: SentimentTrend;
    engagement: EngagementTrend;
    reach: number;
    influencerParticipation: number;
  };
  patterns: TrendPattern[];
  anomalies: Anomaly[];
  predictions: TrendPrediction[];
  confidence: number;
}

export interface SentimentTrend {
  current: SentimentType;
  previous: SentimentType;
  change: number; // Percentage change
  direction: 'improving' | 'declining' | 'stable';
  momentum: 'accelerating' | 'decelerating' | 'steady';
  volatility: number;
  timeline: Array<{
    timestamp: Date;
    sentiment: SentimentType;
    score: number;
    volume: number;
  }>;
}

export interface EngagementTrend {
  current: number;
  previous: number;
  change: number;
  peak: {
    value: number;
    timestamp: Date;
  };
  average: number;
  timeline: Array<{
    timestamp: Date;
    engagement: number;
    reach: number;
  }>;
}

export interface TrendPattern {
  type: PatternType;
  description: string;
  confidence: number;
  significance: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // milliseconds
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'event-driven';
  triggers?: string[];
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected: Date;
  description: string;
  entity?: string;
  metrics: {
    baseline: number;
    observed: number;
    deviation: number;
    confidence: number;
  };
  potential_causes: string[];
  impact_assessment: string;
}

export interface TrendPrediction {
  timeframe: TimeFrame;
  confidence: number;
  predicted_sentiment: SentimentType;
  predicted_volume: number;
  factors: PredictionFactor[];
  scenarios: Array<{
    name: string;
    probability: number;
    outcome: string;
    timeline: string;
  }>;
}

export interface PredictionFactor {
  factor: string;
  weight: number;
  confidence: number;
  type: 'technical' | 'social' | 'fundamental' | 'external';
}

export interface InfluencerAnalysis {
  id: string;
  influencer: {
    id: string;
    username: string;
    platform: SocialPlatform;
    metrics: InfluencerMetrics;
  };
  influence: {
    reach: number;
    engagement_rate: number;
    sentiment_impact: number;
    market_moving_potential: number;
    credibility_score: number;
  };
  activity: {
    post_frequency: number;
    engagement_patterns: EngagementPattern[];
    topics: string[];
    sentiment_distribution: SentimentDistribution;
  };
  network: {
    followers_overlap: number;
    collaboration_frequency: number;
    echo_chamber_score: number;
  };
}

export interface InfluencerMetrics {
  followers: number;
  following: number;
  posts: number;
  engagement_rate: number;
  growth_rate: number;
  verified: boolean;
  account_age: number; // days
}

export interface EngagementPattern {
  type: 'daily' | 'weekly' | 'event-driven' | 'random';
  peak_hours: number[];
  frequency: number;
  consistency: number;
}

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
  bullish: number;
  bearish: number;
}

export interface NarrativeAnalysis {
  id: string;
  narrative: string;
  category: NarrativeCategory;
  lifecycle: NarrativeLifecycle;
  metrics: {
    adoption_rate: number;
    spread_velocity: number;
    retention_rate: number;
    sentiment_evolution: SentimentTrend;
  };
  key_drivers: string[];
  influential_voices: string[];
  counter_narratives: string[];
  market_impact: {
    correlation: number;
    lag_time: number; // hours
    amplitude: number;
  };
}

export interface CrossPlatformAnalysis {
  entity: string;
  timeframe: TimeFrame;
  platforms: Map<SocialPlatform, PlatformMetrics>;
  consistency: {
    sentiment: number; // 0-1, how consistent sentiment is across platforms
    volume: number;
    timing: number;
  };
  lead_platform?: SocialPlatform; // Which platform trends appear first
  amplification: {
    primary: SocialPlatform;
    secondary: SocialPlatform[];
    delay: number; // Average delay in hours
  };
  cross_pollination: number; // How much content spreads between platforms
}

export interface PlatformMetrics {
  volume: number;
  sentiment: SentimentTrend;
  engagement: EngagementTrend;
  unique_voices: number;
  top_influencers: string[];
  trending_topics: string[];
}

// Enums and constants
export enum SocialPlatform {
  TWITTER = 'twitter',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  REDDIT = 'reddit',
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  LINKEDIN = 'linkedin'
}

export enum SentimentType {
  VERY_POSITIVE = 'very_positive',
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  VERY_NEGATIVE = 'very_negative'
}

export enum EntityType {
  TOKEN = 'token',
  PROTOCOL = 'protocol',
  PERSON = 'person',
  EXCHANGE = 'exchange',
  CHAIN = 'chain',
  CONCEPT = 'concept',
  EVENT = 'event',
  COMPANY = 'company'
}

export enum ThemeImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TimeFrame {
  HOUR = '1h',
  FOUR_HOURS = '4h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  QUARTER = '3m',
  YEAR = '1y'
}

export enum PatternType {
  PUMP_AND_DUMP = 'pump_and_dump',
  ORGANIC_GROWTH = 'organic_growth',
  FUD_CYCLE = 'fud_cycle',
  HYPE_CYCLE = 'hype_cycle',
  COORDINATED_CAMPAIGN = 'coordinated_campaign',
  VIRAL_SPREAD = 'viral_spread',
  ECHO_CHAMBER = 'echo_chamber',
  COUNTER_NARRATIVE = 'counter_narrative'
}

export enum AnomalyType {
  VOLUME_SPIKE = 'volume_spike',
  SENTIMENT_SHIFT = 'sentiment_shift',
  COORDINATED_POSTING = 'coordinated_posting',
  BOT_ACTIVITY = 'bot_activity',
  INFLUENCER_SILENCE = 'influencer_silence',
  NARRATIVE_EMERGENCE = 'narrative_emergence',
  CROSS_PLATFORM_DIVERGENCE = 'cross_platform_divergence'
}

export enum NarrativeCategory {
  TECHNICAL = 'technical',
  FUNDAMENTAL = 'fundamental',
  REGULATORY = 'regulatory',
  ADOPTION = 'adoption',
  PARTNERSHIP = 'partnership',
  COMPETITIVE = 'competitive',
  MARKET = 'market',
  SOCIAL = 'social'
}

export enum NarrativeLifecycle {
  EMERGING = 'emerging',
  GROWING = 'growing',
  MAINSTREAM = 'mainstream',
  DECLINING = 'declining',
  DORMANT = 'dormant'
}

export interface EmotionScores {
  joy: number;
  fear: number;
  anger: number;
  sadness: number;
  surprise: number;
  trust: number;
  anticipation: number;
  disgust: number;
}

// Event types
export interface SentimentAnalysisEvent {
  type: 'sentiment_analysis_completed';
  data: SentimentAnalysis;
  timestamp: Date;
}

export interface TrendDetectionEvent {
  type: 'trend_detected';
  data: TrendAnalysis;
  timestamp: Date;
}

export interface AnomalyDetectionEvent {
  type: 'anomaly_detected';
  data: Anomaly;
  timestamp: Date;
}

export interface InfluencerActivityEvent {
  type: 'influencer_activity';
  data: InfluencerAnalysis;
  timestamp: Date;
}

export interface NarrativeEmergenceEvent {
  type: 'narrative_emergence';
  data: NarrativeAnalysis;
  timestamp: Date;
}

// Community Engagement Types
export interface EngagementMetrics {
  contentId: string;
  platform: SocialPlatform;
  totalEngagements: number;
  engagementRate: number;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  sentiment: string;
  timestamp: Date;
  authorInfluence: number;
  viralityScore: number;
  reachEstimate: number;
}

export interface CommunityGrowthMetrics {
  id: string;
  timestamp: Date;
  timeframe: 'hour' | 'day' | 'week' | 'month';
  newMembers: number;
  activeMembers: number;
  totalEngagement: number;
  averageSentiment: number;
  growthRate: number;
  engagementRate: number;
  topPlatforms: SocialPlatform[];
  topInfluencers: string[];
  viralContent: string[];
  trends: string[];
}

export interface EngagementResponse {
  id: string;
  originalContentId: string;
  platform: SocialPlatform;
  responseText: string;
  responseType: 'supportive' | 'educational' | 'engaging' | 'informative';
  confidence: number;
  timestamp: Date;
  status: 'pending' | 'posted' | 'failed';
  postedAt?: Date;
  targetAudience: string;
  engagementGoal: string;
  metadata: {
    generatedBy: 'ai' | 'template' | 'manual';
    provider?: string;
    originalSentiment: string;
    triggerRules: string[];
  };
}

export interface EngagementRule {
  id: string;
  name: string;
  conditions: {
    platforms?: SocialPlatform[];
    minInfluence?: number;
    minSentimentScore?: number;
    maxSentimentScore?: number;
    minEngagement?: number;
    keywordMatch?: string[];
  };
  actions: {
    autoRespond: boolean;
    responseType: 'supportive' | 'educational' | 'engaging' | 'informative';
    priority: 'low' | 'medium' | 'high';
  };
  enabled: boolean;
}

export interface CommunityMember {
  id: string;
  username: string;
  platform: SocialPlatform;
  joinDate: Date;
  lastActivity: Date;
  totalPosts: number;
  totalEngagement: number;
  averageSentiment: number;
  influence: number;
  verified: boolean;
  followerCount: number;
  engagementRate: number;
  interests: string[];
  activityScore: number;
  communityRank: 'member' | 'contributor' | 'influencer' | 'leader';
  badges: string[];
}

export interface EngagementAnalytics {
  totalEngagements: number;
  averageEngagementRate: number;
  responseRate: number;
  topEngagedContent: string[];
  engagementByPlatform: Map<SocialPlatform, number>;
  engagementByTime: { timestamp: Date; count: number }[];
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  responseEffectiveness: number;
  communityHealthScore: number;
}

// DeFAI Project Tracking Types
export interface DeFAIProject {
  id: string;
  name: string;
  category: 'defi' | 'ai' | 'defai';
  type: string;
  description: string;
  launchDate: Date;
  discoveredDate: Date;
  platforms: SocialPlatform[];
  tags: string[];
  status: 'discovered' | 'active' | 'inactive' | 'deprecated';
  confidence: number;
  website: string | null;
  social: {
    twitter: string | null;
    discord: string | null;
    telegram: string | null;
  };
  metrics: {
    mentionCount: number;
    sentimentScore: number;
    influencerMentions: number;
    communitySize: number;
    adoptionScore: number;
  };
  lastUpdated: Date;
}

export interface AdoptionSignal {
  id: string;
  projectId: string;
  type: 'launch' | 'partnership' | 'growth' | 'technical' | 'market';
  description: string;
  strength: number; // 0-1
  source: SocialPlatform;
  timestamp: Date;
  originalContent: string;
  author: {
    id: string;
    username: string;
    influence: number;
  };
  metadata: {
    engagement: any;
    sentiment: number;
    keywords: string[];
  };
}

export interface ProjectMetrics {
  projectId: string;
  totalMentions: number;
  mentionVelocity: number; // mentions per hour
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  platformDistribution: Map<SocialPlatform, number>;
  influencerMentions: number;
  communityGrowth: number;
  adoptionSignals: string[];
  viralityScore: number;
  momentumScore: number;
  riskScore: number;
  lastUpdated: Date;
}

export interface TrendingProject {
  projectId: string;
  name: string;
  category: 'defi' | 'ai' | 'defai';
  trendingScore: number;
  mentionVelocity: number;
  sentimentScore: number;
  timestamp: Date;
  rank: number;
  change: number; // Change in rank from previous period
}

export type EchoEvent = 
  | SentimentAnalysisEvent
  | TrendDetectionEvent
  | AnomalyDetectionEvent
  | InfluencerActivityEvent
  | NarrativeEmergenceEvent;

// Request/Response types
export interface SentimentAnalysisRequest {
  content?: string;
  entity?: string;
  platform?: SocialPlatform;
  timeframe?: TimeFrame;
  includeInfluencers?: boolean;
  includeAnomalies?: boolean;
}

export interface TrendAnalysisRequest {
  entity?: string;
  theme?: string;
  platform?: SocialPlatform;
  timeframe: TimeFrame;
  includepredictions?: boolean;
  includeCrossPlatform?: boolean;
}

export interface InfluencerAnalysisRequest {
  influencer?: string;
  platform?: SocialPlatform;
  entity?: string;
  timeframe?: TimeFrame;
}

export interface NarrativeAnalysisRequest {
  narrative?: string;
  category?: NarrativeCategory;
  timeframe?: TimeFrame;
  includeCounterNarratives?: boolean;
}

export interface EchoAnalysisResponse {
  sentiment?: SentimentAnalysis;
  trend?: TrendAnalysis;
  influencer?: InfluencerAnalysis;
  narrative?: NarrativeAnalysis;
  crossPlatform?: CrossPlatformAnalysis;
  metadata: {
    requestId: string;
    processingTime: number;
    dataPoints: number;
    confidence: number;
    timestamp: Date;
  };
}