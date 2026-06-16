export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidEmailError extends DomainError {
  constructor() {
    super('Invalid email address format');
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password');
  }
}

export class AccountLockedError extends DomainError {
  constructor() {
    super('Account is temporarily locked due to too many failed login attempts');
  }
}

export class AccountDeactivatedError extends DomainError {
  constructor() {
    super('Account has been deactivated. Please contact support');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('Refresh token is invalid or has expired');
  }
}

export class InvalidResetTokenError extends DomainError {
  constructor() {
    super('Password reset link is invalid or has expired');
  }
}

export class SamePasswordError extends DomainError {
  constructor() {
    super('New password must be different from your current password');
  }
}

export class PasswordComplexityError extends DomainError {
  constructor() {
    super('Password must be at least 8 characters and contain at least one letter and one number');
  }
}
