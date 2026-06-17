import { OrganizationEntity } from '../entities/organization.entity';
import { PagedResult } from '../types/pagination.types';

export interface CreateOrganizationData {
  name: string;
  emailDomain?: string;
  industry?: string;
  primaryContactId?: string;
}

export interface UpdateOrganizationFields {
  name?: string;
  emailDomain?: string | null;
  industry?: string | null;
  primaryContactId?: string | null;
}

export interface ListOrganizationsParams {
  page: number;
  pageSize: number;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IOrganizationRepository {
  create(data: CreateOrganizationData): Promise<OrganizationEntity>;
  findById(id: string): Promise<OrganizationEntity | null>;
  /** Case-insensitive name lookup for uniqueness checks. */
  findByName(name: string): Promise<OrganizationEntity | null>;
  list(params: ListOrganizationsParams): Promise<PagedResult<OrganizationEntity>>;
  update(id: string, fields: UpdateOrganizationFields): Promise<OrganizationEntity>;
  delete(id: string): Promise<void>;
  /** Returns the number of customers currently associated with this organization. */
  memberCount(id: string): Promise<number>;
}
