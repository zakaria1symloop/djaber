// M4 — credits pieces: Figma "BIL-04 / BIL-03 — Credits page (ledger)" (tiles), header pill of "ANA-01 — Home",
// "GLOBAL — Credits exhausted — thread state (Inbox)" (red pill).
import type { Meta, StoryObj } from '@storybook/react';
import { Card, CreditsMeter, CreditsPill, KpiTile, StatusPill } from './index';

const meta: Meta = { title: 'M4/Credits' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

export const Pill: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap items-center gap-3">
        <CreditsPill text="3 760 / 5 000" level="ok" title="Crédits utilisés ce mois" />
        <CreditsPill text="4 100 / 5 000" level="warning" title="80 % des crédits utilisés" />
        <CreditsPill text="5 000 / 5 000" level="exhausted" title="Crédits épuisés" />
      </div>
    </Frame>
  ),
};

export const Meter: Story = {
  render: () => (
    <Frame>
      <Card className="flex flex-col gap-5 p-4">
        <CreditsMeter used={3_460} limit={5_000} level="ok" label="PÉRIODE DU 12 SEPT. AU 12 OCT." valueLabel="3 460 / 5 000" />
        <CreditsMeter used={4_100} limit={5_000} level="warning" label="PÉRIODE DU 12 SEPT. AU 12 OCT." valueLabel="4 100 / 5 000" />
        <CreditsMeter used={5_000} limit={5_000} level="exhausted" label="PÉRIODE DU 12 SEPT. AU 12 OCT." valueLabel="5 000 / 5 000" />
      </Card>
    </Frame>
  ),
};

export const Tiles: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile value="1 540" label="restants (plan)" meta="sur 5 000 · renouvelés le 12 oct." />
        <KpiTile value="500" label="restants (packs)" meta="consommés après le plan" />
        <KpiTile value="3 460" label="utilisés ce mois" meta="≈ 115 / j → épuisés le 09 oct. ⚠" />
        <KpiTile value="0,98" label="DA / crédit (plan Pro)" meta="pack moyen : 0,75 DA" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile value="900" label="restants (plan)" meta="sur 5 000 · renouvelés le 12 oct." tone="warning" />
        <KpiTile value="0" label="restants (plan)" meta="sur 5 000 · renouvelés le 12 oct." tone="danger" />
      </div>
    </Frame>
  ),
};

export const LedgerActionPills: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['text_reply', 'TEXTE'],
            ['image_recognition', 'PHOTO'],
            ['voice_transcription', 'VOCAL'],
            ['grant', 'GESTE'],
            ['pack_purchase', 'PACK'],
            ['renewal', 'RENOUVELLEMENT'],
            ['store_refund', 'REMBOURSEMENT STORE'],
            ['adjustment', 'AJUSTEMENT'],
            ['reserve', 'RÉSERVATION'],
            ['release', 'LIBÉRATION'],
          ] as const
        ).map(([value, label]) => (
          <StatusPill key={value} enumKey="Credit.action" value={value} className="!rounded-[4px]">
            {label}
          </StatusPill>
        ))}
      </div>
    </Frame>
  ),
};
