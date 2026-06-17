import { Role } from '../../../../src/domain/enums';
import {
  CustomerNotFoundError,
  DuplicateOrganizationNameError,
  ForbiddenError,
} from '../../../../src/domain/errors/domain.error';
import {
  CreateOrganizationUseCase,
  CreateOrganizationInput,
} from '../../../../src/application/use-cases/organizations/create-organization.use-case';
import { createOrganizationEntity, createCustomerEntity } from '../../../helpers/factories';
import {
  createMockOrganizationRepository,
  createMockCustomerRepository,
} from '../../../helpers/mocks';

const org = createOrganizationEntity();

const baseInput: CreateOrganizationInput = {
  name: 'Test Corp',
  callerRole: Role.ADMIN,
};

describe('CreateOrganizationUseCase', () => {
  let orgRepo: ReturnType<typeof createMockOrganizationRepository>;
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: CreateOrganizationUseCase;

  beforeEach(() => {
    orgRepo = createMockOrganizationRepository();
    customerRepo = createMockCustomerRepository();
    useCase = new CreateOrganizationUseCase(orgRepo, customerRepo);
    orgRepo.findByName.mockResolvedValue(null);
    orgRepo.create.mockResolvedValue(org);
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

    it('allows ADMIN', async () => {
      await expect(useCase.execute(baseInput)).resolves.toBeDefined();
    });

    it('allows SUPPORT_MANAGER', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_MANAGER }))
        .resolves.toBeDefined();
    });
  });

  describe('name uniqueness', () => {
    it('throws DuplicateOrganizationNameError when name already exists', async () => {
      orgRepo.findByName.mockResolvedValue(org);

      await expect(useCase.execute(baseInput)).rejects.toThrow(DuplicateOrganizationNameError);
      expect(orgRepo.create).not.toHaveBeenCalled();
    });

    it('trims name before checking uniqueness', async () => {
      await useCase.execute({ ...baseInput, name: '  Test Corp  ' });

      expect(orgRepo.findByName).toHaveBeenCalledWith('Test Corp');
    });
  });

  describe('primaryContactId validation', () => {
    it('throws CustomerNotFoundError when primaryContactId does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute({ ...baseInput, primaryContactId: 'unknown-id' }))
        .rejects.toThrow(CustomerNotFoundError);
    });

    it('validates primaryContact exists when provided', async () => {
      customerRepo.findById.mockResolvedValue(createCustomerEntity());

      await expect(useCase.execute({ ...baseInput, primaryContactId: 'customer-id-1' }))
        .resolves.toBeDefined();
    });

    it('skips customer lookup when no primaryContactId', async () => {
      await useCase.execute(baseInput);

      expect(customerRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('successful creation', () => {
    it('returns the created OrganizationEntity', async () => {
      const result = await useCase.execute(baseInput);
      expect(result).toBe(org);
    });

    it('passes all optional fields to the repository', async () => {
      customerRepo.findById.mockResolvedValue(createCustomerEntity());

      await useCase.execute({
        ...baseInput,
        emailDomain: 'acme.com',
        industry: 'Technology',
        primaryContactId: 'customer-id-1',
      });

      expect(orgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          emailDomain: 'acme.com',
          industry: 'Technology',
          primaryContactId: 'customer-id-1',
        }),
      );
    });
  });
});
