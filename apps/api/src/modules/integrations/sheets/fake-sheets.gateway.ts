// Simulated Google (SHEETS_DRIVER=fake, dev / test default): OAuth consent served by the API (`/dev/google/consent`), the
// spreadsheets kept in Redis so the whole GSH flow (connect, pick / paste / create, upsert by `djaber_id`, re-sort, revoke,
// backfill) runs end to end without any call to Google. Test hooks: `shuffle` (re-sort the rows), `revokeAll`, `failNext`.
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { SheetsApiError, spreadsheetUrlOf, type SheetCell, type SheetsErrorKind, type SheetsGateway, type SpreadsheetInfo } from './sheets.gateway';

type FakeSheet = { id: string; title: string; owner: string; tabs: Record<string, SheetCell[][]>; hiddenR: string[] };
const K = {
  sheet: (id: string) => `fake-google:sheet:${id}`,
  files: (email: string) => `fake-google:files:${email}`,
  token: (rt: string) => `fake-google:rt:${rt}`,
  failNext: (email: string) => `fake-google:fail:${email}`,
};
const TTL = 30 * 86_400;

export class FakeSheetsGateway implements SheetsGateway {
  readonly driver = 'fake' as const;
  constructor(
    private readonly redis: Redis,
    private readonly apiBase: string,
  ) {}

