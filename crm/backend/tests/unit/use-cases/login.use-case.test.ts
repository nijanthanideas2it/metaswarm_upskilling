import { createHash } from 'crypto';
import { AuthEvent, AccountStatus, Role } from '../../../src/domain/enums';
import {
  AccountDeactivatedError,
  AccountLockedError,
  InvalidCredentialsError,
} from '../../../src/domain/errors/domain.error';
import { LoginUseCase, LoginInput, LoginUseCaseConfig } from '../../../src/application/use-cases/login.use-case';
import { createUserEntity, createAuthTokenEntity } from '../../helpers/factories';
import {
  createMockUserRepository,
  createMockAuthTokenRepository,
  createMockAuthEventLogRepository,
  createMockJwtService,
  createMockBcryptService,
} from '../../helpers/mocks';

// Control randomBytes output so token values are deterministic in tests
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('a'.repeat(32))),
}));

const FIXED_RAW_TOKEN = Buffer.from('a'.repeat(32)).toString('hex');
const FIXED_TOKEN_HASH = createHash('sha256').update(FIXED_RAW_TOKEN).digest('hex');

const config: LoginUseCaseConfig = {
  lockThreshold: 5,
  lockDurationMs: 15 * 60 * 1000,
  refreshTokenExpiresInMs: 7 * 24 * 60 * 60 * 1000,
  jwtExpiresIn: 900,
};

const baseInput: LoginInput = {
  email: 'user@example.com',
  password: 'correctPassword123',
  ipAddress: '127.0.0.1',
  userAgent: 'jest-test-agent',
};

