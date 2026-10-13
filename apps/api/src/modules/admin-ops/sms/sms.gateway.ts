// SMS port (PFS-06 provider `sms`; 03-events §5.1 `invoice.unpaid` "+ SMS when PlatformProvider.sms enabled").
// Drivers: `fake` (development / tests — one JSON file per message under SMS_LOCAL_DIR, kept in memory too) and `none`.
// No live SMS driver exists in this codebase: nothing ever reaches a real phone.
import { Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const SMS_GATEWAY = Symbol('SMS_GATEWAY');
export type SmsMessage = { to: string; text: string; tag?: string };
export type SmsResult = { ok: true; id: string } | { ok: false; error: 'INVALID_NUMBER' | 'UNAVAILABLE' };
export interface SmsGateway {
  readonly driver: 'fake' | 'none';
  send(m: SmsMessage): Promise<SmsResult>;
}

export const maskMsisdn = (p: string) => (p.length >= 6 ? `${p.slice(0, 2)}•• •• •• ${p.slice(-2)}` : '••');

export class FakeSmsGateway implements SmsGateway {
  readonly driver = 'fake' as const;
  private readonly log = new Logger('FakeSmsGateway');
  readonly sent: (SmsMessage & { at: string })[] = [];
  constructor(private readonly dir: string) {}

  async send(m: SmsMessage): Promise<SmsResult> {
    if (!/^0[5-7]\d{8}$/.test(m.to)) return { ok: false, error: 'INVALID_NUMBER' };
    const at = new Date().toISOString();
    this.sent.push({ ...m, at });
    await mkdir(this.dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(resolve(this.dir, `${id}.json`), JSON.stringify({ ...m, at }, null, 2));
    this.log.debug({ to: maskMsisdn(m.to), tag: m.tag }, 'sms written to the local outbox');
    return { ok: true, id: `fake-${id}` };
  }
}

export class NoneSmsGateway implements SmsGateway {
  readonly driver = 'none' as const;
  async send(): Promise<SmsResult> {
    return { ok: false, error: 'UNAVAILABLE' };
  }
}
