// M4 — agents kit: Figma "AGT-02 — Agent wizard — step 1…5", "AGT-03", "AGT-04", "AGT-07", "AGT-08".
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import {
  AgentAvatar,
  Button,
  Card,
  CheckChip,
  DiffList,
  FormSection,
  InlineAdd,
  InsightRow,
  InspectorPanel,
  KeyValueList,
  KpiTile,
  MiniField,
  MonoChip,
  PreviewPanel,
  RangeSlider,
  ReadinessRow,
  ScheduleEditor,
  StatusPill,
  SummaryRail,
  TagInput,
  ToggleRow,
  ToolCallChip,
  ValidationSummary,
  VersionTimeline,
  WizardFrame,
  WizardSteps,
  Input,
  type ScheduleValue,
} from './index';

const meta: Meta = { title: 'M4/Agents' };
export default meta;
type Story = StoryObj;
const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

const steps = [
  { key: 'identity', label: 'Identité', state: 'done' as const, onSelect: () => undefined },
  { key: 'knowledge', label: 'Connaissances', state: 'active' as const },
  { key: 'behaviour', label: 'Comportement', state: 'upcoming' as const },
  { key: 'channels', label: 'Canaux', state: 'upcoming' as const },
  { key: 'activate', label: 'Test & activation', state: 'upcoming' as const },
];

export const Wizard: Story = {
  render: () => (
    <div className="p-6">
      <WizardFrame
        steps={steps}
        stepsLabel="Étapes"
        title="Ce que l'agent sait"
        description="Il ne vend que ce qui est dans son périmètre et ne promet que vos règles."
        rail={
          <SummaryRail
            title="RÉCAPITULATIF (brouillon auto-enregistré)"
            rows={[
              { label: 'MODÈLE', value: 'Vendeur Pro' },
              { label: 'NOM', value: 'Vendeur Pro — Boutique Amel' },
              { label: 'LANGUES', value: 'Darija · Arabizi · FR · AR' },
              { label: 'CAPACITÉS', value: '' },
            ]}
          />
        }
        footer={{
          back: <Button variant="ghost">← Précédent</Button>,
          status: 'Brouillon enregistré il y a 12 s · reprenable depuis la liste (statut Brouillon)',
          secondary: <Button variant="ghost">Enregistrer et quitter</Button>,
          primary: <Button variant="primary">Continuer →</Button>,
        }}
      >
        <ValidationSummary title="Validation : 2 erreurs" items={['Le nom interne est requis.', 'Cochez au moins 1 langue.']} />
        <FormSection title="Catalogue" description="Source unique : vos produits (prix, stock, variantes en temps réel).">
          <ToggleRow checked onChange={() => undefined} title="Produits en rupture" description="proposer une alternative de la même catégorie plutôt que « indisponible »" />
          <ToggleRow checked={false} onChange={() => undefined} title="Afficher les variantes manquantes" description="« la taille M est épuisée, il reste S et L »" />
        </FormSection>
      </WizardFrame>
    </div>
  ),
};

export const StepChips: Story = { render: () => <Frame><WizardSteps steps={steps} label="Étapes" /></Frame> };

function Chips() {
  const [langs, setLangs] = React.useState(['darija', 'fr']);
  const all = ['darija', 'arabizi', 'fr', 'ar'];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((l) => (
        <CheckChip key={l} checked={langs.includes(l)} onChange={(on) => setLangs(on ? [...langs, l] : langs.filter((x) => x !== l))}>
          {l}
        </CheckChip>
      ))}
      <CheckChip checked locked lockedLabel="Obligatoire" onChange={() => undefined}>
        Téléphone (10 chiffres, 05/06/07)
      </CheckChip>
    </div>
  );
}
export const CheckChips: Story = { render: () => <Frame><Chips /></Frame> };

export const LivePreview: Story = {
  render: () => (
    <Frame>
      <PreviewPanel
        label="APERÇU"
        messages={[
          { author: 'customer', text: 'Salam, 3andkom la robe satin ? ch7al ?' },
          { author: 'ai', text: 'Salam Amina 👋 La Robe satin kayna f M w L, 4 900 DA. Nwasslek l Sétif b 500 DA, tconfirmi ?' },
        ]}
        note="Exemple de réponse avec ces réglages."
      />
    </Frame>
  ),
};

