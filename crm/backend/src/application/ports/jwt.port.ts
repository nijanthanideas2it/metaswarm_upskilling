import { Role } from '../../domain/enums';

export interface AccessTokenPayload {
  sub: string;   // userId
  role: Role;
}

export interface IJwtService {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AccessTokenPayload;
}
