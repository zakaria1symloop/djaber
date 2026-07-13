/**
 * Monochrome theme — mirrors the Djaber web design (black / white / zinc).
 * No colored tags; emphasis via weight, size and opacity only.
 */
export const colors = {
  bg: '#09090b', // zinc-950
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.10)',
  text: '#ffffff',
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#71717a', // zinc-500
  textFaint: '#52525b', // zinc-600
  inputBg: 'rgba(255,255,255,0.06)',
  white: '#ffffff',
  black: '#000000',
  bubbleMe: '#ffffff', // outgoing bubble = white, black text
  bubbleThem: 'rgba(255,255,255,0.08)', // incoming bubble = subtle white
  danger: '#ffffff', // monochrome: even "danger" stays white, styled by border
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