function Tags() {
  const [v, setV] = React.useState(['avocat', 'arnaque', 'police']);
  return <TagInput value={v} onChange={setV} label="Mots-clés" placeholder="avocat, arnaque…" max={5} removeLabel={(t) => `Retirer ${t}`} />;
}
export const TagInputField: Story = { render: () => <Frame><Tags /><TagInput value={['plein']} onChange={() => undefined} label="Désactivé" removeLabel={(t) => t} disabled /></Frame> };

function TagsWithSuggestions() {
  const [v, setV] = React.useState(['VIP']);
  const known = [{ tag: 'VIP', count: 42 }, { tag: 'fidèle', count: 18 }, { tag: 'Grossiste', count: 7 }, { tag: 'Alger centre', count: 3 }];
  return <TagInput value={v} onChange={setV} label="Étiquettes" placeholder="Ajouter une étiquette…" max={10} removeLabel={(t) => `Retirer ${t}`} suggestions={known} suggestionsLabel="Étiquettes existantes" />;
}
/** M11 — client tags with suggestions from `GET /clients/tags?q=` (count per tag). */
export const TagInputSuggestions: Story = { render: () => <Frame><TagsWithSuggestions /></Frame> };

function Slider() {
  const [v, setV] = React.useState(2);
  return <RangeSlider label="Délai de réponse" min={0} max={10} value={v} onChange={setV} format={(n) => (n === 0 ? 'immédiat' : `${n} s (naturel)`)} />;
}
export const Range: Story = { render: () => <Frame><Slider /></Frame> };

function Hours({ initial, error }: { initial: ScheduleValue | null; error?: string }) {
  const [v, setV] = React.useState<ScheduleValue | null>(initial);
  return <ScheduleEditor value={v} onChange={setV} dayLabels={['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']} labels={{ enabled: "Horaires d'ouverture", enabledHint: 'hors de ces horaires, le message « hors horaires » est envoyé', days: 'Jours', from: 'DE', to: 'À' }} error={error} />;
}
export const Schedule: Story = {
  render: () => (
    <Frame>
      <Hours initial={null} />
      <Hours initial={{ days: [0, 1, 2, 3, 4, 6], from: '09:00', to: '20:00' }} />
      <Hours initial={{ days: [1], from: '20:00', to: '09:00' }} error="L'heure de fin doit être après l'heure de début." />
    </Frame>
  ),
};

export const FaqList: Story = {
  render: () => (
    <Frame>
      <KeyValueList
        labels={{ list: 'FAQ', edit: (k) => `Modifier ${k}`, remove: (k) => `Supprimer ${k}` }}
        empty="Aucune question"
        onEdit={() => undefined}
        onRemove={() => undefined}
        items={[
          { id: '1', key: 'Le parfum tient combien de temps ?', value: '8 à 10 heures sur peau, 24 h sur vêtement.', tag: <MonoChip>SAISI</MonoChip> },
          { id: '2', key: 'Vous livrez à Tamanrasset ?', value: 'Oui, 5 à 7 jours via ZR Express, 1 200 DA.', tag: <MonoChip tone="info">EXTRAIT DE LA PAGE FB</MonoChip> },
          { id: '3', key: "C'est original ?", value: 'Produits importés avec facture ; pas de contrefaçon.', tag: <MonoChip tone="success">SUGGÉRÉ PAR L'IA (12 CLIENTS L'ONT DEMANDÉ)</MonoChip> },
        ]}
      />
      <KeyValueList labels={{ list: 'FAQ', edit: (k) => k, remove: (k) => k }} empty="Aucune question pour l'instant." items={[]} />
      <InlineAdd value="" onChange={() => undefined} onAdd={() => undefined} label="Mot-clé" addLabel="Ajouter" placeholder="arnaque" />
    </Frame>
  ),
};

export const ToolCalls: Story = {
  render: () => (
    <Frame>
      <ToolCallChip name="search_products" toolLabel="OUTIL" toggleLabel="Détail" args={'{ query: "روب ساتان أحمر" }'} result="3 résultats : La Robe satin (RS) · Robe longue mousseline · Kimono brodé" />
      <ToolCallChip name="create_order" toolLabel="OUTIL" simulatedLabel="(simulé)" simulated toggleLabel="Détail" args={'{ clientName, phone: "0555123456", wilayaId: 19 }'} result="TEST-4821 · total 5 300 DA · AUCUNE ÉCRITURE EN BASE" />
      <ToolCallChip name="get_shipping_fee" toolLabel="OUTIL" failed toggleLabel="Détail" args="{ wilayaId: 58 }" result="{ ok: false, error: WILAYA_NOT_SERVED }" defaultOpen={false} />
    </Frame>
  ),
};

