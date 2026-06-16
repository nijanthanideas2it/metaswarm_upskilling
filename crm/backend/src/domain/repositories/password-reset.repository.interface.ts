import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';

export interface IPasswordResetRepository {
  create(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<PasswordResetTokenEntity>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null>;
  invalidatePreviousTokens(userId: string): Promise<void>;
  markAsUsed(tokenHash: string, usedAt: Date): Promise<void>;
}
