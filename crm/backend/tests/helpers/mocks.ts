import type { IBcryptService } from '../../src/application/ports/bcrypt.port';
import type { IEmailService } from '../../src/application/ports/email.port';
import type { IJwtService } from '../../src/application/ports/jwt.port';
import type { IAuthEventLogRepository } from '../../src/domain/repositories/auth-event-log.repository.interface';
import type { IAuthTokenRepository } from '../../src/domain/repositories/auth-token.repository.interface';
import type { IPasswordResetRepository } from '../../src/domain/repositories/password-reset.repository.interface';
import type { IUserRepository } from '../../src/domain/repositories/user.repository.interface';

export function createMockUserRepository(): jest.Mocked<IUserRepository> {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    incrementFailedLoginAttempts: jest.fn(),
    resetFailedLoginAttempts: jest.fn(),
    updatePassword: jest.fn(),
  };
}

export function createMockAuthTokenRepository(): jest.Mocked<IAuthTokenRepository> {
  return {
    create: jest.fn(),
    findByTokenHash: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };
}

export function createMockPasswordResetRepository(): jest.Mocked<IPasswordResetRepository> {
  return {
    create: jest.fn(),
    findByTokenHash: jest.fn(),
    invalidatePreviousTokens: jest.fn(),
    markAsUsed: jest.fn(),
  };
}

export function createMockAuthEventLogRepository(): jest.Mocked<IAuthEventLogRepository> {
  return {
    create: jest.fn(),
  };
}

export function createMockJwtService(): jest.Mocked<IJwtService> {
  return {
    signAccessToken: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
}

export function createMockBcryptService(): jest.Mocked<IBcryptService> {
  return {
    hash: jest.fn(),
    compare: jest.fn(),
  };
}

export function createMockEmailService(): jest.Mocked<IEmailService> {
  return {
    sendPasswordResetEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
  };
}
