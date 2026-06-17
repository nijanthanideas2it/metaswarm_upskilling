import type { NextFunction, Request, Response } from 'express';
import type { LoginUseCase } from '../../../application/use-cases/login.use-case';
import type { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import type { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import type { ForgotPasswordUseCase } from '../../../application/use-cases/forgot-password.use-case';
import type { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountDeactivatedError,
  InvalidRefreshTokenError,
  InvalidResetTokenError,
  SamePasswordError,
} from '../../../domain/errors/domain.error';

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.loginUseCase.execute({
        email: req.body.email,
        password: req.body.password,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
      res.status(200).json({ data: result, meta: null, error: null });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({
          data: null, meta: null,
          error: { code: 'INVALID_CREDENTIALS', message: error.message, details: null },
        });
      } else if (error instanceof AccountLockedError) {
        res.status(403).json({
          data: null, meta: null,
          error: { code: 'ACCOUNT_LOCKED', message: error.message, details: null },
        });
      } else if (error instanceof AccountDeactivatedError) {
        res.status(403).json({
          data: null, meta: null,
          error: { code: 'ACCOUNT_DEACTIVATED', message: error.message, details: null },
        });
      } else {
        next(error);
      }
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.logoutUseCase.execute({
        refreshToken: req.body.refreshToken,
        userId: req.user!.sub,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.refreshTokenUseCase.execute({
        refreshToken: req.body.refreshToken,
      });
      res.status(200).json({ data: result, meta: null, error: null });
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        res.status(401).json({
          data: null, meta: null,
          error: { code: 'INVALID_REFRESH_TOKEN', message: error.message, details: null },
        });
      } else {
        next(error);
      }
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.forgotPasswordUseCase.execute({
        email: req.body.email,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
      res.status(200).json({
        data: { message: 'If this email is registered, a reset link has been sent.' },
        meta: null,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.resetPasswordUseCase.execute({
        token: req.body.token,
        newPassword: req.body.newPassword,
      });
      res.status(200).json({
        data: { message: 'Password has been reset successfully. Please log in with your new password.' },
        meta: null,
        error: null,
      });
    } catch (error) {
      if (error instanceof InvalidResetTokenError) {
        res.status(400).json({
          data: null, meta: null,
          error: { code: 'INVALID_RESET_TOKEN', message: error.message, details: null },
        });
      } else if (error instanceof SamePasswordError) {
        res.status(422).json({
          data: null, meta: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: [{ field: 'newPassword', message: error.message }],
          },
        });
      } else {
        next(error);
      }
    }
  };
}
