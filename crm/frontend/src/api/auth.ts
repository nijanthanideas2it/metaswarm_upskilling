export type { ApiErrorBody } from './http';
export { ApiError } from './http';
import { httpPost } from './http';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; role: string };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return httpPost<LoginResponse>('/api/v1/auth/login', { email, password });
}

export async function logout(refreshToken: string, accessToken: string): Promise<void> {
  await httpPost<null>('/api/v1/auth/logout', { refreshToken }, accessToken);
}

export async function refresh(refreshToken: string): Promise<RefreshResponse> {
  return httpPost<RefreshResponse>('/api/v1/auth/refresh', { refreshToken });
}

export async function forgotPassword(email: string): Promise<void> {
  await httpPost<null>('/api/v1/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await httpPost<null>('/api/v1/auth/reset-password', { token, newPassword });
}
