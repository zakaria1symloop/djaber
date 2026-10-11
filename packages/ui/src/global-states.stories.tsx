// GLOBAL — States, toasts, banners & system dialogs catalogue (Figma 996:42199).
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  ActionsMenu,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  ForbiddenState,
  ListSkeleton,
  NotFoundState,
  OfflineNotice,
  Pill,
  SessionExpiredState,
  SuspendedState,
  SystemPage,
  toast,
  ToastRegion,
} from './index';

const meta: Meta = { title: 'GLOBAL/States' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-xl flex-col gap-4 p-6">{children}</div>;

export const Skeleton: Story = {
  render: () => (
    <Frame>
      <Card>
        <ListSkeleton label="Chargement…" />
      </Card>
    </Frame>
  ),
};

export const Empty: Story = {
  render: () => (
    <Frame>
      <EmptyState title="Aucune commande" description="Les commandes créées par l'IA ou votre équipe apparaîtront ici." action={{ label: '+ Nouvelle commande' }} />
    </Frame>
  ),
};

export const FilteredEmpty: Story = {
  render: () => (
    <Frame>
      <FilteredEmptyState title="Aucun résultat" description="Aucune commande ne correspond à « Source : API · Sétif »." action={{ label: 'Effacer les filtres' }} />
    </Frame>
  ),
};

export const ErrorRetry: Story = {
  name: 'Error',
  render: () => (
    <Frame>
      <ErrorState title="Impossible de charger" description="Une erreur est survenue (ref. 8f2a-19)." action={{ label: 'Réessayer' }} />
    </Frame>
  ),
};

export const Offline: Story = {
  render: () => (
    <Frame>
      <OfflineNotice action={{ label: 'Réessayer' }}>Hors ligne — données du 05 oct. 11:40. Les actions sont désactivées jusqu'au retour de la connexion.</OfflineNotice>
    </Frame>
  ),
};

export const Forbidden403: Story = {
  name: '403',
  render: () => (
    <SystemPage>
      <ForbiddenState code="403" title="Accès refusé" description="Cette page est réservée aux admins de l'espace. Votre rôle : Opérateur." action={{ label: "Retour à l'accueil" }} />
    </SystemPage>
  ),
};

export const NotFound404: Story = {
  name: '404',
  render: () => (
    <SystemPage>
      <NotFoundState title="Introuvable ou accès refusé" description="Cet élément n'existe pas ou appartient à un autre espace (404)." action={{ label: "Retour à l'accueil" }} />
    </SystemPage>
  ),
};

export const SessionExpired: Story = {
  render: () => (
    <SystemPage>
      <SessionExpiredState title="Session expirée" description="Reconnectez-vous pour continuer. Vous reviendrez sur /commandes/CMD-1042." action={{ label: 'Se connecter' }} />
    </SystemPage>
  ),
};

export const Suspended: Story = {
  render: () => (
    <SystemPage>
      <SuspendedState title="Espace suspendu" description="WORKSPACE_SUSPENDED · Vos données sont conservées. Contactez le support." action={{ label: 'Contacter le support' }} />
    </SystemPage>
  ),
};

export const Banners: Story = {
  render: () => (
    <Frame>
      <Banner tone="danger" action={{ label: 'Acheter des crédits' }}>
        Crédits épuisés (5 000 / 5 000) — l'IA ne répond plus.
      </Banner>
      <Banner tone="warning" action={{ label: 'Voir' }}>
        80 % des crédits utilisés (4 000 / 5 000).
      </Banner>
      <Banner tone="info" action={{ label: 'Renvoyer' }}>
        Vérifiez votre e-mail pour connecter une page.
      </Banner>
      <Banner tone="neutral">Lecture seule — votre accès est limité.</Banner>
    </Frame>
  ),
};

export const Toasts: Story = {
  render: () => (
    <Frame>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => toast('Commande #CMD-1042 confirmée')}>
          Succès
        </Button>
        <Button onClick={() => toast({ tone: 'danger', message: 'Action non autorisée pour votre rôle (FORBIDDEN)' })}>Erreur</Button>
        <Button onClick={() => toast({ tone: 'info', message: 'Export des commandes : 64 %', action: { label: 'Voir', onClick: () => undefined } })}>Avec action</Button>
      </div>
      <ToastRegion label="Notifications" closeLabel="Fermer" />
    </Frame>
  ),
};

function DialogsDemo() {
  const [leave, setLeave] = useState(false);
  const [conflict, setConflict] = useState(false);
  return (
    <Frame>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setLeave(true)}>Quitter sans enregistrer ?</Button>
        <Button onClick={() => setConflict(true)}>Conflit 409</Button>
        <ActionsMenu
          label="Actions"
          actions={[
            { key: 'confirm', label: 'Confirmer', primary: true },
            { key: 'send', label: 'Envoyer au livreur', disabledReason: 'commande non confirmée' },
            { key: 'delete', label: 'Supprimer', destructive: true },
          ]}
        />
        <Pill tone="success" dot>
          IA
        </Pill>
      </div>
      <ConfirmDialog
        open={leave}
        onOpenChange={setLeave}
        title="Quitter sans enregistrer ?"
        description="Vous avez des modifications non enregistrées sur « La Robe satin »."
        confirmLabel="Quitter"
        cancelLabel="Rester"
        onConfirm={() => setLeave(false)}
        destructive
        closeLabel="Fermer"
      />
      <Dialog
        open={conflict}
        onOpenChange={setConflict}
        title="Modifié par quelqu'un d'autre"
        description="CONFLICT (409) · Nadia F. il y a 20 s · votre brouillon est conservé."
        closeLabel="Fermer"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConflict(false)}>
              Écraser
            </Button>
            <Button variant="primary" onClick={() => setConflict(false)}>
              Recharger
            </Button>
          </>
        }
      />
    </Frame>
  );
}
export const DialogsAndActions: Story = { render: () => <DialogsDemo /> };
