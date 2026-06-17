import { httpGet, httpPost, httpPatch, httpDelete } from './http';
import type { PaginationMeta } from './customers';

export interface OrganizationListItem {
  id: string;
  name: string;
  emailDomain: string | null;
  industry: string | null;
  memberCount: number;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  fullName: string;
  email: string;
  status: 'ACTIVE' | 'DEACTIVATED';
}

export interface OrganizationProfile {
  id: string;
  name: string;
  emailDomain: string | null;
  industry: string | null;
  primaryContactId: string | null;
  primaryContact: { id: string; fullName: string; email: string } | null;
  ticketSummary: { totalOpenTickets: number; lastTicketAt: string | null } | null;
  members: OrganizationMember[];
  membersMeta: PaginationMeta;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationBody {
  name: string;
  emailDomain?: string;
  industry?: string;
  primaryContactId?: string;
}

export interface UpdateOrganizationBody {
  name?: string;
  emailDomain?: string | null;
  industry?: string | null;
  primaryContactId?: string | null;
}

export async function listOrganizations(
  accessToken: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<{ data: OrganizationListItem[]; meta: PaginationMeta }> {
  const result = await httpGet<OrganizationListItem[]>('/api/v1/organizations', accessToken, {
    page: params.page,
    pageSize: params.pageSize ?? 100,
  });
  return { data: result.data, meta: result.meta as PaginationMeta };
}

export async function getOrganization(
  accessToken: string,
  id: string,
  membersPage = 1,
  membersPageSize = 20,
): Promise<OrganizationProfile> {
  const result = await httpGet<OrganizationProfile>(`/api/v1/organizations/${id}`, accessToken, {
    membersPage,
    membersPageSize,
  });
  return result.data;
}

export async function createOrganization(
  accessToken: string,
  body: CreateOrganizationBody,
): Promise<OrganizationProfile> {
  return httpPost<OrganizationProfile>('/api/v1/organizations', body, accessToken);
}

export async function updateOrganization(
  accessToken: string,
  id: string,
  body: UpdateOrganizationBody,
): Promise<OrganizationProfile> {
  return httpPatch<OrganizationProfile>(`/api/v1/organizations/${id}`, body, accessToken);
}

export async function deleteOrganization(
  accessToken: string,
  id: string,
): Promise<void> {
  return httpDelete(`/api/v1/organizations/${id}`, accessToken);
}

export async function addOrganizationMember(
  accessToken: string,
  orgId: string,
  customerId: string,
): Promise<{ customerId: string; organizationId: string; message: string }> {
  return httpPost(`/api/v1/organizations/${orgId}/members`, { customerId }, accessToken);
}

export async function removeOrganizationMember(
  accessToken: string,
  orgId: string,
  customerId: string,
): Promise<void> {
  return httpDelete(`/api/v1/organizations/${orgId}/members/${customerId}`, accessToken);
}
