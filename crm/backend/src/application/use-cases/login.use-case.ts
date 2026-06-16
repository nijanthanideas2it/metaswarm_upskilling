import { createHash, randomBytes } from 'crypto';
import { AccountStatus, AuthEvent, Role } from '../../domain/enums';
import {
  AccountDeactivatedError,
  AccountLockedError,
  InvalidCredentialsError,
} from '../../domain/errors/domain.error';
import type { IAuthEventLogRepository } from '../../domain/repositories/auth-event-log.repository.interface';
import type { IAuthTokenRepository } from '../../domain/repositories/auth-token.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import type { IBcryptService } from '../ports/bcrypt.port';
import type { IJwtService } from '../ports/jwt.port';

export interface LoginInput {
  email: string;
  password: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;   // raw opaque token returned to client
  expiresIn: number;      // seconds until access token expires
  user: {
    id: string;
    email: string;
    role: Role;
  };
}

export interface LoginUseCaseConfig {
  lockThreshold: number;           // consecutive failures before lock (default 5)
  lockDurationMs: number;          // lock duration in ms (default 15 * 60 * 1000)
  refreshTokenExpiresInMs: number; // refresh TTL in ms (default 7 * 24 * 60 * 60 * 1000)
  jwtExpiresIn: number;            // access token TTL in seconds (default 900)
}

/**
 * A dummy hash used for timing-safe comparison when a user is not found.
 * Prevents timing-based user enumeration attacks by always running bcrypt.
 */
const DUMMY_HASH = '$2b$12$notarealhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authTokenRepo: IAuthTokenRepository,
    private readonly authEventLogRepo: IAuthEventLogRepository,
    private readonly jwtService: IJwtService,
    private readonly bcryptService: IBcryptService,
    private readonly config: LoginUseCaseConfig,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    // 1. Normalise email
    const normalizedEmail = input.email.toLowerCase().trim();

    // 2. Fetch user
    const user = await this.userRepo.findByEmail(normalizedEmail);

    // 3. User not found — run dummy compare to prevent timing attacks
    if (user === null) {
      await this.bcryptService.compare(input.password, DUMMY_HASH);
      await this.logEvent(null, AuthEvent.LOGIN_FAILURE, input);
      throw new InvalidCredentialsError();
    }

    // 4. Deactivated account — fail immediately without bcrypt
    if (user.status === AccountStatus.DEACTIVATED) {
      throw new AccountDeactivatedError();
    }

    // 5. Check if account is locked
    if (user.lockedUntil !== null) {
      if (user.lockedUntil > new Date()) {
        throw new AccountLockedError();
      }
      // Lock has expired — reset counter and treat as fresh
      await this.userRepo.resetFailedLoginAttempts(user.id);
    }

    // 6. Password check
    const passwordMatches = await this.bcryptService.compare(input.password, user.passwordHash);

    // 7. Wrong password
    if (!passwordMatches) {
      const result = await this.userRepo.incrementFailedLoginAttempts(
        user.id,
        this.config.lockThreshold,
        this.config.lockDurationMs,
      );
      await this.logEvent(user.id, AuthEvent.LOGIN_FAILURE, input);

      // Log ACCOUNT_LOCKED event if the failed attempt triggered a lock
      if (result.lockedUntil !== null) {
        await this.logEvent(user.id, AuthEvent.ACCOUNT_LOCKED, input);
      }

      throw new InvalidCredentialsError();
    }

    // 8. Password correct — reset failed login counter
    await this.userRepo.resetFailedLoginAttempts(user.id);

    // 9. Generate refresh token (raw = client-facing, hash = stored)
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.refreshTokenExpiresInMs);

    // 10. Store refresh token in DB using its hash
    await this.authTokenRepo.create({
      tokenHash,
      userId: user.id,
      expiresAt,
      deviceInfo: input.userAgent ?? undefined,
    });

    // 11. Sign access token
    const accessToken = this.jwtService.signAccessToken({ sub: user.id, role: user.role });

    // 12. Log successful login
    await this.logEvent(user.id, AuthEvent.LOGIN_SUCCESS, input);

    // 13. Return output with raw token (not the hash) for the client
    return {
      accessToken,
      refreshToken: rawToken,
      expiresIn: this.config.jwtExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Convenience helper to avoid repeating event log creation calls.
   */
  private async logEvent(
    userId: string | null,
    event: AuthEvent,
    input: Pick<LoginInput, 'ipAddress' | 'userAgent'>,
  ): Promise<void> {
    await this.authEventLogRepo.create({
      userId,
      event,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}
