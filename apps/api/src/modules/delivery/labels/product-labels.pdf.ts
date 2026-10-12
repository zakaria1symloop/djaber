// M2 carry-over closed in M6 — product label sheet (`POST /products/bulk/labels` → 202): A4 portrait, 3 × 8 labels of
// 70 × 37 mm: product (+ variant) name, SKU, price `12 500 DA`, QR code of the SKU. Arabic names use the slip fonts.
import PDFDocument from 'pdfkit';
import { drawBidiLine, formatSlipAmount, registerSlipFonts, wrapBidi, BIDI_LINE } from '../../orders/print/order-slip.pdf';
import { drawQr } from './djaber-label.pdf';

export type ProductLabelData = { name: string; variant: string | null; sku: string | null; price: number | null };

const MM = 72 / 25.4;
const A4: [number, number] = [210 * MM, 297 * MM];
const COLS = 3;
const ROWS = 8;
export const PRODUCT_LABELS_PER_PAGE = COLS * ROWS;

export async function renderProductLabels(labels: ProductLabelData[]): Promise<Buffer> {
  return new Promise<Buffer>((resolvePdf, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: `${labels.length} étiquettes`, Creator: 'Djaber', Producer: 'Djaber' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      registerSlipFonts(doc);
      const cw = A4[0] / COLS;
      const ch = A4[1] / ROWS;
      if (!labels.length) doc.addPage({ size: A4, margin: 0 });
      labels.forEach((l, i) => {
        const slot = i % PRODUCT_LABELS_PER_PAGE;
        if (slot === 0) doc.addPage({ size: A4, margin: 0 });
        const x = (slot % COLS) * cw;
        const y = Math.floor(slot / COLS) * ch;
        doc.save().lineWidth(0.3).strokeColor('#bbbbbb').rect(x + 2, y + 2, cw - 4, ch - 4).stroke().restore();
        const pad = 8;
        const qr = l.sku ? ch - 2 * pad : 0;
        const tw = cw - 2 * pad - (qr ? qr + 4 : 0);
        let ty = y + pad;
        for (const line of wrapBidi(doc, l.name, tw, 9, true, 2)) {
          drawBidiLine(doc, line, x + pad, ty, tw, { size: 9, bold: true });
          ty += 9 * BIDI_LINE;
        }
        if (l.variant) {
          drawBidiLine(doc, l.variant, x + pad, ty, tw, { size: 8 });
          ty += 8 * BIDI_LINE;
        }
        if (l.sku) drawBidiLine(doc, l.sku, x + pad, ty, tw, { size: 7 });
        if (l.price !== null) drawBidiLine(doc, formatSlipAmount(l.price), x + pad, y + ch - pad - 13 * BIDI_LINE, tw, { size: 13, bold: true });
        if (l.sku) drawQr(doc, l.sku, x + cw - pad - qr, y + pad, qr);
      });
      doc.end();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
