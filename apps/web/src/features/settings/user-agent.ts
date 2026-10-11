// Sessions list: "Chrome · Windows" from the stored User-Agent (Figma SET Security "Chrome · Windows · Sétif").

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** `null` when the agent is missing; the raw agent (shortened) when nothing is recognised. */
export const describeUserAgent = (ua: string | null | undefined): string | null => {
  if (!ua) return null;
  // the mobile app identifies itself as "Djaber/<version> (<platform>; <device>)"
  const app = /^Djaber(?:App)?\/[\d.]+\s*\(([^;)]+)(?:;\s*([^)]+))?\)/.exec(ua);
  if (app) return ['Djaber', app[1]!.trim(), app[2]?.trim()].filter(Boolean).join(' · ');
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  if (!browser && !system) return ua.slice(0, 60);
  return [browser, system].filter(Boolean).join(' · ');
};
