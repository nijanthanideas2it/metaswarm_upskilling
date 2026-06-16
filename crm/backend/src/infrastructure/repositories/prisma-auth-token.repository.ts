import type { PrismaClient } from '@prisma/client';
import type { AuthTokenEntity } from '../../domain/entities/auth-token.entity';
import type { IAuthTokenRepository } from '../../domain/repositories/auth-token.repository.interface';

/**
 * Maps a raw Prisma RefreshToken record to the domain AuthTokenEntity.
 * The field shapes are structurally compatible; no enum casting is required here.
 */
function toDomain(record: {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  deviceInfo: string | null;
  createdAt: Date;
}): AuthTokenEntity {
  return {
    id: record.id,
    tokenHash: record.tokenHash,
    userId: record.userId,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    // Prisma returns string | null; domain accepts string | null | undefined — null satisfies both
    deviceInfo: record.deviceInfo,
    createdAt: record.createdAt,
  };
}

export class PrismaAuthTokenRepository implements IAuthTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    deviceInfo?: string;
  }): Promise<AuthTokenEntity> {
    const record = await this.prisma.refreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        deviceInfo: data.deviceInfo ?? null,
      },
    });

    return toDomain(record);
  }

  async findByTokenHash(tokenHash: string): Promise<AuthTokenEntity | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record) return null;

    return toDomain(record);
  }

  async revoke(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
