const API_BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  data: T | null;
  meta: unknown;
  error: ApiErrorBody | null;
}

async function request<T>(
  method: string,
  path: string,
  opts?: {
    accessToken?: string;
    body?: unknown;
    params?: Record<string, string | number | undefined>;
  },
): Promise<{ data: T; meta: unknown }> {
  const headers: Record<string, string> = {};
  if (opts?.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;

  let url = `${API_BASE}${path}`;
  if (opts?.params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) sp.append(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return { data: undefined as unknown as T, meta: null };

  const json = (await res.json()) as Envelope<T>;
  if (!res.ok || json.error) {
    const err = json.error;
    throw new ApiError(
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? 'An unexpected error occurred',
      res.status,
      err?.details,
    );
  }

  return { data: json.data as T, meta: json.meta };
}

export async function httpGet<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string | number | undefined>,
): Promise<{ data: T; meta: unknown }> {
  return request<T>('GET', path, { accessToken, params });
}

export async function httpPost<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const { data } = await request<T>('POST', path, { accessToken, body });
  return data;
}

export async function httpPatch<T>(
  path: string,
  body: unknown,
  accessToken: string,
): Promise<T> {
  const { data } = await request<T>('PATCH', path, { accessToken, body });
  return data;
}

export async function httpDelete(
  path: string,
  accessToken: string,
): Promise<void> {
  await request<void>('DELETE', path, { accessToken });
}
