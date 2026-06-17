import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCustomers,
  searchCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
} from './customers';

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

const customerListItem = {
  id: 'c1',
  fullName: 'Jane Smith',
  email: 'jane@example.com',
  organizationName: 'Acme Corp',
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
};

const paginationMeta = { total: 1, page: 1, pageSize: 20, hasNextPage: false };

const customerProfile = {
  id: 'c1',
  userId: 'u1',
  fullName: 'Jane Smith',
  email: 'jane@example.com',
  phone: '+1 555 000 0001',
  jobTitle: 'Engineer',
  organizationId: 'o1',
  organizationName: 'Acme Corp',
  role: 'CUSTOMER',
  status: 'ACTIVE' as const,
  ticketSummary: { totalTickets: 3, openTickets: 1, lastTicketAt: '2026-06-01T00:00:00Z' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

describe('listCustomers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns customer list and pagination meta', async () => {
    mockFetch(200, { data: [customerListItem], meta: paginationMeta, error: null });

    const result = await listCustomers(TOKEN);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].fullName).toBe('Jane Smith');
    expect(result.meta.total).toBe(1);
  });

  it('includes status filter in query params', async () => {
    mockFetch(200, { data: [], meta: paginationMeta, error: null });

    await listCustomers(TOKEN, { status: 'ACTIVE' });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('filter%5Bstatus%5D=ACTIVE');
  });

  it('includes sortBy and sortOrder in query params', async () => {
    mockFetch(200, { data: [], meta: paginationMeta, error: null });

    await listCustomers(TOKEN, { sortBy: 'email', sortOrder: 'desc' });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('sortBy=email');
    expect(url).toContain('sortOrder=desc');
  });
});

describe('searchCustomers', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends q param to search endpoint and returns results', async () => {
    mockFetch(200, { data: [customerListItem], meta: paginationMeta, error: null });

    const result = await searchCustomers(TOKEN, 'jane');

    expect(result.data[0].email).toBe('jane@example.com');
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/customers/search');
    expect(url).toContain('q=jane');
  });
});

describe('getCustomer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('fetches customer by id and returns full profile', async () => {
    mockFetch(200, { data: customerProfile, meta: null, error: null });

    const result = await getCustomer(TOKEN, 'c1');

    expect(result.fullName).toBe('Jane Smith');
    expect(result.ticketSummary?.openTickets).toBe(1);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/customers/c1');
  });
});

describe('createCustomer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('posts customer data and returns created profile', async () => {
    mockFetch(201, { data: customerProfile, meta: null, error: null });

    const result = await createCustomer(TOKEN, {
      fullName: 'Jane Smith',
      email: 'jane@example.com',
    });

    expect(result.id).toBe('c1');
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/customers');
    expect(init.method).toBe('POST');
  });

  it('throws ApiError with EMAIL_ALREADY_EXISTS on 409', async () => {
    mockFetch(409, {
      data: null,
      meta: null,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email in use.' },
    });

    await expect(createCustomer(TOKEN, { fullName: 'A', email: 'a@b.com' })).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
      status: 409,
    });
  });
});

describe('updateCustomer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends PATCH to customer endpoint and returns updated profile', async () => {
    const updated = { ...customerProfile, fullName: 'Jane A. Smith' };
    mockFetch(200, { data: updated, meta: null, error: null });

    const result = await updateCustomer(TOKEN, 'c1', { fullName: 'Jane A. Smith' });

    expect(result.fullName).toBe('Jane A. Smith');
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
  });
});

describe('deactivateCustomer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('posts to deactivate endpoint and returns status response', async () => {
    mockFetch(200, {
      data: { id: 'c1', status: 'DEACTIVATED', updatedAt: '2026-06-16T00:00:00Z' },
      meta: null,
      error: null,
    });

    const result = await deactivateCustomer(TOKEN, 'c1');

    expect(result.status).toBe('DEACTIVATED');
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/customers/c1/deactivate');
  });
});

describe('reactivateCustomer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('posts to reactivate endpoint and returns active status', async () => {
    mockFetch(200, {
      data: { id: 'c1', status: 'ACTIVE', updatedAt: '2026-06-16T00:00:00Z' },
      meta: null,
      error: null,
    });

    const result = await reactivateCustomer(TOKEN, 'c1');

    expect(result.status).toBe('ACTIVE');
  });
});
