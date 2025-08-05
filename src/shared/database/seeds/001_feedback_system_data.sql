-- Feedback System Initial Data Seeding
-- Version: 001
-- Description: Populate initial feedback categories, tags, and triggers for the feedback collection system
-- Dependencies: Requires migration 001_add_feedback_system.sql to be applied first

-- =============================================================================
-- VALIDATION CHECKS
-- =============================================================================

DO $$
BEGIN
    -- Check if feedback tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_categories') THEN
        RAISE EXCEPTION 'Feedback tables do not exist. Please run migration 001_add_feedback_system.sql first.';
    END IF;
    
    RAISE NOTICE 'Starting feedback system data seeding...';
END
$$;

-- =============================================================================
-- FEEDBACK CATEGORIES SEEDING
-- =============================================================================

-- Clear existing data (for re-seeding)
TRUNCATE TABLE feedback_categories CASCADE;

-- Insert feedback categories with comprehensive configuration
INSERT INTO feedback_categories (
    category_name, 
    display_name, 
    description, 
    requires_rating, 
    requires_text,
    max_text_length,
    icon_name, 
    color_theme,
    display_order
) VALUES
(
    'ai_recommendation', 
    'AI Recommendations', 
    'Feedback on AI-generated investment recommendations and suggestions', 
    true, 
    false,
    500,
    'cpu-chip', 
    'blue',
    1
),
(
    'risk_setting', 
    'Risk Settings', 
    'Feedback on risk assessment features, thresholds, and management tools', 
    true, 
    false,
    500,
    'shield-check', 
    'orange',
    2
),
(
    'educational_content', 
    'Educational Content', 
    'Feedback on educational materials, explanations, and learning resources', 
    true, 
    false,
    750,
    'academic-cap', 
    'green',
    3
),
(
    'ui_experience', 
    'User Experience', 
    'Feedback on user interface design, navigation, and overall platform experience', 
    true, 
    true,
    1000,
    'computer-desktop', 
    'purple',
    4
),
(
    'portfolio_suggestion', 
    'Portfolio Suggestions', 
    'Feedback on portfolio optimization recommendations and asset allocation advice', 
    true, 
    false,
    500,
    'chart-pie', 
    'emerald',
    5
),
(
    'yield_opportunity', 
    'Yield Opportunities', 
    'Feedback on yield farming, staking, and liquidity provision opportunities', 
    true, 
    false,
    500,
    'currency-dollar', 
    'yellow',
    6
),
(
    'risk_assessment', 
    'Risk Assessments', 
    'Feedback on risk analysis, alerts, and vulnerability assessments', 
    true, 
    false,
    500,
    'exclamation-triangle', 
    'red',
    7
),
(
    'market_insight', 
    'Market Insights', 
    'Feedback on market analysis, trends, and trading insights', 
    true, 
    false,
    500,
    'trending-up', 
    'indigo',
    8
),
(
    'strategy_recommendation', 
    'Strategy Recommendations', 
    'Feedback on trading strategies and investment approaches', 
    true, 
    false,
    500,
    'light-bulb', 
    'cyan',
    9
),
(
    'general', 
    'General Feedback', 
    'General feedback, suggestions, and comments about the platform', 
    false, 
    true,
    1500,
    'chat-bubble-left-right', 
    'gray',
    10
);

RAISE NOTICE 'Inserted % feedback categories', (SELECT COUNT(*) FROM feedback_categories);

-- =============================================================================
-- FEEDBACK TAGS SEEDING
-- =============================================================================

-- Clear existing tags
TRUNCATE TABLE feedback_tags CASCADE;

-- Insert system tags for common feedback themes
INSERT INTO feedback_tags (tag_name, category, description, is_system_tag) VALUES
-- General quality tags
('helpful', NULL, 'Content or feature was helpful to the user', true),
('confusing', NULL, 'Content or feature was confusing or unclear', true),
('accurate', NULL, 'Information provided was accurate', true),
('inaccurate', NULL, 'Information provided was not accurate', true),
('timely', NULL, 'Information or notification was provided at the right time', true),
('outdated', NULL, 'Information appears to be outdated or stale', true),
('relevant', NULL, 'Content was relevant to user needs', true),
('irrelevant', NULL, 'Content was not relevant to user needs', true),

-- AI Recommendation specific tags
('profitable', 'ai_recommendation', 'AI recommendation resulted in profit', true),
('unprofitable', 'ai_recommendation', 'AI recommendation did not result in profit', true),
('well_timed', 'ai_recommendation', 'AI recommendation timing was excellent', true),
('poorly_timed', 'ai_recommendation', 'AI recommendation timing was poor', true),
('conservative', 'ai_recommendation', 'AI recommendation was too conservative', true),
('aggressive', 'ai_recommendation', 'AI recommendation was too aggressive', true),
('personalized', 'ai_recommendation', 'AI recommendation felt personalized', true),
('generic', 'ai_recommendation', 'AI recommendation felt too generic', true),

