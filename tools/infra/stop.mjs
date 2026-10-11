import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const pidFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../.local/infra.pid');
if (!existsSync(pidFile)) { console.log('[infra] not running'); process.exit(0); }
const pid = Number(readFileSync(pidFile, 'utf8'));
try { process.kill(pid, 'SIGINT'); console.log(`[infra] stopped (pid ${pid})`); } catch { console.log('[infra] process already gone'); }
try { rmSync(pidFile); } catch {}
