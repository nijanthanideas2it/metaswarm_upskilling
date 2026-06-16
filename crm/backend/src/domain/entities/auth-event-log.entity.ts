import { AuthEvent } from '../enums';

export interface AuthEventLogEntity {
  id: string;
  userId: string | null;
  event: AuthEvent;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
