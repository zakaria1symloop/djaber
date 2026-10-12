// M5 — new order form pieces: Figma "ORD-02 — New order — form (client conflict, variant, fee quote)" — numbered cards,
// client picker rows, order lines with stock hints, fee quote bar states, totals card, validation checklist.
import type { Meta, StoryObj } from '@storybook/react';
import { Banner, Button, ClientResultRow, FeeQuoteBar, MoneyInput, OrderFormCard, OrderLineRow, OrderTotalsCard, PhoneInput, PickerSearch, QtyStepper, ValidationChecklist } from './index';

const meta: Meta = { title: 'M5/Order form' };
export default meta;
type Story = StoryObj;

const Frame = ({ children }: { children: React.ReactNode }) => <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">{children}</div>;
const qty = { decrease: 'Diminuer', increase: 'Augmenter', value: 'Quantité' };

export const ClientConflict: Story = {
  render: () => (
    <Frame>
      <OrderFormCard index={1} title="CLIENTE" badge="REQUIS : NOM + TÉLÉPHONE">
        <PickerSearch value="0555 12" onChange={() => {}} placeholder="Rechercher un client" label="Rechercher un client" active />
        <ul className="divide-y divide-line-hairline overflow-hidden rounded-card border border-line-edge">
          <ClientResultRow
            name="Amina Belkacem"
            meta="0555 12 34 56 · Sétif, El Eulma · 3 commandes · fidèle"
            highlighted
            onSelect={() => {}}
            badge={<span className="rounded-[4px] border border-accent-money/50 px-2 py-0.5 ts-label-micro text-accent-money">UTILISER</span>}
          />
          <ClientResultRow name="FB User ·8a2f1c" muted meta="sans téléphone · fiche incomplète (IA)" onSelect={() => {}} />
        </ul>
        <Banner tone="info">
          Ce numéro appartient déjà à Amina Belkacem — la commande sera rattachée à sa fiche (adresse par défaut préremplie). Créer un doublon est impossible (CLIENT_PHONE_EXISTS).
        </Banner>
        <PhoneInput value="0555 12 34 56" onChange={() => {}} preview={{ text: 'Normalisé : 0555123456 · mobile DZ valide', tone: 'muted' }} />
        <PhoneInput value="0555 12" onChange={() => {}} preview={{ text: 'Numéro invalide · format attendu 0555 12 34 56', tone: 'danger' }} />
      </OrderFormCard>
    </Frame>
  ),
};

export const Lines: Story = {
  render: () => (
    <Frame>
      <OrderFormCard index={2} title="ARTICLES" badge="STOCK VÉRIFIÉ À L'ENREGISTREMENT">
        <ul className="divide-y divide-line-hairline rounded-card border border-line-edge">
          <OrderLineRow
            name="La Robe satin"
            detail="Noir · M (stock 1)"
            warning="Dernière unité de cette variante"
            price={<MoneyInput value="4900" onValueChange={() => {}} />}
            quantity={<QtyStepper value={1} onChange={() => {}} labels={qty} tone="warning" />}
            total="4 900 DA"
            onRemove={() => {}}
            removeLabel="Retirer"
          />
          <OrderLineRow
            name="Foulard soie"
            detail="Bordeaux (stock 41)"
            price={<MoneyInput value="2400" onValueChange={() => {}} />}
            quantity={<QtyStepper value={1} onChange={() => {}} labels={qty} />}
            total="2 400 DA"
            onRemove={() => {}}
            removeLabel="Retirer"
          />
          <OrderLineRow
            name="Parfum Oud 50 ml"
            detail="(sans variante, stock 3)"
            warning="Stock insuffisant (disponible : 3)."
            warningTone="danger"
            price={<MoneyInput value="4900" onValueChange={() => {}} />}
            quantity={<QtyStepper value={4} onChange={() => {}} labels={qty} tone="danger" />}
            total="19 600 DA"
            onRemove={() => {}}
            removeLabel="Retirer"
          />
          <OrderLineRow
            name="Baskets Air 42"
            detail="Choisir la variante…"
            error="Choisissez une variante."
            price={<MoneyInput value="8300" onValueChange={() => {}} />}
            quantity={<QtyStepper value={1} onChange={() => {}} labels={qty} />}
            total="8 300 DA"
            onRemove={() => {}}
            removeLabel="Retirer"
          />
        </ul>
      </OrderFormCard>
    </Frame>
  ),
};

export const FeeQuoteStates: Story = {
  render: () => (
    <Frame>
      <FeeQuoteBar tone="muted" title="Choisissez la wilaya pour calculer les frais" />
      <FeeQuoteBar
        title="Frais de livraison client : 400 DA"
        explanation="GRILLE SÉTIF · DOMICILE 400 DA · COÛT TRANSPORTEUR 450 DA"
        action={
          <Button size="sm" variant="ghost">
            Modifier (Admin)
          </Button>
        }
      />
      <FeeQuoteBar
        title="Frais de livraison client : 0 DA (offerte)"
        explanation="GRILLE SÉTIF · DOMICILE 400 DA → OFFERTE (SOUS-TOTAL ≥ 5 000 DA)"
        action={
          <Button size="sm" variant="ghost">
            Modifier (Admin)
          </Button>
        }
      />
      <FeeQuoteBar tone="danger" title="Wilaya non desservie" explanation="Livraison non assurée dans cette wilaya. (WILAYA_NOT_SERVED)" />
      <FeeQuoteBar
        title="Frais de livraison client : 300 DA"
        explanation="FRAIS MODIFIÉS (ADMIN) · GRILLE 400 DA"
        action={
          <Button size="sm" variant="ghost">
            Revenir à la grille
          </Button>
        }
      >
        <MoneyInput value="300" onValueChange={() => {}} className="max-w-48" />
      </FeeQuoteBar>
    </Frame>
  ),
};

export const SummaryRail: Story = {
  render: () => (
    <div className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <OrderTotalsCard
        title="RÉCAPITULATIF"
        rows={[
          { key: 'subtotal', label: 'SOUS-TOTAL · 4 ARTICLES', value: '17 100 DA' },
          { key: 'discount', label: 'REMISE', value: '− 0 DA' },
          { key: 'fee', label: 'LIVRAISON', value: '0 DA (offerte)' },
          { key: 'total', label: 'TOTAL', value: '17 100 DA', strong: true },
          { key: 'paid', label: 'PAYÉ · RESTE', value: '0 · 17 100 DA' },
        ]}
      />
      <ValidationChecklist
        title="VALIDATION"
        items={[
          { key: 'client', state: 'ok', label: 'Client : nom + téléphone valides' },
          { key: 'items', state: 'ok', label: '≥ 1 article, stock disponible' },
          { key: 'address', state: 'ok', label: 'Wilaya · commune · adresse (confirmation)' },
          { key: 'fee', state: 'ok', label: 'Frais calculés depuis la grille' },
          {
            key: 'variants',
            state: 'missing',
            label: 'Variante choisie pour chaque produit à variantes',
          },
          {
            key: 'lastUnit',
            state: 'warning',
            label: 'Avertissement : dernière unité « Noir · M »',
          },
        ]}
      />
    </div>
  ),
};
