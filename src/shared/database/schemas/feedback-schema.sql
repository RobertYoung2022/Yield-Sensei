-- YieldSensei User Feedback Collection System Database Schema
-- Extends existing PostgreSQL schema with comprehensive feedback capabilities
-- Supports AI recommendations, risk settings, and educational content feedback

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Feedback categories
CREATE TYPE feedback_category_enum AS ENUM (
    'ai_recommendation',
    'risk_setting', 
    'educational_content',
    'ui_experience',
    'portfolio_suggestion',
    'yield_opportunity',
    'risk_assessment',
    'market_insight',
    'strategy_recommendation',
    'general'
);

-- Feedback types
CREATE TYPE feedback_type_enum AS ENUM (
    'rating',           -- Numeric rating (1-5 stars)
    'thumbs',          -- Thumbs up/down
    'text',            -- Free text feedback
    'structured',      -- Structured questionnaire
    'implicit'         -- Implicit feedback (clicks, time spent, etc.)
);

-- Feedback sentiment
CREATE TYPE feedback_sentiment_enum AS ENUM (
    'very_negative',
    'negative', 
    'neutral',
    'positive',
    'very_positive',
    'unknown'
);

-- Content interaction types
CREATE TYPE interaction_type_enum AS ENUM (
    'view',
    'click', 
    'hover',
    'scroll',
    'dismiss',
    'accept',
    'reject',
    'share',
    'bookmark'
);

-- Privacy settings
CREATE TYPE feedback_privacy_enum AS ENUM (
    'anonymous',       -- Completely anonymous
    'pseudonymous',    -- Linked to user but anonymized in reports
    'identified'       -- Fully identified feedback
);

-- =============================================================================
-- CORE FEEDBACK TABLES
-- =============================================================================

-- Main feedback table
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    
    -- Feedback classification
    category feedback_category_enum NOT NULL,
    feedback_type feedback_type_enum NOT NULL,
    privacy_level feedback_privacy_enum NOT NULL DEFAULT 'pseudonymous',
    
    -- Content being rated/reviewed
    content_type VARCHAR(100) NOT NULL, -- 'recommendation', 'alert', 'strategy', etc.
    content_id VARCHAR(255), -- ID of the specific content item
    content_context JSONB DEFAULT '{}'::jsonb, -- Additional context about the content
    
    -- Feedback data
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- For rating type feedback
    thumbs_rating BOOLEAN, -- For thumbs up/down feedback
    text_feedback TEXT, -- For text feedback
    structured_data JSONB DEFAULT '{}'::jsonb, -- For structured questionnaires
    
    -- Metadata
    sentiment feedback_sentiment_enum DEFAULT 'unknown',
    confidence_score DECIMAL(3,2) DEFAULT 0.0, -- AI confidence in sentiment analysis
    tags TEXT[], -- Searchable tags
    
    -- Context information
    user_agent TEXT,
    ip_address INET,
    referrer_url TEXT,
    page_context JSONB DEFAULT '{}'::jsonb,
    
    -- Temporal data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexing
    CONSTRAINT valid_feedback_data CHECK (
        (feedback_type = 'rating' AND rating IS NOT NULL) OR
        (feedback_type = 'thumbs' AND thumbs_rating IS NOT NULL) OR  
        (feedback_type = 'text' AND text_feedback IS NOT NULL) OR
        (feedback_type = 'structured' AND structured_data != '{}'::jsonb) OR
        (feedback_type = 'implicit')
    )
);

-- Feedback sessions for contextual grouping
CREATE TABLE feedback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    
    -- Session context
    session_type VARCHAR(50) NOT NULL, -- 'onboarding', 'portfolio_review', 'strategy_setup'
    context_data JSONB DEFAULT '{}'::jsonb,
    
    -- Session metrics
    total_interactions INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0.0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Content interaction tracking (implicit feedback)
CREATE TABLE content_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feedback_session_id UUID REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    
    -- Content identification
    content_type VARCHAR(100) NOT NULL,
    content_id VARCHAR(255) NOT NULL,
    
    -- Interaction details
    interaction_type interaction_type_enum NOT NULL,
    interaction_value DECIMAL(10,4), -- Time spent, scroll depth, etc.
    interaction_context JSONB DEFAULT '{}'::jsonb,
    
    -- Timing
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_ms INTEGER -- How long the interaction lasted
);

