import { Role } from '../../../../src/domain/enums';
import {
  CustomerNotFoundError,
  DuplicateOrganizationNameError,
  ForbiddenError,
  OrganizationNotFoundError,
} from '../../../../src/domain/errors/domain.error';
import {
  UpdateOrganizationUseCase,
  UpdateOrganizationInput,
} from '../../../../src/application/use-cases/organizations/update-organization.use-case';
import { createOrganizationEntity, createCustomerEntity } from '../../../helpers/factories';
import {
  createMockOrganizationRepository,
  createMockCustomerRepository,
} from '../../../helpers/mocks';

const existing = createOrganizationEntity({ id: 'org-id-1', name: 'Test Corp' });

const baseInput: UpdateOrganizationInput = {
  organizationId: 'org-id-1',
  callerRole: Role.ADMIN,
  fields: { name: 'Updated Corp' },
};

describe('UpdateOrganizationUseCase', () => {
  let orgRepo: ReturnType<typeof createMockOrganizationRepository>;
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: UpdateOrganizationUseCase;

  beforeEach(() => {
    orgRepo = createMockOrganizationRepository();
    customerRepo = createMockCustomerRepository();
    useCase = new UpdateOrganizationUseCase(orgRepo, customerRepo);
    orgRepo.findById.mockResolvedValue(existing);
    orgRepo.findByName.mockResolvedValue(null);
    orgRepo.update.mockResolvedValue({ ...existing, name: 'Updated Corp' });
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
  });

  describe('not found', () => {
    it('throws OrganizationNotFoundError when org does not exist', async () => {
      orgRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  describe('name uniqueness', () => {
    it('throws DuplicateOrganizationNameError when new name already exists', async () => {
      orgRepo.findByName.mockResolvedValue(createOrganizationEntity({ id: 'other-id' }));

      await expect(useCase.execute(baseInput)).rejects.toThrow(DuplicateOrganizationNameError);
    });

    it('skips uniqueness check when name is unchanged', async () => {
      await useCase.execute({ ...baseInput, fields: { name: 'Test Corp' } });

      expect(orgRepo.findByName).not.toHaveBeenCalled();
    });
  });

  describe('primaryContactId validation', () => {
    it('throws CustomerNotFoundError when primaryContact does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ ...baseInput, fields: { primaryContactId: 'unknown-id' } }),
      ).rejects.toThrow(CustomerNotFoundError);
    });

    it('allows clearing primaryContactId to null', async () => {
      orgRepo.update.mockResolvedValue({ ...existing, primaryContactId: null });

      await expect(
        useCase.execute({ ...baseInput, fields: { primaryContactId: null } }),
      ).resolves.toBeDefined();
      expect(customerRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('successful update', () => {
    it('returns the updated organization', async () => {
      const result = await useCase.execute(baseInput);
      expect(result.name).toBe('Updated Corp');
    });

    it('passes trimmed name to update', async () => {
      await useCase.execute({ ...baseInput, fields: { name: '  Updated Corp  ' } });

      expect(orgRepo.update).toHaveBeenCalledWith('org-id-1', expect.objectContaining({ name: 'Updated Corp' }));
    });

    it('clears emailDomain when set to null', async () => {
      orgRepo.update.mockResolvedValue({ ...existing, emailDomain: null });

      await useCase.execute({ ...baseInput, fields: { emailDomain: null } });

      expect(orgRepo.update).toHaveBeenCalledWith(
        'org-id-1',
        expect.objectContaining({ emailDomain: null }),
      );
    });
  });
});
