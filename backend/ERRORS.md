# API errors — one contract, three languages

Every non-2xx answer of the API has the same shape, and its text is already
translated for the caller.

```json
{
  "error":   "Not Found",                 // legacy HTTP label, kept for old clients
  "code":    "PRODUCT_NOT_FOUND",         // stable key — what clients switch on
  "message": "Produit introuvable.",      // translated (en / fr / ar)
  "params":  { "field": "sku" },          // values used in the message (optional)
  "fields":  [                            // only on 400 VALIDATION_FAILED
    { "field": "email", "code": "FIELD_INVALID_EMAIL", "message": "Veuillez saisir une adresse e-mail valide." }
  ],
  "errors":  [ { "msg": "…", "path": "email", "location": "body" } ]   // legacy mirror of fields
}
```

## How the language is chosen

Order of precedence, first match wins: `?lang=ar` query → `X-Lang` header →
`Accept-Language` header (q-ordered, `fr-FR` counts as `fr`) → English.
The web app and the Flutter app send `Accept-Language` with the language the
user picked in the UI, so messages can be shown to the user as-is.

## What the HTTP status means

| Status | Meaning | Typical codes |
|---|---|---|
| 400 | malformed input / validation | `VALIDATION_FAILED` (+ `fields`), `FIELD_*`, `INVALID_JSON`, `INVALID_PAGINATION` |
| 401 | not signed in / bad token | `UNAUTHORIZED`, `INVALID_TOKEN`, `AUTH_INVALID_CREDENTIALS` |
| 402 | AI credits exhausted | `INSUFFICIENT_CREDITS` |
| 403 | no right / plan limit | `FORBIDDEN`, `ADMIN_REQUIRED`, `PLAN_LIMIT_REACHED` |
| 404 | record missing or not owned by the caller | `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`, … |
| 409 | duplicate / conflict | `DUPLICATE`, `AUTH_EMAIL_TAKEN`, … |
| 413 | too large | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` |
| 422 | business rule violated | insufficient stock, forbidden status transition, outside the Messenger window, … |
| 502 / 503 | external service failed / not configured | `UPSTREAM_ERROR`, `SERVICE_UNAVAILABLE`, courier / Meta / AI provider codes |
| 500 | unexpected | `INTERNAL_ERROR` (details are logged server-side, never sent) |

Clients should branch on **`code`** (never on the text) and display **`message`**.
For forms, show `fields[].message` under the matching input.

## Where it lives in the code

- `src/errors/index.ts` — `fail()`, `handleError()`, `ApiError`, `resolveLang()`, `translate()`.
- `src/errors/catalog.*.ts` — the catalog: one entry per code with `status`, `en`, `fr`, `ar`
  (`catalog.core.ts` for shared codes, one file per module: auth, pages, inbox, stock, commerce, ops, analytics, admin).
- `src/middleware/validate.ts` — `Validator` (fluent input checks collecting every field error), `validate` (express-validator bridge), `pagination()`.
- `src/server.ts` — the global handler: `ApiError` → its status; JSON parse error → 400; multer → 400/413; Prisma P2002 → 409, P2025 → 404; anything else → 500.

## Adding a new error

1. Add the code to the module's `catalog.<module>.ts` with the three texts (placeholders like `{field}` allowed).
2. In the controller: `return fail(req, res, 'MY_CODE', { field: 'sku' })`, or `throw new ApiError('MY_CODE')` deeper in the code.
3. For input checks: `const v = new Validator(); const qty = v.integer(req.body.quantity, 'quantity', { min: 1 }); v.throwIfAny();`
4. Never rename a code once shipped — clients depend on it. Add a new one instead.
