import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncAutoTitle, truncatedBox } from './auto-title';

type Fake = {
  dataset: Record<string, string>;
  parentElement: Fake | null;
  textContent: string;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  style: { textOverflow?: string; clamp?: string };
  attrs: Record<string, string>;
  hasAttribute: (k: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  removeAttribute: (k: string) => void;
};
const el = (o: Partial<Fake> = {}): Fake => {
  const f: Fake = {
    dataset: {},
    parentElement: null,
    textContent: '',
    scrollWidth: 100,
    clientWidth: 100,
    scrollHeight: 20,
    clientHeight: 20,
    style: {},
    attrs: {},
    hasAttribute: (k) => k in f.attrs,
    setAttribute: (k, v) => void (f.attrs[k] = v),
    removeAttribute: (k) => void delete f.attrs[k],
    ...o,
  };
  return f;
};

vi.stubGlobal('getComputedStyle', (e: Fake) => ({ textOverflow: e.style.textOverflow ?? 'clip', getPropertyValue: () => e.style.clamp ?? 'none' }));
afterEach(() => vi.clearAllMocks());

describe('auto titles of truncated text', () => {
  it('finds the ellipsis box among the 3 closest ancestors', () => {
    const box = el({ style: { textOverflow: 'ellipsis' } });
    const child = el({ parentElement: box });
    expect(truncatedBox(child as unknown as Element)).toBe(box);
    const far = el({ parentElement: el({ parentElement: el({ parentElement: el({ parentElement: box }) }) }) });
    expect(truncatedBox(far as unknown as Element)).toBeNull();
  });

  it('sets the full text only when it is cut, refreshes it and removes it once it fits', () => {
    const box = el({ style: { textOverflow: 'ellipsis' }, textContent: '  Parfum   Oud 50 ml ', scrollWidth: 240, clientWidth: 120 });
    syncAutoTitle(box as unknown as Element);
    expect(box.attrs.title).toBe('Parfum Oud 50 ml');
    box.textContent = 'Parfum Oud 100 ml';
    syncAutoTitle(box as unknown as Element);
    expect(box.attrs.title).toBe('Parfum Oud 100 ml');
    box.clientWidth = 300;
    syncAutoTitle(box as unknown as Element);
    expect(box.attrs.title).toBeUndefined();
  });

  it('keeps a tooltip written by the page and ignores text that fits', () => {
    const own = el({ style: { textOverflow: 'ellipsis' }, textContent: 'Long', scrollWidth: 240, clientWidth: 120, attrs: { title: 'Mine' } });
    syncAutoTitle(own as unknown as Element);
    expect(own.attrs.title).toBe('Mine');
    const fits = el({ style: { textOverflow: 'ellipsis' }, textContent: 'Short' });
    syncAutoTitle(fits as unknown as Element);
    expect(fits.attrs.title).toBeUndefined();
  });

  it('handles line-clamped paragraphs (cut vertically)', () => {
    const p = el({ style: { clamp: '2' }, textContent: 'Three lines of text', scrollHeight: 60, clientHeight: 40 });
    syncAutoTitle(p as unknown as Element);
    expect(p.attrs.title).toBe('Three lines of text');
  });
});
