import { createHash, randomBytes } from 'crypto';
import { AuthEvent } from '../../domain/enums';
import { InvalidRefreshTokenError } from '../../domain/errors/domain.error';
import type { IAuthEventLogRepository } from '../../domain/repositories/auth-event-log.repository.interface';
import type { IAuthTokenRepository } from '../../domain/repositories/auth-token.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import type { IJwtService } from '../ports/jwt.port';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenUseCaseConfig {
  refreshTokenExpiresInMs: number;
  jwtExpiresIn: number;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly authTokenRepo: IAuthTokenRepository,
    private readonly userRepo: IUserRepository,
    private readonly authEventLogRepo: IAuthEventLogRepository,
    private readonly jwtService: IJwtService,
    private readonly config: RefreshTokenUseCaseConfig,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');

    const existing = await this.authTokenRepo.findByTokenHash(tokenHash);

    if (existing === null) {
      throw new InvalidRefreshTokenError();
    }

    if (existing.revokedAt !== null) {
      throw new InvalidRefreshTokenError();
    }

    if (existing.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    await this.authTokenRepo.revoke(tokenHash, new Date());

    const user = await this.userRepo.findById(existing.userId);
    if (user === null) {
      throw new InvalidRefreshTokenError();
    }

    const rawToken = randomBytes(32).toString('hex');
    const newTokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiresInMs);

    await this.authTokenRepo.create({
      tokenHash: newTokenHash,
      userId: user.id,
      expiresAt,
      deviceInfo: existing.deviceInfo ?? undefined,
    });

    const accessToken = this.jwtService.signAccessToken({ sub: user.id, role: user.role });

    await this.authEventLogRepo.create({
      userId: user.id,
      event: AuthEvent.TOKEN_REFRESH,
      ipAddress: null,
      userAgent: existing.deviceInfo ?? null,
    });

    return {
      accessToken,
      refreshToken: rawToken,
      expiresIn: this.config.jwtExpiresIn,
    };
  }
}
