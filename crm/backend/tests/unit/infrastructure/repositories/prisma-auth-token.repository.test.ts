import type { PrismaClient } from '@prisma/client';
import { PrismaAuthTokenRepository } from '../../../../src/infrastructure/repositories/prisma-auth-token.repository';
import { createAuthTokenEntity } from '../../../helpers/factories';

function buildMockPrisma() {
  return {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaClient;
}

describe('PrismaAuthTokenRepository', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let repo: PrismaAuthTokenRepository;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new PrismaAuthTokenRepository(mockPrisma);
  });

  describe('create', () => {
    it('calls prisma.refreshToken.create and returns mapped AuthTokenEntity', async () => {
      const expected = createAuthTokenEntity();

      (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue(expected);

      const result = await repo.create({
        tokenHash: expected.tokenHash,
        userId: expected.userId,
        expiresAt: expected.expiresAt,
      });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: expected.tokenHash,
          userId: expected.userId,
          expiresAt: expected.expiresAt,
          deviceInfo: null,
        },
      });
      expect(result).toEqual(expected);
    });

    it('passes deviceInfo when provided', async () => {
      const expected = createAuthTokenEntity({ deviceInfo: 'Mozilla/5.0' });

      (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue(expected);

      await repo.create({
        tokenHash: expected.tokenHash,
        userId: expected.userId,
        expiresAt: expected.expiresAt,
        deviceInfo: 'Mozilla/5.0',
      });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: expected.tokenHash,
          userId: expected.userId,
          expiresAt: expected.expiresAt,
          deviceInfo: 'Mozilla/5.0',
        },
      });
    });

    it('uses null for deviceInfo when not provided', async () => {
      const expected = createAuthTokenEntity({ deviceInfo: null });

      (mockPrisma.refreshToken.create as jest.Mock).mockResolvedValue(expected);

      await repo.create({
        tokenHash: expected.tokenHash,
        userId: expected.userId,
        expiresAt: expected.expiresAt,
        // deviceInfo intentionally omitted
      });

      const callArgs = (mockPrisma.refreshToken.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.deviceInfo).toBeNull();
    });
  });

  describe('findByTokenHash', () => {
    it('returns mapped AuthTokenEntity when found', async () => {
      const expected = createAuthTokenEntity();

      (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(expected);

      const result = await repo.findByTokenHash('hashed-refresh-token');

      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-refresh-token' },
      });
      expect(result).toEqual(expected);
    });

    it('returns null when token is not found', async () => {
      (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repo.findByTokenHash('nonexistent-hash');

      expect(result).toBeNull();
    });

    it('returns entity with revokedAt populated when token was revoked', async () => {
      const revokedAt = new Date('2026-01-02T00:00:00.000Z');
      const expected = createAuthTokenEntity({ revokedAt });

      (mockPrisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(expected);

      const result = await repo.findByTokenHash('hashed-refresh-token');

      expect(result?.revokedAt).toEqual(revokedAt);
    });
  });

  describe('revoke', () => {
    it('calls prisma.refreshToken.update with revokedAt', async () => {
      const revokedAt = new Date('2026-01-02T00:00:00.000Z');
      (mockPrisma.refreshToken.update as jest.Mock).mockResolvedValue({});

      await repo.revoke('hashed-refresh-token', revokedAt);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-refresh-token' },
        data: { revokedAt },
      });
    });

    it('returns void', async () => {
      (mockPrisma.refreshToken.update as jest.Mock).mockResolvedValue({});

      const result = await repo.revoke('hashed-refresh-token', new Date());

      expect(result).toBeUndefined();
    });
  });

  describe('revokeAllForUser', () => {
    it('calls prisma.refreshToken.updateMany for non-revoked tokens of a user', async () => {
      (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      const before = new Date();
      await repo.revokeAllForUser('user-id-1');
      const after = new Date();

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
      const callArgs = (mockPrisma.refreshToken.updateMany as jest.Mock).mock.calls[0][0];

      expect(callArgs.where).toEqual({ userId: 'user-id-1', revokedAt: null });
      expect(callArgs.data.revokedAt).toBeInstanceOf(Date);
      expect(callArgs.data.revokedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(callArgs.data.revokedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('returns void', async () => {
      (mockPrisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await repo.revokeAllForUser('user-id-1');

      expect(result).toBeUndefined();
    });
  });
});
