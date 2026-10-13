// M10 — platform admin core pieces: Figma "ADM-01 — Platform admin — overview" (alert rows), "ADM-04 … plans editor" /
// "ADM-06 … AI providers" (labelled cards), "ADM-09 … audit log + diff" (before / after diff), "ADM-16 … admin roles"
// (role matrix), "DLG — Platform admin — dialogs catalogue" (provider key test states), "ADM-17 … read-only viewers"
// (viewer messages, info blocks) and the D21-bis impersonation bar. One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { AdminAlertRow, AdminCard, Button, CodeDiff, diffLines, FrameNote, ImpersonationBar, InfoBlock, KeyTestRow, MonoChip, RoleMatrix, ViewerMessage } from './index';

const meta: Meta = { title: 'M10/Admin core' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">{children}</div>;

export const AlertRows: Story = {
  render: () => (
    <Frame>
      <ul className="divide-y divide-line-hairline rounded-card border border-line-edge bg-ink-surface">
        <AdminAlertRow tone="danger" title="Fournisseur IA OpenAI : erreurs 4 % (seuil 2 %)" meta="depuis 11:20 · bascule auto vers Anthropic active" action="Voir" />
        <AdminAlertRow tone="warning" title="3 espaces à 100 % de crédits (plan Pro)" meta="proposer un pack ?" action="Espaces" />
        <AdminAlertRow tone="info" title="Meta App Review Instagram : 14 pages en attente" meta="la plus ancienne depuis 9 j" action="Pages" />
      </ul>
    </Frame>
  ),
};

export const AlertRowsEmpty: Story = { render: () => <Frame><p className="rounded-card border border-line-edge p-6 text-center ts-label-meta text-text-muted">Aucune alerte plateforme.</p></Frame> };

export const PlanCards: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 md:grid-cols-3">
        <AdminCard title="Starter" pills={<MonoChip tone="success">VISIBLE · POPULAIRE</MonoChip>} rows={[{ label: 'Crédits', value: '1 500 crédits / mois' }, { label: 'Limites', value: '2 pages · 2 agents · 3 membres' }, { label: 'Abonnés', value: '198 abonnés' }]} actions={<><Button size="sm">Modifier</Button><Button size="sm" variant="ghost">Dupliquer</Button></>} />
        <AdminCard title="Agence (legacy)" pills={<MonoChip tone="warning">ARCHIVÉ · 2 ABONNÉS RESTANTS</MonoChip>} rows={[{ label: 'Crédits', value: '20 000 crédits' }, { label: 'Abonnés', value: '2 abonnés' }]} actions={<><Button size="sm">Modifier</Button><Button size="sm" variant="ghost">Migrer les abonnés</Button></>} />
      </div>
    </Frame>
  ),
};

export const ProviderCards: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 md:grid-cols-3">
        <AdminCard title="OpenAI" pills={<MonoChip tone="success">ACTIF · PRINCIPAL</MonoChip>} rows={[{ label: 'Clé', value: 'sk-…9f2a · testée il y a 5 min ✓' }, { label: 'Santé', value: 'erreurs 24 h : 4,1 % ⚠ (seuil 2 %) → bascule active', tone: 'warning' }]} actions={<Button size="sm">Remplacer la clé</Button>} />
        <AdminCard title="Google" muted pills={<MonoChip>DÉSACTIVÉ</MonoChip>} rows={[{ label: 'Clé', value: 'aucune clé' }, { label: 'Santé', value: '—' }]} actions={<Button size="sm">Remplacer la clé</Button>} />
      </div>
    </Frame>
  ),
};

