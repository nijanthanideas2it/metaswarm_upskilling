import { Role, AccountStatus } from '../../../../src/domain/enums';
import { ForbiddenError } from '../../../../src/domain/errors/domain.error';
import { ListCustomersUseCase, ListCustomersInput } from '../../../../src/application/use-cases/customers/list-customers.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import { createMockCustomerRepository } from '../../../helpers/mocks';

const PAGE_RESULT = {
  items: [createCustomerEntity()],
  total: 1,
  page: 1,
  pageSize: 20,
};

const baseInput: ListCustomersInput = {
  page: 1,
  pageSize: 20,
  callerRole: Role.ADMIN,
};

describe('ListCustomersUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: ListCustomersUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    useCase = new ListCustomersUseCase(customerRepo);
    customerRepo.list.mockResolvedValue(PAGE_RESULT);
  });

  describe('RBAC', () => {
    it('throws ForbiddenError for CUSTOMER role', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER }))
        .rejects.toThrow(ForbiddenError);
    });

    it.each([Role.ADMIN, Role.SUPPORT_MANAGER, Role.SUPPORT_AGENT])(
      'allows %s role',
      async (role) => {
        await expect(useCase.execute({ ...baseInput, callerRole: role })).resolves.toBeDefined();
      },
    );
  });

  describe('pagination', () => {
    it('clamps pageSize to 100 when a larger value is requested', async () => {
      await useCase.execute({ ...baseInput, pageSize: 999 });

      expect(customerRepo.list).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
    });

    it('passes page and pageSize to the repository', async () => {
      await useCase.execute({ ...baseInput, page: 3, pageSize: 50 });

      expect(customerRepo.list).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 50 }));
    });
  });

  describe('filters', () => {
    it('passes status filter to repository', async () => {
      await useCase.execute({ ...baseInput, status: AccountStatus.DEACTIVATED });

      expect(customerRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: AccountStatus.DEACTIVATED }),
      );
    });

    it('passes organizationId filter to repository', async () => {
      await useCase.execute({ ...baseInput, organizationId: 'org-1' });

      expect(customerRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
      );
    });

    it('passes sortBy and sortOrder to repository', async () => {
      await useCase.execute({ ...baseInput, sortBy: 'email', sortOrder: 'desc' });

      expect(customerRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'email', sortOrder: 'desc' }),
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
