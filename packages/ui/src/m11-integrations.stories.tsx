// M11 — Settings › Intégrations pieces: Figma "SET — Settings — Integrations (Sheets · API keys · webhooks)" and the
// "DLG — Settings & billing" dialogs "Webhook sortant" / "Google Sheets — choisir la feuille". One story per state.
import type { Meta, StoryObj } from '@storybook/react';
import { ActionsMenu, Button, ConnectionNote, DeliveryLogRow, IntegrationRow, MonoChip, Pill, SecretOnce } from './index';

const meta: Meta = { title: 'M11/Integrations' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">{children}</div>;
const menu = <ActionsMenu label="Actions" actions={[{ key: 'revoke', label: 'Révoquer', destructive: true, onSelect: () => undefined }]} />;

export const ApiKeyShownOnce: Story = {
  render: () => (
    <Frame>
      <SecretOnce value="dj_live_4b1e9c7d2a0f6e8b1c3d5e7f9a1b3c5d7e9f1a3b5c7" note="Copiez-la maintenant : elle ne sera plus jamais affichée." copyLabel="Copier" copiedLabel="Copié" />
    </Frame>
  ),
};

export const WebhookSecretShownOnce: Story = {
  render: () => (
    <Frame>
      <SecretOnce value="whsec_8f2a91c0b7d64e3f5a2b1c0d9e8f7a6b" note="Secret de signature HMAC : affiché une seule fois." copyLabel="Copier" copiedLabel="Copié" />
    </Frame>
  ),
};

export const ApiKeysList: Story = {
  render: () => (
    <Frame>
      <ul className="divide-y divide-line-hairline rounded-card border border-line-edge bg-ink-surface">
        <IntegrationRow title="ERP interne · dj_live_8f2a…" meta="orders:read · orders:write · products:read · dernière utilisation il y a 12 min" actions={menu} />
        <IntegrationRow title="Zapier (ancien) · dj_live_c91d…" meta="customers:read · webhooks:manage · dernière utilisation il y a 41 j" actions={menu} />
        <IntegrationRow muted title="Test sandbox · dj_test_02be…" meta="products:read · révoquée le 2 oct." status={<MonoChip>RÉVOQUÉE</MonoChip>} />
      </ul>
    </Frame>
  ),
};

export const WebhookEndpoints: Story = {
  render: () => (
    <Frame>
      <ConnectionNote tone="danger" label="Désactivé" action={<Button size="sm">Réactiver</Button>}>
        « https://erp.amel.dz/hooks/djaber » désactivé après 50 échecs (502). Corrigez l’endpoint puis réactivez ; les 50 dernières livraisons peuvent être rejouées.
      </ConnectionNote>
      <ul className="divide-y divide-line-hairline rounded-card border border-line-edge bg-ink-surface">
        <IntegrationRow title="https://erp.amel.dz/hooks/djaber" meta="order.created · order.status_changed · order.delivered · stock.low" status={<MonoChip tone="danger">DÉSACTIVÉ</MonoChip>} actions={menu} />
        <IntegrationRow title="https://hooks.zapier.com/…/a1b2" meta="customer.new · conversation.escalated" status={<MonoChip tone="success">ACTIF</MonoChip>} actions={menu} />
      </ul>
    </Frame>
  ),
};

export const DeliveriesJournal: Story = {
  render: () => (
    <Frame>
      <ul className="divide-y divide-line-hairline rounded-card border border-line-edge bg-ink-surface">
        <DeliveryLogRow time="10:58" label="order.created · #CMD-1042" result="502 · tentative 7/7" tone="danger" actions={<Button size="sm" variant="ghost">Rejouer</Button>} />
        <DeliveryLogRow time="09:40" label="stock.low · Parfum Oud" result="en attente · tentative 2/7" tone="warning" />
        <DeliveryLogRow time="hier 18:03" label="order.delivered · #CMD-1037" result="200 · 142 ms" tone="success" />
      </ul>
    </Frame>
  ),
};

export const SheetsStates: Story = {
  render: () => (
    <Frame>
      <ConnectionNote label="État · non connecté">Bouton « Connecter Google » → OAuth → choisir / créer la feuille</ConnectionNote>
      <ConnectionNote tone="danger" label="État · erreur · accès révoqué" action={<Button size="sm">Reconnecter Google</Button>}>
        Google a refusé l’accès : la synchronisation est en pause.
      </ConnectionNote>
      <ConnectionNote tone="danger" label="État · erreur · feuille introuvable" action={<Button size="sm">Choisir une autre feuille</Button>}>
        La feuille a été supprimée ou n’est plus partagée.
      </ConnectionNote>
      <ConnectionNote tone="warning" label="État · vérification Google en attente">≤ 100 utilisateurs test jusqu’à l’approbation.</ConnectionNote>
      <div>
        <Pill tone="success">CONNECTÉ · SYNCHRO IL Y A 4 MIN</Pill>
      </div>
    </Frame>
  ),
};
