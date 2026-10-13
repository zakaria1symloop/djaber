// M9 — billing pieces: Figma "BIL-01 — Settings — Plan & billing" (plan cards, usage tiles, invoice pills),
// "BIL-04 / BIL-03 — Credits page (ledger) · Invoices · Checkout return" (return page states), "DLG — Settings & billing"
// (Changer de plan estimate, Calculateur de crédits, Acheter un pack). One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button, CheckoutStatus, EstimateBox, PackCard, PlanCard, PlanCardsSkeleton, StatusPill, UsageTile } from './index';

const meta: Meta = { title: 'M9/Billing' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;
const FREE = ['1 page', '1 agent', '50 produits', '200 conversations / mois', '100 crédits / mois', '1 membre'];
const STARTER = ['2 pages', '2 agents', '500 produits', '2 000 conversations / mois', '1 500 crédits / mois', '3 membres'];
const PRO = ['5 pages', '5 agents', 'Produits illimités', 'Conversations illimitées', '5 000 crédits / mois', '10 membres'];

export const PlanCards: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 lg:grid-cols-3">
        <PlanCard name="Gratuit" price="0" unit="DA / MOIS" description="Pour démarrer" features={FREE} action={<Button className="w-full">Plan gratuit</Button>} />
        <PlanCard name="Starter" price="1 900" unit="DA / MOIS" description="Pour les boutiques actives" features={STARTER} current badge="VOTRE PLAN" action={<Button className="w-full" disabled>Renouveler</Button>} />
        <PlanCard name="Pro" price="4 083" unit="DA / MOIS · ANNUEL" description="Pour les équipes" features={PRO} badge="POPULAIRE" action={<Button variant="primary" className="w-full">Passer à Pro</Button>} />
      </div>
    </Frame>
  ),
};

export const PlanCardCancelling: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 lg:grid-cols-3">
        <PlanCard name="Pro" price="4 900" unit="DA / MOIS" features={PRO} current badge="VOTRE PLAN" action={<Button className="w-full">Annuler la résiliation</Button>} note="Résiliation programmée : le plan gratuit s'applique le 11 nov. 2026." />
      </div>
    </Frame>
  ),
};

export const PlanCardsLoading: Story = { render: () => <Frame><PlanCardsSkeleton label="Chargement" /></Frame> };

export const Usage: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <UsageTile label="PAGES" used={3} limit={3} valueLabel="3 / 3" />
        <UsageTile label="AGENTS" used={2} limit={3} valueLabel="2 / 3" />
        <UsageTile label="PRODUITS" used={128} limit={1000} valueLabel="128 / 1 000" />
        <UsageTile label="CONVERSATIONS CE MOIS" used={1240} limit={-1} valueLabel="1 240 / ∞" />
        <UsageTile label="MEMBRES" used={4} limit={1} valueLabel="4 / 1" />
      </div>
    </Frame>
  ),
};

const states = [
  { state: 'verifying', label: 'VÉRIFICATION…', title: 'Confirmation du paiement auprès de Chargily (CIB / Edahabia)…', meta: 'Tentative 3 / 12' },
  { state: 'success', label: 'SUCCÈS', title: 'Paiement confirmé', description: 'Pro actif jusqu’au 12 nov. 2026.', meta: 'Facture F-2026-1813' },
  { state: 'pending', label: 'EN ATTENTE', title: 'La banque n’a pas encore confirmé', description: 'Nous vous notifions dès la confirmation. Facturation affiche « en attente ».' },
  { state: 'failed', label: 'ÉCHEC', title: 'Paiement refusé.', description: 'Motif de la banque : fonds insuffisants.' },
  { state: 'expired', label: 'EXPIRÉ', title: 'Session de paiement expirée.', description: 'La session Chargily dure 15 minutes.' },
  { state: 'unknown', label: 'INTROUVABLE', title: 'Paiement introuvable', description: 'Ce lien de retour ne correspond à aucun paiement de cet espace.' },
] as const;

export const CheckoutReturn: Story = {
  render: () => (
    <Frame>
      {states.map((s) => (
        <CheckoutStatus
          key={s.state}
          state={s.state}
          label={s.label}
          title={s.title}
          description={'description' in s ? s.description : undefined}
          meta={'meta' in s ? s.meta : undefined}
          actions={s.state === 'verifying' ? undefined : <Button variant="primary">{s.state === 'failed' ? 'Réessayer' : s.state === 'expired' ? 'Recommencer' : 'Retour à Djaber'}</Button>}
        />
      ))}
    </Frame>
  ),
};

export const Packs: Story = {
  render: function Packs() {
    const [v, setV] = useState('pack-2000');
    return (
      <Frame>
        <div role="radiogroup" aria-label="Packs" className="grid gap-2 sm:grid-cols-3">
          <PackCard name="Petit" credits="500 crédits" price="450 DA" perCredit="0,90 DA / crédit" selected={v === 'pack-500'} onSelect={() => setV('pack-500')} />
          <PackCard name="Moyen" credits="2 000 crédits" price="1 500 DA" perCredit="0,75 DA / crédit" badge="POPULAIRE" selected={v === 'pack-2000'} onSelect={() => setV('pack-2000')} />
          <PackCard name="Grand" credits="6 000 crédits" price="3 900 DA" perCredit="0,65 DA / crédit" selected={v === 'pack-6000'} onSelect={() => setV('pack-6000')} />
        </div>
      </Frame>
    );
  },
};

export const Estimates: Story = {
  render: () => (
    <Frame>
      <EstimateBox>Aujourd’hui : 4 900 DA · puis 4 900 DA le 12 de chaque mois · crédits passent à 5 000 immédiatement.</EstimateBox>
      <EstimateBox tone="warning">Pro → Starter : appliqué à la fin de période (12 oct.) · 2 pages et 3 agents dépassent Starter, ils seront mis en pause.</EstimateBox>
      <EstimateBox>≈ 1 200 × 4 × 1 + 180 × 5 + 96 × 3 = 5 988 crédits / mois → Pro (5 000) + 1 pack Petit (500).</EstimateBox>
    </Frame>
  ),
};

export const InvoicePills: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['paid', 'PAYÉE'],
            ['unpaid', 'IMPAYÉE'],
            ['upcoming', 'À VENIR'],
            ['void', 'ANNULÉE'],
            ['refunded', 'REMBOURSÉE'],
          ] as const
        ).map(([v, l]) => (
          <StatusPill key={v} enumKey="Invoice.status" value={v} className="!rounded-[4px]">
            {l}
          </StatusPill>
        ))}
        {(
          [
            ['trial', 'ESSAI'],
            ['active', 'ACTIF'],
            ['dunning', 'RELANCE'],
            ['expired', 'EXPIRÉ'],
            ['cancelled', 'RÉSILIÉ'],
          ] as const
        ).map(([v, l]) => (
          <StatusPill key={v} enumKey="Subscription.status" value={v}>
            {l}
          </StatusPill>
        ))}
      </div>
    </Frame>
  ),
};
