import { InvalidEmailError } from '../errors/domain.error';

// RFC 5321 permits local parts up to 64 chars and domains up to 255 chars.
// This regex covers the common subset used in practice.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private readonly _value: string;

  constructor(raw: string) {
    const normalised = raw.trim().toLowerCase();
    if (normalised.length > 254) {
      throw new InvalidEmailError();
    }
    if (!EMAIL_REGEX.test(normalised)) {
      throw new InvalidEmailError();
    }
    this._value = normalised;
  }

  get value(): string {
    return this._value;
  }
}
