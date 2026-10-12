// M6 — delivery pieces: Figma "DLV-08 — Delivery — overview + tracking panel" (tiles, failure pills, timeline, the
// "Actualiser" states), "DLV-01/03 — … couriers settings" + DLG "Ajouter un transporteur" (courier cards, test states),
// "DLV-05 — send to courier dialog" (courier radios with cost + delay), "DLV-06 / ORD-09 — Labels viewer" (Djaber A6
// fallback label, merged job rows) and the public tracking page (parcel steps).
import type { Meta, StoryObj } from '@storybook/react';
import {
  A6Label,
  Button,
  CourierCard,
  CourierCostLine,
  CourierTestResult,
  FormAlert,
  KpiTile,
  LabelJobRow,
  ParcelSteps,
  RadioCards,
  SegmentedControl,
  StatusPill,
  TrackingSyncBar,
  TrackingTimeline,
  type SyncState,
} from './index';

const meta: Meta = { title: 'M6/Delivery' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

export const OverviewTiles: Story = {
  render: () => (
    <Frame>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile value="12" label="à envoyer" meta="confirmées sans expédition" />
        <KpiTile value="4" label="créées" meta="en attente de ramassage" />
        <KpiTile value="27" label="en transit" meta="3 sans mouvement > 5 j ⚠" tone="warning" />
        <KpiTile value="6" label="échecs" meta="à traiter aujourd'hui" tone="danger" />
        <KpiTile value="94" label="livrées · 30 j" meta="68 %" />
        <KpiTile value="12" label="retournées · 30 j" meta="9 %" />
      </div>
      <div className="flex flex-wrap gap-2">
        {(['unreachable', 'address', 'refused', 'damaged', 'other'] as const).map((r) => (
          <StatusPill key={r} enumKey="Shipment.failureReason" value={r} className="!rounded-[4px]">
            {{ unreachable: 'INJOIGNABLE', address: 'ADRESSE', refused: 'REFUSÉ', damaged: 'ENDOMMAGÉ', other: 'AUTRE' }[r]}
          </StatusPill>
        ))}
        {(['pending', 'sent', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled', 'stale'] as const).map((s) => (
          <StatusPill key={s} enumKey="Shipment.status" value={s} className="!rounded-[4px]">
            {s.toUpperCase()}
          </StatusPill>
        ))}
      </div>
    </Frame>
  ),
};

const steps = [
  { key: '1', title: 'Tentative de livraison échouée — client absent', meta: 'HIER 16:20 · ZR EXPRESS', tone: 'danger' as const },
  { key: '2', title: 'En cours de livraison · Annaba', meta: 'HIER 09:10 · ZR EXPRESS', tone: 'info' as const },
  { key: '3', title: 'Arrivé au hub Annaba', meta: '04 OCT. 18:00 · ZR EXPRESS' },
  { key: '4', title: 'Ramassé par le transporteur', meta: '03 OCT. 14:30 · ZR EXPRESS' },
  { key: '5', title: 'Expédition créée · bordereau imprimé', meta: '03 OCT. 10:02 · DJABER · NADIA F.' },
];

export const TrackingPanel: Story = {
  render: () => {
    const states: { state: SyncState; message?: string; reason?: string }[] = [
      { state: 'idle' },
      { state: 'syncing' },
      { state: 'fresh', message: 'À jour' },
      { state: 'limited', message: 'Actualisation possible dans 4 min (1 / 5 min).', reason: 'TRACKING_SYNC_RATE_LIMITED' },
      { state: 'not_found', message: 'Suivi introuvable chez le transporteur. (TRACKING_NOT_FOUND)' },
      { state: 'unavailable', message: 'Transporteur indisponible, envoi mis en attente. (COURIER_UNAVAILABLE)' },
    ];
    return (
      <Frame>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-card border border-line-edge bg-ink-surface p-4">
            <TrackingSyncBar lastSync="Dernière synchro il y a 12 min" state="idle" onRefresh={() => {}} refreshLabel="Actualiser" syncingLabel="Actualisation…" />
            <TrackingTimeline items={steps} label="Suivi" />
            <div className="flex flex-wrap gap-2">
              <Button>Relancer la livraison</Button>
              <Button>Appeler 0790 00 11 22</Button>
              <Button>Portail ZR ↗</Button>
              <Button>Bordereau</Button>
              <Button>Marquer retournée</Button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {states.map((s) => (
              <TrackingSyncBar key={s.state} lastSync="Dernière synchro il y a 2 min" state={s.state} onRefresh={() => {}} refreshLabel="Actualiser" syncingLabel="Actualisation…" message={s.message} disabledReason={s.reason} />
            ))}
            <TrackingTimeline items={[]} label="Suivi" empty="Aucun événement transporteur pour l'instant." />
          </div>
        </div>
      </Frame>
    );
  },
};

export const CourierCards: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 md:grid-cols-3">
        <CourierCard
          name="ZR Express"
          status={{ label: 'CONNECTÉ', tone: 'success' }}
          meta="PAR DÉFAUT · TOKEN + KEY · TESTÉ IL Y A 2 H"
          actions={
            <>
              <Button>Tester</Button>
              <Button>Modifier</Button>
              <Button variant="ghost">Désactiver</Button>
            </>
          }
        >
          <p>Expéditeur : Boutique Amel · 0550 11 22 33 · Sétif (19)</p>
          <p>Capacités : colis ✓ · suivi ✓ · tarifs ✓ · étiquette ✗ (étiquette Djaber utilisée)</p>
          <p>124 colis envoyés · 2 échecs ce mois</p>
        </CourierCard>
        <CourierCard name="EcoTrack · Maystro" status={{ label: 'INACTIF', tone: 'neutral' }} meta="INSTANCE URL + TOKEN · TESTÉ HIER" muted actions={<Button>Activer</Button>}>
          <p>Instance : https://maystro.ecotrack.dz</p>
        </CourierCard>
        <CourierCard name="Yalidine" status={{ label: 'NON CONFIGURÉ', tone: 'neutral' }} meta="ID + TOKEN" actions={<Button variant="primary">+ Ajouter Yalidine</Button>}>
          <p>Capacités : colis ✓ · suivi ✓ · étiquette ✓ · tarifs ✓ · stop-desk (stopdesk_id requis)</p>
        </CourierCard>
      </div>
      <div className="flex flex-col gap-2">
        <CourierTestResult state="testing" label="TEST : EN COURS…" detail="appel sandbox ≤ 10 s" />
        <CourierTestResult state="ok" label="OK · 420 MS" detail="compte « Boutique Amel » reconnu · 58 wilayas servies" />
        <CourierTestResult state="rejected" label="REFUSÉ" detail="COURIER_CREDENTIALS_INVALID · vérifiez token / clé" />
        <CourierTestResult state="unreachable" label="INJOIGNABLE" detail="COURIER_UNAVAILABLE · réessayez plus tard · enregistrement possible sans test" />
      </div>
      <SegmentedControl label="Transporteur" value="zrexpress" onChange={() => {}} options={[{ value: 'zrexpress', label: 'ZR Express' }, { value: 'ecotrack', label: 'EcoTrack' }, { value: 'yalidine', label: 'Yalidine' }, { value: 'manual', label: 'Livraison propre' }]} />
    </Frame>
  ),
};

