/**
 * Password Service
 * Handles secure password hashing, validation, and management
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthConfig } from '../types';

export class PasswordService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.config.bcrypt.saltRounds);
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare a password with its hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each category
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special character
    
    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number; // 0-4 (0=very weak, 4=very strong)
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Check length
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 1;
    }

    // Check for lowercase letters
    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    // Check for uppercase letters
    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    // Check for numbers
    if (!/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    // Check for special characters
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    // Check for common patterns
    const commonPatterns = [
      'password', '123456', 'qwerty', 'admin', 'user',
      'letmein', 'welcome', 'monkey', 'dragon', 'master'
    ];
    
    const lowerPassword = password.toLowerCase();
    for (const pattern of commonPatterns) {
      if (lowerPassword.includes(pattern)) {
        feedback.push('Password contains common patterns');
        score = Math.max(0, score - 1);
        break;
      }
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Password contains too many repeated characters');
      score = Math.max(0, score - 1);
    }

    // Check for sequential characters
    if (/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789|012)/i.test(password)) {
      feedback.push('Password contains sequential characters');
      score = Math.max(0, score - 1);
    }

    const isValid = score >= 3 && feedback.length === 0;

    return {
      isValid,
      score: Math.min(4, score),
      feedback,
    };
  }

  /**
   * Generate a password reset token
   */
  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a password reset token hash for storage
   */
  async hashPasswordResetToken(token: string): Promise<string> {
    return await this.hashPassword(token);
  }

  /**
   * Verify a password reset token
   */
  async verifyPasswordResetToken(token: string, hash: string): Promise<boolean> {
    return await this.comparePassword(token, hash);
  }

  /**
   * Generate a temporary password
   */
  generateTemporaryPassword(): string {
    // Generate a shorter, simpler password for temporary use
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    
    for (let i = 0; i < 8; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    return password;
  }

  /**
   * Check if password needs to be changed (e.g., after certain time period)
   */
  shouldChangePassword(lastPasswordChange: Date, maxAgeDays: number = 90): boolean {
    const now = new Date();
    const daysSinceChange = (now.getTime() - lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange > maxAgeDays;
  }

  /**
   * Get password strength description
   */
  getPasswordStrengthDescription(score: number): string {
    switch (score) {
      case 0:
      case 1:
        return 'Very Weak';
      case 2:
        return 'Weak';
      case 3:
        return 'Moderate';
      case 4:
        return 'Strong';
      default:
        return 'Unknown';
    }
  }
} 