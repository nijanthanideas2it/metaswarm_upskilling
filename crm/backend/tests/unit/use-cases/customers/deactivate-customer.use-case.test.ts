import { Role, AccountStatus } from '../../../../src/domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../../src/domain/errors/domain.error';
import {
  DeactivateCustomerUseCase,
  DeactivateCustomerInput,
} from '../../../../src/application/use-cases/customers/deactivate-customer.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import { createMockCustomerRepository, createMockAuthTokenRepository } from '../../../helpers/mocks';

const customer = createCustomerEntity({ id: 'customer-id-1', userId: 'user-id-1' });

const baseInput: DeactivateCustomerInput = {
  customerId: 'customer-id-1',
  callerRole: Role.ADMIN,
};

describe('DeactivateCustomerUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let authTokenRepo: ReturnType<typeof createMockAuthTokenRepository>;
  let useCase: DeactivateCustomerUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    authTokenRepo = createMockAuthTokenRepository();
    useCase = new DeactivateCustomerUseCase(customerRepo, authTokenRepo);
    customerRepo.findById.mockResolvedValue(customer);
    customerRepo.updateStatus.mockResolvedValue(undefined);
    authTokenRepo.revokeAllForUser.mockResolvedValue(undefined);
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

    it('throws ForbiddenError for CUSTOMER', async () => {
      await expect(useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER }))
        .rejects.toThrow(ForbiddenError);
    });

    it('allows ADMIN', async () => {
      await expect(useCase.execute(baseInput)).resolves.toBeUndefined();
    });
  });

  describe('not found', () => {
    it('throws CustomerNotFoundError when customer does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('deactivation', () => {
    it('sets customer status to DEACTIVATED', async () => {
      await useCase.execute(baseInput);

      expect(customerRepo.updateStatus).toHaveBeenCalledWith('customer-id-1', AccountStatus.DEACTIVATED);
    });

    it('revokes all auth tokens for the customer user', async () => {
      await useCase.execute(baseInput);

      expect(authTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-id-1');
    });

    it('revokes tokens AFTER setting status to prevent any new token use', async () => {
      const callOrder: string[] = [];
      customerRepo.updateStatus.mockImplementation(async () => { callOrder.push('updateStatus'); });
      authTokenRepo.revokeAllForUser.mockImplementation(async () => { callOrder.push('revokeAllForUser'); });

      await useCase.execute(baseInput);

      expect(callOrder).toEqual(['updateStatus', 'revokeAllForUser']);
    });
  });
});
