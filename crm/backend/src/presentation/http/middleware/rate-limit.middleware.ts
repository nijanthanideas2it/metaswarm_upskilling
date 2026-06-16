import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const loginRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      data: null,
      meta: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts, please try again later',
      },
    });
  },
});

export const authRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      data: null,
      meta: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    });
  },
});
