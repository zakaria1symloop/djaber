// Local Redis without Docker.
// BullMQ needs Redis >= 5 (6.2+ recommended). On Windows `redis-memory-server` only ships the 2016 build 3.0.503,
// so we run the native Windows build of Redis 7.2 published by github.com/redis-windows/redis-windows
// (downloaded once into .local/redis-bin). On Linux / macOS `redis-memory-server` builds the requested version.
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import net from 'node:net';

export const REDIS_VERSION = '7.2.16';
const WIN_URL = `https://github.com/redis-windows/redis-windows/releases/download/${REDIS_VERSION}/Redis-${REDIS_VERSION}-Windows-x64-msys2.zip`;

const waitPort = async (port, ms = 15000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await new Promise((res) => {
      const s = net.connect({ port, host: '127.0.0.1' });
      s.once('connect', () => { s.destroy(); res(true); });
      s.once('error', () => res(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`redis did not open port ${port}`);
};

const findExe = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, f.name);
    if (f.isDirectory()) {
      const r = findExe(p);
      if (r) return r;
    } else if (f.name.toLowerCase() === 'redis-server.exe') return p;
  }
  return null;
};

async function windowsBinary(localDir) {
  const dir = resolve(localDir, 'redis-bin', REDIS_VERSION);
  if (!existsSync(dir) || !findExe(dir)) {
    mkdirSync(dir, { recursive: true });
    const zip = resolve(dir, 'redis.zip');
    console.log(`[infra] downloading Redis ${REDIS_VERSION} for Windows (once)…`);
    const res = await fetch(WIN_URL);
    if (!res.ok || !res.body) throw new Error(`redis download failed: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
    // bsdtar ships with Windows 10+ and reads zip archives
    execFileSync(resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/tar.exe'), ['-xf', zip, '-C', dir], { stdio: 'ignore' });
  }
  const exe = findExe(dir);
  if (!exe) throw new Error('redis-server.exe not found after extraction');
  return exe;
}

/** Starts Redis on `port`; returns `{ stop() }`. No persistence (dev queue state is disposable). */
export async function startRedis(port, localDir) {
  if (process.platform === 'win32') {
    const exe = await windowsBinary(localDir);
    const child = spawn(exe, ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no', '--maxmemory-policy', 'noeviction'], {
      cwd: resolve(exe, '..'),
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('exit', (code) => code && console.error(`[infra] redis exited with code ${code}`));
    await waitPort(port);
    return { stop: async () => void child.kill() };
  }
  const { RedisMemoryServer } = await import('redis-memory-server');
  const server = new RedisMemoryServer({ instance: { port }, binary: { version: REDIS_VERSION } });
  await server.start();
  return { stop: () => server.stop() };
}
