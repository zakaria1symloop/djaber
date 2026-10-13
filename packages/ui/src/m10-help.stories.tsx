// M10 — merchant help center & public status page pieces: Figma "HELP — Help & support (merchant)" (categories, Mes
// demandes rows, État du service, thread, satisfaction) and "PUB — Public status page (status.djaber.ai)" (component
// rows with 90-day bars, incident history). One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { HelpCard, HelpCategoryCard, IncidentEntry, RatingStars, ServiceStatusRow, StatusComponentRow, TicketMessage, TicketRow, type UptimeDay } from './index';

const meta: Meta = { title: 'M10/Help & status' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;
const days = (incidentAt: number[] = [], degradedAt: number[] = []): UptimeDay[] => Array.from({ length: 90 }, (_, i) => (incidentAt.includes(i) ? 'incident' : degradedAt.includes(i) ? 'degraded' : 'ok'));

export const Categories: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HelpCategoryCard title="Démarrer" count="6 guides" description="Connecter une page · premier agent · premier produit" />
        <HelpCategoryCard title="Pages & Instagram" count="8 guides" description="Approbation Meta · reconnexion · fenêtre 24 h" active />
        <HelpCategoryCard title="Agent IA" count="11 guides" description="Règles, transfert, langues, photos, vocal" />
        <HelpCategoryCard title="Sécurité & données" count="aucun guide" description="2FA, membres, export, suppression de compte" />
      </div>
    </Frame>
  ),
};

export const TicketRows: Story = {
  render: () => (
    <Frame>
      <HelpCard title="Mes demandes" end={<span className="text-[13px] text-text-secondary">Voir tout</span>}>
        <div className="divide-y divide-line-hairline rounded-card border border-line-edge">
          <TicketRow href="#" number="#T-4821" subject="Google Sheets ne se met plus à jour" meta="ouvert il y a 1 h · à vous de répondre" pill="RÉPONSE REÇUE" tone="warning" />
          <TicketRow href="#" number="#T-4102" subject="Bordereau ZR Express illisible" meta="résolu le 12 sept. 2026 · note 5/5" pill="RÉSOLU" tone="success" />
          <TicketRow href="#" number="#T-3980" subject="Instagram en attente" meta="ouvert il y a 2 j · en attente du support" pill="OUVERT" tone="info" />
          <TicketRow href="#" number="#T-3711" subject="Facture introuvable" meta="fermé le 01 oct. 2026" pill="FERMÉ" tone="neutral" />
        </div>
      </HelpCard>
    </Frame>
  ),
};

export const Thread: Story = {
  render: () => (
    <Frame>
      <TicketMessage kind="user" author="Zakaria A." at="03 oct. 2026 18:40" body="Bonjour, depuis hier les commandes n'arrivent plus dans ma feuille." attachments={[{ name: 'capture.png', url: '#' }]} />
      <TicketMessage kind="system" author="SYSTÈME" at="03 oct. 2026 18:40" body="Contexte auto : espace Boutique Amel · Pro · Sheets connecté · dernière erreur 403" />
      <TicketMessage kind="support" author="Sofiane B. (support)" at="04 oct. 2026 09:05" body="La connexion a perdu ses droits (403). Pouvez-vous reconnecter Google depuis Paramètres › Intégrations ?" />
      <TicketMessage kind="internal" author="Sofiane B. · note interne" at="04 oct. 2026 09:06" body="Quota Google plateforme — voir incident." />
    </Frame>
  ),
};

function RatingDemo() {
  const [v, setV] = useState<number | null>(null);
  return <RatingStars value={v} onChange={setV} label="Votre avis" starLabel={(n) => `${n} étoiles`} />;
}
export const Rating: Story = { render: () => <Frame><RatingDemo /></Frame> };
export const Rated: Story = { render: () => <Frame><RatingStars value={4} label="Votre avis" starLabel={(n) => `${n} étoiles`} disabled /></Frame> };

export const ServiceStatus: Story = {
  render: () => (
    <Frame>
      <HelpCard title="État du service" sub="status.djaber.ai" className="max-w-sm">
        <div className="divide-y divide-line-hairline rounded-card border border-line-edge">
          <ServiceStatusRow name="Messenger / Instagram" pill="OK" tone="success" />
          <ServiceStatusRow name="Agent IA" pill="OK" tone="success" />
          <ServiceStatusRow name="Google Sheets" pill="INCIDENT" tone="danger" />
          <ServiceStatusRow name="Transporteurs" pill="DÉGRADÉ" tone="warning" />
        </div>
      </HelpCard>
    </Frame>
  ),
};

export const StatusComponents: Story = {
  render: () => (
    <Frame>
      <div className="divide-y divide-line-hairline rounded-card border border-line-edge">
        <StatusComponentRow name="Messagerie Facebook & Instagram" state="operational" pill="OPÉRATIONNEL" uptime="99,98 % · 90 j" days={days()} barsLabel="99,98 %" />
        <StatusComponentRow name="Agent IA (réponses, commandes)" state="operational" pill="OPÉRATIONNEL" uptime="99,9 %" days={days([], [52])} barsLabel="99,9 %" />
        <StatusComponentRow name="Google Sheets" state="incident" pill="INCIDENT" uptime="99,2 %" days={days([86, 87, 88, 89])} barsLabel="99,2 %" />
        <StatusComponentRow name="Paiement CIB / Edahabia" state="operational" pill="OPÉRATIONNEL" uptime="99,95 %" days={null} barsLabel="99,95 %" />
      </div>
    </Frame>
  ),
};

export const IncidentHistory: Story = {
  render: () => (
    <Frame>
      <div className="divide-y divide-line-hairline rounded-card border border-line-edge">
        <IncidentEntry open meta="06 OCT. 11:20 — EN COURS" title="Google Sheets : synchronisation en pause" details="Identifié 11:21 · Mise à jour 11:40 : quota Google plateforme atteint, file en attente, aucune donnée perdue" />
        <IncidentEntry open={false} meta="05 OCT. 18:40 → 19:05 — RÉSOLU" title="Latence des réponses IA" details="Fournisseur dégradé · bascule automatique vers le fournisseur secondaire" />
      </div>
    </Frame>
  ),
};
