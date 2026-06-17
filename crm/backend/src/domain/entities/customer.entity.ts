import { Role, AccountStatus } from '../enums';

export interface CustomerEntity {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined from User — always present when fetched through the customer repository
  email: string;
  role: Role;
  status: AccountStatus;
}
