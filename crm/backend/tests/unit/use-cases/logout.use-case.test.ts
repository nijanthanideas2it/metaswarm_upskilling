import { createHash } from 'crypto';
import { AuthEvent } from '../../../src/domain/enums';
import { LogoutUseCase, LogoutInput } from '../../../src/application/use-cases/logout.use-case';
import { createAuthTokenEntity } from '../../helpers/factories';
import {
  createMockAuthTokenRepository,
  createMockAuthEventLogRepository,
} from '../../helpers/mocks';

const FIXED_RAW_TOKEN = 'a'.repeat(64);
const FIXED_TOKEN_HASH = createHash('sha256').update(FIXED_RAW_TOKEN).digest('hex');

const baseInput: LogoutInput = {
  refreshToken: FIXED_RAW_TOKEN,
  userId: 'user-id-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest-test-agent',
};

describe('LogoutUseCase', () => {
  let authTokenRepo: ReturnType<typeof createMockAuthTokenRepository>;
  let authEventLogRepo: ReturnType<typeof createMockAuthEventLogRepository>;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    authTokenRepo = createMockAuthTokenRepository();
    authEventLogRepo = createMockAuthEventLogRepository();
    useCase = new LogoutUseCase(authTokenRepo, authEventLogRepo);
  });

  describe('when token is found and not revoked', () => {
    it('revokes the token by hash and logs LOGOUT event', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(createAuthTokenEntity({ revokedAt: null }));

      await useCase.execute(baseInput);

      expect(authTokenRepo.findByTokenHash).toHaveBeenCalledWith(FIXED_TOKEN_HASH);
      expect(authTokenRepo.revoke).toHaveBeenCalledWith(FIXED_TOKEN_HASH, expect.any(Date));
      expect(authEventLogRepo.create).toHaveBeenCalledWith({
        userId: baseInput.userId,
        event: AuthEvent.LOGOUT,
        ipAddress: baseInput.ipAddress,
        userAgent: baseInput.userAgent,
      });
    });
  });

  describe('when token is not found', () => {
    it('does not call revoke but still logs LOGOUT', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(null);

      await useCase.execute(baseInput);

      expect(authTokenRepo.revoke).not.toHaveBeenCalled();
      expect(authEventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: AuthEvent.LOGOUT }),
      );
    });
  });

  describe('when token is already revoked', () => {
    it('does not call revoke again but still logs LOGOUT', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(
        createAuthTokenEntity({ revokedAt: new Date() }),
      );

      await useCase.execute(baseInput);

      expect(authTokenRepo.revoke).not.toHaveBeenCalled();
      expect(authEventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: AuthEvent.LOGOUT }),
      );
    });
  });

  describe('when userAgent is null', () => {
    it('logs LOGOUT with null userAgent', async () => {
      authTokenRepo.findByTokenHash.mockResolvedValue(null);

      await useCase.execute({ ...baseInput, userAgent: null });

      expect(authEventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: null, event: AuthEvent.LOGOUT }),
      );
    });
  });
});
