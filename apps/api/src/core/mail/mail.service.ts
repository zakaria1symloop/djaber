// Mail driver: `file` (dev/test — one JSON file per message under MAIL_LOCAL_DIR) or `resend`.
import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigService } from '../config/config.service';
import { fromRepoRoot } from '../config/repo-root';

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** template name + params are kept for tests and for the dev mailbox */
  template?: string;
  params?: Record<string, unknown>;
  locale?: string;
};

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  constructor(private readonly config: ConfigService) {}

  private get dir() {
    const dir = this.config.get('MAIL_LOCAL_DIR');
    return fromRepoRoot(dir);
  }

  async send(m: MailMessage): Promise<void> {
    if (this.config.get('MAIL_DRIVER') === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.config.get('MAIL_FROM'), to: m.to, subject: m.subject, html: m.html, text: m.text }),
      });
      if (!res.ok) throw new Error(`mail provider answered ${res.status}`);
      return;
    }
    await mkdir(this.dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await writeFile(resolve(this.dir, name), JSON.stringify({ ...m, at: new Date().toISOString() }, null, 2));
    this.log.debug({ to: m.to.replace(/^(.).*(@.*)$/, '$1***$2'), template: m.template }, 'mail written to local mailbox');
  }

  /** Dev / test helper: messages of the local mailbox, newest first. */
  async localMailbox(to?: string): Promise<(MailMessage & { at: string })[]> {
    const files = await readdir(this.dir).catch(() => [] as string[]);
    const out: (MailMessage & { at: string })[] = [];
    for (const f of files.sort().reverse()) {
      const m = JSON.parse(await readFile(resolve(this.dir, f), 'utf8')) as MailMessage & { at: string };
      if (!to || m.to === to) out.push(m);
    }
    return out;
  }
}
