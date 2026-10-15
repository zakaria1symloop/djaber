// Loi 26-06 (69 wilayas): default fees, courier codes and rates, customer spellings of the 11 new wilayas.
import { courierWilayaId, WILAYA_COUNT, WILAYA_PARENT } from '@djaber/shared';
import { DEFAULT_FEES, defaultFeeFor, NEW_WILAYA_PARENT } from '@djaber/db';
import { fold, WILAYA_ALIASES } from '../ai/tools/wilaya-aliases';
import { expandCourierRates } from './rates.service';

describe('loi 26-06: 69 wilayas', () => {
  it('the db defaults use the same parent map as @djaber/shared; each new wilaya starts with its parent default fee', () => {
    expect(NEW_WILAYA_PARENT).toEqual(WILAYA_PARENT);
    for (let w = 1; w <= WILAYA_COUNT; w++) expect(DEFAULT_FEES[w]).toBeDefined();
    expect(defaultFeeFor(68)).toEqual(defaultFeeFor(28));
    expect(defaultFeeFor(65)).toEqual(defaultFeeFor(17));
    expect(defaultFeeFor(69)).toEqual({ home: 900, stopdesk: 600, return: 400 });
  });

  it('courier rates: a new wilaya the courier does not list takes the rate of its parent; a listed one keeps its own', () => {
    const fromCourier = Array.from({ length: 58 }, (_, i) => ({ wilayaId: i + 1, home: 400 + i, stopdesk: 300 + i }));
    const all = expandCourierRates(fromCourier);
    expect(all).toHaveLength(69);
    const of = (w: number) => all.find((r) => r.wilayaId === w);
    expect(of(66)).toEqual({ wilayaId: 66, home: of(17)!.home, stopdesk: of(17)!.stopdesk });
    expect(of(59)).toEqual({ wilayaId: 59, home: of(3)!.home, stopdesk: of(3)!.stopdesk });
    expect(expandCourierRates([...fromCourier, { wilayaId: 68, home: 999, stopdesk: null }]).find((r) => r.wilayaId === 68)).toEqual({ wilayaId: 68, home: 999, stopdesk: null });
    // a parent the courier does not price ⇒ no rate for its children either
    expect(expandCourierRates([{ wilayaId: 16, home: 400, stopdesk: 250 }])).toEqual([{ wilayaId: 16, home: 400, stopdesk: 250 }]);
  });

  it('parcels are addressed to the courier under the parent code', () => {
    expect([16, 58, 59, 62, 67, 69].map(courierWilayaId)).toEqual([16, 58, 3, 12, 26, 32]);
  });

  it('what customers type for the new wilayas (latin, arabizi, Arabic)', () => {
    const id = (s: string) => WILAYA_ALIASES[fold(s)];
    expect(['Aflou', 'Brika', 'guentra', 'Bir El Ater', 'laricha', 'ksar chlala', 'ain wessara', 'mes3ad', 'Ksar Boukhari', 'Boussaada', 'bou sa3da', 'Labiod Sidi Cheikh'].map(id)).toEqual([59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 68, 69]);
    expect(['آفلو', 'بريكة', 'القنطرة', 'بئر العاتر', 'العريشة', 'قصر الشلالة', 'عين وسارة', 'مسعد', 'قصر البخاري', 'بوسعادة', 'الأبيض سيدي الشيخ'].map(id)).toEqual([59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
  });
});
