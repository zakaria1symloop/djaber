// V1 → V2 cutover: the V1 paths registered in the Meta app reach their V2 routes (META_LEGACY_PATHS=true).
import { legacyMetaPaths } from './bootstrap';

const rewrite = (url: string) => {
  const req = { url };
  legacyMetaPaths(req, null, () => undefined);
  return req.url;
};

describe('legacyMetaPaths', () => {
  it('maps the webhook (verify GET + events POST), keeping the query string', () => {
    expect(rewrite('/api/webhooks/meta')).toBe('/api/v1/webhooks/meta');
    expect(rewrite('/api/webhooks/meta?hub.mode=subscribe&hub.challenge=42')).toBe('/api/v1/webhooks/meta?hub.mode=subscribe&hub.challenge=42');
  });
  it('maps the data-deletion callback and the OAuth returns', () => {
    expect(rewrite('/api/webhooks/meta/data-deletion')).toBe('/api/v1/webhooks/meta/data-deletion');
    expect(rewrite('/api/pages/callback/facebook?code=abc&state=xyz')).toBe('/api/v1/channels/callback/facebook?code=abc&state=xyz');
    expect(rewrite('/api/pages/callback/instagram')).toBe('/api/v1/channels/callback/instagram');
  });
  it('leaves every other path alone', () => {
    for (const u of ['/api/v1/webhooks/meta', '/api/pages', '/api/pages/callback/tiktok', '/health', '/api/webhooks/metax']) expect(rewrite(u)).toBe(u);
  });
});
