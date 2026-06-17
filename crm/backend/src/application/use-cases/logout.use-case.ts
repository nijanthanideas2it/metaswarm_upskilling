import { createHash } from 'crypto';
import { AuthEvent } from '../../domain/enums';
import type { IAuthEventLogRepository } from '../../domain/repositories/auth-event-log.repository.interface';
import type { IAuthTokenRepository } from '../../domain/repositories/auth-token.repository.interface';

export interface LogoutInput {
  refreshToken: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export class LogoutUseCase {
  constructor(
    private readonly authTokenRepo: IAuthTokenRepository,
    private readonly authEventLogRepo: IAuthEventLogRepository,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');

    const token = await this.authTokenRepo.findByTokenHash(tokenHash);

    if (token !== null && token.revokedAt === null) {
      await this.authTokenRepo.revoke(tokenHash, new Date());
    }

    await this.authEventLogRepo.create({
      userId: input.userId,
      event: AuthEvent.LOGOUT,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}
