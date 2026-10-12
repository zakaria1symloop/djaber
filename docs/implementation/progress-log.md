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

## M1 — Accounts, workspaces, team, onboarding, settings (2026-10-11)

**Built**
- Accounts: sign-up (creates the workspace, the owner and a 14-day Pro trial), login, session renewal with theft detection, logout everywhere, forgotten / reset password, e-mail verification with reminder, two-step login (authenticator app + recovery codes), profile, avatar, password and e-mail change, list and revoke sessions, account deletion request.
- Workspaces: create (one owned workspace per user), profile and logo, language, stock mode, auto-pause, reminder delay, free-delivery threshold, ownership transfer, deletion with 30-day grace and cancel, workspace switcher.
- Team: members list, invitations (send, resend, revoke, accept by link), role change, removal, member limit of the plan.
- Settings: quick replies (create, edit, reorder, delete), customer system messages (4 messages × 3 languages, preview, reset), security page, danger zone.
- Legal documents acceptance (4 documents seeded), onboarding tunnel (6 steps, resumable, skippable), "Get started" checklist computed from real data, empty home page.
- Web: login / sign-up / reset / verify / invitation / new workspace pages with every state of the Figma catalogue, merchant shell with real session (sidebar by role and stock mode, user menu, language switch, banners), settings area. French, Arabic (right-to-left) and English: 1 318 translated texts.
- 10 e-mail templates in 3 languages, delivered through the background worker.
- Local Redis replaced by Redis 7.2 (the previous one was too old for background jobs).

**Checks** — lint ✔ · typecheck ✔ · unit ✔ (72: shared 19, web 40, api 13) · integration ✔ (291) · browser ✔ (29: AT-AUTH-01…12, AT-ONB-01/02, AT-SET-01, AT-UX-02, accessibility on public screens) · translations ✔ · web production build ✔.

**Simulated / deferred** (tracked in `carry-overs.md`)
- E-mails are written to `.local/mail` (no mail provider key).
- In-app notifications for team events arrive with the notifications module (M5); e-mails are already sent.
- Public account-deletion page and personal data export arrive with the public pages (M11).
- Onboarding buttons "add products / create agent / connect a page" only move to the next step until M2–M4.

## M2 — Catalogue and stock (2026-10-11)

**Built**
- Products and services: create, edit, duplicate, archive, restore, delete; variants (manual and generated); up to 10 images with background re-encoding and thumbnails; categories (2 levels) and units with reassignment on delete; SKU unique across products and variants; plan limit on the number of products.
- Stock: adjustments that always create a movement, low-stock and out-of-stock detection per product and variant, movements list with reversal and stock-at-date, stock dashboard (simple and advanced modes), product expenses and margins (data + endpoints).
- Bulk actions (category, minimum stock, price with preview, archive, export), import wizard for CSV / XLSX with column mapping, row errors and atomic commit, export files as background jobs with progress.
- Product moderation records (auto-approved for now), "create from photo" entry point, accent-insensitive search.
- Web: products list (search, filter panel, tabs, sort, density, columns, grid, selection and bulk bar, row `Actions ⌄`, quick-edit sheet), product form and page, categories and units, services, import wizard, stock dashboard, movements. Reusable list kit (filters, data table, side sheet, list state in the URL) for the next stages. Live updates over WebSocket with polling fallback.
- Fixed on the way: real-time connection refused by the server (tenant scope bug), amounts now display `12 500 DA`.

**Checks** — lint ✔ · typecheck ✔ · unit ✔ (260: shared 28, web 153, api 79) · integration ✔ (342, incl. list p95 127 ms on 10 000 products and 2 000-row import preview < 5 s) · browser ✔ (64, incl. AT-CAT-01…13 UI side, RTL product form, accessibility) · translations ✔ (2 092 texts × 3 languages) · web production build ✔.

**Simulated / deferred** (tracked in `carry-overs.md`)
- Image captions and "create from photo" use a stand-in until the AI stage (M4). Moderation auto-approves until the admin queue (M10).
- Product labels (PDF) arrive with delivery labels (M6); links to orders / agents / purchases arrive with those modules (M4, M5, M7).
- Two acceptance checks that need orders (a service product line never moves stock, variant required on an order line) are verified in M5.

