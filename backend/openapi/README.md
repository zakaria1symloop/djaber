# Djaber.ai API — OpenAPI spec

`openapi.yaml` is the OpenAPI 3.0.3 description of the whole backend (229 operations, every
router in `src/routes` plus the inline routes of `src/server.ts`). Every operation description
starts with its full production URL so a client developer can copy it as-is.

## Where it is served

Mounted by `src/server.ts` when this file exists:

| URL | What |
|---|---|
| `https://djaber.72-60-190-211.sslip.io/api/docs` | Swagger UI (interactive — "Try it out" works because it is same-origin) |
| `https://djaber.72-60-190-211.sslip.io/api/docs/openapi.json` | machine-readable spec (Postman / Insomnia import, code generators) |
| `https://djaber.72-60-190-211.sslip.io/api/docs/openapi.yaml` | same spec as YAML |

Locally: `http://localhost:<PORT>/api/docs`.

## Conventions used in the spec

- `security: bearerAuth` = `Authorization: Bearer <JWT>` from `POST /api/auth/login`.
- Prisma `Decimal` fields are documented as `string` / `format: decimal` (`"1500.00"`), dates as ISO-8601.
- Shared model schemas are named after the Prisma models (`Product`, `Order`, …); module-specific
  request/response schemas carry a prefix (`Core_`, `Page_`, `Stock_`, `Commerce_`, `Ops_`,
  `Analytics_`, `Admin_`).
- `/api/stock/{pageId}/…` operations are marked `deprecated` (legacy per-page API; clients use `/api/user-stock`).

## Updating it

Edit `openapi.yaml` by hand next to the code change (same PR), then validate:

```bash
npx --yes @apidevtools/swagger-cli@4 validate backend/openapi/openapi.yaml
```

Generate a Dart client for the Flutter app (example):

```bash
npx --yes @openapitools/openapi-generator-cli generate -i backend/openapi/openapi.yaml -g dart-dio -o mobile/packages/djaber_api
```
