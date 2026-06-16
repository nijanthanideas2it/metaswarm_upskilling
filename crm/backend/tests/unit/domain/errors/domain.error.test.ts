import {
  DomainError,
  InvalidEmailError,
  InvalidCredentialsError,
  AccountLockedError,
  AccountDeactivatedError,
  InvalidRefreshTokenError,
  InvalidResetTokenError,
  SamePasswordError,
  PasswordComplexityError,
} from '../../../../src/domain/errors/domain.error';

describe('DomainError base class', () => {
  it('is an instance of Error', () => {
    const err = new DomainError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('sets the message correctly', () => {
    const err = new DomainError('test message');
    expect(err.message).toBe('test message');
  });

  it('sets name to the class name', () => {
    const err = new DomainError('test');
    expect(err.name).toBe('DomainError');
  });
});

describe('InvalidEmailError', () => {
  it('is instanceof InvalidEmailError', () => {
    expect(new InvalidEmailError()).toBeInstanceOf(InvalidEmailError);
  });

  it('is instanceof DomainError', () => {
    expect(new InvalidEmailError()).toBeInstanceOf(DomainError);
  });

  it('is instanceof Error', () => {
    expect(new InvalidEmailError()).toBeInstanceOf(Error);
  });

  it('has name InvalidEmailError', () => {
    expect(new InvalidEmailError().name).toBe('InvalidEmailError');
  });

  it('can be caught as DomainError', () => {
    const fn = (): never => { throw new InvalidEmailError(); };
    expect(fn).toThrow(DomainError);
  });
});

describe.each([
  ['InvalidCredentialsError', InvalidCredentialsError],
  ['AccountLockedError', AccountLockedError],
  ['AccountDeactivatedError', AccountDeactivatedError],
  ['InvalidRefreshTokenError', InvalidRefreshTokenError],
  ['InvalidResetTokenError', InvalidResetTokenError],
  ['SamePasswordError', SamePasswordError],
  ['PasswordComplexityError', PasswordComplexityError],
])('%s', (name, ErrorClass) => {
  it('is instanceof DomainError', () => {
    expect(new ErrorClass()).toBeInstanceOf(DomainError);
  });

  it('is instanceof Error', () => {
    expect(new ErrorClass()).toBeInstanceOf(Error);
  });

  it(`has name ${name}`, () => {
    expect(new ErrorClass().name).toBe(name);
  });

  it('can be caught as DomainError', () => {
    const fn = (): never => { throw new ErrorClass(); };
    expect(fn).toThrow(DomainError);
  });
});
