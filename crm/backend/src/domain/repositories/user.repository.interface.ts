import { UserEntity } from '../entities/user.entity';

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  /**
   * Atomically increments failedLoginAttempts at the DB level.
   * Sets lockedUntil if the new count reaches lockThreshold.
   * Returns post-increment state so the caller can inspect lock status.
   */
  incrementFailedLoginAttempts(
    userId: string,
    lockThreshold: number,
    lockDurationMs: number,
  ): Promise<{ failedLoginAttempts: number; lockedUntil: Date | null }>;
  resetFailedLoginAttempts(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
