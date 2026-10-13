// E-mails leave through the outbox (CLAUDE.md rule 4): `mail` outbox row → queue `outbox` job `email-send` → MailService.
// Link-bearing params (tokens) are sealed with AES-256-GCM so that no usable token is readable in `Outbox` / Redis.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { prisma, type Tx } from '@djaber/db';
import { CryptoService } from '../crypto/crypto.service';
import { OutboxService } from '../outbox/outbox.service';
import { ProcessorRegistry } from '../queue/processor.registry';
import { QueueService } from '../queue/queue.service';
import { MailService, type MailAttachment } from './mail.service';
import { isMailTemplate, renderMail, type MailTemplateName } from './templates';

export type MailJob = {
  to: string;
  template: MailTemplateName;
  locale: string;
  /** non-secret params (names, dates) — kept readable for the dev mailbox and tests */
  params?: Record<string, unknown>;
  /** secret params (links carrying a token) — encrypted at rest */
  secret?: Record<string, unknown>;
  /** deduplication key (`Outbox @@unique([topic, key])`); one e-mail per key */
  key: string;
  workspaceId?: string | null;
  /** stored files to attach (keys only travel through the outbox) */
  attachments?: MailAttachment[];
};

type Payload = { to: string; template: string; locale: string; params: Record<string, unknown>; sealed?: string; attachments?: MailAttachment[] };

@Injectable()
export class MailOutbox implements OnModuleInit {
  constructor(
    private readonly outbox: OutboxService,
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueService,
    private readonly mail: MailService,
    private readonly crypto: CryptoService,
  ) {}

  onModuleInit() {
    this.registry.onOutbox('mail', async (row) => {
      await this.queue.add('outbox', 'email-send', row.payload, `mail:${row.key}`, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      });
    });
    this.registry.register('outbox', 'email-send', (data: Payload) => this.deliver(data));
  }

  /** Enqueue inside the caller's transaction (or without one when `tx` is omitted). */
  async send(m: MailJob, tx?: Tx) {
    const payload: Payload = { to: m.to, template: m.template, locale: m.locale, params: m.params ?? {}, ...(m.attachments?.length ? { attachments: m.attachments } : {}) };
    if (m.secret && Object.keys(m.secret).length) payload.sealed = this.crypto.encryptJson(m.secret);
    await this.outbox.enqueue((tx ?? prisma) as Tx, {
      topic: 'mail',
      key: m.key,
      payload,
      workspaceId: m.workspaceId ?? null,
    });
  }

  /** Job handler `outbox/email-send`: safe to run twice (a duplicate e-mail is the worst case). */
  async deliver(data: Payload) {
    if (!isMailTemplate(data.template)) throw new Error(`unknown mail template ${data.template}`);
    const secret = data.sealed ? this.crypto.decryptJson<Record<string, unknown>>(data.sealed) : {};
    const rendered = renderMail(data.template, data.locale, { ...data.params, ...secret });
    await this.mail.send({
      to: data.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      template: data.template,
      // the local mailbox (dev / test) keeps the full params so links can be followed; production mail has no such copy
      params: { ...data.params, ...secret },
      locale: data.locale,
      ...(data.attachments?.length ? { attachments: data.attachments } : {}),
    });
  }
}
