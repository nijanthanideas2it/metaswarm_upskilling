import { Role, AccountStatus } from '../../../../src/domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../../src/domain/errors/domain.error';
import {
  ReactivateCustomerUseCase,
  ReactivateCustomerInput,
} from '../../../../src/application/use-cases/customers/reactivate-customer.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import { createMockCustomerRepository } from '../../../helpers/mocks';

const customer = createCustomerEntity({ id: 'customer-id-1', status: AccountStatus.DEACTIVATED });

const baseInput: ReactivateCustomerInput = {
  customerId: 'customer-id-1',
  callerRole: Role.ADMIN,
};

describe('ReactivateCustomerUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let useCase: ReactivateCustomerUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    useCase = new ReactivateCustomerUseCase(customerRepo);
    customerRepo.findById.mockResolvedValue(customer);
    customerRepo.updateStatus.mockResolvedValue(undefined);
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
    it('throws CustomerNotFoundError when customer does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('reactivation', () => {
    it('sets customer status to ACTIVE', async () => {
      await useCase.execute(baseInput);

      expect(customerRepo.updateStatus).toHaveBeenCalledWith('customer-id-1', AccountStatus.ACTIVE);
    });

    it('returns void on success', async () => {
      await expect(useCase.execute(baseInput)).resolves.toBeUndefined();
    });
  });
});
