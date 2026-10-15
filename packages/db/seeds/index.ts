// Idempotent reference seeds (07-non-functional §7). Run: `pnpm --filter @djaber/db seed`.
// Milestone-specific seeds (ai-providers, cms, demo) are added by their milestone in ./extra/*.ts.
import { existsSync, readFileSync } from 'node:fs';
import { seedAi, seedPresets } from './ai';
import { seedSafety } from './ops-safety';
import { seedSettings } from './ops-settings';
import { seedSupport } from './ops-support';
import { seedPublicPages } from './public-pages';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { rawPrisma as db } from '../src/client';
import { defaultFeeFor, NEW_WILAYA_PARENT } from '../src/defaults';

const loadEnv = () => {
  const file = resolve(__dirname, '../../../.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
};

const json = <T>(name: string): T => JSON.parse(readFileSync(resolve(__dirname, 'data', name), 'utf8')) as T;

async function geo() {
  const wilayas = json<{ id: number; code: string; nameFr: string; nameAr: string }[]>('wilayas.json');
  const communes = json<{ id: number; wilayaId: number; nameFr: string; nameAr: string }[]>('communes.json');
  for (const w of wilayas) {
    await db.wilaya.upsert({ where: { id: w.id }, create: w, update: { code: w.code, nameFr: w.nameFr, nameAr: w.nameAr } });
  }
  if ((await db.commune.count()) !== communes.length) {
    await db.commune.createMany({ data: communes, skipDuplicates: true });
  }
  // loi 26-06 (wilayas 59–69): communes seeded under their former wilaya follow the data file (as migration
  // 20261015120000_wilayas_69 does; a no-op once they are in place).
  const moved = new Map<number, number[]>();
  for (const c of communes) if (NEW_WILAYA_PARENT[c.wilayaId]) moved.set(c.wilayaId, [...(moved.get(c.wilayaId) ?? []), c.id]);
  for (const [wilayaId, ids] of moved) await db.commune.updateMany({ where: { id: { in: ids }, wilayaId: { not: wilayaId } }, data: { wilayaId } });
  return { wilayas: wilayas.length, communes: communes.length };
}

async function units() {
  const rows = [
    ['Pièce', 'pc'],
    ['Kilogramme', 'kg'],
    ['Gramme', 'g'],
    ['Litre', 'L'],
    ['Millilitre', 'ml'],
    ['Mètre', 'm'],
    ['Boîte', 'bt'],
  ] as const;
  for (const [name, abbreviation] of rows) {
    const existing = await db.unit.findFirst({ where: { isSystem: true, workspaceId: null, abbreviation } });
    if (!existing) await db.unit.create({ data: { name, abbreviation, isSystem: true } });
  }
  return rows.length;
}

async function plans() {
  const L = (fr: string, ar: string, en: string) => ({ fr, ar, en });
  const rows = [
    {
      slug: 'free',
      name: L('Gratuit', 'مجاني', 'Free'),
      description: L('Pour démarrer', 'للبدء', 'To get started'),
      priceMonthly: 0,
      priceYearly: 0,
      monthlyCredits: 100,
      maxPages: 1,
      maxAgents: 1,
      maxMembers: 1,
      maxProducts: 50,
      maxConversationsPerMonth: 200,
      maxApiKeys: 0,
      maxWebhooks: 0,
      syncHistoryDays: 7,
      features: [] as string[],
      isFeatured: false,
      sortOrder: 0,
    },
    {
      slug: 'starter',
      name: L('Starter', 'ستارتر', 'Starter'),
      description: L('Pour les boutiques qui grandissent', 'للمتاجر النامية', 'For growing shops'),
      priceMonthly: 1900,
      priceYearly: 19000,
      monthlyCredits: 1500,
      maxPages: 2,
      maxAgents: 2,
      maxMembers: 3,
      maxProducts: 500,
      maxConversationsPerMonth: 2000,
      maxApiKeys: 0,
      maxWebhooks: 0,
      syncHistoryDays: 30,
      features: ['voice_notes', 'image_recognition', 'couriers', 'google_sheets'],
      isFeatured: false,
      sortOrder: 1,
    },
    {
      slug: 'pro',
      name: L('Pro', 'برو', 'Pro'),
      description: L('Pour les équipes de vente', 'لفرق المبيعات', 'For sales teams'),
      priceMonthly: 4900,
      priceYearly: 49000,
      monthlyCredits: 5000,
      maxPages: 5,
      maxAgents: 5,
      maxMembers: 10,
      maxProducts: -1,
      maxConversationsPerMonth: -1,
      maxApiKeys: 5,
      maxWebhooks: 5,
      syncHistoryDays: 90,
      features: [
        'voice_notes',
        'image_recognition',
        'couriers',
        'google_sheets',
        'api_keys',
        'webhooks',
        'advanced_stock',
        'scheduled_reports',
        'instagram',
        'priority_support',
      ],
      isFeatured: true,
      sortOrder: 2,
    },
  ];
  for (const p of rows) {
    // prices and limits are owned by the admin UI after the first seed: only create, never overwrite
    await db.plan.upsert({ where: { slug: p.slug }, create: { ...p, trialDays: 14, isVisible: true }, update: {} });
  }
  const packs = [
    { slug: 'pack-500', credits: 500, priceWebDzd: 450, isFeatured: false, sortOrder: 0 },
    { slug: 'pack-2000', credits: 2000, priceWebDzd: 1500, isFeatured: false, sortOrder: 1 },
    { slug: 'pack-6000', credits: 6000, priceWebDzd: 3900, isFeatured: true, sortOrder: 2 },
  ];
  for (const p of packs) {
    const n = String(p.credits).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    await db.creditPack.upsert({
      where: { slug: p.slug },
      create: {
        ...p,
        name: { fr: `${n} crédits`, ar: `${p.credits} رصيد`, en: `${p.credits.toLocaleString('en-US')} credits` },
        googleProductId: `djaber.credits.${p.slug}`,
        appleProductId: `djaber.credits.${p.slug}`,
      },
      update: {},
    });
  }
  return { plans: rows.length, packs: packs.length };
}

async function admin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@djaber.local').toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error('SEED_ADMIN_PASSWORD is required to create the first super admin');
  return db.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      firstName: 'Super',
      lastName: 'Admin',
      platformRole: 'super_admin',
      emailVerifiedAt: new Date(),
    },
  });
}

