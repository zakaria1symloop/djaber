'use client';
// Layout pass (M11): every text cut by `truncate` / `line-clamp` shows its full value in a native tooltip. One
// delegated listener for the whole shell instead of a `title` on each of the ~80 truncating spots: when the pointer
// enters an element whose text is actually cut (and that has no tooltip of its own), its `title` is set to the text;
// it is refreshed on every hover and removed once the text fits again (resize, shorter value).
import { useEffect } from 'react';

const MAX_DEPTH = 4;

/** The ellipsis box under the pointer (the target or one of its 3 closest ancestors), or null. */
export function truncatedBox(target: Element | null): HTMLElement | null {
  // text nodes / SVG parts: start from the closest HTML element
  let el = (target && 'dataset' in target ? target : (target?.parentElement ?? null)) as HTMLElement | null;
  for (let i = 0; el && i < MAX_DEPTH; i++, el = el.parentElement) {
    const s = getComputedStyle(el);
    const clamp = s.getPropertyValue('-webkit-line-clamp');
    if (s.textOverflow === 'ellipsis' || (clamp && clamp !== 'none')) return el;
  }
  return null;
}

/** `truncate` cuts on the inline axis, `line-clamp` on the block axis (Arabic glyphs overflow a single line box by a
 * few pixels vertically without anything being hidden: the block axis is only checked for clamped boxes). */
export function isCut(el: HTMLElement): boolean {
  const clamp = getComputedStyle(el).getPropertyValue('-webkit-line-clamp');
  if (clamp && clamp !== 'none') return el.scrollHeight - el.clientHeight > 2;
  return el.scrollWidth - el.clientWidth > 1;
}

/** Sets / refreshes / removes the automatic tooltip of the truncated box under `target`. */
export function syncAutoTitle(target: Element | null) {
  const el = truncatedBox(target);
  if (!el) return;
  const auto = el.dataset.autoTitle === '1';
  // a tooltip written by the page (or an accessible title of a control) wins
  if (!auto && el.hasAttribute('title')) return;
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text && isCut(el)) {
    el.setAttribute('title', text);
    el.dataset.autoTitle = '1';
  } else if (auto) {
    el.removeAttribute('title');
    delete el.dataset.autoTitle;
  }
}

export function useAutoTitles() {
  useEffect(() => {
    const onOver = (e: Event) => syncAutoTitle(e.target as Element | null);
    document.addEventListener('pointerover', onOver, { passive: true });
    document.documentElement.dataset.autoTitles = '1';
    return () => {
      document.removeEventListener('pointerover', onOver);
      delete document.documentElement.dataset.autoTitles;
    };
  }, []);
}
