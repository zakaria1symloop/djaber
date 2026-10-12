// NTF-03 / 03-events §5.2 — the push port: FCM HTTP v1 (`fcm`) or an in-memory stand-in (`fake`, development and tests).
// The FCM adapter refuses to start outside staging / production unless PUSH_ALLOW_LIVE=true (same guard as Meta / AI).
import { Logger } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import type { AppConfig } from '../../../core/config/config.schema';

export const PUSH_GATEWAY = Symbol('PUSH_GATEWAY');
export type PushMessage = {
  token: string;
  title: string;
  body: string;
  /** FCM data block: `type` (NotificationType enum value), `notificationId`, `path`, `workspaceId`, `params` (JSON) */
  data: Record<string, string>;
  badge?: number;
};
/** `UNREGISTERED` / `INVALID_ARGUMENT` ⇒ the token is deleted; anything else is retried by the job. */
export type PushResult = { ok: true; id?: string } | { ok: false; error: 'UNREGISTERED' | 'INVALID_ARGUMENT' | 'UNAVAILABLE' | 'INTERNAL' };
export interface PushGateway {
  readonly driver: 'fake' | 'fcm';
  send(m: PushMessage): Promise<PushResult>;
}

/** Records every message; tokens listed in `invalidTokens` answer `UNREGISTERED` (AT-NTF-05). */
export class FakePushGateway implements PushGateway {
  readonly driver = 'fake' as const;
  readonly sent: PushMessage[] = [];
  readonly invalidTokens = new Set<string>();
  async send(m: PushMessage): Promise<PushResult> {
    if (this.invalidTokens.has(m.token)) return { ok: false, error: 'UNREGISTERED' };
    this.sent.push(m);
    return { ok: true, id: `fake-${this.sent.length}` };
  }
  reset() {
    this.sent.length = 0;
    this.invalidTokens.clear();
  }
}

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

/** FCM HTTP v1 with a service-account OAuth token (cached until 5 min before expiry). 10 s timeout per call. */
export class FcmPushGateway implements PushGateway {
  readonly driver = 'fcm' as const;
  private readonly log = new Logger(FcmPushGateway.name);
  private token: { value: string; exp: number } | null = null;
  constructor(private readonly account: ServiceAccount) {}

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 300 > now) return this.token.value;
    const key = await importPKCS8(this.account.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.account.client_email)
      .setSubject(this.account.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`fcm oauth ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, exp: now + json.expires_in };
    return json.access_token;
  }

  async send(m: PushMessage): Promise<PushResult> {
    const token = await this.accessToken();
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: m.token,
          notification: { title: m.title, body: m.body },
          data: m.data,
          android: { priority: 'high', notification: { channel_id: 'djaber_default', sound: 'default' } },
          apns: { payload: { aps: { sound: 'default', ...(m.badge !== undefined ? { badge: m.badge } : {}) } } },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, id: ((await res.json()) as { name?: string }).name };
    const err = (await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
    const code = err.error?.details?.find((d) => d.errorCode)?.errorCode ?? err.error?.status ?? '';
    if (code === 'UNREGISTERED' || res.status === 404) return { ok: false, error: 'UNREGISTERED' };
    if (code === 'INVALID_ARGUMENT') return { ok: false, error: 'INVALID_ARGUMENT' };
    this.log.warn({ status: res.status, code }, 'fcm send failed');
    return { ok: false, error: res.status >= 500 || res.status === 429 ? 'UNAVAILABLE' : 'INTERNAL' };
  }
}

export const createPushGateway = (cfg: AppConfig): PushGateway => {
  if (cfg.PUSH_DRIVER !== 'fcm') return new FakePushGateway();
  const live = cfg.NODE_ENV === 'production' || cfg.NODE_ENV === 'staging';
  if (!live && !cfg.PUSH_ALLOW_LIVE) throw new Error('PUSH_DRIVER=fcm is refused outside staging / production unless PUSH_ALLOW_LIVE=true');
  if (!cfg.FCM_SERVICE_ACCOUNT) throw new Error('PUSH_DRIVER=fcm needs FCM_SERVICE_ACCOUNT');
  const raw = cfg.FCM_SERVICE_ACCOUNT.trim().startsWith('{') ? cfg.FCM_SERVICE_ACCOUNT : Buffer.from(cfg.FCM_SERVICE_ACCOUNT, 'base64').toString('utf8');
  return new FcmPushGateway(JSON.parse(raw) as ServiceAccount);
};
