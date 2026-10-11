// 09-code-conventions §2.3 / 01-nest-module-map §4.2 — Prisma client with the tenant extension.
import { PrismaClient } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { TENANT_MODELS } from './tenant-models';

const SCOPED_READS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

const base = new PrismaClient();

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args);
        const t = TenantContext.maybe();
        if (t?.bypass) return query(args);
        if (!t || !t.workspaceId) {
          if (process.env.ALLOW_NO_TENANT === '1') return query(args);
          throw new Error(`TenantContextMissing for ${model}.${operation}`);
        }
         
        const a: any = args ?? {};
        if (SCOPED_READS.has(operation)) {
          a.where = { AND: [{ workspaceId: t.workspaceId }, a.where ?? {}] };
        } else if (operation === 'findUnique' || operation === 'findUniqueOrThrow' || operation === 'update' || operation === 'delete') {
          // Unique-where operations cannot take AND at the top level: workspaceId is added as an extra filter
          // (Prisma 5+ allows non-unique fields next to the unique ones).
          a.where = { ...a.where, workspaceId: t.workspaceId };
        } else if (operation === 'create') {
          a.data = { workspaceId: t.workspaceId, ...a.data };
        } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
          a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({
            workspaceId: t.workspaceId,
            ...d,
          }));
        } else if (operation === 'upsert') {
          a.where = { ...a.where, workspaceId: t.workspaceId };
          a.create = { workspaceId: t.workspaceId, ...a.create };
        }
        return query(a);
      },
    },
  },
});

export type Db = typeof prisma;
/** Transaction client type of the extended client. */
export type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];
export const rawPrisma = base;
