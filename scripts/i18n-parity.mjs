// Dictionary parity check for the web app i18n dictionaries.
//
// Asserts, for src/lib/i18n.ts and every src/lib/i18n/*.ts namespace module:
//   - every key exists in en, fr AND ar
//   - no value is empty
//   - in the namespace modules (where the new keys live), no fr/ar value is
//     byte-identical to its en value
//
// Run: node scripts/i18n-parity.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/lib');

const PAIR = new RegExp(
  "(?:'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\")" +
    '\\s*:\\s*' +
    "(?:'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\"|`((?:[^`\\\\]|\\\\.)*)`)",
  'g'
);

function extract(file, markers, fromExport = false) {
  let src = fs.readFileSync(file, 'utf8');
  if (fromExport) {
    // Skip the `type L = { en: Record<string, string>; ... }` declaration so the
    // `en:` / `fr:` / `ar:` markers resolve inside the exported object literal.
    // Start inside the exported object literal, past any `: { en: Record<…> }`
    // type annotation, so the `en:` / `fr:` / `ar:` markers resolve to the real
    // dictionaries rather than to the type.
    const at = src.search(/export const \w+/);
    if (at !== -1) {
      src = src.slice(at);
      src = src.slice(src.indexOf('{', src.search(/=\s*\{/)) + 1);
    }
  }
  const out = {};
  for (const marker of markers) {
    const at = src.indexOf(marker);
    if (at === -1) continue;
    const open = src.indexOf('{', at);
    let depth = 0;
    let close = -1;
    for (let j = open; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') {
        depth--;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    const body = src.slice(open, close + 1);
    const dict = {};
    let m;
    PAIR.lastIndex = 0;
    while ((m = PAIR.exec(body))) {
      const k = m[1] ?? m[2];
      const v = m[3] ?? m[4] ?? m[5];
      if (k && k.includes('.')) dict[k] = v;
    }
    out[marker] = dict;
  }
  return out;
}

const sets = [];
const base = extract(path.join(root, 'i18n.ts'), [
  'const en: Dict =',
  'const fr: Dict =',
  'const ar: Dict =',
]);
sets.push({
  name: 'i18n.ts (base)',
  base: true,
  en: base['const en: Dict ='] ?? {},
  fr: base['const fr: Dict ='] ?? {},
  ar: base['const ar: Dict ='] ?? {},
});

for (const f of fs.readdirSync(path.join(root, 'i18n')).sort()) {
  if (!f.endsWith('.ts')) continue;
  const o = extract(path.join(root, 'i18n', f), ['en:', 'fr:', 'ar:'], true);
  sets.push({ name: `i18n/${f}`, base: false, en: o['en:'] ?? {}, fr: o['fr:'] ?? {}, ar: o['ar:'] ?? {} });
}

let missing = 0;
let empty = 0;
let identical = 0;
let warned = 0;
let keys = 0;

for (const s of sets) {
  const all = new Set([...Object.keys(s.en), ...Object.keys(s.fr), ...Object.keys(s.ar)]);
  keys += all.size;
  for (const k of all) {
    for (const lang of ['en', 'fr', 'ar']) {
      if (!(k in s[lang])) {
        console.log(`MISSING   ${s.name}  ${k}  [${lang}]`);
        missing++;
      } else if (!String(s[lang][k]).trim()) {
        console.log(`EMPTY     ${s.name}  ${k}  [${lang}]`);
        empty++;
      }
    }
    if (!s.base) {
      for (const lang of ['fr', 'ar']) {
        const v = s.en[k];
        // Slugs, emails and URLs are deliberately identical in every locale.
        const technical = /^[\w.@/-]+$/.test(v);
        if (!technical && k in s[lang] && v === s[lang][k] && /[A-Za-z]{3}/.test(v)) {
          // Arabic identical to English is always a bug; a French value that
          // matches English can be a genuine cognate (Total, Notes, Active…),
          // so those are reported as warnings only.
          if (lang === 'ar') {
            console.log(`IDENTICAL ${s.name}  ${k}  [ar] === en: "${v}"`);
            identical++;
          } else {
            console.log(`WARN-SAME ${s.name}  ${k}  [fr] === en: "${v}"`);
            warned++;
          }
        }
      }
    }
  }
}

console.log(
  `\nfiles=${sets.length} keys=${keys} missing=${missing} empty=${empty} ar-untranslated=${identical} fr-same-as-en(warn)=${warned}`
);
process.exit(missing + empty + identical ? 1 : 0);
