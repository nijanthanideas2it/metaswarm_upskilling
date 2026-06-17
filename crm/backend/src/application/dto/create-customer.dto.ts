import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200).trim(),
  email: z.string().email().max(254),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(100).optional(),
  organizationId: z.string().uuid().optional(),
});

export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
