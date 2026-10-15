// Algerian wilayas: 69 since the 2025 reform (loi n° 26-06 du 4 avril 2026, JO n° 25): the wilayas 59–69 were carved
// out of existing ones. Couriers (ZR Express, EcoTrack, Yalidine) still address the 58 historical codes, so a new
// wilaya is sent to them as its parent wilaya (assumptions-log, fix/wilayas-69).

/** Number of wilayas (ids 1…69). */
export const WILAYA_COUNT = 69;
/** Highest wilaya code the courier APIs know (the 58 wilayas before the 2025 reform). */
export const COURIER_WILAYA_COUNT = 58;

/** New wilaya id → the wilaya it was carved out of. */
export const WILAYA_PARENT: Readonly<Record<number, number>> = Object.freeze({
  59: 3, // Aflou ← Laghouat
  60: 5, // Barika ← Batna
  61: 7, // El Kantara ← Biskra
  62: 12, // Bir El Ater ← Tébessa
  63: 13, // El Aricha ← Tlemcen
  64: 14, // Ksar Chellala ← Tiaret
  65: 17, // Aïn Oussera ← Djelfa
  66: 17, // Messaad ← Djelfa
  67: 26, // Ksar El Boukhari ← Médéa
  68: 28, // Bou Saâda ← M'sila
  69: 32, // El Abiodh Sidi Cheikh ← El Bayadh
});

export const isWilayaId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= WILAYA_COUNT;

/** The wilaya code a courier API expects: the parent for 59–69, the id itself otherwise. */
export const courierWilayaId = (wilayaId: number): number => WILAYA_PARENT[wilayaId] ?? wilayaId;

/** The wilayas a courier code covers: the code itself and the new wilayas carved out of it. */
export const wilayasOfCourierCode = (code: number): number[] => [code, ...Object.entries(WILAYA_PARENT).filter(([, p]) => p === code).map(([id]) => Number(id))];

/** `[1, 2, …, WILAYA_COUNT]`. */
export const ALL_WILAYA_IDS: readonly number[] = Object.freeze(Array.from({ length: WILAYA_COUNT }, (_, i) => i + 1));
