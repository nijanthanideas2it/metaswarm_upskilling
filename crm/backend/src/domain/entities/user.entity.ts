import { Role, AccountStatus } from '../enums';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: AccountStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
