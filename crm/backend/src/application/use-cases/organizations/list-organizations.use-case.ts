import type { OrganizationEntity } from '../../../domain/entities/organization.entity';
import { Role } from '../../../domain/enums';
import { ForbiddenError } from '../../../domain/errors/domain.error';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.interface';
import type { PagedResult } from '../../../domain/types/pagination.types';

export interface ListOrganizationsInput {
  page: number;
  pageSize: number;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  callerRole: Role;
}

const MAX_PAGE_SIZE = 100;

export class ListOrganizationsUseCase {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  async execute(input: ListOrganizationsInput): Promise<PagedResult<OrganizationEntity>> {
    if (input.callerRole === Role.CUSTOMER) {
      throw new ForbiddenError();
    }

    return this.orgRepo.list({
      page: input.page,
      pageSize: Math.min(input.pageSize, MAX_PAGE_SIZE),
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
  }
}
