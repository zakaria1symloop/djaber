# 07 — Architecture, compliance, security, NFR, tests

## 1. Stack

| Layer | Choice | Source |
|---|---|---|
| API + worker | **NestJS 11**, Node 22 LTS, TypeScript | owner decision |
| Web | **Next.js** (App Router) + Tailwind + shadcn/ui primitives restyled to the Djaber system | owner decision |
| Mobile | **Flutter** (Android + iOS), FCM | PH2 #02 |
| DB | PostgreSQL 16 + Prisma (`pg_trgm` for search) | D2 |
| Cache / queues | Redis 7 + BullMQ | CDC §10.1 |
| Real-time | Socket.IO (`@nestjs/websockets`) + Redis adapter | 06 §6 |
| Storage | S3-compatible (MinIO / R2) + `sharp` thumbnails; public https URLs for Meta sends | CDC §10.3 |
| AI | **Vercel AI SDK** (D25) — OpenAI, Anthropic, Google, Groq; structured output + tool steps | V1 |
| Speech | Groq Whisper, runtime fallback OpenAI Whisper | V1 **fix** |
| E-mail | Resend, react-email templates fr/ar/en | V1 |
| Payments | **Chargily Pay** (CIB / Edahabia rails; signed webhooks, raw body) behind the `PaymentGateway` interface; `ChargilyGateway` is the only implementation; `PAYMENT_PROVIDER=chargily`. Manual payments are recorded by platform finance (`BillingProvider.manual`, D71). Mobile credit packs = store IAP (Google Play / App Store receipts validated server-side); no subscription checkout on mobile | D4, D40, CDC |
| Couriers | ZR Express, EcoTrack, Yalidine via `CourierAdapter` | PH2 #05–07, CDC |
| Google | Sheets API v4 + Picker; OAuth verification | PH2 #03 |
| Hosting | Docker, VPS (DZ/EU) behind Caddy/Nginx TLS or managed PaaS | CDC §10.3 |
| CI/CD | GitHub Actions: lint, typecheck, unit, integration (embedded Postgres + redis-memory-server (no Docker, see root CLAUDE.md)), e2e, build, `prisma migrate deploy`, deploy | CDC §10.1 |
| Observability | Pino, Sentry (API/web/mobile), `/health` + uptime check, BullMQ board, metrics (queue depth, AI latency, send failures) | CDC §10.1 |

## 2. Repository (pnpm + Turborepo)

```
apps/api        NestJS HTTP + WebSocket
apps/worker     NestJS standalone — BullMQ processors (same modules)
apps/web        Next.js
apps/mobile     Flutter (API client generated from OpenAPI)
packages/db     Prisma schema, migrations, seeds (wilayas, communes, units, presets, quick replies, fee defaults)
packages/shared Zod schemas, enums, validators (phone, name…), error codes, i18n keys
packages/ui     design-system components (tokens from Figma)
docs/specs, docs/implementation, docs/audit
```

Validators and error codes in `packages/shared` are the single implementation for API, web forms, mobile and AI tools.

## 3. Modules (modular monolith + worker; CDC's 9 microservices not justified at this volume)

`auth` · `workspace` (tenant guard, roles, settings, onboarding, ownership transfer) · `billing` (plans, subscriptions, dunning, credits reservation, packs + IAP, limits guard) · `channels` (Meta OAuth, tokens, refresh, App Review status) · `messaging` (intake, conversations, messages, outbox sends, 24 h rules, WS gateway) · `ai` (providers, routing `AiRoute`, prompt builder, tools, AiRun/AiToolCall replay, vision 2-pass, transcription) · `agents` (wizard, versions, presets, playground) · `catalog` (+ moderation items) · `clients` (merge) · `orders` (`OrderEffects`, calls, callbacks, numbering, import) · `delivery` (geo, fee grid, adapters, shipments, tracking sync) · `payments` (`PaymentGateway` → `ChargilyGateway`) · `recommendations` (rule engine) · `gds` (suppliers, purchases, sales, cash + `CashClosing`, inventories, reports) · `notifications` (in-app/email/push, prefs, customer system messages) · `analytics` · `sheets` · `integrations` (API keys, outbound webhooks) · `safety` (blocks, abuse reports, blocked words) · `support` (`SupportTicket`, help) · `admin` (CMS, audit, viewers, read-only impersonation `ImpersonationSession`, platform settings, health) · `jobs` · `uploads`.

