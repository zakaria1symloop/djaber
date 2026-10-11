// M1 primitives — Figma AUTH (login, 2FA), ONB-01 (step pills, option cards), SET (sub-nav, avatar, locale tabs).
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from 'lucide-react';
import { useState } from 'react';
import {
  Avatar,
  Card,
  ChecklistRow,
  Field,
  FormAlert,
  OptionCard,
  OtpInput,
  PasswordInput,
  SegmentedControl,
  Spinner,
  Steps,
  StrengthBar,
  SubNav,
  subNavLinkClass,
} from './index';

const meta: Meta = { title: 'M1/Form primitives' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-md flex-col gap-4 p-6">{children}</div>;

export const Password: Story = {
  render: () => (
    <Frame>
      <Field label="MOT DE PASSE" htmlFor="pw" required>
        <PasswordInput id="pw" defaultValue="secret123" showLabel="Afficher" hideLabel="Masquer" />
      </Field>
      <Field label="MOT DE PASSE" htmlFor="pw2" error="8 caractères min, lettre et chiffre">
        <PasswordInput id="pw2" defaultValue="abc" aria-invalid showLabel="Afficher" hideLabel="Masquer" />
      </Field>
    </Frame>
  ),
};

function OtpDemo({ invalid, initial = '' }: { invalid?: boolean; initial?: string }) {
  const [v, setV] = useState(initial);
  return <OtpInput value={v} onChange={setV} invalid={invalid} label="Code à 6 chiffres" />;
}
export const Otp: Story = { render: () => <Frame><OtpDemo initial="481" /></Frame> };
export const OtpInvalid: Story = { render: () => <Frame><OtpDemo initial="481223" invalid /></Frame> };

export const StepPills: Story = {
  render: () => (
    <Frame>
      <Steps
        label="Étapes"
        items={[
          { key: 'welcome', label: 'Bienvenue', state: 'done', onSelect: () => {} },
          { key: 'stock', label: 'Stock', state: 'done', onSelect: () => {} },
          { key: 'product', label: 'Produit', state: 'active' },
          { key: 'agent', label: 'Agent', state: 'upcoming' },
          { key: 'page', label: 'Page', state: 'upcoming' },
          { key: 'ready', label: 'Prêt', state: 'upcoming' },
        ]}
      />
    </Frame>
  ),
};

export const Avatars: Story = {
  render: () => (
    <Frame>
      <div className="flex items-center gap-3">
        <Avatar name="Zakaria Amrani" />
        <Avatar name="Amel B." size={64} />
        <Avatar name="Boutique Amel" size={64} square />
      </div>
    </Frame>
  ),
};

function SegDemo() {
  const [v, setV] = useState<'fr' | 'ar' | 'en'>('fr');
  return (
    <SegmentedControl
      label="Langue"
      value={v}
      onChange={setV}
      options={[
        { value: 'fr', label: 'Français' },
        { value: 'ar', label: 'العربية', dir: 'rtl' },
        { value: 'en', label: 'English' },
      ]}
    />
  );
}
export const Segmented: Story = { render: () => <Frame><SegDemo /></Frame> };

export const SettingsSubNav: Story = {
  render: () => (
    <Frame>
      <SubNav title="Paramètres">
        {['Profil', 'Espace de travail', 'Membres', 'Mode stock', 'Sécurité', 'Zone de danger'].map((l, i) => (
          <a key={l} href="#" className={subNavLinkClass(i === 0)} aria-current={i === 0 ? 'page' : undefined}>
            {l}
          </a>
        ))}
      </SubNav>
    </Frame>
  ),
};

function OptionDemo() {
  const [v, setV] = useState('simple');
  return (
    <div role="radiogroup" aria-label="Mode stock" className="flex flex-col gap-3">
      <OptionCard
        selected={v === 'simple'}
        onSelect={() => setV('simple')}
        icon={<Box className="size-5" />}
        title="Simple"
        badge="ACTIF"
        description="Je vends et je livre. Produits, commandes, clients, livraison. Pas de variantes ni de prix de revient."
      />
      <OptionCard
        selected={v === 'advanced'}
        onSelect={() => setV('advanced')}
        icon={<Box className="size-5" />}
        title="Avancé"
        badge="ACTIF"
        description="Variantes (tailles, couleurs), prix de revient et marges, fournisseurs, achats, ventes au comptoir, caisse, rapports."
      />
    </div>
  );
}
export const OptionCards: Story = { render: () => <Frame><OptionDemo /></Frame> };

export const Strength: Story = {
  render: () => (
    <Frame>
      {([0, 1, 2, 3, 4] as const).map((s) => (
        <StrengthBar key={s} score={s} label={`Force ${s}/4`} />
      ))}
    </Frame>
  ),
};

export const Alerts: Story = {
  render: () => (
    <Frame>
      <FormAlert>E-mail ou mot de passe incorrect.</FormAlert>
      <FormAlert tone="success">Mot de passe modifié.</FormAlert>
      <FormAlert tone="warning">Limite du plan atteinte (3 / 3 membres).</FormAlert>
      <FormAlert tone="info">Si un compte existe pour cet e-mail, un lien a été envoyé.</FormAlert>
      <Spinner label="Vérification…" />
    </Frame>
  ),
};

export const Checklist: Story = {
  render: () => (
    <Frame>
      <Card className="divide-y divide-line-hairline px-4">
        <ChecklistRow done index={1} title="Connecter une page" description="Liez Facebook pour commencer à discuter" />
        <ChecklistRow done={false} index={2} title="Ajouter des produits" description="Construisez votre catalogue" />
        <ChecklistRow done={false} index={3} title="Configurer votre agent IA" description="Personnalisez le ton et le comportement" />
      </Card>
    </Frame>
  ),
};
