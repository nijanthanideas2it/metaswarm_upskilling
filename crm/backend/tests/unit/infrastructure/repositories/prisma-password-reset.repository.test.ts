import type { PrismaClient } from '@prisma/client';
import { PrismaPasswordResetRepository } from '../../../../src/infrastructure/repositories/prisma-password-reset.repository';
import { createPasswordResetTokenEntity } from '../../../helpers/factories';

function buildMockPrisma() {
  return {
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaClient;
}

describe('PrismaPasswordResetRepository', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let repo: PrismaPasswordResetRepository;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new PrismaPasswordResetRepository(mockPrisma);
  });

  describe('create', () => {
    it('calls prisma.passwordResetToken.create and returns mapped entity', async () => {
      const expected = createPasswordResetTokenEntity();

      (mockPrisma.passwordResetToken.create as jest.Mock).mockResolvedValue(expected);

      const result = await repo.create({
        tokenHash: expected.tokenHash,
        userId: expected.userId,
        expiresAt: expected.expiresAt,
      });

      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: expected.tokenHash,
          userId: expected.userId,
          expiresAt: expected.expiresAt,
        },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findByTokenHash', () => {
    it('returns mapped PasswordResetTokenEntity when found', async () => {
      const expected = createPasswordResetTokenEntity();

      (mockPrisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(expected);

      const result = await repo.findByTokenHash('hashed-reset-token');

      expect(mockPrisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-reset-token' },
      });
      expect(result).toEqual(expected);
    });

    it('returns null when token is not found', async () => {
      (mockPrisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repo.findByTokenHash('nonexistent-hash');

      expect(result).toBeNull();
    });

    it('returns entity with usedAt populated when token was already used', async () => {
      const usedAt = new Date('2026-01-02T00:00:00.000Z');
      const expected = createPasswordResetTokenEntity({ usedAt });

      (mockPrisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(expected);

      const result = await repo.findByTokenHash('hashed-reset-token');

      expect(result?.usedAt).toEqual(usedAt);
    });
  });

  describe('invalidatePreviousTokens', () => {
    it('hard-deletes unused tokens for the user', async () => {
      (mockPrisma.passwordResetToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await repo.invalidatePreviousTokens('user-id-1');

      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-1', usedAt: null },
      });
    });

    it('returns void', async () => {
      (mockPrisma.passwordResetToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await repo.invalidatePreviousTokens('user-id-1');

      expect(result).toBeUndefined();
    });

    it('does not call update — uses deleteMany (hard delete, not soft revoke)', async () => {
      (mockPrisma.passwordResetToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      await repo.invalidatePreviousTokens('user-id-1');

      expect(mockPrisma.passwordResetToken.update).not.toHaveBeenCalled();
    });
  });

  describe('markAsUsed', () => {
    it('calls prisma.passwordResetToken.update with usedAt', async () => {
      const usedAt = new Date('2026-01-02T00:00:00.000Z');
      (mockPrisma.passwordResetToken.update as jest.Mock).mockResolvedValue({});

      await repo.markAsUsed('hashed-reset-token', usedAt);

      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-reset-token' },
        data: { usedAt },
      });
    });

    it('returns void', async () => {
      (mockPrisma.passwordResetToken.update as jest.Mock).mockResolvedValue({});

      const result = await repo.markAsUsed('hashed-reset-token', new Date());

      expect(result).toBeUndefined();
    });
  });
});
