import { AuthTokenEntity } from '../entities/auth-token.entity';

export interface IAuthTokenRepository {
  create(data: { tokenHash: string; userId: string; expiresAt: Date; deviceInfo?: string }): Promise<AuthTokenEntity>;
  findByTokenHash(tokenHash: string): Promise<AuthTokenEntity | null>;
  revoke(tokenHash: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
