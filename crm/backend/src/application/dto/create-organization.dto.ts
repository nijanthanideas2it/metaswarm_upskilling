import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200).trim(),
  emailDomain: z
    .string()
    .max(253)
    .refine((v) => !v.includes('@') && !v.startsWith('http'), {
      message: 'emailDomain must be in format domain.tld — no @ or http prefix',
    })
    .optional(),
  industry: z.string().max(100).optional(),
  primaryContactId: z.string().uuid().optional(),
});

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
