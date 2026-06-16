import { AuthEventLogEntity } from '../entities/auth-event-log.entity';
import { AuthEvent } from '../enums';

export interface IAuthEventLogRepository {
  create(data: {
    userId: string | null;
    event: AuthEvent;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<AuthEventLogEntity>;
}
