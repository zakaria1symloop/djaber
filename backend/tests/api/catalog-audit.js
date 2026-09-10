/**
 * Static audit of the error catalog — the things a black-box API test cannot see:
 *  1. a code defined in TWO module files (the spread in catalog.ts silently keeps the last one)
 *  2. a missing / empty translation, or fr/ar copy-pasted from English
 *  3. `{placeholders}` that differ between en / fr / ar (a param would render as literal text)
 *  4. an invalid or suspicious HTTP status
 *  5. codes referenced in controllers but absent from the catalog (would render as the raw key)
 *  6. codes defined but never used (dead entries)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC = path.join(__dirname, '..', '..', 'src');
const ERR_DIR = path.join(SRC, 'errors');
const issues = [];
const note = (sev, msg) => issues.push({ sev, msg });

// ---- 1. duplicate codes across module files --------------------------------
const moduleFiles = fs.readdirSync(ERR_DIR).filter((f) => /^catalog\.[a-z]+\.ts$/.test(f));
const owner = new Map();
for (const file of moduleFiles) {
  const src = fs.readFileSync(path.join(ERR_DIR, file), 'utf8');
  // top-level keys of the exported object: two-space indented IDENT:
  for (const m of src.matchAll(/^ {2}([A-Z][A-Z0-9_]*):\s*\{/gm)) {
    const code = m[1];
    if (owner.has(code)) note('ERROR', `duplicate code ${code} in ${owner.get(code)} and ${file} — the later module silently wins`);
    else owner.set(code, file);
  }
}

// ---- load the merged catalog through ts-node --------------------------------
const script = `
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
  const { CATALOG } = require(${JSON.stringify(path.join(ERR_DIR, 'catalog.ts')).replace(/\\/g, '/')});
  process.stdout.write(JSON.stringify(CATALOG));
`;
const raw = execFileSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..', '..'), maxBuffer: 32 * 1024 * 1024 }).toString();
const CATALOG = JSON.parse(raw);
const codes = Object.keys(CATALOG);

// ---- 2/3/4 per-entry checks -------------------------------------------------
const ARABIC = /[\u0600-\u06FF]/;
const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const VALID_STATUS = new Set([400, 401, 402, 403, 404, 405, 409, 410, 413, 415, 422, 429, 500, 501, 502, 503, 504]);

for (const [code, def] of Object.entries(CATALOG)) {
  for (const lang of ['en', 'fr', 'ar']) {
    if (!def[lang] || String(def[lang]).trim() === '') note('ERROR', `${code}: missing ${lang} text`);
  }
  if (!VALID_STATUS.has(def.status)) note('ERROR', `${code}: suspicious status ${def.status}`);
  if (def.en && def.fr && def.en === def.fr) note('WARN', `${code}: fr identical to en — "${def.en}"`);
  if (def.en && def.ar && def.en === def.ar) note('ERROR', `${code}: ar identical to en — "${def.en}"`);
  if (def.ar && !ARABIC.test(def.ar)) note('ERROR', `${code}: ar text has no Arabic script — "${def.ar}"`);
  const pe = ph(def.en), pf = ph(def.fr), pa = ph(def.ar);
  if (pe !== pf) note('ERROR', `${code}: placeholders differ en(${pe || '—'}) vs fr(${pf || '—'})`);
  if (pe !== pa) note('ERROR', `${code}: placeholders differ en(${pe || '—'}) vs ar(${pa || '—'})`);
}

// ---- 5/6 used vs defined ----------------------------------------------------
const usedCodes = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    // Skip only the catalog definitions; errors/index.ts DOES use codes (toApiError maps Prisma/multer/body-parser errors).
    if (/catalog(\.[a-z]+)?\.ts$/.test(entry.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    // Any SCREAMING_SNAKE string literal — codes reach `fail` / `ApiError` directly or
    // through helpers (e.g. sendOAuthError(req, res, 'facebook', 'PAGE_OAUTH_CANCELLED')),
    // so match the literal itself and filter against the catalog afterwards.
    for (const m of src.matchAll(/['"`]([A-Z][A-Z0-9_]{2,})['"`]/g)) usedCodes.add(m[1]);
  }
};
walk(SRC);

for (const code of [...usedCodes].filter((c) => CATALOG[c] || /_(FAILED|NOT_FOUND|REQUIRED|INVALID|EXISTS|TAKEN)$/.test(c))) {
  if (!CATALOG[code]) note('ERROR', `code ${code} is used in a controller but NOT in the catalog — clients would receive the raw key as message`);
}
const unused = codes.filter((c) => !usedCodes.has(c));

console.log(`catalog: ${codes.length} codes across ${moduleFiles.length} module files`);
console.log(`used in code: ${usedCodes.size}`);
console.log(`defined but never used: ${unused.length}${unused.length ? ' → ' + unused.slice(0, 40).join(', ') + (unused.length > 40 ? ' …' : '') : ''}`);
const errors = issues.filter((i) => i.sev === 'ERROR');
const warns = issues.filter((i) => i.sev === 'WARN');
console.log(`\nERRORS: ${errors.length}`);
for (const i of errors) console.log('  ✗', i.msg);
console.log(`WARNINGS: ${warns.length}`);
for (const i of warns) console.log('  !', i.msg);
fs.writeFileSync(path.join(__dirname, 'catalog-audit.json'), JSON.stringify({ total: codes.length, used: usedCodes.size, unused, issues }, null, 1));
process.exit(errors.length > 0 ? 1 : 0);