-- Risk Setting specific tags
('too_conservative', 'risk_setting', 'Risk settings were too conservative for user preference', true),
('too_aggressive', 'risk_setting', 'Risk settings were too aggressive for user preference', true),
('appropriate', 'risk_setting', 'Risk settings were appropriate for user profile', true),
('inflexible', 'risk_setting', 'Risk settings lacked flexibility', true),
('customizable', 'risk_setting', 'Risk settings offered good customization', true),

-- Educational Content specific tags
('easy_to_understand', 'educational_content', 'Educational content was easy to understand', true),
('too_complex', 'educational_content', 'Educational content was too complex', true),
('comprehensive', 'educational_content', 'Educational content was comprehensive', true),
('superficial', 'educational_content', 'Educational content lacked depth', true),
('practical', 'educational_content', 'Educational content was practical and actionable', true),
('theoretical', 'educational_content', 'Educational content was too theoretical', true),
('up_to_date', 'educational_content', 'Educational content was current and up-to-date', true),

-- UI Experience specific tags
('intuitive', 'ui_experience', 'User interface was intuitive to use', true),
('difficult_to_navigate', 'ui_experience', 'User interface was difficult to navigate', true),
('responsive', 'ui_experience', 'Interface responded quickly to interactions', true),
('slow', 'ui_experience', 'Interface was slow to respond', true),
('visually_appealing', 'ui_experience', 'Interface was visually appealing', true),
('cluttered', 'ui_experience', 'Interface felt cluttered or overwhelming', true),
('mobile_friendly', 'ui_experience', 'Interface worked well on mobile devices', true),
('desktop_only', 'ui_experience', 'Interface only worked well on desktop', true),

-- Portfolio Suggestion specific tags
('diversified', 'portfolio_suggestion', 'Portfolio suggestion promoted good diversification', true),
('concentrated', 'portfolio_suggestion', 'Portfolio suggestion was too concentrated', true),
('balanced', 'portfolio_suggestion', 'Portfolio suggestion was well balanced', true),
('unbalanced', 'portfolio_suggestion', 'Portfolio suggestion was poorly balanced', true),
('cost_effective', 'portfolio_suggestion', 'Portfolio suggestion was cost-effective', true),
('expensive', 'portfolio_suggestion', 'Portfolio suggestion involved high costs', true),

-- Yield Opportunity specific tags
('high_yield', 'yield_opportunity', 'Opportunity offered attractive high yields', true),
('low_yield', 'yield_opportunity', 'Opportunity offered disappointing low yields', true),
('sustainable', 'yield_opportunity', 'Yield opportunity appeared sustainable', true),
('unsustainable', 'yield_opportunity', 'Yield opportunity appeared unsustainable', true),
('low_risk', 'yield_opportunity', 'Yield opportunity had appropriately low risk', true),
('high_risk', 'yield_opportunity', 'Yield opportunity had concerning high risk', true),
('liquid', 'yield_opportunity', 'Yield opportunity offered good liquidity', true),
('illiquid', 'yield_opportunity', 'Yield opportunity had poor liquidity', true),

-- Risk Assessment specific tags
('comprehensive', 'risk_assessment', 'Risk assessment was comprehensive and thorough', true),
('incomplete', 'risk_assessment', 'Risk assessment felt incomplete', true),
('actionable', 'risk_assessment', 'Risk assessment provided actionable insights', true),
('vague', 'risk_assessment', 'Risk assessment was too vague', true),
('false_positive', 'risk_assessment', 'Risk assessment flagged false positives', true),
('missed_risk', 'risk_assessment', 'Risk assessment missed important risks', true),

-- Market Insight specific tags
('insightful', 'market_insight', 'Market insight provided valuable information', true),
('obvious', 'market_insight', 'Market insight was obvious or already known', true),
('contrarian', 'market_insight', 'Market insight offered contrarian perspective', true),
('mainstream', 'market_insight', 'Market insight reflected mainstream view', true),
('data_driven', 'market_insight', 'Market insight was well supported by data', true),
('speculative', 'market_insight', 'Market insight appeared speculative', true),

-- Strategy Recommendation specific tags
('proven', 'strategy_recommendation', 'Strategy recommendation had proven track record', true),
('experimental', 'strategy_recommendation', 'Strategy recommendation was experimental', true),
('simple', 'strategy_recommendation', 'Strategy recommendation was simple to execute', true),
('complex', 'strategy_recommendation', 'Strategy recommendation was complex to execute', true),
('scalable', 'strategy_recommendation', 'Strategy recommendation was scalable', true),
('limited_scale', 'strategy_recommendation', 'Strategy recommendation had limited scalability', true),

