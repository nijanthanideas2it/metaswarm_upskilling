import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  decodeJwtPayload,
} from './token';

function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('token utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getAccessToken', () => {
    it('returns null when no token stored', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('returns the stored access token', () => {
      localStorage.setItem('crm_access_token', 'abc');
      expect(getAccessToken()).toBe('abc');
    });
  });

  describe('getRefreshToken', () => {
    it('returns null when no token stored', () => {
      expect(getRefreshToken()).toBeNull();
    });

    it('returns the stored refresh token', () => {
      localStorage.setItem('crm_refresh_token', 'xyz');
      expect(getRefreshToken()).toBe('xyz');
    });
  });

  describe('setTokens', () => {
    it('stores both tokens in localStorage', () => {
      setTokens('access-123', 'refresh-456');
      expect(localStorage.getItem('crm_access_token')).toBe('access-123');
      expect(localStorage.getItem('crm_refresh_token')).toBe('refresh-456');
    });
  });

  describe('clearTokens', () => {
    it('removes both tokens from localStorage', () => {
      setTokens('access-123', 'refresh-456');
      clearTokens();
      expect(localStorage.getItem('crm_access_token')).toBeNull();
      expect(localStorage.getItem('crm_refresh_token')).toBeNull();
    });
  });

  describe('decodeJwtPayload', () => {
    it('decodes a valid JWT and returns sub and role', () => {
      const token = makeJwt({ sub: 'user-1', role: 'ADMIN' });
      expect(decodeJwtPayload(token)).toEqual({ sub: 'user-1', role: 'ADMIN' });
    });

    it('returns null for a malformed token', () => {
      expect(decodeJwtPayload('not.a.jwt')).toBeNull();
    });

    it('returns null when payload lacks required fields', () => {
      const token = makeJwt({ foo: 'bar' });
      expect(decodeJwtPayload(token)).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(decodeJwtPayload('')).toBeNull();
    });
  });
});
