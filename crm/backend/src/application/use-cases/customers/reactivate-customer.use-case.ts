import { AccountStatus, Role } from '../../../domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';

export interface ReactivateCustomerInput {
  customerId: string;
  callerRole: Role;
}

export class ReactivateCustomerUseCase {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async execute(input: ReactivateCustomerInput): Promise<void> {
    if (input.callerRole !== Role.ADMIN) {
      throw new ForbiddenError();
    }

    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new CustomerNotFoundError();

    await this.customerRepo.updateStatus(customer.id, AccountStatus.ACTIVE);
  }
}
