// M5 — order pieces: Figma "ORD-05 v2 — Orders — list" (KPI strip, source tags, pills), "ORD-06 — Order page — new"
// (blocks, label/value rows, totals, timeline), "ORD-07 — Confirm order dialog" (step chips, checks note, phone input)
// and "DLV-06 / ORD-09 … order print preview A5" (A5 slip).
import type { Meta, StoryObj } from '@storybook/react';
import { A5OrderSlip, Button, ChecksNote, DetailRows, KpiTile, OrderBlock, OrderNumber, OrderTimeline, PhoneInput, SourceTag, StatusPill, StepChips, TotalsRows } from './index';

const meta: Meta = { title: 'M5/Orders' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

export const KpiStrip: Story = {
  render: () => (
    <Frame>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile value="31" label="à confirmer" meta="8 sans appel depuis > 2 h" tone="warning" />
        <KpiTile value="12" label="à expédier" meta="confirmées non envoyées" />
        <KpiTile value="27" label="en transit" meta="3 sans mouvement > 5 j" tone="warning" />
        <KpiTile value="68 %" label="livrées · 30 j" meta="12 retours" />
        <KpiTile value="412 300" label="DA · 30 j" meta="IA 76 % · manuel 24 %" />
      </div>
    </Frame>
  ),
};

export const SourcesAndPills: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap items-start gap-6">
        <SourceTag source="ai" label="✦ IA" detail="Vendeur Pro · FB" />
        <SourceTag source="manual" label="✎ MANUEL" detail="Nadia F." />
        <SourceTag source="mobile" label="▣ MOBILE" detail="Zakaria A." />
        <SourceTag source="api" label="{ } API" detail="ERP interne" />
        <SourceTag source="import" label="⤒ IMPORT" detail="CSV · 04 oct." />
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['Order.confirmationStatus', 'pending', 'À APPELER'],
            ['Order.confirmationStatus', 'no_answer', 'SANS RÉPONSE 2/3'],
            ['Order.confirmationStatus', 'callback', 'RAPPEL 16:00'],
            ['Order.confirmationStatus', 'wrong_number', 'FAUX NUMÉRO'],
            ['Order.confirmationStatus', 'confirmed', 'CONFIRMÉE'],
            ['Order.deliveryStatus', 'not_sent', 'NON ENVOYÉE'],
            ['Order.deliveryStatus', 'pending', 'À ENVOYER'],
            ['Shipment.status', 'in_transit', 'EN TRANSIT · ZR'],
            ['Shipment.status', 'delivered', 'LIVRÉE ✓'],
            ['Order.paymentStatus', 'unpaid', 'NON PAYÉE'],
            ['Order.paymentStatus', 'paid', 'PAYÉE'],
            ['Order.callResult', 'no_answer', 'SANS RÉPONSE'],
          ] as const
        ).map(([k, v, label]) => (
          <StatusPill key={`${k}${v}`} enumKey={k} value={v} className="!rounded-[4px]">
            {label}
          </StatusPill>
        ))}
      </div>
      <OrderNumber number="CMD-1042" className="ts-display-s" />
    </Frame>
  ),
};

