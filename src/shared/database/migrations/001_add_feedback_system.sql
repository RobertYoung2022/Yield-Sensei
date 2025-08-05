-- Migration: Add User Feedback Collection System
-- Version: 001
-- Description: Adds comprehensive feedback collection tables to existing PostgreSQL schema
-- Dependencies: Requires existing users table and related authentication infrastructure

-- =============================================================================
-- MIGRATION METADATA
-- =============================================================================

-- Migration tracking table (create if not exists)
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rollback_sql TEXT
);

-- Record this migration
INSERT INTO migrations (version, name, description, rollback_sql) VALUES (
    '001',
    'add_feedback_system',
    'Add comprehensive user feedback collection system with analytics, privacy controls, and automation',
    '-- Rollback SQL for migration 001
    DROP VIEW IF EXISTS recent_feedback_trends;
    DROP VIEW IF EXISTS content_feedback_performance; 
    DROP VIEW IF EXISTS user_feedback_summary;
    
    DROP TRIGGER IF EXISTS trigger_increment_tag_usage ON feedback_tag_associations;
    DROP TRIGGER IF EXISTS trigger_feedback_triggers_updated_at ON feedback_triggers;
    DROP TRIGGER IF EXISTS trigger_feedback_categories_updated_at ON feedback_categories;
    DROP TRIGGER IF EXISTS trigger_user_feedback_updated_at ON user_feedback;
    
    DROP FUNCTION IF EXISTS increment_tag_usage();
    DROP FUNCTION IF EXISTS update_feedback_updated_at();
    DROP FUNCTION IF EXISTS setup_default_feedback_privacy();
    
    DROP TABLE IF EXISTS user_feedback_triggers;
    DROP TABLE IF EXISTS feedback_triggers;
    DROP TABLE IF EXISTS feedback_data_retention;
    DROP TABLE IF EXISTS feedback_privacy_settings;
    DROP TABLE IF EXISTS feedback_insights;
    DROP TABLE IF EXISTS feedback_analytics;
    DROP TABLE IF EXISTS feedback_tag_associations;
    DROP TABLE IF EXISTS feedback_tags;
    DROP TABLE IF EXISTS feedback_categories;
    DROP TABLE IF EXISTS content_interactions;
    DROP TABLE IF EXISTS feedback_sessions;
    DROP TABLE IF EXISTS user_feedback;
    
    DROP TYPE IF EXISTS feedback_privacy_enum;
    DROP TYPE IF EXISTS interaction_type_enum;
    DROP TYPE IF EXISTS feedback_sentiment_enum;
    DROP TYPE IF EXISTS feedback_type_enum;
    DROP TYPE IF EXISTS feedback_category_enum;'
) ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- VALIDATION CHECKS
-- =============================================================================

-- Ensure required tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Required table "users" does not exist. Please ensure core database schema is applied first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
        RAISE EXCEPTION 'Required table "user_sessions" does not exist. Please ensure core database schema is applied first.';
    END IF;
END
$$;

-- =============================================================================
-- ENUMS AND TYPES
-- =============================================================================

-- Check if enums exist before creating (for idempotent migrations)
DO $$
BEGIN
    -- Feedback categories
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_category_enum') THEN
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
    END IF;

    -- Feedback types
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type_enum') THEN
        CREATE TYPE feedback_type_enum AS ENUM (
            'rating',           -- Numeric rating (1-5 stars)
            'thumbs',          -- Thumbs up/down
            'text',            -- Free text feedback
            'structured',      -- Structured questionnaire
            'implicit'         -- Implicit feedback (clicks, time spent, etc.)
        );
    END IF;

    -- Feedback sentiment
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_sentiment_enum') THEN
        CREATE TYPE feedback_sentiment_enum AS ENUM (
            'very_negative',
            'negative', 
            'neutral',
            'positive',
            'very_positive',
            'unknown'
        );
    END IF;

    -- Content interaction types
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_type_enum') THEN
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
    END IF;

    -- Privacy settings
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_privacy_enum') THEN
        CREATE TYPE feedback_privacy_enum AS ENUM (
            'anonymous',       -- Completely anonymous
            'pseudonymous',    -- Linked to user but anonymized in reports
            'identified'       -- Fully identified feedback
        );
    END IF;
END
$$;

-- =============================================================================
-- CORE FEEDBACK TABLES
-- =============================================================================

-- Main feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
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
    
    -- Constraints
    CONSTRAINT valid_feedback_data CHECK (
        (feedback_type = 'rating' AND rating IS NOT NULL) OR
        (feedback_type = 'thumbs' AND thumbs_rating IS NOT NULL) OR  
        (feedback_type = 'text' AND text_feedback IS NOT NULL) OR
        (feedback_type = 'structured' AND structured_data != '{}'::jsonb) OR
        (feedback_type = 'implicit')
    ),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
);

-- Feedback sessions for contextual grouping
CREATE TABLE IF NOT EXISTS feedback_sessions (
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
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Constraints
    CONSTRAINT valid_completion_percentage CHECK (completion_percentage >= 0.0 AND completion_percentage <= 100.0),
    CONSTRAINT valid_feedback_counts CHECK (
        positive_feedback_count >= 0 AND 
        negative_feedback_count >= 0 AND
        total_interactions >= (positive_feedback_count + negative_feedback_count)
    )
);

