// GSH-01…04 — real Google driver (05-integrations §3). SAFETY: never instantiated in development / test unless
// SHEETS_ALLOW_LIVE=true (see `createSheetsGateway`). Every call has a 10 s timeout; 401 / invalid_grant ⇒ `revoked`,
// 404 / 403 (not shared) ⇒ `not_found`, 429 / quotaExceeded ⇒ `quota`.
import { SheetsApiError, spreadsheetUrlOf, type SheetCell, type SheetsGateway, type SpreadsheetInfo } from './sheets.gateway';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOKE = 'https://oauth2.googleapis.com/revoke';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = 'openid email https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const TIMEOUT_MS = 10_000;

const a1 = (tab: string, range: string) => `'${tab.replace(/'/g, "''")}'!${range}`;

export class GoogleSheetsGateway implements SheetsGateway {
  readonly driver = 'google' as const;
  private readonly cache = new Map<string, { token: string; exp: number }>();

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async call(url: string, init: RequestInit = {}): Promise<any> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      const text = await res.text();
      const body = text ? JSON.parse(text) : {};
      if (res.ok) return body;
      const reason = JSON.stringify(body).slice(0, 300);
      if (res.status === 401 || body?.error === 'invalid_grant') throw new SheetsApiError('revoked', reason);
      if (res.status === 429 || /quota|rateLimit/i.test(reason)) throw new SheetsApiError('quota', reason);
      if (res.status === 404 || res.status === 403) throw new SheetsApiError('not_found', reason);
      throw new SheetsApiError('other', `${res.status} ${reason}`);
    } catch (e) {
      if (e instanceof SheetsApiError) throw e;
      throw new SheetsApiError('other', ctrl.signal.aborted ? 'timeout' : String((e as Error).message));
    } finally {
      clearTimeout(timer);
    }
  }

  authUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ client_id: this.clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: SCOPES, state });
    return `${AUTH}?${q}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const body = new URLSearchParams({ code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' });
    const r = await this.call(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!r.refresh_token) throw new SheetsApiError('revoked', 'no refresh_token (consent not granted offline)');
    const payload = r.id_token ? JSON.parse(Buffer.from(String(r.id_token).split('.')[1] ?? '', 'base64url').toString('utf8')) : {};
    return { refreshToken: String(r.refresh_token), email: String(payload.email ?? '').toLowerCase() };
  }

  async accessToken(refreshToken: string) {
    const hit = this.cache.get(refreshToken);
    if (hit && hit.exp > Date.now() + 60_000) return { accessToken: hit.token, expiresAt: new Date(hit.exp) };
    const body = new URLSearchParams({ refresh_token: refreshToken, client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'refresh_token' });
    const r = await this.call(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const exp = Date.now() + Number(r.expires_in ?? 3600) * 1000;
    this.cache.set(refreshToken, { token: String(r.access_token), exp });
    return { accessToken: String(r.access_token), expiresAt: new Date(exp) };
  }

  async revoke(refreshToken: string) {
    this.cache.delete(refreshToken);
    await this.call(`${REVOKE}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => undefined);
  }

  private async authed(rt: string, url: string, init: RequestInit = {}) {
    const { accessToken } = await this.accessToken(rt);
    return this.call(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
  }

  async getSpreadsheet(rt: string, id: string): Promise<SpreadsheetInfo> {
    const r = await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}?fields=spreadsheetId,properties.title,sheets.properties`);
    return { id: r.spreadsheetId, title: r.properties?.title ?? '', tabs: (r.sheets ?? []).map((s: any) => s.properties?.title), url: spreadsheetUrlOf(r.spreadsheetId) };
  }

  async createSpreadsheet(rt: string, title: string, tab: string): Promise<SpreadsheetInfo> {
    const r = await this.authed(rt, SHEETS, { method: 'POST', body: JSON.stringify({ properties: { title }, sheets: [{ properties: { title: tab } }] }) });
    return { id: r.spreadsheetId, title, tabs: [tab], url: spreadsheetUrlOf(r.spreadsheetId) };
  }

  async ensureTab(rt: string, id: string, tab: string, header: readonly string[]) {
    const info = await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}?fields=sheets.properties`);
    let sheet = (info.sheets ?? []).find((s: any) => s.properties?.title === tab)?.properties;
    if (!sheet) {
      const r = await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
      sheet = r.replies?.[0]?.addSheet?.properties;
    }
    await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(a1(tab, 'A1:R1'))}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [header] }) });
    const sheetId = sheet?.sheetId ?? 0;
    await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
          { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
          { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 17, endIndex: 18 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } },
        ],
      }),
    });
  }

  async readIdColumn(rt: string, id: string, tab: string) {
    const r = await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(a1(tab, 'R:R'))}?majorDimension=COLUMNS`);
    return ((r.values?.[0] ?? []) as unknown[]).map((v) => String(v ?? ''));
  }

  async updateRow(rt: string, id: string, tab: string, row: number, values: SheetCell[]) {
    await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(a1(tab, `A${row}:R${row}`))}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [values] }) });
  }

  async appendRows(rt: string, id: string, tab: string, rows: SheetCell[][]) {
    const r = await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(a1(tab, 'A:R'))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: rows }) });
    const m = /!A(\d+):/.exec(String(r.updates?.updatedRange ?? ''));
    const first = m ? Number(m[1]) : 0;
    return rows.map((_, i) => (first ? first + i : 0));
  }

  async batchUpdate(rt: string, id: string, tab: string, rows: { row: number; values: SheetCell[] }[]) {
    if (!rows.length) return;
    await this.authed(rt, `${SHEETS}/${encodeURIComponent(id)}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: rows.map((r) => ({ range: a1(tab, `A${r.row}:R${r.row}`), values: [r.values] })) }),
    });
  }

  async listFiles() {
    return []; // the Google Picker runs in the browser with the token of `accessToken`
  }
}
