// Mock env BEFORE importing JwtService
jest.mock('../../../../src/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
    JWT_EXPIRES_IN: 900,
  },
}));

import { JwtService } from '../../../../src/infrastructure/services/jwt.service';
import { Role } from '../../../../src/domain/enums';
import { InvalidRefreshTokenError } from '../../../../src/domain/errors/domain.error';

describe('JwtService', () => {
  let service: JwtService;

  beforeEach(() => {
    service = new JwtService();
  });

  describe('signAccessToken', () => {
    it('returns a non-empty string', () => {
      const token = service.signAccessToken({ sub: 'user-1', role: Role.ADMIN });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('produces a JWT with three dot-separated parts', () => {
      const token = service.signAccessToken({ sub: 'user-1', role: Role.SUPPORT_AGENT });
      expect(token.split('.').length).toBe(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('round-trips: verify returns the original payload', () => {
      const payload = { sub: 'user-123', role: Role.CUSTOMER };
      const token = service.signAccessToken(payload);
      const decoded = service.verifyAccessToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.role).toBe(Role.CUSTOMER);
    });

    it('throws InvalidRefreshTokenError for a tampered token', () => {
      const token = service.signAccessToken({ sub: 'u1', role: Role.ADMIN });
      expect(() => service.verifyAccessToken(token + 'tampered')).toThrow(InvalidRefreshTokenError);
    });

    it('throws InvalidRefreshTokenError for a completely invalid string', () => {
      expect(() => service.verifyAccessToken('not.a.jwt')).toThrow(InvalidRefreshTokenError);
    });

  });
});
