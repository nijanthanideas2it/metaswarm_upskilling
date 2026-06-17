import type { NextFunction, Request, Response } from 'express';
import type { AccessTokenPayload } from '../../../application/ports/jwt.port';
import type { IJwtService } from '../../../application/ports/jwt.port';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(jwtService: IJwtService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        data: null,
        meta: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.', details: null },
      });
      return;
    }

    const token = authHeader.slice(7);

    try {
      req.user = jwtService.verifyAccessToken(token);
      next();
    } catch {
      res.status(401).json({
        data: null,
        meta: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.', details: null },
      });
    }
  };
}
