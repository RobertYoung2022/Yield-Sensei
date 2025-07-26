/**
 * Authentication Routes
 * Routes for user authentication, registration, and token management
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { 
  AuthResponse, 
  MFAChallenge,
  GrantType,
  MFAType 
} from '../types';
import { JWTService } from '../services/jwt.service';
import { PasswordService } from '../services/password.service';
import { MFAService } from '../services/mfa.service';
import { AuthMiddleware } from '../middleware/auth.middleware';

export class AuthRoutes {
  private router: Router;
  private jwtService: JWTService;
  private passwordService: PasswordService;
  private mfaService: MFAService;
  private authMiddleware: AuthMiddleware;

  constructor(
    jwtService: JWTService,
    passwordService: PasswordService,
    mfaService: MFAService,
    authMiddleware: AuthMiddleware
  ) {
    this.router = Router();
    this.jwtService = jwtService;
    this.passwordService = passwordService;
    this.mfaService = mfaService;
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Registration
    this.router.post('/register', this.registerValidation, this.register);
    
    // Login
    this.router.post('/login', this.loginValidation, this.login);
    
    // OAuth 2.0 endpoints
    this.router.post('/token', this.tokenValidation, this.token);
    this.router.get('/authorize', this.authorizeValidation, this.authorize);
    
    // Token management
    this.router.post('/refresh', this.refreshValidation, this.refresh);
    this.router.post('/revoke', this.authMiddleware.authenticate as any, this.revoke);
    this.router.get('/validate', this.authMiddleware.authenticate as any, this.validate);
    
    // Password management
    this.router.post('/forgot-password', this.forgotPasswordValidation, this.forgotPassword);
    this.router.post('/reset-password', this.resetPasswordValidation, this.resetPassword);
    this.router.post('/change-password', this.authMiddleware.authenticate as any, this.changePasswordValidation, this.changePassword);
    
    // MFA endpoints
    this.router.post('/mfa/setup', this.authMiddleware.authenticate as any, this.mfaSetupValidation, this.mfaSetup);
    this.router.post('/mfa/verify', this.mfaVerifyValidation, this.mfaVerify);
    this.router.post('/mfa/disable', this.authMiddleware.authenticate as any, this.mfaDisable);
    this.router.post('/mfa/backup-codes', this.authMiddleware.authenticate as any, this.generateBackupCodes);
    
    // Logout
    this.router.post('/logout', this.authMiddleware.authenticate as any, this.logout);
  }

  // Validation middleware
  private registerValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('username').optional().isLength({ min: 3, max: 30 }),
    body('firstName').optional().isLength({ min: 1, max: 50 }),
    body('lastName').optional().isLength({ min: 1, max: 50 }),
  ];

  private loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ];

  private tokenValidation = [
    body('grant_type').isIn(Object.values(GrantType)),
    body('client_id').optional().isString(),
    body('client_secret').optional().isString(),
    body('username').optional().isEmail(),
    body('password').optional().isString(),
    body('code').optional().isString(),
    body('refresh_token').optional().isString(),
    body('redirect_uri').optional().isURL(),
  ];

  private authorizeValidation = [
    body('response_type').equals('code'),
    body('client_id').isString(),
    body('redirect_uri').isURL(),
    body('scope').optional().isString(),
    body('state').optional().isString(),
  ];

  private refreshValidation = [
    body('refresh_token').isString(),
    body('client_id').optional().isString(),
  ];

  private forgotPasswordValidation = [
    body('email').isEmail().normalizeEmail(),
  ];

  private resetPasswordValidation = [
    body('token').isString(),
    body('password').isLength({ min: 8 }),
  ];

  private changePasswordValidation = [
    body('currentPassword').isString(),
    body('newPassword').isLength({ min: 8 }),
  ];

  private mfaSetupValidation = [
    body('type').isIn(Object.values(MFAType)),
  ];

  private mfaVerifyValidation = [
    body('userId').isString(),
    body('challenge').isString(),
    body('type').isIn(Object.values(MFAType)),
  ];

  // Route handlers
  private register = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { email: _email, password, username: _username, firstName: _firstName, lastName: _lastName } = req.body;

      // TODO: Implement user registration logic
      // 1. Check if user already exists
      // 2. Validate password strength
      // 3. Hash password
      // 4. Create user in database
      // 5. Generate verification email

      const passwordStrength = this.passwordService.validatePasswordStrength(password);
      if (!passwordStrength.isValid) {
        res.status(400).json({
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password does not meet requirements',
            details: passwordStrength.feedback,
          },
        });
        return;
      }

      // TODO: Create user and send verification email
      res.status(201).json({
        data: {
          message: 'Registration successful. Please check your email for verification.',
          userId: 'temp-user-id', // TODO: Return actual user ID
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Registration failed',
        },
      });
    }
  };

  private login = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { email, password: _password } = req.body;

      // TODO: Implement login logic
      // 1. Find user by email
      // 2. Verify password
      // 3. Check if user is active
      // 4. Check if MFA is required
      // 5. Generate tokens

      // Mock user for now
      const user = {
        id: 'user-123',
        email,
        role: 'USER' as any,
        permissions: ['PORTFOLIO_READ', 'PORTFOLIO_WRITE'] as any,
        status: 'ACTIVE' as any,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tokenPair = this.jwtService.generateTokenPair(user);

      const response: AuthResponse = {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: 'Bearer',
        expiresIn: tokenPair.accessTokenExpiresIn,
        scope: ['read', 'write'],
        user,
      };

      res.json({ data: response });
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'LOGIN_FAILED',
          message: 'Invalid credentials',
        },
      });
    }
  };

  private token = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { grant_type: _grant_type, client_id: _client_id, client_secret: _client_secret, username: _username, password: _password, code: _code, refresh_token: _refresh_token } = req.body;

      // TODO: Implement OAuth 2.0 token endpoint
      // Handle different grant types: password, authorization_code, refresh_token, client_credentials

      res.status(501).json({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'OAuth 2.0 token endpoint not yet implemented',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'TOKEN_ERROR',
          message: 'Token generation failed',
        },
      });
    }
  };

  private authorize = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      // TODO: Implement OAuth 2.0 authorization endpoint
      res.status(501).json({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'OAuth 2.0 authorization endpoint not yet implemented',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization failed',
        },
      });
    }
  };

  private refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { refresh_token: _refresh_token, client_id: _client_id } = req.body;

      // TODO: Implement refresh token logic
      // 1. Verify refresh token
      // 2. Get user from database
      // 3. Generate new access token
      // 4. Optionally rotate refresh token

      res.status(501).json({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Refresh token endpoint not yet implemented',
        },
      });
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'REFRESH_FAILED',
          message: 'Token refresh failed',
        },
      });
    }
  };

  private revoke = async (_req: Request, res: Response): Promise<void> => {
    try {
      // TODO: Implement token revocation
      // 1. Add token to blacklist
      // 2. Invalidate refresh token
      // 3. Log revocation event

      res.json({
        data: {
          message: 'Token revoked successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'REVOKE_FAILED',
          message: 'Token revocation failed',
        },
      });
    }
  };

  private validate = async (req: Request, res: Response): Promise<void> => {
    try {
      // Token is already validated by auth middleware
      res.json({
        data: {
          message: 'Token is valid',
          user: (req as any).user,
        },
      });
    } catch (error) {
      res.status(401).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Token validation failed',
        },
      });
    }
  };

  private forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { email: _email } = req.body;

      // TODO: Implement forgot password logic
      // 1. Find user by email
      // 2. Generate reset token
      // 3. Send reset email
      // 4. Store reset token with expiration

      res.json({
        data: {
          message: 'Password reset email sent',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'FORGOT_PASSWORD_FAILED',
          message: 'Password reset request failed',
        },
      });
    }
  };

  private resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { token: _token, password: _password } = req.body;

      // TODO: Implement password reset logic
      // 1. Verify reset token
      // 2. Update password
      // 3. Invalidate reset token
      // 4. Log password change

      res.json({
        data: {
          message: 'Password reset successful',
        },
      });
    } catch (error) {
      res.status(400).json({
        error: {
          code: 'RESET_PASSWORD_FAILED',
          message: 'Password reset failed',
        },
      });
    }
  };

  private changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { currentPassword: _currentPassword, newPassword: _newPassword } = req.body;
      const _user = (req as any).user;

      // TODO: Implement password change logic
      // 1. Verify current password
      // 2. Validate new password strength
      // 3. Update password
      // 4. Log password change

      res.json({
        data: {
          message: 'Password changed successfully',
        },
      });
    } catch (error) {
      res.status(400).json({
        error: {
          code: 'CHANGE_PASSWORD_FAILED',
          message: 'Password change failed',
        },
      });
    }
  };

  private mfaSetup = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { type } = req.body;
      const _user = (req as any).user;

      // TODO: Implement MFA setup logic
      const mfaSetup = await this.mfaService.setupMFA(_user.id, _user.email, type);

      const response: MFAChallenge = {
        type: mfaSetup.type,
      };
      
      if (mfaSetup.secret) {
        response.secret = mfaSetup.secret;
      }
      if (mfaSetup.qrCode) {
        response.qrCode = mfaSetup.qrCode;
      }
      if (mfaSetup.backupCodes) {
        response.backupCodes = mfaSetup.backupCodes;
      }

      res.json({
        data: response,
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'MFA_SETUP_FAILED',
          message: 'MFA setup failed',
        },
      });
    }
  };

  private mfaVerify = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
          },
        });
        return;
      }

      const { userId: _userId, challenge: _challenge, type: _type } = req.body;

      // TODO: Implement MFA verification logic
      // 1. Get user's MFA secret
      // 2. Verify challenge
      // 3. Complete MFA setup if needed
      // 4. Generate tokens

      res.status(501).json({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'MFA verification not yet implemented',
        },
      });
    } catch (error) {
      res.status(400).json({
        error: {
          code: 'MFA_VERIFICATION_FAILED',
          message: 'MFA verification failed',
        },
      });
    }
  };

  private mfaDisable = async (req: Request, res: Response): Promise<void> => {
    try {
      const _user = (req as any).user;

      // TODO: Implement MFA disable logic
      // 1. Verify user wants to disable MFA
      // 2. Remove MFA secret
      // 3. Log MFA disable event

      res.json({
        data: {
          message: 'MFA disabled successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'MFA_DISABLE_FAILED',
          message: 'MFA disable failed',
        },
      });
    }
  };

  private generateBackupCodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const _user = (req as any).user;

      // TODO: Implement backup codes generation
      // 1. Generate new backup codes
      // 2. Update user's MFA secret
      // 3. Return new codes

      const backupCodes = this.mfaService.generateBackupCodes();

      res.json({
        data: {
          backupCodes,
          message: 'Backup codes generated successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'BACKUP_CODES_FAILED',
          message: 'Backup codes generation failed',
        },
      });
    }
  };

  private logout = async (_req: Request, res: Response): Promise<void> => {
    try {
      // TODO: Implement logout logic
      // 1. Add token to blacklist
      // 2. Clear session
      // 3. Log logout event

      res.json({
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Logout failed',
        },
      });
    }
  };

  public getRouter(): Router {
    return this.router;
  }
} 