// M5 — clients & fee grid pieces: Figma "CLI-03 — Clients — list with detail sheet" (metric tiles, tag chips),
// DLG "Fusionner les clients" (merge cards), DLG II "Tags" (tri-state chips), "DLV-01/03 — Delivery — fee grid"
// (price cells with their save states, free-delivery bar).
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import {
  Card,
  FeeCell,
  FreeDeliveryBar,
  MergeCard,
  MetricTile,
  RowSaveState,
  TagChips,
  TagToggle,
  type CellState,
  type TagToggleState,
} from './index';

const meta: Meta = { title: 'M5/Clients & fee grid' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">{children}</div>
);

export const Metrics: Story = {
  render: () => (
    <Frame>
      <div className="grid max-w-md grid-cols-3 gap-2">
        <MetricTile label="COMMANDES" value="3" />
        <MetricTile label="DA DÉPENSÉS" value="14 700" />
        <MetricTile label="RETOURS" value="0 %" />
      </div>
      <div className="grid max-w-md grid-cols-3 gap-2">
        <MetricTile label="COMMANDES" value="4" />
        <MetricTile label="DA DÉPENSÉS" value="12 100" />
        <MetricTile label="RETOURS" value="50 %" tone="warning" />
      </div>
    </Frame>
  ),
};

function TagsDemo() {
  const [states, setStates] = React.useState<Record<string, TagToggleState>>({
    fidèle: 'add',
    risque: 'remove',
  });
  return (
    <Frame>
      <TagChips tags={['fidèle', 'vip', 'grossiste', 'nouveau']} max={3} />
      <div className="flex flex-wrap gap-1.5">
        {['fidèle', 'vip', 'risque', 'grossiste'].map((tag) => (
          <TagToggle
            key={tag}
            tag={tag}
            state={states[tag] ?? 'unchanged'}
            onChange={(s) => setStates((m) => ({ ...m, [tag]: s }))}
            labels={{ unchanged: 'inchangé', add: 'ajouter', remove: 'retirer' }}
          />
        ))}
      </div>
    </Frame>
  );
}
export const Tags: Story = { render: () => <TagsDemo /> };

function MergeDemo() {
  const [kept, setKept] = React.useState('a');
  return (
    <Frame>
      <div className="flex gap-2">
        <MergeCard
          name="Amina Belkacem"
          meta="3 commandes · 2 conversations · fiable"
          badge={kept === 'a' ? 'CONSERVÉ' : 'FUSIONNÉ PUIS SUPPRIMÉ'}
          kept={kept === 'a'}
          onSelect={() => setKept('a')}
        />
        <MergeCard
          name="Amina B."
          meta="1 commande · 1 conversation · placeholder"
          badge={kept === 'b' ? 'CONSERVÉ' : 'FUSIONNÉ PUIS SUPPRIMÉ'}
          kept={kept === 'b'}
          onSelect={() => setKept('b')}
        />
      </div>
    </Frame>
  );
}
export const Merge: Story = { render: () => <MergeDemo /> };

export const FeeCells: Story = {
  render: () => {
    const states: CellState[] = ['idle', 'saving', 'saved', 'error'];
    return (
      <Frame>
        <Card className="flex flex-col gap-3 p-4">
          {states.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <span className="w-20 ts-label-micro text-text-muted">{s}</span>
              <FeeCell
                value={400}
                onCommit={() => undefined}
                label={`Domicile · Sétif (${s})`}
                state={s === 'error' ? 'error' : s === 'saved' ? 'saved' : 'idle'}
                disabled={s === 'saving'}
              />
              <RowSaveState
                state={s}
                labels={{ saving: 'Enregistrement…', saved: 'Enregistré', error: 'Erreur' }}
              />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="w-20 ts-label-micro text-text-muted">read-only</span>
            <FeeCell value={1500} onCommit={() => undefined} label="Domicile · Illizi" disabled />
          </div>
        </Card>
      </Frame>
    );
  },
};

function FreeDeliveryDemo() {
  const [amount, setAmount] = React.useState<number | null>(5000);
  return (
    <Frame>
      <FreeDeliveryBar
        enabled={amount !== null}
        onEnabledChange={(v) => setAmount(v ? 5000 : null)}
        amount={amount}
        onAmountCommit={setAmount}
        label="Livraison offerte à partir de"
        hint="DA de sous-total · appliqué par l'IA et le formulaire de commande"
        switchLabel="Livraison offerte"
        amountLabel="Seuil de livraison offerte (DA)"
      />
      <FreeDeliveryBar
        enabled={false}
        onEnabledChange={() => undefined}
        amount={null}
        onAmountCommit={() => undefined}
        label="Livraison offerte à partir de"
        hint="DA de sous-total"
        switchLabel="Livraison offerte"
        amountLabel="Seuil"
        disabled
      />
      <FreeDeliveryBar
        enabled
        amount={5000}
        onEnabledChange={() => undefined}
        onAmountCommit={() => undefined}
        label="Livraison offerte à partir de"
        hint="DA de sous-total"
        switchLabel="Livraison offerte"
        amountLabel="Seuil"
        error="Action non autorisée pour votre rôle (FORBIDDEN)"
      />
    </Frame>
  );
}
export const FreeDelivery: Story = { render: () => <FreeDeliveryDemo /> };
