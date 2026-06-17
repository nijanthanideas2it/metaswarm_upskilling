import { createHash } from 'crypto';
import { AuthEvent, Role } from '../../../src/domain/enums';
import { InvalidRefreshTokenError } from '../../../src/domain/errors/domain.error';
import {
  RefreshTokenUseCase,
  RefreshTokenInput,
  RefreshTokenUseCaseConfig,
} from '../../../src/application/use-cases/refresh-token.use-case';
import { createAuthTokenEntity, createUserEntity } from '../../helpers/factories';
import {
  createMockAuthTokenRepository,
  createMockUserRepository,
  createMockAuthEventLogRepository,
  createMockJwtService,
} from '../../helpers/mocks';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('b'.repeat(32))),
}));

const FIXED_RAW_TOKEN = 'existing-raw-token';
const FIXED_TOKEN_HASH = createHash('sha256').update(FIXED_RAW_TOKEN).digest('hex');
const NEW_RAW_TOKEN = Buffer.from('b'.repeat(32)).toString('hex');
const NEW_TOKEN_HASH = createHash('sha256').update(NEW_RAW_TOKEN).digest('hex');

const config: RefreshTokenUseCaseConfig = {
  refreshTokenExpiresInMs: 7 * 24 * 60 * 60 * 1000,
  jwtExpiresIn: 900,
};

const baseInput: RefreshTokenInput = { refreshToken: FIXED_RAW_TOKEN };

describe('RefreshTokenUseCase', () => {
  let authTokenRepo: ReturnType<typeof createMockAuthTokenRepository>;
  let userRepo: ReturnType<typeof createMockUserRepository>;
  let authEventLogRepo: ReturnType<typeof createMockAuthEventLogRepository>;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    authTokenRepo = createMockAuthTokenRepository();
    userRepo = createMockUserRepository();
    authEventLogRepo = createMockAuthEventLogRepository();
    jwtService = createMockJwtService();
    useCase = new RefreshTokenUseCase(authTokenRepo, userRepo, authEventLogRepo, jwtService, config);
  });

  describe('when token is not found', () => {
    it('throws InvalidRefreshTokenError', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(null);

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidRefreshTokenError);
      expect(authTokenRepo.revoke).not.toHaveBeenCalled();
    });
  });

  describe('when token is already revoked', () => {
    it('throws InvalidRefreshTokenError', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(
        createAuthTokenEntity({ revokedAt: new Date() }),
      );

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidRefreshTokenError);
    });
  });

  describe('when token is expired', () => {
    it('throws InvalidRefreshTokenError', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(
        createAuthTokenEntity({ expiresAt: new Date(Date.now() - 1000), revokedAt: null }),
      );

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidRefreshTokenError);
    });
  });

  describe('when token is valid', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    beforeEach(() => {
      authTokenRepo.findByTokenHash.mockResolvedValue(
        createAuthTokenEntity({ expiresAt: futureDate, revokedAt: null, deviceInfo: 'jest-agent' }),
      );
      userRepo.findById.mockResolvedValue(createUserEntity({ role: Role.ADMIN }));
      authTokenRepo.create.mockResolvedValue(createAuthTokenEntity());
      jwtService.signAccessToken.mockReturnValue('new-access-token');
    });

    it('revokes the old token', async () => {
      await useCase.execute(baseInput);

      expect(authTokenRepo.revoke).toHaveBeenCalledWith(FIXED_TOKEN_HASH, expect.any(Date));
    });

    it('creates a new token with the new hash', async () => {
      const beforeCall = Date.now();
      await useCase.execute(baseInput);
      const afterCall = Date.now();

      expect(authTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: NEW_TOKEN_HASH,
          userId: 'user-id-1',
          deviceInfo: 'jest-agent',
        }),
      );

      const storedExpiresAt: Date = authTokenRepo.create.mock.calls[0][0].expiresAt;
      expect(storedExpiresAt.getTime()).toBeGreaterThanOrEqual(beforeCall + config.refreshTokenExpiresInMs);
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(afterCall + config.refreshTokenExpiresInMs);
    });

    it('signs new access token with correct payload', async () => {
      await useCase.execute(baseInput);

      expect(jwtService.signAccessToken).toHaveBeenCalledWith({ sub: 'user-id-1', role: Role.ADMIN });
    });

    it('logs TOKEN_REFRESH event', async () => {
      await useCase.execute(baseInput);

      expect(authEventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-id-1', event: AuthEvent.TOKEN_REFRESH }),
      );
    });

    it('returns new raw token (not hash), new access token, and expiresIn', async () => {
      const result = await useCase.execute(baseInput);

      expect(result.refreshToken).toBe(NEW_RAW_TOKEN);
      expect(result.refreshToken).not.toBe(NEW_TOKEN_HASH);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(config.jwtExpiresIn);
    });
  });

  describe('when user is not found after token lookup', () => {
    it('throws InvalidRefreshTokenError', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(
        createAuthTokenEntity({ expiresAt: new Date(Date.now() + 1000), revokedAt: null }),
      );
      userRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidRefreshTokenError);
    });
  });
});
