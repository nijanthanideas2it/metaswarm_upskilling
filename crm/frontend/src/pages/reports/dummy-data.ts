export const statusCounts = {
  open: 42,
  inProgress: 18,
  pending: 7,
  resolvedThisWeek: 31,
  closedThisWeek: 14,
};

export const priorityBreakdown = [
  { priority: 'Critical', count: 5, fill: '#ef4444' },
  { priority: 'High', count: 14, fill: '#f97316' },
  { priority: 'Medium', count: 27, fill: '#eab308' },
  { priority: 'Low', count: 14, fill: '#22c55e' },
];

export const categoryBreakdown = [
  { category: 'Billing', count: 18, fill: '#6366f1' },
  { category: 'Technical', count: 22, fill: '#3b82f6' },
  { category: 'Account', count: 12, fill: '#8b5cf6' },
  { category: 'General', count: 7, fill: '#14b8a6' },
  { category: 'Onboarding', count: 3, fill: '#f59e0b' },
];

export interface AtRiskTicket {
  ref: string;
  customer: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  hoursOpen: number;
}

export const atRiskTickets: AtRiskTicket[] = [
  { ref: 'TKT-0041', customer: 'Acme Corp', category: 'Billing', priority: 'CRITICAL', hoursOpen: 36 },
  { ref: 'TKT-0038', customer: 'Globex Inc', category: 'Technical', priority: 'HIGH', hoursOpen: 29 },
  { ref: 'TKT-0035', customer: 'Initech Ltd', category: 'Account', priority: 'HIGH', hoursOpen: 27 },
  { ref: 'TKT-0030', customer: 'Umbrella Co', category: 'General', priority: 'MEDIUM', hoursOpen: 25 },
  { ref: 'TKT-0027', customer: 'Stark Ind', category: 'Billing', priority: 'CRITICAL', hoursOpen: 48 },
];
