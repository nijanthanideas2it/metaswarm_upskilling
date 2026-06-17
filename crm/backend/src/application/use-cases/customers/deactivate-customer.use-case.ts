import { AccountStatus, Role } from '../../../domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../domain/errors/domain.error';
import type { IAuthTokenRepository } from '../../../domain/repositories/auth-token.repository.interface';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';

export interface DeactivateCustomerInput {
  customerId: string;
  callerRole: Role;
}

export class DeactivateCustomerUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly authTokenRepo: IAuthTokenRepository,
  ) {}

  async execute(input: DeactivateCustomerInput): Promise<void> {
    if (input.callerRole !== Role.ADMIN) {
      throw new ForbiddenError();
    }

    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new CustomerNotFoundError();

    await this.customerRepo.updateStatus(customer.id, AccountStatus.DEACTIVATED);
    await this.authTokenRepo.revokeAllForUser(customer.userId);
  }
}
