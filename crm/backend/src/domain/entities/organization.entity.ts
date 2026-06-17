export interface OrganizationEntity {
  id: string;
  name: string;
  emailDomain: string | null;
  industry: string | null;
  primaryContactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