export const PageBlocks: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-5 md:grid-cols-2">
        <OrderBlock label="LIVRAISON" end={<StatusPill enumKey="Order.deliveryStatus" value="not_sent" className="!rounded-[4px]">NON ENVOYÉE</StatusPill>} bodyClassName="flex flex-col gap-3 p-4">
          <DetailRows
            rows={[
              { key: 'c', label: 'TRANSPORTEUR', value: 'Aucun colis créé' },
              { key: 'f', label: 'FRAIS CLIENT', value: '0 DA (livraison offerte ≥ 5 000)' },
              { key: 'k', label: 'COÛT ZR EXPRESS', value: '450 DA · marge 6 850 DA' },
            ]}
          />
          <Button className="w-full" disabled>
            Envoyer au transporteur
          </Button>
          <p className="ts-label-micro !normal-case text-text-muted">Disponible une fois la commande confirmée.</p>
        </OrderBlock>
        <OrderBlock label="PAIEMENT" end={<StatusPill enumKey="Order.paymentStatus" value="unpaid" className="!rounded-[4px]">NON PAYÉE</StatusPill>} bodyClassName="flex flex-col gap-3 p-4">
          <DetailRows
            rows={[
              { key: 'm', label: 'MODE', value: 'Espèces à la livraison (COD)' },
              { key: 'p', label: 'MONTANT PAYÉ', value: '0 DA' },
              { key: 'r', label: 'RESTE', value: '7 300 DA', tone: 'warning' },
            ]}
          />
        </OrderBlock>
      </div>
      <OrderBlock label="ARTICLES" bodyClassName="p-4">
        <TotalsRows
          rows={[
            { key: 's', label: 'SOUS-TOTAL', value: '7 300 DA' },
            { key: 'd', label: 'LIVRAISON · SÉTIF · DOMICILE (GRILLE)', value: '0 DA' },
            { key: 'r', label: 'REMISE', value: '− 0 DA' },
            { key: 't', label: 'TOTAL', value: '7 300 DA', strong: true },
            { key: 'p', label: 'PAYÉ · RESTE', value: '0 DA · 7 300 DA' },
          ]}
        />
      </OrderBlock>
      <OrderBlock label="HISTORIQUE">
        <OrderTimeline
          label="Historique"
          items={[
            { key: '1', time: '14:02', title: 'Sara K.', text: 'Appel : sans réponse (2/2)', tone: 'info' },
            { key: '2', time: '11:05', title: 'Système', text: 'Notification « nouvelle commande IA » envoyée', tone: 'neutral' },
            { key: '3', time: '10:58', title: 'Vendeur Pro (IA)', text: 'Commande créée depuis la conversation · stock réservé', tone: 'success' },
          ]}
        />
      </OrderBlock>
      <OrderBlock label="APPELS · 0">
        <OrderTimeline label="Appels" items={[]} empty="Aucun appel pour l'instant" />
      </OrderBlock>
    </Frame>
  ),
};

export const ConfirmPieces: Story = {
  render: () => (
    <Frame>
      <StepChips
        label="Étapes"
        steps={[
          { key: 'review', label: 'VÉRIFIER', state: 'done' },
          { key: 'call', label: 'APPEL', state: 'active' },
          { key: 'result', label: 'RÉSULTAT', state: 'upcoming' },
        ]}
      />
      <ChecksNote
        items={[
          { label: 'Adresse complète', ok: true },
          { label: 'Wilaya', ok: true },
          { label: 'Téléphone', ok: true },
        ]}
        text="la commande peut être confirmée. Le stock est déjà réservé."
      />
      <ChecksNote
        tone="danger"
        items={[
          { label: 'Adresse complète', ok: false },
          { label: 'Wilaya', ok: true },
          { label: 'Téléphone', ok: true },
        ]}
        text="complétez l'adresse avant de confirmer."
      />
      <div className="grid max-w-md gap-3">
        <PhoneInput defaultValue="+213 555 12 34 56" preview={{ text: 'Normalisé : 0555123456 · mobile DZ valide' }} aria-label="Téléphone" />
        <PhoneInput defaultValue="0555 12" preview={{ text: 'Numéro invalide · format attendu 0555 12 34 56', tone: 'danger' }} aria-label="Téléphone" aria-invalid />
      </div>
    </Frame>
  ),
};

export const A5Slip: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-6 bg-ink-raised p-6">
        <A5OrderSlip
          className="w-[420px]"
          shop="Boutique Amel"
          heading="Bon de commande #CMD-1037 · 02 oct. 2026"
          client="Client : Lina Saidi · 0790 00 11 22"
          address="Annaba · El Bouni · Cité 500 lgts · domicile"
          lines={[{ key: '1', label: 'Montre Classic ×1', amount: '6 000 DA' }]}
          extra={[{ key: 'd', label: 'Livraison', amount: '600 DA' }]}
          total={{ label: 'TOTAL À PAYER', amount: '6 600 DA' }}
          footer={['Paiement à la livraison', 'Merci ! Suivi : djaber.ai/s/8f2a']}
        />
        <A5OrderSlip
          className="w-[420px]"
          dir="rtl"
          lang="ar"
          shop="Boutique Amel"
          heading="وصل الطلب #CMD-1037 · 02 أكتوبر 2026"
          client="الزبون: لينا سعيدي · 0790 00 11 22"
          address="عنابة · البوني · حي 500 مسكن · المنزل"
          lines={[{ key: '1', label: 'ساعة كلاسيك ×1' }]}
          footer={['الدفع عند الاستلام', 'شكرًا!']}
        />
      </div>
    </Frame>
  ),
};
