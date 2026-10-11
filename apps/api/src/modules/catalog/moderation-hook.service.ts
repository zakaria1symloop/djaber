// D36 / 04 §12 — product moderation, merchant side. A `ModerationItem` is written when a product is created and each time
// a customer-visible field changes (name, description, category, images, price ±50 %). Until the admin queue exists (M10)
// every item takes the auto-approval path: `ModerationItem.status = auto_approved`, `Product.moderationStatus = approved`,
// and the snapshot becomes the approved version. The pre-screen score (`moderation-prescreen` job) is wired in M10.
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext, type ModerationSource, type Prisma, type Tx } from '@djaber/db';
import type { ModerationDetailView } from '@djaber/shared';
import { AppException, notFound, validationError } from '../../core/errors/app.exception';
import { OutboxService } from '../../core/outbox/outbox.service';
import { algiersClock } from '../../core/time/algiers';

export type ModeratedFields = { name: string; description: string | null; categoryId: string | null; price: number };

/** 04 §12 "Trigger": name, description, category, or a price change of at least 50 %. Stock, variants, unit, … never. */
export const needsReview = (before: ModeratedFields, after: ModeratedFields): boolean =>
  before.name !== after.name ||
  (before.description ?? '') !== (after.description ?? '') ||
  before.categoryId !== after.categoryId ||
  (before.price > 0 && Math.abs(after.price - before.price) * 2 >= before.price);

const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const isBusinessDay = (weekday: number) => weekday <= 4; // Sunday (0) … Thursday (4)

/** 04 §12 "SLA": 2 business hours, Sun–Thu 09:00–18:00 Africa/Algiers (created 17:30 ⇒ due next business day 10:30). */
export const moderationSlaDueAt = (from: Date, minutes = 120): Date => {
  let t = new Date(from.getTime());
  let left = minutes;
  for (let guard = 0; guard < 20 && left > 0; guard++) {
    const c = algiersClock(t);
    const minuteOfDay = c.hour * 60 + c.minute;
    if (!isBusinessDay(c.weekday) || minuteOfDay >= CLOSE_HOUR * 60) {
      // jump to 09:00 of the next day
      t = new Date(t.getTime() + (24 * 60 - minuteOfDay + OPEN_HOUR * 60) * 60_000);
      continue;
    }
    if (minuteOfDay < OPEN_HOUR * 60) {
      t = new Date(t.getTime() + (OPEN_HOUR * 60 - minuteOfDay) * 60_000);
      continue;
    }
    const usable = Math.min(left, CLOSE_HOUR * 60 - minuteOfDay);
    t = new Date(t.getTime() + usable * 60_000);
    left -= usable;
  }
  t.setUTCSeconds(0, 0);
  return t;
};

