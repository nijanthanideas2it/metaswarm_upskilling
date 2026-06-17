import type { CustomerEntity } from '../../../domain/entities/customer.entity';
import { AccountStatus, Role } from '../../../domain/enums';
import { ForbiddenError } from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type { PagedResult } from '../../../domain/types/pagination.types';

export interface ListCustomersInput {
  page: number;
  pageSize: number;
  status?: AccountStatus;
  sortBy?: 'fullName' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  organizationId?: string;
  callerRole: Role;
}

const MAX_PAGE_SIZE = 100;

export class ListCustomersUseCase {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async execute(input: ListCustomersInput): Promise<PagedResult<CustomerEntity>> {
    if (input.callerRole === Role.CUSTOMER) {
      throw new ForbiddenError();
    }

    return this.customerRepo.list({
      page: input.page,
      pageSize: Math.min(input.pageSize, MAX_PAGE_SIZE),
      status: input.status,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      organizationId: input.organizationId,
    });
  }
}
