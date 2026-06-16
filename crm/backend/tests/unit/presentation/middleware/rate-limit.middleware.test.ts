import type { Request, Response } from 'express';

// Capture handler options at rateLimit() construction time
let capturedLoginHandler: ((req: Request, res: Response, next: () => void) => void) | undefined;
let capturedAuthHandler: ((req: Request, res: Response, next: () => void) => void) | undefined;

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation((options: { max?: number; handler?: Function }) => {
    const middleware = jest.fn();
    if (options.max === 10) {
      capturedLoginHandler = options.handler as typeof capturedLoginHandler;
    } else {
      capturedAuthHandler = options.handler as typeof capturedAuthHandler;
    }
    return middleware;
  });
});

// Import after mock is registered
import { authRateLimit, loginRateLimit } from '../../../../src/presentation/http/middleware/rate-limit.middleware';

function makeRes(): { res: Partial<Response>; statusSpy: jest.Mock; jsonSpy: jest.Mock } {
  const jsonSpy = jest.fn();
  const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
  return { res: { status: statusSpy } as unknown as Partial<Response>, statusSpy, jsonSpy };
}

describe('Rate limit middleware', () => {
  describe('loginRateLimit', () => {
    it('is an Express middleware function', () => {
      expect(typeof loginRateLimit).toBe('function');
    });

    it('handler responds 429', () => {
      const { res, statusSpy } = makeRes();
      expect(capturedLoginHandler).toBeDefined();
      capturedLoginHandler!({} as Request, res as Response, jest.fn());
      expect(statusSpy).toHaveBeenCalledWith(429);
    });

    it('handler body has RATE_LIMIT_EXCEEDED code with null data and meta', () => {
      const { res, statusSpy } = makeRes();
      capturedLoginHandler!({} as Request, res as Response, jest.fn());
      const body = statusSpy.mock.results[0].value.json.mock.calls[0][0];
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.data).toBeNull();
      expect(body.meta).toBeNull();
    });
  });

  describe('authRateLimit', () => {
    it('is an Express middleware function', () => {
      expect(typeof authRateLimit).toBe('function');
    });

    it('handler responds 429', () => {
      const { res, statusSpy } = makeRes();
      expect(capturedAuthHandler).toBeDefined();
      capturedAuthHandler!({} as Request, res as Response, jest.fn());
      expect(statusSpy).toHaveBeenCalledWith(429);
    });

    it('handler body has RATE_LIMIT_EXCEEDED code with null data and meta', () => {
      const { res, statusSpy } = makeRes();
      capturedAuthHandler!({} as Request, res as Response, jest.fn());
      const body = statusSpy.mock.results[0].value.json.mock.calls[0][0];
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.data).toBeNull();
      expect(body.meta).toBeNull();
    });
  });
});
