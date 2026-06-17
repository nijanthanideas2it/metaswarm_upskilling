import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, refresh, forgotPassword, resetPassword, ApiError } from './auth';

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

describe('auth API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('sends email and password, returns parsed response', async () => {
      const payload = {
        data: {
          accessToken: 'jwt',
          refreshToken: 'raw',
          expiresIn: 900,
          user: { id: '1', email: 'a@b.com', role: 'ADMIN' },
        },
        meta: null,
        error: null,
      };
      mockFetch(200, payload);

      const result = await login('a@b.com', 'pass123');

      expect(result).toEqual(payload.data);
      const fetchMock = vi.mocked(fetch);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/auth/login');
      const body = JSON.parse(init.body as string) as { email: string; password: string };
      expect(body).toEqual({ email: 'a@b.com', password: 'pass123' });
    });

    it('throws ApiError with code INVALID_CREDENTIALS on 401', async () => {
      mockFetch(401, {
        data: null,
        meta: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
      });

      await expect(login('a@b.com', 'wrong')).rejects.toThrow(ApiError);
      await expect(login('a@b.com', 'wrong')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    });

    it('throws ApiError with code ACCOUNT_LOCKED on 403', async () => {
      mockFetch(403, { data: null, meta: null, error: { code: 'ACCOUNT_LOCKED', message: 'Locked.' } });

      await expect(login('a@b.com', 'pass')).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED', status: 403 });
    });
  });

  describe('logout', () => {
    it('sends refreshToken in body and Authorization header', async () => {
      mockFetch(204, { data: null, meta: null, error: null });

      await logout('refresh-token', 'access-token');

      const fetchMock = vi.mocked(fetch);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/auth/logout');
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer access-token');
      const body = JSON.parse(init.body as string) as { refreshToken: string };
      expect(body.refreshToken).toBe('refresh-token');
    });
  });

  describe('refresh', () => {
    it('sends refreshToken and returns new token pair', async () => {
      const payload = {
        data: { accessToken: 'new-jwt', refreshToken: 'new-raw', expiresIn: 900 },
        meta: null,
        error: null,
      };
      mockFetch(200, payload);

      const result = await refresh('old-raw');
      expect(result.accessToken).toBe('new-jwt');
      expect(result.refreshToken).toBe('new-raw');
    });

    it('throws ApiError on 401 INVALID_REFRESH_TOKEN', async () => {
      mockFetch(401, { data: null, meta: null, error: { code: 'INVALID_REFRESH_TOKEN', message: 'Expired.' } });

      await expect(refresh('bad-token')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  describe('forgotPassword', () => {
    it('posts email and resolves', async () => {
      mockFetch(200, {
        data: { message: 'If this email is registered, a reset link has been sent.' },
        meta: null,
        error: null,
      });

      await expect(forgotPassword('a@b.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('posts token and newPassword and resolves', async () => {
      mockFetch(200, { data: { message: 'Password has been reset.' }, meta: null, error: null });

      await expect(resetPassword('token', 'NewPass99')).resolves.toBeUndefined();
    });

    it('throws ApiError on 400 INVALID_RESET_TOKEN', async () => {
      mockFetch(400, { data: null, meta: null, error: { code: 'INVALID_RESET_TOKEN', message: 'Expired.' } });

      await expect(resetPassword('bad', 'NewPass99')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN', status: 400 });
    });
  });
});
