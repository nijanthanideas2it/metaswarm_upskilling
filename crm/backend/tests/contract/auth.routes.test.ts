import request from 'supertest';
import express from 'express';
import { AuthController } from '../../src/presentation/http/controllers/auth.controller';
import { validateRequest } from '../../src/presentation/http/middleware/validate-request.middleware';
import { authenticate } from '../../src/presentation/http/middleware/authenticate.middleware';
import { LoginSchema } from '../../src/application/dto/login.dto';
import { RefreshTokenSchema } from '../../src/application/dto/refresh-token.dto';
import { ForgotPasswordSchema } from '../../src/application/dto/forgot-password.dto';
import { ResetPasswordSchema } from '../../src/application/dto/reset-password.dto';
import type { LoginUseCase } from '../../src/application/use-cases/login.use-case';
import type { LogoutUseCase } from '../../src/application/use-cases/logout.use-case';
import type { RefreshTokenUseCase } from '../../src/application/use-cases/refresh-token.use-case';
import type { ForgotPasswordUseCase } from '../../src/application/use-cases/forgot-password.use-case';
import type { ResetPasswordUseCase } from '../../src/application/use-cases/reset-password.use-case';
import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountDeactivatedError,
  InvalidRefreshTokenError,
  InvalidResetTokenError,
  SamePasswordError,
} from '../../src/domain/errors/domain.error';
import { Role } from '../../src/domain/enums';
import { createMockJwtService } from '../helpers/mocks';

function buildMockUseCases() {
  return {
    loginUseCase: { execute: jest.fn() },
    logoutUseCase: { execute: jest.fn() },
    refreshTokenUseCase: { execute: jest.fn() },
    forgotPasswordUseCase: { execute: jest.fn() },
    resetPasswordUseCase: { execute: jest.fn() },
  };
}

function createTestApp(mocks: ReturnType<typeof buildMockUseCases>) {
  const jwtService = createMockJwtService();
  jwtService.verifyAccessToken.mockReturnValue({ sub: 'user-id-1', role: Role.SUPPORT_AGENT });

  const controller = new AuthController(
    mocks.loginUseCase as unknown as LoginUseCase,
    mocks.logoutUseCase as unknown as LogoutUseCase,
    mocks.refreshTokenUseCase as unknown as RefreshTokenUseCase,
    mocks.forgotPasswordUseCase as unknown as ForgotPasswordUseCase,
    mocks.resetPasswordUseCase as unknown as ResetPasswordUseCase,
  );

  const app = express();
  app.use(express.json());

  app.post('/api/v1/auth/login', validateRequest(LoginSchema), controller.login);
  app.post('/api/v1/auth/logout', authenticate(jwtService), validateRequest(RefreshTokenSchema), controller.logout);
  app.post('/api/v1/auth/refresh', validateRequest(RefreshTokenSchema), controller.refresh);
  app.post('/api/v1/auth/forgot-password', validateRequest(ForgotPasswordSchema), controller.forgotPassword);
  app.post('/api/v1/auth/reset-password', validateRequest(ResetPasswordSchema), controller.resetPassword);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ data: null, meta: null, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  });

  return app;
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks);
  });

  it('returns 200 with token pair on valid credentials', async () => {
    mocks.loginUseCase.execute.mockResolvedValue({
      accessToken: 'jwt',
      refreshToken: 'raw-token',
      expiresIn: 900,
      user: { id: 'user-id-1', email: 'agent@example.com', role: Role.SUPPORT_AGENT },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'agent@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      accessToken: 'jwt',
      refreshToken: 'raw-token',
      expiresIn: 900,
    });
    expect(res.body.error).toBeNull();
  });

  it('returns 422 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'secret123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for invalid credentials', async () => {
    mocks.loginUseCase.execute.mockRejectedValue(new InvalidCredentialsError());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'agent@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 for locked account', async () => {
    mocks.loginUseCase.execute.mockRejectedValue(new AccountLockedError());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'agent@example.com', password: 'secret123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('returns 403 for deactivated account', async () => {
    mocks.loginUseCase.execute.mockRejectedValue(new AccountDeactivatedError());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'agent@example.com', password: 'secret123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/logout', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks);
  });

  it('returns 204 on successful logout', async () => {
    mocks.logoutUseCase.execute.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid-token')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(204);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 when refreshToken is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/refresh', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks);
  });

  it('returns 200 with new token pair on valid refresh token', async () => {
    mocks.refreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'new-jwt',
      refreshToken: 'new-raw-token',
      expiresIn: 900,
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'old-raw-token' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ accessToken: 'new-jwt', refreshToken: 'new-raw-token' });
  });

  it('returns 401 for invalid refresh token', async () => {
    mocks.refreshTokenUseCase.execute.mockRejectedValue(new InvalidRefreshTokenError());

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'expired-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 422 when refreshToken body field is missing', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/forgot-password', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks);
  });

  it('returns 200 with same message regardless of whether email exists', async () => {
    mocks.forgotPasswordUseCase.execute.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'agent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('If this email is registered, a reset link has been sent.');
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'bad-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/reset-password
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/reset-password', () => {
  let mocks: ReturnType<typeof buildMockUseCases>;
  let app: express.Express;

  beforeEach(() => {
    mocks = buildMockUseCases();
    app = createTestApp(mocks);
  });

  it('returns 200 on successful password reset', async () => {
    mocks.resetPasswordUseCase.execute.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'valid-token', newPassword: 'NewSecure99' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Password has been reset successfully');
  });

  it('returns 400 for invalid or expired reset token', async () => {
    mocks.resetPasswordUseCase.execute.mockRejectedValue(new InvalidResetTokenError());

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'expired-token', newPassword: 'NewSecure99' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('returns 422 when new password is same as current', async () => {
    mocks.resetPasswordUseCase.execute.mockRejectedValue(new SamePasswordError());

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'valid-token', newPassword: 'NewSecure99' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('newPassword');
  });

  it('returns 422 when newPassword fails complexity validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'valid-token', newPassword: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
