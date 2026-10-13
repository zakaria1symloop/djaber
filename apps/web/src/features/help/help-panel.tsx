'use client';
// "?" in the top bar (HELP-01, 12 §25 "'?' contextual panel"): side panel with the guides of the current page
// (`GET /help/articles?context=<route key>`), "Tous les guides" and "Contacter le support" (page of origin carried in
// `?from=`). Also mounts the guide reader (`?article=`) used by every help link of the app.
import { IconButton, SideSheet, Skeleton, buttonClass } from '@djaber/ui';
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';
import { useHelpArticles } from './api';
import { ArticleSheet, useArticleParam } from './article-sheet';
import { contextKey } from './logic';

export function HelpPanelButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={t('help.panel.open')} variant="ghost" onClick={() => setOpen(true)} data-testid="help-panel-open">
        <HelpCircle className="size-4" aria-hidden />
      </IconButton>
      <HelpPanel open={open} onClose={() => setOpen(false)} />
      <ArticleSheet />
    </>
  );
}

function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const context = contextKey(pathname);
  const q = useHelpArticles({ context }, { enabled: open });
  const article = useArticleParam();
  const guides = q.data ?? [];
  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={t('help.panel.title')}
      subtitle={t('help.panel.subtitle')}
      closeLabel={t('action.close')}
      footer={
        <>
          <Link href="/help" className={buttonClass({ variant: 'ghost', size: 'sm' })} onClick={onClose}>
            {t('help.panel.all')}
          </Link>
          <Link href={`/help/contact?from=${encodeURIComponent(pathname)}`} className={buttonClass({ variant: 'primary', size: 'sm' })} onClick={onClose}>
            {t('help.contact.title')}
          </Link>
        </>
      }
    >
      <div data-testid="help-panel" data-context={context}>
        {q.isPending ? (
          <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : q.isError ? (
          <p className="ts-label-meta text-text-muted">{t('help.panel.error')}</p>
        ) : guides.length === 0 ? (
          <p className="ts-label-meta text-text-muted" data-testid="help-panel-empty">
            {t('help.panel.empty')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-hairline rounded-card border border-line-edge">
            {guides.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  data-testid="help-panel-guide"
                  onClick={() => {
                    onClose();
                    article.open(g.key);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-start hover:bg-ink-raised"
                >
                  <span className="text-[14px] text-text-primary">{g.title}</span>
                  {g.excerpt ? <span className="line-clamp-2 ts-label-micro text-text-muted">{g.excerpt}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SideSheet>
  );
}
