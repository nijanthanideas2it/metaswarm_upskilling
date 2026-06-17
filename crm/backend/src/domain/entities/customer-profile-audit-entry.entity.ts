export interface CustomerProfileAuditEntryEntity {
  id: string;
  customerId: string;
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  changedById: string;
  changedAt: Date;
}
