// M7 — GDS operations pieces, one story per state: source badge (AUTO 🔒 / MANUEL), job banner (running / done /
// failed / rate-limited), recommendation card (default / applied / simple mode / no actions), detail rows, totals,
// inventory variance (equal / under / over / flagged / not counted), signed cash amounts and the M7 status pills.
import type { Meta, StoryObj } from '@storybook/react';
import { Button, DetailRows, JobBanner, KpiTile, Pill, RecommendationCard, SignedAmount, SourceBadge, StatusPill, TotalsBlock, VarianceValue } from './index';

const meta: Meta = { title: 'M7/GDS' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

export const SourceBadges: Story = {
  render: () => (
    <Frame>
      <div className="flex gap-3">
        <SourceBadge automatic autoLabel="AUTO" manualLabel="MANUEL" reason="Ligne générée par une vente / commande : ouvrez la référence (CAISSE_EDIT_AUTOMATIC)" />
        <SourceBadge automatic={false} autoLabel="AUTO" manualLabel="MANUEL" />
      </div>
    </Frame>
  ),
};

export const JobBanners: Story = {
  render: () => (
    <Frame>
      <JobBanner state="running" pill="EN COURS · 64 %" progress={64}>
        Génération en cours · 91 produits analysés sur 142… Les cartes ci-dessous datent de la nuit dernière (05 oct. 03:00).
      </JobBanner>
      <JobBanner state="done" pill="TERMINÉ">
        18 recommandations générées · 3 paires obsolètes retirées.
      </JobBanner>
      <JobBanner state="failed" pill="ÉCHEC" action={<Button size="sm">Réessayer</Button>}>
        La génération a échoué (INTERNAL). Les cartes de la nuit dernière restent affichées.
      </JobBanner>
      <JobBanner state="limited" pill="LIMITE">
        Régénérer : 1 fois / 10 min (RECO_RATE_LIMITED). Réessayez dans 7 min.
      </JobBanner>
    </Frame>
  ),
};

const pills = (
  <>
    <StatusPill enumKey="Recommendation.type" value="restock" className="!rounded-[4px]">
      RÉAPPROVISIONNER
    </StatusPill>
    <StatusPill enumKey="Recommendation.priority" value="high" className="!rounded-[4px]">
      HAUTE
    </StatusPill>
  </>
);

export const RecommendationCards: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 md:grid-cols-3">
        <RecommendationCard
          pills={pills}
          menu={<Button size="sm" variant="ghost">⋯</Button>}
          title="Parfum Oud 100 ml"
          onTitle={() => undefined}
          body="Stock 12 · ventes 64 / 30 j → rupture dans ~5 jours. Délai fournisseur moyen 6 j (Belkacem Import)."
          suggestion="Commander 60 u (couvre 30 j)"
          actions={
            <>
              <Button size="sm" variant="primary">
                + Créer l’achat
              </Button>
              <Button size="sm" variant="ghost">
                Ignorer
              </Button>
              <Button size="sm" variant="ghost">
                Rappeler dans 7 j
              </Button>
            </>
          }
          rule="RÈGLE : STOCK / VITESSE < DÉLAI FOURNISSEUR"
        />
        <RecommendationCard pills={pills} title="Montre Classic" body="Aucune vente depuis 74 jours · 9 u en stock (54 000 DA immobilisés)." suggestion="Remise 15 % + mention dans le prompt agent" applied="APPLIQUÉE · promo créée ↗" rule="RÈGLE : 0 VENTE > 60 J ET STOCK > 5" />
        <RecommendationCard pills={<Pill className="!rounded-[4px]">AGENT IA</Pill>} title="Vendeur Pro" body="12 conversations ont demandé « Parfum Musc » (introuvable) cette semaine." />
      </div>
    </Frame>
  ),
};

export const DetailAndTotals: Story = {
  render: () => (
    <Frame>
      <DetailRows
        rows={[
          { key: 'supplier', label: 'FOURNISSEUR', value: 'Belkacem Import ↗ · F-2026-118' },
          { key: 'items', label: 'ARTICLES', value: '2 lignes · 36 u · reçu 100 % le 04 oct.' },
          { key: 'amounts', label: 'MONTANTS', value: 'total 48 000 · payé 12 000 (CCP) · reste 36 000' },
        ]}
      />
      <TotalsBlock
        className="max-w-sm"
        rows={[
          { key: 'subtotal', label: 'Sous-total', value: '18 300 DA' },
          { key: 'discount', label: 'Remise (−5 % fidélité)', value: '−915 DA' },
          { key: 'total', label: 'Total', value: '17 385 DA', strong: true },
          { key: 'remaining', label: 'Reste dû', value: '7 385 DA', tone: 'warning' },
        ]}
      />
    </Frame>
  ),
};

export const Variances: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-col gap-2">
        <VarianceValue expected={21} counted={18} />
        <VarianceValue expected={12} counted={13} />
        <VarianceValue expected={6} counted={6} />
        <VarianceValue expected={3} counted={1} pct={66.7} flagged />
        <VarianceValue expected={3} counted={null} />
      </div>
      <div className="flex gap-4">
        <SignedAmount value={4500} formatted="4 500" />
        <SignedAmount value={-1550} formatted="1 550" />
        <SignedAmount value={0} formatted="0" />
      </div>
    </Frame>
  ),
};

export const Tiles: Story = {
  render: () => (
    <Frame>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile value="84 350" label="DA solde actuel" meta="ouverture 05 oct. : 52 000 DA" />
        <KpiTile value="+41 900" label="DA encaissé aujourd’hui" meta="7 ventes · 3 COD" />
        <KpiTile value="−9 550" label="DA décaissé" meta="1 achat · 2 frais" />
        <KpiTile value="3" label="jours non clôturés" meta="02, 03, 04 oct. → à clôturer" tone="warning" />
      </div>
    </Frame>
  ),
};

export const Pills: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-2">
        {(['draft', 'pending', 'partial', 'received', 'cancelled'] as const).map((v) => (
          <StatusPill key={v} enumKey="Purchase.status" value={v} className="!rounded-[4px]">
            {{ draft: 'BROUILLON', pending: 'COMMANDÉ', partial: 'PARTIEL 8/12', received: 'REÇU', cancelled: 'ANNULÉ' }[v]}
          </StatusPill>
        ))}
        {(['unpaid', 'partial', 'paid'] as const).map((v) => (
          <StatusPill key={v} enumKey="Gds.paymentStatus" value={v} className="!rounded-[4px]">
            {{ unpaid: 'NON PAYÉE', partial: 'PARTIELLE', paid: 'PAYÉE' }[v]}
          </StatusPill>
        ))}
        {(['sale', 'order', 'purchase', 'shipping', 'deposit', 'withdrawal', 'correction', 'refund'] as const).map((v) => (
          <StatusPill key={v} enumKey="Cash.category" value={v} className="!rounded-[4px]">
            {v.toUpperCase()}
          </StatusPill>
        ))}
        {(['draft', 'counting', 'validated', 'cancelled'] as const).map((v) => (
          <StatusPill key={v} enumKey="Inventory.status" value={v} className="!rounded-[4px]">
            {v.toUpperCase()}
          </StatusPill>
        ))}
      </div>
    </Frame>
  ),
};
