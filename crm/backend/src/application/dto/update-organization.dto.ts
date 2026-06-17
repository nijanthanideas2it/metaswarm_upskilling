import { z } from 'zod';

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  emailDomain: z
    .string()
    .max(253)
    .refine((v) => !v.includes('@') && !v.startsWith('http'), {
      message: 'emailDomain must be in format domain.tld — no @ or http prefix',
    })
    .nullable()
    .optional(),
  industry: z.string().max(100).nullable().optional(),
  primaryContactId: z.string().uuid().nullable().optional(),
});

export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>;
