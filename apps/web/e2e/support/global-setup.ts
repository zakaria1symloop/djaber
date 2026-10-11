// Per-IP rate limits (sign-up 20/h, …) would make repeated local runs fail: clear the limiter counters of the
// development Redis before a run. Only `rl:*` keys of the local dev instance are touched.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export default async function globalSetup() {
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
