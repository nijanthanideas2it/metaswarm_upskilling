import { Role } from '../../../domain/enums';
import {
  CustomerNotFoundError,
  ForbiddenError,
  OrganizationNotFoundError,
} from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.interface';

export type MemberAction = 'add' | 'remove';

export interface ManageOrganizationMembersInput {
  organizationId: string;
  customerId: string;
  action: MemberAction;
  callerUserId: string;
  callerRole: Role;
}

export class ManageOrganizationMembersUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(input: ManageOrganizationMembersInput): Promise<void> {
    if (input.callerRole !== Role.ADMIN && input.callerRole !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenError();
    }

    const org = await this.orgRepo.findById(input.organizationId);
    if (!org) throw new OrganizationNotFoundError();

    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new CustomerNotFoundError();

    if (input.action === 'add') {
      if (customer.organizationId === input.organizationId) return;

      await this.customerRepo.updateWithAudit(
        customer.id,
        { organizationId: input.organizationId },
        [{ fieldName: 'organizationId', previousValue: customer.organizationId, newValue: input.organizationId }],
        input.callerUserId,
      );
    } else {
      if (customer.organizationId !== input.organizationId) return;

      await this.customerRepo.updateWithAudit(
        customer.id,
        { organizationId: null },
        [{ fieldName: 'organizationId', previousValue: input.organizationId, newValue: null }],
        input.callerUserId,
      );
    }
  }
}
