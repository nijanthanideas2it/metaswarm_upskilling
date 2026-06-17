import type { PrismaClient } from '@prisma/client';
import type { OrganizationEntity } from '../../domain/entities/organization.entity';
import type {
  CreateOrganizationData,
  IOrganizationRepository,
  ListOrganizationsParams,
  UpdateOrganizationFields,
} from '../../domain/repositories/organization.repository.interface';
import type { PagedResult } from '../../domain/types/pagination.types';

function toDomain(record: {
  id: string;
  name: string;
  emailDomain: string | null;
  industry: string | null;
  primaryContactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationEntity {
  return {
    id: record.id,
    name: record.name,
    emailDomain: record.emailDomain,
    industry: record.industry,
    primaryContactId: record.primaryContactId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateOrganizationData): Promise<OrganizationEntity> {
    const record = await this.prisma.organization.create({
      data: {
        name: data.name.trim(),
        emailDomain: data.emailDomain ?? null,
        industry: data.industry ?? null,
        primaryContactId: data.primaryContactId ?? null,
      },
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<OrganizationEntity | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    if (!record) return null;
    return toDomain(record);
  }

  async findByName(name: string): Promise<OrganizationEntity | null> {
    const record = await this.prisma.organization.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (!record) return null;
    return toDomain(record);
  }

  async list(params: ListOrganizationsParams): Promise<PagedResult<OrganizationEntity>> {
    const { page, pageSize, sortBy = 'name', sortOrder = 'asc' } = params;
    const skip = (page - 1) * pageSize;

    const orderBy = sortBy === 'createdAt' ? { createdAt: sortOrder } : { name: sortOrder };

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({ orderBy, skip, take: pageSize }),
      this.prisma.organization.count(),
    ]);

    return { items: items.map(toDomain), total, page, pageSize };
  }

  async update(id: string, fields: UpdateOrganizationFields): Promise<OrganizationEntity> {
    const data: {
      name?: string;
      emailDomain?: string | null;
      industry?: string | null;
      primaryContactId?: string | null;
    } = {};

    if (fields.name !== undefined) data.name = fields.name.trim();
    if ('emailDomain' in fields) data.emailDomain = fields.emailDomain ?? null;
    if ('industry' in fields) data.industry = fields.industry ?? null;
    if ('primaryContactId' in fields) data.primaryContactId = fields.primaryContactId ?? null;

    const record = await this.prisma.organization.update({ where: { id }, data });
    return toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.organization.delete({ where: { id } });
  }

  async memberCount(id: string): Promise<number> {
    return this.prisma.customer.count({ where: { organizationId: id } });
  }
}
