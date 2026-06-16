import type { PrismaClient, Role as PrismaRole, AccountStatus as PrismaAccountStatus } from '@prisma/client';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { Role, AccountStatus } from '../../domain/enums';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';

/**
 * Maps a raw Prisma user record to the domain UserEntity.
 * Prisma and domain enums have identical string values, so we cast at the boundary.
 */
function toDomain(record: {
  id: string;
  email: string;
  passwordHash: string;
  role: PrismaRole;
  status: PrismaAccountStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): UserEntity {
  return {
    ...record,
    role: record.role as unknown as Role,
    status: record.status as unknown as AccountStatus,
  };
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!record) return null;

    return toDomain(record);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!record) return null;

    return toDomain(record);
  }

  async incrementFailedLoginAttempts(
    userId: string,
    lockThreshold: number,
    lockDurationMs: number,
  ): Promise<{ failedLoginAttempts: number; lockedUntil: Date | null }> {
    return this.prisma.$transaction(async (tx) => {
      // Atomically increment the counter and read back the new value
      const updated = await tx.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true, lockedUntil: true },
      });

      // Lock the account only when the threshold is newly reached
      if (updated.failedLoginAttempts >= lockThreshold && updated.lockedUntil === null) {
        await tx.user.update({
          where: { id: userId },
          data: { lockedUntil: new Date(Date.now() + lockDurationMs) },
        });
      }

      return {
        failedLoginAttempts: updated.failedLoginAttempts,
        lockedUntil: updated.lockedUntil,
      };
    });
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
