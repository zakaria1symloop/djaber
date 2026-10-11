'use client';
// Building blocks of the Settings pages (Figma "SET — Settings — …"): page frame with permission gate, section card, image upload.
import { roleCan, type MerchantPermission } from '@djaber/shared';
import { Card, cn, PageHeader } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type ReactNode } from 'react';
import { Page403 } from '@/components/global-states';
import { workspaceApi } from '@/features/workspace/api';
import { errorMessage } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { checkImage, IMAGE_TYPES } from './image';

/**
 * Page frame: title, description, actions. A role without the permission gets the 403 state (the API also refuses).
 * Read-only members (plan limit) keep the page; its controls are disabled through `useCan`.
 */
export function SettingsPage({
  title,
  description,
  actions,
  permission,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  permission?: MerchantPermission;
  children: ReactNode;
}) {
  const t = useT();
  const locale = useLocaleCode();
  const { role } = useSession();
  if (permission && !roleCan(role, permission)) return <Page403 role={role ? t(`enum.Membership.role.${role}`) : '—'} homeHref={`/${locale}/home`} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export function Section({ title, description, children, className, tone }: { title?: string; description?: string; children: ReactNode; className?: string; tone?: 'danger' }) {
  return (
    <Card className={cn('p-5', tone === 'danger' && 'border-accent-alert/40', className)}>
      {title ? <h2 className="ts-display-s">{title}</h2> : null}
      {description ? <p className="ts-body mt-2 text-text-secondary">{description}</p> : null}
      <div className={cn((title || description) && 'mt-4')}>{children}</div>
    </Card>
  );
}

/** Hidden file input + upload (`POST /uploads`): returns the upload id to attach with a PATCH. */
export function useImageUpload(kind: 'avatar' | 'logo', onUploaded: (uploadId: string) => Promise<unknown>) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const up = await workspaceApi.upload(file, kind);
      await onUploaded(up.id);
    },
  });
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const bad = checkImage(file);
    if (bad) return setError(t(`error.${bad}`));
    try {
      await upload.mutateAsync(file);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };
  const input = (
    <input
      ref={ref}
      type="file"
      accept={IMAGE_TYPES.join(',')}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      data-upload={kind}
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );
  return { input, open: () => ref.current?.click(), uploading: upload.isPending, error, clearError: () => setError(null) };
}
