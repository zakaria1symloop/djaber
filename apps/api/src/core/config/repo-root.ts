import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let cached: string | undefined;

/** Monorepo root (folder holding pnpm-workspace.yaml), whatever the process cwd is (api, worker, tests, repo root). */
export const repoRoot = (): string => {
  if (cached) return cached;
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return (cached = dir);
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return (cached = process.cwd());
};

/** Resolves a configured local path: absolute paths are kept, relative ones are anchored at the monorepo root. */
export const fromRepoRoot = (path: string) => resolve(repoRoot(), path);
