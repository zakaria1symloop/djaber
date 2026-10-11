'use client';
// Localized document title of a page ("Catégories · Djaber.ai"). The static metadata title of the locale layout is the
// same in every language and is re-streamed by Next on navigations and refreshes: for a moment the document has no
// <title> at all (axe `document-title`). The page owns its title instead, and puts it back whenever the head changes.
import { useEffect } from 'react';

export const APP_NAME = 'Djaber.ai';
export const documentTitle = (title: string | null | undefined): string => (title?.trim() ? `${title.trim()} · ${APP_NAME}` : APP_NAME);

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const full = documentTitle(title);
    const apply = () => {
      if (document.title !== full) document.title = full;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
