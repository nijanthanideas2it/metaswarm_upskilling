import { ForgotPasswordSchema } from '../../../../src/application/dto/forgot-password.dto';
import { LoginSchema } from '../../../../src/application/dto/login.dto';
import { RefreshTokenSchema } from '../../../../src/application/dto/refresh-token.dto';
import { ResetPasswordSchema } from '../../../../src/application/dto/reset-password.dto';

describe('LoginSchema', () => {
  it('accepts valid email and password', () => {
    expect(LoginSchema.safeParse({ email: 'user@example.com', password: 'pass123' }).success).toBe(true);
  });

  it('rejects malformed email', () => {
    expect(LoginSchema.safeParse({ email: 'not-an-email', password: 'pass123' }).success).toBe(false);
  });

  it('rejects email over 254 characters', () => {
    const long = 'a'.repeat(244) + '@example.com'; // 256 chars
    expect(LoginSchema.safeParse({ email: long, password: 'pass123' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(LoginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });

  it('rejects password over 72 characters', () => {
    expect(LoginSchema.safeParse({ email: 'user@example.com', password: 'a'.repeat(73) }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(LoginSchema.safeParse({}).success).toBe(false);
  });
});

describe('RefreshTokenSchema', () => {
  it('accepts a non-empty token string', () => {
    expect(RefreshTokenSchema.safeParse({ refreshToken: 'some-token' }).success).toBe(true);
  });

  it('rejects empty token', () => {
    expect(RefreshTokenSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });

  it('rejects missing token', () => {
    expect(RefreshTokenSchema.safeParse({}).success).toBe(false);
  });
});

describe('ForgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('rejects malformed email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });

  it('rejects email over 254 characters', () => {
    const long = 'a'.repeat(244) + '@example.com';
    expect(ForgotPasswordSchema.safeParse({ email: long }).success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts valid token and compliant password', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'abc', newPassword: 'Password1' }).success).toBe(true);
  });

  it('rejects empty token', () => {
    expect(ResetPasswordSchema.safeParse({ token: '', newPassword: 'Password1' }).success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'abc', newPassword: 'Pass1' }).success).toBe(false);
  });

  it('rejects password over 72 characters', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'abc', newPassword: 'A1' + 'a'.repeat(71) }).success).toBe(false);
  });

  it('rejects password with no letter', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'abc', newPassword: '12345678' }).success).toBe(false);
  });

  it('rejects password with no number', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'abc', newPassword: 'abcdefgh' }).success).toBe(false);
  });

  it('accepts password at exactly 8 characters with letter and number', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'abc', newPassword: 'Passw0rd' }).success).toBe(true);
  });
});
