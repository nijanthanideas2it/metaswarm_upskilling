import { Password } from '../../../../src/domain/value-objects/password.value-object';
import { PasswordComplexityError } from '../../../../src/domain/errors/domain.error';

describe('Password', () => {
  describe('valid passwords', () => {
    it('accepts a password with letters and digits meeting minimum length', () => {
      const pw = new Password('Password1');
      expect(pw.value).toBe('Password1');
    });

    it('accepts a complex password with special characters', () => {
      const pw = new Password('Tr0ub4dor&3');
      expect(pw.value).toBe('Tr0ub4dor&3');
    });

    it('accepts a password exactly 8 characters long', () => {
      const pw = new Password('Passw0rd');
      expect(pw.value).toBe('Passw0rd');
    });
  });

  describe('invalid passwords', () => {
    it('throws PasswordComplexityError when password is fewer than 8 characters', () => {
      expect(() => new Password('Abc1')).toThrow(PasswordComplexityError);
    });

    it('throws PasswordComplexityError when password has no digits', () => {
      expect(() => new Password('OnlyLetters')).toThrow(PasswordComplexityError);
    });

    it('throws PasswordComplexityError when password has no letters', () => {
      expect(() => new Password('12345678')).toThrow(PasswordComplexityError);
    });

    it('throws PasswordComplexityError for empty string', () => {
      expect(() => new Password('')).toThrow(PasswordComplexityError);
    });
  });
});
