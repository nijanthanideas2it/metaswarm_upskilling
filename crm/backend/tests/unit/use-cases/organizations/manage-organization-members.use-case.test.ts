import { Role } from '../../../../src/domain/enums';
import {
  CustomerNotFoundError,
  ForbiddenError,
  OrganizationNotFoundError,
} from '../../../../src/domain/errors/domain.error';
import {
  ManageOrganizationMembersUseCase,
  ManageOrganizationMembersInput,
} from '../../../../src/application/use-cases/organizations/manage-organization-members.use-case';
import { createOrganizationEntity, createCustomerEntity } from '../../../helpers/factories';
import {
  createMockOrganizationRepository,
  createMockCustomerRepository,
} from '../../../helpers/mocks';

const org = createOrganizationEntity({ id: 'org-id-1' });
const customer = createCustomerEntity({ id: 'customer-id-1', organizationId: null });

const baseInput: ManageOrganizationMembersInput = {
  organizationId: 'org-id-1',
  customerId: 'customer-id-1',
  action: 'add',
  callerUserId: 'admin-user-id',
  callerRole: Role.ADMIN,
};

describe('ManageOrganizationMembersUseCase', () => {
  let orgRepo: ReturnType<typeof createMockOrganizationRepository>;
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: ManageOrganizationMembersUseCase;

  beforeEach(() => {
    orgRepo = createMockOrganizationRepository();
    customerRepo = createMockCustomerRepository();
    useCase = new ManageOrganizationMembersUseCase(orgRepo, customerRepo);
    orgRepo.findById.mockResolvedValue(org);
    customerRepo.findById.mockResolvedValue(customer);
    customerRepo.updateWithAudit.mockResolvedValue({ ...customer, organizationId: 'org-id-1' });
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

    it('allows ADMIN and SUPPORT_MANAGER', async () => {
      await expect(useCase.execute(baseInput)).resolves.toBeUndefined();
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_MANAGER }))
        .resolves.toBeUndefined();
    });
  });

  describe('not found', () => {
    it('throws OrganizationNotFoundError when org does not exist', async () => {
      orgRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(OrganizationNotFoundError);
    });

    it('throws CustomerNotFoundError when customer does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('add action', () => {
    it('sets customer.organizationId to the org and writes audit entry', async () => {
      await useCase.execute(baseInput);

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        'customer-id-1',
        { organizationId: 'org-id-1' },
        [{ fieldName: 'organizationId', previousValue: null, newValue: 'org-id-1' }],
        'admin-user-id',
      );
    });

    it('is idempotent — no-op when customer is already in this org', async () => {
      customerRepo.findById.mockResolvedValue(
        createCustomerEntity({ organizationId: 'org-id-1' }),
      );

      await useCase.execute(baseInput);

      expect(customerRepo.updateWithAudit).not.toHaveBeenCalled();
    });

    it('moves customer from a previous org (one-org-per-customer invariant)', async () => {
      customerRepo.findById.mockResolvedValue(
        createCustomerEntity({ organizationId: 'other-org-id' }),
      );

      await useCase.execute(baseInput);

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        'customer-id-1',
        { organizationId: 'org-id-1' },
        [{ fieldName: 'organizationId', previousValue: 'other-org-id', newValue: 'org-id-1' }],
        'admin-user-id',
      );
    });
  });

  describe('remove action', () => {
    it('clears customer.organizationId when customer is in this org', async () => {
      customerRepo.findById.mockResolvedValue(
        createCustomerEntity({ organizationId: 'org-id-1' }),
      );
      customerRepo.updateWithAudit.mockResolvedValue({ ...customer, organizationId: null });

      await useCase.execute({ ...baseInput, action: 'remove' });

      expect(customerRepo.updateWithAudit).toHaveBeenCalledWith(
        'customer-id-1',
        { organizationId: null },
        [{ fieldName: 'organizationId', previousValue: 'org-id-1', newValue: null }],
        'admin-user-id',
      );
    });

    it('is idempotent — no-op when customer is not in this org', async () => {
      customerRepo.findById.mockResolvedValue(
        createCustomerEntity({ organizationId: 'other-org-id' }),
      );

      await useCase.execute({ ...baseInput, action: 'remove' });

      expect(customerRepo.updateWithAudit).not.toHaveBeenCalled();
    });
  });
});
