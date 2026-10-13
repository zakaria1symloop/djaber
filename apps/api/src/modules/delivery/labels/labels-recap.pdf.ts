// M11 — DLG "Imprimer les bordereaux" option "Inclure le récapitulatif interne": an A4 internal recap of the printed
// parcels (order number, client, wilaya, courier, tracking, COD amount) with the parcel count and the COD total. It is
// the first page(s) of the merged PDF, or `recapitulatif.pdf` inside the ZIP of "Un PDF par commande". Never handed to
// the courier. pdfkit renderer, Arabic runs through the shared bidi helpers of the A5 slip. Pure function, no DI.
import PDFDocument from 'pdfkit';
import { BIDI_LINE, drawBidiLine, formatSlipAmount, formatSlipPhone, measureBidi, registerSlipFonts } from '../../orders/print/order-slip.pdf';
import type { LabelLang } from './djaber-label.pdf';

export type LabelRecapRow = { orderNumber: string; recipientName: string; phone: string; wilaya: string | null; courier: string; trackingNumber: string | null; codAmount: number };

const MM = 72 / 25.4;
const A4: [number, number] = [210 * MM, 297 * MM];
const MARGIN = 14 * MM;
const ROW_H = 18;

type Key = 'title' | 'subtitle' | 'order' | 'client' | 'wilaya' | 'courier' | 'tracking' | 'cod' | 'total' | 'parcels';
export const RECAP_TEXTS: Record<LabelLang, Record<Key, string>> = {
  fr: { title: 'Récapitulatif des bordereaux', subtitle: 'Document interne — ne pas remettre au livreur', order: 'Commande', client: 'Client', wilaya: 'Wilaya', courier: 'Transporteur', tracking: 'Suivi', cod: 'À encaisser', total: 'Total à encaisser', parcels: 'Colis' },
  ar: { title: 'ملخص بوليصات الشحن', subtitle: 'وثيقة داخلية — لا تُسلَّم لعامل التوصيل', order: 'الطلب', client: 'الزبون', wilaya: 'الولاية', courier: 'شركة التوصيل', tracking: 'التتبع', cod: 'المبلغ المطلوب', total: 'إجمالي المبلغ المطلوب', parcels: 'الطرود' },
  en: { title: 'Labels recap', subtitle: 'Internal document — do not hand to the courier', order: 'Order', client: 'Client', wilaya: 'Wilaya', courier: 'Courier', tracking: 'Tracking', cod: 'To collect', total: 'Total to collect', parcels: 'Parcels' },
};

/** Column layout (fractions of the table width), reading order: mirrored in Arabic. */
const COLS: { key: Exclude<Key, 'title' | 'subtitle' | 'total' | 'parcels'>; w: number; align?: 'right' }[] = [
  { key: 'order', w: 0.12 },
  { key: 'client', w: 0.27 },
  { key: 'wilaya', w: 0.15 },
  { key: 'courier', w: 0.14 },
  { key: 'tracking', w: 0.17 },
  { key: 'cod', w: 0.15, align: 'right' },
];

const clip = (doc: PDFKit.PDFDocument, text: string, w: number, size: number) => {
  let t = text;
  while (t.length > 1 && measureBidi(doc, t, size) > w) t = t.slice(0, -1);
  return t === text ? t : `${t.slice(0, -1)}…`;
};

/** The recap as a standalone PDF (one or more A4 pages). */
export async function renderLabelsRecap(rows: LabelRecapRow[], lang: LabelLang = 'fr', generatedAt = new Date()): Promise<Buffer> {
  return new Promise<Buffer>((resolvePdf, reject) => {
    const T = RECAP_TEXTS[lang];
    const rtl = lang === 'ar';
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0, lang: rtl ? 'ar-DZ' : lang === 'fr' ? 'fr-DZ' : 'en', info: { Title: T.title, Creator: 'Djaber', Producer: 'Djaber' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      registerSlipFonts(doc);
      const width = A4[0] - 2 * MARGIN;
      // x of each column in reading order (right to left in Arabic)
      let acc = 0;
      const cols = COLS.map((c) => {
        const w = c.w * width;
        const x = rtl ? MARGIN + width - acc - w : MARGIN + acc;
        acc += w;
        return { ...c, x, w };
      });
      const align = (c: { align?: 'right' }) => (c.align === 'right' ? (rtl ? 'left' : 'right') : rtl ? 'right' : 'left');
      let y = MARGIN;
      const header = () => {
        doc.addPage({ size: A4, margin: 0 });
        y = MARGIN;
        drawBidiLine(doc, T.title, MARGIN, y, width, { size: 16, bold: true, align: rtl ? 'right' : 'left' });
        y += 16 * BIDI_LINE;
        drawBidiLine(doc, `${T.subtitle} · ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, MARGIN, y, width, { size: 8, align: rtl ? 'right' : 'left' });
        y += 8 * BIDI_LINE + 8;
        doc.save().rect(MARGIN, y, width, ROW_H).fill('#eeeeee').restore();
        for (const c of cols) drawBidiLine(doc, T[c.key], c.x + 3, y + 4, c.w - 6, { size: 8, bold: true, align: align(c) });
        y += ROW_H;
      };
      header();
      for (const r of rows) {
        if (y + ROW_H > A4[1] - MARGIN - 2 * ROW_H) header();
        const cells: Record<string, string> = {
          order: r.orderNumber,
          client: `${r.recipientName} · ${formatSlipPhone(r.phone)}`,
          wilaya: r.wilaya ?? '—',
          courier: r.courier,
          tracking: r.trackingNumber ?? '—',
          cod: formatSlipAmount(r.codAmount),
        };
        for (const c of cols) drawBidiLine(doc, clip(doc, cells[c.key] ?? '', c.w - 6, 8), c.x + 3, y + 4, c.w - 6, { size: 8, align: align(c) });
        doc.save().lineWidth(0.3).strokeColor('#bbbbbb').moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + width, y + ROW_H).stroke().restore();
        y += ROW_H;
      }
      y += 6;
      const total = rows.reduce((s, r) => s + r.codAmount, 0);
      drawBidiLine(doc, `${T.parcels} : ${rows.length}`, MARGIN, y, width, { size: 10, bold: true, align: rtl ? 'right' : 'left' });
      drawBidiLine(doc, `${T.total} : ${formatSlipAmount(total)}`, MARGIN, y, width, { size: 10, bold: true, align: rtl ? 'left' : 'right' });
      doc.end();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
