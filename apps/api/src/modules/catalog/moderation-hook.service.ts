// D36 / 04 §12 — product moderation, merchant side + the decision primitives shared with the admin queue (M10).
// A `ModerationItem` is written when a product is created and each time a customer-visible field changes (name,
// description, category, images, price ±50 %). The pre-screen (`ModerationPrescreenService`, free and local) scores it at
// once: `aiScore ≥ 0.9 ∧ trustLevel ∈ {standard, trusted} ∧ category not sensitive` ⇒ approved (snapshot live), otherwise
// the item waits in the human queue (ADM-10) while the last approved snapshot keeps selling (AI catalogue). When the
// inline pre-screen fails the item stays pending with `prescreen_unavailable` and the `moderation-prescreen` job retries.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { prisma, TenantContext, type ModerationItem, type ModerationSource, type Prisma, type Tx } from '@djaber/db';
import type { ModerationAiFlagView, ModerationDetailView } from '@djaber/shared';
import { AppException, notFound, validationError } from '../../core/errors/app.exception';
import { OutboxService } from '../../core/outbox/outbox.service';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { algiersClock, algiersDay } from '../../core/time/algiers';
import { NotificationProducer } from '../notifications/notification.producer';
import { ModerationPrescreenService, type PrescreenResult } from './moderation-prescreen.service';

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
  for (let guard = 0; guard < 40 && left > 0; guard++) {
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

export const APPEAL_WINDOW_MS = 7 * 24 * 3600 * 1000;
/** 04 §12: the appeal is decided within 24 h. */
export const APPEAL_DECISION_MS = 24 * 3600 * 1000;
const PRESCREEN_UNAVAILABLE: ModerationAiFlagView = { code: 'prescreen_unavailable', message: 'prescreen_unavailable' };

type Snapshot = { title: string; description: string | null; price: number; categoryId: string | null; images: string[] };

@Injectable()
export class ModerationHookService implements OnModuleInit {
  private readonly log = new Logger(ModerationHookService.name);
  constructor(
    private readonly outbox: OutboxService,
    private readonly prescreen: ModerationPrescreenService,
    private readonly queue: QueueOutbox,
    private readonly registry: ProcessorRegistry,
    private readonly notifications: NotificationProducer,
  ) {}

  onModuleInit() {
    // 03-events §3 `jobs / moderation-prescreen` — retry of a failed inline pre-screen (attempts 3, then the flag stays)
    this.registry.register('jobs', 'moderation-prescreen', (d: { itemId: string; workspaceId: string }, job) => this.runPrescreenJob(d.itemId, (job?.attemptsMade ?? 0) + 1), { concurrency: 2 });
  }

  /** Admin room counters (contract §5 `moderation.queue { pending, urgent }`). */
  async emitQueue(tx: Tx | typeof prisma) {
    const [pending, urgent] = await TenantContext.runSystem(() =>
      Promise.all([tx.moderationItem.count({ where: { status: 'pending' } }), tx.moderationItem.count({ where: { status: 'pending', priority: 'urgent' } })]),
    );
    await this.outbox.ws(tx, 'admin:platform', 'moderation.queue', { pending, urgent }, `moderation.queue:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
  }

  private async trustOf(tx: Tx | typeof prisma, workspaceId: string) {
    const ws = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { trustLevel: true } });
    return ws?.trustLevel ?? 'new';
  }

  /** Product goes live with the approved snapshot; product.updated + moderation.updated + grouped `product.approved`. */
  async markApproved(tx: Tx, item: Pick<ModerationItem, 'id' | 'workspaceId' | 'productId' | 'snapshot'>, o: { notify: boolean }) {
    if (!item.productId) return;
    await tx.product.update({ where: { id: item.productId }, data: { moderationStatus: 'approved', approvedSnapshot: item.snapshot as Prisma.InputJsonValue } });
    await this.emitProduct(tx, item.workspaceId, item.productId, 'approved');
    if (o.notify) {
      await this.notifications.emit(tx, {
        type: 'product_approved',
        workspaceId: item.workspaceId,
        target: { roles: ['owner', 'admin'] },
        key: `product_approved:${item.workspaceId}:${algiersDay()}`,
        data: { productIds: [item.productId], count: 1 },
      });
    }
  }

  async emitProduct(tx: Tx, workspaceId: string, productId: string, status: string) {
    await this.outbox.ws(tx, `ws:${workspaceId}`, 'moderation.updated', { id: productId, productId, status });
    // 03-events §2 full `product.updated` shape (same as StockService.emitProductUpdated)
    const p = await tx.product.findFirst({
      where: { id: productId },
      select: { id: true, stock: true, minStock: true, trackStock: true, isActive: true, moderationStatus: true, deletedAt: true, variants: { where: { deletedAt: null, isActive: true }, select: { stock: true, minStock: true } } },
    });
    if (!p) return;
    const lowStock = p.trackStock && ((p.stock ?? 0) <= p.minStock || p.variants.some((v) => v.stock <= v.minStock));
    await this.outbox.ws(tx, `ws:${workspaceId}`, 'product.updated', { id: p.id, product: { id: p.id, stock: p.stock, isActive: p.isActive, moderationStatus: p.moderationStatus, lowStock, archived: !!p.deletedAt } });
  }

  /** Applies a pre-screen result to a pending item: auto-approve or leave it in the human queue. */
  private async applyPrescreen(tx: Tx, item: ModerationItem, r: PrescreenResult, trust: string): Promise<'approved' | 'pending'> {
    const approve = ModerationPrescreenService.autoApprove(r, trust);
    const snapshot = { ...(item.snapshot as Record<string, unknown>), marketReference: r.marketReference, sensitive: r.sensitive };
    await tx.moderationItem.update({
      where: { id: item.id },
      data: {
        aiScore: r.aiScore,
        aiFlags: r.aiFlags as unknown as Prisma.InputJsonValue,
        snapshot: snapshot as Prisma.InputJsonValue,
        ...(approve ? { status: 'auto_approved', decidedAt: new Date() } : {}),
      },
    });
    if (approve) await this.markApproved(tx, { ...item, snapshot: snapshot as Prisma.JsonValue }, { notify: true });
    return approve ? 'approved' : 'pending';
  }

  /** Creates the item of the product's next content version and pre-screens it. Runs in the caller's transaction. */
  async submit(tx: Tx, productId: string, source: ModerationSource) {
    const p = await tx.product.findFirst({
      where: { id: productId },
      include: { images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } }, moderationItems: { orderBy: { contentVersion: 'desc' }, take: 1, select: { contentVersion: true } } },
    });
    if (!p) throw notFound();
    const last = p.moderationItems[0]?.contentVersion ?? 0;
    const contentVersion = Math.max(p.contentVersion, last + 1);
    const snapshot: Snapshot = { title: p.name, description: p.description, price: p.price, categoryId: p.categoryId, images: p.images.map((i) => i.url) };
    const now = new Date();
    const item = await tx.moderationItem.create({
      data: {
        workspaceId: p.workspaceId,
        type: 'product',
        productId: p.id,
        contentVersion,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        status: 'pending',
        aiFlags: [],
        slaDueAt: moderationSlaDueAt(now),
        submittedAt: now,
        source,
      } as Prisma.ModerationItemUncheckedCreateInput,
    });
    // pending until decided; a previously approved snapshot keeps selling (approvedSnapshot untouched)
    await tx.product.update({ where: { id: p.id }, data: { moderationItemId: item.id, moderationStatus: 'pending', contentVersion } });
    let status: 'approved' | 'pending' = 'pending';
    try {
      const r = await this.prescreen.prescreenProduct(tx, p.id);
      status = await this.applyPrescreen(tx, item, r, await this.trustOf(tx, p.workspaceId));
    } catch (err) {
      this.log.warn({ itemId: item.id, err: (err as Error).message }, 'inline pre-screen failed, job queued');
      await tx.moderationItem.update({ where: { id: item.id }, data: { aiScore: null, aiFlags: [PRESCREEN_UNAVAILABLE] as unknown as Prisma.InputJsonValue } });
      await this.queue.add(tx, 'jobs', 'moderation-prescreen', { itemId: item.id, workspaceId: p.workspaceId }, `moderation-prescreen:${item.id}`, { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } });
    }
    if (status === 'pending') {
      await this.emitProduct(tx, p.workspaceId, p.id, 'pending');
      await this.emitQueue(tx);
    }
    return { ...item, status: status === 'approved' ? ('auto_approved' as const) : ('pending' as const) };
  }

  /** `jobs / moderation-prescreen`: re-runs the pre-screen of a still-pending item (idempotent: decided items are skipped). */
  async runPrescreenJob(itemId: string, attempt: number) {
    const item = await TenantContext.runSystem(() => prisma.moderationItem.findUnique({ where: { id: itemId } }));
    if (!item || item.status !== 'pending' || !item.productId) return { skipped: true };
    await TenantContext.runAs(item.workspaceId, () =>
      prisma.$transaction(async (db) => {
        const tx = db as Tx;
        const r = await this.prescreen.prescreenProduct(tx, item.productId!);
        const status = await this.applyPrescreen(tx, item, r, await this.trustOf(tx, item.workspaceId));
        if (status === 'pending') await this.emitQueue(tx);
      }),
    );
    return { attempt };
  }

  /** Import commit: one item per created product, inserted in one statement, then pre-screened in bulk. */
  async submitMany(tx: Tx, productIds: string[], source: ModerationSource) {
    if (!productIds.length) return;
    const ws = TenantContext.workspaceId();
    const now = new Date();
    const due = moderationSlaDueAt(now);
    await tx.$executeRaw`
      INSERT INTO "ModerationItem" ("id","workspaceId","type","productId","contentVersion","snapshot","status","aiFlags","priority","slaDueAt","submittedAt","source","rejectedFields")
      SELECT uuid_generate_v7(), p."workspaceId", 'product'::"ModerationItemType", p."id", p."contentVersion",
             jsonb_build_object('title', p."name", 'description', p."description", 'price', p."price", 'categoryId', p."categoryId",
               'images', COALESCE((SELECT jsonb_agg(i."url" ORDER BY i."sortOrder") FROM "ProductImage" i WHERE i."productId" = p."id"), '[]'::jsonb)),
             'pending'::"ModerationItemStatus", '[]'::jsonb, 'normal'::"ModerationPriority", ${due}, ${now}, ${source}::"ModerationSource", ARRAY[]::text[]
      FROM "Product" p WHERE p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${productIds}::uuid[])`;
    await tx.$executeRaw`
      UPDATE "Product" p SET "moderationItemId" = m."id", "moderationStatus" = 'pending'::"ModerationStatusProduct"
      FROM "ModerationItem" m
      WHERE m."productId" = p."id" AND m."contentVersion" = p."contentVersion" AND p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${productIds}::uuid[])`;
    await this.prescreenMany(tx, ws, productIds);
  }

  /** Scores every current item of these products and applies the decisions with two statements. */
  private async prescreenMany(tx: Tx, ws: string, productIds: string[]) {
    const trust = await this.trustOf(tx, ws);
    const items = await tx.moderationItem.findMany({ where: { productId: { in: productIds }, status: 'pending', currentOf: { isNot: null } } });
    if (!items.length) return;
    let scored: { item: ModerationItem; r: PrescreenResult }[] = [];
    try {
      const rules = await this.prescreen.rules(tx);
      for (const item of items) scored.push({ item, r: await this.prescreen.prescreenProduct(tx, item.productId!, rules) });
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, 'bulk pre-screen failed, jobs queued');
      scored = [];
      for (const item of items) {
        await tx.moderationItem.update({ where: { id: item.id }, data: { aiFlags: [PRESCREEN_UNAVAILABLE] as unknown as Prisma.InputJsonValue } });
        await this.queue.add(tx, 'jobs', 'moderation-prescreen', { itemId: item.id, workspaceId: ws }, `moderation-prescreen:${item.id}`, { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } });
      }
    }
    if (scored.length) {
      const now = new Date();
      const approved = scored.filter((s) => ModerationPrescreenService.autoApprove(s.r, trust));
      const ids = scored.map((s) => s.item.id);
      const scores = scored.map((s) => s.r.aiScore);
      const flags = scored.map((s) => JSON.stringify(s.r.aiFlags));
      const extras = scored.map((s) => JSON.stringify({ marketReference: s.r.marketReference, sensitive: s.r.sensitive }));
      const approve = scored.map((s) => ModerationPrescreenService.autoApprove(s.r, trust));
      await tx.$executeRaw`
        UPDATE "ModerationItem" m SET "aiScore" = v.score, "aiFlags" = v.flags::jsonb, "snapshot" = m."snapshot" || v.extra::jsonb,
               "status" = CASE WHEN v.approve THEN 'auto_approved'::"ModerationItemStatus" ELSE m."status" END,
               "decidedAt" = CASE WHEN v.approve THEN ${now} ELSE m."decidedAt" END
        FROM unnest(${ids}::uuid[], ${scores}::numeric[], ${flags}::text[], ${extras}::text[], ${approve}::boolean[]) AS v(id, score, flags, extra, approve)
        WHERE m."id" = v.id`;
      if (approved.length) {
        const approvedIds = approved.map((s) => s.item.productId!);
        await tx.$executeRaw`
          UPDATE "Product" p SET "moderationStatus" = 'approved'::"ModerationStatusProduct", "approvedSnapshot" = m."snapshot"
          FROM "ModerationItem" m WHERE m."id" = p."moderationItemId" AND p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${approvedIds}::uuid[])`;
        await this.notifications.emit(tx, { type: 'product_approved', workspaceId: ws, target: { roles: ['owner', 'admin'] }, key: `product_approved:${ws}:${algiersDay()}`, data: { productIds: approvedIds.slice(0, 200), count: approvedIds.length } });
      }
      if (approved.length < scored.length) await this.emitQueue(tx);
    }
    await this.outbox.ws(tx, `ws:${ws}`, 'moderation.updated', { id: productIds[0]!, productIds: productIds.slice(0, 200), status: 'bulk' });
  }

  /** Bulk change of a moderated field (category reassign, bulk price): next content version for every product, then one item each. */
  async resubmitMany(tx: Tx, productIds: string[], source: ModerationSource) {
    if (!productIds.length) return;
    const ws = TenantContext.workspaceId();
    await tx.$executeRaw`
      UPDATE "Product" p SET "contentVersion" = GREATEST(p."contentVersion", COALESCE((SELECT max(m."contentVersion") FROM "ModerationItem" m WHERE m."productId" = p."id"), 0)) + 1
      WHERE p."workspaceId" = ${ws}::uuid AND p."id" = ANY(${productIds}::uuid[])`;
    await this.submitMany(tx, productIds, source);
  }

  /**
   * MOD-08 / 04 §12 "Agent prompts": a saved agent configuration whose instructions contain a platform blocked word or a
   * protected brand ⇒ `ModerationItem(type=agent_prompt)` in the "Agents IA (prompts)" tab; the agent stays active unless
   * rejected. One pending item per agent (a later save refreshes it); a clean save leaves nothing.
   */
  async submitAgentPrompt(tx: Tx, agentId: string, instructions: string) {
    const flags = await this.prescreen.promptFlags(instructions);
    if (!flags.length) return null;
    const agent = await tx.agent.findFirst({ where: { id: agentId }, select: { id: true, workspaceId: true } });
    if (!agent) return null;
    const snapshot = { excerpt: instructions.slice(0, 2000) } as Prisma.InputJsonValue;
    const open = await tx.moderationItem.findFirst({ where: { agentId, type: 'agent_prompt', status: 'pending' } });
    const item = open
      ? await tx.moderationItem.update({ where: { id: open.id }, data: { snapshot, aiFlags: flags as unknown as Prisma.InputJsonValue, contentVersion: { increment: 1 } } })
      : await tx.moderationItem.create({
          data: { workspaceId: agent.workspaceId, type: 'agent_prompt', agentId, snapshot, status: 'pending', aiScore: null, aiFlags: flags as unknown as Prisma.InputJsonValue, slaDueAt: moderationSlaDueAt(new Date()), source: 'update' } as Prisma.ModerationItemUncheckedCreateInput,
        });
    await this.emitQueue(tx);
    return item;
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
      if (i.decidedAt) history.push({ at: i.decidedAt.toISOString(), status: i.status === 'appealed' || i.status === 'appeal_rejected' ? 'rejected' : i.status, actor: i.reviewerId ? 'moderator' : 'system', note: i.merchantMessage });
      if (i.appeal) {
        history.push({ at: i.appeal.submittedAt.toISOString(), status: 'appealed', actor: 'merchant', note: i.appeal.message });
        if (i.appeal.decidedAt) history.push({ at: i.appeal.decidedAt.toISOString(), status: i.appeal.decision === 'overturned' ? 'approved' : 'appeal_rejected', actor: 'moderator', note: i.appeal.decisionNote });
      }
    }
    const appealed = items.find((i) => i.appeal)?.appeal ?? null;
    const rejectedItem = [...items].reverse().find((i) => i.status === 'rejected' && i.decidedAt);
    const deadline = rejectedItem?.decidedAt ? new Date(rejectedItem.decidedAt.getTime() + APPEAL_WINDOW_MS) : null;
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
        ? { id: item.id, status: item.status, aiFlags: item.aiFlags, decision: item.decision, merchantMessage: item.merchantMessage, rejectedFields: item.rejectedFields, slaDueAt: item.slaDueAt.toISOString(), decidedAt: item.decidedAt ? item.decidedAt.toISOString() : null }
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

  /** `POST /products/:id/resubmit` — only a rejected product (409 MODERATION_NOT_REJECTED otherwise): a new item, pre-screened. */
  async resubmit(productId: string) {
    return prisma.$transaction(async (db) => {
      const tx = db as Tx;
      const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true, moderationStatus: true } });
      if (!product) throw notFound();
      if (product.moderationStatus !== 'rejected') throw new AppException('MODERATION_NOT_REJECTED');
      const item = await this.submit(tx, productId, 'update');
      return { moderationItemId: item.id, status: item.status === 'auto_approved' ? ('approved' as const) : ('pending' as const) };
    });
  }

  /** `POST /products/:id/appeal` — once per product, within 7 days of the rejection (04 §12 "Appeal"). */
  async appeal(productId: string, input: { message: string; attachmentUploadId?: string | null }) {
    const t = TenantContext.get();
    const result = await prisma.$transaction(async (db) => {
      const tx = db as Tx;
      const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true, moderationStatus: true, moderationItemId: true } });
      if (!product) throw notFound();
      const used = await tx.moderationAppeal.count({ where: { item: { productId } } });
      if (used) throw new AppException('MODERATION_APPEAL_ALREADY_USED');
      const item = product.moderationItemId ? await tx.moderationItem.findFirst({ where: { id: product.moderationItemId } }) : null;
      if (product.moderationStatus !== 'rejected' || !item || item.status !== 'rejected' || !item.decidedAt) throw new AppException('MODERATION_NOT_REJECTED');
      const windowEnd = new Date(item.decidedAt.getTime() + APPEAL_WINDOW_MS);
      if (windowEnd < new Date()) throw new AppException('MODERATION_APPEAL_WINDOW_EXPIRED');
      if (input.attachmentUploadId) {
        const upload = await tx.upload.findFirst({ where: { id: input.attachmentUploadId, workspaceId: t.workspaceId, kind: 'appeal_attachment' } });
        if (!upload) throw validationError({ attachmentUploadId: 'validation.invalid' });
      }
      // the appeal is decided by a second moderator within 24 h (04 §12): deadline of the decision
      const deadlineAt = new Date(Date.now() + APPEAL_DECISION_MS);
      const appeal = await tx.moderationAppeal.create({
        data: { workspaceId: t.workspaceId, moderationItemId: item.id, message: input.message, attachmentUploadId: input.attachmentUploadId ?? null, submittedById: t.userId!, deadlineAt } as Prisma.ModerationAppealUncheckedCreateInput,
      });
      await tx.moderationItem.update({ where: { id: item.id }, data: { status: 'appealed' } });
      await tx.product.update({ where: { id: product.id }, data: { moderationStatus: 'appealed' } });
      await this.emitProduct(tx, t.workspaceId, product.id, 'appealed');
      await this.emitQueue(tx);
      return { id: appeal.id, status: 'appealed' as const, deadlineAt: deadlineAt.toISOString() };
    });
    return result;
  }
}