## M3 — Connected pages, Meta message intake, inbox (2026-10-11)

**Built**
- Connected pages: connect Facebook pages and Instagram accounts (with per-page report, plan limit, linked Instagram), pause, resume (with swap at the plan limit), disconnect, reconnect when the token expires, page overview and figures, history import (25 conversations × 25 messages), token refresh, approval status.
- Message intake: signed webhook with immediate acknowledgement, raw event storage, de-duplication, conversation and customer identity creation, every message type (text, image, audio, video, file, sticker, story reply, buttons, reactions, echoes of replies sent from the Page inbox), attachment download in the background, sending with the 24-hour rules and tags, product cards, delivery status, data-deletion callback and public status page, retention purge.
- Inbox: three panes, tabs with server counts, search and filters, thread with upward loading, reply box (text, image, quick replies, templates, undo), pause / resume AI, resolve / reopen / archive, assign, internal notes, customer panel, bulk selection bar, block and report a customer, soft delete. Queue page ("File d'attente"). Live updates everywhere.
- Notification centre: in-app notifications with live bell and badges, list with filters, read / read all; team events from M1 now notify in the app. Safety settings (blocked customers, automatic rules, blocked words).
- A development-only simulator injects a signed fake customer message so the whole chain can be seen working without Meta.

**Checks** — lint ✔ · typecheck ✔ · unit ✔ (665: shared 38, web 280, api 347) · integration ✔ (403, incl. AT-CHN, AT-MSG, AT-INB server side; 1 000-webhook burst acknowledged with p99 28–39 ms) · browser ✔ (117, now run against a production build of the web app) · translations ✔ (2 669 texts × 3 languages) · production build ✔.

**Simulated / not verifiable here**
- Meta is simulated: only the fake connection ran. The real Graph connection is fully written and covered by tests with recorded answers, but it has never talked to Meta, and the server refuses to start it in development unless `META_ALLOW_LIVE=true`. The exit criterion "a real Facebook page and Instagram account receive messages" is therefore **not verified** — it can only be checked at cutover, when the webhook is deliberately pointed at the new server.
- To check with Meta at that time: the customer identifier sent by the data-deletion callback.

**Deferred** (tracked in `carry-overs.md`)
- Page analysis and agent linking on the channel page (M4, needs the AI). E-mail and push delivery of notifications and preferences (M5). Order and customer links from the inbox (M5). Admin release of a page held by another workspace, approval polling (M10). Credits-exhausted banner and plan links (M9).

## M4 — AI agents (2026-10-12)

**Built**
- Web: agents list, 5-step creation wizard with saved drafts, agent page (overview with versions and restore, configuration, insights queue, playground), public 24-hour test page, AI parts of the channel page (agent linking, ice-breaker, page analysis import, generate an agent from a page) and of the inbox (AI run inspector, handoff reasons, AI unavailable / credits exhausted states), credits pill, banners and read-only credits page.
- Fixed on the way: database forced to UTC (day boundaries were one hour off), the queue now lists conversations handed over by the AI, page import creates new categories and shows readable errors, ids generated in a way that also works when the app is opened by network address (team testing).

**Checks** — lint ✔ · typecheck ✔ · unit ✔ (818: shared 38, web 358, api 422) · integration ✔ (458) · AI pipeline scenarios ✔ (29, simulated provider) · browser ✔ (252 in one run, all on the real API except a few error states the simulator cannot produce) · translations ✔ (3 528 texts × 3 languages) · production build ✔.

**Simulated / not verifiable here**
- No AI provider key exists in the old project: every AI answer comes from a scripted stand-in. The real providers (OpenAI, Anthropic, Google, Groq) are written and tested against recorded answers but have never run; the server refuses them in development unless `AI_ALLOW_LIVE=true`. The quality of real AI answers is not measured yet.
- The AI stops at "create the order" and hands over to a human: real order creation by the AI is completed in M5 with the orders module, as the build order plans.

