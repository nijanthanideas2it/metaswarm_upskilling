import { httpGet } from './http';
import type { PaginationMeta } from './customers';

export interface OrganizationListItem {
  id: string;
  name: string;
  emailDomain: string | null;
  industry: string | null;
  memberCount: number;
  createdAt: string;
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
