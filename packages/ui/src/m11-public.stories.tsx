// M11 — public site pieces: Figma "PUB — Pricing page (plans · FAQ · CTA)" (FAQ accordion), "PUB — Public account
// deletion page" (numbered steps), "PUB — Legal (CMS) · Landing & help · Meta data-deletion status" (version diff,
// feature blocks, heading). One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { FaqAccordion, FeatureBlock, MarketingHeading, NumberedSteps, VersionDiff } from './index';

const meta: Meta = { title: 'M11/Public site' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-[760px] flex-col gap-4 p-6">{children}</div>;

const FAQ = [
  { id: '1', question: 'C’est quoi un crédit ?', answer: '1 crédit = 1 réponse texte de l’IA. Des packs sont disponibles à partir de 450 DA.' },
  { id: '2', question: 'Que se passe-t-il quand mes crédits sont épuisés ?', answer: 'L’IA cesse de répondre et les conversations arrivent dans votre boîte de réception.' },
  { id: '3', question: 'Puis-je changer de plan à tout moment ?', answer: 'Oui, au prorata pour un plan supérieur.' },
  { id: '4', question: 'Comment payer ? (CIB, Edahabia, virement)', answer: 'Par carte CIB ou Edahabia via Chargily, ou par virement / CCP.' },
  { id: '5', question: 'Mes données sont-elles en sécurité ?', answer: 'Jetons chiffrés, accès par rôle, journal d’audit.' },
];

export const FaqClosed: Story = { render: () => <Frame><FaqAccordion items={FAQ} /></Frame> };
export const FaqArabic: Story = {
  render: () => (
    <div dir="rtl">
      <Frame>
        <FaqAccordion items={[{ id: '1', question: 'ما هو الرصيد؟', answer: 'رصيد واحد = رد نصي واحد من الذكاء الاصطناعي.' }]} />
      </Frame>
    </div>
  ),
};

export const DeletionSteps: Story = {
  render: () => (
    <Frame>
      <NumberedSteps
        steps={[
          { id: '1', marker: '1', title: 'Saisissez l’e-mail de votre compte', sub: 'nous envoyons un lien de confirmation valable 24 h' },
          { id: '2', marker: '2', title: 'Confirmez depuis l’e-mail', sub: 'votre compte est désactivé immédiatement ; export des données proposé (JSON + CSV)' },
          { id: '3', marker: '3', title: 'Délai de 30 jours', sub: 'reconnectez-vous pour annuler ; sinon vos données personnelles sont anonymisées définitivement' },
          { id: '4', marker: '!', tone: 'warning', title: 'Propriétaire d’une boutique active ?', sub: 'transférez d’abord la propriété ou supprimez la boutique depuis Paramètres › Zone de danger' },
        ]}
      />
    </Frame>
  ),
};

export const VersionDiffV3ToV4: Story = {
  render: () => (
    <Frame>
      <VersionDiff
        addedLabel="Ajouté :"
        removedLabel="Supprimé :"
        lines={[
          { kind: 'same', text: '1. Objet' },
          { kind: 'del', text: 'Les crédits non utilisés expirent à la fin du mois.' },
          { kind: 'add', text: 'Les crédits des packs n’expirent jamais ; ceux du plan sont remis à zéro au renouvellement.' },
          { kind: 'same', text: '2. Compte et espace de travail' },
        ]}
      />
    </Frame>
  ),
};

export const FeatureBlocks: Story = {
  render: () => (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-8 p-6">
      <MarketingHeading title="Votre vendeur IA sur Messenger & Instagram" sub="Répond en darija, prend les commandes, organise la livraison. Essai gratuit 14 jours." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {['Un vendeur IA qui répond 24 h/24', 'Les commandes prises dans la conversation', 'La livraison organisée', 'Le stock à jour', 'Des statistiques claires', 'L’application mobile'].map((title, i) => (
          <FeatureBlock key={title} index={`0${i + 1}`} title={title}>
            Produit, variante, quantité, adresse et téléphone : la commande est créée et vous êtes notifié.
          </FeatureBlock>
        ))}
      </div>
    </div>
  ),
};