describe('LoginUseCase', () => {
  let userRepo: ReturnType<typeof createMockUserRepository>;
  let authTokenRepo: ReturnType<typeof createMockAuthTokenRepository>;
  let authEventLogRepo: ReturnType<typeof createMockAuthEventLogRepository>;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let bcryptService: ReturnType<typeof createMockBcryptService>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    authTokenRepo = createMockAuthTokenRepository();
    authEventLogRepo = createMockAuthEventLogRepository();
    jwtService = createMockJwtService();
    bcryptService = createMockBcryptService();
    useCase = new LoginUseCase(
      userRepo,
      authTokenRepo,
      authEventLogRepo,
      jwtService,
      bcryptService,
      config,
    );
  });

  // -------------------------------------------------------------------------
  // 1. User not found
  // -------------------------------------------------------------------------
  describe('when user is not found', () => {
    it('runs dummy bcrypt compare, logs LOGIN_FAILURE with userId null, and throws InvalidCredentialsError', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      bcryptService.compare.mockResolvedValue(false);

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidCredentialsError);

      // Timing-safe dummy compare must always be called
      expect(bcryptService.compare).toHaveBeenCalledWith(
        baseInput.password,
        '$2b$12$notarealhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      );

      expect(authEventLogRepo.create).toHaveBeenCalledWith({
        userId: null,
        event: AuthEvent.LOGIN_FAILURE,
        ipAddress: baseInput.ipAddress,
        userAgent: baseInput.userAgent,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Deactivated account
  // -------------------------------------------------------------------------
  describe('when account is deactivated', () => {
    it('throws AccountDeactivatedError without calling bcrypt or logging an event', async () => {
      userRepo.findByEmail.mockResolvedValue(
        createUserEntity({ status: AccountStatus.DEACTIVATED }),
      );

      await expect(useCase.execute(baseInput)).rejects.toThrow(AccountDeactivatedError);

      expect(bcryptService.compare).not.toHaveBeenCalled();
      expect(authEventLogRepo.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Account locked (lockedUntil is in the future)
  // -------------------------------------------------------------------------
  describe('when account is locked', () => {
    it('throws AccountLockedError without calling bcrypt', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      userRepo.findByEmail.mockResolvedValue(
        createUserEntity({ lockedUntil: futureDate }),
      );

      await expect(useCase.execute(baseInput)).rejects.toThrow(AccountLockedError);

      expect(bcryptService.compare).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Lock expired (lockedUntil is in the past)
  // -------------------------------------------------------------------------
  describe('when lock has expired', () => {
    it('calls resetFailedLoginAttempts and proceeds to password check', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      userRepo.findByEmail.mockResolvedValue(
        createUserEntity({ lockedUntil: pastDate }),
      );
      // Password will fail so we can verify the flow without reaching token creation
      bcryptService.compare.mockResolvedValue(false);
      userRepo.incrementFailedLoginAttempts.mockResolvedValue({
        failedLoginAttempts: 1,
        lockedUntil: null,
      });

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidCredentialsError);

      // Reset must be called first, before the password comparison
      expect(userRepo.resetFailedLoginAttempts).toHaveBeenCalledWith('user-id-1');
      // bcrypt compare must have been called (i.e. we proceeded past the lock check)
      expect(bcryptService.compare).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Wrong password
  // -------------------------------------------------------------------------
  describe('when password is wrong', () => {
    it('increments failed attempts, logs LOGIN_FAILURE, and throws InvalidCredentialsError', async () => {
      userRepo.findByEmail.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(false);
      userRepo.incrementFailedLoginAttempts.mockResolvedValue({
        failedLoginAttempts: 1,
        lockedUntil: null,
      });

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidCredentialsError);

      expect(userRepo.incrementFailedLoginAttempts).toHaveBeenCalledWith(
        'user-id-1',
        config.lockThreshold,
        config.lockDurationMs,
      );

      expect(authEventLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        event: AuthEvent.LOGIN_FAILURE,
        ipAddress: baseInput.ipAddress,
        userAgent: baseInput.userAgent,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 6. Fifth wrong password triggers a lock
  // -------------------------------------------------------------------------
  describe('when the failing attempt triggers an account lock', () => {
    it('logs both LOGIN_FAILURE and ACCOUNT_LOCKED events', async () => {
      const lockedUntil = new Date(Date.now() + config.lockDurationMs);
      userRepo.findByEmail.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(false);
      userRepo.incrementFailedLoginAttempts.mockResolvedValue({
        failedLoginAttempts: 5,
        lockedUntil,
      });

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidCredentialsError);

      const calls = authEventLogRepo.create.mock.calls;
      expect(calls).toHaveLength(2);

      expect(calls[0][0]).toMatchObject({
        userId: 'user-id-1',
        event: AuthEvent.LOGIN_FAILURE,
      });
      expect(calls[1][0]).toMatchObject({
        userId: 'user-id-1',
        event: AuthEvent.ACCOUNT_LOCKED,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 7. Correct password — side-effects
  // -------------------------------------------------------------------------
  describe('when password is correct', () => {
    beforeEach(() => {
      userRepo.findByEmail.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(true);
      userRepo.resetFailedLoginAttempts.mockResolvedValue(undefined);
      authTokenRepo.create.mockResolvedValue(createAuthTokenEntity());
      jwtService.signAccessToken.mockReturnValue('signed-access-token');
    });

    it('resets failed login attempts, stores token hash, signs access token, and logs LOGIN_SUCCESS', async () => {
      const beforeCall = Date.now();
      await useCase.execute(baseInput);
      const afterCall = Date.now();

      // 8a. Reset counter
      expect(userRepo.resetFailedLoginAttempts).toHaveBeenCalledWith('user-id-1');

      // 8b. Store token using SHA-256 hash, not the raw token
      expect(authTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: FIXED_TOKEN_HASH,
          userId: 'user-id-1',
          deviceInfo: baseInput.userAgent,
        }),
      );

      // expiresAt must be within the expected window
      const storedExpiresAt: Date = authTokenRepo.create.mock.calls[0][0].expiresAt;
      expect(storedExpiresAt).toBeInstanceOf(Date);
      expect(storedExpiresAt.getTime()).toBeGreaterThanOrEqual(
        beforeCall + config.refreshTokenExpiresInMs,
      );
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(
        afterCall + config.refreshTokenExpiresInMs,
      );

      // 8c. Sign access token with correct payload
      expect(jwtService.signAccessToken).toHaveBeenCalledWith({
        sub: 'user-id-1',
        role: Role.SUPPORT_AGENT,
      });

      // 8d. Log LOGIN_SUCCESS
      expect(authEventLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        event: AuthEvent.LOGIN_SUCCESS,
        ipAddress: baseInput.ipAddress,
        userAgent: baseInput.userAgent,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 8. Correct password — returned output shape
  // -------------------------------------------------------------------------
  describe('LoginOutput shape', () => {
    it('returns rawToken (not hash) as refreshToken, jwtExpiresIn as expiresIn, and correct user fields', async () => {
      userRepo.findByEmail.mockResolvedValue(
        createUserEntity({ id: 'user-id-1', email: 'user@example.com', role: Role.ADMIN }),
      );
      bcryptService.compare.mockResolvedValue(true);
      userRepo.resetFailedLoginAttempts.mockResolvedValue(undefined);
      authTokenRepo.create.mockResolvedValue(createAuthTokenEntity());
      jwtService.signAccessToken.mockReturnValue('the-access-token');

      const result = await useCase.execute(baseInput);

      expect(result.refreshToken).toBe(FIXED_RAW_TOKEN);
      expect(result.refreshToken).not.toBe(FIXED_TOKEN_HASH);
      expect(result.accessToken).toBe('the-access-token');
      expect(result.expiresIn).toBe(config.jwtExpiresIn);
      expect(result.user).toEqual({
        id: 'user-id-1',
        email: 'user@example.com',
        role: Role.ADMIN,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 9. Email normalisation
  // -------------------------------------------------------------------------
  describe('email normalisation', () => {
    it('lowercases and trims the email before looking up the user', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      bcryptService.compare.mockResolvedValue(false);

      await expect(
        useCase.execute({ ...baseInput, email: '  USER@EXAMPLE.COM  ' }),
      ).rejects.toThrow(InvalidCredentialsError);

      expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // 9b. deviceInfo omitted when userAgent is null
  // -------------------------------------------------------------------------
  describe('when userAgent is null', () => {
    it('stores auth token without deviceInfo (undefined) and still succeeds', async () => {
      userRepo.findByEmail.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(true);
      userRepo.resetFailedLoginAttempts.mockResolvedValue(undefined);
      authTokenRepo.create.mockResolvedValue(createAuthTokenEntity());
      jwtService.signAccessToken.mockReturnValue('access-token');

      await useCase.execute({ ...baseInput, userAgent: null });

      expect(authTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ deviceInfo: undefined }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 10. No ACCOUNT_LOCKED event when wrong password does not reach threshold
  // -------------------------------------------------------------------------
  describe('when wrong password does NOT trigger a lock', () => {
    it('logs only LOGIN_FAILURE and does not log ACCOUNT_LOCKED', async () => {
      userRepo.findByEmail.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(false);
      userRepo.incrementFailedLoginAttempts.mockResolvedValue({
        failedLoginAttempts: 3,
        lockedUntil: null, // No lock
      });

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidCredentialsError);

      expect(authEventLogRepo.create).toHaveBeenCalledTimes(1);
      expect(authEventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: AuthEvent.LOGIN_FAILURE }),
      );
    });
  });
});
