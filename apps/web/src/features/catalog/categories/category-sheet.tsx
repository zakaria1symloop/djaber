'use client';
// Create / edit sheet of a category — Figma "CAT-04 — Categories & units — list + edit sheet + reassign dialog"
// (MODIFIER · VÊTEMENTS) and DLG GDS I "Nouvelle catégorie": NOM * (unique), PARENT (2 levels max), DESCRIPTION, COULEUR,
// + IMAGE (M11, upload kind `category_image`, square crop, ≤ 5 MB — the API stores it at 512 px).
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateCategorySchema, UpdateCategorySchema } from '@djaber/shared';
import { Button, cn, Field, FormAlert, Input, Select, SideSheet, Textarea, toast } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { LeaveGuardDialog } from '@/components/global-states';
import { useImageUpload } from '@/features/settings/common';
import { applyServerErrors, fieldError, useLeaveGuard } from '@/lib/forms';
import { useT } from '@/lib/i18n';
import { catalogApi, useCatalogRefresh } from '../api';
import type { Category } from '../contracts';
import { canHaveParent, CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, parentOptions } from './logic';

type Values = { name: string; parentId: string; description: string; color: string };
const FIELDS = ['name', 'parentId', 'description', 'color'] as const;

export function CategorySheet({
  category,
  presetParentId,
  tree,
  onClose,
}: {
  /** null = new category */
  category: Category | null;
  presetParentId?: string | null;
  tree: readonly Category[];
  onClose: () => void;
}) {
  const t = useT();
  const refresh = useCatalogRefresh();
  const form = useForm<Values>({
    resolver: zodResolver(CreateCategorySchema) as unknown as Resolver<Values>,
    defaultValues: {
      name: category?.name ?? '',
      parentId: category?.parentId ?? presetParentId ?? '',
      description: category?.description ?? '',
      color: category?.color ?? DEFAULT_CATEGORY_COLOR,
    },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  // M11 (M2 carry-over): category image — `undefined` = unchanged, an upload id = new image, null = removed
  const [image, setImage] = useState<{ uploadId: string | null; url: string | null } | undefined>(undefined);
  const imageUpload = useImageUpload('category_image', (uploadId, up) => setImage({ uploadId, url: up.url }));
  const imageUrl = image === undefined ? (category?.imageUrl ?? null) : image.url;
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, ...(image !== undefined ? { imageUploadId: image.uploadId } : {}) };
      return category ? catalogApi.updateCategory(category.id, UpdateCategorySchema.parse(body)) : catalogApi.createCategory(CreateCategorySchema.parse(body));
    },
  });
  const dirty = form.formState.isDirty || image !== undefined;
  const { guard } = useLeaveGuard(dirty, category?.name ?? t('dialog.newCategory.title'));
  const busy = save.isPending;
  const errors = form.formState.errors;
  const parents = parentOptions(tree, category?.id ?? null);
  const parentAllowed = canHaveParent(category);
  const color = form.watch('color');
  const swatches = CATEGORY_COLORS.some((c) => c.hex.toLowerCase() === color.toLowerCase()) ? CATEGORY_COLORS : [...CATEGORY_COLORS, { key: 'current' as const, hex: color }];

  const submit = form.handleSubmit(
    async (values) => {
      setFormError(null);
      try {
        const saved = await save.mutateAsync(values);
        await refresh({ taxonomies: true });
        toast(category ? t('toast.saved') : t('categories.created', { name: saved.name }));
        onClose();
      } catch (e) {
        setFormError(applyServerErrors(form, e, t, { fields: FIELDS, codeToField: { CATEGORY_ALREADY_EXISTS: 'name', CATEGORY_DEPTH_EXCEEDED: 'parentId' } }));
        const first = FIELDS.find((f) => f !== 'color' && form.getFieldState(f).error);
        if (first) form.setFocus(first);
      }
    },
    () => setFormError(null),
  );
  const close = () => (busy ? undefined : dirty ? setConfirmClose(true) : onClose());

  return (
    <>
      <SideSheet
        open
        onClose={close}
        title={category ? t('categories.sheet.editTitle', { name: category.name }) : t('dialog.newCategory.title')}
        closeLabel={t('action.close')}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void submit()} loading={busy} data-testid="category-save">
              {category ? t('action.save') : t('action.create')}
            </Button>
          </>
        }
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} data-testid="category-form">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <Field label={t('common.name')} htmlFor="category-name" required hint={t('categories.field.nameHint')} error={fieldError(t, errors.name?.message, { max: 80 })}>
            <Input id="category-name" maxLength={80} disabled={busy} aria-invalid={!!errors.name} autoFocus {...form.register('name')} />
          </Field>
          <Field
            label={t('categories.field.parent')}
            htmlFor="category-parent"
            hint={parentAllowed ? t('categories.field.parentHint') : t('categories.field.parentLocked')}
            error={fieldError(t, errors.parentId?.message)}
          >
            <Select id="category-parent" disabled={busy || !parentAllowed} aria-invalid={!!errors.parentId} {...form.register('parentId')}>
              <option value="">{t('categories.field.parentNone')}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('categories.field.description')} htmlFor="category-description" error={fieldError(t, errors.description?.message, { max: 500 })}>
            <Textarea id="category-description" rows={3} maxLength={500} disabled={busy} aria-invalid={!!errors.description} {...form.register('description')} />
          </Field>
          <div className="flex flex-col gap-2" data-testid="category-image">
            <span className="ts-label-meta uppercase text-text-secondary">{t('carry.categories.image')}</span>
            <div className="flex flex-wrap items-center gap-3">
              {imageUrl ? (
                <img src={imageUrl} alt={t('carry.categories.image')} className="size-16 rounded-card border border-line-edge object-cover" data-testid="category-image-preview" />
              ) : (
                <span aria-hidden className="flex size-16 items-center justify-center rounded-card border border-dashed border-line-edge text-text-muted">
                  <ImageIcon className="size-5" />
                </span>
              )}
              {imageUpload.input}
              <Button size="sm" onClick={imageUpload.open} loading={imageUpload.uploading} disabled={busy} data-testid="category-image-upload">
                {imageUpload.uploading ? t('settings.upload.uploading') : imageUrl ? t('carry.categories.imageChange') : t('carry.categories.imageAdd')}
              </Button>
              {imageUrl ? (
                <Button size="sm" variant="ghost" onClick={() => setImage({ uploadId: null, url: null })} disabled={busy} data-testid="category-image-remove">
                  {t('action.remove')}
                </Button>
              ) : null}
            </div>
            <span className="ts-label-meta text-text-muted">{t('settings.upload.hint')}</span>
            {imageUpload.error ? <FormAlert>{imageUpload.error}</FormAlert> : null}
          </div>
          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="ts-label-meta mb-2 uppercase text-text-secondary">{t('categories.field.color')}</legend>
            <div role="radiogroup" aria-label={t('categories.field.color')} className="flex flex-wrap gap-2.5">
              {swatches.map((c) => {
                const on = c.hex.toLowerCase() === color.toLowerCase();
                return (
                  <label key={c.hex} className="relative cursor-pointer" data-color={c.hex}>
                    <input type="radio" className="peer sr-only" value={c.hex} checked={on} onChange={() => form.setValue('color', c.hex, { shouldDirty: true })} name="category-color" aria-label={t(`categories.color.${c.key}`)} />
                    <span
                      aria-hidden
                      style={{ backgroundColor: c.hex }}
                      className={cn('block size-6 rounded-full border-2 border-transparent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-inbound', on && 'border-white')}
                    />
                  </label>
                );
              })}
            </div>
            {errors.color ? (
              <p role="alert" className="text-[12px] text-accent-alert">
                {fieldError(t, errors.color.message)}
              </p>
            ) : null}
          </fieldset>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
            {t('action.save')}
          </button>
        </form>
      </SideSheet>
      {guard}
      <LeaveGuardDialog
        open={confirmClose}
        name={category?.name ?? t('dialog.newCategory.title')}
        onStay={() => setConfirmClose(false)}
        onLeave={() => {
          setConfirmClose(false);
          onClose();
        }}
      />
    </>
  );
}
