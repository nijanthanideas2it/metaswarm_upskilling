import type { OrganizationEntity } from '../../../domain/entities/organization.entity';
import { Role } from '../../../domain/enums';
import { ForbiddenError, OrganizationNotFoundError } from '../../../domain/errors/domain.error';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.interface';
import type {
  ITicketSummaryService,
  TicketSummary,
} from '../../../domain/services/ticket-summary.service.interface';

export interface GetOrganizationInput {
  organizationId: string;
  callerRole: Role;
}

export interface GetOrganizationOutput {
  organization: OrganizationEntity;
  ticketSummary: TicketSummary;
}

export class GetOrganizationUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly ticketSummaryService: ITicketSummaryService,
  ) {}

  async execute(input: GetOrganizationInput): Promise<GetOrganizationOutput> {
    if (input.callerRole === Role.CUSTOMER) {
      throw new ForbiddenError();
    }

    const organization = await this.orgRepo.findById(input.organizationId);
    if (!organization) throw new OrganizationNotFoundError();

    const ticketSummary = await this.ticketSummaryService.getForOrganization(organization.id);

    return { organization, ticketSummary };
  }
}