export const Inspector: Story = {
  render: () => (
    <Frame>
      <div className="max-w-sm">
        <InspectorPanel
          title="INSPECTEUR DU DERNIER TOUR"
          rows={[
            { key: 'status', label: 'STATUT', value: 'OK', tone: 'success' },
            { key: 'intent', label: 'INTENTION', value: 'SALE · confiance 0,97' },
            { key: 'model', label: 'MODÈLE', value: 'Modèle attribué par la plateforme · réglages du préréglage' },
            { key: 'tokens', label: 'TOKENS', value: '2 140 entrée · 186 sortie' },
            { key: 'latency', label: 'LATENCE', value: '2,3 s' },
            { key: 'language', label: 'LANGUE', value: 'darija · script arabe (règle respectée)', tone: 'success' },
          ]}
        />
      </div>
    </Frame>
  ),
};

export const Versions: Story = {
  render: () => (
    <Frame>
      <Card className="max-w-md">
        <VersionTimeline
          label="Versions"
          items={[
            { version: 3, current: true, currentLabel: 'ACTUELLE', meta: 'HIER 18:02 · ZAKARIA A.', note: 'Ajout règle « mot-clé arnaque » · FAQ +1', actions: <Button size="sm" variant="ghost">Diff</Button>, detail: <DiffList className="mt-3" empty="Aucune différence." rows={[{ key: 'qty', label: 'Quantité max', before: '5', after: '8' }]} /> },
            { version: 2, meta: '28 SEPT. · NADIA F.', note: 'Activation vocal · quantité max 5', actions: (<><Button size="sm" variant="ghost">Restaurer</Button><Button size="sm" variant="ghost">Diff</Button></>) },
            { version: 1, meta: '12 MARS · ZAKARIA A.', note: 'Création depuis Vendeur Pro (préréglage v6)' },
          ]}
        />
      </Card>
      <DiffList empty="Aucune différence." rows={[]} />
    </Frame>
  ),
};

export const Insights: Story = {
  render: () => (
    <Frame>
      <Card className="divide-y divide-line-hairline">
        <InsightRow
          pill={<StatusPill enumKey="AgentInsight.type" value="unknown_topic" className="!rounded-[4px]">SUJET INCONNU</StatusPill>}
          count="12 ×"
          customer="Client : « vous avez des iPhone ? »"
          ai="IA : « Je me renseigne et je reviens vers vous » → transfert"
          cause="Cause : hors catalogue · aucune règle"
          actions={(<><Button size="sm" variant="ghost">Voir la conversation</Button><Button size="sm" variant="primary">Résoudre</Button><Button size="sm" variant="ghost">Ignorer</Button></>)}
        />
        <InsightRow pill={<StatusPill enumKey="AgentInsight.type" value="error" className="!rounded-[4px]">ERREUR IA</StatusPill>} count="2 ×" customer="Client : « ch7al livraison l Tamanrasset »" ai="IA : (aucune réponse · AI_PROVIDER_ERROR)" cause="Cause : fournisseur indisponible 18:40–19:05" />
      </Card>
    </Frame>
  ),
};

export const Tiles: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile value="1 010" label="conversations · 30 j" meta="+22 %" />
        <KpiTile value="87 %" label="traitées sans humain" meta="131 transferts" />
        <KpiTile value="1,9 s" label="délai de réponse moyen" meta="p95 4,1 s" tone="warning" />
      </div>
      <div className="flex items-center gap-3">
        <AgentAvatar name="Vendeur Pro" />
        <AgentAvatar name="Service Client" size={32} />
        <MonoChip>GPT-4O-MINI</MonoChip>
        <MonoChip tone="warning">SIMULATION</MonoChip>
      </div>
    </Frame>
  ),
};

export const Readiness: Story = {
  render: () => (
    <Frame>
      <Card className="px-4">
        <ul className="divide-y divide-line-hairline">
          <ReadinessRow state="ok">Catalogue : 142 produits actifs · 3 sans photo</ReadinessRow>
          <ReadinessRow state="warning" action={<Button size="sm" variant="ghost">Voir l&apos;état</Button>}>Canal : @amel.store (Instagram) — en attente d&apos;approbation Meta</ReadinessRow>
          <ReadinessRow state="missing">Aucun canal libre (AGENT_NO_CHANNEL)</ReadinessRow>
        </ul>
      </Card>
      <MiniField label="PRIX" error="Prix de vente requis (> 0)">
        <Input aria-invalid defaultValue="" />
      </MiniField>
    </Frame>
  ),
};
