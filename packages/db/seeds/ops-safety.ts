// M10 (D36, D37) — platform reference lists of moderation and safety: protected brands most often counterfeited (pre-screen
// flag `protected_brand`, 04 §12) and the starter platform blocked words (insults / scam patterns, 04 §13). Idempotent:
// existing rows are left untouched (edited in ADM-10 "Mots & catégories interdits" and ADM-11).
import { rawPrisma as db } from '../src/client';

const BRANDS = ['Louis Vuitton', 'Gucci', 'Chanel', 'Rolex', 'Dior', 'Hermès', 'Prada', 'Versace'];
const WORDS: { word: string; locale: 'fr' | 'ar' | null }[] = [
  { word: 'arnaque', locale: 'fr' },
  { word: 'escroquerie', locale: 'fr' },
  { word: 'virement d’avance', locale: 'fr' },
  { word: 'نصب', locale: 'ar' },
  { word: 'احتيال', locale: 'ar' },
];

export async function seedSafety(adminId: string) {
  let rules = 0;
  for (const name of BRANDS) {
    const key = `brand.${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
    const r = await db.moderationRule.upsert({ where: { key }, create: { key, kind: 'protected_brand', value: name, createdById: adminId }, update: {} });
    if (r) rules++;
  }
  const existing = new Set((await db.blockedWord.findMany({ where: { workspaceId: null }, select: { word: true } })).map((w) => w.word));
  const add = WORDS.filter((w) => !existing.has(w.word));
  if (add.length) await db.blockedWord.createMany({ data: add.map((w) => ({ workspaceId: null, word: w.word, locale: w.locale, createdById: adminId })) });
  return { rules, words: existing.size + add.length };
}
