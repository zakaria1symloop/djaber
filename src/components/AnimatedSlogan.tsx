'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';

const SLOGAN_COUNT = 4;
const TYPE_SPEED_MS = 45;
const ERASE_SPEED_MS = 25;
const HOLD_MS = 2200;

export default function AnimatedSlogan() {
  const { t, lang } = useTranslation();
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'erasing'>('typing');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slogans = Array.from({ length: SLOGAN_COUNT }, (_, i) => t(`home.slogan.${i}`));
  const current = slogans[index] || '';

  // Reset when language changes
  useEffect(() => {
    setIndex(0);
    setDisplayed('');
    setPhase('typing');
  }, [lang]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (phase === 'typing') {
      if (displayed.length < current.length) {
        timeoutRef.current = setTimeout(() => {
          setDisplayed(current.slice(0, displayed.length + 1));
        }, TYPE_SPEED_MS);
      } else {
        setPhase('holding');
      }
    } else if (phase === 'holding') {
      timeoutRef.current = setTimeout(() => setPhase('erasing'), HOLD_MS);
    } else if (phase === 'erasing') {
      if (displayed.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setDisplayed(current.slice(0, displayed.length - 1));
        }, ERASE_SPEED_MS);
      } else {
        setIndex((i) => (i + 1) % SLOGAN_COUNT);
        setPhase('typing');
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, displayed, current]);

  return (
    <div className="relative inline-flex items-baseline min-h-[1.5em]">
      <span className="gradient-text font-bold">
        {displayed || '\u00A0'}
      </span>
      <span className="inline-block w-[2px] h-[1em] ms-1 bg-[#00fff0] animate-pulse self-center" />
    </div>
  );
}