const APPEAL_WINDOW_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class ModerationHookService {
  constructor(private readonly outbox: OutboxService) {}

  /** Creates the item of the product's next content version and applies the decision. Runs in the caller's transaction. */
  async submit(tx: Tx, productId: string, source: ModerationSource) {
    const p = await tx.product.findFirst({
      where: { id: productId },
      include: { images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } }, moderationItems: { orderBy: { contentVersion: 'desc' }, take: 1, select: { contentVersion: true } } },
    });
    if (!p) throw notFound();
    const last = p.moderationItems[0]?.contentVersion ?? 0;
    const contentVersion = Math.max(p.contentVersion, last + 1);
    const snapshot = { title: p.name, description: p.description, price: p.price, categoryId: p.categoryId, images: p.images.map((i) => i.url) };
    const now = new Date();
    const item = await tx.moderationItem.create({
      data: {
        type: 'product',
        productId: p.id,
        contentVersion,
        snapshot: snapshot as Prisma.InputJsonValue,
        // TODO(M10): pre-screen score + human queue (aiScore ≥ 0.9 ∧ trust ∈ standard|trusted ∧ category not sensitive)
        status: 'auto_approved',
        aiFlags: [],
        slaDueAt: moderationSlaDueAt(now),
        decidedAt: now,
        submittedAt: now,
        source,
      } as never,
    });
    await tx.product.update({
      where: { id: p.id },
      data: { moderationItemId: item.id, moderationStatus: 'approved', approvedSnapshot: snapshot as Prisma.InputJsonValue, contentVersion },
    });
    await this.outbox.ws(tx, `ws:${TenantContext.workspaceId()}`, 'moderation.updated', { id: p.id, productId: p.id, status: 'approved' });
    return item;
  }

  /** Import commit: one item per created product, in three statements whatever the number of rows. */
  async submitMany(tx: Tx, productIds: string[], source: ModerationSource) {
    if (!productIds.length) return;
    const ws = TenantContext.workspaceId();
    const now = new Date();
    const due = moderationSlaDueAt(now);
    await tx.$executeRaw`
      INSERT INTO "ModerationItem" ("id","workspaceId","type","productId","contentVersion","snapshot","status","aiFlags","priority","slaDueAt","decidedAt","submittedAt","source","rejectedFields")
      SELECT uuid_generate_v7(), p."workspaceId", 'product'::"ModerationItemType", p."id", p."contentVersion",
             jsonb_build_object('title', p."name", 'description', p."description", 'price', p."price", 'categoryId', p."categoryId",
               'images', COALESCE((SELECT jsonb_agg(i."url" ORDER BY i."sortOrder") FROM "ProductImage" i WHERE i."productId" = p."id"), '[]'::jsonb)),
             'auto_approved'::"ModerationItemStatus", '[]'::jsonb, 'normal'::"ModerationPriority", ${due}, ${now}, ${now}, ${source}::"ModerationSource", ARRAY[]::text[]
      FROM "Product" p WHERE p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${productIds}::uuid[])`;
    await tx.$executeRaw`
      UPDATE "Product" p SET "moderationItemId" = m."id", "moderationStatus" = 'approved'::"ModerationStatusProduct", "approvedSnapshot" = m."snapshot"
      FROM "ModerationItem" m
      WHERE m."productId" = p."id" AND m."contentVersion" = p."contentVersion" AND p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${productIds}::uuid[])`;
  }

  /** Bulk change of a moderated field (category reassign, bulk price): next content version for every product, then one item each. */
  async resubmitMany(tx: Tx, productIds: string[], source: ModerationSource) {
    if (!productIds.length) return;
    const ws = TenantContext.workspaceId();
    await tx.$executeRaw`
      UPDATE "Product" p SET "contentVersion" = GREATEST(p."contentVersion", COALESCE((SELECT max(m."contentVersion") FROM "ModerationItem" m WHERE m."productId" = p."id"), 0)) + 1
      WHERE p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${productIds}::uuid[])`;
    await this.submitMany(tx, productIds, source);
    await this.outbox.ws(tx, `ws:${ws}`, 'moderation.updated', { id: productIds[0]!, productIds: productIds.slice(0, 200), status: 'approved' });
  }

  // --- merchant-side reads and actions (06 §8.2) ---------------------------------------------------------------------------
  async detail(productId: string): Promise<ModerationDetailView | null> {
    const items = await prisma.moderationItem.findMany({ where: { productId, type: 'product' }, orderBy: { submittedAt: 'asc' }, include: { appeal: true } });
    const current = items[items.length - 1];
    if (!current) return null;
    const product = await prisma.product.findFirst({ where: { id: productId }, select: { moderationStatus: true } });
    const history: ModerationDetailView['history'] = [];
    for (const i of items) {
      history.push({ at: i.submittedAt.toISOString(), status: 'pending', actor: 'merchant', note: i.source });
      if (i.decidedAt) history.push({ at: i.decidedAt.toISOString(), status: i.status, actor: i.reviewerId ? 'moderator' : 'system', note: i.merchantMessage });
      if (i.appeal) history.push({ at: i.appeal.submittedAt.toISOString(), status: 'appealed', actor: 'merchant', note: i.appeal.message });
    }
    const appealed = items.find((i) => i.appeal)?.appeal ?? null;
    const deadline = current.status === 'rejected' && current.decidedAt ? new Date(current.decidedAt.getTime() + APPEAL_WINDOW_MS) : null;
    return {
      status: product?.moderationStatus ?? 'not_required',
      submittedAt: current.submittedAt.toISOString(),
      decidedAt: current.decidedAt ? current.decidedAt.toISOString() : null,
      decision: current.decision,
      merchantMessage: current.merchantMessage,
      rejectedFields: current.rejectedFields,
      rules: current.reasonTemplateKey ? [current.reasonTemplateKey] : [],
      history,
      appeal: {
        status: appealed ? 'used' : deadline && deadline < new Date() ? 'expired' : 'available',
        deadlineAt: appealed ? appealed.deadlineAt.toISOString() : deadline ? deadline.toISOString() : null,
        decision: appealed?.decision ?? null,
      },
    };
  }

  /** `GET /products/:id/moderation` */
  async get(productId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId }, select: { id: true, moderationStatus: true, contentVersion: true } });
    if (!product) throw notFound();
    const detail = await this.detail(productId);
    const item = await prisma.moderationItem.findFirst({ where: { productId, type: 'product' }, orderBy: { submittedAt: 'desc' } });
    return {
      status: product.moderationStatus,
      contentVersion: product.contentVersion,
      item: item
        ? { id: item.id, aiFlags: item.aiFlags, decision: item.decision, merchantMessage: item.merchantMessage, rejectedFields: item.rejectedFields, decidedAt: item.decidedAt ? item.decidedAt.toISOString() : null }
        : null,
      history: detail?.history ?? [],
      appeal: detail?.appeal ?? null,
    };
  }

  /** `GET /moderation/summary` — banner "n produits en attente". */
  async summary() {
    const ws = TenantContext.workspaceId();
    const [groups, workspace] = await Promise.all([
      prisma.product.groupBy({ by: ['moderationStatus'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.workspace.findUnique({ where: { id: ws }, select: { trustLevel: true } }),
    ]);
    const n = (s: string) => groups.find((g) => g.moderationStatus === s)?._count._all ?? 0;
    return { pending: n('pending'), rejected: n('rejected'), appealed: n('appealed'), trustLevel: workspace?.trustLevel ?? 'new' };
  }

  /** `POST /products/:id/resubmit` — only a rejected product (409 MODERATION_NOT_REJECTED otherwise): a new item. */
  async resubmit(productId: string) {
    return prisma.$transaction(async (db) => {
      const tx = db as Tx;
      const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true, moderationStatus: true } });
      if (!product) throw notFound();
      if (product.moderationStatus !== 'rejected') throw new AppException('MODERATION_NOT_REJECTED');
      const item = await this.submit(tx, productId, 'update');
      return { moderationItemId: item.id, status: 'approved' as const };
    });
  }

  /** `POST /products/:id/appeal` — once per product, within 7 days of the rejection (04 §12 "Appeal"). */
  async appeal(productId: string, input: { message: string; attachmentUploadId?: string | null }) {
    const t = TenantContext.get();
    return prisma.$transaction(async (db) => {
      const tx = db as Tx;
      const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true, moderationStatus: true, moderationItemId: true } });
      if (!product) throw notFound();
      const used = await tx.moderationAppeal.count({ where: { item: { productId } } });
      if (used) throw new AppException('MODERATION_APPEAL_ALREADY_USED');
      const item = product.moderationItemId ? await tx.moderationItem.findFirst({ where: { id: product.moderationItemId } }) : null;
      if (product.moderationStatus !== 'rejected' || !item || item.status !== 'rejected' || !item.decidedAt) throw new AppException('MODERATION_NOT_REJECTED');
      const deadlineAt = new Date(item.decidedAt.getTime() + APPEAL_WINDOW_MS);
      if (deadlineAt < new Date()) throw new AppException('MODERATION_APPEAL_WINDOW_EXPIRED');
      if (input.attachmentUploadId) {
        const upload = await tx.upload.findFirst({ where: { id: input.attachmentUploadId, workspaceId: t.workspaceId, kind: 'appeal_attachment' } });
        if (!upload) throw validationError({ attachmentUploadId: 'validation.invalid' });
      }
      const appeal = await tx.moderationAppeal.create({
        data: { moderationItemId: item.id, message: input.message, attachmentUploadId: input.attachmentUploadId ?? null, submittedById: t.userId!, deadlineAt } as Prisma.ModerationAppealUncheckedCreateInput,
      });
      await tx.moderationItem.update({ where: { id: item.id }, data: { status: 'appealed' } });
      await tx.product.update({ where: { id: product.id }, data: { moderationStatus: 'appealed' } });
      await this.outbox.ws(tx, `ws:${t.workspaceId}`, 'moderation.updated', { id: product.id, productId: product.id, status: 'appealed' });
      return { id: appeal.id, status: 'appealed' as const, deadlineAt: deadlineAt.toISOString() };
    });
  }
}
