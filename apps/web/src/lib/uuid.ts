// `crypto.randomUUID` exists only in secure contexts (HTTPS or localhost). The app is also opened over plain HTTP on the
// local network (team testing, staging behind a LAN address), so ids are built from `crypto.getRandomValues`,
// which every context provides.
export const uuid = (): string => {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function' && globalThis.isSecureContext) return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
