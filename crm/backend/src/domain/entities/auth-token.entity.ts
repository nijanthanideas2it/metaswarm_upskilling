export interface AuthTokenEntity {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  deviceInfo: string | null | undefined;
  createdAt: Date;
}
