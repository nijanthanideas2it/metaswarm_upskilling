import { createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';
import type { IEmailService } from '../../application/ports/email.port';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';
import type { IUserInvitationService } from '../../domain/services/user-invitation.service.interface';

export class AuthUserInvitationService implements IUserInvitationService {
  constructor(
    private readonly passwordResetRepo: IPasswordResetRepository,
    private readonly emailService: IEmailService,
  ) {}

  async sendInvitation(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000);

    await this.passwordResetRepo.create({ tokenHash, userId, expiresAt });

    const inviteUrl = `${env.PASSWORD_RESET_BASE_URL}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordResetEmail(email, inviteUrl);
  }
}
