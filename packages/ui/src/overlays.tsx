'use client';
// Dialog, dropdown ("Actions ⌄"), toasts, tabs, tooltip — Radix primitives restyled to the Djaber system.
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ChevronDown, X } from 'lucide-react';
import * as React from 'react';
import { Button, cn, toneDot, type Tone } from './primitives';

/* ---------- Dialog ---------- */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <DialogPrimitive.Content
          className={cn(
            'fixed start-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] -translate-y-1/2 overflow-y-auto rounded-card border border-line-edge bg-ink-surface p-5',
            'ltr:-translate-x-1/2 rtl:translate-x-1/2',
            size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="ts-title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label={closeLabel} className="text-text-muted hover:text-text-primary">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="ts-label-meta mt-2 text-text-muted">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Confirmation dialog ("Quitter sans enregistrer ?", destructive confirmations). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
  loading,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
  closeLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={closeLabel}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/* ---------- Actions ⌄ dropdown (one per row, items driven by the server `actions` array) ---------- */
export type MenuAction = {
  key: string;
  label: string;
  onSelect?: () => void;
  primary?: boolean;
  destructive?: boolean;
  /** translated reason; the item is greyed and the reason is listed in the footer */
  disabledReason?: string;
};
export function ActionsMenu({ label, actions, size = 'sm', align = 'end' }: { label: string; actions: MenuAction[]; size?: 'sm' | 'md'; align?: 'start' | 'end' }) {
  const disabled = actions.filter((a) => a.disabledReason);
  if (!actions.length) return null;
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button size={size} variant="secondary" onClick={(e) => e.stopPropagation()}>
          {label}
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-48 max-w-72 rounded-card border border-line-edge bg-ink-raised p-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <Dropdown.Item
              key={a.key}
              disabled={!!a.disabledReason}
              onSelect={a.onSelect}
              className={cn(
                'flex cursor-pointer items-center rounded-[6px] px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-ink-raised-high',
                a.primary && 'font-medium text-text-primary',
                a.destructive && 'text-accent-alert',
                a.disabledReason && 'cursor-not-allowed opacity-45',
              )}
            >
              {a.label}
            </Dropdown.Item>
          ))}
          {disabled.length ? (
            <div className="mt-1 border-t border-line-hairline px-2.5 py-2 ts-label-meta text-text-muted">
              {disabled.map((a) => (
                <div key={a.key}>
                  {a.label} : {a.disabledReason}
                </div>
              ))}
            </div>
          ) : null}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/** Generic menu (user menu, workspace switcher). */
export function Menu({ trigger, children, align = 'end' }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align={align} sideOffset={6} className="z-50 min-w-52 rounded-card border border-line-edge bg-ink-raised p-1 shadow-xl">
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function MenuItem({ className, ...rest }: React.ComponentProps<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn('flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-ink-raised-high', className)}
      {...rest}
    />
  );
}
export const MenuSeparator = () => <Dropdown.Separator className="my-1 h-px bg-line-hairline" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => (
  <Dropdown.Label className="px-2.5 py-1.5 ts-label-micro text-text-muted">{children}</Dropdown.Label>
);

/* ---------- Tabs ---------- */
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...rest }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 overflow-x-auto border-b border-line-hairline', className)} {...rest} />;
}
export function TabsTrigger({ className, ...rest }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] text-text-secondary hover:text-text-primary',
        'data-[state=active]:border-white data-[state=active]:text-text-primary',
        className,
      )}
      {...rest}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;

/* ---------- Tooltip ---------- */
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-50 max-w-64 rounded-[6px] border border-line-edge bg-ink-raised-high px-2 py-1.5 text-[12px]">
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/* ---------- Toasts: bottom-end, max 3, 5 s, optional action (GLOBAL frame) ---------- */
export type ToastInput = { tone?: Tone; message: string; action?: { label: string; onClick: () => void }; durationMs?: number };
type ToastItem = ToastInput & { id: number };
let toasts: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const toast = (t: ToastInput | string) => {
  const item: ToastItem = { id: ++seq, tone: 'success', ...(typeof t === 'string' ? { message: t } : t) };
  toasts = [...toasts, item].slice(-3);
  emit();
  if (typeof window !== 'undefined') window.setTimeout(() => dismissToast(item.id), item.durationMs ?? 5000);
  return item.id;
};
export const dismissToast = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const EMPTY: ToastItem[] = [];

export function ToastRegion({ label, closeLabel }: { label: string; closeLabel: string }) {
  const items = React.useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
  return (
    <div role="region" aria-label={label} aria-live="polite" className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-card border border-line-edge bg-ink-raised px-3 py-2.5 text-[13px] shadow-xl">
          <span className={cn('size-2 shrink-0 rounded-full', toneDot[t.tone ?? 'success'])} />
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="ts-label-meta text-accent-inbound hover:underline"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          ) : null}
          <button type="button" aria-label={closeLabel} className="text-text-muted hover:text-text-primary" onClick={() => dismissToast(t.id)}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
