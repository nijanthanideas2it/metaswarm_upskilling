import { Role, AccountStatus } from '../../../../src/domain/enums';
import {
  CustomerNotFoundError,
  DuplicateEmailError,
  ForbiddenError,
} from '../../../../src/domain/errors/domain.error';
import {
  UpdateCustomerUseCase,
  UpdateCustomerInput,
} from '../../../../src/application/use-cases/customers/update-customer.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import { createMockCustomerRepository } from '../../../helpers/mocks';

const existing = createCustomerEntity({
  id: 'customer-id-1',
  fullName: 'Alice Smith',
  email: 'alice@example.com',
  phone: null,
  jobTitle: null,
  organizationId: null,
});

const baseInput: UpdateCustomerInput = {
  customerId: 'customer-id-1',
  callerUserId: 'admin-user-id',
  callerRole: Role.ADMIN,
  fields: { fullName: 'Alice Jones' },
};

describe('UpdateCustomerUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: UpdateCustomerUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    useCase = new UpdateCustomerUseCase(customerRepo);
    customerRepo.findById.mockResolvedValue(existing);
    customerRepo.updateWithAudit.mockResolvedValue({ ...existing, fullName: 'Alice Jones' });
  });

  describe('RBAC', () => {
    it('throws ForbiddenError for SUPPORT_AGENT', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_AGENT }))
        .rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for CUSTOMER', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER }))
        .rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when SUPPORT_MANAGER tries to change email', async () => {
      await expect(
        useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_MANAGER, fields: { email: 'new@example.com' } }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows ADMIN to change email', async () => {
      customerRepo.findByEmail.mockResolvedValue(null);
      customerRepo.updateWithAudit.mockResolvedValue({ ...existing, email: 'new@example.com' });
      await expect(
        useCase.execute({ ...baseInput, fields: { email: 'new@example.com' } }),
      ).resolves.toBeDefined();
    });
  });

  describe('not found', () => {
    it('throws CustomerNotFoundError when customer does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('email uniqueness', () => {
    it('throws DuplicateEmailError when the new email belongs to another customer', async () => {
      customerRepo.findByEmail.mockResolvedValue(createCustomerEntity({ id: 'other-id' }));

      await expect(
        useCase.execute({ ...baseInput, fields: { email: 'other@example.com' } }),
      ).rejects.toThrow(DuplicateEmailError);
    });

    it('skips uniqueness check when email is unchanged', async () => {
      await useCase.execute({ ...baseInput, fields: { email: 'alice@example.com' } });

      expect(customerRepo.findByEmail).not.toHaveBeenCalled();
      expect(customerRepo.updateWithAudit).not.toHaveBeenCalled(); // No actual change
    });
  });

  describe('audit trail', () => {
    it('writes an audit entry for each changed field', async () => {
      await useCase.execute(baseInput);

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        'customer-id-1',
        expect.objectContaining({ fullName: 'Alice Jones' }),
        [{ fieldName: 'fullName', previousValue: 'Alice Smith', newValue: 'Alice Jones' }],
        'admin-user-id',
      );
    });

    it('returns current entity unchanged when no fields differ', async () => {
      const result = await useCase.execute({ ...baseInput, fields: { fullName: 'Alice Smith' } });

      expect(customerRepo.updateWithAudit).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('records phone change from null to a value', async () => {
      customerRepo.updateWithAudit.mockResolvedValue({ ...existing, phone: '+1-555-0100' });

      await useCase.execute({ ...baseInput, fields: { phone: '+1-555-0100' } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ phone: '+1-555-0100' }),
        [{ fieldName: 'phone', previousValue: null, newValue: '+1-555-0100' }],
        expect.any(String),
      );
    });

    it('clears phone when set to null', async () => {
      customerRepo.findById.mockResolvedValue({ ...existing, phone: '+1-555-0100' });
      customerRepo.updateWithAudit.mockResolvedValue({ ...existing, phone: null });

      await useCase.execute({ ...baseInput, fields: { phone: null } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ phone: null }),
        [{ fieldName: 'phone', previousValue: '+1-555-0100', newValue: null }],
        expect.any(String),
      );
    });

    it('records jobTitle change', async () => {
      customerRepo.findById.mockResolvedValue({ ...existing, jobTitle: 'Engineer' });
      customerRepo.updateWithAudit.mockResolvedValue({ ...existing, jobTitle: 'Senior Engineer' });

      await useCase.execute({ ...baseInput, fields: { jobTitle: 'Senior Engineer' } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ jobTitle: 'Senior Engineer' }),
        [{ fieldName: 'jobTitle', previousValue: 'Engineer', newValue: 'Senior Engineer' }],
        expect.any(String),
      );
    });

    it('clears jobTitle when set to null', async () => {
      customerRepo.findById.mockResolvedValue({ ...existing, jobTitle: 'Engineer' });
      customerRepo.updateWithAudit.mockResolvedValue({ ...existing, jobTitle: null });

      await useCase.execute({ ...baseInput, fields: { jobTitle: null } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ jobTitle: null }),
        [{ fieldName: 'jobTitle', previousValue: 'Engineer', newValue: null }],
        expect.any(String),
      );
    });
  });
});
