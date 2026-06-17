import type { CustomerEntity } from '../../../domain/entities/customer.entity';
import { Role } from '../../../domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../domain/errors/domain.error';
import type {
  CustomerAuditChange,
  ICustomerRepository,
  UpdateCustomerFields,
} from '../../../domain/repositories/customer.repository.interface';

export interface UpdateOwnProfileInput {
  callerUserId: string;
  callerRole: Role;
  fields: {
    fullName?: string;
    phone?: string | null;
    jobTitle?: string | null;
  };
}

export class UpdateOwnProfileUseCase {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async execute(input: UpdateOwnProfileInput): Promise<CustomerEntity> {
    if (input.callerRole !== Role.CUSTOMER) {
      throw new ForbiddenError();
    }

    const customer = await this.customerRepo.findByUserId(input.callerUserId);
    if (!customer) throw new CustomerNotFoundError();

    const updateFields: UpdateCustomerFields = {};
    const auditChanges: CustomerAuditChange[] = [];

    if (input.fields.fullName !== undefined) {
      const trimmed = input.fields.fullName.trim();
      if (trimmed !== customer.fullName) {
        updateFields.fullName = trimmed;
        auditChanges.push({ fieldName: 'fullName', previousValue: customer.fullName, newValue: trimmed });
      }
    }
    if ('phone' in input.fields && input.fields.phone !== customer.phone) {
      updateFields.phone = input.fields.phone ?? null;
      auditChanges.push({ fieldName: 'phone', previousValue: customer.phone, newValue: input.fields.phone ?? null });
    }
    if ('jobTitle' in input.fields && input.fields.jobTitle !== customer.jobTitle) {
      updateFields.jobTitle = input.fields.jobTitle ?? null;
      auditChanges.push({ fieldName: 'jobTitle', previousValue: customer.jobTitle, newValue: input.fields.jobTitle ?? null });
    }

    if (auditChanges.length === 0) return customer;

    return this.customerRepo.updateWithAudit(customer.id, updateFields, auditChanges, customer.userId);
  }
}
