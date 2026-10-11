# Progress log

One entry per finished stage: what was built, checks passing, what is still simulated.

## M0 — Foundations (2026-10-11)

**Built**
- Monorepo (pnpm + Turborepo): `apps/api` (NestJS), `apps/worker`, `apps/web` (Next.js), `packages/db` (Prisma), `packages/shared`, `packages/ui`.
- Local infrastructure without Docker: `pnpm infra:up` starts Postgres 16 (UTF-8) and Redis; `pnpm dev` starts API (:4010), worker (:4011 health) and web (:3010).
- Database: 125 tables migrated (2 migrations), UUID v7 function, partial unique and trigram indexes; workspace isolation enforced by the Prisma tenant extension.
- Seeds: 58 wilayas, 1 541 communes, 7 system units, plans free/starter/pro, packs 500/2 000/6 000, 4 agent presets, app versions (android, ios), platform settings and providers, first super admin. Workspace defaults ready (4 system messages, 4 quick replies × 3 languages, fee table).
- API core: configuration schema, JSON logs with redaction, error envelope for the 218 catalogue codes in fr/ar/en, success envelope, request id, authentication guard (EdDSA JWT, API keys), workspace resolution (404 across workspaces, suspended, deletion scheduled), permission matrix (merchant + platform roles), rate limits, idempotency, audit trail, outbox + relay, queues and schedulers registry, WebSocket gateway with Redis adapter, storage (local / S3), mail (local mailbox / Resend), encryption (AES-256-GCM, argon2id), feature flags, `/health` and `/ready`.
- Endpoints: `GET /app/version`, `POST|DELETE /me/devices`, `GET /workspaces`, `GET /geo/wilayas`, `GET /geo/wilayas/:id/communes`, `GET /files/*`.
- Web: design tokens from Figma, UI kit (buttons, fields, cards, pills, table, pagination, dialogs, `Actions ⌄` menu, tabs, toasts, banners), GLOBAL states (skeleton, empty, filtered-empty, error, offline, 403, 404, suspended, session expired, conflict, leave guard), responsive shell (sidebar 240 / rail 64 / drawer), banner priority stack, fr / ar (RTL, Changa) / en with 910 translated keys, Storybook (`pnpm --filter @djaber/ui storybook`), gallery page `/fr/dev/states`.
- Tooling: ESLint, `pnpm i18n:check`, generators (errors, enums, copy deck), CI workflow, Dockerfile for staging/production.

**Checks** — `pnpm lint` ✔ · `pnpm typecheck` ✔ · `pnpm test` ✔ (20 unit) · `pnpm test:int` ✔ (234: every error code, cross-workspace 404, roles, idempotency, audit, rate limit, seeds, devices, workspaces) · `pnpm test:e2e` ✔ (5) · `pnpm i18n:check` ✔ · web production build ✔ · Storybook build ✔.

**Simulated / not wired yet**
- Every external service runs on its fake driver (Meta, Chargily, AI, couriers, Google Sheets, push, in-app purchases). Mail is written to `.local/mail`, files to `.local/storage`.
- Sentry is not connected (no DSN). Agent preset prompts are placeholders until M3.
- The merchant shell is shown with sample data on the gallery page; real session, login and workspace data arrive in M1.
