/**
 * Multi-Factor Authentication Service
 * Handles TOTP, backup codes, and MFA operations
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { MFAType, MFASecret, AuthConfig } from '../types';

export class MFAService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Generate TOTP secret for a user
   */
  async generateTOTPSecret(_userId: string, userEmail: string): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCode: string;
  }> {
    const secret = speakeasy.generateSecret({
      name: `${this.config.mfa.totp.issuer}:${userEmail}`,
      issuer: this.config.mfa.totp.issuer,
      length: 32
    });

    const otpauthUrl = secret.otpauth_url!;
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32!,
      otpauthUrl,
      qrCode,
    };
  }

  /**
   * Verify TOTP token
   */
  verifyTOTPToken(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before and after
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    const length = this.config.mfa.backupCodes.length;
    const count = this.config.mfa.backupCodes.count;

    for (let i = 0; i < count; i++) {
      const code = crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(code: string, backupCodes: string[]): {
    isValid: boolean;
    remainingCodes: string[];
  } {
    const index = backupCodes.indexOf(code);
    
    if (index === -1) {
      return {
        isValid: false,
        remainingCodes: backupCodes,
      };
    }

    // Remove the used code
    const remainingCodes = backupCodes.filter((_, i) => i !== index);
    
    return {
      isValid: true,
      remainingCodes,
    };
  }

  /**
   * Generate SMS verification code
   */
  generateSMSCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate email verification code
   */
  generateEmailCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Verify SMS code
   */
  verifySMSCode(code: string, expectedCode: string): boolean {
    return code === expectedCode;
  }

  /**
   * Verify email code
   */
  verifyEmailCode(code: string, expectedCode: string): boolean {
    return code === expectedCode;
  }

  /**
   * Setup MFA for a user
   */
  async setupMFA(
    userId: string, 
    userEmail: string, 
    mfaType: MFAType
  ): Promise<{
    type: MFAType;
    secret?: string;
    qrCode?: string;
    backupCodes?: string[];
    setupComplete: boolean;
  }> {
    switch (mfaType) {
      case MFAType.TOTP:
        const totpData = await this.generateTOTPSecret(userId, userEmail);
        const backupCodes = this.generateBackupCodes();
        
        return {
          type: MFAType.TOTP,
          secret: totpData.secret,
          qrCode: totpData.qrCode,
          backupCodes,
          setupComplete: false,
        };

      case MFAType.SMS:
        return {
          type: MFAType.SMS,
          setupComplete: false,
        };

      case MFAType.EMAIL:
        return {
          type: MFAType.EMAIL,
          setupComplete: false,
        };

      case MFAType.HARDWARE_KEY:
        return {
          type: MFAType.HARDWARE_KEY,
          setupComplete: false,
        };

      default:
        throw new Error(`Unsupported MFA type: ${mfaType}`);
    }
  }

  /**
   * Verify MFA challenge
   */
  verifyMFAChallenge(
    challenge: string,
    mfaSecret: MFASecret,
    mfaType: MFAType
  ): boolean {
    switch (mfaType) {
      case MFAType.TOTP:
        return this.verifyTOTPToken(challenge, mfaSecret.secret);

      case MFAType.SMS:
      case MFAType.EMAIL:
        // These would typically be verified against stored codes
        // For now, we'll assume the challenge is the expected code
        return challenge === mfaSecret.secret;

      case MFAType.HARDWARE_KEY:
        // Hardware key verification would be more complex
        // For now, we'll use a simple comparison
        return challenge === mfaSecret.secret;

      default:
        return false;
    }
  }

  /**
   * Verify backup code and update MFA secret
   */
  verifyBackupCodeAndUpdate(
    code: string,
    mfaSecret: MFASecret
  ): {
    isValid: boolean;
    updatedSecret: MFASecret;
  } {
    const result = this.verifyBackupCode(code, mfaSecret.backupCodes);
    
    if (result.isValid) {
      const updatedSecret: MFASecret = {
        ...mfaSecret,
        backupCodes: result.remainingCodes,
      };

      return {
        isValid: true,
        updatedSecret,
      };
    }

    return {
      isValid: false,
      updatedSecret: mfaSecret,
    };
  }

  /**
   * Check if MFA is required for user
   */
  isMFARequired(user: any): boolean {
    return user.mfaEnabled && user.mfaType;
  }

  /**
   * Get MFA setup instructions
   */
  getMFASetupInstructions(mfaType: MFAType): string {
    switch (mfaType) {
      case MFAType.TOTP:
        return 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)';
      
      case MFAType.SMS:
        return 'Enter the verification code sent to your phone number';
      
      case MFAType.EMAIL:
        return 'Enter the verification code sent to your email address';
      
      case MFAType.HARDWARE_KEY:
        return 'Insert your hardware security key and follow the prompts';
      
      default:
        return 'Follow the setup instructions for your chosen MFA method';
    }
  }

  /**
   * Validate MFA type
   */
  isValidMFAType(mfaType: string): mfaType is MFAType {
    return Object.values(MFAType).includes(mfaType as MFAType);
  }

  /**
   * Get remaining backup codes count
   */
  getRemainingBackupCodesCount(mfaSecret: MFASecret): number {
    return mfaSecret.backupCodes.length;
  }

  /**
   * Check if backup codes are running low
   */
  areBackupCodesRunningLow(mfaSecret: MFASecret, threshold: number = 3): boolean {
    return mfaSecret.backupCodes.length <= threshold;
  }
} 