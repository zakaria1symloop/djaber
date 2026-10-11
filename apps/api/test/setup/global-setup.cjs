// Integration-test infrastructure without Docker (root CLAUDE.md):
//  - Postgres: the embedded cluster of `pnpm infra:up` when it is running, otherwise a private embedded cluster;
//    tests always use their own database `djaber_test` (migrated + seeded here).
//  - Redis: db 1 of the local instance when running, otherwise redis-memory-server.
const { execSync } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const net = require('node:net');
const { resolve } = require('node:path');
const { Client } = require('pg');

const ROOT = resolve(__dirname, '../../../..');
const portOpen = (port) =>
  new Promise((res) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), res(true)));
    s.once('error', () => res(false));
  });

module.exports = async () => {
  let pgPort = 54329;
  if (!(await portOpen(pgPort))) {
    const EmbeddedPostgres = (await import('embedded-postgres')).default;
    pgPort = 54339;
    const dir = resolve(ROOT, '.local/test-pg');
    const pg = new EmbeddedPostgres({
      databaseDir: dir,
      user: 'djaber',
      password: 'djaber',
      port: pgPort,
      persistent: true,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      onLog: () => {},
      onError: () => {},
    });
    if (!existsSync(resolve(dir, 'PG_VERSION'))) await pg.initialise();
    if (existsSync(resolve(dir, 'postmaster.pid'))) rmSync(resolve(dir, 'postmaster.pid'));
    await pg.start();
    globalThis.__PG__ = pg;
  }
  const admin = new Client(`postgresql://djaber:djaber@localhost:${pgPort}/postgres`);
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS djaber_test WITH (FORCE)');
  await admin.query("CREATE DATABASE djaber_test ENCODING 'UTF8' TEMPLATE template0");
  await admin.end();
  const DATABASE_URL = `postgresql://djaber:djaber@localhost:${pgPort}/djaber_test`;

  let REDIS_URL = 'redis://127.0.0.1:63799/1';
  if (!(await portOpen(63799))) {
    // same launcher as `pnpm infra:up` (Redis 7; the Windows build of redis-memory-server is too old for BullMQ)
    const { startRedis } = await import(require('node:url').pathToFileURL(resolve(ROOT, 'tools/infra/redis.mjs')).href);
    const redis = await startRedis(63809, resolve(ROOT, '.local'));
    REDIS_URL = 'redis://127.0.0.1:63809';
    globalThis.__REDIS__ = redis;
  }

  const env = {
    NODE_ENV: 'test',
    DATABASE_URL,
    REDIS_URL,
    LOG_LEVEL: 'silent',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: resolve(ROOT, '.local/test-storage'),
    MAIL_DRIVER: 'file',
    MAIL_LOCAL_DIR: resolve(ROOT, '.local/test-mail'),
    META_DRIVER: 'fake',
    PAYMENT_DRIVER: 'fake',
    AI_DRIVER: 'fake',
    COURIER_DRIVER: 'fake',
    SHEETS_DRIVER: 'fake',
    PUSH_DRIVER: 'fake',
    IAP_DRIVER: 'fake',
    SEED_ADMIN_EMAIL: 'admin@djaber.test',
    SEED_ADMIN_PASSWORD: 'Admin-test-12345',
  };
  rmSync(env.MAIL_LOCAL_DIR, { recursive: true, force: true });
  rmSync(env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  mkdirSync(resolve(ROOT, '.local'), { recursive: true });
  writeFileSync(resolve(ROOT, '.local/test-env.json'), JSON.stringify(env));

  const opts = { cwd: resolve(ROOT, 'packages/db'), env: { ...process.env, ...env }, stdio: 'pipe' };
  execSync('npx prisma migrate deploy', opts);
  execSync('npx tsx seeds/index.ts', opts);

  // flush the test redis db
  const Redis = require('ioredis');
  const r = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  await r.flushdb();
  await r.quit();
};
