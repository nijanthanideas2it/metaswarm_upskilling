import { createHash, randomBytes } from 'crypto';
import { AuthEvent } from '../../domain/enums';
import type { IAuthEventLogRepository } from '../../domain/repositories/auth-event-log.repository.interface';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import type { IEmailService } from '../ports/email.port';

export interface ForgotPasswordInput {
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ForgotPasswordUseCaseConfig {
  resetTokenExpiresInMs: number;
  resetBaseUrl: string;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordResetRepo: IPasswordResetRepository,
    private readonly authEventLogRepo: IAuthEventLogRepository,
    private readonly emailService: IEmailService,
    private readonly config: ForgotPasswordUseCaseConfig,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (user === null) {
      return;
    }

    await this.passwordResetRepo.invalidatePreviousTokens(user.id);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.resetTokenExpiresInMs);

    await this.passwordResetRepo.create({ tokenHash, userId: user.id, expiresAt });

    const resetUrl = `${this.config.resetBaseUrl}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetUrl);

    await this.authEventLogRepo.create({
      userId: user.id,
      event: AuthEvent.PASSWORD_RESET_REQUEST,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}