-- =============================================================================
-- FEEDBACK CATEGORIZATION AND TAGGING
-- =============================================================================

-- Feedback categories with metadata
CREATE TABLE feedback_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name feedback_category_enum UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    requires_rating BOOLEAN DEFAULT false,
    requires_text BOOLEAN DEFAULT false,
    max_text_length INTEGER DEFAULT 1000,
    
    -- UI configuration
    icon_name VARCHAR(50),
    color_theme VARCHAR(20),
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback tags for better categorization
CREATE TABLE feedback_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name VARCHAR(50) UNIQUE NOT NULL,
    category feedback_category_enum,
    
    -- Tag metadata
    description TEXT,
    is_system_tag BOOLEAN DEFAULT false, -- Auto-generated vs user-generated
    usage_count INTEGER DEFAULT 0,
    
    -- Temporal data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Junction table for feedback-tag relationships
CREATE TABLE feedback_tag_associations (
    feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES feedback_tags(id) ON DELETE CASCADE,
    confidence DECIMAL(3,2) DEFAULT 1.0, -- For AI-generated tags
    
    PRIMARY KEY (feedback_id, tag_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- FEEDBACK ANALYTICS AND AGGREGATION
-- =============================================================================

-- Aggregated feedback metrics per content type/category
CREATE TABLE feedback_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Grouping dimensions
    content_type VARCHAR(100) NOT NULL,
    content_id VARCHAR(255),
    category feedback_category_enum NOT NULL,
    time_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metrics
    total_feedback_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2),
    rating_distribution JSONB DEFAULT '{}'::jsonb, -- {1: count, 2: count, ...}
    thumbs_up_count INTEGER DEFAULT 0,
    thumbs_down_count INTEGER DEFAULT 0,
    text_feedback_count INTEGER DEFAULT 0,
    
    -- Sentiment analysis
    sentiment_distribution JSONB DEFAULT '{}'::jsonb,
    avg_sentiment_score DECIMAL(3,2),
    
    -- User engagement
    unique_users_count INTEGER DEFAULT 0,
    repeat_feedback_count INTEGER DEFAULT 0,
    
    -- Metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(content_type, content_id, category, period_start)
);

-- Feedback trends and insights
CREATE TABLE feedback_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Insight classification
    insight_type VARCHAR(50) NOT NULL, -- 'trend', 'anomaly', 'correlation'
    category feedback_category_enum NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    
    -- Insight data
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    data_points JSONB DEFAULT '{}'::jsonb,
    confidence_score DECIMAL(3,2) NOT NULL,
    
    -- Actionable recommendations
    recommendations JSONB DEFAULT '{}'::jsonb,
    priority_score INTEGER DEFAULT 0,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    -- Temporal data
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- PRIVACY AND COMPLIANCE
-- =============================================================================

-- GDPR and privacy compliance tracking
CREATE TABLE feedback_privacy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Consent settings
    feedback_collection_consent BOOLEAN DEFAULT false,
    analytics_consent BOOLEAN DEFAULT false,
    improvement_consent BOOLEAN DEFAULT false,
    research_consent BOOLEAN DEFAULT false,
    
    -- Privacy preferences
    default_privacy_level feedback_privacy_enum DEFAULT 'pseudonymous',
    allow_sentiment_analysis BOOLEAN DEFAULT true,
    allow_content_personalization BOOLEAN DEFAULT true,
    
    -- Data retention preferences
    retention_period_days INTEGER DEFAULT 365,
    auto_deletion_enabled BOOLEAN DEFAULT false,
    
    -- Metadata
    consent_given_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address_at_consent INET
);

