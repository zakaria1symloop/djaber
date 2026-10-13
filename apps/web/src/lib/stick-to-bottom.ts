'use client';
// Message threads that scroll inside their own box (support tickets): open on the latest message and follow new ones by
// moving the box's scrollTop only — never `scrollIntoView`, which also scrolls the page around it (M11 layout pass).
// A reader who scrolled up to read an older message is left where they are until `follow()` (after their own send).
import { useCallback, useLayoutEffect, useRef } from 'react';

export function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [dep]);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);
  /** the next change of `dep` scrolls to the bottom again (the user's own reply) */
  const follow = useCallback(() => {
    stick.current = true;
  }, []);
  return { ref, onScroll, follow };
}
