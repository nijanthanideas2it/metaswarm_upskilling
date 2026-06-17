import type { OrganizationEntity } from '../../../domain/entities/organization.entity';
import { Role } from '../../../domain/enums';
import {
  CustomerNotFoundError,
  DuplicateOrganizationNameError,
  ForbiddenError,
} from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.interface';

export interface CreateOrganizationInput {
  name: string;
  emailDomain?: string;
  industry?: string;
  primaryContactId?: string;
  callerRole: Role;
}

export class CreateOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(input: CreateOrganizationInput): Promise<OrganizationEntity> {
    if (input.callerRole !== Role.ADMIN && input.callerRole !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenError();
    }

    const existing = await this.orgRepo.findByName(input.name.trim());
    if (existing !== null) throw new DuplicateOrganizationNameError();

    if (input.primaryContactId !== undefined) {
      const contact = await this.customerRepo.findById(input.primaryContactId);
      if (!contact) throw new CustomerNotFoundError();
    }

    return this.orgRepo.create({
      name: input.name,
      emailDomain: input.emailDomain,
      industry: input.industry,
      primaryContactId: input.primaryContactId,
    });
  }
}
