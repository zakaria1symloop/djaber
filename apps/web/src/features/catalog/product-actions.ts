// The `Actions ⌄` menu of a product (list row, services row, product page) — Figma "CAT-08 — Products — bulk bar +
// row actions menu". Business actions come from the server descriptors (`open`, `edit`, `duplicate`, `adjust_stock`,
// `deactivate` / `activate`, `archive`, `restore`, `delete`); navigation items (quick edit, variants, movements,
// Messenger card, "Ajouter à un agent") are added by the screen. Items whose target belongs
// to a later milestone (orders, recommendations of this product) are not offered yet.
import type { MenuAction } from '@djaber/ui';
import { toMenuActions, type ActionHandler } from '@/lib/actions';
import type { TFunction } from '@/lib/i18n';
import type { ProductListItem } from './contracts';

export type ProductActionHandlers = {
  open?: () => void;
  quickEdit?: () => void;
  edit?: () => void;
  adjustStock?: () => void;
  variants?: () => void;
  movements?: () => void;
  duplicate?: () => void;
  cardPreview?: () => void;
  addToAgent?: () => void;
  toggleActive?: () => void;
  exportOne?: () => void;
  archive?: () => void;
  restore?: () => void;
  remove?: () => void;
};

export function productMenuActions(
  product: Pick<ProductListItem, 'actions' | 'hasVariants' | 'trackStock' | 'archived'>,
  h: ProductActionHandlers,
  o: { t: TFunction; advanced: boolean; canWrite: boolean },
): MenuAction[] {
  const { t } = o;
  const item = (fn: (() => void) | undefined, rest: Omit<ActionHandler, 'onSelect'>): ActionHandler => ({ ...rest, onSelect: fn ?? (() => {}), hidden: rest.hidden || !fn });
  const live = !product.archived;
  const handlers: Record<string, ActionHandler> = {
    open: item(h.open, { label: t('products.action.open'), hint: t('products.action.open.hint') }),
    quick_edit: item(h.quickEdit, { label: t('products.action.quickEdit'), hint: t('products.action.quickEdit.hint'), local: true, hidden: !live || !o.canWrite }),
    edit: item(h.edit, { label: t('action.edit'), hint: t('products.action.edit.hint') }),
    adjust_stock: item(h.adjustStock, { label: t('action.adjustStock'), hint: t('products.action.dialog') }),
    variants: item(h.variants, { label: t('products.action.variants'), hint: t('products.action.variants.hint'), local: true, hidden: !live || !product.hasVariants || !o.canWrite }),
    movements: item(h.movements, { label: t('products.action.movements'), hint: t('products.action.movements.hint'), local: true, separated: true, hidden: !o.advanced || !product.trackStock }),
    duplicate: item(h.duplicate, { label: t('action.duplicate'), hint: t('products.action.duplicate.hint'), separated: true }),
    card_preview: item(h.cardPreview, { label: t('products.action.cardPreview'), hint: t('products.action.cardPreview.hint'), local: true, hidden: !live }),
    add_to_agent: item(h.addToAgent, { label: t('action.addToAgent'), hint: t('products.action.dialog'), local: true, hidden: !live || !o.canWrite }),
    export: item(h.exportOne, { label: t('action.export'), local: true, hidden: !o.canWrite }),
    deactivate: item(h.toggleActive, { label: t('action.disable') }),
    activate: item(h.toggleActive, { label: t('action.enable') }),
    archive: item(h.archive, { label: t('action.archive'), hint: t('products.action.confirm'), destructive: true, separated: true }),
    restore: item(h.restore, { label: t('action.restore'), hint: t('products.action.dialog') }),
    delete: item(h.remove, { label: t('action.delete'), hint: t('products.action.confirm'), destructive: true }),
  };
  return toMenuActions(product.actions, handlers, t);
}