  authUrl(state: string, redirectUri: string) {
    return `${this.apiBase}/api/v1/dev/google/consent?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  /** The simulated consent page sends `code = fake-code.<base64url(email)>`. */
  async exchangeCode(code: string) {
    const m = /^fake-code\.([A-Za-z0-9_-]+)$/.exec(code);
    if (!m) throw new SheetsApiError('revoked', 'invalid_grant');
    const email = Buffer.from(m[1]!, 'base64url').toString('utf8').toLowerCase();
    const refreshToken = `fake-rt-${randomUUID()}`;
    await this.redis.set(K.token(refreshToken), email, 'EX', TTL);
    return { refreshToken, email };
  }

  private async owner(rt: string): Promise<string> {
    const email = await this.redis.get(K.token(rt));
    if (!email) throw new SheetsApiError('revoked', 'invalid_grant');
    const fail = await this.redis.getdel(K.failNext(email));
    if (fail) throw new SheetsApiError(fail as SheetsErrorKind, `simulated ${fail}`);
    return email;
  }

  async accessToken(rt: string) {
    await this.owner(rt);
    return { accessToken: `fake-at-${randomUUID()}`, expiresAt: new Date(Date.now() + 3600_000) };
  }

  async revoke(rt: string) {
    await this.redis.del(K.token(rt));
  }

  private async load(id: string, email: string): Promise<FakeSheet> {
    const raw = await this.redis.get(K.sheet(id));
    if (!raw) throw new SheetsApiError('not_found', 'spreadsheet not found');
    const s = JSON.parse(raw) as FakeSheet;
    // a pasted URL works when the sheet is shared with the account (here: any sheet of the simulated Google)
    void email;
    return s;
  }
  private async save(s: FakeSheet) {
    await this.redis.set(K.sheet(s.id), JSON.stringify(s), 'EX', TTL);
  }
  private info(s: FakeSheet): SpreadsheetInfo {
    return { id: s.id, title: s.title, tabs: Object.keys(s.tabs), url: spreadsheetUrlOf(s.id) };
  }

  async getSpreadsheet(rt: string, id: string) {
    return this.info(await this.load(id, await this.owner(rt)));
  }

  async createSpreadsheet(rt: string, title: string, tab: string) {
    const email = await this.owner(rt);
    const s: FakeSheet = { id: `fake${randomUUID().replace(/-/g, '')}`, title, owner: email, tabs: { [tab]: [] }, hiddenR: [] };
    await this.save(s);
    await this.redis.sadd(K.files(email), s.id);
    return this.info(s);
  }

  async ensureTab(rt: string, id: string, tab: string, header: readonly string[]) {
    const s = await this.load(id, await this.owner(rt));
    const rows = s.tabs[tab] ?? [];
    if (!rows.length) rows.push([...header]);
    else rows[0] = [...header];
    s.tabs[tab] = rows;
    if (!s.hiddenR.includes(tab)) s.hiddenR.push(tab);
    await this.save(s);
  }

  async readIdColumn(rt: string, id: string, tab: string) {
    const s = await this.load(id, await this.owner(rt));
    const rows = s.tabs[tab];
    if (!rows) throw new SheetsApiError('not_found', `tab ${tab} not found`);
    return rows.map((r) => String(r[17] ?? ''));
  }

  async updateRow(rt: string, id: string, tab: string, row: number, values: SheetCell[]) {
    const s = await this.load(id, await this.owner(rt));
    const rows = s.tabs[tab];
    if (!rows) throw new SheetsApiError('not_found', `tab ${tab} not found`);
    while (rows.length < row) rows.push([]);
    rows[row - 1] = [...values];
    await this.save(s);
  }

  async appendRows(rt: string, id: string, tab: string, add: SheetCell[][]) {
    const s = await this.load(id, await this.owner(rt));
    const rows = s.tabs[tab];
    if (!rows) throw new SheetsApiError('not_found', `tab ${tab} not found`);
    const out: number[] = [];
    for (const v of add) {
      rows.push([...v]);
      out.push(rows.length);
    }
    await this.save(s);
    return out;
  }

  async batchUpdate(rt: string, id: string, tab: string, list: { row: number; values: SheetCell[] }[]) {
    const s = await this.load(id, await this.owner(rt));
    const rows = s.tabs[tab];
    if (!rows) throw new SheetsApiError('not_found', `tab ${tab} not found`);
    for (const u of list) {
      while (rows.length < u.row) rows.push([]);
      rows[u.row - 1] = [...u.values];
    }
    await this.save(s);
  }

  async listFiles(rt: string) {
    const email = await this.owner(rt);
    const ids = await this.redis.smembers(K.files(email));
    const out: { id: string; name: string }[] = [];
    for (const id of ids) {
      const raw = await this.redis.get(K.sheet(id));
      if (raw) out.push({ id, name: (JSON.parse(raw) as FakeSheet).title });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  // --- simulation hooks (dev pages and tests) ---------------------------------------------------------------------------------
  async dump(id: string): Promise<FakeSheet | null> {
    const raw = await this.redis.get(K.sheet(id));
    return raw ? (JSON.parse(raw) as FakeSheet) : null;
  }
  /** Re-sorts the data rows (header kept) — GSH-04: rows must still be found by `djaber_id`. */
  async shuffle(id: string, tab: string) {
    const s = await this.dump(id);
    if (!s?.tabs[tab]) return false;
    const [header, ...data] = s.tabs[tab]!;
    data.reverse();
    s.tabs[tab] = [header ?? [], ...data];
    await this.save(s);
    return true;
  }
  /** Deletes one data row (a row removed by hand in the sheet is re-appended on the next update, FL-11). */
  async deleteRow(id: string, tab: string, row: number) {
    const s = await this.dump(id);
    if (!s?.tabs[tab] || row < 2) return false;
    s.tabs[tab]!.splice(row - 1, 1);
    await this.save(s);
    return true;
  }
  async deleteSpreadsheet(id: string) {
    await this.redis.del(K.sheet(id));
  }
  /** Revokes every refresh token of an account (the merchant removed Djaber from his Google account). */
  async revokeAccount(email: string) {
    const keys = await this.redis.keys('fake-google:rt:*');
    for (const k of keys) if ((await this.redis.get(k)) === email) await this.redis.del(k);
  }
  async revokeToken(rt: string) {
    await this.redis.del(K.token(rt));
  }
  async failNext(email: string, kind: SheetsErrorKind) {
    await this.redis.set(K.failNext(email), kind, 'EX', 600);
  }
  /** A spreadsheet that exists in the simulated Google without being created through Djaber (pasted URL / Picker). */
  async seedSpreadsheet(email: string, title: string): Promise<SpreadsheetInfo> {
    const s: FakeSheet = { id: `fake${randomUUID().replace(/-/g, '')}`, title, owner: email, tabs: { Sheet1: [] }, hiddenR: [] };
    await this.save(s);
    await this.redis.sadd(K.files(email), s.id);
    return this.info(s);
  }
}
