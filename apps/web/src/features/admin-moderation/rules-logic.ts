// Key of a new platform rule: `<kind>.<slug of the value>` (ModerationRuleSchema: [a-z0-9_.-], 2–80 chars).
export function ruleKey(kind: string, value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${kind}.${slug || Date.now().toString(36)}`.slice(0, 80);
}
