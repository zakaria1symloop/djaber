import { z } from 'zod';

/** api-contract §1.6: pageSize ∈ {25, 50, 100}, default 25. */
export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => n === 25 || n === 50 || n === 100, 'validation.range')
    .default(25),
  sort: z
    .string()
    .regex(/^-?[a-zA-Z]+$/)
    .optional(),
  view: z.string().uuid().optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

/** Cursor lists (inbox, messages, notifications): limit ≤ 50, default 50. */
export const CursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export type CursorQuery = z.infer<typeof CursorQuery>;

/** api-contract: one entry per row/detail action; the UI builds the `Actions ⌄` menu from it. */
export type ActionDescriptor = {
  key: string;
  enabled: boolean;
  reasonCode?: string;
  primary?: boolean;
  shortcut?: string;
};
