// 05-integrations §1.2 — pure helpers (no network): webhook body signature and the data-deletion `signed_request`.
import { createHmac, timingSafeEqual } from 'node:crypto';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** `sha256=<hex hmac_sha256(appSecret, rawBody)>` — value of `X-Hub-Signature-256`. */
export const signWebhookBody = (appSecret: string, rawBody: Buffer | string) => `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

/** Constant-time check of `X-Hub-Signature-256`. A missing secret, header or body never verifies. */
export const verifyWebhookSignature = (appSecret: string | undefined, rawBody: Buffer | undefined, header: unknown): boolean => {
  if (!appSecret || !rawBody || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  return safeEqual(signWebhookBody(appSecret, rawBody), header);
};

export type SignedRequestPayload = { user_id?: string; algorithm?: string; issued_at?: number } & Record<string, unknown>;

/** `signed_request` = `<base64url(hmac_sha256(appSecret, payload))>.<base64url(JSON payload)>`; null when invalid. */
export const parseSignedRequest = (appSecret: string | undefined, signedRequest: unknown): SignedRequestPayload | null => {
  if (!appSecret || typeof signedRequest !== 'string') return null;
  const dot = signedRequest.indexOf('.');
  if (dot <= 0) return null;
  const sig = signedRequest.slice(0, dot);
  const payload = signedRequest.slice(dot + 1);
  const expected = createHmac('sha256', appSecret).update(payload).digest('base64url');
  // Meta sends unpadded base64url; tolerate padding and the `+/` alphabet
  const given = sig.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (!safeEqual(expected, given)) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedRequestPayload;
    if (json.algorithm && String(json.algorithm).toUpperCase() !== 'HMAC-SHA256') return null;
    return json;
  } catch {
    return null;
  }
};

/** Builds a `signed_request` (tests and the dev simulator only). */
export const buildSignedRequest = (appSecret: string, payload: SignedRequestPayload) => {
  const body = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), ...payload })).toString('base64url');
  return `${createHmac('sha256', appSecret).update(body).digest('base64url')}.${body}`;
};