-- General sentiment tags
('positive_experience', 'general', 'Overall positive experience with the platform', true),
('negative_experience', 'general', 'Overall negative experience with the platform', true),
('exceeded_expectations', 'general', 'Platform exceeded user expectations', true),
('disappointed', 'general', 'Platform did not meet user expectations', true),
('would_recommend', 'general', 'User would recommend platform to others', true),
('would_not_recommend', 'general', 'User would not recommend platform to others', true);

RAISE NOTICE 'Inserted % feedback tags', (SELECT COUNT(*) FROM feedback_tags);

-- =============================================================================
-- FEEDBACK TRIGGERS SEEDING
-- =============================================================================

-- Clear existing triggers
TRUNCATE TABLE feedback_triggers CASCADE;

-- Insert feedback collection triggers
INSERT INTO feedback_triggers (
    trigger_name, 
    trigger_type, 
    conditions, 
    target_categories, 
    feedback_template,
    max_triggers_per_user,
    cooldown_period
) VALUES
(
    'post_ai_recommendation_feedback',
    'event_based',
    '{"event": "ai_recommendation_shown", "delay_minutes": 5, "min_recommendation_value": 100}',
    ARRAY['ai_recommendation'::feedback_category_enum],
    '{"title": "How was this AI recommendation?", "type": "rating_with_tags", "required": false}',
    5,
    '6 hours'::interval
),
(
    'weekly_experience_survey',
    'time_based',
    '{"frequency": "weekly", "day_of_week": "friday", "time": "18:00", "timezone": "user_timezone"}',
    ARRAY['ui_experience'::feedback_category_enum, 'general'::feedback_category_enum],
    '{"title": "How was your experience this week?", "type": "structured_survey", "required": false}',
    1,
    '7 days'::interval
),
(
    'post_yield_action_feedback',
    'event_based',
    '{"event": "yield_action_completed", "actions": ["stake", "unstake", "claim"], "delay_minutes": 60}',
    ARRAY['yield_opportunity'::feedback_category_enum],
    '{"title": "How did this yield opportunity work out?", "type": "rating_with_text", "required": false}',
    3,
    '12 hours'::interval
),
(
    'risk_alert_feedback',
    'event_based',
    '{"event": "risk_alert_shown", "severity": ["high", "critical"], "delay_minutes": 10}',
    ARRAY['risk_assessment'::feedback_category_enum],
    '{"title": "Was this risk alert helpful?", "type": "thumbs_with_tags", "required": false}',
    10,
    '2 hours'::interval
),
(
    'educational_content_completion',
    'interaction_based',
    '{"interaction": "content_completed", "content_types": ["tutorial", "guide", "explanation"], "min_time_spent": 30}',
    ARRAY['educational_content'::feedback_category_enum],
    '{"title": "How helpful was this educational content?", "type": "rating_with_tags", "required": false}',
    20,
    '24 hours'::interval
),
(
    'portfolio_suggestion_feedback',
    'event_based',
    '{"event": "portfolio_suggestion_shown", "suggestion_types": ["rebalance", "optimization"], "delay_minutes": 15}',
    ARRAY['portfolio_suggestion'::feedback_category_enum],
    '{"title": "How do you feel about this portfolio suggestion?", "type": "rating_with_text", "required": false}',
    5,
    '8 hours'::interval
),
(
    'monthly_platform_nps',
    'time_based',
    '{"frequency": "monthly", "day_of_month": 15, "time": "12:00", "timezone": "user_timezone"}',
    ARRAY['general'::feedback_category_enum],
    '{"title": "How likely are you to recommend YieldSensei?", "type": "nps_survey", "required": false}',
    1,
    '30 days'::interval
),
(
    'strategy_performance_feedback',
    'event_based',
    '{"event": "strategy_performance_update", "performance_change": {"threshold": 0.05, "direction": "any"}, "delay_hours": 24}',
    ARRAY['strategy_recommendation'::feedback_category_enum],
    '{"title": "How do you feel about your strategy performance?", "type": "rating_with_text", "required": false}',
    2,
    '7 days'::interval
),
(
    'new_user_onboarding_feedback',
    'interaction_based',
    '{"interaction": "onboarding_completed", "steps_completed": "all", "delay_minutes": 30}',
    ARRAY['ui_experience'::feedback_category_enum, 'educational_content'::feedback_category_enum],
    '{"title": "How was your onboarding experience?", "type": "structured_survey", "required": false}',
    1,
    '999 days'::interval
),
(
    'feature_first_use_feedback',
    'interaction_based',
    '{"interaction": "feature_first_use", "features": ["bridge", "forge", "pulse"], "delay_minutes": 45}',
    ARRAY['ui_experience'::feedback_category_enum],
    '{"title": "How was your first experience with this feature?", "type": "rating_with_tags", "required": false}',
    3,
    '30 days'::interval
);

