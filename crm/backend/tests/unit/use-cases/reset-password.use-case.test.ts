import { createHash } from 'crypto';
import { AuthEvent } from '../../../src/domain/enums';
import {
  InvalidResetTokenError,
  SamePasswordError,
} from '../../../src/domain/errors/domain.error';
import {
  ResetPasswordUseCase,
  ResetPasswordInput,
} from '../../../src/application/use-cases/reset-password.use-case';
import { createUserEntity, createPasswordResetTokenEntity } from '../../helpers/factories';
import {
  createMockUserRepository,
  createMockPasswordResetRepository,
  createMockAuthTokenRepository,
  createMockAuthEventLogRepository,
  createMockBcryptService,
  createMockEmailService,
} from '../../helpers/mocks';

const FIXED_RAW_TOKEN = 'valid-reset-token';
const FIXED_TOKEN_HASH = createHash('sha256').update(FIXED_RAW_TOKEN).digest('hex');

const baseInput: ResetPasswordInput = {
  token: FIXED_RAW_TOKEN,
  newPassword: 'NewSecure99',
};

describe('ResetPasswordUseCase', () => {
  let userRepo: ReturnType<typeof createMockUserRepository>;
  let passwordResetRepo: ReturnType<typeof createMockPasswordResetRepository>;
  let authTokenRepo: ReturnType<typeof createMockAuthTokenRepository>;
  let authEventLogRepo: ReturnType<typeof createMockAuthEventLogRepository>;
  let bcryptService: ReturnType<typeof createMockBcryptService>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    passwordResetRepo = createMockPasswordResetRepository();
    authTokenRepo = createMockAuthTokenRepository();
    authEventLogRepo = createMockAuthEventLogRepository();
    bcryptService = createMockBcryptService();
    emailService = createMockEmailService();
    useCase = new ResetPasswordUseCase(
      userRepo,
      passwordResetRepo,
      authTokenRepo,
      authEventLogRepo,
      bcryptService,
      emailService,
    );
  });

  describe('when reset token is not found', () => {
    it('throws InvalidResetTokenError', async () => {
      passwordResetRepo.findByTokenHash.mockResolvedValue(null);

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidResetTokenError);
      expect(userRepo.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('when reset token has already been used', () => {
    it('throws InvalidResetTokenError', async () => {
      passwordResetRepo.findByTokenHash.mockResolvedValue(
        createPasswordResetTokenEntity({ usedAt: new Date() }),
      );

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidResetTokenError);
    });
  });

  describe('when reset token has expired', () => {
    it('throws InvalidResetTokenError', async () => {
      passwordResetRepo.findByTokenHash.mockResolvedValue(
        createPasswordResetTokenEntity({ expiresAt: new Date(Date.now() - 1000), usedAt: null }),
      );

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidResetTokenError);
    });
  });

  describe('when user is not found after token lookup', () => {
    it('throws InvalidResetTokenError', async () => {
      passwordResetRepo.findByTokenHash.mockResolvedValue(
        createPasswordResetTokenEntity({ expiresAt: new Date(Date.now() + 60000), usedAt: null }),
      );
      userRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute(baseInput)).rejects.toThrow(InvalidResetTokenError);
      expect(userRepo.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('when token is valid but new password is same as current', () => {
    it('throws SamePasswordError', async () => {
      passwordResetRepo.findByTokenHash.mockResolvedValue(
        createPasswordResetTokenEntity({ expiresAt: new Date(Date.now() + 60000), usedAt: null }),
      );
      userRepo.findById.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(true);

      await expect(useCase.execute(baseInput)).rejects.toThrow(SamePasswordError);
      expect(userRepo.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('when token is valid and password is new', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);

    beforeEach(() => {
      passwordResetRepo.findByTokenHash.mockResolvedValue(
        createPasswordResetTokenEntity({ expiresAt: futureDate, usedAt: null }),
      );
      userRepo.findById.mockResolvedValue(createUserEntity());
      bcryptService.compare.mockResolvedValue(false);
      bcryptService.hash.mockResolvedValue('$2b$12$newhash');
      emailService.sendPasswordChangedEmail.mockResolvedValue(undefined);
    });

    it('looks up token by SHA-256 hash of the raw token', async () => {
      await useCase.execute(baseInput);

      expect(passwordResetRepo.findByTokenHash).toHaveBeenCalledWith(FIXED_TOKEN_HASH);
    });

    it('marks the reset token as used', async () => {
      await useCase.execute(baseInput);

      expect(passwordResetRepo.markAsUsed).toHaveBeenCalledWith(FIXED_TOKEN_HASH, expect.any(Date));
    });

    it('hashes and updates the password', async () => {
      await useCase.execute(baseInput);

      expect(bcryptService.hash).toHaveBeenCalledWith(baseInput.newPassword);
      expect(userRepo.updatePassword).toHaveBeenCalledWith('user-id-1', '$2b$12$newhash');
    });

    it('revokes all auth tokens for the user', async () => {
      await useCase.execute(baseInput);

      expect(authTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-id-1');
    });

    it('logs PASSWORD_RESET_SUCCESS event', async () => {
      await useCase.execute(baseInput);

      expect(authEventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-id-1', event: AuthEvent.PASSWORD_RESET_SUCCESS }),
      );
    });

    it('sends a password-changed notification email', async () => {
      await useCase.execute(baseInput);

      expect(emailService.sendPasswordChangedEmail).toHaveBeenCalledWith('user@example.com');
    });
  });
});
