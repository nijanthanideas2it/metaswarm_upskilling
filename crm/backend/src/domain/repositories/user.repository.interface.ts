import { UserEntity } from '../entities/user.entity';

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  updateFailedLoginAttempts(userId: string, count: number, lockedUntil: Date | null): Promise<void>;
  resetFailedLoginAttempts(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