export const SendDialogCourierChoice: Story = {
  render: () => (
    <Frame>
      <RadioCards
        label="Transporteur"
        columns={2}
        value="zr"
        onChange={() => {}}
        options={[
          { value: 'zr', label: 'ZR Express · PAR DÉFAUT', description: 'Coût transporteur 450 DA · 3,8 j' },
          { value: 'eco', label: 'EcoTrack · Maystro', description: 'Coût transporteur 520 DA · 4,9 j' },
        ]}
      />
      <CourierCostLine cost="450 DA" delay="3,8 j" />
      <FormAlert>Transporteur : « point stop-desk manquant pour la commune El Eulma ». Choisissez un point ci-dessus puis renvoyez. La commande reste confirmée, rien n&apos;a été créé chez le transporteur.</FormAlert>
    </Frame>
  ),
};

export const Labels: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <A6Label
          shop="Djaber.ai · Boutique Amel"
          reference="#CMD-1037"
          barcode="CMD-1037"
          barcodeLabel="Code-barres CMD-1037"
          mode="Livraison propre · domicile"
          recipient="Lina Saidi · 0790 00 11 22"
          address="23 Annaba · El Bouni · Cité 500 lgts"
          cod="À ENCAISSER : 6 000 DA"
          items="Montre Classic ×1 · 6 000"
          footer={['Retour : 0555 12 34 56']}
        />
        <div className="flex flex-col gap-3 rounded-card border border-line-edge bg-ink-surface p-4">
          <LabelJobRow state="running" label="EN COURS · 3 / 4" text="« vous pouvez continuer, le PDF s'ouvrira ici »" />
          <LabelJobRow state="ready" label="PRÊT" text="bordereaux-2026-10-05.pdf · 4 pages" actions={<><Button size="sm">Ouvrir</Button><Button size="sm" variant="ghost">Télécharger</Button></>} />
          <LabelJobRow state="partial" label="PARTIEL" text="3 / 4 · #CMD-1029 : LABEL_UNAVAILABLE → remplacé par le bordereau Djaber" />
          <LabelJobRow state="failed" label="ÉCHEC" text="REPORT_EXPORT_FAILED" actions={<Button size="sm">Réessayer</Button>} />
        </div>
      </div>
    </Frame>
  ),
};

export const PublicTrackingSteps: Story = {
  render: () => (
    <Frame>
      <ParcelSteps
        label="Étapes du colis"
        steps={[
          { key: 'sent', label: 'Créée', state: 'done' },
          { key: 'picked_up', label: 'Ramassée', state: 'done' },
          { key: 'in_transit', label: 'En transit', state: 'current' },
          { key: 'out_for_delivery', label: 'En livraison', state: 'upcoming' },
          { key: 'delivered', label: 'Livrée', state: 'upcoming' },
        ]}
      />
      <ParcelSteps
        label="Étapes du colis"
        steps={[
          { key: 'sent', label: 'Créée', state: 'done' },
          { key: 'picked_up', label: 'Ramassée', state: 'done' },
          { key: 'in_transit', label: 'En transit', state: 'done' },
          { key: 'out_for_delivery', label: 'En livraison', state: 'done' },
          { key: 'failed', label: 'Échec', state: 'failed' },
        ]}
      />
      <ParcelSteps
        label="Étapes du colis"
        steps={[
          { key: 'sent', label: 'Créée', state: 'done' },
          { key: 'picked_up', label: 'Ramassée', state: 'done' },
          { key: 'in_transit', label: 'En transit', state: 'done' },
          { key: 'out_for_delivery', label: 'En livraison', state: 'done' },
          { key: 'delivered', label: 'Livrée ✓', state: 'done' },
        ]}
      />
    </Frame>
  ),
};
