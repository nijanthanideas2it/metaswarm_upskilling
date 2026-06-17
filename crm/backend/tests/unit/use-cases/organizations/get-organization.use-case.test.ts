import { Role } from '../../../../src/domain/enums';
import { ForbiddenError, OrganizationNotFoundError } from '../../../../src/domain/errors/domain.error';
import {
  GetOrganizationUseCase,
  GetOrganizationInput,
} from '../../../../src/application/use-cases/organizations/get-organization.use-case';
import { createOrganizationEntity } from '../../../helpers/factories';
import {
  createMockOrganizationRepository,
  createMockTicketSummaryService,
} from '../../../helpers/mocks';

const org = createOrganizationEntity();
const TICKET_SUMMARY = { totalTickets: 3, openTickets: 1, lastTicketAt: new Date() };

const baseInput: GetOrganizationInput = {
  organizationId: 'org-id-1',
  callerRole: Role.ADMIN,
};

describe('GetOrganizationUseCase', () => {
  let orgRepo: ReturnType<typeof createMockOrganizationRepository>;
  let ticketSummaryService: ReturnType<typeof createMockTicketSummaryService>;
  let useCase: GetOrganizationUseCase;

  beforeEach(() => {
    orgRepo = createMockOrganizationRepository();
    ticketSummaryService = createMockTicketSummaryService();
    useCase = new GetOrganizationUseCase(orgRepo, ticketSummaryService);
    orgRepo.findById.mockResolvedValue(org);
    ticketSummaryService.getForOrganization.mockResolvedValue(TICKET_SUMMARY);
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

  describe('not found', () => {
    it('throws OrganizationNotFoundError when org does not exist', async () => {
      orgRepo.findById.mockResolvedValue(null);
      await expect(useCase.execute(baseInput)).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  describe('successful retrieval', () => {
    it('returns organization and aggregated ticket summary', async () => {
      const result = await useCase.execute(baseInput);

      expect(result.organization).toBe(org);
      expect(result.ticketSummary).toEqual(TICKET_SUMMARY);
    });

    it('fetches ticket summary using organization.id', async () => {
      await useCase.execute(baseInput);

      expect(ticketSummaryService.getForOrganization).toHaveBeenCalledWith('org-id-1');
    });
  });
});