-- Content interaction tracking (implicit feedback)
CREATE TABLE IF NOT EXISTS content_interactions (
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
    duration_ms INTEGER, -- How long the interaction lasted
    
    -- Constraints
    CONSTRAINT valid_duration CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

-- =============================================================================
-- FEEDBACK CATEGORIZATION AND TAGGING
-- =============================================================================

-- Feedback categories with metadata
CREATE TABLE IF NOT EXISTS feedback_categories (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_max_text_length CHECK (max_text_length > 0),
    CONSTRAINT valid_display_order CHECK (display_order >= 0)
);

-- Feedback tags for better categorization
CREATE TABLE IF NOT EXISTS feedback_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name VARCHAR(50) UNIQUE NOT NULL,
    category feedback_category_enum,
    
    -- Tag metadata
    description TEXT,
    is_system_tag BOOLEAN DEFAULT false, -- Auto-generated vs user-generated
    usage_count INTEGER DEFAULT 0,
    
    -- Temporal data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_usage_count CHECK (usage_count >= 0),
    CONSTRAINT valid_tag_name CHECK (LENGTH(tag_name) >= 1)
);

-- Junction table for feedback-tag relationships
CREATE TABLE IF NOT EXISTS feedback_tag_associations (
    feedback_id UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES feedback_tags(id) ON DELETE CASCADE,
    confidence DECIMAL(3,2) DEFAULT 1.0, -- For AI-generated tags
    
    PRIMARY KEY (feedback_id, tag_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_tag_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

-- =============================================================================
-- FEEDBACK ANALYTICS AND AGGREGATION
-- =============================================================================

-- Aggregated feedback metrics per content type/category
CREATE TABLE IF NOT EXISTS feedback_analytics (
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
    
    UNIQUE(content_type, content_id, category, period_start),
    
    -- Constraints
    CONSTRAINT valid_period CHECK (period_start < period_end),
    CONSTRAINT valid_feedback_counts CHECK (
        total_feedback_count >= 0 AND 
        thumbs_up_count >= 0 AND 
        thumbs_down_count >= 0 AND
        text_feedback_count >= 0 AND
        unique_users_count >= 0 AND
        repeat_feedback_count >= 0
    ),
    CONSTRAINT valid_rating_average CHECK (rating_average IS NULL OR (rating_average >= 1.0 AND rating_average <= 5.0))
);

-- Feedback trends and insights
CREATE TABLE IF NOT EXISTS feedback_insights (
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
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_insight_type CHECK (insight_type IN ('trend', 'anomaly', 'correlation')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed'))
);

-- =============================================================================
-- PRIVACY AND COMPLIANCE
-- =============================================================================

-- GDPR and privacy compliance tracking
CREATE TABLE IF NOT EXISTS feedback_privacy_settings (
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
    ip_address_at_consent INET,
    
    UNIQUE(user_id),
    
    -- Constraints
    CONSTRAINT valid_retention_period CHECK (retention_period_days > 0 AND retention_period_days <= 3650)
);

-- Data retention and deletion tracking
CREATE TABLE IF NOT EXISTS feedback_data_retention (
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_data_type CHECK (data_type IN ('feedback', 'interactions', 'analytics', 'sessions')),
    CONSTRAINT valid_deletion_method CHECK (deletion_method IS NULL OR deletion_method IN ('soft_delete', 'hard_delete', 'anonymize'))
);

-- =============================================================================
-- FEEDBACK TRIGGERS AND AUTOMATION
-- =============================================================================

-- Feedback collection triggers and rules
CREATE TABLE IF NOT EXISTS feedback_triggers (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('time_based', 'event_based', 'interaction_based')),
    CONSTRAINT valid_max_triggers CHECK (max_triggers_per_user > 0),
    CONSTRAINT valid_trigger_counts CHECK (total_triggers >= successful_collections AND successful_collections >= 0)
);

-- User feedback trigger history
CREATE TABLE IF NOT EXISTS user_feedback_triggers (
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
    
    UNIQUE(user_id, trigger_id, triggered_at),
    
    -- Constraints
    CONSTRAINT valid_response_status CHECK (response_status IN ('pending', 'responded', 'dismissed', 'expired'))
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Main feedback table indexes
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON user_feedback(category);
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_type ON user_feedback(content_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_sentiment ON user_feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON user_feedback(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_lookup ON user_feedback(content_type, content_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_category_date ON user_feedback(user_id, category, created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_rating_date ON user_feedback(content_type, rating, created_at) WHERE rating IS NOT NULL;

-- Analytics table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_content ON feedback_analytics(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_period ON feedback_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_category_period ON feedback_analytics(category, period_start);

-- Interactions table indexes
CREATE INDEX IF NOT EXISTS idx_content_interactions_user_id ON content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content ON content_interactions(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_occurred_at ON content_interactions(occurred_at);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_user_id ON feedback_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_started_at ON feedback_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_session_type ON feedback_sessions(session_type);

-- Privacy settings indexes
CREATE INDEX IF NOT EXISTS idx_feedback_privacy_settings_user_id ON feedback_privacy_settings(user_id);

-- Triggers indexes
CREATE INDEX IF NOT EXISTS idx_user_feedback_triggers_user_id ON user_feedback_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_triggers_triggered_at ON user_feedback_triggers(triggered_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_triggers_status ON user_feedback_triggers(response_status);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_feedback_tags_category ON feedback_tags(category);
CREATE INDEX IF NOT EXISTS idx_feedback_tags_usage_count ON feedback_tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tag_associations_feedback_id ON feedback_tag_associations(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tag_associations_tag_id ON feedback_tag_associations(tag_id);

-- =============================================================================
-- MIGRATION COMPLETION
-- =============================================================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 001: User Feedback Collection System tables created successfully';
    RAISE NOTICE 'Next steps: Run the data seeding script to populate initial categories and tags';
END
$$;