**Server details**
- AI port (`modules/ai/provider`): `fake` adapter (default; scriptable, deterministic keyword brain) and `live` adapter (Vercel AI SDK v4: OpenAI, Anthropic, Google, Groq) refused in development / test unless `AI_ALLOW_LIVE=true`; routing per capability with fallback and a Redis circuit breaker; seeded providers / models / routes / pricing.
- Reply pipeline (FL-01 steps 6–15): inbound gates (voice / image toggles, credits, conversation quota, abuse guard), batching with a follow-up job, idempotent `AiRun` + `AiToolCall` replay, 14 prompt sections with snapshots, structured output with one repair, tools (`search_products`, `get_product`, `quote_delivery`, `lookup_order`, `cancel_order` candidates, `handoff_to_human`, `add_faq_candidate`; `create_order` validated then handed to the `ORDER_TOOLS` port), 2-pass vision, transcription with fallback, welcome / out-of-hours / handoff / unavailable / voice-failed texts, blocked words, handoff + insights, reaper.
- Credits: ledger with reservation → debit / release, monthly period, 80 % and exhausted notifications, WS `credits.updated`, `GET /credits`, ledger, calculator.
- Agents: presets (real instructions, version 2), 5-step wizard on a draft, versions with diff and restore, activation with the plan limit, pause / resume, duplicate, delete, bulk, readiness, metrics, FAQ, insights queue, channel ↔ agent, generate from page, FAQ extraction, page analysis + import, playground with dry-run tools, 8 scenarios, shared test link, eval runner (`pnpm test:evals`).

**Deferred** (tracked in `carry-overs.md`)
- Real order creation / cancellation by the AI (M5 binds `ORDER_TOOLS`). Packs and purchases (M9). Admin AI screens and provider keys (M10). PDF / DOCX FAQ import, ice-breaker push to Meta (M11). Live evals (need provider keys).

## M5 — Clients, orders, cash on delivery, fee grid, home (2026-10-12)

**Built**
- Orders: list with KPI tiles that follow the filters, status tabs with counts, search, quick filters and the full filter panel (all in the address), sort, density, columns, selection with grouped actions and a per-order result dialog ("Réessayer les erreurs"), export and print jobs, row `Actions ⌄` from the server with greyed reasons, live arrival of new orders. Order page: client, delivery address (wilaya / commune / stop-desk with the recomputed fee), items, totals, delivery and payment blocks, history, calls, notes, read-only closed orders, conflict dialog. Dialogs: confirm (check → call outcome → result), call result, reminder, cancel, change status, mark delivered, mark returned, delete (typed number), record payment, assign, mark shipped. A5 slip (print preview + server PDF with Arabic text).
- New order form: client found by phone or created inline, products and variants with stock hints, delivery with the fee quote (grid / free / not served / Admin override), payment, status, notes, draft kept, opened from the inbox, a client sheet or "Dupliquer".
- The AI now creates real orders from a Messenger conversation (the step left open in M4 is closed).
- Clients: list with filters, side sheet (figures, addresses, orders, conversations, merged / placeholder / risk notices), new / edit / complete, merge, tags, risk, delete or archive, export.
- Delivery fee grid of the 58 wilayas (saved on leaving a cell, reset a row, fill missing, reset all, free-delivery threshold), seeded for every shop.
- Home: "À traiter" cards, overview tiles, quick actions, page cards with conversations / messages of 7 days / unread / stock and the connection date, Get Started. Notification preferences (Settings › Notifications) with the sound toggle; inbox sound; links left open by earlier stages (inbox client panel and menu, products, agents, connected pages).
- Team testing: `tools/demo-orders.mjs` adds clients and orders in several states to the demo shop.

**Checks** — lint ✔ · typecheck ✔ · unit ✔ (shared 38, api 532, web 443) · integration ✔ (515 in 28 files) · AI pipeline scenarios ✔ (29, simulated provider) · translations ✔ (4 395 texts × 3 languages) · Storybook build ✔ · browser ✔ (320 in one complete run, 68 of them M5, including customer → AI order → live list → confirm → A5 slip on the real API; 10 tests still serve a state the API cannot produce on demand, each marked `// mock:`) · production build ✔, served on the local network.

