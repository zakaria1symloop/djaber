// M2 kit — Figma "CAT-08 — Products — list / bulk bar / filter panel", "CAT-01 — Product — quick edit sheet",
// "CAT-01 — Product form" (images), "GDS-01 — … adjust dialog", "REF — Component sheet" (pills).
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import {
  ActionsMenu,
  ActiveFilters,
  BulkBar,
  Button,
  ColorPill,
  Combobox,
  DataTable,
  Field,
  FilterCheckList,
  FilterChips,
  FilterDateRange,
  FilterDropdown,
  FilterGroup,
  FilterPanel,
  FilterRange,
  FilterToggle,
  ImageTileGrid,
  Ltr,
  MoneyInput,
  NumberInput,
  PILL_TONES,
  ProgressBar,
  QtyStepper,
  RadioCards,
  SearchInput,
  SheetSection,
  SideSheet,
  StatusPill,
  TableViewMenu,
  toast,
  ToastRegion,
  updateToast,
  type Column,
  type Density,
  type ImageTile,
  type PillEnum,
  type SortState,
} from './index';

const meta: Meta = { title: 'M2/List & catalogue kit' };
export default meta;
type Story = StoryObj;

const Frame = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => <div className={`mx-auto flex flex-col gap-4 p-6 ${wide ? 'max-w-5xl' : 'max-w-md'}`}>{children}</div>;

