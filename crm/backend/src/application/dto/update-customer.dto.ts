import { z } from 'zod';

export const UpdateCustomerSchema = z.object({
  fullName: z.string().min(1).max(200).trim().optional(),
  phone: z.string().max(30).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  /** Org association change — Admin/Manager only (enforced by use case). */
  organizationId: z.string().uuid().nullable().optional(),
  /** Email change — Admin only (enforced by use case). */
  email: z.string().email().max(254).optional(),
});

export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;
