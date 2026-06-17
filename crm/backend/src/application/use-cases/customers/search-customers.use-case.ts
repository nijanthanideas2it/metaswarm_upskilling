import type { CustomerEntity } from '../../../domain/entities/customer.entity';
import { Role } from '../../../domain/enums';
import {
  CustomerSearchQueryTooShortError,
  ForbiddenError,
} from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type { PagedResult } from '../../../domain/types/pagination.types';

export interface SearchCustomersInput {
  query: string;
  page: number;
  pageSize: number;
  callerRole: Role;
}

const MAX_PAGE_SIZE = 100;
const MIN_QUERY_LENGTH = 2;

export class SearchCustomersUseCase {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async execute(input: SearchCustomersInput): Promise<PagedResult<CustomerEntity>> {
    if (input.callerRole === Role.CUSTOMER) {
      throw new ForbiddenError();
    }

    if (input.query.trim().length < MIN_QUERY_LENGTH) {
      throw new CustomerSearchQueryTooShortError();
    }

    return this.customerRepo.search(input.query.trim(), {
      page: input.page,
      pageSize: Math.min(input.pageSize, MAX_PAGE_SIZE),
    });
  }
}
