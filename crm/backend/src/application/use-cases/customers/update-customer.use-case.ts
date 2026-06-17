import type { CustomerEntity } from '../../../domain/entities/customer.entity';
import { Role } from '../../../domain/enums';
import {
  CustomerNotFoundError,
  DuplicateEmailError,
  ForbiddenError,
} from '../../../domain/errors/domain.error';
import type {
  CustomerAuditChange,
  ICustomerRepository,
  UpdateCustomerFields,
} from '../../../domain/repositories/customer.repository.interface';

export interface UpdateCustomerInput {
  customerId: string;
  callerUserId: string;
  callerRole: Role;
  fields: {
    fullName?: string;
    phone?: string | null;
    jobTitle?: string | null;
    organizationId?: string | null;
    email?: string;
  };
}

export class UpdateCustomerUseCase {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async execute(input: UpdateCustomerInput): Promise<CustomerEntity> {
    if (input.callerRole !== Role.ADMIN && input.callerRole !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenError();
    }

    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new CustomerNotFoundError();

    if (input.fields.email !== undefined && input.callerRole !== Role.ADMIN) {
      throw new ForbiddenError();
    }

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
    if ('organizationId' in input.fields && input.fields.organizationId !== customer.organizationId) {
      updateFields.organizationId = input.fields.organizationId ?? null;
      auditChanges.push({ fieldName: 'organizationId', previousValue: customer.organizationId, newValue: input.fields.organizationId ?? null });
    }
    if (input.fields.email !== undefined) {
      const normalizedEmail = input.fields.email.toLowerCase().trim();
      if (normalizedEmail !== customer.email) {
        const duplicate = await this.customerRepo.findByEmail(normalizedEmail);
        if (duplicate !== null) throw new DuplicateEmailError();
        updateFields.email = normalizedEmail;
        auditChanges.push({ fieldName: 'email', previousValue: customer.email, newValue: normalizedEmail });
      }
    }

    if (auditChanges.length === 0) return customer;

    return this.customerRepo.updateWithAudit(customer.id, updateFields, auditChanges, input.callerUserId);
  }
}
