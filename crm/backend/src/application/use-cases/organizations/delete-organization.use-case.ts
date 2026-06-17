import { Role } from '../../../domain/enums';
import {
  ForbiddenError,
  OrganizationHasMembersError,
  OrganizationNotFoundError,
} from '../../../domain/errors/domain.error';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.interface';

export interface DeleteOrganizationInput {
  organizationId: string;
  callerRole: Role;
}

export class DeleteOrganizationUseCase {
  constructor(private readonly orgRepo: IOrganizationRepository) {}

  async execute(input: DeleteOrganizationInput): Promise<void> {
    if (input.callerRole !== Role.ADMIN) {
      throw new ForbiddenError();
    }

    const org = await this.orgRepo.findById(input.organizationId);
    if (!org) throw new OrganizationNotFoundError();

    const count = await this.orgRepo.memberCount(input.organizationId);
    if (count > 0) throw new OrganizationHasMembersError();

    await this.orgRepo.delete(input.organizationId);
  }
}
