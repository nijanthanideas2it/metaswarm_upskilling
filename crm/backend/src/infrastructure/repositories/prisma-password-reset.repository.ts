import type { PrismaClient } from '@prisma/client';
import type { PasswordResetTokenEntity } from '../../domain/entities/password-reset-token.entity';
import type { IPasswordResetRepository } from '../../domain/repositories/password-reset.repository.interface';

/**
 * Maps a raw Prisma PasswordResetToken record to the domain PasswordResetTokenEntity.
 * The field shapes are structurally compatible; no enum casting is required here.
 */
function toDomain(record: {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}): PasswordResetTokenEntity {
  return {
    id: record.id,
    tokenHash: record.tokenHash,
    userId: record.userId,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
    createdAt: record.createdAt,
  };
}

export class PrismaPasswordResetRepository implements IPasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<PasswordResetTokenEntity> {
    const record = await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });

    return toDomain(record);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) return null;

    return toDomain(record);
  }

  /**
   * Hard-deletes all unused (usedAt = null) password reset tokens for the user.
   * This prevents token accumulation and ensures only the latest token is valid.
   * The architect review confirmed this must be a hard delete, not a soft revoke.
   */
  async invalidatePreviousTokens(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });
  }

  async markAsUsed(tokenHash: string, usedAt: Date): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt },
    });
  }
}
