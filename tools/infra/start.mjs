// Local infrastructure without Docker (root CLAUDE.md "Prerequisites").
// Starts embedded Postgres 16 (port 54329) and a Redis-compatible server (port 63799), then stays alive.
import EmbeddedPostgres from 'embedded-postgres';
import { RedisMemoryServer } from 'redis-memory-server';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const local = resolve(root, '.local');
const pgDir = resolve(local, 'pg');
const pidFile = resolve(local, 'infra.pid');
const PG_PORT = 54329;
const REDIS_PORT = 63799;
mkdirSync(local, { recursive: true });

const portBusy = (port) =>
  new Promise((res) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => res(false));
  });

if ((await portBusy(PG_PORT)) && (await portBusy(REDIS_PORT))) {
  console.log(`[infra] already running (postgres :${PG_PORT}, redis :${REDIS_PORT})`);
  process.exit(0);
}

const pg = new EmbeddedPostgres({
  databaseDir: pgDir,
  user: 'djaber',
  password: 'djaber',
  port: PG_PORT,
  persistent: true,
  // Windows defaults to WIN1252: Arabic text needs UTF-8
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (e) => console.error('[pg]', String(e).trim()),
});
const fresh = !existsSync(resolve(pgDir, 'PG_VERSION'));
if (fresh) await pg.initialise();
// a stale lock file from a crash prevents start
if (existsSync(resolve(pgDir, 'postmaster.pid')) && !(await portBusy(PG_PORT))) rmSync(resolve(pgDir, 'postmaster.pid'));
await pg.start();
if (fresh) await pg.createDatabase('djaber');
// Extensions (pg_trgm, pgcrypto) are created by the first Prisma migration, not here (avoids schema drift).

const redis = new RedisMemoryServer({ instance: { port: REDIS_PORT } });
await redis.start();

writeFileSync(pidFile, String(process.pid));
console.log(`[infra] postgres ready  postgresql://djaber:djaber@localhost:${PG_PORT}/djaber`);
console.log(`[infra] redis ready     redis://127.0.0.1:${REDIS_PORT}`);
console.log('[infra] running — keep this process alive (Ctrl+C or `pnpm infra:down` to stop)');

const shutdown = async () => {
  try { await redis.stop(); } catch {}
  try { await pg.stop(); } catch {}
  try { rmSync(pidFile); } catch {}
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => {}, 1 << 30);
