import { prisma, type Tx } from '@djaber/db';

/** The transaction client of the caller, or the shared client when the call is not part of a transaction. */
export const dbOf = (tx?: Tx): Tx => tx ?? (prisma as unknown as Tx);
