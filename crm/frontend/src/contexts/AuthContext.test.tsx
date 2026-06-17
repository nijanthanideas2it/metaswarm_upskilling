import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, AuthContext, type AuthContextValue } from './AuthContext';
import { useContext } from 'react';
import * as authApi from '../api/auth';

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/auth')>();
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  };
});

function TestConsumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div>no context</div>;
  return (
    <div>
      <span data-testid="authenticated">{String(ctx.state.isAuthenticated)}</span>
      <span data-testid="loading">{String(ctx.state.isLoading)}</span>
      <span data-testid="user-email">{ctx.state.user?.email ?? 'none'}</span>
      <button onClick={() => void ctx.login('a@b.com', 'pass')}>login</button>
      <button onClick={() => void ctx.logout()}>logout</button>
      <button onClick={() => void ctx.refreshSession()}>refresh</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('resolves to unauthenticated when no tokens in localStorage', async () => {
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });

  describe('session restore', () => {
    it('restores session from valid tokens in localStorage', async () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }));
      const payload = btoa(JSON.stringify({ sub: 'u1', role: 'ADMIN' }));
      const fakeJwt = `${header}.${payload}.sig`;
      localStorage.setItem('crm_access_token', fakeJwt);
      localStorage.setItem('crm_refresh_token', 'refresh-token');

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
      });
    });

    it('clears invalid tokens and stays unauthenticated', async () => {
      localStorage.setItem('crm_access_token', 'bad.token');
      localStorage.setItem('crm_refresh_token', 'refresh-token');

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(localStorage.getItem('crm_access_token')).toBeNull();
    });
  });

  describe('login', () => {
    it('sets authenticated state and stores tokens on success', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'jwt',
        refreshToken: 'raw',
        expiresIn: 900,
        user: { id: '1', email: 'a@b.com', role: 'ADMIN' },
      });

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      await act(async () => {
        screen.getByText('login').click();
      });

      expect(screen.getByTestId('authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-email').textContent).toBe('a@b.com');
      expect(localStorage.getItem('crm_access_token')).toBe('jwt');
      expect(localStorage.getItem('crm_refresh_token')).toBe('raw');
    });
  });

  describe('logout', () => {
    it('clears state and tokens', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'jwt',
        refreshToken: 'raw',
        expiresIn: 900,
        user: { id: '1', email: 'a@b.com', role: 'ADMIN' },
      });
      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      await act(async () => { screen.getByText('login').click(); });
      await act(async () => { screen.getByText('logout').click(); });

      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(localStorage.getItem('crm_access_token')).toBeNull();
    });

    it('still clears local state even if API call fails', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'jwt',
        refreshToken: 'raw',
        expiresIn: 900,
        user: { id: '1', email: 'a@b.com', role: 'ADMIN' },
      });
      vi.mocked(authApi.logout).mockRejectedValue(new Error('network error'));

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      await act(async () => { screen.getByText('login').click(); });
      await act(async () => { screen.getByText('logout').click(); });

      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });

  describe('refreshSession', () => {
    it('updates access token on success', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'old-jwt',
        refreshToken: 'raw',
        expiresIn: 900,
        user: { id: '1', email: 'a@b.com', role: 'ADMIN' },
      });
      vi.mocked(authApi.refresh).mockResolvedValue({
        accessToken: 'new-jwt',
        refreshToken: 'new-raw',
        expiresIn: 900,
      });

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      await act(async () => { screen.getByText('login').click(); });
      await act(async () => { screen.getByText('refresh').click(); });

      expect(localStorage.getItem('crm_access_token')).toBe('new-jwt');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    it('logs out when refresh fails', async () => {
      vi.mocked(authApi.login).mockResolvedValue({
        accessToken: 'old-jwt',
        refreshToken: 'raw',
        expiresIn: 900,
        user: { id: '1', email: 'a@b.com', role: 'ADMIN' },
      });
      vi.mocked(authApi.refresh).mockRejectedValue(new Error('expired'));

      renderProvider();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      await act(async () => { screen.getByText('login').click(); });
      await act(async () => { screen.getByText('refresh').click(); });

      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });

    it('logs out immediately when no refresh token exists', async () => {
      renderProvider();
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      await act(async () => { screen.getByText('refresh').click(); });

      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });
});
