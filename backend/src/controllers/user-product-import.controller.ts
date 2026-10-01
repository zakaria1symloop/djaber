/**
 * Bulk product import from an Excel / CSV sheet — POST /api/user-stock/products/import.
 *
 * Contract (documented in openapi/openapi.yaml):
 *  - multipart upload, field `file`, `.xlsx` / `.xlsm` / `.xls` / `.csv`, 5 MB max,
 *    IMPORT_MAX_ROWS data rows max;
 *  - the FIRST row is the header; column names are matched in French and in
 *    English, case- and accent-insensitive (`Prix de vente` = `sellingPrice`);
 *  - EVERY row is validated before anything is written, and the answer is a
 *    per-row report `{ total, imported, skipped, errors: [{ row, field, code, message }] }`
 *    using the same translated error contract as the rest of the API;
 *  - the valid rows are written in ONE transaction (all-or-nothing): a failure
 *    mid-way leaves nothing behind and answers 500 IMPORT_FAILED. Rows that
 *    failed validation are skipped, never half-written;
 *  - missing categories named in the file are created on the fly;
 *  - a SKU duplicated inside the file, or already used by a LIVE product of the
 *    caller, is rejected row by row (a DELETED product no longer holds its SKU —
 *    see `deleteProduct` in user-stock.controller.ts).
 */
import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../config/database';
import { fail, handleError, resolveLang, translate, type ErrorCode, type Params } from '../errors';

// ============================================================================
// Limits
// ============================================================================

const IMPORT_MAX_ROWS = 2000;
const NAME_MAX = 255;
const SKU_MAX = 255;
const DESCRIPTION_MAX = 5000;
const UNIT_LABEL_MAX = 50;
const DECIMAL_10_2_MAX = 99999999.99;
const MYSQL_INT_MAX = 2147483647;

// ============================================================================
// Header matching — French and English, case/accent-insensitive
// ============================================================================

type Column = 'name' | 'sku' | 'description' | 'costPrice' | 'sellingPrice' | 'quantity' | 'category' | 'unit';

/** Lowercase, drop accents, keep letters and digits only: "Prix d’achat" → "prixdachat". */
function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const COLUMN_ALIASES: Record<Column, string[]> = {
  name: ['name', 'nom', 'produit', 'product', 'libelle', 'designation', 'nomduproduit', 'productname'],
  sku: ['sku', 'reference', 'ref', 'codearticle', 'code', 'referenceproduit'],
  description: ['description', 'desc', 'details', 'detail'],
  costPrice: ['costprice', 'prixdachat', 'prixachat', 'cout', 'coutunitaire', 'cost', 'achat', 'purchaseprice'],
  sellingPrice: ['sellingprice', 'prixdevente', 'prixvente', 'prix', 'price', 'vente', 'saleprice'],
  quantity: ['quantity', 'quantite', 'qte', 'qty', 'stock'],
  category: ['category', 'categorie', 'famille', 'rayon'],
  unit: ['unit', 'unite', 'unitemesure', 'uom', 'mesure'],
};

/** Map each spreadsheet column index to the product field it feeds. */
function mapHeader(headerRow: unknown[]): Partial<Record<Column, number>> {
  const map: Partial<Record<Column, number>> = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;
    for (const column of Object.keys(COLUMN_ALIASES) as Column[]) {
      if (map[column] === undefined && COLUMN_ALIASES[column].includes(key)) {
        map[column] = index;
        return;
      }
    }
  });
  return map;
}

// ============================================================================
// Per-row report
// ============================================================================

interface RowError {
  row: number;
  field: string | null;
  code: ErrorCode;
  message: string;
}

/** Collects row errors and translates each message once, in the caller's language. */
class Report {
  readonly errors: RowError[] = [];
  constructor(private readonly lang: ReturnType<typeof resolveLang>) {}

  add(row: number, field: string | null, code: ErrorCode, params?: Params): void {
    this.errors.push({
      row,
      field,
      code,
      message: translate(this.lang, code, { ...(field ? { field } : {}), ...(params ?? {}) }),
    });
  }

  /** Rows that collected at least one error. */
  get skippedRows(): Set<number> {
    return new Set(this.errors.map((e) => e.row));
  }
}

// ============================================================================
// Cell readers (a spreadsheet cell is always text or a number)
// ============================================================================

function cellText(row: unknown[], index: number | undefined): string {
  if (index === undefined) return '';
  const raw = row[index];
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
}

