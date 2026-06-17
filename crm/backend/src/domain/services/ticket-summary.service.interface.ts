export interface TicketSummary {
  totalTickets: number;
  openTickets: number;
  lastTicketAt: Date | null;
}

export interface ITicketSummaryService {
  getForCustomer(customerId: string): Promise<TicketSummary>;
  getForOrganization(organizationId: string): Promise<TicketSummary>;
}