export const AuditDiff: Story = {
  render: () => (
    <Frame>
      <CodeDiff beforeLabel="AVANT (v4)" afterLabel="APRÈS (v5)" empty="Aucun changement enregistré." lines={diffLines({ maxPages: 3, features: { instagram: false }, priceMonthly: 1900, credits: 1500 }, { maxPages: 2, features: { instagram: true }, priceMonthly: 1900, credits: 1500 })} />
      <FrameNote>Lignes identiques grisées ; secrets et jetons jamais journalisés en clair (hash).</FrameNote>
    </Frame>
  ),
};
export const AuditDiffEmpty: Story = { render: () => <Frame><CodeDiff beforeLabel="AVANT" afterLabel="APRÈS" empty="Aucun changement enregistré." lines={[]} /></Frame> };

export const RoleMatrixTable: Story = {
  render: () => (
    <Frame>
      <RoleMatrix
        label="Matrice des rôles plateforme"
        capabilityLabel="CAPACITÉ"
        roles={[{ key: 'super_admin', label: 'SUPER ADMIN' }, { key: 'support', label: 'SUPPORT' }, { key: 'moderator', label: 'MODÉRATEUR' }, { key: 'finance', label: 'FINANCE' }, { key: 'read', label: 'LECTURE' }]}
        rows={[
          { key: 'view', label: 'Voir espaces / utilisateurs', allowed: ['super_admin', 'support', 'moderator', 'finance', 'read'] },
          { key: 'impersonate', label: 'Impersonation lecture seule', allowed: ['super_admin', 'support'] },
          { key: 'roles', label: 'Gérer les rôles plateforme', allowed: ['super_admin'] },
        ]}
      />
    </Frame>
  ),
};

export const KeyTestStates: Story = {
  render: () => (
    <Frame>
      <KeyTestRow state="testing" pill="TEST…">appel modèle minimal</KeyTestRow>
      <KeyTestRow state="ok" pill="OK · 280 MS">organisation reconnue · quotas lus</KeyTestRow>
      <KeyTestRow state="rejected" pill="REJETÉE">AI_PROVIDER_KEY_REJECTED (401)</KeyTestRow>
      <KeyTestRow state="unreachable" pill="INJOIGNABLE">AI_PROVIDER_UNREACHABLE · enregistrer quand même ?</KeyTestRow>
      <KeyTestRow state="no_key" pill="AUCUNE CLÉ">AI_PROVIDER_NO_KEY · fournisseur désactivé</KeyTestRow>
    </Frame>
  ),
};

export const ViewerThread: Story = {
  render: () => (
    <Frame>
      <ViewerMessage author="CLIENT" at="10:41">« Bonjour, le parfum est à combien ? »</ViewerMessage>
      <ViewerMessage author="IA · VENDEUR PRO" at="10:41" flagged>« Salam ! Parfum Oud 100 ml : 4 500 DA, livraison gratuite »</ViewerMessage>
      <ViewerMessage author="SYSTÈME" at="10:44">Commande #CMD-2210 créée</ViewerMessage>
    </Frame>
  ),
};

export const UserInfoBlocks: Story = {
  render: () => (
    <Frame>
      <div className="grid gap-3 md:grid-cols-4">
        <InfoBlock label="IDENTITÉ" lines={['nadia@boutique.dz ✓ vérifié', '0661 •• •• 54', 'FR · Africa/Algiers', '2FA : non ⚠']} />
        <InfoBlock label="ESPACES (Membership)" lines={['Boutique Amel · opératrice', 'Dar El Oud · admin']} />
        <InfoBlock label="SESSIONS & APPAREILS" lines={['Djaber iOS · iPhone 14 · il y a 2 h']} action={<Button size="sm" variant="ghost">Déconnecter tout</Button>} />
        <InfoBlock label="ACTIVITÉ & AUDIT" lines={['2 tickets support · 1 signalement', 'demande de suppression : en grâce']} />
      </div>
    </Frame>
  ),
};

export const ImpersonationBanner: Story = {
  render: () => (
    <ImpersonationBar action={<Button size="sm">Quitter</Button>}>Vous agissez en tant que Boutique Amel · lecture seule · 27 min</ImpersonationBar>
  ),
};
