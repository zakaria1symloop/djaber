// Stops what global-setup started and removes this run's database, env file and Redis db claim.
const { rmSync } = require('node:fs');

module.exports = async () => {
  const db = globalThis.__TEST_DB__;
  if (db) {
    const { Client } = require('pg');
    const admin = new Client(`postgresql://djaber:djaber@localhost:${db.pgPort}/postgres`);
    await admin.connect().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS "${db.dbName}" WITH (FORCE)`).catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
  const lock = globalThis.__TEST_REDIS_LOCK__;
  if (lock) {
    const Redis = require('ioredis');
    const r = new Redis('redis://127.0.0.1:63799/0', { maxRetriesPerRequest: null });
    if ((await r.get(lock.key)) === lock.runId) await r.del(lock.key);
    await r.quit();
  }
  if (globalThis.__TEST_ENV_FILE__) rmSync(globalThis.__TEST_ENV_FILE__, { force: true });
  for (const dir of globalThis.__TEST_DIRS__ ?? []) rmSync(dir, { recursive: true, force: true });
  if (globalThis.__PG__) await globalThis.__PG__.stop().catch(() => undefined);
  if (globalThis.__REDIS__) await globalThis.__REDIS__.stop().catch(() => undefined);
};
