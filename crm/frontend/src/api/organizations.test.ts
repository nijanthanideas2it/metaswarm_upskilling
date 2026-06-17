import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listOrganizations } from './organizations';

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

const TOKEN = 'test-token';

describe('listOrganizations', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns organization list and meta', async () => {
    const orgs = [
      { id: 'o1', name: 'Acme Corp', emailDomain: 'acme.com', industry: 'Tech', memberCount: 5, createdAt: '2026-01-01T00:00:00Z' },
    ];
    mockFetch(200, { data: orgs, meta: { total: 1, page: 1, pageSize: 100, hasNextPage: false }, error: null });

    const result = await listOrganizations(TOKEN);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Acme Corp');
  });

  it('defaults pageSize to 100', async () => {
    mockFetch(200, { data: [], meta: { total: 0, page: 1, pageSize: 100, hasNextPage: false }, error: null });

    await listOrganizations(TOKEN);

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('pageSize=100');
  });

  it('accepts custom pageSize', async () => {
    mockFetch(200, { data: [], meta: { total: 0, page: 1, pageSize: 20, hasNextPage: false }, error: null });

    await listOrganizations(TOKEN, { pageSize: 20 });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('pageSize=20');
  });
});
