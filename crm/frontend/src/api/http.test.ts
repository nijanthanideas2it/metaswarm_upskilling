import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, httpGet, httpPost, httpPatch, httpDelete } from './http';

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

function mockFetch204(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) }),
  );
}

describe('ApiError', () => {
  it('has name ApiError and exposes code and status', () => {
    const err = new ApiError('MY_CODE', 'something', 422, { field: 'email' });
    expect(err.name).toBe('ApiError');
    expect(err.code).toBe('MY_CODE');
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ field: 'email' });
    expect(err instanceof ApiError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

describe('httpGet', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends GET with Authorization header and returns data', async () => {
    mockFetch(200, { data: { id: '1', name: 'Test' }, meta: { total: 1 }, error: null });

    const result = await httpGet<{ id: string; name: string }>('/api/v1/test', 'my-token');

    expect(result.data).toEqual({ id: '1', name: 'Test' });
    expect(result.meta).toEqual({ total: 1 });

    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/test');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token');
    expect(init.method).toBe('GET');
  });

  it('appends query params to URL, skipping undefined values', async () => {
    mockFetch(200, { data: [], meta: null, error: null });

    await httpGet('/api/v1/test', 'tok', { page: 2, pageSize: undefined, status: 'ACTIVE' });

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('page=2');
    expect(url).toContain('status=ACTIVE');
    expect(url).not.toContain('pageSize');
  });

  it('throws ApiError when response has error body', async () => {
    mockFetch(409, { data: null, meta: null, error: { code: 'CONFLICT', message: 'Duplicate.' } });

    await expect(httpGet('/api/v1/test', 'tok')).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
    });
  });

  it('throws ApiError with fallback code when error field is null but !ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ data: null, meta: null, error: null }),
      }),
    );

    await expect(httpGet('/api/v1/test', 'tok')).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      status: 500,
    });
  });
});

describe('httpPost', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends POST with Content-Type and body, returns data', async () => {
    const payload = { id: 'new-id' };
    mockFetch(201, { data: payload, meta: null, error: null });

    const result = await httpPost<{ id: string }>('/api/v1/items', { name: 'New' }, 'tok');

    expect(result).toEqual(payload);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'New' });
  });

  it('sends POST without Authorization if no token provided', async () => {
    mockFetch(200, { data: null, meta: null, error: null });

    await httpPost('/api/v1/public', {});

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('throws ApiError on error response', async () => {
    mockFetch(404, { data: null, meta: null, error: { code: 'NOT_FOUND', message: 'Not found.' } });

    await expect(httpPost('/api/v1/items', {}, 'tok')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

describe('httpPatch', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends PATCH with token and body, returns data', async () => {
    const updated = { id: '1', name: 'Updated' };
    mockFetch(200, { data: updated, meta: null, error: null });

    const result = await httpPatch<typeof updated>('/api/v1/items/1', { name: 'Updated' }, 'tok');

    expect(result).toEqual(updated);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
  });
});

describe('httpDelete', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends DELETE and resolves on 204', async () => {
    mockFetch204();

    await expect(httpDelete('/api/v1/items/1', 'tok')).resolves.toBeUndefined();

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
  });
});
