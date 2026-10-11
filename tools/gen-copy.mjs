// Extracts the i18n keys of docs/implementation/06-i18n-copy-deck.md (tables `| key | fr | ar | en |`)
// into packages/shared/src/i18n/messages/deck.{fr,ar,en}.json (flat `key -> text`).
// Page-specific keys live next to them in app.{fr,ar,en}.json (written by hand per milestone).
// Run after editing the copy deck: `node tools/gen-copy.mjs`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('docs/implementation/06-i18n-copy-deck.md', 'utf8').split(/\r?\n/);
const fr = {};
const ar = {};
const en = {};
const PIPE = '\u0000';
for (const raw of src) {
  if (!raw.startsWith('|')) continue;
  const line = raw.split('\\|').join(PIPE);
  const c = line
    .split('|')
    .slice(1, -1)
    .map((x) => x.trim().split(PIPE).join('|'));
  if (c.length < 2) continue;
  const m = /^`?([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)`?(?:\s*\(.*\))?$/.exec(c[0]);
  if (!m || !c[1]) continue;
  const key = m[1];
  if (key.startsWith('error.')) continue; // errors come from 11 (tools/gen-errors.mjs)
  fr[key] ??= c[1];
  if (c[2]) ar[key] ??= c[2];
  if (c[3]) en[key] ??= c[3];
}
const dir = 'packages/shared/src/i18n/messages';
mkdirSync(dir, { recursive: true });
const sort = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
writeFileSync(`${dir}/deck.fr.json`, JSON.stringify(sort(fr), null, 1) + '\n');
writeFileSync(`${dir}/deck.ar.source.json`, JSON.stringify(sort(ar), null, 1) + '\n');
writeFileSync(`${dir}/deck.en.source.json`, JSON.stringify(sort(en), null, 1) + '\n');
const keys = Object.keys(fr);
const ns = {};
for (const k of keys) ns[k.split('.')[0]] = (ns[k.split('.')[0]] ?? 0) + 1;
console.log('keys', keys.length, '| ar in deck', Object.keys(ar).length, '| en in deck', Object.keys(en).length);
console.log(JSON.stringify(ns));
