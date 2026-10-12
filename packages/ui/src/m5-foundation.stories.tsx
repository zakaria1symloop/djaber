// M5 — shared form pieces: phone input with the normalisation preview (Figma "ORD-02 — New order — form", CLI dialog
// "Nouveau client") and the new enum pills of "REF — Component sheet" (confirmation, payment, source, shipment).
import type { Meta, StoryObj } from '@storybook/react';
import { Card, Field, PhoneInput, StatusPill } from './index';

const meta: Meta = { title: 'M5/Foundation' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">{children}</div>;

export const Phone: Story = {
  render: () => (
    <Frame>
      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="TÉLÉPHONE" required>
          <PhoneInput defaultValue="" placeholder="0555 12 34 56" />
        </Field>
        <Field label="TÉLÉPHONE" required>
          <PhoneInput defaultValue="+213 555 12 34 56" preview={{ text: 'Normalisé : 0555123456 · mobile DZ valide' }} />
        </Field>
        <Field label="TÉLÉPHONE" required>
          <PhoneInput defaultValue="0555 12" aria-invalid preview={{ text: 'Numéro invalide · format attendu 0555 12 34 56', tone: 'danger' }} />
        </Field>
        <Field label="TÉLÉPHONE 2 (FACULTATIF)">
          <PhoneInput defaultValue="021 23 45 67" preview={{ text: 'Normalisé : 021234567 · fixe DZ valide' }} />
        </Field>
      </Card>
    </Frame>
  ),
};

const row = (enumKey: Parameters<typeof StatusPill>[0]['enumKey'], items: [string, string][]) => (
  <div className="flex flex-wrap gap-2">
    {items.map(([value, label]) => (
      <StatusPill key={value} enumKey={enumKey} value={value}>
        {label}
      </StatusPill>
    ))}
  </div>
);

export const OrderPills: Story = {
  render: () => (
    <Frame>
      <Card className="flex flex-col gap-3 p-4">
        {row('Order.status', [['new', 'NOUVELLE'], ['confirmed', 'CONFIRMÉE'], ['preparing', 'EN PRÉPARATION'], ['shipped', 'EXPÉDIÉE'], ['delivered', 'LIVRÉE'], ['returned', 'RETOURNÉE'], ['cancelled', 'ANNULÉE']])}
        {row('Order.confirmationStatus', [['pending', 'À APPELER'], ['no_answer', 'SANS RÉPONSE 1/3'], ['callback', 'RAPPEL 16:00'], ['confirmed', 'CONFIRMÉE'], ['rejected', 'REFUS'], ['wrong_number', 'FAUX NUMÉRO']])}
        {row('Order.paymentStatus', [['unpaid', 'NON PAYÉE'], ['partial', 'PARTIELLE'], ['paid', 'PAYÉE'], ['pending_link', 'LIEN EN ATTENTE'], ['refunded', 'REMBOURSÉE']])}
        {row('Order.source', [['ai', '✦ IA'], ['manual', '✎ MANUEL'], ['mobile', '▣ MOBILE'], ['api', '{ } API'], ['import', '⤒ IMPORT']])}
        {row('Shipment.status', [['pending', 'À ENVOYER'], ['sent', 'CRÉÉE'], ['picked_up', 'RAMASSÉE'], ['in_transit', 'EN TRANSIT'], ['delivered', 'LIVRÉE ✓'], ['failed', 'ÉCHEC'], ['returned', 'RETOURNÉE'], ['stale', 'SANS MOUVEMENT']])}
        {row('Client.riskLevel', [['normal', 'FIABLE'], ['high', 'RISQUE']])}
        {row('FeeRule.source', [['default', 'DÉFAUT'], ['custom', 'PERSONNALISÉ']])}
      </Card>
    </Frame>
  ),
};
