import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../../../domain/enums';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const caller = req.user;
    if (!caller || !roles.includes(caller.role as Role)) {
      res.status(403).json({
        data: null,
        meta: null,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.', details: null },
      });
      return;
    }
    next();
  };
}