-- Data retention and deletion tracking
CREATE TABLE feedback_data_retention (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Retention tracking
    data_type VARCHAR(50) NOT NULL, -- 'feedback', 'interactions', 'analytics'
    retention_policy VARCHAR(50) NOT NULL,
    scheduled_deletion_date TIMESTAMP WITH TIME ZONE,
    
    -- Deletion tracking
    deletion_requested_at TIMESTAMP WITH TIME ZONE,
    deletion_completed_at TIMESTAMP WITH TIME ZONE,
    deletion_method VARCHAR(50), -- 'soft_delete', 'hard_delete', 'anonymize'
    
    -- Compliance
    legal_basis VARCHAR(100), -- GDPR legal basis
    processing_purposes TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- FEEDBACK TRIGGERS AND AUTOMATION
-- =============================================================================

-- Feedback collection triggers and rules
CREATE TABLE feedback_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Trigger identification
    trigger_name VARCHAR(100) UNIQUE NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- 'time_based', 'event_based', 'interaction_based'
    
    -- Trigger conditions
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_categories feedback_category_enum[],
    target_content_types VARCHAR(100)[],
    
    -- Trigger behavior
    feedback_template JSONB DEFAULT '{}'::jsonb,
    max_triggers_per_user INTEGER DEFAULT 1,
    cooldown_period INTERVAL DEFAULT '24 hours',
    
    -- Status and metrics
    is_active BOOLEAN DEFAULT true,
    total_triggers INTEGER DEFAULT 0,
    successful_collections INTEGER DEFAULT 0,
    
    -- Temporal data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User feedback trigger history
CREATE TABLE user_feedback_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_id UUID NOT NULL REFERENCES feedback_triggers(id) ON DELETE CASCADE,
    
    -- Trigger execution
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'responded', 'dismissed', 'expired'
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Context
    trigger_context JSONB DEFAULT '{}'::jsonb,
    feedback_id UUID REFERENCES user_feedback(id) ON DELETE SET NULL,
    
    UNIQUE(user_id, trigger_id, triggered_at)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Main feedback table indexes
CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_category ON user_feedback(category);
CREATE INDEX idx_user_feedback_content_type ON user_feedback(content_type);
CREATE INDEX idx_user_feedback_created_at ON user_feedback(created_at);
CREATE INDEX idx_user_feedback_sentiment ON user_feedback(sentiment);
CREATE INDEX idx_user_feedback_rating ON user_feedback(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_user_feedback_content_lookup ON user_feedback(content_type, content_id);

-- Composite indexes for common queries
CREATE INDEX idx_user_feedback_user_category_date ON user_feedback(user_id, category, created_at);
CREATE INDEX idx_user_feedback_content_rating_date ON user_feedback(content_type, rating, created_at) WHERE rating IS NOT NULL;

-- Analytics table indexes
CREATE INDEX idx_feedback_analytics_content ON feedback_analytics(content_type, content_id);
CREATE INDEX idx_feedback_analytics_period ON feedback_analytics(period_start, period_end);
CREATE INDEX idx_feedback_analytics_category_period ON feedback_analytics(category, period_start);

-- Interactions table indexes
CREATE INDEX idx_content_interactions_user_id ON content_interactions(user_id);
CREATE INDEX idx_content_interactions_content ON content_interactions(content_type, content_id);
CREATE INDEX idx_content_interactions_occurred_at ON content_interactions(occurred_at);

-- Sessions table indexes
CREATE INDEX idx_feedback_sessions_user_id ON feedback_sessions(user_id);
CREATE INDEX idx_feedback_sessions_started_at ON feedback_sessions(started_at);
CREATE INDEX idx_feedback_sessions_session_type ON feedback_sessions(session_type);

-- Privacy settings indexes
CREATE INDEX idx_feedback_privacy_settings_user_id ON feedback_privacy_settings(user_id);

-- Triggers indexes
CREATE INDEX idx_user_feedback_triggers_user_id ON user_feedback_triggers(user_id);
CREATE INDEX idx_user_feedback_triggers_triggered_at ON user_feedback_triggers(triggered_at);
CREATE INDEX idx_user_feedback_triggers_status ON user_feedback_triggers(response_status);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- User feedback summary view
CREATE VIEW user_feedback_summary AS
SELECT 
    uf.user_id,
    uf.category,
    COUNT(*) as total_feedback,
    AVG(uf.rating) as avg_rating,
    SUM(CASE WHEN uf.thumbs_rating = true THEN 1 ELSE 0 END) as thumbs_up,
    SUM(CASE WHEN uf.thumbs_rating = false THEN 1 ELSE 0 END) as thumbs_down,
    COUNT(CASE WHEN uf.text_feedback IS NOT NULL THEN 1 END) as text_feedback_count,
    COUNT(CASE WHEN uf.sentiment IN ('positive', 'very_positive') THEN 1 END) as positive_sentiment,
    COUNT(CASE WHEN uf.sentiment IN ('negative', 'very_negative') THEN 1 END) as negative_sentiment,
    MIN(uf.created_at) as first_feedback_date,
    MAX(uf.created_at) as last_feedback_date
FROM user_feedback uf
GROUP BY uf.user_id, uf.category;

-- Content performance view
CREATE VIEW content_feedback_performance AS
SELECT 
    uf.content_type,
    uf.content_id,
    uf.category,
    COUNT(*) as total_feedback,
    AVG(uf.rating) as avg_rating,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY uf.rating) as median_rating,
    COUNT(DISTINCT uf.user_id) as unique_users,
    SUM(CASE WHEN uf.thumbs_rating = true THEN 1 ELSE 0 END) as thumbs_up,
    SUM(CASE WHEN uf.thumbs_rating = false THEN 1 ELSE 0 END) as thumbs_down,
    COUNT(CASE WHEN uf.sentiment IN ('positive', 'very_positive') THEN 1 END) as positive_sentiment,
    COUNT(CASE WHEN uf.sentiment IN ('negative', 'very_negative') THEN 1 END) as negative_sentiment
FROM user_feedback uf
WHERE uf.content_id IS NOT NULL
GROUP BY uf.content_type, uf.content_id, uf.category;

-- Recent feedback trends view
CREATE VIEW recent_feedback_trends AS
SELECT 
    DATE_TRUNC('day', uf.created_at) as feedback_date,
    uf.category,
    COUNT(*) as daily_feedback_count,
    AVG(uf.rating) as avg_daily_rating,
    COUNT(CASE WHEN uf.sentiment IN ('positive', 'very_positive') THEN 1 END) as positive_count,
    COUNT(CASE WHEN uf.sentiment IN ('negative', 'very_negative') THEN 1 END) as negative_count,
    COUNT(DISTINCT uf.user_id) as unique_users_daily
FROM user_feedback uf
WHERE uf.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', uf.created_at), uf.category
ORDER BY feedback_date DESC, uf.category;

-- =============================================================================
-- TRIGGERS FOR AUTOMATION
-- =============================================================================

-- Update feedback analytics trigger
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to relevant tables
CREATE TRIGGER trigger_user_feedback_updated_at
    BEFORE UPDATE ON user_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

CREATE TRIGGER trigger_feedback_categories_updated_at
    BEFORE UPDATE ON feedback_categories
    FOR EACH ROW  
    EXECUTE FUNCTION update_feedback_updated_at();

CREATE TRIGGER trigger_feedback_triggers_updated_at
    BEFORE UPDATE ON feedback_triggers
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- Increment tag usage count trigger
CREATE OR REPLACE FUNCTION increment_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE feedback_tags 
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = NEW.tag_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_tag_usage
    AFTER INSERT ON feedback_tag_associations
    FOR EACH ROW
    EXECUTE FUNCTION increment_tag_usage();

-- =============================================================================
-- INITIAL DATA SETUP
-- =============================================================================

-- Insert default feedback categories
INSERT INTO feedback_categories (category_name, display_name, description, requires_rating, icon_name, display_order) VALUES
('ai_recommendation', 'AI Recommendations', 'Feedback on AI-generated investment recommendations', true, 'ai-chip', 1),
('risk_setting', 'Risk Settings', 'Feedback on risk assessment and management features', true, 'shield-check', 2),
('educational_content', 'Educational Content', 'Feedback on educational materials and explanations', true, 'academic-cap', 3),
('ui_experience', 'User Experience', 'Feedback on user interface and overall experience', true, 'user-interface', 4),
('portfolio_suggestion', 'Portfolio Suggestions', 'Feedback on portfolio optimization suggestions', true, 'chart-pie', 5),
('yield_opportunity', 'Yield Opportunities', 'Feedback on yield farming and staking opportunities', true, 'currency-dollar', 6),
('risk_assessment', 'Risk Assessments', 'Feedback on risk analysis and alerts', true, 'exclamation-triangle', 7),
('market_insight', 'Market Insights', 'Feedback on market analysis and insights', true, 'trending-up', 8),
('strategy_recommendation', 'Strategy Recommendations', 'Feedback on trading and investment strategies', true, 'light-bulb', 9),
('general', 'General Feedback', 'General feedback and suggestions', false, 'chat-bubble', 10);

-- Insert common feedback tags
INSERT INTO feedback_tags (tag_name, category, description, is_system_tag) VALUES
('helpful', NULL, 'Content was helpful', true),
('confusing', NULL, 'Content was confusing or unclear', true),
('accurate', 'ai_recommendation', 'AI recommendation was accurate', true),
('inaccurate', 'ai_recommendation', 'AI recommendation was not accurate', true),
('too_conservative', 'risk_setting', 'Risk settings too conservative', true),
('too_aggressive', 'risk_setting', 'Risk settings too aggressive', true),
('easy_to_understand', 'educational_content', 'Educational content was easy to understand', true),
('needs_more_detail', 'educational_content', 'Educational content needs more detail', true),
('intuitive', 'ui_experience', 'User interface was intuitive', true),
('difficult_to_navigate', 'ui_experience', 'User interface was difficult to navigate', true),
('profitable', 'yield_opportunity', 'Yield opportunity was profitable', true),
('unprofitable', 'yield_opportunity', 'Yield opportunity was not profitable', true),
('timely', 'risk_assessment', 'Risk assessment was timely', true),
('late', 'risk_assessment', 'Risk assessment came too late', true);

-- Insert default feedback triggers
INSERT INTO feedback_triggers (trigger_name, trigger_type, conditions, target_categories, max_triggers_per_user) VALUES
('post_recommendation_feedback', 'event_based', '{"event": "recommendation_shown", "delay_minutes": 5}', 
 ARRAY['ai_recommendation'::feedback_category_enum], 3),

('weekly_experience_feedback', 'time_based', '{"frequency": "weekly", "day_of_week": "friday"}',
 ARRAY['ui_experience'::feedback_category_enum, 'general'::feedback_category_enum], 1),

('post_yield_action_feedback', 'event_based', '{"event": "yield_action_completed", "delay_minutes": 60}',
 ARRAY['yield_opportunity'::feedback_category_enum], 2),

('risk_alert_feedback', 'event_based', '{"event": "risk_alert_shown", "delay_minutes": 10}',
 ARRAY['risk_assessment'::feedback_category_enum], 5),

('educational_content_feedback', 'interaction_based', '{"interaction": "content_completed", "content_type": "educational"}',
 ARRAY['educational_content'::feedback_category_enum], 10);

-- Set up privacy settings defaults
CREATE OR REPLACE FUNCTION setup_default_feedback_privacy()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO feedback_privacy_settings (user_id, feedback_collection_consent, analytics_consent, improvement_consent)
    VALUES (NEW.id, false, false, false);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- This trigger will be applied when users are created
-- CREATE TRIGGER trigger_setup_feedback_privacy
--     AFTER INSERT ON users
--     FOR EACH ROW
--     EXECUTE FUNCTION setup_default_feedback_privacy();

-- =============================================================================
-- DOCUMENTATION AND COMMENTS
-- =============================================================================

COMMENT ON TABLE user_feedback IS 'Main table storing all user feedback across different categories and types';
COMMENT ON TABLE feedback_sessions IS 'Groups related feedback within a user session for contextual analysis';  
COMMENT ON TABLE content_interactions IS 'Tracks implicit feedback through user interactions with content';
COMMENT ON TABLE feedback_categories IS 'Configuration for different feedback categories with UI settings';
COMMENT ON TABLE feedback_tags IS 'Flexible tagging system for categorizing and searching feedback';
COMMENT ON TABLE feedback_analytics IS 'Pre-aggregated analytics data for performance and reporting';
COMMENT ON TABLE feedback_insights IS 'AI-generated insights and trends from feedback analysis';
COMMENT ON TABLE feedback_privacy_settings IS 'User privacy preferences and GDPR compliance settings';
COMMENT ON TABLE feedback_data_retention IS 'Tracks data retention and deletion for compliance';
COMMENT ON TABLE feedback_triggers IS 'Configuration for automated feedback collection triggers';
COMMENT ON TABLE user_feedback_triggers IS 'History of feedback triggers sent to users';

COMMENT ON COLUMN user_feedback.sentiment IS 'AI-analyzed sentiment of the feedback content';
COMMENT ON COLUMN user_feedback.confidence_score IS 'AI confidence level in sentiment analysis (0.0-1.0)';
COMMENT ON COLUMN user_feedback.privacy_level IS 'Privacy level for this specific feedback entry';
COMMENT ON COLUMN feedback_analytics.rating_distribution IS 'JSON object with rating counts: {"1": 5, "2": 10, "3": 15, "4": 20, "5": 25}';
COMMENT ON COLUMN feedback_insights.confidence_score IS 'AI confidence in the insight accuracy (0.0-1.0)';
COMMENT ON COLUMN feedback_privacy_settings.retention_period_days IS 'Number of days to retain user feedback data';