RAISE NOTICE 'Inserted % feedback triggers', (SELECT COUNT(*) FROM feedback_triggers);

-- =============================================================================
-- PRIVACY SETTINGS DEFAULTS
-- =============================================================================

-- Create a function to set up default privacy settings for existing users
CREATE OR REPLACE FUNCTION setup_existing_users_feedback_privacy() 
RETURNS INTEGER AS $$
DECLARE
    users_updated INTEGER := 0;
    user_record RECORD;
BEGIN
    -- Insert default privacy settings for all existing users who don't have them
    FOR user_record IN 
        SELECT u.id 
        FROM users u 
        LEFT JOIN feedback_privacy_settings fps ON u.id = fps.user_id 
        WHERE fps.user_id IS NULL
    LOOP
        INSERT INTO feedback_privacy_settings (
            user_id,
            feedback_collection_consent,
            analytics_consent,
            improvement_consent,
            research_consent,
            default_privacy_level,
            allow_sentiment_analysis,
            allow_content_personalization,
            retention_period_days,
            auto_deletion_enabled
        ) VALUES (
            user_record.id,
            false, -- Require explicit consent
            false, -- Require explicit consent
            false, -- Require explicit consent
            false, -- Require explicit consent
            'pseudonymous'::feedback_privacy_enum,
            true,  -- Default to allowing sentiment analysis
            true,  -- Default to allowing personalization
            365,   -- 1 year retention
            false  -- No auto-deletion by default
        );
        
        users_updated := users_updated + 1;
    END LOOP;
    
    RETURN users_updated;
END;
$$ LANGUAGE plpgsql;

-- Run the function to set up privacy settings for existing users
SELECT setup_existing_users_feedback_privacy() AS existing_users_updated;

-- Drop the temporary function  
DROP FUNCTION setup_existing_users_feedback_privacy();

-- =============================================================================
-- VIEWS CREATION
-- =============================================================================

-- User feedback summary view
CREATE OR REPLACE VIEW user_feedback_summary AS
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
CREATE OR REPLACE VIEW content_feedback_performance AS
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
CREATE OR REPLACE VIEW recent_feedback_trends AS
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
DO $$
BEGIN
    -- Only create triggers if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_user_feedback_updated_at') THEN
        CREATE TRIGGER trigger_user_feedback_updated_at
            BEFORE UPDATE ON user_feedback
            FOR EACH ROW
            EXECUTE FUNCTION update_feedback_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_feedback_categories_updated_at') THEN
        CREATE TRIGGER trigger_feedback_categories_updated_at
            BEFORE UPDATE ON feedback_categories
            FOR EACH ROW  
            EXECUTE FUNCTION update_feedback_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_feedback_triggers_updated_at') THEN
        CREATE TRIGGER trigger_feedback_triggers_updated_at  
            BEFORE UPDATE ON feedback_triggers
            FOR EACH ROW
            EXECUTE FUNCTION update_feedback_updated_at();
    END IF;
END
$$;

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

-- Create the trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_increment_tag_usage') THEN
        CREATE TRIGGER trigger_increment_tag_usage
            AFTER INSERT ON feedback_tag_associations
            FOR EACH ROW
            EXECUTE FUNCTION increment_tag_usage();
    END IF;
END
$$;

-- =============================================================================
-- COMPLETION SUMMARY
-- =============================================================================

DO $$
DECLARE
    category_count INTEGER;
    tag_count INTEGER;
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_count FROM feedback_categories;
    SELECT COUNT(*) INTO tag_count FROM feedback_tags;
    SELECT COUNT(*) INTO trigger_count FROM feedback_triggers;
    
    RAISE NOTICE '=== Feedback System Data Seeding Complete ===';
    RAISE NOTICE 'Categories created: %', category_count;
    RAISE NOTICE 'Tags created: %', tag_count;
    RAISE NOTICE 'Triggers created: %', trigger_count;
    RAISE NOTICE 'Views created: 3 (user_feedback_summary, content_feedback_performance, recent_feedback_trends)';
    RAISE NOTICE 'Database functions created: 2 (update_feedback_updated_at, increment_tag_usage)';
    RAISE NOTICE '=== System ready for feedback collection ===';
END
$$;