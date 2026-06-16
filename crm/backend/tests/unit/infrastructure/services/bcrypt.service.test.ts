jest.mock('../../../../src/config/env', () => ({
  env: { BCRYPT_COST_FACTOR: 4 }, // low cost for tests
}));

import { BcryptService } from '../../../../src/infrastructure/services/bcrypt.service';

describe('BcryptService', () => {
  let service: BcryptService;

  beforeEach(() => {
    service = new BcryptService();
  });

  describe('hash', () => {
    it('returns a string different from the input', async () => {
      const hash = await service.hash('myPassword1');
      expect(hash).not.toBe('myPassword1');
      expect(typeof hash).toBe('string');
    });

    it('produces different hashes for the same input (salt)', async () => {
      const hash1 = await service.hash('myPassword1');
      const hash2 = await service.hash('myPassword1');
      expect(hash1).not.toBe(hash2);
    });

    it('produces a bcrypt hash (starts with $2a$ or $2b$)', async () => {
      const hash = await service.hash('myPassword1');
      // bcryptjs produces $2a$ prefixed hashes; both $2a$ and $2b$ are valid bcrypt formats
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    });
  });

  describe('compare', () => {
    it('returns true for matching password and hash', async () => {
      const hash = await service.hash('correct-password');
      expect(await service.compare('correct-password', hash)).toBe(true);
    });

    it('returns false for non-matching password', async () => {
      const hash = await service.hash('correct-password');
      expect(await service.compare('wrong-password', hash)).toBe(false);
    });
  });
});
