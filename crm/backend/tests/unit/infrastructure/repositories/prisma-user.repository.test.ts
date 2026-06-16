import type { PrismaClient } from '@prisma/client';
import { PrismaUserRepository } from '../../../../src/infrastructure/repositories/prisma-user.repository';
import { createUserEntity } from '../../../helpers/factories';
import { AccountStatus, Role } from '../../../../src/domain/enums';

function buildMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaClient;
}

describe('PrismaUserRepository', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let repo: PrismaUserRepository;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new PrismaUserRepository(mockPrisma);
  });

  describe('findByEmail', () => {
    it('normalises email to lowercase/trimmed and returns mapped UserEntity when found', async () => {
      const userRecord = createUserEntity();

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(userRecord);

      const result = await repo.findByEmail('  USER@EXAMPLE.COM  ');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(result).toEqual(userRecord);
    });

    it('returns null when user is not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repo.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('maps Prisma role and status enums to domain enums', async () => {
      const record = createUserEntity({ role: Role.ADMIN, status: AccountStatus.DEACTIVATED });

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(record);

      const result = await repo.findByEmail('user@example.com');

      expect(result?.role).toBe(Role.ADMIN);
      expect(result?.status).toBe(AccountStatus.DEACTIVATED);
    });
  });

  describe('findById', () => {
    it('returns mapped UserEntity when found', async () => {
      const userRecord = createUserEntity();

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(userRecord);

      const result = await repo.findById('user-id-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
      });
      expect(result).toEqual(userRecord);
    });

    it('returns null when user is not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repo.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('incrementFailedLoginAttempts', () => {
    it('uses $transaction and returns post-increment state', async () => {
      const postIncrementState = { failedLoginAttempts: 2, lockedUntil: null };

      // $transaction receives a callback — execute it with mockPrisma
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (prisma: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      (mockPrisma.user.update as jest.Mock).mockResolvedValue(postIncrementState);

      const result = await repo.incrementFailedLoginAttempts('user-id-1', 5, 15 * 60 * 1000);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id-1' },
          data: { failedLoginAttempts: { increment: 1 } },
          select: { failedLoginAttempts: true, lockedUntil: true },
        }),
      );
      expect(result).toEqual({ failedLoginAttempts: 2, lockedUntil: null });
    });

    it('sets lockedUntil when failedLoginAttempts reaches lockThreshold and lockedUntil is null', async () => {
      const postIncrementState = { failedLoginAttempts: 5, lockedUntil: null };
      const lockDurationMs = 15 * 60 * 1000;
      const lockThreshold = 5;

      const beforeLock = Date.now();

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (prisma: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );

      // First update call returns count at threshold with no lock yet
      (mockPrisma.user.update as jest.Mock)
        .mockResolvedValueOnce(postIncrementState)
        .mockResolvedValueOnce({
          ...postIncrementState,
          lockedUntil: new Date(beforeLock + lockDurationMs),
        });

      const result = await repo.incrementFailedLoginAttempts('user-id-1', lockThreshold, lockDurationMs);

      const afterLock = Date.now();

      // Two updates should have been called: increment + set lock
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);

      // Second call sets lockedUntil
      const secondCall = (mockPrisma.user.update as jest.Mock).mock.calls[1][0];
      expect(secondCall.where).toEqual({ id: 'user-id-1' });
      expect(secondCall.data.lockedUntil).toBeInstanceOf(Date);
      expect(secondCall.data.lockedUntil.getTime()).toBeGreaterThanOrEqual(beforeLock + lockDurationMs);
      expect(secondCall.data.lockedUntil.getTime()).toBeLessThanOrEqual(afterLock + lockDurationMs);

      expect(result.failedLoginAttempts).toBe(5);
    });

    it('does NOT set lockedUntil when count reaches threshold but lockedUntil is already set', async () => {
      const alreadyLockedUntil = new Date(Date.now() + 60_000);
      const postIncrementState = { failedLoginAttempts: 5, lockedUntil: alreadyLockedUntil };

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (prisma: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      (mockPrisma.user.update as jest.Mock).mockResolvedValue(postIncrementState);

      await repo.incrementFailedLoginAttempts('user-id-1', 5, 15 * 60 * 1000);

      // Only the increment update, no locking update
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('does NOT set lockedUntil when count is below threshold', async () => {
      const postIncrementState = { failedLoginAttempts: 3, lockedUntil: null };

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: (prisma: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      (mockPrisma.user.update as jest.Mock).mockResolvedValue(postIncrementState);

      const result = await repo.incrementFailedLoginAttempts('user-id-1', 5, 15 * 60 * 1000);

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ failedLoginAttempts: 3, lockedUntil: null });
    });
  });

  describe('resetFailedLoginAttempts', () => {
    it('updates user to reset failedLoginAttempts and lockedUntil', async () => {
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      await repo.resetFailedLoginAttempts('user-id-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('returns void', async () => {
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await repo.resetFailedLoginAttempts('user-id-1');

      expect(result).toBeUndefined();
    });
  });

  describe('updatePassword', () => {
    it('updates the user passwordHash', async () => {
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      await repo.updatePassword('user-id-1', 'new-hashed-password');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('returns void', async () => {
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await repo.updatePassword('user-id-1', 'new-hashed-password');

      expect(result).toBeUndefined();
    });
  });
});