### Queues (worker)

| Queue | Job | Retry |
|---|---|---|
| `meta-inbound` | parse → dedup → store → schedule `ai-reply` | 5× backoff; dead-letter alert |
| `ai-reply` | run (AiRun + AiToolCall replay) → outbox send → settle credits | 3× (10 s, 1 min, 5 min); final ⇒ insight `error` |
| `outbox` | Meta sends (per-channel rate limit, 24 h rules), notifications, webhooks, Sheets | Meta 5× / 10 min; webhooks per 06 §4 |
| `media` | download attachments → S3, thumbnails, captions, transcription | 3× |
| `jobs` | import, analysis, generation, bulk send, export, backfill | 1× + resumable |
| `courier` | create parcel (retry 1, 5, 30 min, 2 h ×6), batch tracking (every 2 h for the first 3 days after `sent`, then every 12 h; after 30 d without event ⇒ `ShipmentStatus.stale`), labels | per-account limiter |
| `scheduled` | subscription dunning (J−7 `subscription.expiring` · J0 `dunning` + `invoice.unpaid` · J+3 reminder · J+7 `expired` ⇒ free plan, D49), trial end (D60), credit periods, token refresh/health, retention purge, low-stock digest guard, placeholder client cleanup, stale shipment marking, `sched-trust-levels` (D52), `sched-preset-updates`, `sched-order-reminders` (`Order.callbackAt`), `sched-abuse-auto-rules` | — |

### Core flow (FL-01) and idempotency

Webhook → verified → `InboundEvent` → `meta-inbound` → `ai-reply` (delayed, keyed by conversation) → AiRun `running` → tools persisted before execution → structured output → outbox send keyed by `runId` → AiRun `ok` → credits settled. Any retry resumes from persisted tool results; a send is never duplicated (outbox key), an order never created twice.

Targets: inbound ack < 200 ms; customer message → reply sent p95 < 30 s incl. window; AI generation p50 < 3 s.

## 4. Web app

TanStack Query over the API (no direct DB); access token in memory + refresh cookie; `next-intl` fr/ar/en with RTL via logical properties, CI fails on missing keys; react-hook-form + shared Zod; server errors mapped to fields and shown **inside** dialogs; tables server-paginated with filter state in the URL; WS updates the query cache; polling fallback; dirty-form guard; 404/403/offline pages; marketing/CMS pages server-rendered.

## 5. Mobile app

Flutter; same API/WS; secure storage; FCM deep links for every notification type (`djaber://` + the web path); Meta OAuth, Google OAuth and invitation acceptance via the system browser + app links (`djaber://` + universal links); credit packs by store IAP (`POST /credits/packs/iap/validate`); no subscription checkout on mobile (plan page read-only, D73); file picker import; offline read cache with no queued mutation; version gate `GET /app/version` (426 `APP_UPDATE_REQUIRED {minVersion, storeUrl, message}`); device registration `POST /me/devices` / `DELETE /me/devices/:token` (max 20, `DEVICE_LIMIT`); crash reporting. Full rules: [14-mobile-app.md](14-mobile-app.md) (wins over 03 §21); implementation: `docs/implementation/10-flutter-mobile.md`.

## 6. Security `[CDC §11]`

