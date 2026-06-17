import { Router } from 'express';
import { prisma } from '../../../config/prisma';
import { env } from '../../../config/env';
import { PrismaUserRepository } from '../../../infrastructure/repositories/prisma-user.repository';
import { PrismaAuthTokenRepository } from '../../../infrastructure/repositories/prisma-auth-token.repository';
import { PrismaPasswordResetRepository } from '../../../infrastructure/repositories/prisma-password-reset.repository';
import { PrismaAuthEventLogRepository } from '../../../infrastructure/repositories/prisma-auth-event-log.repository';
import { JwtService } from '../../../infrastructure/services/jwt.service';
import { BcryptService } from '../../../infrastructure/services/bcrypt.service';
import { NodemailerEmailService } from '../../../infrastructure/services/nodemailer-email.service';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { ForgotPasswordUseCase } from '../../../application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate-request.middleware';
import { authenticate } from '../middleware/authenticate.middleware';
import { loginRateLimit, authRateLimit } from '../middleware/rate-limit.middleware';
import { LoginSchema } from '../../../application/dto/login.dto';
import { RefreshTokenSchema } from '../../../application/dto/refresh-token.dto';
import { ForgotPasswordSchema } from '../../../application/dto/forgot-password.dto';
import { ResetPasswordSchema } from '../../../application/dto/reset-password.dto';

export function createAuthRoutes(): Router {
  const userRepo = new PrismaUserRepository(prisma);
  const authTokenRepo = new PrismaAuthTokenRepository(prisma);
  const passwordResetRepo = new PrismaPasswordResetRepository(prisma);
  const authEventLogRepo = new PrismaAuthEventLogRepository(prisma);

  const jwtService = new JwtService();
  const bcryptService = new BcryptService();
  const emailService = new NodemailerEmailService();

  const loginUseCase = new LoginUseCase(userRepo, authTokenRepo, authEventLogRepo, jwtService, bcryptService, {
    lockThreshold: 5,
    lockDurationMs: 15 * 60 * 1000,
    refreshTokenExpiresInMs: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  });

  const logoutUseCase = new LogoutUseCase(authTokenRepo, authEventLogRepo);

  const refreshTokenUseCase = new RefreshTokenUseCase(authTokenRepo, userRepo, authEventLogRepo, jwtService, {
    refreshTokenExpiresInMs: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
  });

  const forgotPasswordUseCase = new ForgotPasswordUseCase(
    userRepo,
    passwordResetRepo,
    authEventLogRepo,
    emailService,
    {
      resetTokenExpiresInMs: env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000,
      resetBaseUrl: env.PASSWORD_RESET_BASE_URL,
    },
  );

  const resetPasswordUseCase = new ResetPasswordUseCase(
    userRepo,
    passwordResetRepo,
    authTokenRepo,
    authEventLogRepo,
    bcryptService,
    emailService,
  );

  const controller = new AuthController(
    loginUseCase,
    logoutUseCase,
    refreshTokenUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
  );

  const router = Router();

  router.post('/login', loginRateLimit, validateRequest(LoginSchema), controller.login);
  router.post('/logout', authenticate(jwtService), validateRequest(RefreshTokenSchema), controller.logout);
  router.post('/refresh', authRateLimit, validateRequest(RefreshTokenSchema), controller.refresh);
  router.post('/forgot-password', authRateLimit, validateRequest(ForgotPasswordSchema), controller.forgotPassword);
  router.post('/reset-password', authRateLimit, validateRequest(ResetPasswordSchema), controller.resetPassword);

  return router;
}
