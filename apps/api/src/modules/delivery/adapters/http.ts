// HTTP transport of the live courier drivers. Pure request/response: the contract tests replay recorded payloads
// through the same adapters with a fake transport (no network). 10 s timeout (03-events §7). Network errors, timeouts,
// 5xx and 429 become `CourierError('unavailable')` (queued retry); 401 / 403 become `auth`.
import { CourierError } from './courier-adapter';

export type HttpRequest = { method: 'GET' | 'POST' | 'DELETE'; url: string; headers: Record<string, string>; body?: unknown };
export type HttpResponse = { status: number; json: unknown; bytes: Buffer; contentType: string };
export type CourierTransport = (req: HttpRequest) => Promise<HttpResponse>;

export const fetchTransport =
  (timeoutMs = 10_000): CourierTransport =>
  async (req) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: { ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...req.headers },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: ctrl.signal,
      });
      const bytes = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') ?? '';
      let json: unknown = null;
      if (contentType.includes('json') || (bytes.length && (bytes[0] === 0x7b || bytes[0] === 0x5b))) {
        try {
          json = JSON.parse(bytes.toString('utf8'));
        } catch {
          json = null;
        }
      }
      return { status: res.status, json, bytes, contentType };
    } catch (e) {
      throw new CourierError('unavailable', e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network error');
    } finally {
      clearTimeout(timer);
    }
  };

/** Common status handling: 401/403 ⇒ auth, 429/5xx ⇒ unavailable. Returns the response for the caller to read. */
export const checkStatus = (res: HttpResponse, opts: { notFound?: boolean } = {}): HttpResponse => {
  if (res.status === 401 || res.status === 403) throw new CourierError('auth', `HTTP ${res.status}`);
  if (res.status === 429 || res.status >= 500) throw new CourierError('unavailable', `HTTP ${res.status}`);
  if (opts.notFound && res.status === 404) throw new CourierError('not_found', 'HTTP 404');
  return res;
};

/** Message → dialog field (05-integrations §2.2: "Commune" ⇒ commune, "Mobile"/"Tel" ⇒ phone, "Wilaya" ⇒ wilaya, else other). */
export const fieldOfMessage = (message: string): 'commune' | 'phone' | 'wilaya' | 'address' | 'stopdesk' | 'weight' | 'other' => {
  const m = message.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (m.includes('commune')) return 'commune';
  if (m.includes('mobile') || m.includes('tel') || m.includes('phone')) return 'phone';
  if (m.includes('wilaya')) return 'wilaya';
  if (m.includes('stopdesk') || m.includes('stop desk') || m.includes('center') || m.includes('centre')) return 'stopdesk';
  if (m.includes('adresse') || m.includes('address')) return 'address';
  if (m.includes('poids') || m.includes('weight')) return 'weight';
  return 'other';
};

export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
export const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};
/** Courier dates ("2026-10-12 14:30:00", Africa/Algiers wall time without offset) → ISO UTC. */
export const courierDate = (v: unknown): string | null => {
  const s = str(v).trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]! - 1, +m[5]!, +(m[6] ?? 0))).toISOString(); // Algiers = UTC+1, no DST
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
