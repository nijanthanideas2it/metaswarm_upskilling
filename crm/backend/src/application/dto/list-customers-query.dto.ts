import { z } from 'zod';

export const ListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'DEACTIVATED']).optional(),
  sortBy: z.enum(['fullName', 'email', 'createdAt']).default('fullName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  organizationId: z.string().uuid().optional(),
});

export type ListCustomersQueryDto = z.infer<typeof ListCustomersQuerySchema>;

export const SearchCustomersQuerySchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters').max(200),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchCustomersQueryDto = z.infer<typeof SearchCustomersQuerySchema>;
