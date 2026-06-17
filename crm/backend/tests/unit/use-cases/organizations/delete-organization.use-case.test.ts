import { Role } from '../../../../src/domain/enums';
import {
  ForbiddenError,
  OrganizationHasMembersError,
  OrganizationNotFoundError,
} from '../../../../src/domain/errors/domain.error';
import {
  DeleteOrganizationUseCase,
  DeleteOrganizationInput,
} from '../../../../src/application/use-cases/organizations/delete-organization.use-case';
import { createOrganizationEntity } from '../../../helpers/factories';
import { createMockOrganizationRepository } from '../../../helpers/mocks';

const org = createOrganizationEntity();

const baseInput: DeleteOrganizationInput = {
  organizationId: 'org-id-1',
  callerRole: Role.ADMIN,
};

describe('DeleteOrganizationUseCase', () => {
  let orgRepo: ReturnType<typeof createMockOrganizationRepository>;
  let useCase: DeleteOrganizationUseCase;

  beforeEach(() => {
    orgRepo = createMockOrganizationRepository();
    useCase = new DeleteOrganizationUseCase(orgRepo);
    orgRepo.findById.mockResolvedValue(org);
    orgRepo.memberCount.mockResolvedValue(0);
    orgRepo.delete.mockResolvedValue(undefined);
  });

  describe('RBAC', () => {
    it('throws ForbiddenError for SUPPORT_MANAGER', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_MANAGER }))
        .rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for SUPPORT_AGENT', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_AGENT }))
        .rejects.toThrow(ForbiddenError);
    });

    it('allows ADMIN only', async () => {
      await expect(useCase.execute(baseInput)).resolves.toBeUndefined();
    });
  });

  describe('not found', () => {
    it('throws OrganizationNotFoundError when org does not exist', async () => {
      orgRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  describe('member guard', () => {
    it('throws OrganizationHasMembersError when org has members', async () => {
      orgRepo.memberCount.mockResolvedValue(3);

      await expect(useCase.execute(baseInput)).rejects.toThrow(OrganizationHasMembersError);
      expect(orgRepo.delete).not.toHaveBeenCalled();
    });

    it('allows deletion when member count is zero', async () => {
      orgRepo.memberCount.mockResolvedValue(0);

      await expect(useCase.execute(baseInput)).resolves.toBeUndefined();
      expect(orgRepo.delete).toHaveBeenCalledWith('org-id-1');
    });
  });
});