async function platform(adminId: string) {
  const versions = [
    { platform: 'android' as const, storeUrl: 'https://play.google.com/store/apps/details?id=ai.djaber.app' },
    { platform: 'ios' as const, storeUrl: 'https://apps.apple.com/app/djaber/id0000000000' },
  ];
  for (const v of versions) {
    await db.appVersion.upsert({
      where: { platform: v.platform },
      create: {
        ...v,
        latestVersion: '1.0.0',
        minVersion: '1.0.0',
        recommendedVersion: '1.0.0',
        updateMessage: {
          fr: 'Une nouvelle version est disponible.',
          ar: 'يتوفر إصدار جديد.',
          en: 'A new version is available.',
        },
        updatedById: adminId,
      },
      update: {},
    });
  }
  const settings: Record<string, unknown> = {
    feature_flags: {},
    limits: {
      apiRatePerMin: 600,
      webhookRetries: 6,
      trialDays: 14,
      trialCredits: 300,
      deletionGraceDays: 30,
      impersonationMinutes: 30,
      maxDevices: 20,
    },
    maintenance: null,
    blocked_words: [],
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.platformSetting.upsert({
      where: { key },
      create: { key, value: value as object, updatedById: adminId },
      update: {},
    });
  }
  const providers = ['chargily', 'email', 'sms', 'push', 'courier_zr', 'courier_ecotrack', 'courier_yalidine', 'google_oauth'];
  for (const key of providers) {
    await db.platformProvider.upsert({ where: { key }, create: { key, kind: key.split('_')[0]! }, update: {} });
  }
}

/**
 * 07-non-functional §7 "cms": one published CmsEntry(type=legal) per LegalDocKey with its LegalDocument version 1.
 * Version 1 is the initial text: nothing to re-accept (requiresReacceptance=false). Texts are short placeholders
 * replaced from the admin CMS before launch. Idempotent: existing entries and documents are left untouched.
 */
