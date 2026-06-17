import { Role, AccountStatus } from '../../../../src/domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../../src/domain/errors/domain.error';
import { GetCustomerUseCase, GetCustomerInput } from '../../../../src/application/use-cases/customers/get-customer.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import {
  createMockCustomerRepository,
  createMockTicketSummaryService,
} from '../../../helpers/mocks';

const TICKET_SUMMARY = { totalTickets: 5, openTickets: 2, lastTicketAt: new Date() };

const baseInput: GetCustomerInput = {
  customerId: 'customer-id-1',
  callerUserId: 'user-id-1',
  callerRole: Role.ADMIN,
};

describe('GetCustomerUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let ticketSummaryService: ReturnType<typeof createMockTicketSummaryService>;
  let useCase: GetCustomerUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    ticketSummaryService = createMockTicketSummaryService();
    useCase = new GetCustomerUseCase(customerRepo, ticketSummaryService);
    ticketSummaryService.getForCustomer.mockResolvedValue(TICKET_SUMMARY);
  });

  describe('customer not found', () => {
    it('throws CustomerNotFoundError when customer does not exist', async () => {
      customerRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('CUSTOMER role access', () => {
    it('allows a CUSTOMER to view their own profile', async () => {
      customerRepo.findById.mockResolvedValue(createCustomerEntity({ userId: 'user-id-1' }));

      const result = await useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER, callerUserId: 'user-id-1' });

      expect(result.customer).toBeDefined();
    });

    it('throws ForbiddenError when CUSTOMER tries to view another customer', async () => {
      customerRepo.findById.mockResolvedValue(createCustomerEntity({ userId: 'other-user-id' }));

      await expect(
        useCase.execute({ ...baseInput, callerRole: Role.CUSTOMER, callerUserId: 'user-id-1' }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('successful retrieval', () => {
    beforeEach(() => {
      customerRepo.findById.mockResolvedValue(createCustomerEntity());
    });

    it('returns customer and ticket summary', async () => {
      const result = await useCase.execute(baseInput);

      expect(result.customer.id).toBe('customer-id-1');
      expect(result.ticketSummary).toEqual(TICKET_SUMMARY);
    });

    it('fetches ticket summary using customer.id', async () => {
      await useCase.execute(baseInput);

      expect(ticketSummaryService.getForCustomer).toHaveBeenCalledWith('customer-id-1');
    });

    it('allows SUPPORT_AGENT to view any customer', async () => {
      const result = await useCase.execute({ ...baseInput, callerRole: Role.SUPPORT_AGENT });
      expect(result.customer).toBeDefined();
    });
  });
});
