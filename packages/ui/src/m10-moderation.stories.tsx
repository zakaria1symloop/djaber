// M10 — moderation & safety pieces: Figma "ADM-10 — Platform admin — moderation queue (products) + review panel" and
// "ADM-11 — Platform admin — abuse reports & blocked words". One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Card, DecisionChip, FlaggedField, FlagImageTile, IconButton, LegendNote, ModerationRow, ReportExcerpt } from './index';

const meta: Meta = { title: 'M10/Moderation' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">{children}</div>;
const Actions = () => (
  <>
    <IconButton size="sm" label="Approuver">✓</IconButton>
    <IconButton size="sm" label="Rejeter">✕</IconButton>
    <IconButton size="sm" label="Actions">⋯</IconButton>
  </>
);

export const QueueRows: Story = {
  render: () => (
    <Frame>
      <Card className="overflow-hidden">
        <ModerationRow
          selection={{ checked: true, onChange: () => undefined, label: 'Sélectionner' }}
          thumbnail={<span className="block size-full" />}
          title="Parfum « Sauvage » 100 ml"
          urgentLabel="URGENT"
          meta="DAR EL OUD · CONFIANCE : STANDARD"
          reason="IA : Marque protégée dans le titre · prix 1 800 DA (−80 % vs référence)"
          score="0,31"
          scoreTone="danger"
          scoreMeta="SCORE IA · 2 h 40"
          actions={<Actions />}
          active
        />
        <ModerationRow
          selection={{ checked: false, onChange: () => undefined, label: 'Sélectionner' }}
          thumbnail={<span className="block size-full" />}
          title="iPhone 15 Pro reconditionné"
          meta="TECH STORE ALGER · CONFIANCE : NOUVEAU"
          reason="IA : Catégorie électronique sensible · 1 seule image · pas de garantie mentionnée"
          score="0,52"
          scoreTone="danger"
          scoreMeta="SCORE IA · 1 h 10"
          actions={<Actions />}
        />
        <ModerationRow thumbnail={<span className="block size-full" />} title="Lot de 50 cartouches imprimante" meta="MAISON LINA · CONFIANCE : TRUSTED" reason="IA : pré-filtrage indisponible" score="—" scoreMeta="SCORE IA · 0 h 05" actions={<Actions />} />
      </Card>
    </Frame>
  ),
};

export const AppealRowState: Story = {
  render: () => (
    <Frame>
      <Card className="overflow-hidden">
        <ModerationRow title="Parfum Sauvage Dior 100 ml" urgentLabel="URGENT" meta="DAR EL OUD · CONTESTÉ LE 06 OCT. 10:12" reason="Nous vendons des produits importés avec facture (jointe). Le prix est promotionnel…" />
      </Card>
    </Frame>
  ),
};

export const DecisionChips: Story = {
  render: function Render() {
    const [v, setV] = useState('counterfeit');
    const opts = [
      ['counterfeit', 'Contrefaçon / marque protégée'],
      ['prohibited', 'Produit interdit (santé, armes, tabac, adulte)'],
      ['inappropriate_image', 'Image inappropriée'],
      ['misleading', 'Prix / description trompeuse'],
      ['missing_info', 'Infos manquantes (demander modification)'],
      ['other', 'Autre (texte libre)'],
    ];
    return (
      <Frame>
        <div className="flex flex-wrap gap-2">
          {opts.map(([k, l]) => (
            <DecisionChip key={k} name="d" value={k} checked={v === k} onChange={() => setV(k!)}>
              {l}
            </DecisionChip>
          ))}
          <DecisionChip checked={false} onChange={() => undefined} disabled>
            Lecture seule
          </DecisionChip>
        </div>
      </Frame>
    );
  },
};

export const ReviewFields: Story = {
  render: () => (
    <Frame>
      <div className="grid grid-cols-4 gap-2">
        <FlagImageTile alt="Image 1" flag="LOGO DIOR DÉTECTÉ" />
        <FlagImageTile alt="Image 2" />
        <FlagImageTile alt="Image 3" />
        <FlagImageTile alt="Image 4" />
      </div>
      <FlaggedField label="Titre" flagged evidence="Marque protégée dans le titre" toggle={{ checked: true, onChange: () => undefined, label: 'refusé' }}>
        Parfum Sauvage Dior 100 ml original
      </FlaggedField>
      <FlaggedField label="Prix" flagged toggle={{ checked: true, onChange: () => undefined, label: 'refusé' }}>
        1 800 DA · référence marché 14 000 DA (−87 %)
      </FlaggedField>
      <FlaggedField label="Catégorie" toggle={{ checked: false, onChange: () => undefined, label: 'refusé' }}>
        Parfums · 3 variantes
      </FlaggedField>
    </Frame>
  ),
};

export const Legend: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-2 sm:grid-cols-2">
        <LegendNote title="AUTO-APPROUVÉ">score IA ≥ 0,9 ET marchand standard/trusted ET catégorie non sensible → visible immédiatement, revu par échantillon 5 %</LegendNote>
        <LegendNote title="SLA">2 h ouvrées · &gt; 2 h = urgent · file assignable aux modérateurs (rôle Modérateur)</LegendNote>
      </div>
    </Frame>
  ),
};

export const Excerpt: Story = {
  render: () => (
    <Frame>
      <ReportExcerpt
        title="EXTRAIT (lecture seule · 4 messages autour du signalement · données client masquées partiellement)"
        lines={[
          { author: 'Client', text: 'vous êtes des voleurs *******', time: '10:41', reported: true },
          { author: 'IA', text: 'Je transmets à un collègue 🙏', time: '10:41' },
          { author: 'Nadia F.', text: 'Bonjour, votre colis a été refusé 3 fois…', time: '10:50' },
          { author: 'Client', text: '****** je vais venir ******', time: '10:52', reported: true },
        ]}
      />
    </Frame>
  ),
};

export const ExcerptEmpty: Story = {
  render: () => (
    <Frame>
      <ReportExcerpt title="EXTRAIT (lecture seule · 0 messages autour du signalement · données client masquées partiellement)" lines={[]} emptyLabel="Aucun message joint à ce signalement." />
    </Frame>
  ),
};
