// 03-events-and-jobs §4 — scheduled jobs of the auth module (run only by the worker process, Africa/Algiers):
//   sched-email-verify-reminder 09:00 — users unverified for exactly 7 days get one reminder (D32)
//   sched-retention            01:00 — expired idempotency keys, refresh tokens expired > 30 d, used / expired e-mail tokens
//   sched-account-anonymise    01:10 — deletion requests past their 30-day grace (04 §16)
import { Injectable, OnModuleInit } from '@nestjs/common';
import { prisma, TenantContext } from '@djaber/db';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { AccountDeletionService } from './account-deletion.service';
import { AuthService } from './auth.service';

const DAY = 86_400_000;
const ALGIERS_OFFSET_MS = 3600_000; // UTC+1, no DST

/** Start of the Africa/Algiers calendar day containing `d`, as a UTC instant. */
export const algiersDayStart = (d: Date) => {
  const local = new Date(d.getTime() + ALGIERS_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - ALGIERS_OFFSET_MS);
};

@Injectable()
export class AuthScheduler implements OnModuleInit {
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly auth: AuthService,
    private readonly deletion: AccountDeletionService,
  ) {}

  onModuleInit() {
    this.registry.cron('sched-email-verify-reminder', '0 9 * * *', () => this.verifyReminders());
    this.registry.cron('sched-retention', '0 1 * * *', () => this.retention());
    this.registry.cron('sched-account-anonymise', '10 1 * * *', () => this.deletion.anonymiseDue());
  }

  /** Users created 7 calendar days ago (Africa/Algiers) and still unverified. Once per user (outbox key). */
  async verifyReminders(now = new Date()): Promise<number> {
    const from = new Date(algiersDayStart(now).getTime() - 7 * DAY);
    const to = new Date(from.getTime() + DAY);
    const users = await TenantContext.runSystem(() =>
      prisma.user.findMany({ where: { emailVerifiedAt: null, deletedAt: null, status: 'active', createdAt: { gte: from, lt: to } } }),
    );
    let sent = 0;
    for (const user of users) {
      const key = `verify-reminder:${user.id}`;
      // a rerun must not issue a new token: that would void the link of the reminder already sent
      const already = await TenantContext.runSystem(() => prisma.outbox.findUnique({ where: { topic_key: { topic: 'mail', key } } }));
      if (already) continue;
      await this.auth.sendVerification(user, 'auth/verify-reminder', key);
      sent++;
    }
    return sent;
  }

  async retention(now = new Date()) {
    return TenantContext.runSystem(async () => {
      const [idempotencyKeys, refreshTokens, emailTokens] = await Promise.all([
        prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * DAY) } } }),
        prisma.emailToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: new Date(now.getTime() - DAY) } }] } }),
      ]);
      return { idempotencyKeys: idempotencyKeys.count, refreshTokens: refreshTokens.count, emailTokens: emailTokens.count };
    });
  }
}
