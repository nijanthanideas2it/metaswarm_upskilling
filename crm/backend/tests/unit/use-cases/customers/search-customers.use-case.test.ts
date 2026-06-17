import { Role } from '../../../../src/domain/enums';
import {
  CustomerSearchQueryTooShortError,
  ForbiddenError,
} from '../../../../src/domain/errors/domain.error';
import {
  SearchCustomersUseCase,
  SearchCustomersInput,
} from '../../../../src/application/use-cases/customers/search-customers.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import { createMockCustomerRepository } from '../../../helpers/mocks';

const SEARCH_RESULT = { items: [createCustomerEntity()], total: 1, page: 1, pageSize: 20 };

const baseInput: SearchCustomersInput = {
  query: 'alice',
  page: 1,
  pageSize: 20,
  callerRole: Role.ADMIN,
};

describe('SearchCustomersUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: SearchCustomersUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    useCase = new SearchCustomersUseCase(customerRepo);
    customerRepo.search.mockResolvedValue(SEARCH_RESULT);
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

  describe('query validation', () => {
    it('throws CustomerSearchQueryTooShortError for a 1-char query', async () => {
      await expect(useCase.execute({ ...baseInput, query: 'a' }))
        .rejects.toThrow(CustomerSearchQueryTooShortError);
    });

    it('throws CustomerSearchQueryTooShortError for empty string', async () => {
      await expect(useCase.execute({ ...baseInput, query: '' }))
        .rejects.toThrow(CustomerSearchQueryTooShortError);
    });

    it('throws for a query that is only whitespace (< 2 non-space chars)', async () => {
      await expect(useCase.execute({ ...baseInput, query: ' ' }))
        .rejects.toThrow(CustomerSearchQueryTooShortError);
    });

    it('allows a 2-char query', async () => {
      await expect(useCase.execute({ ...baseInput, query: 'al' })).resolves.toBeDefined();
    });
  });

  describe('search execution', () => {
    it('trims the query before calling the repository', async () => {
      await useCase.execute({ ...baseInput, query: '  alice  ' });

      expect(customerRepo.search).toHaveBeenCalledWith('alice', expect.any(Object));
    });

    it('clamps pageSize to 100', async () => {
      await useCase.execute({ ...baseInput, pageSize: 500 });

      expect(customerRepo.search).toHaveBeenCalledWith(expect.any(String), { page: 1, pageSize: 100 });
    });

    it('returns the search result from the repository', async () => {
      const result = await useCase.execute(baseInput);
      expect(result).toEqual(SEARCH_RESULT);
    });
  });
});
