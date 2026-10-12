'use client';
// Sound on a new customer message (`User.prefs.soundOnMessage`, Settings › Notifications — carry-over M3 → M5): a short
// two-tone chime synthesised with WebAudio (no audio file), on WS `message.created` of an inbound message only, at most
// once every 1.5 s (a burst of messages rings once). Browsers refuse audio before a first user gesture: the chime is
// then silently skipped.
import { useRef } from 'react';
import { useSession } from '@/lib/session';
import { useWsEvent } from '@/lib/ws';

export const SOUND_MIN_GAP_MS = 1_500;

/** Whether a `message.created` event rings: the preference is on, the message comes from the customer, not too soon. */
export const shouldRing = (o: { enabled: boolean; direction: string | null | undefined; lastAt: number; now: number }): boolean =>
  o.enabled && o.direction === 'in' && o.now - o.lastAt >= SOUND_MIN_GAP_MS;

let ctx: AudioContext | null = null;
export function playChime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t0 = start + i * 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    });
  } catch {
    // no audio device / autoplay refused: nothing to do
  }
}

/** Mounted once in the shell. */
export function useMessageSound() {
  const { me } = useSession();
  const enabled = me?.prefs?.soundOnMessage === true;
  const last = useRef(0);
  useWsEvent<{ message?: { direction?: string } }>('message.created', (p) => {
    const now = Date.now();
    if (!shouldRing({ enabled, direction: p?.message?.direction, lastAt: last.current, now })) return;
    last.current = now;
    playChime();
  });
}
