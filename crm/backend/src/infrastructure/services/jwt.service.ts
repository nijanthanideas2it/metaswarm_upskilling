import * as jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { IJwtService, AccessTokenPayload } from '../../application/ports/jwt.port';
import { Role } from '../../domain/enums';
import { InvalidRefreshTokenError } from '../../domain/errors/domain.error';

/**
 * Raw shape of the decoded JWT payload from jsonwebtoken.
 * Extends JwtPayload so we can narrow the fields we care about.
 */
interface RawJwtPayload extends jwt.JwtPayload {
  sub: string;
  role: Role;
}

export class JwtService implements IJwtService {
  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(
      { sub: payload.sub, role: payload.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as RawJwtPayload;
      return { sub: decoded.sub, role: decoded.role };
    } catch (error) {
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError
      ) {
        throw new InvalidRefreshTokenError();
      }
      throw error;
    }
  }
}
