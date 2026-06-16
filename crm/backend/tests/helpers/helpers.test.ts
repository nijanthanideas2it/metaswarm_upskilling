import { AccountStatus, AuthEvent, Role } from '../../src/domain/enums';
import {
  createAuthEventLogEntity,
  createAuthTokenEntity,
  createPasswordResetTokenEntity,
  createUserEntity,
} from './factories';
import {
  createMockAuthEventLogRepository,
  createMockAuthTokenRepository,
  createMockBcryptService,
  createMockEmailService,
  createMockJwtService,
  createMockPasswordResetRepository,
  createMockUserRepository,
} from './mocks';

describe('Entity factories', () => {
  describe('createUserEntity', () => {
    it('returns a valid UserEntity with defaults', () => {
      const user = createUserEntity();
      expect(user.id).toBe('user-id-1');
      expect(user.status).toBe(AccountStatus.ACTIVE);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });

    it('applies overrides', () => {
      const user = createUserEntity({ role: Role.ADMIN, failedLoginAttempts: 3 });
      expect(user.role).toBe(Role.ADMIN);
      expect(user.failedLoginAttempts).toBe(3);
    });
  });

  describe('createAuthTokenEntity', () => {
    it('returns a non-revoked token by default', () => {
      const token = createAuthTokenEntity();
      expect(token.revokedAt).toBeNull();
      expect(token.expiresAt.getTime()).toBeGreaterThan(token.createdAt.getTime());
    });

    it('applies overrides', () => {
      const revokedAt = new Date();
      const token = createAuthTokenEntity({ revokedAt });
      expect(token.revokedAt).toBe(revokedAt);
    });
  });

  describe('createPasswordResetTokenEntity', () => {
    it('returns an unused token by default', () => {
      const token = createPasswordResetTokenEntity();
      expect(token.usedAt).toBeNull();
    });
  });

  describe('createAuthEventLogEntity', () => {
    it('returns a LOGIN_SUCCESS event by default', () => {
      const log = createAuthEventLogEntity();
      expect(log.event).toBe(AuthEvent.LOGIN_SUCCESS);
    });

    it('applies event override', () => {
      const log = createAuthEventLogEntity({ event: AuthEvent.LOGOUT });
      expect(log.event).toBe(AuthEvent.LOGOUT);
    });
  });
});

describe('Mock repository factories', () => {
  it('createMockUserRepository returns all required jest.fn() methods', () => {
    const repo = createMockUserRepository();
    expect(jest.isMockFunction(repo.findByEmail)).toBe(true);
    expect(jest.isMockFunction(repo.findById)).toBe(true);
    expect(jest.isMockFunction(repo.incrementFailedLoginAttempts)).toBe(true);
    expect(jest.isMockFunction(repo.resetFailedLoginAttempts)).toBe(true);
    expect(jest.isMockFunction(repo.updatePassword)).toBe(true);
  });

  it('createMockAuthTokenRepository returns all required jest.fn() methods', () => {
    const repo = createMockAuthTokenRepository();
    expect(jest.isMockFunction(repo.create)).toBe(true);
    expect(jest.isMockFunction(repo.findByTokenHash)).toBe(true);
    expect(jest.isMockFunction(repo.revoke)).toBe(true);
    expect(jest.isMockFunction(repo.revokeAllForUser)).toBe(true);
  });

  it('createMockPasswordResetRepository returns all required jest.fn() methods', () => {
    const repo = createMockPasswordResetRepository();
    expect(jest.isMockFunction(repo.create)).toBe(true);
    expect(jest.isMockFunction(repo.findByTokenHash)).toBe(true);
    expect(jest.isMockFunction(repo.invalidatePreviousTokens)).toBe(true);
    expect(jest.isMockFunction(repo.markAsUsed)).toBe(true);
  });

  it('createMockAuthEventLogRepository returns create jest.fn()', () => {
    const repo = createMockAuthEventLogRepository();
    expect(jest.isMockFunction(repo.create)).toBe(true);
  });

  it('createMockJwtService returns all required jest.fn() methods', () => {
    const svc = createMockJwtService();
    expect(jest.isMockFunction(svc.signAccessToken)).toBe(true);
    expect(jest.isMockFunction(svc.verifyAccessToken)).toBe(true);
  });

  it('createMockBcryptService returns all required jest.fn() methods', () => {
    const svc = createMockBcryptService();
    expect(jest.isMockFunction(svc.hash)).toBe(true);
    expect(jest.isMockFunction(svc.compare)).toBe(true);
  });

  it('createMockEmailService returns all required jest.fn() methods', () => {
    const svc = createMockEmailService();
    expect(jest.isMockFunction(svc.sendPasswordResetEmail)).toBe(true);
    expect(jest.isMockFunction(svc.sendPasswordChangedEmail)).toBe(true);
  });
});
