// Per-IP rate limits (sign-up 20/h, …) would make repeated local runs fail: clear the limiter counters of the
// development Redis before a run. Only `rl:*` keys of the local dev instance are touched.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

/** Clears the limiter counters (`rl:*`) of the local development Redis. */
export async function clearRateLimits() {
  const require = createRequire(resolve(__dirname, '../../../api/package.json'));
  const Redis = require('ioredis');
  const redis = new Redis(process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:63799', { maxRetriesPerRequest: 2 });
  try {
    const keys: string[] = await redis.keys('rl:*');
    if (keys.length) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}

/**
 * M10 (D52): a new workspace starts at trust level `new`, so every product it creates waits for a moderator. The e2e
 * workspaces are moved to `standard` (contract-b: "the web e2e workspaces must be standard") so clean products are
 * approved at once, as in M2–M9; the moderation specs create their pending items with a protected-brand rule.
 */
export async function trustWorkspace(workspaceId: string) {
  const require = createRequire(resolve(__dirname, '../../../../packages/db/package.json'));
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL ?? 'postgresql://djaber:djaber@localhost:54329/djaber' });
  try {
    await db.$executeRawUnsafe(`UPDATE "Workspace" SET "trustLevel" = 'standard' WHERE "id" = $1::uuid AND "trustLevel" = 'new'`, workspaceId);
  } finally {
    await db.$disconnect();
  }
}

export default async function globalSetup() {
  await clearRateLimits();
}
