const ACCESS_TOKEN_KEY = 'crm_access_token';
const REFRESH_TOKEN_KEY = 'crm_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function decodeJwtPayload(token: string): { sub: string; role: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const decoded = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as unknown;
    if (typeof decoded !== 'object' || decoded === null) return null;
    const obj = decoded as Record<string, unknown>;
    if (typeof obj['sub'] !== 'string' || typeof obj['role'] !== 'string') return null;
    return { sub: obj['sub'], role: obj['role'] };
  } catch {
    return null;
  }
}
