import type { PrismaClient } from '@prisma/client';
import { PrismaAuthEventLogRepository } from '../../../../src/infrastructure/repositories/prisma-auth-event-log.repository';
import { createAuthEventLogEntity } from '../../../helpers/factories';
import { AuthEvent } from '../../../../src/domain/enums';

function buildMockPrisma() {
  return {
    authEventLog: {
      create: jest.fn(),
    },
  } as unknown as PrismaClient;
}

describe('PrismaAuthEventLogRepository', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let repo: PrismaAuthEventLogRepository;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new PrismaAuthEventLogRepository(mockPrisma);
  });

  describe('create', () => {
    it('calls prisma.authEventLog.create with the provided data and returns mapped entity', async () => {
      const expected = createAuthEventLogEntity();

      (mockPrisma.authEventLog.create as jest.Mock).mockResolvedValue(expected);

      const result = await repo.create({
        userId: expected.userId,
        event: expected.event,
        ipAddress: expected.ipAddress,
        userAgent: expected.userAgent,
      });

      expect(mockPrisma.authEventLog.create).toHaveBeenCalledWith({
        data: {
          userId: expected.userId,
          event: expected.event,
          ipAddress: expected.ipAddress,
          userAgent: expected.userAgent,
        },
      });
      expect(result).toEqual(expected);
    });

    it('handles null userId, ipAddress, and userAgent', async () => {
      const expected = createAuthEventLogEntity({
        userId: null,
        ipAddress: null,
        userAgent: null,
      });

      (mockPrisma.authEventLog.create as jest.Mock).mockResolvedValue(expected);

      const result = await repo.create({
        userId: null,
        event: AuthEvent.LOGIN_FAILURE,
        ipAddress: null,
        userAgent: null,
      });

      expect(mockPrisma.authEventLog.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          event: AuthEvent.LOGIN_FAILURE,
          ipAddress: null,
          userAgent: null,
        },
      });
      expect(result).toEqual(expected);
    });

    it('passes all AuthEvent enum values through correctly', async () => {
      const expected = createAuthEventLogEntity({ event: AuthEvent.PASSWORD_RESET_REQUEST });

      (mockPrisma.authEventLog.create as jest.Mock).mockResolvedValue(expected);

      const result = await repo.create({
        userId: 'user-id-1',
        event: AuthEvent.PASSWORD_RESET_REQUEST,
        ipAddress: '10.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.event).toBe(AuthEvent.PASSWORD_RESET_REQUEST);
    });
  });
});