type Row = { id: string; name: string; sku: string; category: string; color: string; price: number; stock: number | null; state: 'ok' | 'low' | 'out' | 'untracked' };
const ROWS: Row[] = [
  { id: '1', name: 'La Robe satin', sku: 'RS', category: 'Vêtements', color: '#a78bfa', price: 4900, stock: 14, state: 'low' },
  { id: '2', name: 'Parfum Oud 50 ml', sku: 'PO-50', category: 'Parfums', color: '#fb923c', price: 4900, stock: 3, state: 'low' },
  { id: '3', name: 'Sac cuir camel', sku: 'SC-CAM', category: 'Accessoires', color: '#fbbf24', price: 9800, stock: 0, state: 'out' },
  { id: '4', name: 'Livraison express Sétif', sku: 'SRV-EXP', category: 'Services', color: '#a3a3a3', price: 500, stock: null, state: 'untracked' },
];
const da = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} DA`;
const STOCK_LABEL = { ok: '', low: 'FAIBLE', out: 'RUPTURE', untracked: 'SERVICE' };
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'PRODUIT', sortKey: 'name', hideable: false, cell: (r) => <span className="text-[14px] font-medium">{r.name}</span> },
  { key: 'sku', header: 'SKU', sortKey: 'sku', ltr: true, hideBelow: 'lg', cell: (r) => <span className="ts-label-meta text-text-secondary">{r.sku}</span> },
  { key: 'category', header: 'CATÉGORIE', cell: (r) => <ColorPill color={r.color}>{r.category}</ColorPill> },
  { key: 'price', header: 'PRIX', sortKey: 'price', ltr: true, cell: (r) => <span className="ts-numeral-m">{da(r.price)}</span> },
  {
    key: 'stock',
    header: 'STOCK',
    sortKey: 'stock',
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <Ltr className="ts-numeral-m">{r.stock ?? '—'}</Ltr>
        {r.state !== 'ok' ? (
          <StatusPill enumKey="Product.stock" value={r.state}>
            {STOCK_LABEL[r.state]}
          </StatusPill>
        ) : null}
      </span>
    ),
  },
];

function TableDemo({ withCard }: { withCard?: boolean }) {
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const [selected, setSelected] = useState<Set<string>>(new Set(['1', '2']));
  const [density, setDensity] = useState<Density>('comfortable');
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <Frame wide>
      <div className="flex justify-end">
        <TableViewMenu
          label="Affichage"
          density={density}
          onDensityChange={setDensity}
          densityLabel="DENSITÉ"
          densityOptions={{ comfortable: 'Confortable', compact: 'Compacte' }}
          columns={COLUMNS.filter((c) => c.hideable !== false).map((c) => ({ key: c.key, label: c.header }))}
          hidden={hidden}
          onHiddenChange={setHidden}
          columnsLabel="COLONNES"
        />
      </div>
      {selected.size ? (
        <BulkBar
          label="Actions groupées"
          summary={`${selected.size} produits sélectionnés · 2 avec variantes`}
          actions={[
            { key: 'category', label: 'Changer de catégorie', onSelect: () => {} },
            { key: 'price', label: 'Prix (+ / − %)', onSelect: () => {} },
            { key: 'labels', label: 'Étiquettes', onSelect: () => {}, disabledReason: 'Disponible en mode avancé' },
            { key: 'archive', label: 'Archiver', destructive: true, onSelect: () => {} },
          ]}
          note="Les actions groupées renvoient un résultat par produit (ok / erreur) — jamais tout ou rien."
          selectAll={{ label: 'Tout sélectionner (128)', onSelect: () => setSelected(new Set(ROWS.map((r) => r.id))) }}
          deselectLabel="Désélectionner"
          onDeselect={() => setSelected(new Set())}
        />
      ) : null}
      <DataTable
        label="Produits"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
        sortLabel={(h) => `Trier par ${h}`}
        selection={{ selected, onChange: setSelected, allLabel: 'Tout sélectionner', rowLabel: (r) => `Sélectionner ${r.name}` }}
        density={density}
        hiddenColumns={hidden}
        activeRowKey="1"
        actionsLabel="Actions"
        rowActions={(r) => (
          <ActionsMenu
            label="Actions"
            heading={`${r.name} · ${r.sku}`}
            actions={[
              { key: 'open', label: 'Ouvrir la fiche', primary: true, hint: 'PAGE PRODUIT' },
              { key: 'quickEdit', label: 'Modification rapide', hint: 'PANNEAU LATÉRAL' },
              { key: 'adjust', label: 'Ajuster le stock', hint: 'DIALOGUE', disabledReason: r.stock === null ? 'Ce produit n’a pas de stock (service). (PRODUCT_NOT_STOCK_TRACKED)' : undefined },
              { key: 'archive', label: 'Archiver', destructive: true, separated: true, hint: 'CONFIRMATION' },
            ]}
          />
        )}
        card={
          withCard
            ? (r) => (
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{r.name}</div>
                    <div className="ts-label-meta text-text-muted">
                      <Ltr>{r.sku}</Ltr> · <Ltr>{da(r.price)}</Ltr>
                    </div>
                  </div>
                  <ActionsMenu label="Actions" actions={[{ key: 'open', label: 'Ouvrir la fiche', primary: true }]} />
                </div>
              )
            : undefined
        }
        footer={<div className="px-3 py-2.5 ts-label-meta text-text-muted">1 – 4 sur 128 · tri : nom ↑</div>}
      />
    </Frame>
  );
}
export const Table: Story = { render: () => <TableDemo /> };
export const TableRtlWithCards: Story = {
  render: () => (
    <div dir="rtl">
      <TableDemo withCard />
    </div>
  ),
};

function FiltersDemo({ panel }: { panel?: boolean }) {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>(['v', 'a']);
  const [status, setStatus] = useState<string[]>(['active']);
  const [stock, setStock] = useState<string[]>(['low']);
  const [price, setPrice] = useState({ min: '1000', max: '20000' });
  const [dates, setDates] = useState({ from: '', to: '' });
  const [preset, setPreset] = useState<string | null>('30d');
  const [low, setLow] = useState(true);
  const [open, setOpen] = useState(!!panel);
  const categories = [
    { value: 'v', label: 'Vêtements', count: 41 },
    { value: 'a', label: 'Accessoires', count: 27 },
    { value: 'p', label: 'Parfums', count: 18 },
  ];
  const groups = (
    <>
      <FilterGroup label="CATÉGORIES" source="Product.categoryId ∈ []">
        <FilterCheckList options={categories} value={cats} onChange={setCats} searchPlaceholder="Rechercher une catégorie…" emptyLabel="Aucun" />
      </FilterGroup>
      <FilterGroup label="STATUT" source="Product.isActive · deletedAt">
        <FilterChips
          label="STATUT"
          multiple
          options={[
            { value: 'active', label: 'Actifs' },
            { value: 'inactive', label: 'Inactifs' },
            { value: 'archived', label: 'Archivés' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </FilterGroup>
      <FilterGroup label="ÉTAT DU STOCK" source="stock vs minStock">
        <FilterChips
          label="ÉTAT DU STOCK"
          allLabel="Tous"
          options={[
            { value: 'low', label: 'Stock faible' },
            { value: 'out', label: 'Rupture' },
            { value: 'in_stock', label: 'En stock' },
          ]}
          value={stock}
          onChange={setStock}
        />
      </FilterGroup>
      <FilterGroup label="PRIX DE VENTE" source="Product.price">
        <FilterRange min={price.min} max={price.max} onChange={setPrice} unit="DA" labels={{ min: 'min', max: 'max' }} />
      </FilterGroup>
      <FilterGroup label="CRÉÉ / MODIFIÉ" source="createdAt · updatedAt">
        <FilterDateRange
          from={dates.from}
          to={dates.to}
          onChange={(d) => {
            setDates(d);
            setPreset('custom');
          }}
          presets={[
            { value: '7d', label: '7 j' },
            { value: '30d', label: '30 j' },
            { value: 'month', label: 'Ce mois' },
            { value: 'custom', label: 'Personnalisé' },
          ]}
          activePreset={preset}
          onPreset={setPreset}
          labels={{ from: 'Du', to: 'Au', presets: 'Période' }}
        />
      </FilterGroup>
    </>
  );
  return (
    <Frame wide>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} label="Rechercher" placeholder="Rechercher par nom, SKU, mot-clé…" clearLabel="Effacer" />
        <FilterDropdown label="Catégorie" count={cats.length}>
          <FilterCheckList options={categories} value={cats} onChange={setCats} />
        </FilterDropdown>
        <FilterToggle pressed={low} onPressedChange={setLow} tone="warning">
          ⚠ Stock faible · 2
        </FilterToggle>
        <Button onClick={() => setOpen(true)}>Filtres (3)</Button>
      </div>
      <ActiveFilters
        label="Filtres actifs"
        items={[
          { key: 'cat', label: 'Catégorie : Vêtements, Accessoires', onRemove: () => setCats([]) },
          { key: 'price', label: 'Prix 1 000 – 20 000 DA', onRemove: () => setPrice({ min: '', max: '' }) },
        ]}
        clearLabel="Effacer tout"
        onClear={() => {}}
        removeLabel={(l) => `Retirer ${l}`}
      />
      {panel ? null : <div className="flex max-w-md flex-col gap-5 rounded-card border border-line-edge p-4">{groups}</div>}
      <FilterPanel open={open} onClose={() => setOpen(false)} title="Filtres" summary="3 actifs · 24 résultats · état dans l’URL" resetLabel="Réinitialiser" onReset={() => {}} applyLabel="Afficher 24 produits" closeLabel="Fermer">
        {groups}
      </FilterPanel>
    </Frame>
  );
}
export const Filters: Story = { render: () => <FiltersDemo /> };
export const FilterPanelOpen: Story = { render: () => <FiltersDemo panel /> };

function SheetDemo() {
  const [open, setOpen] = useState(true);
  const [price, setPrice] = useState('4900');
  const [qty, setQty] = useState(1);
  return (
    <Frame>
      <Button onClick={() => setOpen(true)}>Modification rapide</Button>
      <SideSheet
        open={open}
        onClose={() => setOpen(false)}
        title="La Robe satin"
        subtitle="SKU RS · Vêtements · 3 variantes · Actif"
        headerAction={
          <Button variant="ghost" size="sm">
            Fiche complète
          </Button>
        }
        nav={{ onPrev: undefined, onNext: () => {}, prevLabel: 'Précédent', nextLabel: 'Suivant', position: '1 / 20' }}
        status="● Prix modifié · enregistré"
        footer={
          <Button variant="primary" size="sm">
            Ouvrir la fiche
          </Button>
        }
        closeLabel="Fermer"
      >
        <div className="flex flex-col gap-5">
          <SheetSection label="MODIFICATION RAPIDE" note="ENREGISTRÉ À LA PERTE DE FOCUS">
            <Field label="PRIX DE VENTE" htmlFor="qe-price">
              <MoneyInput id="qe-price" value={price} onValueChange={setPrice} />
            </Field>
          </SheetSection>
          <SheetSection label="STOCK PAR VARIANTE" note="AJUSTEMENT = MOUVEMENT TRACÉ">
            <div className="flex items-center justify-between rounded-card border border-line-edge px-3 py-2">
              <span className="text-[14px] font-medium">Noir · M</span>
              <QtyStepper value={qty} onChange={setQty} tone={qty <= 2 ? 'warning' : undefined} labels={{ decrease: 'Retirer 1', increase: 'Ajouter 1', value: 'Stock Noir · M' }} />
            </div>
          </SheetSection>
        </div>
      </SideSheet>
    </Frame>
  );
}
export const Sheet: Story = { render: () => <SheetDemo /> };

function InputsDemo() {
  const [money, setMoney] = useState('12500');
  const [n, setN] = useState('350');
  const [qty, setQty] = useState(6);
  const [cat, setCat] = useState<string | null>('v');
  const [type, setType] = useState<'in' | 'out' | 'set'>('out');
  return (
    <Frame>
      <Field label="PRIX DE VENTE (DA)" htmlFor="m" required>
        <MoneyInput id="m" value={money} onValueChange={setMoney} />
      </Field>
      <Field label="POIDS (G)" htmlFor="n">
        <NumberInput id="n" value={n} onValueChange={setN} suffix="g" />
      </Field>
      <Field label="PRIX" htmlFor="bad" error="Prix de vente requis (> 0)">
        <MoneyInput id="bad" value="" onValueChange={() => {}} aria-invalid />
      </Field>
      <QtyStepper value={qty} onChange={setQty} labels={{ decrease: 'Retirer 1', increase: 'Ajouter 1', value: 'Quantité' }} />
      <QtyStepper value={0} onChange={() => {}} tone="danger" disabledReason="Action non autorisée pour votre rôle (FORBIDDEN)" labels={{ decrease: 'Retirer 1', increase: 'Ajouter 1', value: 'Quantité' }} />
      <Field label="CATÉGORIE" htmlFor="c">
        <Combobox
          id="c"
          value={cat}
          onChange={setCat}
          options={[
            { value: 'v', label: 'Vêtements', hint: '41' },
            { value: 'a', label: 'Accessoires', hint: '27' },
            { value: 'p', label: 'Parfums › Parfums femme' },
          ]}
          placeholder="Choisir…"
          searchPlaceholder="Rechercher une catégorie…"
          emptyLabel="Aucun"
          clearLabel="Sans catégorie"
          footer={
            <button type="button" className="w-full rounded-[6px] px-2.5 py-2 text-start text-[13px] text-accent-inbound">
              + Créer une catégorie…
            </button>
          }
        />
      </Field>
      <RadioCards
        label="Type d’ajustement"
        value={type}
        onChange={setType}
        options={[
          { value: 'in', label: 'Entrée', description: '+ quantité' },
          { value: 'out', label: 'Sortie', description: '− quantité' },
          { value: 'set', label: 'Définir', description: 'valeur exacte' },
        ]}
      />
      <ProgressBar value={42} label="Analyse" />
      <ProgressBar value={null} label="Analyse" />
      <p className="text-[13px]" dir="rtl">
        رقم الهاتف <Ltr>0555 12 34 56</Ltr> · <Ltr>12 500 DA</Ltr>
      </p>
    </Frame>
  );
}
export const Inputs: Story = { render: () => <InputsDemo /> };

const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#1c1c1c"/><circle cx="48" cy="48" r="20" fill="#333"/></svg>');
const IMAGE_LABELS = {
  add: 'AJOUTER',
  primary: 'PRINCIPALE',
  drag: '≡ GLISSER',
  sending: 'ENVOI…',
  makePrimary: 'Définir comme principale',
  remove: 'Supprimer',
  retry: 'Réessayer',
  moveBefore: 'Déplacer avant',
  moveAfter: 'Déplacer après',
  tile: (n: number) => `Image ${n}`,
};
function ImagesDemo() {
  const [tiles, setTiles] = useState<ImageTile[]>([
    { id: 'a', url: IMG, primary: true },
    { id: 'b', url: IMG, warning: 'Image de 480 px : qualité réduite sur Messenger.' },
    { id: 'c', url: IMG, status: 'uploading', progress: 62 },
    { id: 'd', url: IMG, status: 'processing' },
    { id: 'e', url: null, status: 'error', error: 'Image trop lourde (5 Mo max).' },
  ]);
  return (
    <Frame wide>
      <ImageTileGrid
        tiles={tiles}
        max={10}
        accept="image/jpeg,image/png,image/webp"
        labels={IMAGE_LABELS}
        onAdd={(files) => setTiles((t) => [...t, ...files.map((f, i) => ({ id: `n${t.length + i}`, url: URL.createObjectURL(f), status: 'uploading' as const, progress: 10 }))])}
        onRemove={(id) => setTiles((t) => t.filter((x) => x.id !== id))}
        onMakePrimary={(id) => setTiles((t) => t.map((x) => ({ ...x, primary: x.id === id })))}
        onReorder={(ids) => setTiles((t) => ids.map((id) => t.find((x) => x.id === id)!))}
        onRetry={() => {}}
        hint="JPG, PNG, WEBP · 5 Mo max · 800 × 800 px recommandé"
      />
    </Frame>
  );
}
export const Images: Story = { render: () => <ImagesDemo /> };

export const Pills: Story = {
  render: () => (
    <Frame wide>
      {(Object.keys(PILL_TONES) as PillEnum[]).map((k) => (
        <div key={k} className="flex flex-wrap items-center gap-2">
          <span className="w-56 ts-label-meta text-text-muted">{k}</span>
          {Object.keys(PILL_TONES[k]).map((v) => (
            <StatusPill key={v} enumKey={k} value={v}>
              {v}
            </StatusPill>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <ColorPill color="#a78bfa">Vêtements</ColorPill>
        <ColorPill color="#fb923c">Parfums</ColorPill>
      </div>
    </Frame>
  ),
};

export const ProgressToast: Story = {
  render: () => (
    <Frame>
      <Button
        onClick={() => {
          const id = toast({ tone: 'info', message: 'Export des produits : 0 % (0 lignes)', progress: 0, durationMs: 0 });
          let pct = 0;
          const timer = window.setInterval(() => {
            pct += 20;
            if (pct >= 100) {
              window.clearInterval(timer);
              updateToast(id, { tone: 'success', message: 'Export terminé · produits.xlsx', progress: undefined, durationMs: 8000, action: { label: 'Télécharger', onClick: () => {} } });
            } else updateToast(id, { message: `Export des produits : ${pct} % (${pct * 2} lignes)`, progress: pct });
          }, 500);
        }}
      >
        Exporter
      </Button>
      <ToastRegion label="Notifications" closeLabel="Fermer" />
    </Frame>
  ),
};
