import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../../../src/presentation/http/middleware/validate-request.middleware';

const TestSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

function makeReqRes(body: unknown): { req: Request; res: Partial<Response>; next: NextFunction; jsonSpy: jest.Mock } {
  const jsonSpy = jest.fn();
  const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
  return {
    req: { body } as Request,
    res: { status: statusSpy, json: jsonSpy } as unknown as Partial<Response>,
    next: jest.fn() as NextFunction,
    jsonSpy,
  };
}

describe('validateRequest middleware', () => {
  describe('valid body', () => {
    it('calls next() and replaces req.body with parsed data', () => {
      const { req, res, next } = makeReqRes({ email: 'user@example.com', age: 25 });
      validateRequest(TestSchema)(req, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body).toEqual({ email: 'user@example.com', age: 25 });
    });

    it('does not call res.status when body is valid', () => {
      const { req, res, next } = makeReqRes({ email: 'user@example.com', age: 25 });
      validateRequest(TestSchema)(req, res as Response, next);
      expect((res.status as jest.Mock)).not.toHaveBeenCalled();
    });
  });

  describe('invalid body', () => {
    it('responds 422 and does not call next() on schema violation', () => {
      const { req, res, next } = makeReqRes({ email: 'not-an-email', age: 25 });
      validateRequest(TestSchema)(req, res as Response, next);
      expect((res.status as jest.Mock)).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
    });

    it('response body has VALIDATION_ERROR code', () => {
      const { req, res, next } = makeReqRes({ email: 'bad', age: 25 });
      validateRequest(TestSchema)(req, res as Response, next);
      const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.data).toBeNull();
      expect(body.meta).toBeNull();
    });

    it('includes per-field details in error response', () => {
      const { req, res, next } = makeReqRes({ email: 'bad', age: -1 });
      validateRequest(TestSchema)(req, res as Response, next);
      const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
      expect(Array.isArray(body.error.details)).toBe(true);
      expect(body.error.details.length).toBeGreaterThanOrEqual(2);
      const fields = body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('email');
      expect(fields).toContain('age');
    });

    it('responds 422 on completely empty body', () => {
      const { req, res, next } = makeReqRes({});
      validateRequest(TestSchema)(req, res as Response, next);
      expect((res.status as jest.Mock)).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 422 when body is null', () => {
      const { req, res, next } = makeReqRes(null);
      validateRequest(TestSchema)(req, res as Response, next);
      expect((res.status as jest.Mock)).toHaveBeenCalledWith(422);
    });
  });

  describe('envelope shape', () => {
    it('envelope always has data, meta, error keys on failure', () => {
      const { req, res } = makeReqRes({});
      validateRequest(TestSchema)(req, res as Response, jest.fn());
      const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
      expect(Object.keys(body)).toEqual(expect.arrayContaining(['data', 'meta', 'error']));
    });
  });
});
