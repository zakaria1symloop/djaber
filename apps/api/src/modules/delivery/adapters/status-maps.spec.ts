// AT-DLV-04 — status mapping tables (ZR Express, EcoTrack, Yalidine, 05-integrations §2.2–§2.4): every known raw
// status → its mapped status (+ failure reason); case / accents / spacing ignored; unknown ⇒ null (event stored, status unchanged).
import { ECOTRACK_STATUSES, mapCourierStatus, normalizeRaw, STATUS_TABLES, YALIDINE_STATUSES, ZREXPRESS_STATUSES } from './status-maps';

describe('AT-DLV-04 courier status mapping tables', () => {
  for (const [provider, rows] of Object.entries(STATUS_TABLES) as [keyof typeof STATUS_TABLES, typeof ZREXPRESS_STATUSES][]) {
    it(`${provider}: every row of the table maps to its status`, () => {
      for (const [raw, mapped, reason] of rows) {
        expect([raw, mapCourierStatus(provider, raw)]).toEqual([raw, { mapped, failureReason: reason ?? null }]);
        // the same text in capitals, without accents, with extra spaces
        const shouted = `  ${raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()} `;
        expect(mapCourierStatus(provider, shouted)?.mapped).toBe(mapped);
      }
    });
  }

  it('unknown or empty raw ⇒ null; the manual provider has no table', () => {
    expect(mapCourierStatus('zrexpress', 'Statut inconnu XYZ')).toBeNull();
    expect(mapCourierStatus('ecotrack', '')).toBeNull();
    expect(mapCourierStatus('yalidine', null)).toBeNull();
    expect(mapCourierStatus('manual', 'Livré')).toBeNull();
  });

  it('longest entry wins when a raw text contains several entries', () => {
    expect(mapCourierStatus('yalidine', 'Pas encore expédié')?.mapped).toBe('sent'); // not "Expédié"
    expect(mapCourierStatus('yalidine', 'Retour vers centre')?.mapped).toBe('returned'); // not "Centre"
    expect(mapCourierStatus('zrexpress', 'Retour livré au vendeur')?.mapped).toBe('returned'); // not "Livré"
    expect(mapCourierStatus('ecotrack', 'Retourné au vendeur')?.mapped).toBe('returned');
    expect(mapCourierStatus('zrexpress', 'Colis Livrée au client')?.mapped).toBe('delivered');
    expect(mapCourierStatus('zrexpress', 'Arrivé au Centre de tri Oran')?.mapped).toBe('in_transit');
  });

  it('failure reasons per provider', () => {
    expect(mapCourierStatus('zrexpress', 'Adresse erronée')).toEqual({ mapped: 'failed', failureReason: 'address' });
    expect(mapCourierStatus('zrexpress', 'Client refuse le colis')).toEqual({ mapped: 'failed', failureReason: 'refused' });
    expect(mapCourierStatus('ecotrack', 'Endommagé')).toEqual({ mapped: 'failed', failureReason: 'damaged' });
    expect(mapCourierStatus('yalidine', 'Echèc livraison')).toEqual({ mapped: 'failed', failureReason: 'other' });
    expect(mapCourierStatus('yalidine', 'Tentative échouée')).toEqual({ mapped: 'failed', failureReason: 'unreachable' });
  });

  it('tables cover every ShipmentStatus a courier can report', () => {
    const statuses = (rows: readonly (readonly [string, string, string?])[]) => new Set(rows.map((r) => r[1]));
    for (const rows of [ZREXPRESS_STATUSES, ECOTRACK_STATUSES, YALIDINE_STATUSES]) {
      expect([...statuses(rows)].sort()).toEqual(['cancelled', 'delivered', 'failed', 'in_transit', 'out_for_delivery', 'picked_up', 'returned', 'sent']);
    }
    expect(normalizeRaw(' Échec  de LIVRAISON ')).toBe('echec de livraison');
  });
});
