import { PasswordComplexityError } from '../errors/domain.error';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export class Password {
  private readonly _value: string;

  constructor(raw: string) {
    if (!PASSWORD_REGEX.test(raw)) {
      throw new PasswordComplexityError();
    }
    this._value = raw;
  }

  get value(): string {
    return this._value;
  }
}
