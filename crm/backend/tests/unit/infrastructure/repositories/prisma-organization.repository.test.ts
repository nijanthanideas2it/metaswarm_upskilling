import type { PrismaClient } from '@prisma/client';
import { PrismaOrganizationRepository } from '../../../../src/infrastructure/repositories/prisma-organization.repository';
import { createOrganizationEntity } from '../../../helpers/factories';

function buildMockPrisma() {
  return {
    organization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: { count: jest.fn() },
  } as unknown as PrismaClient;
}

describe('PrismaOrganizationRepository', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let repo: PrismaOrganizationRepository;
  const org = createOrganizationEntity();

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new PrismaOrganizationRepository(mockPrisma);
  });

  describe('create', () => {
    it('creates and returns mapped OrganizationEntity', async () => {
      (mockPrisma.organization.create as jest.Mock).mockResolvedValue(org);

      const result = await repo.create({ name: 'Test Corp' });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: { name: 'Test Corp', emailDomain: null, industry: null, primaryContactId: null },
      });
      expect(result.name).toBe('Test Corp');
    });

    it('trims name whitespace', async () => {
      (mockPrisma.organization.create as jest.Mock).mockResolvedValue(org);

      await repo.create({ name: '  Test Corp  ' });

      const callData = (mockPrisma.organization.create as jest.Mock).mock.calls[0][0].data;
      expect(callData.name).toBe('Test Corp');
    });
  });

  describe('findById', () => {
    it('returns mapped entity when found', async () => {
      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue(org);

      const result = await repo.findById('org-id-1');

      expect(result?.id).toBe('org-id-1');
    });

    it('returns null when not found', async () => {
      (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      expect(await repo.findById('nonexistent')).toBeNull();
    });
  });

  describe('findByName', () => {
    it('uses insensitive mode for case-insensitive lookup', async () => {
      (mockPrisma.organization.findFirst as jest.Mock).mockResolvedValue(org);

      await repo.findByName('test corp');

      expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'test corp', mode: 'insensitive' } },
      });
    });

    it('returns null when name is not found', async () => {
      (mockPrisma.organization.findFirst as jest.Mock).mockResolvedValue(null);

      expect(await repo.findByName('Unknown Corp')).toBeNull();
    });
  });

  describe('list', () => {
    it('returns paginated results sorted by name by default', async () => {
      (mockPrisma.organization.findMany as jest.Mock).mockResolvedValue([org]);
      (mockPrisma.organization.count as jest.Mock).mockResolvedValue(1);

      const result = await repo.list({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' }, skip: 0, take: 20 }),
      );
    });
  });

  describe('update', () => {
    it('updates the provided fields and returns mapped entity', async () => {
      (mockPrisma.organization.update as jest.Mock).mockResolvedValue({
        ...org,
        name: 'Updated Corp',
      });

      const result = await repo.update('org-id-1', { name: 'Updated Corp' });

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-id-1' },
        data: { name: 'Updated Corp' },
      });
      expect(result.name).toBe('Updated Corp');
    });

    it('sets nullable fields to null when explicitly nulled', async () => {
      (mockPrisma.organization.update as jest.Mock).mockResolvedValue({ ...org, emailDomain: null });

      await repo.update('org-id-1', { emailDomain: null });

      const callData = (mockPrisma.organization.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.emailDomain).toBeNull();
    });
  });

  describe('delete', () => {
    it('calls prisma.organization.delete with the correct id', async () => {
      (mockPrisma.organization.delete as jest.Mock).mockResolvedValue({});

      await repo.delete('org-id-1');

      expect(mockPrisma.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-id-1' } });
    });
  });

  describe('memberCount', () => {
    it('counts customers with the given organizationId', async () => {
      (mockPrisma.customer.count as jest.Mock).mockResolvedValue(5);

      const count = await repo.memberCount('org-id-1');

      expect(count).toBe(5);
      expect(mockPrisma.customer.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-id-1' },
      });
    });
  });
});