HTTPS/HSTS/TLS 1.2+ · argon2id · JWT access 15 min (EdDSA) + rotating refresh with reuse detection · TOTP 2FA · AES-256-GCM secrets with key rotation · hashed API keys with scopes · all inbound webhooks signature-verified on the **raw body** (`express.raw` for `/webhooks/*`) · tenant guard + Prisma extension injecting `workspaceId` + cross-workspace e2e test per resource · DTO whitelist validation, file type/size checks, image re-encoding, CMS HTML sanitised · `@nestjs/throttler` with Redis · Helmet, strict CORS allowlist (no wildcard `*.vercel.app` — V1 **fix**) · PII masked in logs · AuditLog for admin/sensitive actions (2 y) · admin impersonation **read-only only** (`ImpersonationSession`: reason ≥ 10 chars, 30 min, roles `super_admin` + `support`, every non-GET request under `X-Impersonation-Session` ⇒ `403 ADMIN_IMPERSONATION_FORBIDDEN_ACTION`, expiry ⇒ `401 ADMIN_IMPERSONATION_EXPIRED`, audit `impersonation.start` / `impersonation.action` per request / `impersonation.stop`) · no card data (Chargily hosts the checkout) · dependency audit + ZAP baseline in CI.

## 7. Platform compliance (new, from audit)

| Item | Requirement |
|---|---|
| Meta App Review (D13) | Reuse V1 app ID; submit `pages_messaging`, `pages_read_user_content`, `instagram_manage_messages`, Human Agent; prerequisites: privacy, terms, data-deletion pages live (P0), screencast, business verification. "Approval pending" states in UI. |
| Meta messaging policy | 24 h window rules (MSG-06); `POST_PURCHASE_UPDATE` only for order updates; no promotional sends; Instagram outside window ⇒ skipped. |
| Google OAuth verification | Sensitive scope `spreadsheets`; verification task in P2 with privacy page; ≤ 100 test users before approval. |
| Chargily | Signed webhooks on the raw body; test vs live mode by env (`PAYMENT_PROVIDER=chargily`); the only payment gateway of v2 (subscriptions, web credit packs, order payment links). |
| Stores | Play/App Store listings, privacy labels, account deletion in-app (AUTH-07, 14 MOB-R15); consumable IAP products for credit packs only (D40), receipts validated by `POST /credits/packs/iap/validate`; forced update via `AppVersion.minVersion` (D39). |

## 8. NFR `[CDC §13]`

API p95 < 500 ms (non-AI) · AI p50 < 3 s · 1 000 concurrent conversations, > 100 req/s · dashboard LCP < 3 s on 4G · uptime 99.5 %, RTO/RPO < 1 h (PITR, hourly backups, 30 d, off-site) · ≥ 10 channels/workspace, 10 000+ orders/month · stateless API/worker scale-out · maintenance < 4 h/month 02:00–06:00 Algiers · WCAG 2.1 AA (dark contrast, keyboard, RTL).

## 9. Tests `[CDC §14]`

| Type | Tooling | Gate |
|---|---|---|
| Unit | Vitest | every rule in 04 (transitions, effects, money, validators, merge) |
| Integration | Jest + embedded Postgres + redis-memory-server (no Docker, see root CLAUDE.md) (Postgres, Redis) + Supertest | every endpoint: happy, validation, permission, cross-workspace 404, idempotency, concurrency 409 |
| AI evals | fixture conversations (darija, arabizi, FR, EN, mixed), vision fixtures, voice fixtures; assert structured output, tool calls, handoff, no duplicate order on retry | nightly + on prompt change |
| Contract | recorded Meta, Chargily, ZR Express, EcoTrack, Yalidine, Google payloads | each adapter: create, label, status mapping, errors, webhooks |
| E2E | Playwright (web), Flutter integration (mobile) | scenarios in 13 |
| Load | k6 | webhook burst 1 000 msgs; orders list 100 k rows; tracking sync 10 k shipments |
| Security | ZAP baseline, dependency audit | staging |
| Migration | dry-run on anonymised prod copy; counts/totals equal | before cut-over |

Environments: local (Docker Compose), staging (anonymised prod copy, Meta test app users), production.

## 10. Deliverables `[CDC §15]`

Repo, specs, OpenAPI + Postman, Docker/compose + deploy scripts, runbook (backup/restore, key rotation, incident, App Review renewals), merchant guide, admin guide.

## 11. V1 migration (D3)

`packages/db/migrate-v1`: reads V1 MySQL, writes v2 per 05 §10; dry-run report; page tokens re-encrypted; webhooks re-pointed at cut-over (same Meta app); V1 kept read-only 30 days.
