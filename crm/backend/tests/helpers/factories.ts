import { AuthEvent, AccountStatus, Role } from '../../src/domain/enums';
import type { AuthEventLogEntity } from '../../src/domain/entities/auth-event-log.entity';
import type { AuthTokenEntity } from '../../src/domain/entities/auth-token.entity';
import type { PasswordResetTokenEntity } from '../../src/domain/entities/password-reset-token.entity';
import type { UserEntity } from '../../src/domain/entities/user.entity';

const BASE_DATE = new Date('2026-01-01T00:00:00.000Z');

export function createUserEntity(overrides?: Partial<UserEntity>): UserEntity {
  return {
    id: 'user-id-1',
    email: 'user@example.com',
    passwordHash: '$2b$12$testhash',
    role: Role.SUPPORT_AGENT,
    status: AccountStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

export function createAuthTokenEntity(overrides?: Partial<AuthTokenEntity>): AuthTokenEntity {
  return {
    id: 'token-id-1',
    tokenHash: 'hashed-refresh-token',
    userId: 'user-id-1',
    expiresAt: new Date(BASE_DATE.getTime() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    deviceInfo: null,
    createdAt: BASE_DATE,
    ...overrides,
  };
}

export function createPasswordResetTokenEntity(
  overrides?: Partial<PasswordResetTokenEntity>,
): PasswordResetTokenEntity {
  return {
    id: 'reset-id-1',
    tokenHash: 'hashed-reset-token',
    userId: 'user-id-1',
    expiresAt: new Date(BASE_DATE.getTime() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: BASE_DATE,
    ...overrides,
  };
}

export function createAuthEventLogEntity(
  overrides?: Partial<AuthEventLogEntity>,
): AuthEventLogEntity {
  return {
    id: 'log-id-1',
    userId: 'user-id-1',
    event: AuthEvent.LOGIN_SUCCESS,
    ipAddress: '127.0.0.1',
    userAgent: 'jest-test-agent',
    createdAt: BASE_DATE,
    ...overrides,
  };
}
