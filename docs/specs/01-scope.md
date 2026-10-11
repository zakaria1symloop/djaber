# 01 — Scope

## 1. Context

Algerian e-commerce sells mainly through Facebook pages and Instagram; Messenger/DM is the order channel. Manual handling causes slow replies, order errors, no 24/7 service, lost sales and no statistics `[CDC §1.1]`.

Djaber is a **multi-tenant SaaS**: a merchant signs up, connects Facebook/Instagram pages, loads a catalogue, configures an AI agent; the agent answers customers in their language, recognises products from photos, listens to voice notes, takes cash-on-delivery orders and hands off to a human when needed. The merchant runs orders, delivery, stock (GDS), clients, analytics and reports from the web dashboard and the mobile app `[V1][PH2]`.

**Why v2:** V1 is functionally good but has structural gaps (dual data scoping, unenforced plan limits, unsigned webhooks, plaintext tokens, in-memory batching, no migrations, no real-time, broken AI features, dead UI controls) and a web UX that must be redesigned. **Target (D11): 100 % functional parity on the retained V1 modules, every defect in [09](09-v1-lessons.md) closed, UX redesigned in Figma first.**

## 2. Objectives `[CDC §2]`

| ID | Objective | Target |
|---|---|---|
| OS1 | Automate sales | ≥ 70 % of conversations resolved without a human |
| OS2 | Premium customer experience | 24/7, reply in the customer's language & script |
| OS3 | Local ecosystem | ZR Express, EcoTrack, Yalidine; DZD; Edahabia/CIB via Chargily; 58 wilayas + communes; Google Sheets |
| OS4 | Scalability | ≥ 10 channels per workspace, 10 000+ orders/month, horizontal scaling |
| OS5 | Business insight | Dashboards, 8 analytics tabs, 23 reports |

## 3. KPIs computed by the platform `[CDC §2.3]`

| KPI | Definition (04 §4 names) | Shown in |
|---|---|---|
| First response time | avg/median(first AI or human reply − first customer message) per conversation | Analytics › Responses |
| AI resolution rate | conversations resolved with no human reply ÷ resolved | Home, Analytics › Agents/Responses |
| Conversion rate | AI orders ÷ conversations in period | Analytics › Agents, Channels |
| Average basket | Revenue ÷ (sales + delivered orders) | Home, Reports › Sales |
| Abandon rate | carts started (recap shown) − orders created ÷ carts started | Analytics › Orders |
| COD collection | collected ÷ delivered value | Analytics › Orders |
| Delivery performance | delivered / failed / returned per courier, avg days | Analytics › Delivery (P2) |

NPS (CDC) is out — no survey channel (D22).

## 4. Scope

### 4.1 Retained modules (parity with V1 + fixes + PH2/CDC additions)

| Domain | Content | Source |
|---|---|---|
| Accounts & workspace | Sign-up, login, refresh tokens, password reset page, e-mail verification, profile, 2FA, language FR/AR/EN RTL, members & roles, workspace deletion | V1, FIG, CDC §4/§11 |
| Channels | Facebook pages (+ linked IG), Instagram Business Login, token refresh, reconnect, Meta App Review, page analysis → products, sync history | V1, PH2 #01 |
| Message intake | Signed webhooks, queue, dedup, batching, all attachment types, 24 h-window rules | CDC §6.1, V1 |
| Inbox | Unified inbox, real-time, text+image reply, quick replies, pause/resume AI, resolve/archive, assign, notes, client panel | CDC §7.4, V1, FIG 10 |
| AI agents | List, presets (4), create/edit (wizard per FIG), generate from page, test playground, insights queue, metrics | V1, FIG 14–15 |
| AI pipeline | Language/script rule, catalogue grounding + retrieval, structured output, tools (search, fee, order, cancel, status, payment link), image recognition 2-pass, voice transcription, handoff, idempotent runs | CDC §6.1–6.2, PH2 #04, V1 |
| GDS — catalogue | Products (variants, images, expenses & margins adv.), categories, units, import with preview, AI from photo, services | V1, CDC §7.3, FIG 16–18 |
| GDS — operations | Stock dashboard, movements, adjustments, low-stock alerts, suppliers, purchases/receive, sales (walk-in), cash register, 23 reports | V1, FIG |
| Clients | Auto from conversations + merge, CRUD, addresses, metrics | V1, CDC §9.1.3, FIG |
| Orders | Manual + AI, call confirmation, V1 status machine, bulk actions, export, print, side-effects | V1, CDC §6.3, FIG |
| Delivery | Fee grid per wilaya (customer price), ZR Express / EcoTrack / Yalidine send (single/bulk), labels, tracking with notifications, delivery overview | CDC §6.4, PH2 #05–07, V1 adapters |
| Payments | SaaS billing via Chargily (signed), order payment links Edahabia/CIB (D4) | V1, CDC §6.5 |
| Cross-sell | Rule-based generation (V1), manual rules, impressions/conversions | CDC §6.6, V1, FIG |
| Notifications | In-app, e-mail, push (FCM), customer messages within Meta policy | CDC §12, V1, FIG 09b |
| Analytics | Home, 7 V1 tabs + Delivery tab (P2) | CDC §7.1, V1, FIG |
| Billing & credits | Plans, subscriptions, enforced limits, credits ledger, credit calculator | V1, FIG 11 |
| Public API | API keys with scopes, bounded endpoint set, outbound webhooks, Swagger | CDC §8 |
| Google Sheets | One-way order export | PH2 #03 |
| Platform admin | Analytics, users/workspaces, plans, subscriptions, AI providers + pricing calculator, cross-workspace viewers, CMS (i18n), audit log | V1, CDC §11.3 |
| Public site | Landing, features, pricing, help, legal (privacy, terms, cookies, data deletion), CMS pages — ported, light restyle | V1 |
| Mobile app | Flutter; every merchant feature except the web-only list of [14-mobile-app.md](14-mobile-app.md) §2; push; `djaber://` deep links; credit packs by store IAP; no plan checkout on mobile | PH2 #02, 14-mobile-app.md, Figma pages Mobile V2 (base FR) + Screens (AR/EN) |

