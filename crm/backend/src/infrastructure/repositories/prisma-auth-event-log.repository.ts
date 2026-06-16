import type { PrismaClient, AuthEvent as PrismaAuthEvent } from '@prisma/client';
import type { AuthEventLogEntity } from '../../domain/entities/auth-event-log.entity';
import type { AuthEvent } from '../../domain/enums';
import type { IAuthEventLogRepository } from '../../domain/repositories/auth-event-log.repository.interface';

export class PrismaAuthEventLogRepository implements IAuthEventLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string | null;
    event: AuthEvent;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<AuthEventLogEntity> {
    const record = await this.prisma.authEventLog.create({
      data: {
        userId: data.userId,
        // Prisma and domain enums share identical string values; cast at the boundary
        event: data.event as unknown as PrismaAuthEvent,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });

    return record as unknown as AuthEventLogEntity;
  }
}