export async function legal(adminId: string) {
  const docs = {
    terms: {
      title: { fr: "Conditions d'utilisation", ar: 'شروط الاستخدام', en: 'Terms of use' },
      body: {
        fr: "En utilisant Djaber, vous acceptez d'utiliser le service conformément à la loi et aux présentes conditions.",
        ar: 'باستخدامك جابر، فإنك توافق على استعمال الخدمة وفق القانون وهذه الشروط.',
        en: 'By using Djaber you agree to use the service in accordance with the law and these terms.',
      },
    },
    privacy: {
      title: { fr: 'Politique de confidentialité', ar: 'سياسة الخصوصية', en: 'Privacy policy' },
      body: {
        fr: 'Djaber traite les données de votre boutique et de vos clients uniquement pour fournir le service.',
        ar: 'يعالج جابر بيانات متجرك وزبائنك فقط من أجل تقديم الخدمة.',
        en: 'Djaber processes the data of your shop and of your customers only to provide the service.',
      },
    },
    account_deletion: {
      title: { fr: 'Suppression du compte', ar: 'حذف الحساب', en: 'Account deletion' },
      body: {
        fr: 'Vous pouvez demander la suppression de votre compte à tout moment ; elle est effective après 30 jours.',
        ar: 'يمكنك طلب حذف حسابك في أي وقت، ويصبح الحذف نافذًا بعد 30 يومًا.',
        en: 'You can request the deletion of your account at any time; it takes effect after 30 days.',
      },
    },
    content_rules: {
      title: { fr: 'Règles de contenu', ar: 'قواعد المحتوى', en: 'Content rules' },
      body: {
        fr: 'Les produits contrefaits, dangereux ou interdits par la loi ne peuvent pas être vendus avec Djaber.',
        ar: 'لا يمكن بيع المنتجات المقلدة أو الخطرة أو الممنوعة قانونًا عبر جابر.',
        en: 'Counterfeit, dangerous or legally prohibited products cannot be sold with Djaber.',
      },
    },
  } as const;
  const locales = ['fr', 'ar', 'en'] as const;
  for (const [key, doc] of Object.entries(docs) as [keyof typeof docs, (typeof docs)[keyof typeof docs]][]) {
    let entry = await db.cmsEntry.findUnique({ where: { key } });
    if (!entry) {
      entry = await db.cmsEntry.create({
        data: {
          key,
          type: 'legal',
          status: 'published',
          currentVersion: 1,
          createdById: adminId,
          locales: {
            create: locales.map((locale) => ({ locale, title: doc.title[locale], body: doc.body[locale], status: 'published' as const, updatedById: adminId })),
          },
          versions: { create: { version: 1, snapshot: { title: doc.title, body: doc.body }, createdById: adminId } },
        },
      });
    }
    const existing = await db.legalDocument.findFirst({ where: { key } });
    if (!existing) {
      await db.legalDocument.create({
        data: { key, version: 1, isMajor: true, requiresReacceptance: false, cmsEntryId: entry.id, publishedById: adminId },
      });
    }
  }
  return Object.keys(docs).length;
}

/** DLV-01: every workspace has its 69 fee rows (new workspaces get them at creation; older ones are backfilled here, custom rows kept). */
async function feeGrids() {
  const [wilayas, workspaces] = await Promise.all([db.wilaya.findMany({ select: { id: true } }), db.workspace.findMany({ select: { id: true } })]);
  let written = 0;
  for (const ws of workspaces) {
    const data = wilayas.map((w) => {
      const f = defaultFeeFor(w.id);
      return { workspaceId: ws.id, wilayaId: w.id, homePrice: f.home, stopdeskPrice: f.stopdesk, returnPrice: f.return, isActive: true, source: 'default' as const };
    });
    written += (await db.deliveryFeeRule.createMany({ data, skipDuplicates: true })).count;
  }
  return written;
}

/**
 * DLV-09 / M6: `CourierCommuneMap` per provider — the commune name each courier API expects (`Commune` / `commune` /
 * `to_commune_name`, 05-integrations §2.2–§2.4 all take the French commune name of the official list). Stop-desk ids
 * are filled at runtime from `listStopdesks` (`CourierStopdesk`). Idempotent (unique `[provider, communeId]`).
 */
async function courierCommuneMaps() {
  const communes = await db.commune.findMany({ select: { id: true, nameFr: true } });
  let written = 0;
  for (const provider of ['zrexpress', 'ecotrack', 'yalidine'] as const) {
    const data = communes.map((c) => ({ provider, communeId: c.id, externalCode: c.nameFr }));
    for (let i = 0; i < data.length; i += 1000) written += (await db.courierCommuneMap.createMany({ data: data.slice(i, i + 1000), skipDuplicates: true })).count;
  }
  return written;
}

async function main() {
  loadEnv();
  const g = await geo();
  const u = await units();
  const p = await plans();
  const pr = await seedPresets(db);
  const a = await admin();
  const ai = await seedAi(db, a.id);
  await platform(a.id);
  const lg = await legal(a.id);
  // M10 ops & safety reference data (canned replies + help articles, platform settings + Meta permissions, brands + words)
  await seedSupport(a.id);
  await seedSettings(a.id);
  await seedSafety(a.id);
  // M11 public site CMS pages (landing, features, pricing FAQ, cookies, Meta data deletion)
  await seedPublicPages(a.id);
  const fees = await feeGrids();
  const maps = await courierCommuneMaps();
   
  console.log(`seeded: ${g.wilayas} wilayas, ${g.communes} communes, ${u} units, ${p.plans} plans, ${p.packs} packs, ${pr} presets, ${ai.models} AI models, ${ai.routes} AI routes, ${lg} legal documents, ${fees} fee rows, ${maps} courier commune maps, admin + app versions + settings`);
}

main()
  .catch((e) => {
     
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
