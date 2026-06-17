import { AccountStatus, Role } from '../enums';
import { CustomerEntity } from '../entities/customer.entity';
import { PagedResult } from '../types/pagination.types';

export interface CreateCustomerData {
  email: string;
  /** Bcrypt hash of a random placeholder — customer sets real password via invitation. */
  passwordHash: string;
  role: Role;
  fullName: string;
  phone?: string;
  jobTitle?: string;
  organizationId?: string;
}

export interface UpdateCustomerFields {
  fullName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  organizationId?: string | null;
  /** Admin-only: updates User.email in the same transaction */
  email?: string;
}

export interface CustomerAuditChange {
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
}

export interface ListCustomersParams {
  page: number;
  pageSize: number;
  status?: AccountStatus;
  sortBy?: 'fullName' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  organizationId?: string;
}

export interface ICustomerRepository {
  /**
   * Creates both a User and a Customer record atomically.
   * The new User is assigned a random password hash; login is only possible
   * after the customer accepts their invitation and sets a password.
   */
  create(data: CreateCustomerData): Promise<CustomerEntity>;
  findById(id: string): Promise<CustomerEntity | null>;
  findByUserId(userId: string): Promise<CustomerEntity | null>;
  findByEmail(email: string): Promise<CustomerEntity | null>;
  list(params: ListCustomersParams): Promise<PagedResult<CustomerEntity>>;
  search(
    query: string,
    params: { page: number; pageSize: number },
  ): Promise<PagedResult<CustomerEntity>>;
  /**
   * Updates customer (and optionally User) fields and writes all audit changes
   * in a single Prisma transaction — no update may occur without audit entries.
   */
  updateWithAudit(
    id: string,
    fields: UpdateCustomerFields,
    auditChanges: CustomerAuditChange[],
    changedById: string,
  ): Promise<CustomerEntity>;
  /** Updates User.status for deactivate / reactivate flows. */
  updateStatus(id: string, status: AccountStatus): Promise<void>;
}
