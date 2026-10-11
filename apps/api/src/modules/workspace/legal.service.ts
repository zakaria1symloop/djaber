// 04 §15 "Legal documents (D39)" — pending re-acceptances and their recording.
// `terms` and `privacy` are required from every user, `content_rules` from Owners and Admins only,
// `account_deletion` is informational (never prompts). Only versions with `requiresReacceptance` prompt.
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext, type DevicePlatform, type LegalDocKey, type Tx } from '@djaber/db';
import { ConfigService } from '../../core/config/config.service';
import { dbOf } from '../../core/db';
import { notFound } from '../../core/errors/app.exception';
import { RedisService } from '../../core/redis/redis.provider';

export type LegalPending = { key: LegalDocKey; version: number; url: string };
type RequiredDoc = { id: string; key: LegalDocKey; version: number };

const REQUIRED_KEY = 'legal:required';
const okKey = (userId: string) => `legal:ok:${userId}`;
const fingerprint = (docs: RequiredDoc[]) => docs.map((d) => `${d.key}@${d.version}`).join(',');

@Injectable()
export class LegalService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /** Latest version of each key (the one in force). */
  private async latest(tx?: Tx) {
    const docs = await dbOf(tx).legalDocument.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    const seen = new Set<string>();
    return docs.filter((d) => (seen.has(d.key) ? false : (seen.add(d.key), true)));
  }

  /** Documents whose latest version requires a re-acceptance. Cached 60 s (publishing calls `invalidate`). */
  async required(): Promise<RequiredDoc[]> {
    const cached = await this.redis.getJson<RequiredDoc[]>(REQUIRED_KEY);
    if (cached) return cached;
    const docs = await TenantContext.runSystem(() => this.latest());
    const out = docs
      .filter((d) => d.requiresReacceptance && d.key !== 'account_deletion')
      .map((d) => ({ id: d.id, key: d.key, version: d.version }));
    await this.redis.setJson(REQUIRED_KEY, out, 60);
    return out;
  }

  /** Call after publishing a legal document version (admin CMS, M10) and from tests. */
  async invalidate() {
    await this.redis.client.del(REQUIRED_KEY);
  }

  /** `GET /legal/pending` and `MeDto.pendingLegal`. */
  async pendingFor(userId: string): Promise<LegalPending[]> {
    const required = await this.required();
    if (!required.length) return [];
    return TenantContext.runSystem(async () => {
      const [accepted, managerOf] = await Promise.all([
        prisma.legalAcceptance.findMany({ where: { userId, legalDocumentId: { in: required.map((d) => d.id) } }, select: { legalDocumentId: true } }),
        prisma.membership.count({ where: { userId, role: { in: ['owner', 'admin'] } } }),
      ]);
      const done = new Set(accepted.map((a) => a.legalDocumentId));
      const web = this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '');
      return required
        .filter((d) => !done.has(d.id) && (d.key !== 'content_rules' || managerOf > 0))
        .map((d) => ({ key: d.key, version: d.version, url: `${web}/legal/${d.key}` }));
    });
  }

  /** Cheap per-request check used by LegalGuard: first pending document or null. */
  async firstPending(userId: string): Promise<LegalPending | null> {
    const required = await this.required();
    if (!required.length) return null;
    const fp = fingerprint(required);
    if ((await this.redis.client.get(okKey(userId))) === fp) return null;
    const pending = await this.pendingFor(userId);
    if (!pending.length) {
      await this.redis.client.set(okKey(userId), fp, 'EX', 300);
      return null;
    }
    return pending[0]!;
  }

  /** `POST /legal/accept { key, version }` — idempotent. */
  async accept(userId: string, key: LegalDocKey, version: number, ip: string | null, client: DevicePlatform) {
    return TenantContext.runSystem(async () => {
      const doc = await prisma.legalDocument.findUnique({ where: { key_version: { key, version } } });
      if (!doc) throw notFound();
      const row = await prisma.legalAcceptance.upsert({
        where: { userId_legalDocumentId_version: { userId, legalDocumentId: doc.id, version } },
        create: { userId, legalDocumentId: doc.id, version, ip, client },
        update: {},
      });
      await this.redis.client.del(okKey(userId));
      return { acceptedAt: row.acceptedAt.toISOString() };
    });
  }

  /** Sign-up / workspace creation: the user accepts the documents in force by submitting the form. */
  async acceptCurrent(tx: Tx, userId: string, keys: LegalDocKey[], ip: string | null, client: DevicePlatform) {
    const docs = (await this.latest(tx)).filter((d) => keys.includes(d.key));
    for (const doc of docs) {
      await tx.legalAcceptance.upsert({
        where: { userId_legalDocumentId_version: { userId, legalDocumentId: doc.id, version: doc.version } },
        create: { userId, legalDocumentId: doc.id, version: doc.version, ip, client },
        update: {},
      });
    }
  }
}
