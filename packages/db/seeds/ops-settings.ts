// M10 ADM-13 seeds (api-b): Meta permission table (PFS-05), incident banner, legal contacts, sensitive categories (04 §12),
// two sample feature flags (off). Idempotent: existing rows are left untouched.
import { rawPrisma as db } from '../src/client';

/** Same list as `DEFAULT_SENSITIVE_KEYWORDS` (apps/api/src/modules/catalog/moderation-prescreen.service.ts). */
const SENSITIVE_KEYWORDS = [
  'électronique', 'electronics', 'électroménager', 'téléphone', 'smartphone', 'informatique', 'high-tech',
  'santé', 'health', 'complément', 'supplement', 'vitamine', 'parapharmacie',
  'enfant', 'kids', 'bébé', 'baby', 'jouet', 'toys',
  'cosmétique', 'cosmetics', 'maquillage', 'makeup', 'beauté', 'parfum', 'skincare',
  'إلكترونيات', 'الكترونيات', 'هواتف', 'صحة', 'مكملات', 'أطفال', 'اطفال', 'رضع', 'ألعاب', 'تجميل', 'مستحضرات',
];

/**
 * Scopes live in V1 are `approved` (Messenger + Instagram messaging: same behaviour as M3, where a scope without a row counts as
 * approved); `business_management` is not requested. The platform team edits them on ADM-13 (assumptions-log M10).
 */
const META_PERMISSIONS: { scope: string; feature: string; status: 'approved' | 'not_requested' | 'in_review' }[] = [
  { scope: 'pages_messaging', feature: 'messenger_replies', status: 'approved' },
  { scope: 'pages_manage_metadata', feature: 'webhook_subscription', status: 'approved' },
  { scope: 'pages_show_list', feature: 'page_connection', status: 'approved' },
  { scope: 'pages_read_engagement', feature: 'page_insights', status: 'approved' },
  { scope: 'business_management', feature: 'business_pages', status: 'not_requested' },
  { scope: 'instagram_basic', feature: 'instagram_profile', status: 'approved' },
  { scope: 'instagram_manage_messages', feature: 'instagram_messaging', status: 'approved' },
  { scope: 'instagram_business_manage_messages', feature: 'instagram_messaging', status: 'approved' },
];

export async function seedSettings(adminId: string) {
  for (const p of META_PERMISSIONS) {
    await db.metaPermission.upsert({ where: { scope: p.scope }, create: { ...p, decidedAt: p.status === 'approved' ? new Date() : null }, update: {} });
  }
  const settings: Record<string, unknown> = {
    incident_banner: { visible: false, text: null },
    legal_contacts: { accountDeletionUrl: 'https://djaber.ai/account/deletion', dpoEmail: 'dpo@djaber.ai' },
    sensitive_categories: { keywords: SENSITIVE_KEYWORDS },
    maintenance: { enabled: false, from: null, to: null, scope: 'all', text: null },
  };
  for (const [key, value] of Object.entries(settings)) {
    const existing = await db.platformSetting.findUnique({ where: { key } });
    // the M0 seed wrote `maintenance: null`: upgrade it to the structured value once
    if (existing && !(key === 'maintenance' && existing.value === null)) continue;
    const row = await db.platformSetting.upsert({ where: { key }, create: { key, value: value as object, updatedById: adminId }, update: { value: value as object } });
    await db.platformSettingVersion.upsert({ where: { settingId_version: { settingId: row.id, version: row.version } }, create: { settingId: row.id, version: row.version, value: value as object, changedById: adminId, reason: 'seed' }, update: {} });
  }
  const flags = [
    { key: 'image_recognition_v2', description: 'Reconnaissance photo v2 (déploiement progressif)' },
    { key: 'voice_replies', description: 'Réponses vocales de l’agent (bêta)' },
  ];
  for (const f of flags) {
    await db.featureFlag.upsert({ where: { key: f.key }, create: { ...f, webPct: 0, mobilePct: 0, isActive: false, updatedById: adminId }, update: {} });
  }
  return META_PERMISSIONS.length;
}
