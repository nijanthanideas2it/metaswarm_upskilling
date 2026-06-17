import { httpGet, httpPost, httpPatch } from './http';

export interface OwnProfileUpdateBody {
  fullName?: string;
  phone?: string | null;
  jobTitle?: string | null;
}

export interface CustomerListItem {
  id: string;
  fullName: string;
  email: string;
  organizationName: string | null;
  status: 'ACTIVE' | 'DEACTIVATED';
  createdAt: string;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  organizationId: string | null;
  organizationName: string | null;
  role: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  ticketSummary: {
    totalTickets: number;
    openTickets: number;
    lastTicketAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface CreateCustomerBody {
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  organizationId?: string;
}

export interface UpdateCustomerBody {
  fullName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  organizationId?: string | null;
}

export interface ListCustomersParams {
  page?: number;
  pageSize?: number;
  status?: 'ACTIVE' | 'DEACTIVATED';
  sortBy?: 'fullName' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export async function listCustomers(
  accessToken: string,
  params: ListCustomersParams = {},
): Promise<{ data: CustomerListItem[]; meta: PaginationMeta }> {
  const queryParams: Record<string, string | number | undefined> = {
    page: params.page,
    pageSize: params.pageSize,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };
  if (params.status) queryParams['filter[status]'] = params.status;

  const result = await httpGet<CustomerListItem[]>('/api/v1/customers', accessToken, queryParams);
  return { data: result.data, meta: result.meta as PaginationMeta };
}

export async function searchCustomers(
  accessToken: string,
  q: string,
  page = 1,
  pageSize = 20,
): Promise<{ data: CustomerListItem[]; meta: PaginationMeta }> {
  const result = await httpGet<CustomerListItem[]>('/api/v1/customers/search', accessToken, {
    q,
    page,
    pageSize,
  });
  return { data: result.data, meta: result.meta as PaginationMeta };
}

export async function getCustomer(
  accessToken: string,
  id: string,
): Promise<CustomerProfile> {
  const result = await httpGet<CustomerProfile>(`/api/v1/customers/${id}`, accessToken);
  return result.data;
}

export async function createCustomer(
  accessToken: string,
  body: CreateCustomerBody,
): Promise<CustomerProfile> {
  return httpPost<CustomerProfile>('/api/v1/customers', body, accessToken);
}

export async function updateCustomer(
  accessToken: string,
  id: string,
  body: UpdateCustomerBody,
): Promise<CustomerProfile> {
  return httpPatch<CustomerProfile>(`/api/v1/customers/${id}`, body, accessToken);
}

export async function deactivateCustomer(
  accessToken: string,
  id: string,
): Promise<{ id: string; status: string; updatedAt: string }> {
  return httpPost<{ id: string; status: string; updatedAt: string }>(
    `/api/v1/customers/${id}/deactivate`,
    {},
    accessToken,
  );
}

export async function getOwnProfile(accessToken: string): Promise<CustomerProfile> {
  const result = await httpGet<CustomerProfile>('/api/v1/customers/me', accessToken);
  return result.data;
}

export async function updateOwnProfile(
  accessToken: string,
  body: OwnProfileUpdateBody,
): Promise<CustomerProfile> {
  return httpPatch<CustomerProfile>('/api/v1/customers/me', body, accessToken);
}

export async function reactivateCustomer(
  accessToken: string,
  id: string,
): Promise<{ id: string; status: string; updatedAt: string }> {
  return httpPost<{ id: string; status: string; updatedAt: string }>(
    `/api/v1/customers/${id}/reactivate`,
    {},
    accessToken,
  );
}
