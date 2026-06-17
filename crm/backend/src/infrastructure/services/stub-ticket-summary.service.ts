import type {
  ITicketSummaryService,
  TicketSummary,
} from '../../domain/services/ticket-summary.service.interface';

const EMPTY_SUMMARY: TicketSummary = { totalTickets: 0, openTickets: 0, lastTicketAt: null };

export class StubTicketSummaryService implements ITicketSummaryService {
  async getForCustomer(_customerId: string): Promise<TicketSummary> {
    return EMPTY_SUMMARY;
  }

  async getForOrganization(_organizationId: string): Promise<TicketSummary> {
    return EMPTY_SUMMARY;
  }
}
