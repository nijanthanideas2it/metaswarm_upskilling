import { createHash } from 'crypto';
import { AuthEvent } from '../../domain/enums';
import {
  InvalidResetTokenError,
  SamePasswordError,
} from '../../domain/errors/domain.error';
import type { IAuthEventLogRepository } from '../../domain/repositories/auth-event-log.repository.interface';
import type { IAuthTokenRepository } from '../../domain/repositories/auth-token.repository.interface';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import type { IBcryptService } from '../ports/bcrypt.port';
import type { IEmailService } from '../ports/email.port';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly passwordResetRepo: IPasswordResetRepository,
    private readonly authTokenRepo: IAuthTokenRepository,
    private readonly authEventLogRepo: IAuthEventLogRepository,
    private readonly bcryptService: IBcryptService,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');

    const resetToken = await this.passwordResetRepo.findByTokenHash(tokenHash);

    if (resetToken === null) {
      throw new InvalidResetTokenError();
    }

    if (resetToken.usedAt !== null) {
      throw new InvalidResetTokenError();
    }

    if (resetToken.expiresAt <= new Date()) {
      throw new InvalidResetTokenError();
    }

    const user = await this.userRepo.findById(resetToken.userId);
    if (user === null) {
      throw new InvalidResetTokenError();
    }

    const isSamePassword = await this.bcryptService.compare(input.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new SamePasswordError();
    }

    await this.passwordResetRepo.markAsUsed(tokenHash, new Date());

    const newHash = await this.bcryptService.hash(input.newPassword);
    await this.userRepo.updatePassword(user.id, newHash);

    await this.authTokenRepo.revokeAllForUser(user.id);

    await this.authEventLogRepo.create({
      userId: user.id,
      event: AuthEvent.PASSWORD_RESET_SUCCESS,
      ipAddress: null,
      userAgent: null,
    });

    await this.emailService.sendPasswordChangedEmail(user.email);
  }
}
