import { Role } from '../../../../src/domain/enums';
import { CustomerNotFoundError, ForbiddenError } from '../../../../src/domain/errors/domain.error';
import { GetOwnProfileUseCase } from '../../../../src/application/use-cases/customers/get-own-profile.use-case';
import { createCustomerEntity } from '../../../helpers/factories';
import {
  createMockCustomerRepository,
  createMockTicketSummaryService,
} from '../../../helpers/mocks';

const TICKET_SUMMARY = { totalTickets: 3, openTickets: 1, lastTicketAt: new Date() };

describe('GetOwnProfileUseCase', () => {
  let customerRepo: ReturnType<typeof createMockCustomerRepository>;
  let ticketSummaryService: ReturnType<typeof createMockTicketSummaryService>;
  let useCase: GetOwnProfileUseCase;

  beforeEach(() => {
    customerRepo = createMockCustomerRepository();
    ticketSummaryService = createMockTicketSummaryService();
    useCase = new GetOwnProfileUseCase(customerRepo, ticketSummaryService);
    ticketSummaryService.getForCustomer.mockResolvedValue(TICKET_SUMMARY);
  });

  describe('role enforcement', () => {
    it('throws ForbiddenError when caller is not CUSTOMER role', async () => {
      await expect(
        useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.ADMIN }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for SUPPORT_MANAGER', async () => {
      await expect(
        useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.SUPPORT_MANAGER }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for SUPPORT_AGENT', async () => {
      await expect(
        useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.SUPPORT_AGENT }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('customer not found', () => {
    it('throws CustomerNotFoundError when no customer record exists for the user', async () => {
      customerRepo.findByUserId.mockResolvedValue(null);

      await expect(
        useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.CUSTOMER }),
      ).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('successful retrieval', () => {
    beforeEach(() => {
      customerRepo.findByUserId.mockResolvedValue(
        createCustomerEntity({ id: 'customer-id-1', userId: 'user-id-1' }),
      );
    });

    it('returns customer and ticket summary', async () => {
      const result = await useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.CUSTOMER });

      expect(result.customer.id).toBe('customer-id-1');
      expect(result.ticketSummary).toEqual(TICKET_SUMMARY);
    });

    it('looks up customer by userId', async () => {
      await useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.CUSTOMER });

      expect(customerRepo.findByUserId).toHaveBeenCalledWith('user-id-1');
    });

    it('fetches ticket summary using customer.id', async () => {
      await useCase.execute({ callerUserId: 'user-id-1', callerRole: Role.CUSTOMER });

      expect(ticketSummaryService.getForCustomer).toHaveBeenCalledWith('customer-id-1');
    });
  });
});
