// DLV-06 Djaber label + product label sheet renderers (pure pdfkit): page sizes, one page per label, Arabic text and
// the QR code of the public tracking page render without error.
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { LABEL_SIZES, renderDjaberLabels, type DjaberLabelData } from './djaber-label.pdf';
import { renderProductLabels } from './product-labels.pdf';

const MM = 72 / 25.4;
const label = (over: Partial<DjaberLabelData> = {}): DjaberLabelData => ({
  shopName: 'Boutique Yasmine',
  shopPhone: '0555123456',
  senderAddress: 'Rue Didouche Mourad',
  senderWilaya: '16 · Alger',
  orderNumber: 'CMD-1042',
  courier: 'ZR Express',
  trackingNumber: 'ZR-16-778899',
  recipientName: 'أمين بن علي',
  phone: '0661223344',
  phone2: '0770112233',
  wilaya: '31 · Oran',
  commune: 'Bir El Djir',
  address: 'حي 200 مسكن عمارة 4 الطابق الثاني',
  isStopdesk: false,
  stopdeskName: null,
  codAmount: 12500,
  itemsSummary: 'Robe kabyle M ×1, قفطان ×2',
  trackingUrl: 'http://localhost:3010/s/abcDEF123456',
  ...over,
});

describe('Djaber label (DLV-06, 05-integrations §8 label-djaber)', () => {
  it('A6, thermal 100 × 150 and A5, one page per label (fr / ar)', async () => {
    for (const [format, [w, h]] of Object.entries(LABEL_SIZES) as [keyof typeof LABEL_SIZES, [number, number]][]) {
      for (const lang of ['fr', 'ar'] as const) {
        const pdf = await renderDjaberLabels([label(), label({ isStopdesk: true, stopdeskName: 'Agence Bir El Djir', address: null, trackingNumber: null })], format, lang);
        const doc = await PDFDocument.load(pdf);
        expect(doc.getPageCount()).toBe(2);
        expect(Math.round(doc.getPage(0).getWidth())).toBe(Math.round(w));
        expect(Math.round(doc.getPage(0).getHeight())).toBe(Math.round(h));
      }
    }
    expect(Math.round(LABEL_SIZES.thermal[0] / MM)).toBe(100);
    expect(Math.round(LABEL_SIZES.a6[1] / MM)).toBe(148);
  });

  it('the QR code encodes the public tracking URL', () => {
    const qr = QRCode.create(label().trackingUrl, { errorCorrectionLevel: 'M' });
    expect(qr.modules.size).toBeGreaterThan(20);
  });
});

describe('product label sheet (M2 carry-over)', () => {
  it('3 × 8 labels per A4 page', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ name: i % 2 ? 'قفطان تقليدي' : `Robe ${i}`, variant: i % 3 ? 'M' : null, sku: `SKU-${i}`, price: 4500 + i }));
    const doc = await PDFDocument.load(await renderProductLabels(items));
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth() / MM)).toBe(210);
  });
});
