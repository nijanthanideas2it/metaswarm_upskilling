import type { OrganizationEntity } from '../../../domain/entities/organization.entity';
import { Role } from '../../../domain/enums';
import {
  CustomerNotFoundError,
  DuplicateOrganizationNameError,
  ForbiddenError,
  OrganizationNotFoundError,
} from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type {
  IOrganizationRepository,
  UpdateOrganizationFields,
} from '../../../domain/repositories/organization.repository.interface';

export interface UpdateOrganizationInput {
  organizationId: string;
  callerRole: Role;
  fields: {
    name?: string;
    emailDomain?: string | null;
    industry?: string | null;
    primaryContactId?: string | null;
  };
}

export class UpdateOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(input: UpdateOrganizationInput): Promise<OrganizationEntity> {
    if (input.callerRole !== Role.ADMIN && input.callerRole !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenError();
    }

    const org = await this.orgRepo.findById(input.organizationId);
    if (!org) throw new OrganizationNotFoundError();

    const updateFields: UpdateOrganizationFields = {};

    if (input.fields.name !== undefined) {
      const trimmed = input.fields.name.trim();
      if (trimmed !== org.name) {
        const duplicate = await this.orgRepo.findByName(trimmed);
        if (duplicate !== null) throw new DuplicateOrganizationNameError();
        updateFields.name = trimmed;
      }
    }
    if ('emailDomain' in input.fields) updateFields.emailDomain = input.fields.emailDomain ?? null;
    if ('industry' in input.fields) updateFields.industry = input.fields.industry ?? null;
    if ('primaryContactId' in input.fields) {
      if (input.fields.primaryContactId !== null && input.fields.primaryContactId !== undefined) {
        const contact = await this.customerRepo.findById(input.fields.primaryContactId);
        if (!contact) throw new CustomerNotFoundError();
      }
      updateFields.primaryContactId = input.fields.primaryContactId ?? null;
    }

    return this.orgRepo.update(input.organizationId, updateFields);
  }
}
