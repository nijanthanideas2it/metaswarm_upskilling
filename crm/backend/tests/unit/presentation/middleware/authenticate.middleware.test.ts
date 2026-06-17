import { authenticate } from '../../../../src/presentation/http/middleware/authenticate.middleware';
import { createMockJwtService } from '../../../helpers/mocks';
import { Role } from '../../../../src/domain/enums';
import type { Request, Response } from 'express';

function buildReq(authHeader?: string): Request {
  return {
    headers: { authorization: authHeader },
  } as unknown as Request;
}

function buildRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('authenticate middleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    next.mockClear();
  });

  describe('when Authorization header is missing', () => {
    it('returns 401 UNAUTHORIZED', () => {
      const jwtService = createMockJwtService();
      const middleware = authenticate(jwtService);
      const req = buildReq(undefined);
      const res = buildRes();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect((res.json as jest.Mock).mock.calls[0][0].error.code).toBe('UNAUTHORIZED');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('when Authorization header does not start with Bearer', () => {
    it('returns 401 UNAUTHORIZED', () => {
      const jwtService = createMockJwtService();
      const middleware = authenticate(jwtService);
      const req = buildReq('Basic sometoken');
      const res = buildRes();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('when token is invalid or expired', () => {
    it('returns 401 UNAUTHORIZED', () => {
      const jwtService = createMockJwtService();
      jwtService.verifyAccessToken.mockImplementation(() => { throw new Error('invalid'); });
      const middleware = authenticate(jwtService);
      const req = buildReq('Bearer bad-token');
      const res = buildRes();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('when token is valid', () => {
    it('attaches payload to req.user and calls next', () => {
      const jwtService = createMockJwtService();
      const payload = { sub: 'user-id-1', role: Role.ADMIN };
      jwtService.verifyAccessToken.mockReturnValue(payload);
      const middleware = authenticate(jwtService);
      const req = buildReq('Bearer valid-token');
      const res = buildRes();

      middleware(req, res, next);

      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect((req as Request & { user: unknown }).user).toEqual(payload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
