// M10 — ops & safety kit (Figma "ADM-12 — support tickets", "ADM-13 — platform settings", "ADM-14 — jobs & health",
// "PUB — Public status page"): pill tabs, KPI strip, panel, state / SLA pills, 90-day uptime bars, context rows.
// One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button, ContextRows, OpsKpiStrip, OpsKpiTile, OpsPanel, PillTabs, SlaPill, StatePill, UptimeBars, type UptimeDay } from './index';

const meta: Meta = { title: 'M10/Ops & safety' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

function TabsDemo() {
  const [v, setV] = useState('open');
  return (
    <PillTabs
      label="Onglets"
      value={v}
      onChange={setV}
      tabs={[
        { key: 'open', label: 'Ouverts', count: 9 },
        { key: 'mine', label: 'Assignés à moi', count: 3 },
        { key: 'pending', label: 'En attente du client', count: 5 },
        { key: 'resolved', label: 'Résolus' },
        { key: 'all', label: 'Tous' },
      ]}
    />
  );
}
export const Tabs: Story = { render: () => <Frame><TabsDemo /></Frame> };

export const KpiStrip: Story = {
  render: () => (
    <Frame>
      <OpsKpiStrip label="Indicateurs">
        <OpsKpiTile context="2 retards > 5 s · 0 perdu" value="99,6 %" unit="webhooks Meta acquittés < 1 s" />
        <OpsKpiTile context="sheets-sync (quota Google)" value="1 240" unit="jobs en retard" tone="danger" />
        <OpsKpiTile context="bascule active" value="4,1 %" unit="erreurs IA · openai · 24 h" tone="warning" />
        <OpsKpiTile context="idempotence AiToolCall ✓" value="0" unit="commandes dupliquées · 7 j" />
        <OpsKpiTile context="Sheets · depuis 11:20" value="1" unit="incident ouvert" tone="danger" />
      </OpsKpiStrip>
    </Frame>
  ),
};

export const Panel: Story = {
  render: () => (
    <Frame>
      <OpsPanel title="Fonctions (feature flags)" sub="Par plateforme et par pourcentage ou liste d'espaces." end={<Button size="sm" variant="ghost">+ Nouveau flag</Button>}>
        <p className="text-[13px] text-text-secondary">Contenu du panneau</p>
      </OpsPanel>
    </Frame>
  ),
};

export const StatePills: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-2">
        <StatePill state="ok">OK</StatePill>
        <StatePill state="warning">ATTENTION · EcoTrack 401</StatePill>
        <StatePill state="incident">INCIDENT · quota Google</StatePill>
        <StatePill state="paused">PAUSE</StatePill>
        <StatePill state="info">TEST…</StatePill>
        <StatePill state="neutral">NON DEMANDÉE</StatePill>
      </div>
    </Frame>
  ),
};

export const SlaPills: Story = {
  render: () => (
    <Frame>
      <div className="flex flex-wrap gap-2">
        <SlaPill kind="breached">DÉPASSÉ DE 20 MIN</SlaPill>
        <SlaPill kind="remaining">3 H 25 RESTANTES</SlaPill>
        <SlaPill kind="waiting">EN ATTENTE CLIENT</SlaPill>
      </div>
    </Frame>
  ),
};

const days = (incidentAt: number[], degradedAt: number[] = []): UptimeDay[] => Array.from({ length: 90 }, (_, i) => (incidentAt.includes(i) ? 'incident' : degradedAt.includes(i) ? 'degraded' : i < 3 ? 'none' : 'ok'));
export const Uptime: Story = {
  render: () => (
    <Frame>
      <UptimeBars label="Messagerie · 99,98 % sur 90 jours" days={days([])} />
      <UptimeBars label="Agent IA · 99,9 %" days={days([], [52])} />
      <UptimeBars label="Google Sheets · 99,2 %" days={days([86, 87, 88, 89])} />
    </Frame>
  ),
};

export const Context: Story = {
  render: () => (
    <Frame>
      <div className="max-w-sm rounded-card border border-line-edge p-4">
        <ContextRows
          rows={[
            { label: 'Espace', value: 'Boutique Amel · Pro · actif' },
            { label: 'Utilisateur', value: 'Zakaria A. · propriétaire · web Chrome' },
            { label: 'Intégration', value: 'Sheets : erreur 403 depuis 03 oct. 21:12' },
            { label: 'Tickets précédents', value: '2 (résolus) · satisfaction 5/5' },
            { label: 'Incident lié', value: 'Quota Google plateforme' },
          ]}
        />
      </div>
    </Frame>
  ),
};
