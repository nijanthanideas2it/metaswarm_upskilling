import * as bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { IBcryptService } from '../../application/ports/bcrypt.port';

export class BcryptService implements IBcryptService {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_COST_FACTOR);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