**Simulated / not verifiable here**
- Couriers: "Envoyer au transporteur" stays greyed (`DELIVERY_NO_COURIER`) until M6; parcels are marked shipped by hand.
- Push notifications go to a fake sender (`PUSH_ALLOW_LIVE` is off); e-mails go to `.local/mail`.
- AI answers and AI orders still come from the scripted stand-in (no AI key in the old project).

**Deferred** (tracked in `carry-overs.md`): courier sending, tracking and labels (M6); order import from a file and PDF export of orders; payment link and refund (M9); Google Sheets and webhook senders (M11); saved views; inbox filter by agent.

## M6 — Delivery, couriers, tracking, labels (2026-10-12)

**Built**
- Couriers (`/delivery/couriers`): ZR Express, EcoTrack and Yalidine accounts with each provider's own fields, stored encrypted; connection test (OK with latency / refused / unreachable), default courier, activate / deactivate, delete blocked while parcels are in flight, sender details, webhook address, "Livraison propre" (own drivers, no account), automatic sending of confirmed orders to the default courier (switch).
- Sending: "Envoyer au transporteur" from the order page (prefilled from the order, cost and delay per courier, errors shown on the field with "rien n'a été créé"), bulk sending from the orders list, from `/delivery` and with "Envoyer les confirmées (n)", per-order results with "Réessayer les échecs"; a courier that is down queues the parcel and retries.
- Tracking: automatic refresh (every 2 h for 3 days, then every 12 h; "stale" after 30 days without movement), courier webhooks with signature check, "Actualiser" limited to once per 5 minutes, live updates on every screen; failed delivery with attempts n/3 → "proposer le retour", retry, change of courier, cancel, mark failed / delivered / returned by hand (a returned parcel makes the order "returned" only when the merchant confirms it).
- `/delivery` overview: six tiles, tabs Échecs / Sans mouvement / À envoyer / En transit / Retours / Toutes, filters, search, sort and page in the address, row `Actions ⌄` with greyed reasons, selection bar, tracking side panel with the timeline.
- Labels: single label (courier PDF, or the Djaber A6 label with barcode and QR code when the courier has none), merged PDF of many labels as a background job (progress, partial, retry), product label sheet from `/products` (left open since M2).
- Fee grid: "Copier les tarifs du transporteur" with a preview of the differences.
- Public tracking page `/s/[code]` (no login): steps, timeline without the customer's phone, delivered / failed / returned / cancelled summaries, "Signaler ce vendeur".
- Order page delivery block (left open since M5): not sent, sending, queued, sent with timeline, failed, returned, delivered.
- Team testing: `tools/demo-delivery.mjs` adds a ZR Express and a Yalidine account (simulated) and sends the confirmed demo orders.

**Checks** — lint ✔ · typecheck ✔ · unit ✔ (shared 38, api 565, web 462) · integration ✔ (552 in 33 files, incl. the 10 000-parcel sync test) · AI pipeline scenarios ✔ (29) · translations ✔ (4 769 texts × 3 languages) · Storybook build ✔ · browser ✔ (339 in one complete run, 19 of them M6; AT-DLV-03 "courier down" serves the queued state through a `// mock:` because the simulated courier can only be switched off inside the API) · production build ✔, served on the local network.

**Simulated / not verifiable here**
- Every courier runs on the simulated driver (`COURIER_DRIVER=fake`); the real ZR Express, EcoTrack and Yalidine connections are written but refused unless `COURIER_ALLOW_LIVE=true`. They must be checked once with test courier accounts before going live (EcoTrack instance URLs especially). No real parcel was created.
- Customer messages about parcels, push and AI stay on their fake senders (Meta, push and AI guards are off).

**Deferred** (tracked in `carry-overs.md`): Analytics › Livraison and the CSV export of `/delivery` (M8); courier metrics in the admin (M10); captcha on the public report and the public header links (M11); "Un PDF par commande" print option (M11 polish).
