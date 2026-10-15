'use client';
// Product expenses & margins (GDS-09, EXP-01/02, M2 carry-over) — the list under "Prix & marge" of the product page
// (advanced mode) + DLG GDS II "Dépense produit (mode avancé)": category, amount, "Par unité vendue" / "Fixe (répartie
// sur les ventes de la période)", note, live preview "Nouvelle marge estimée 46,7 % → 44,0 % (coût unitaire 2 400 →
// 2 520)". `GET|POST /products/:id/expenses`, `PATCH|DELETE /products/:id/expenses/:eid` (catalog.write).
import { EXPENSE_CATEGORIES, formatMoney, formatNumber } from '@djaber/shared';
import { ActionsMenu, Button, ConfirmDialog, Dialog, Field, FormAlert, Input, Ltr, MoneyInput, Select, toast } from '@djaber/ui';
import { useState } from 'react';
import { useCloseGuard, useTypedFlag } from '@/components/close-guard';
import { DialogFooter, RadioList, refusal, useDialogSubmit, useOnOpen } from '@/features/orders/dialogs/common';
import { toMenuActions } from '@/lib/actions';
import { useLocaleCode, useT } from '@/lib/i18n';
import { digitsToInt, moneyDigits } from '@/lib/money';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/lib/session';
import { gdsApi, gdsKeys, useProductExpenses, type ProductExpense } from './api';
import { marginPreview } from './logic';

type Pricing = { weightedCost: number | null; expensesPerUnit: number; sales30d?: { units: number } | null } | null | undefined;

export function ExpensesEditor({ productId, price, pricing, canEdit }: { productId: string; price: number; pricing: Pricing; canEdit: boolean }) {
  const t = useT();
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const q = useProductExpenses(productId);
  const [edit, setEdit] = useState<ProductExpense | 'new' | null>(null);
  const [del, setDel] = useState<ProductExpense | null>(null);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: gdsKeys.expenses(ws, productId) }), qc.invalidateQueries({ queryKey: [ws, 'product', productId] })]);
  const rows = q.data ?? [];
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line-hairline pt-3" data-testid="expenses-editor">
      <div className="flex items-center justify-between gap-2">
        <span className="ts-label-micro text-text-muted">{t('expenses.title')}</span>
        {canEdit ? (
          <Button size="sm" variant="ghost" onClick={() => setEdit('new')} data-testid="expense-add">
            {t('expenses.add')}
          </Button>
        ) : null}
      </div>
      {q.isPending ? null : rows.length ? (
        <ul className="flex flex-col gap-1.5" data-testid="expenses-list">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[13px]" data-expense={e.id}>
              <span className="min-w-0 flex-1 truncate">
                {t(`enum.ProductExpense.category.${e.category}`)}
                {e.description ? <span className="text-text-muted"> · {e.description}</span> : null}
              </span>
              <span className="ts-label-micro text-text-muted">{t(e.isPerUnit ? 'expenses.perUnitShort' : 'expenses.fixedShort')}</span>
              <Ltr className="tabular-nums">{formatMoney(e.amount)}</Ltr>
              <ActionsMenu
                label={t('action.actions')}
                iconOnly
                variant="ghost"
                actions={toMenuActions(e.actions, { edit: { label: t('action.edit'), onSelect: () => setEdit(e), hidden: !canEdit }, delete: { label: t('action.delete'), destructive: true, onSelect: () => setDel(e), hidden: !canEdit } }, t)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="ts-label-meta text-text-muted">{t('expenses.empty')}</p>
      )}
      <ExpenseDialog productId={productId} expense={edit} price={price} pricing={pricing} onClose={() => setEdit(null)} onDone={refresh} />
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={t('expenses.delete.title')}
        description={del ? `${t(`enum.ProductExpense.category.${del.category}`)} · ${formatMoney(del.amount)}` : undefined}
        confirmLabel={t('action.delete')}
        cancelLabel={t('action.cancel')}
        destructive
        closeLabel={t('action.close')}
        onConfirm={() =>
          void (async () => {
            if (!del) return;
            try {
              await gdsApi.deleteExpense(productId, del.id);
              await refresh();
              toast(t('expenses.deleted'));
            } catch (e) {
              toast({ tone: 'danger', message: refusal(e, t) });
            } finally {
              setDel(null);
            }
          })()
        }
      />
    </div>
  );
}