/** Accepts "1 500,50", "1500.50", 1500.5. Returns null when the cell is empty, NaN when unparseable. */
function cellNumber(row: unknown[], index: number | undefined): number | null {
  const text = cellText(row, index);
  if (text === '') return null;
  if (typeof row[index as number] === 'number') return row[index as number] as number;
  const cleaned = text.replace(/\s| /g, '').replace(/,/g, '.');
  return Number(cleaned);
}

// ============================================================================
// Controller
// ============================================================================

interface PendingProduct {
  sku: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  unitLabel: string;
  unitId: string | null;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
}

export const importProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file || !file.buffer || file.buffer.length === 0) return fail(req, res, 'FILE_REQUIRED');

    // ------------------------------------------------------------------ parse
    let rows: unknown[][];
    try {
      // A CSV must be decoded as UTF-8 text BEFORE parsing: fed as a raw buffer
      // it is read byte-per-byte and accented headers arrive as mojibake
      // ("Référence" → "RÃ©fÃ©rence"), which no alias would ever match.
      // An .xlsx carries its own encoding, so it is parsed as a buffer.
      const isCsv = /\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv';
      const book = isCsv
        ? XLSX.read(file.buffer.toString('utf8').replace(/^﻿/, ''), { type: 'string', raw: false })
        : XLSX.read(file.buffer, { type: 'buffer', cellDates: false, raw: false });
      const sheetName = book.SheetNames[0];
      if (!sheetName) throw new Error('no sheet');
      rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
    } catch {
      return fail(req, res, 'IMPORT_FILE_UNREADABLE');
    }

    if (rows.length === 0) return fail(req, res, 'IMPORT_FILE_EMPTY');

    console.log('DBG name=%s mime=%s hdr=%j norm=%j', file.originalname, file.mimetype, rows[0], (rows[0]||[]).map(normalizeHeader));
    const header = mapHeader(rows[0] ?? []);
    if (header.name === undefined || header.sku === undefined || header.sellingPrice === undefined) {
      return fail(req, res, 'IMPORT_COLUMNS_MISSING', { columns: 'name / nom, sku / référence, sellingPrice / prix de vente' });
    }

    // Row 1 is the header, so data rows start at spreadsheet row 2 — the report
    // uses those numbers, which are the ones the merchant sees in Excel.
    const dataRows = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    if (dataRows.length === 0) return fail(req, res, 'IMPORT_FILE_EMPTY');
    if (dataRows.length > IMPORT_MAX_ROWS) {
      return fail(req, res, 'IMPORT_TOO_MANY_ROWS', { count: dataRows.length, max: IMPORT_MAX_ROWS });
    }

    // --------------------------------------------------------- existing state
    const [liveProducts, categories, units] = await Promise.all([
      prisma.product.findMany({ where: { userId, isActive: true }, select: { sku: true } }),
      prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
      prisma.unit.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { id: true, name: true, abbreviation: true } }),
    ]);
    const takenSkus = new Set(liveProducts.map((p) => p.sku.toLowerCase()));
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const unitByLabel = new Map<string, string>();
    for (const u of units) {
      unitByLabel.set(u.name.trim().toLowerCase(), u.id);
      if (u.abbreviation) unitByLabel.set(u.abbreviation.trim().toLowerCase(), u.id);
    }

    // ------------------------------------------------- validate EVERY row first
    const report = new Report(resolveLang(req));
    const pending: PendingProduct[] = [];
    const skuFirstSeenAtRow = new Map<string, number>();
    const newCategoryNames = new Map<string, string>(); // lowercase → original spelling

    dataRows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const row = raw as unknown[];
      let rowOk = true;
      const bad = (field: string | null, code: ErrorCode, params?: Params) => {
        rowOk = false;
        report.add(rowNumber, field, code, params);
      };

      // name / sku
      const name = cellText(row, header.name);
      if (name === '') bad('name', 'FIELD_REQUIRED');
      else if (name.length > NAME_MAX) bad('name', 'FIELD_TOO_LONG', { max: NAME_MAX });

      const sku = cellText(row, header.sku);
      if (sku === '') bad('sku', 'FIELD_REQUIRED');
      else if (sku.length > SKU_MAX) bad('sku', 'FIELD_TOO_LONG', { max: SKU_MAX });
      else {
        const key = sku.toLowerCase();
        const firstRow = skuFirstSeenAtRow.get(key);
        if (firstRow !== undefined) bad('sku', 'IMPORT_DUPLICATE_SKU_IN_FILE', { sku, row: firstRow });
        else if (takenSkus.has(key)) bad('sku', 'PRODUCT_SKU_ALREADY_EXISTS', { sku });
        else skuFirstSeenAtRow.set(key, rowNumber);
      }

      // description
      const description = cellText(row, header.description);
      if (description.length > DESCRIPTION_MAX) bad('description', 'FIELD_TOO_LONG', { max: DESCRIPTION_MAX });

      // money
      const money = (field: 'costPrice' | 'sellingPrice', index2: number | undefined, required: boolean): number => {
        const value = cellNumber(row, index2);
        if (value === null) {
          if (required) bad(field, 'FIELD_REQUIRED');
          return 0;
        }
        if (!Number.isFinite(value)) {
          bad(field, 'FIELD_MUST_BE_NUMBER');
          return 0;
        }
        if (value < 0) bad(field, 'FIELD_MUST_BE_NON_NEGATIVE');
        else if (value > DECIMAL_10_2_MAX) bad(field, 'FIELD_OUT_OF_RANGE', { min: 0, max: DECIMAL_10_2_MAX });
        return value;
      };
      const costPrice = money('costPrice', header.costPrice, false);
      const sellingPrice = money('sellingPrice', header.sellingPrice, true);
      if (rowOk && sellingPrice < costPrice) bad('sellingPrice', 'PRODUCT_SELLING_BELOW_COST');

      // quantity — optional; an empty cell simply means "no opening stock"
      let quantity = 0;
      const rawQuantity = cellNumber(row, header.quantity);
      if (rawQuantity !== null) {
        if (!Number.isFinite(rawQuantity)) bad('quantity', 'FIELD_MUST_BE_NUMBER');
        else if (!Number.isInteger(rawQuantity)) bad('quantity', 'FIELD_MUST_BE_INTEGER');
        else if (rawQuantity < 0) bad('quantity', 'FIELD_MUST_BE_NON_NEGATIVE');
        else if (rawQuantity > MYSQL_INT_MAX) bad('quantity', 'FIELD_OUT_OF_RANGE', { min: 0, max: MYSQL_INT_MAX });
        else quantity = rawQuantity;
      }

      // category — created on the fly when it does not exist yet
      const categoryName = cellText(row, header.category);
      if (categoryName !== '') {
        if (categoryName.length > NAME_MAX) bad('category', 'FIELD_TOO_LONG', { max: NAME_MAX });
        else if (!categoryByName.has(categoryName.toLowerCase())) newCategoryNames.set(categoryName.toLowerCase(), categoryName);
      }

      // unit — free-text label, mapped to a known Unit row when one matches
      const unitLabel = cellText(row, header.unit);
      if (unitLabel.length > UNIT_LABEL_MAX) bad('unit', 'FIELD_TOO_LONG', { max: UNIT_LABEL_MAX });

      if (!rowOk) return;
      pending.push({
        sku,
        name,
        description: description || null,
        categoryName: categoryName || null,
        unitLabel: unitLabel || 'piece',
        unitId: unitLabel ? unitByLabel.get(unitLabel.toLowerCase()) ?? null : null,
        costPrice,
        sellingPrice,
        quantity,
      });
    });

    // ------------------------------------------------------ write (one transaction)
    if (pending.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          // Categories named in the file but missing: created once, reused by every row.
          for (const [key, label] of newCategoryNames) {
            if (categoryByName.has(key)) continue;
            const created = await tx.category.create({ data: { userId, name: label, color: '#6B7280' } });
            categoryByName.set(key, created.id);
          }

          for (const item of pending) {
            const created = await tx.product.create({
              data: {
                userId,
                sku: item.sku,
                name: item.name,
                description: item.description,
                categoryId: item.categoryName ? categoryByName.get(item.categoryName.toLowerCase()) ?? null : null,
                unitId: item.unitId,
                costPrice: item.costPrice,
                sellingPrice: item.sellingPrice,
                quantity: item.quantity,
                minQuantity: 0,
                unit: item.unitLabel,
              },
              select: { id: true },
            });
            if (item.quantity > 0) {
              await tx.stockMovement.create({
                data: { userId, productId: created.id, type: 'in', quantity: item.quantity, reason: 'Import' },
              });
            }
          }
        },
        { timeout: 120_000, maxWait: 15_000 },
      );
    }

    res.json({
      total: dataRows.length,
      imported: pending.length,
      skipped: report.skippedRows.size,
      errors: report.errors,
    });
  } catch (error: any) {
    // A P2002 here means a SKU was taken between the pre-check and the write:
    // the transaction rolled back, so nothing was imported.
    if (error?.code === 'P2002') return fail(req, res, 'IMPORT_FAILED');
    handleError(req, res, error, 'IMPORT_FAILED');
  }
};

export { IMPORT_MAX_ROWS };
export type { RowError };