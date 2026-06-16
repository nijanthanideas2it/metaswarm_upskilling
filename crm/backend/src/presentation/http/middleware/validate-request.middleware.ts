import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      res.status(422).json({
        data: null,
        meta: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