### 4.2 Out of scope (with reason)

| Item | Reason |
|---|---|
| WhatsApp | CDC §3.3 later phase; not in V1 |
| ERP/accounting connectors, WooCommerce/PrestaShop plugins, Zapier, OAuth 2.0 for partners, sandbox env, code samples | CDC §8.2/8.4/8.5 — covered by public API + webhooks + Swagger only |
| SMS channel | CDC optional; no provider |
| NPS surveys, A/B testing of recommendations, birthday/loyalty offers, customer preference memory (sizes/colours) | CDC §6.6/§6.7 — no data source; preferences deferred (P3 candidate) |
| Abandoned-cart reminder, post-delivery review request | Meta 24 h policy: no tag allows promotional messages (D22) |
| Multi-currency | DZD only `[CDC §3.3]` |
| Microservices split, Elasticsearch, Google Vision, MongoDB | Modular monolith + worker, Postgres trigram search, multimodal LLM (07) |
| CDN for static assets, PM2/Grafana | Replaced by the hosting platform's CDN and Pino/Sentry (07) |
| Training sessions, user/admin guides | Deliverables handled in the project plan (07 §8), not product scope |
| Admin impersonation with write access | D21-bis: impersonation exists and is read-only only (FL-29); every non-GET request under an impersonation session ⇒ `403 ADMIN_IMPERSONATION_FORBIDDEN_ACTION` |
| Credit top-ups other than credit packs | D17/D40: top-ups = credit packs only (web = Chargily checkout, mobile = store IAP); no free-form top-up |

### 4.3 Removed from V1 (dead or replaced)

| V1 item | Why |
|---|---|
| "Services" launcher page (3 of 4 cards "Soon"), "Commercial" nav item | Placeholders |
| 8 "soon" reports (warranty, service-jobs, warehouses, transfer, expiry, loyalty, attendance, login-activity) | Placeholders |
| Legacy page-scoped `/api/stock` + `src/lib/stock-api.ts`, `PageAISettings`, `AISettings` | Dead code / legacy flow |
| "Classic" analytics section on the overview | Merged into Home + Analytics |
| `/docs` page describing a non-existent `/api/v1`, footer `#` links, `/app` coming-soon | Replaced by Swagger, real links, store links |
| Maystro adapter | D9 |
| Expo push | FCM (D5) |

## 5. Phasing

| Phase | Content | Exit criterion |
|---|---|---|
| **P0 — Foundations** | Monorepo, CI, NestJS skeleton, Postgres/Prisma migrations, Redis/BullMQ, auth (refresh, 2FA, e-mail verification), workspace & roles, i18n, error contract, design system in Next.js, Meta App Review submission (D13), privacy/terms/data-deletion pages | Login → empty dashboard FR/AR/EN on staging; App Review submitted |
| **P1 — Core** | Channels (FB + IG), intake, inbox (real-time), agents, AI pipeline (text, image, voice), GDS catalogue + stock core, clients, orders, fee grid, notifications, credits, plans & billing, home | A real FB page **and** IG account answer customers and create COD orders end to end; all FL-01…07 ACs pass |
| **P2 — Integrations + GDS** | ZR Express + EcoTrack (send, label, tracking), Google Sheets (+ OAuth verification), suppliers/purchases/sales/cash register, 23 reports (D20), order payment links (D4), cross-sell, analytics (8 tabs), public API + webhooks, platform admin, V1 data migration | Go-live replacing V1 web with V1 parity |
| **P3 — Mobile & extras** | Flutter app (merchant features per [14-mobile-app.md](14-mobile-app.md) §2 + push), Yalidine adapter, optional auto-send, preference memory candidate | Apps published on Play Store / App Store |

The Flutter app can start as soon as the P1 API is stable (the API exposes `GET /app/version` and `POST /me/devices` from M0, IAP from M9); its screens are in the Figma pages Mobile V2 (base FR) + Screens (AR/EN) and its rules in [14-mobile-app.md](14-mobile-app.md).
