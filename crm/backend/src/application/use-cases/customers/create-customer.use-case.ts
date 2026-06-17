import { randomBytes } from 'crypto';
import type { CustomerEntity } from '../../../domain/entities/customer.entity';
import { Role } from '../../../domain/enums';
import { DuplicateEmailError, ForbiddenError } from '../../../domain/errors/domain.error';
import type { ICustomerRepository } from '../../../domain/repositories/customer.repository.interface';
import type { IUserInvitationService } from '../../../domain/services/user-invitation.service.interface';
import type { IBcryptService } from '../../ports/bcrypt.port';

export interface CreateCustomerInput {
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  organizationId?: string;
  callerRole: Role;
}

export class CreateCustomerUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly bcryptService: IBcryptService,
    private readonly userInvitationService: IUserInvitationService,
  ) {}

  async execute(input: CreateCustomerInput): Promise<CustomerEntity> {
    if (input.callerRole !== Role.ADMIN && input.callerRole !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenError();
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await this.customerRepo.findByEmail(normalizedEmail);
    if (existing !== null) {
      throw new DuplicateEmailError();
    }

    const passwordHash = await this.bcryptService.hash(randomBytes(32).toString('hex'));

    const customer = await this.customerRepo.create({
      email: normalizedEmail,
      passwordHash,
      role: Role.CUSTOMER,
      fullName: input.fullName,
      phone: input.phone,
      jobTitle: input.jobTitle,
      organizationId: input.organizationId,
    });

    await this.userInvitationService.sendInvitation(customer.userId, customer.email);

    return customer;
  }
}
