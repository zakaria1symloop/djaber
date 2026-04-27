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
    <span className="font-medium" style={{ color: 'var(--paper)', letterSpacing: '-0.01em' }}>
      {displayed || '\u00A0'}
      <span
        className="caret inline-block ms-[0.06em] align-baseline"
        style={{
          width: '0.5ch',
          height: '0.95em',
          background: 'var(--live)',
          transform: 'translateY(0.08em)',
        }}
      />
    </span>
  );
}
