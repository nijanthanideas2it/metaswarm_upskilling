import { Email } from '../../../../src/domain/value-objects/email.value-object';
import { InvalidEmailError, DomainError } from '../../../../src/domain/errors/domain.error';

describe('Email value object', () => {
  describe('valid construction', () => {
    it('accepts a standard email and stores normalised value', () => {
      const email = new Email('user@example.com');
      expect(email.value).toBe('user@example.com');
    });

    it('normalises uppercase to lowercase', () => {
      const email = new Email('USER@EXAMPLE.COM');
      expect(email.value).toBe('user@example.com');
    });

    it('trims leading and trailing whitespace', () => {
      const email = new Email('  user@example.com  ');
      expect(email.value).toBe('user@example.com');
    });

    it('trims and normalises combined', () => {
      const email = new Email('  USER@EXAMPLE.COM  ');
      expect(email.value).toBe('user@example.com');
    });

    it('accepts plus-tagged addresses', () => {
      const email = new Email('user+tag@sub.example.com');
      expect(email.value).toBe('user+tag@sub.example.com');
    });

    it('accepts a minimal valid address', () => {
      const email = new Email('a@b.co');
      expect(email.value).toBe('a@b.co');
    });

    it('accepts an address exactly 254 characters long', () => {
      // 254 = 1 (local) + 1 (@) + 248 (domain) + 1 (.) + 3 (tld)
      const local = 'a';
      const domain = 'b'.repeat(248);
      const address = `${local}@${domain}.com`;
      expect(address.length).toBe(254);
      expect(new Email(address).value).toBe(address);
    });
  });

  describe('invalid construction — throws InvalidEmailError', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['no @ symbol', 'notanemail'],
      ['no dot in domain', 'user@nodot'],
      ['empty local part', '@domain.com'],
      ['empty domain', 'user@'],
      ['space in local part', 'user name@example.com'],
      ['space in domain', 'user@do main.com'],
      ['double @', 'user@@domain.com'],
    ])('%s: "%s"', (_label, input) => {
      expect(() => new Email(input)).toThrow(InvalidEmailError);
    });

    it('rejects an address over 254 characters', () => {
      const address = 'a@' + 'b'.repeat(249) + '.com'; // 255 chars
      expect(address.length).toBeGreaterThan(254);
      expect(() => new Email(address)).toThrow(InvalidEmailError);
    });
  });

  describe('thrown error type', () => {
    it('thrown error is an instance of InvalidEmailError', () => {
      expect(() => new Email('bad')).toThrow(InvalidEmailError);
    });

    it('thrown error is an instance of DomainError via instanceof chain', () => {
      try {
        new Email('bad');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
      }
    });
  });
});
