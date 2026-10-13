// M11 carry-overs (fork B): crop geometry of the logo / avatar / category image step and the products supplier chip.
import { cropGeometry, cropRect } from '@djaber/ui';
import { describe, expect, it } from 'vitest';
import { activeChips, PRODUCTS_LIST, type ChipLabels } from '@/features/catalog/products-list/spec';
import { parseListState } from '@/lib/list-state';
import { croppedName, croppedType } from './crop-dialog';

describe('crop step (Figma "Logo de l\'espace & avatar": RECADRER)', () => {
  it('covers the frame with the short side at zoom 1 and keeps the centre square', () => {
    // 600 × 400 picture in a 240 px frame: scale 0.6, the kept square is the centred 400 × 400
    expect(cropRect({ w: 600, h: 400 }, 240, { zoom: 1, x: 0, y: 0 })).toEqual({ sx: 100, sy: 0, size: 400 });
  });
  it('zoom 2 keeps a square half as large around the centre', () => {
    const r = cropRect({ w: 400, h: 400 }, 200, { zoom: 2, x: 0, y: 0 });
    expect(r).toEqual({ sx: 100, sy: 100, size: 200 });
  });
  it('the picture can never be dragged off the frame (offset clamped)', () => {
    const g = cropGeometry({ w: 600, h: 400 }, 240, { zoom: 1, x: 10_000, y: -10_000 });
    expect(g.x).toBe(60); // (600 × 0.6 − 240) / 2
    expect(g.y).toBe(0); // the short side already fits exactly
    expect(cropRect({ w: 600, h: 400 }, 240, { zoom: 1, x: 10_000, y: 0 }).sx).toBeCloseTo(0);
  });
  it('JPEG stays JPEG, the other types become PNG (logo transparency)', () => {
    expect(croppedType('image/jpeg')).toBe('image/jpeg');
    expect(croppedType('image/webp')).toBe('image/png');
    expect(croppedName('photo.de.moi.jpeg', 'image/jpeg')).toBe('photo.de.moi.jpg');
    expect(croppedName('logo.webp', 'image/png')).toBe('logo.png');
  });
});

describe('products list — supplier filter from the supplier sheet (M7 carry-over)', () => {
  const labels = { search: (q: string) => q, supplier: (n: string) => `Fournisseur : ${n}`, supplierName: (id: string) => (id === 's1' ? 'Atlas Import' : '…') } as unknown as ChipLabels;
  it('reads `supplierId` from the URL and shows a removable chip with the supplier name', () => {
    const s = parseListState(PRODUCTS_LIST, new URLSearchParams('supplierId=s1'));
    expect(s.filters.supplierId).toBe('s1');
    const chip = activeChips(s, labels).find((c) => c.key === 'supplierId');
    expect(chip).toEqual({ key: 'supplierId', label: 'Fournisseur : Atlas Import', clear: { supplierId: null } });
  });
});
