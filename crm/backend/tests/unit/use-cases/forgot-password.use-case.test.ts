import { createHash } from 'crypto';
import { AuthEvent } from '../../../src/domain/enums';
import {
  ForgotPasswordUseCase,
  ForgotPasswordInput,
  ForgotPasswordUseCaseConfig,
} from '../../../src/application/use-cases/forgot-password.use-case';
import { createUserEntity, createPasswordResetTokenEntity } from '../../helpers/factories';
import {
  createMockUserRepository,
  createMockPasswordResetRepository,
  createMockAuthEventLogRepository,
  createMockEmailService,
} from '../../helpers/mocks';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('c'.repeat(32))),
}));

const FIXED_RAW_TOKEN = Buffer.from('c'.repeat(32)).toString('hex');
const FIXED_TOKEN_HASH = createHash('sha256').update(FIXED_RAW_TOKEN).digest('hex');

const config: ForgotPasswordUseCaseConfig = {
  resetTokenExpiresInMs: 60 * 60 * 1000,
  resetBaseUrl: 'https://app.example.com',
};

const baseInput: ForgotPasswordInput = {
  email: 'user@example.com',
  ipAddress: '127.0.0.1',
  userAgent: 'jest-test-agent',
};

describe('ForgotPasswordUseCase', () => {
  let userRepo: ReturnType<typeof createMockUserRepository>;
  let passwordResetRepo: ReturnType<typeof createMockPasswordResetRepository>;
  let authEventLogRepo: ReturnType<typeof createMockAuthEventLogRepository>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let useCase: ForgotPasswordUseCase;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    passwordResetRepo = createMockPasswordResetRepository();
    authEventLogRepo = createMockAuthEventLogRepository();
    emailService = createMockEmailService();
    useCase = new ForgotPasswordUseCase(
      userRepo,
      passwordResetRepo,
      authEventLogRepo,
      emailService,
      config,
    );
  });

  describe('when email is not registered', () => {
    it('returns without sending email or logging an event (anti-enumeration)', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await useCase.execute(baseInput);

      expect(passwordResetRepo.invalidatePreviousTokens).not.toHaveBeenCalled();
      expect(passwordResetRepo.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(authEventLogRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('when email is registered', () => {
    beforeEach(() => {
      userRepo.findByEmail.mockResolvedValue(createUserEntity());
      passwordResetRepo.create.mockResolvedValue(createPasswordResetTokenEntity());
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);
    });

    it('normalises email before looking up user', async () => {
      await useCase.execute({ ...baseInput, email: '  USER@EXAMPLE.COM  ' });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    });

    it('invalidates previous reset tokens first', async () => {
      await useCase.execute(baseInput);

      expect(passwordResetRepo.invalidatePreviousTokens).toHaveBeenCalledWith('user-id-1');
    });

    it('stores a new reset token with the hash (not raw) and 1h expiry', async () => {
      const beforeCall = Date.now();
      await useCase.execute(baseInput);
      const afterCall = Date.now();

      expect(passwordResetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: FIXED_TOKEN_HASH,
          userId: 'user-id-1',
        }),
      );

      const storedExpiresAt: Date = passwordResetRepo.create.mock.calls[0][0].expiresAt;
      expect(storedExpiresAt.getTime()).toBeGreaterThanOrEqual(beforeCall + config.resetTokenExpiresInMs);
      expect(storedExpiresAt.getTime()).toBeLessThanOrEqual(afterCall + config.resetTokenExpiresInMs);
    });

    it('sends a reset email with the raw token embedded in the URL', async () => {
      await useCase.execute(baseInput);

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        `${config.resetBaseUrl}/reset-password?token=${FIXED_RAW_TOKEN}`,
      );
    });

    it('does not embed the token hash in the reset URL', async () => {
      await useCase.execute(baseInput);

      const sentUrl: string = (emailService.sendPasswordResetEmail as jest.Mock).mock.calls[0][1];
      expect(sentUrl).not.toContain(FIXED_TOKEN_HASH);
    });

    it('logs PASSWORD_RESET_REQUEST event', async () => {
      await useCase.execute(baseInput);

      expect(authEventLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        event: AuthEvent.PASSWORD_RESET_REQUEST,
        ipAddress: baseInput.ipAddress,
        userAgent: baseInput.userAgent,
      });
    });
  });
});
