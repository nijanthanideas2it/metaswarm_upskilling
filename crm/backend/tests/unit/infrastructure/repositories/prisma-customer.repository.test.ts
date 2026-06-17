import type { PrismaClient } from '@prisma/client';
import { PrismaCustomerRepository } from '../../../../src/infrastructure/repositories/prisma-customer.repository';
import { AccountStatus, Role } from '../../../../src/domain/enums';
import { createCustomerEntity } from '../../../helpers/factories';

// Helper: build the Prisma record shape (customer + nested user)
function toDbRecord(entity: ReturnType<typeof createCustomerEntity>) {
  return {
    id: entity.id,
    userId: entity.userId,
    fullName: entity.fullName,
    phone: entity.phone,
    jobTitle: entity.jobTitle,
    organizationId: entity.organizationId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    user: { email: entity.email, role: entity.role, status: entity.status },
  };
}

function buildMockPrisma() {
  const mockTx = {
    user: { create: jest.fn(), update: jest.fn() },
    customer: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    customerProfileAuditEntry: { createMany: jest.fn() },
  };

  return {
    customer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    user: { create: jest.fn(), update: jest.fn() },
    customerProfileAuditEntry: { createMany: jest.fn() },
    $transaction: jest.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    _mockTx: mockTx,
  } as unknown as PrismaClient & { _mockTx: typeof mockTx };
}

describe('PrismaCustomerRepository', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>;
  let repo: PrismaCustomerRepository;
  const customer = createCustomerEntity();
  const dbRecord = toDbRecord(customer);

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new PrismaCustomerRepository(mockPrisma as unknown as PrismaClient);
  });

  describe('create', () => {
    it('creates User and Customer in a transaction and returns mapped entity', async () => {
      (mockPrisma['_mockTx'].user.create as jest.Mock).mockResolvedValue({ id: customer.userId });
      (mockPrisma['_mockTx'].customer.create as jest.Mock).mockResolvedValue(dbRecord);

      const result = await repo.create({
        email: customer.email,
        passwordHash: '$2b$12$hash',
        role: Role.CUSTOMER,
        fullName: customer.fullName,
      });

      expect(result.email).toBe(customer.email);
      expect(result.role).toBe(Role.CUSTOMER);
      expect(result.fullName).toBe(customer.fullName);
      expect(result.status).toBe(AccountStatus.ACTIVE);
    });
  });

  describe('findById', () => {
    it('returns mapped CustomerEntity when found', async () => {
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(dbRecord);

      const result = await repo.findById('customer-id-1');

      expect(mockPrisma.customer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'customer-id-1' } }),
      );
      expect(result).toMatchObject({ id: customer.id, email: customer.email });
    });

    it('returns null when not found', async () => {
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      expect(await repo.findById('nonexistent')).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('returns CustomerEntity for the given userId', async () => {
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(dbRecord);

      const result = await repo.findByUserId('user-id-1');

      expect(mockPrisma.customer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-id-1' } }),
      );
      expect(result?.userId).toBe('user-id-1');
    });
  });

  describe('findByEmail', () => {
    it('lowercases and trims the email before lookup', async () => {
      (mockPrisma.customer.findFirst as jest.Mock).mockResolvedValue(dbRecord);

      await repo.findByEmail('  CUSTOMER@EXAMPLE.COM  ');

      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { email: 'customer@example.com' } },
        }),
      );
    });

    it('returns null when email is not found', async () => {
      (mockPrisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      expect(await repo.findByEmail('unknown@example.com')).toBeNull();
    });
  });

  describe('list', () => {
    it('returns paginated results with correct meta', async () => {
      (mockPrisma.customer.findMany as jest.Mock).mockResolvedValue([dbRecord]);
      (mockPrisma.customer.count as jest.Mock).mockResolvedValue(1);

      const result = await repo.list({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.email).toBe(customer.email);
    });

    it('filters by status when provided', async () => {
      (mockPrisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.customer.count as jest.Mock).mockResolvedValue(0);

      await repo.list({ page: 1, pageSize: 20, status: AccountStatus.DEACTIVATED });

      const callWhere = (mockPrisma.customer.findMany as jest.Mock).mock.calls[0][0].where;
      expect(callWhere).toMatchObject({ user: { status: AccountStatus.DEACTIVATED } });
    });

    it('calculates correct skip offset for page 2', async () => {
      (mockPrisma.customer.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.customer.count as jest.Mock).mockResolvedValue(0);

      await repo.list({ page: 2, pageSize: 10 });

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('search', () => {
    it('uses insensitive contains on fullName and email', async () => {
      (mockPrisma.customer.findMany as jest.Mock).mockResolvedValue([dbRecord]);
      (mockPrisma.customer.count as jest.Mock).mockResolvedValue(1);

      const result = await repo.search('test', { page: 1, pageSize: 20 });

      const callWhere = (mockPrisma.customer.findMany as jest.Mock).mock.calls[0][0].where;
      expect(callWhere.OR).toHaveLength(2);
      expect(callWhere.OR[0]).toMatchObject({ fullName: { contains: 'test', mode: 'insensitive' } });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('updateWithAudit', () => {
    it('writes audit entries and updates customer in a transaction', async () => {
      (mockPrisma['_mockTx'].customer.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma['_mockTx'].customerProfileAuditEntry.createMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma['_mockTx'].customer.update as jest.Mock).mockResolvedValue(dbRecord);

      const result = await repo.updateWithAudit(
        'customer-id-1',
        { fullName: 'New Name' },
        [{ fieldName: 'fullName', previousValue: 'Old Name', newValue: 'New Name' }],
        'editor-id',
      );

      expect(mockPrisma['_mockTx'].customerProfileAuditEntry.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            customerId: 'customer-id-1',
            fieldName: 'fullName',
            changedById: 'editor-id',
          }),
        ],
      });
      expect(mockPrisma['_mockTx'].customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'customer-id-1' },
          data: { fullName: 'New Name' },
        }),
      );
      expect(result.id).toBe(customer.id);
    });

    it('updates User email when email field is provided', async () => {
      (mockPrisma['_mockTx'].customer.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-id-1',
      });
      (mockPrisma['_mockTx'].user.update as jest.Mock).mockResolvedValue({});
      (mockPrisma['_mockTx'].customerProfileAuditEntry.createMany as jest.Mock).mockResolvedValue({});
      (mockPrisma['_mockTx'].customer.update as jest.Mock).mockResolvedValue(dbRecord);

      await repo.updateWithAudit(
        'customer-id-1',
        { email: 'new@example.com' },
        [{ fieldName: 'email', previousValue: 'old@example.com', newValue: 'new@example.com' }],
        'admin-id',
      );

      expect(mockPrisma['_mockTx'].user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
        data: { email: 'new@example.com' },
      });
    });
  });

  describe('updateStatus', () => {
    it('updates User.status for the given customer id', async () => {
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-id-1' });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      await repo.updateStatus('customer-id-1', AccountStatus.DEACTIVATED);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
        data: { status: AccountStatus.DEACTIVATED },
      });
    });

    it('does nothing when customer is not found', async () => {
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      await repo.updateStatus('nonexistent', AccountStatus.DEACTIVATED);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
