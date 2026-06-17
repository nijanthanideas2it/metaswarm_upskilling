import type { AccountStatus as PrismaAccountStatus, PrismaClient } from '@prisma/client';
import type { CustomerEntity } from '../../domain/entities/customer.entity';
import { AccountStatus, Role } from '../../domain/enums';
import type {
  CreateCustomerData,
  CustomerAuditChange,
  ICustomerRepository,
  ListCustomersParams,
  UpdateCustomerFields,
} from '../../domain/repositories/customer.repository.interface';
import type { PagedResult } from '../../domain/types/pagination.types';

type CustomerRecord = {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string; role: string; status: string };
};

function toDomain(record: CustomerRecord): CustomerEntity {
  return {
    id: record.id,
    userId: record.userId,
    fullName: record.fullName,
    phone: record.phone,
    jobTitle: record.jobTitle,
    organizationId: record.organizationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    email: record.user.email,
    role: record.user.role as unknown as Role,
    status: record.user.status as unknown as AccountStatus,
  };
}

const USER_INCLUDE = { user: { select: { email: true, role: true, status: true } } } as const;

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateCustomerData): Promise<CustomerEntity> {
    const record = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase().trim(),
          passwordHash: data.passwordHash,
          role: data.role,
          status: 'ACTIVE',
        },
      });

      return tx.customer.create({
        data: {
          userId: user.id,
          fullName: data.fullName.trim(),
          phone: data.phone ?? null,
          jobTitle: data.jobTitle ?? null,
          organizationId: data.organizationId ?? null,
        },
        include: USER_INCLUDE,
      });
    });

    return toDomain(record as CustomerRecord);
  }

  async findById(id: string): Promise<CustomerEntity | null> {
    const record = await this.prisma.customer.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });
    if (!record) return null;
    return toDomain(record as CustomerRecord);
  }

  async findByUserId(userId: string): Promise<CustomerEntity | null> {
    const record = await this.prisma.customer.findUnique({
      where: { userId },
      include: USER_INCLUDE,
    });
    if (!record) return null;
    return toDomain(record as CustomerRecord);
  }

  async findByEmail(email: string): Promise<CustomerEntity | null> {
    const record = await this.prisma.customer.findFirst({
      where: { user: { email: email.toLowerCase().trim() } },
      include: USER_INCLUDE,
    });
    if (!record) return null;
    return toDomain(record as CustomerRecord);
  }

  async list(params: ListCustomersParams): Promise<PagedResult<CustomerEntity>> {
    const { page, pageSize, status, sortBy = 'fullName', sortOrder = 'asc', organizationId } = params;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) where['user'] = { status };
    if (organizationId !== undefined) where['organizationId'] = organizationId;

    const orderBy =
      sortBy === 'email'
        ? { user: { email: sortOrder } }
        : sortBy === 'createdAt'
          ? { createdAt: sortOrder }
          : { fullName: sortOrder };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: USER_INCLUDE,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: items.map((r) => toDomain(r as CustomerRecord)), total, page, pageSize };
  }

  async search(
    query: string,
    params: { page: number; pageSize: number },
  ): Promise<PagedResult<CustomerEntity>> {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;

    const where = {
      OR: [
        { fullName: { contains: query, mode: 'insensitive' as const } },
        { user: { email: { contains: query, mode: 'insensitive' as const } } },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: USER_INCLUDE,
        orderBy: { fullName: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: items.map((r) => toDomain(r as CustomerRecord)), total, page, pageSize };
  }

  async updateWithAudit(
    id: string,
    fields: UpdateCustomerFields,
    auditChanges: CustomerAuditChange[],
    changedById: string,
  ): Promise<CustomerEntity> {
    const record = await this.prisma.$transaction(async (tx) => {
      if (fields.email !== undefined) {
        const link = await tx.customer.findUnique({ where: { id }, select: { userId: true } });
        if (link) {
          await tx.user.update({
            where: { id: link.userId },
            data: { email: fields.email.toLowerCase().trim() },
          });
        }
      }

      const customerData: {
        fullName?: string;
        phone?: string | null;
        jobTitle?: string | null;
        organizationId?: string | null;
      } = {};
      if (fields.fullName !== undefined) customerData.fullName = fields.fullName.trim();
      if ('phone' in fields) customerData.phone = fields.phone ?? null;
      if ('jobTitle' in fields) customerData.jobTitle = fields.jobTitle ?? null;
      if ('organizationId' in fields) customerData.organizationId = fields.organizationId ?? null;

      if (auditChanges.length > 0) {
        await tx.customerProfileAuditEntry.createMany({
          data: auditChanges.map((c) => ({
            customerId: id,
            fieldName: c.fieldName,
            previousValue: c.previousValue,
            newValue: c.newValue,
            changedById,
          })),
        });
      }

      return tx.customer.update({
        where: { id },
        data: customerData,
        include: USER_INCLUDE,
      });
    });

    return toDomain(record as CustomerRecord);
  }

  async updateStatus(id: string, status: AccountStatus): Promise<void> {
    const link = await this.prisma.customer.findUnique({ where: { id }, select: { userId: true } });
    if (!link) return;
    await this.prisma.user.update({
      where: { id: link.userId },
      data: { status: status as unknown as PrismaAccountStatus },
    });
  }
}
