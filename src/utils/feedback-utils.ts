/**
 * Feedback Collection Utilities
 * Helper functions for feedback processing, moderation, and analytics
 */

import { 
  UserFeedback, 
  FeedbackCategory, 
  FeedbackType, 
  FeedbackSentiment,
  FeedbackTrigger,
  FeedbackPrivacy 
} from '../types/feedback';

/**
 * Content Moderation Utilities
 */
export class FeedbackModerationUtils {
  
  /**
   * Check if feedback content requires moderation
   */
  static requiresModeration(feedback: UserFeedback): boolean {
    // Check for potentially harmful content
    if (feedback.textFeedback && this.containsHarmfulContent(feedback.textFeedback)) {
      return true;
    }
    
    // Check for spam patterns
    if (this.isSpamContent(feedback)) {
      return true;
    }
    
    // Check for excessive negative sentiment
    if (feedback.sentiment === FeedbackSentiment.VERY_NEGATIVE && feedback.confidenceScore > 0.9) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect harmful content in feedback text
   */
  private static containsHarmfulContent(text: string): boolean {
    const harmfulPatterns = [
      // Profanity (basic detection - would use more sophisticated service in production)
      /\b(fuck|shit|damn|asshole|bitch)\b/i,
      // Threats
      /\b(kill|murder|death|threat|hurt|harm)\b/i,
      // Discriminatory language
      /\b(racist|sexist|hate|discrimination)\b/i,
      // Personal information patterns
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email pattern
    ];
    
    return harmfulPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Detect spam content patterns
   */
  private static isSpamContent(feedback: UserFeedback): boolean {
    if (!feedback.textFeedback) return false;
    
    const text = feedback.textFeedback.toLowerCase();
    
    // Check for spam indicators
    const spamPatterns = [
      // Repeated characters
      /(.)\1{5,}/,
      // Excessive capitalization
      /[A-Z]{10,}/,
      // Common spam phrases
      /\b(buy now|click here|free money|make money|viagra|casino)\b/i,
      // URLs (simple detection)
      /https?:\/\/[^\s]+/,
    ];
    
    return spamPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Apply content filters and sanitization
   */
  static sanitizeFeedback(feedback: UserFeedback): UserFeedback {
    const sanitizedFeedback = { ...feedback };
    
    if (sanitizedFeedback.textFeedback) {
      // Remove potential XSS content
      sanitizedFeedback.textFeedback = this.sanitizeHTML(sanitizedFeedback.textFeedback);
      
      // Trim whitespace
      sanitizedFeedback.textFeedback = sanitizedFeedback.textFeedback.trim();
      
      // Apply profanity filter (basic implementation)
      sanitizedFeedback.textFeedback = this.filterProfanity(sanitizedFeedback.textFeedback);
    }
    
    return sanitizedFeedback;
  }
  
  /**
   * Basic HTML sanitization
   */
  private static sanitizeHTML(text: string): string {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  /**
   * Basic profanity filter
   */
  private static filterProfanity(text: string): string {
    const profanityList = ['fuck', 'shit', 'damn', 'asshole', 'bitch'];
    let filteredText = text;
    
    profanityList.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    
    return filteredText;
  }
}

/**
 * Feedback Analytics Utilities
 */
export class FeedbackAnalyticsUtils {
  
  /**
   * Calculate satisfaction score from feedback data
   */
  static calculateSatisfactionScore(feedbackList: UserFeedback[]): number {
    if (feedbackList.length === 0) return 0;
    
    let totalScore = 0;
    let validFeedbackCount = 0;
    
    feedbackList.forEach(feedback => {
      let score = 0;
      
      // Rating-based scoring (1-5 scale)
      if (feedback.rating) {
        score = (feedback.rating - 1) / 4; // Normalize to 0-1
        validFeedbackCount++;
      }
      // Thumbs-based scoring
      else if (feedback.thumbsRating !== undefined) {
        score = feedback.thumbsRating ? 1 : 0;
        validFeedbackCount++;
      }
      // Sentiment-based scoring
      else if (feedback.sentiment !== FeedbackSentiment.UNKNOWN) {
        score = this.sentimentToScore(feedback.sentiment);
        validFeedbackCount++;
      }
      
      totalScore += score;
    });
    
    return validFeedbackCount > 0 ? totalScore / validFeedbackCount : 0;
  }
  
  /**
   * Convert sentiment enum to numeric score
   */
  private static sentimentToScore(sentiment: FeedbackSentiment): number {
    const sentimentScores = {
      [FeedbackSentiment.VERY_NEGATIVE]: 0,
      [FeedbackSentiment.NEGATIVE]: 0.25,
      [FeedbackSentiment.NEUTRAL]: 0.5,
      [FeedbackSentiment.POSITIVE]: 0.75,
      [FeedbackSentiment.VERY_POSITIVE]: 1,
      [FeedbackSentiment.UNKNOWN]: 0.5,
    };
    
    return sentimentScores[sentiment] || 0.5;
  }
  
  /**
   * Calculate Net Promoter Score (NPS) from feedback
   */
  static calculateNPS(feedbackList: UserFeedback[]): number {
    const ratingFeedback = feedbackList.filter(f => f.rating !== undefined && f.rating !== null);
    
    if (ratingFeedback.length === 0) return 0;
    
    const promoters = ratingFeedback.filter(f => f.rating! >= 4).length;
    const detractors = ratingFeedback.filter(f => f.rating! <= 2).length;
    const total = ratingFeedback.length;
    
    return ((promoters - detractors) / total) * 100;
  }
  
  /**
   * Analyze feedback trends over time
   */
  static analyzeTrends(feedbackList: UserFeedback[], periodDays: number = 30): {
    trendDirection: 'up' | 'down' | 'stable';
    percentageChange: number;
    confidence: number;
  } {
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const recentFeedback = feedbackList.filter(f => f.createdAt >= cutoffDate);
    const olderFeedback = feedbackList.filter(f => f.createdAt < cutoffDate);
    
    if (recentFeedback.length === 0 || olderFeedback.length === 0) {
      return { trendDirection: 'stable', percentageChange: 0, confidence: 0 };
    }
    
    const recentScore = this.calculateSatisfactionScore(recentFeedback);
    const olderScore = this.calculateSatisfactionScore(olderFeedback);
    
    const percentageChange = ((recentScore - olderScore) / olderScore) * 100;
    const confidence = Math.min(1, Math.min(recentFeedback.length, olderFeedback.length) / 50);
    
    let trendDirection: 'up' | 'down' | 'stable';
    if (Math.abs(percentageChange) < 5) {
      trendDirection = 'stable';
    } else if (percentageChange > 0) {
      trendDirection = 'up';
    } else {
      trendDirection = 'down';
    }
    
    return { trendDirection, percentageChange, confidence };
  }
  
  /**
   * Identify common themes in text feedback
   */
  static extractCommonThemes(feedbackList: UserFeedback[]): { theme: string; count: number; sentiment: number }[] {
    const textFeedback = feedbackList.filter(f => f.textFeedback).map(f => f.textFeedback!);
    
    if (textFeedback.length === 0) return [];
    
    // Simple keyword extraction (would use more sophisticated NLP in production)
    const commonWords = this.extractKeywords(textFeedback);
    
    return commonWords.map(({ word, count }) => {
      // Calculate average sentiment for feedback containing this word
      const relevantFeedback = feedbackList.filter(f => 
        f.textFeedback && f.textFeedback.toLowerCase().includes(word.toLowerCase())
      );
      
      const avgSentiment = relevantFeedback.length > 0 
        ? relevantFeedback.reduce((sum, f) => sum + this.sentimentToScore(f.sentiment), 0) / relevantFeedback.length
        : 0.5;
      
      return { theme: word, count, sentiment: avgSentiment };
    });
  }
  
  /**
   * Extract keywords from text feedback
   */
  private static extractKeywords(textList: string[]): { word: string; count: number }[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
    
    const wordCounts = new Map<string, number>();
    
    textList.forEach(text => {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
      
      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      });
    });
    
    return Array.from(wordCounts.entries())
      .map(([word, count]) => ({ word, count }))
      .filter(({ count }) => count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

/**
 * Feedback Trigger Utilities
 */
export class FeedbackTriggerUtils {
  
  /**
   * Check if a trigger should be activated for a user
   */
  static shouldTrigger(
    trigger: FeedbackTrigger, 
    userId: string, 
    context: Record<string, any>,
    userTriggerHistory: any[] = []
  ): boolean {
    // Check if trigger is active
    if (!trigger.isActive) return false;
    
    // Check cooldown period
    if (this.isInCooldown(trigger, userId, userTriggerHistory)) return false;
    
    // Check max triggers per user
    if (this.hasExceededMaxTriggers(trigger, userId, userTriggerHistory)) return false;
    
    // Check trigger conditions based on type
    return this.evaluateTriggerConditions(trigger, context);
  }
  
  /**
   * Check if trigger is in cooldown period for user
   */
  private static isInCooldown(trigger: FeedbackTrigger, userId: string, history: any[]): boolean {
    const lastTrigger = history
      .filter(h => h.triggerId === trigger.id && h.userId === userId)
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())[0];
    
    if (!lastTrigger) return false;
    
    const cooldownMs = this.parseCooldownPeriod(trigger.cooldownPeriod);
    const timeSinceLastTrigger = Date.now() - new Date(lastTrigger.triggeredAt).getTime();
    
    return timeSinceLastTrigger < cooldownMs;
  }
  
  /**
   * Check if user has exceeded max triggers
   */
  private static hasExceededMaxTriggers(trigger: FeedbackTrigger, userId: string, history: any[]): boolean {
    const userTriggerCount = history.filter(h => 
      h.triggerId === trigger.id && 
      h.userId === userId &&
      h.responseStatus !== 'expired'
    ).length;
    
    return userTriggerCount >= trigger.maxTriggersPerUser;
  }
  
  /**
   * Evaluate trigger conditions based on type and context
   */
  private static evaluateTriggerConditions(trigger: FeedbackTrigger, context: Record<string, any>): boolean {
    const conditions = trigger.conditions;
    
    switch (trigger.triggerType) {
      case 'event_based':
        return this.evaluateEventConditions(conditions, context);
      case 'time_based':
        return this.evaluateTimeConditions(conditions);
      case 'interaction_based':
        return this.evaluateInteractionConditions(conditions, context);
      default:
        return false;
    }
  }
  
  /**
   * Evaluate event-based trigger conditions
   */
  private static evaluateEventConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    if (conditions.event && context.eventType !== conditions.event) {
      return false;
    }
    
    if (conditions.delay_minutes) {
      // Would check if enough time has passed since the event
      // For now, assume delay has been handled externally
    }
    
    if (conditions.min_recommendation_value && 
        context.value < conditions.min_recommendation_value) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Evaluate time-based trigger conditions
   */
  private static evaluateTimeConditions(conditions: Record<string, any>): boolean {
    const now = new Date();
    
    if (conditions.frequency === 'weekly' && conditions.day_of_week) {
      const dayOfWeek = now.getDay();
      const targetDay = this.dayStringToNumber(conditions.day_of_week);
      return dayOfWeek === targetDay;
    }
    
    if (conditions.frequency === 'monthly' && conditions.day_of_month) {
      return now.getDate() === conditions.day_of_month;
    }
    
    if (conditions.time) {
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      return currentTime === conditions.time;
    }
    
    return false;
  }
  
  /**
   * Evaluate interaction-based trigger conditions
   */
  private static evaluateInteractionConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    if (conditions.interaction && context.interactionType !== conditions.interaction) {
      return false;
    }
    
    if (conditions.min_time_spent && context.timeSpent < conditions.min_time_spent) {
      return false;
    }
    
    if (conditions.content_types && 
        !conditions.content_types.includes(context.contentType)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Parse cooldown period string to milliseconds
   */
  private static parseCooldownPeriod(period: string): number {
    // Simple parser for periods like "24 hours", "7 days", "2 hours"
    const match = period.match(/(\d+)\s*(hour|hours|day|days|minute|minutes)/i);
    if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'minute':
      case 'minutes':
        return value * 60 * 1000;
      case 'hour':
      case 'hours':
        return value * 60 * 60 * 1000;
      case 'day':
      case 'days':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }
  
  /**
   * Convert day string to number (0 = Sunday)
   */
  private static dayStringToNumber(dayString: string): number {
    const days = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    return days[dayString.toLowerCase() as keyof typeof days] || 0;
  }
}

/**
 * Privacy and Compliance Utilities
 */
export class FeedbackPrivacyUtils {
  
  /**
   * Anonymize feedback data based on privacy level
   */
  static anonymizeFeedback(feedback: UserFeedback, privacyLevel: FeedbackPrivacy): UserFeedback {
    const anonymized = { ...feedback };
    
    switch (privacyLevel) {
      case FeedbackPrivacy.ANONYMOUS:
        // Remove all identifying information
        anonymized.userId = this.hashUserId(feedback.userId);
        anonymized.ipAddress = undefined;
        anonymized.userAgent = undefined;
        anonymized.sessionId = undefined;
        break;
        
      case FeedbackPrivacy.PSEUDONYMOUS:
        // Keep user ID but remove direct identifiers
        anonymized.ipAddress = this.maskIP(feedback.ipAddress);
        anonymized.userAgent = this.generalizeUserAgent(feedback.userAgent);
        break;
        
      case FeedbackPrivacy.IDENTIFIED:
        // Keep all data as-is
        break;
    }
    
    return anonymized;
  }
  
  /**
   * Hash user ID for anonymous feedback
   */
  private static hashUserId(userId: string): string {
    // Simple hash function (would use more secure hashing in production)
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return 'anon_' + Math.abs(hash).toString(36);
  }
  
  /**
   * Mask IP address for privacy
   */
  private static maskIP(ipAddress?: string): string | undefined {
    if (!ipAddress) return undefined;
    
    // Mask last octet of IPv4 addresses
    const ipv4Regex = /^(\d+\.\d+\.\d+)\.\d+$/;
    const match = ipAddress.match(ipv4Regex);
    
    if (match) {
      return `${match[1]}.xxx`;
    }
    
    // For IPv6 or other formats, return generalized location
    return 'masked';
  }
  
  /**
   * Generalize user agent for privacy
   */
  private static generalizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    
    // Extract only browser and OS information, remove specific versions
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    
    return 'Unknown Browser';
  }
  
  /**
   * Check if feedback should be deleted based on retention policy
   */
  static shouldDelete(feedback: UserFeedback, retentionDays: number): boolean {
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const ageMs = Date.now() - feedback.createdAt.getTime();
    
    return ageMs > retentionMs;
  }
  
  /**
   * Validate GDPR compliance for feedback operations
   */
  static validateGDPRCompliance(
    operation: 'collect' | 'process' | 'store' | 'delete',
    userConsent: {
      feedbackCollection: boolean;
      analytics: boolean;
      improvement: boolean;
      research: boolean;
    }
  ): boolean {
    switch (operation) {
      case 'collect':
        return userConsent.feedbackCollection;
      case 'process':
        return userConsent.feedbackCollection;
      case 'store':
        return userConsent.feedbackCollection;
      case 'delete':
        return true; // Users can always request deletion
      default:
        return false;
    }
  }
}