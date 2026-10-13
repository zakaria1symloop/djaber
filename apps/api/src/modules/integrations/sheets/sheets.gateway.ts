// GSH-01…04 — port to Google (OAuth + Drive/Sheets API). Two drivers behind it: `GoogleSheetsGateway` (real Google, refused in
// development / test unless SHEETS_ALLOW_LIVE=true) and `FakeSheetsGateway` (simulated Google kept in Redis, dev / test default).
export const SHEETS_GATEWAY = Symbol('SHEETS_GATEWAY');

/** Provider failure classes (05-integrations §3 "Errors"). */
export type SheetsErrorKind = 'revoked' | 'not_found' | 'quota' | 'other';
export class SheetsApiError extends Error {
  constructor(
    readonly kind: SheetsErrorKind,
    message: string,
  ) {
    super(message);
  }
}
export const SHEETS_ERROR_CODE: Record<SheetsErrorKind, 'SHEETS_TOKEN_REVOKED' | 'SHEETS_SPREADSHEET_NOT_FOUND' | 'SHEETS_QUOTA' | 'INTERNAL'> = {
  revoked: 'SHEETS_TOKEN_REVOKED',
  not_found: 'SHEETS_SPREADSHEET_NOT_FOUND',
  quota: 'SHEETS_QUOTA',
  other: 'INTERNAL',
};

export type SheetCell = string | number;
export type SpreadsheetInfo = { id: string; title: string; tabs: string[]; url: string };

export interface SheetsGateway {
  readonly driver: 'fake' | 'google';
  /** Consent URL (`access_type=offline`, `prompt=consent`, scopes `spreadsheets` + `drive.file`). */
  authUrl(state: string, redirectUri: string): string;
  /** Code ⇒ refresh token + Google account e-mail. */
  exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken: string; email: string }>;
  /** Short-lived access token (Picker, API calls). */
  accessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>;
  revoke(refreshToken: string): Promise<void>;
  getSpreadsheet(refreshToken: string, spreadsheetId: string): Promise<SpreadsheetInfo>;
  createSpreadsheet(refreshToken: string, title: string, tab: string): Promise<SpreadsheetInfo>;
  /** Creates the tab when missing, writes the header row (bold, frozen) and hides column R (`djaber_id`). */
  ensureTab(refreshToken: string, spreadsheetId: string, tab: string, header: readonly string[]): Promise<void>;
  /** Values of column R (`djaber_id`), index 0 = row 1 (the header). */
  readIdColumn(refreshToken: string, spreadsheetId: string, tab: string): Promise<string[]>;
  /** Overwrites `A{row}:R{row}` (1-based). */
  updateRow(refreshToken: string, spreadsheetId: string, tab: string, row: number, values: SheetCell[]): Promise<void>;
  /** Appends rows after the last one; returns the 1-based row index of each. */
  appendRows(refreshToken: string, spreadsheetId: string, tab: string, rows: SheetCell[][]): Promise<number[]>;
  /** Several `A{row}:R{row}` overwrites in one call (backfill batches). */
  batchUpdate(refreshToken: string, spreadsheetId: string, tab: string, rows: { row: number; values: SheetCell[] }[]): Promise<void>;
  /** Spreadsheets the app can open (fake Picker list; empty for Google, whose Picker runs in the browser). */
  listFiles(refreshToken: string): Promise<{ id: string; name: string }[]>;
}

export const spreadsheetUrlOf = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
