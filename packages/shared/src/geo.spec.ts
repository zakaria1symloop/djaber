import { describe, expect, it } from 'vitest';
import { ALL_WILAYA_IDS, COURIER_WILAYA_COUNT, courierWilayaId, isWilayaId, WILAYA_COUNT, WILAYA_PARENT, wilayasOfCourierCode } from './geo';
import { FeeQuoteQuerySchema } from './schemas/delivery';
import { wilayaCode } from './validators';

describe('wilayas (loi 26-06: 69 wilayas)', () => {
  it('69 ids, the 11 new ones (59–69) each carved out of one of the 58 historical wilayas', () => {
    expect(WILAYA_COUNT).toBe(69);
    expect(ALL_WILAYA_IDS).toHaveLength(69);
    expect(Object.keys(WILAYA_PARENT).map(Number)).toEqual([59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
    for (const p of Object.values(WILAYA_PARENT)) expect(p).toBeLessThanOrEqual(COURIER_WILAYA_COUNT);
  });
  it('isWilayaId: 1…69 integers only', () => {
    expect([1, 16, 58, 59, 69].every(isWilayaId)).toBe(true);
    expect([0, 70, 16.5, '16', null].some(isWilayaId)).toBe(false);
  });
  it('couriers get the parent code for a new wilaya, the id itself otherwise', () => {
    expect(courierWilayaId(16)).toBe(16);
    expect(courierWilayaId(58)).toBe(58);
    expect(courierWilayaId(59)).toBe(3);
    expect(courierWilayaId(65)).toBe(17);
    expect(courierWilayaId(66)).toBe(17);
    expect(courierWilayaId(68)).toBe(28);
    expect(courierWilayaId(69)).toBe(32);
  });
  it('a courier code covers itself and the wilayas carved out of it', () => {
    expect(wilayasOfCourierCode(17)).toEqual([17, 65, 66]);
    expect(wilayasOfCourierCode(16)).toEqual([16]);
    expect(ALL_WILAYA_IDS.filter((w) => w <= COURIER_WILAYA_COUNT).flatMap(wilayasOfCourierCode).sort((a, b) => a - b)).toEqual([...ALL_WILAYA_IDS]);
  });
  it('the zod validators accept the new wilayas', () => {
    expect(FeeQuoteQuerySchema.safeParse({ wilayaId: '68' }).success).toBe(true);
    expect(FeeQuoteQuerySchema.safeParse({ wilayaId: '70' }).success).toBe(false);
    expect(wilayaCode.safeParse(69).success).toBe(true);
    expect(wilayaCode.safeParse(70).success).toBe(false);
  });
});
