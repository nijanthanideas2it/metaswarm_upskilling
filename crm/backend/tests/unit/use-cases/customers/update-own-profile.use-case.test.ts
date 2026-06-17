import { Role } from '../../../../src/domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../../src/domain/errors/domain.error';
import {
  UpdateOwnProfileUseCase,
  UpdateOwnProfileInput,
} from '../../../../src/application/use-cases/customers/update-own-profile.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import { createMockCustomerRepository } from '../../../helpers/mocks';

const existing = createCustomerEntity({
  userId: 'user-id-1',
  fullName: 'Alice Smith',
  phone: null,
  jobTitle: null,
});

const baseInput: UpdateOwnProfileInput = {
  callerUserId: 'user-id-1',
  callerRole: Role.CUSTOMER,
  fields: { fullName: 'Alice Jones' },
};

describe('UpdateOwnProfileUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: UpdateOwnProfileUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    useCase = new UpdateOwnProfileUseCase(customerRepo);
    customerRepo.findByUserId.mockResolvedValue(existing);
    customerRepo.updateWithAudit.mockResolvedValue({ ...existing, fullName: 'Alice Jones' });
  });

  describe('RBAC', () => {
    it('throws ForbiddenError for ADMIN', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.ADMIN }))
        .rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for SUPPORT_AGENT', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_AGENT }))
        .rejects.toThrow(ForbiddenError);
    });

    it('allows CUSTOMER role', async () => {
      await expect(useCase.execute(baseInput)).resolves.toBeDefined();
    });
  });

  describe('not found', () => {
    it('throws CustomerNotFoundError when no customer record for the user', async () => {
      customerRepo.findByUserId.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('field restrictions', () => {
    it('ignores changes to email — only fullName/phone/jobTitle are allowed', async () => {
      // UpdateOwnProfileInput does NOT include email field by type
      // This test confirms the use case does not call findByEmail or pass email to update
      await useCase.execute({ ...baseInput, fields: { fullName: 'Alice Jones' } });

      expect(customerRepo.findByEmail).not.toHaveBeenCalled();
      const updateCall = customerRepo.updateWithAudit.mock.calls[0];
      expect(updateCall?.[1]).not.toHaveProperty('email');
    });
  });

  describe('audit trail', () => {
    it('writes a fullName audit entry', async () => {
      await useCase.execute(baseInput);

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        existing.id,
        expect.objectContaining({ fullName: 'Alice Jones' }),
        [{ fieldName: 'fullName', previousValue: 'Alice Smith', newValue: 'Alice Jones' }],
        existing.userId,
      );
    });

    it('uses customer.userId as changedById (customer edits own profile)', async () => {
      await useCase.execute(baseInput);

      const changedById = customerRepo.updateWithAudit.mock.calls[0]?.[3];
      expect(changedById).toBe('user-id-1');
    });

    it('returns unchanged entity when no fields differ', async () => {
      const result = await useCase.execute({ ...baseInput, fields: { fullName: 'Alice Smith' } });

      expect(customerRepo.updateWithAudit).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('clears phone when set to null', async () => {
      customerRepo.findByUserId.mockResolvedValue({ ...existing, phone: '+1-555-0100' });
      customerRepo.updateWithAudit.mockResolvedValue({ ...existing, phone: null });

      await useCase.execute({ ...baseInput, fields: { phone: null } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ phone: null }),
        [{ fieldName: 'phone', previousValue: '+1-555-0100', newValue: null }],
        expect.any(String),
      );
    });

    it('updates phone to a new non-null value', async () => {
      customerRepo.findByUserId.mockResolvedValue({ ...existing, phone: null });
      const updated = { ...existing, phone: '+1-555-9999' };
      customerRepo.updateWithAudit.mockResolvedValue(updated);

      const result = await useCase.execute({ ...baseInput, fields: { phone: '+1-555-9999' } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ phone: '+1-555-9999' }),
        [{ fieldName: 'phone', previousValue: null, newValue: '+1-555-9999' }],
        expect.any(String),
      );
      expect(result.phone).toBe('+1-555-9999');
    });

    it('updates jobTitle to a new value', async () => {
      customerRepo.findByUserId.mockResolvedValue({ ...existing, jobTitle: 'Engineer' });
      const updated = { ...existing, jobTitle: 'Senior Engineer' };
      customerRepo.updateWithAudit.mockResolvedValue(updated);

      const result = await useCase.execute({ ...baseInput, fields: { jobTitle: 'Senior Engineer' } });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ jobTitle: 'Senior Engineer' }),
        [{ fieldName: 'jobTitle', previousValue: 'Engineer', newValue: 'Senior Engineer' }],
        expect.any(String),
      );
      expect(result.jobTitle).toBe('Senior Engineer');
    });

    it('clears jobTitle when set to null', async () => {
      customerRepo.findByUserId.mockResolvedValue({ ...existing, jobTitle: 'Engineer' });
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
