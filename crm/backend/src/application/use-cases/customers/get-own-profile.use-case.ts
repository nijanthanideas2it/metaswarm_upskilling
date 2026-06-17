import { Role } from '../../../domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type {
  ITicketSummaryService,
  TicketSummary,
} from '../../../domain/services/ticket-summary.service.interface';
import type { CustomerEntity } from '../../../domain/entities/customer.entity';

export interface GetOwnProfileInput {
  callerUserId: string;
  callerRole: Role;
}

export interface GetOwnProfileOutput {
  customer: CustomerEntity;
  ticketSummary: TicketSummary;
}

export class GetOwnProfileUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly ticketSummaryService: ITicketSummaryService,
  ) {}

  async execute(input: GetOwnProfileInput): Promise<GetOwnProfileOutput> {
    if (input.callerRole !== Role.CUSTOMER) {
      throw new ForbiddenError();
    }

    const customer = await this.customerRepo.findByUserId(input.callerUserId);
    if (!customer) throw new CustomerNotFoundError();

    const ticketSummary = await this.ticketSummaryService.getForCustomer(customer.id);

    return { customer, ticketSummary };
  }
}
