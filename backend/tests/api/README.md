# API validation test suite

Black-box tests that fire real HTTP requests at a running backend and assert the
**whole error contract** of every endpoint: HTTP status, the stable `code`, a
human `message` that is actually translated (en / fr / ar), and the per-field
`fields[]` entries for validation failures.

1 619 checks across 8 modules.

## Running it

```bash
# 1. point DATABASE_URL at a scratch database and sync it
npx prisma db push

# 2. start the server (any free port)
PORT=6199 NODE_ENV=development npx ts-node src/server.ts

# 3. run the suite against it
cd tests/api
TEST_BASE=http://127.0.0.1:6199 node run.js            # everything
TEST_BASE=http://127.0.0.1:6199 node run.js 30-stock   # one module
```

Every run registers a **fresh merchant** (plus a second merchant and an admin)
and seeds its own fixtures, so runs are independent and repeatable. Results are
written to `results-<modules>.json`.

> The suite writes data. Never point `TEST_BASE` at production.
> `ENCRYPTION_KEY` must be set for the delivery-provider tests to reach their
> happy path (any 64-character hex string works locally).

## What each module covers

| Module | Scope |
|---|---|
| `10-core` | health, 404 routing, auth guard, register / login / profile, devices, pages + OAuth callbacks, Meta webhooks, plans, credits, CMS, payments |
| `20-inbox` | conversations, messages, replies, per-page AI settings, sync, analysis, agent generation |
| `30-stock` | products, categories, units, suppliers, variants, images (multipart), expenses, stock adjustments and movements |
| `40-commerce` | orders + confirmation calls, sales, purchases + receiving, clients, caisse — including stock and cash side effects |
| `50-ops` | AI agents, insights, notifications, cross-sell, delivery providers, tracking, fee rules |
| `60-analytics` | 7 analytics endpoints + 24 reports: period presets, custom ranges, cross-tenant isolation |
| `70-admin` | every admin route × 3 token states, plans, subscriptions, CMS, AI providers, and the legacy per-page stock API |
| `90-hostile` | cross-cutting: unparsed bodies, wrong body shapes, absurd numbers, injection-style strings, pagination abuse, header abuse |

## Writing a new check

```js
module.exports = async (t) => {
  await t.check('products — name missing', {
    method: 'POST', path: '/api/user-stock/products', auth: true, lang: 'fr',
    body: { sku: 'X', costPrice: 1, sellingPrice: 2, quantity: 1 },
    expect: { status: 400, code: 'VALIDATION_FAILED', field: 'name' },
  });

  await t.ok('products — list works', { path: '/api/user-stock/products', auth: true });
};
```

`t.check` asserts an error answer, `t.ok` asserts a 2xx. Useful options:
`auth: true | 'admin'`, `token` (e.g. `t.tokens.other` for cross-tenant probes),
`lang`, `form` for multipart, and `expect: { status, code, field, fieldCode, minFields }`.
Seeded ids live on `t.ctx` (`productId`, `orderId`, `foreignProductId`, `missingId`, …).

Every error answer is additionally checked for free: JSON body, non-empty `code`
and `message`, no leaked internals (Prisma / SQL / stack traces), a message that
is a sentence rather than a raw code, and genuine Arabic text when `lang: 'ar'`.

## Catalog audit

```bash
node catalog-audit.js
```

Static checks the API tests cannot see: a code defined twice (the spread in
`errors/catalog.ts` would silently keep the last one), a missing or
copy-pasted translation, `{placeholders}` that differ between languages, an
invalid HTTP status, and codes used in a controller but absent from the catalog.