function ExpenseDialog({ productId, expense, price, pricing, onClose, onDone }: { productId: string; expense: ProductExpense | 'new' | null; price: number; pricing: Pricing; onClose: () => void; onDone: () => Promise<unknown> }) {
  const t = useT();
  const locale = useLocaleCode();
  const editing = expense && expense !== 'new' ? expense : null;
  const typed = useTypedFlag(!!expense);
  const [category, setCategory] = useState<ProductExpense['category']>('packaging');
  const [amount, setAmount] = useState('');
  const [perUnit, setPerUnit] = useState<'unit' | 'fixed'>('unit');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useOnOpen(!!expense, () => {
    setCategory(editing?.category ?? 'packaging');
    setAmount(editing ? moneyDigits(editing.amount) : '');
    setPerUnit(editing && !editing.isPerUnit ? 'fixed' : 'unit');
    setNote(editing?.description ?? '');
    setTouched(false);
  });
  const value = digitsToInt(amount) ?? 0;
  // an edited expense is first taken out of the current per-unit expenses, then added back with its new values
  const base = (pricing?.expensesPerUnit ?? 0) - (editing ? (editing.isPerUnit ? editing.amount : Math.floor(editing.amount / Math.max(pricing?.sales30d?.units ?? 0, 1) + 0.5)) : 0);
  const preview = marginPreview({ price, weightedCost: pricing?.weightedCost ?? null, expensesPerUnit: Math.max(0, base), unitsSold: pricing?.sales30d?.units ?? 0, amount: value, isPerUnit: perUnit === 'unit' });
  const body = { category, amount: value, isPerUnit: perUnit === 'unit', description: note.trim() || null };
  const s = useDialogSubmit(() => (editing ? gdsApi.updateExpense(productId, editing.id, body) : gdsApi.createExpense(productId, body)));
  const submit = async () => {
    setTouched(true);
    if (!value) return;
    const r = await s.submit();
    if (!r) return;
    toast(t(editing ? 'expenses.saved' : 'expenses.created'));
    await onDone();
    onClose();
  };
  // decimal separator of the interface language (Latin digits everywhere)
  const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1).replace('.', locale === 'en' ? '.' : ',')} %`);
  const guard = useCloseGuard(typed.dirty, t('expenses.dialog.title'), onClose);
  return (
    <>
    <Dialog
      open={!!expense}
      onOpenChange={(o) => !o && !s.busy && guard.requestClose()}
      title={t('expenses.dialog.title')}
      description={t('expenses.dialog.context', { margin: pct(preview.before) })}
      closeLabel={t('action.close')}
      size="md"
      footer={<DialogFooter onClose={guard.requestClose} busy={s.busy} onSubmit={() => void submit()} label={editing ? t('action.save') : t('action.add')} />}
    >
      <div className="flex flex-col gap-4" data-testid="expense-dialog" onChange={typed.onChange}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('expenses.dialog.category')} htmlFor="exp-category" hint={t('expenses.dialog.categoryHint')}>
            <Select id="exp-category" value={category} onChange={(e) => setCategory(e.target.value as ProductExpense['category'])}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`enum.ProductExpense.category.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('gds.amount')} htmlFor="exp-amount" required error={touched && !value ? t('validation.required') : s.fieldError('amount')}>
            <MoneyInput id="exp-amount" value={amount} onValueChange={setAmount} />
          </Field>
        </div>
        <RadioList<'unit' | 'fixed'>
          label={t('expenses.dialog.mode')}
          value={perUnit}
          onChange={setPerUnit}
          options={[
            { value: 'unit', label: t('expenses.dialog.perUnit') },
            { value: 'fixed', label: t('expenses.dialog.fixed') },
          ]}
        />
        <Field label={t('common.note')} htmlFor="exp-note">
          <Input id="exp-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={t('expenses.dialog.notePlaceholder')} />
        </Field>
        <p className="rounded-[6px] bg-ink-raised px-3 py-2 ts-label-meta !normal-case text-text-secondary" data-testid="expense-preview">
          {preview.before === null
            ? t('expenses.dialog.previewNoCost')
            : t('expenses.dialog.preview', { before: pct(preview.before), after: pct(preview.after), costBefore: formatNumber(preview.trueCostBefore ?? 0), costAfter: formatNumber(preview.trueCostAfter ?? 0) })}
        </p>
        {s.error ? <FormAlert>{s.error}</FormAlert> : null}
      </div>
    </Dialog>
    {guard.element}
    </>
  );
}
