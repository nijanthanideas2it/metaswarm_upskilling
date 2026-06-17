import { Role } from '../../../../src/domain/enums';
import { ForbiddenError } from '../../../../src/domain/errors/domain.error';
import {
  ListOrganizationsUseCase,
  ListOrganizationsInput,
} from '../../../../src/application/use-cases/organizations/list-organizations.use-case';
import { createOrganizationEntity } from '../../../helpers/factories';
import { createMockOrganizationRepository } from '../../../helpers/mocks';

const PAGE_RESULT = { items: [createOrganizationEntity()], total: 1, page: 1, pageSize: 20 };

const baseInput: ListOrganizationsInput = {
  page: 1,
  pageSize: 20,
  callerRole: Role.ADMIN,
};

describe('ListOrganizationsUseCase', () => {
  let orgRepo: ReturnType<typeof createMockOrganizationRepository>;
  let useCase: ListOrganizationsUseCase;

  beforeEach(() => {
    orgRepo = createMockOrganizationRepository();
    useCase = new ListOrganizationsUseCase(orgRepo);
    orgRepo.list.mockResolvedValue(PAGE_RESULT);
  });

  describe('RBAC', () => {
    it('throws ForbiddenError for CUSTOMER', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER }))
        .rejects.toThrow(ForbiddenError);
    });

    it.each([Role.ADMIN, Role.SUPPORT_MANAGER, Role.SUPPORT_AGENT])(
      'allows %s',
      async (role) => {
        await expect(useCase.execute({ ...baseInput, callerRole: role })).resolves.toBeDefined();
      },
    );
  });

  describe('pagination', () => {
    it('clamps pageSize to 100', async () => {
      await useCase.execute({ ...baseInput, pageSize: 9999 });

      expect(orgRepo.list).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
    });

    it('passes page and sort options to repository', async () => {
      await useCase.execute({ ...baseInput, page: 2, sortBy: 'createdAt', sortOrder: 'desc' });

      expect(orgRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, sortBy: 'createdAt', sortOrder: 'desc' }),
      );
    });
  });

  describe('result', () => {
    it('returns the paged result from the repository', async () => {
      const result = await useCase.execute(baseInput);
      expect(result).toEqual(PAGE_RESULT);
    });
  });
});
