import type { CustomerEntity } from '../../../domain/entities/customer.entity';
import { Role } from '../../../domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type {
  ITicketSummaryService,
  TicketSummary,
} from '../../../domain/services/ticket-summary.service.interface';

export interface GetCustomerInput {
  customerId: string;
  callerUserId: string;
  callerRole: Role;
}

export interface GetCustomerOutput {
  customer: CustomerEntity;
  ticketSummary: TicketSummary;
}

export class GetCustomerUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly ticketSummaryService: ITicketSummaryService,
  ) {}

  async execute(input: GetCustomerInput): Promise<GetCustomerOutput> {
    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new CustomerNotFoundError();

    if (input.callerRole === Role.CUSTOMER && customer.userId !== input.callerUserId) {
      throw new ForbiddenError();
    }

    const ticketSummary = await this.ticketSummaryService.getForCustomer(customer.id);

    return { customer, ticketSummary };
  }
}
