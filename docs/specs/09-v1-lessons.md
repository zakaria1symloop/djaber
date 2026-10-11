# 09 — V1 lessons → v2 requirements (regression list)

Sources: V1 code (verified inventories in `../audit/inputs/`), `bugs/*.md` (QA 11-05 and 12-05-2026), `ARCHITECTURE.md`. Each line is a v2 requirement with its location; 13 has a test per line. Mobile-side requirements apply to the Flutter app as specified in [14-mobile-app.md](14-mobile-app.md) (Figma pages Mobile V2 (base FR) + Screens (AR/EN)).

## 1. Structural gaps

| V1 | v2 | Where |
|---|---|---|
| Data scoped by nullable `pageId` or `userId`; 8 tables without FK | Workspace tenant, non-null FKs | 02 §1, 05 |
| Schema applied with `db push` (no migrations; `--accept-data-loss` in CI) | `prisma migrate` only | 05, 07 |
| Plan limits never enforced (hardcoded 1 agent) | Enforced per limit | 02 §5 |
| Chargily webhook signature never checked; verify endpoint replayable | Signed + idempotent | 06 §3, BIL-02 |
| Meta webhook signature never checked | Verified on raw body | MSG-01 |
| OAuth `state` = raw userId | Signed nonce | CHN-01 |
| Page tokens, AI keys plaintext | AES-256-GCM | 05 |
| 30-day JWT, no refresh, localStorage | 15 min + rotating refresh | AUTH-02 |
| No rate limiting anywhere | Throttler | AUTH-08, 06 §1 |
| In-memory message batcher | Redis delayed jobs | MSG-05 |
| Webhook processed inline; no retries; no dead-letter | Queues with retry policy; idempotent AI runs | 07 §3, 04 §5 |
| No real-time | WebSocket + fallback | INB-07 |
| No subscription expiry/renewal job; no IG token refresh; no cron at all | Scheduled jobs | 02 §5, CHN-12 |
| Credits check-then-consume race; `AI_ORDER_CREATED` never charged; unavailable message spammed on every message | Reservation; V1 costs; once per conversation/24 h | 02 §6, FL-01 F-4 |
| Expo push, no client | FCM | NTF-03 |
| CORS allows any `*.vercel.app` | Strict allowlist | 07 §6 |
| No monitoring, no tests beyond a custom harness | Pino/Sentry; unit/integration/e2e/evals/contract | 07 |
| Stock mode in localStorage; hint and mobile nav inconsistent | Workspace setting (`Workspace.stockMode`) drives both clients | ONB-03, 14-mobile-app.md |
| Legacy `/api/stock`, `PageAISettings`, `AISettings` | Removed | 01 §4.3 |
| Hard-coded page limit ∞ vs /10 | From plan | BIL-01 |

## 2. Missing or dead features

| V1 | v2 |
|---|---|
| Reset email links to a page that does not exist | AUTH-03 |
| "Delete account" button with no handler; no profile editing | AUTH-06/07 |
| `maxTeamMembers` with no team feature | 02 §3 roles |
| "Send to delivery" in confirm dialog permanently disabled | ORD-07 |
| No order export, no report export, no client export | ORD-09, GDS-10, CLI-05 |
| No explicit Cancel button on orders | ORD-08 |
| No second agent possible (button hidden, route redirects) | AGT-01 |
| Test chat shows placeholder product cards | AGT-07 |
| Delivery tracking shows raw JSON; send dialog not prefilled, no commune | DLV-04/05 |
| Clients list unpaginated; phone stored unnormalised → duplicates; hard delete | CLI-03/05, 04 §2 |
| Import writes immediately, no preview | CAT-06 |
| Get Started "agent" step never checks an agent | ONB-02 |
| Notification filter lacks `agent_insight`; stats per page only | NTF-01 |
| Products page ignores `?lowStock=true` | CAT-08 |
| Order filter Status overridden by the tab | ORD-05 |
| Sales filter offers `check`, labels `unpaid` vs `pending` | GDS-07 |
| `SaleItem` has no `variantId` | 05 §8 |
| Manual replies labelled "AI" after reload | INB-02 |
| Hardcoded English customer messages (unsupported media, voice off) and French (out of credits) | 04 §5: fixed platform texts `customer.unavailable` / `customer.unsupportedMedia` / `customer.voiceFailed` localized by the customer's last language (11 §9) + 4 workspace-editable system messages (D43) |
| Credits-exhausted notification typed `stock_alert`; no low-stock notification producer | NTF matrix |
| Docs page documents a non-existent `/api/v1`; footer `#` links; `cookies` page without route | 01 §4.3 |

## 3. AI defects (open at end of V1) → ACs

| Bug | AC |
|---|---|
| Human intervention rules have no effect | AI-08 evals |
| Vision broken; cannot read/send product images | AI-06 two-pass, MSG-07 |
| Voice not working | AI-07 |
| Product display template not applied | AI-09 |
| Cancel request created a new order (fixed late in V1 with `cancel_order`) | AI-04, FL-02 F-5 — keep fixed |
| Apply generated agent overwrote the single agent from any page | AGT-03 |
| AI replies reused the `HUMAN_AGENT` tag outside 24 h | MSG-06 |

## 4. Fixed in V1 QA — keep fixed (regression tests)

| Fix | Rule |
|---|---|
| Stock restored on cancel/return incl. call "rejected" path | 04 §3 `OrderEffects` |
| Cash rows removed with cancelled/deleted orders; no double credit; manual rows untouched | 04 §3 |
| Phone, wilaya, address required for order confirmation (`ORDER_ADDRESS_REQUIRED`) | 04 §1.6 |
| Names of only special characters rejected; alphanumerics allowed | 04 §2 |
| Errors inside the modal | 08 §1 |
| Duplicate client phone check | 04 §2 |
| Missing translations | CI i18n check |
| Wilaya/commune on order detail | ORD-06 |
| Revenue = sales + delivered orders; not pending | 04 §4 |
| Delivery stats from the server, same filter | 08 §1 |
| Caisse period pills ↔ table in sync; `dateTo` end of day | 04 §8, GDS-08 |
| Sale edit page exists | GDS-07 |
| Image URLs not double-prefixed | 05 ProductImage absolute URL |
| RTL toggles / range inputs | 08 §1 |
| Sidebar scrolls; "Ventes" once | 08 §1 |

## 5. Business-logic defects found in code (not in QA reports)

| V1 | v2 |
|---|---|
| Untracked products parked at 1 000 000 units and counted in valuation/dead stock/aging | CAT-01, GDS-10 |
| P&L subtracts COGS **and** purchase cash rows | 04 §4 |
| Revenue defined three ways | 04 §4 named figures |
| `sendOrderToDelivery` ignores the order's wilaya/commune/stop-desk, defaults to Algiers | DLV-05 |
| No confirmation guard before sending to courier | DLV-05 (confirmed/preparing only) |
| Fee quote lets courier live rate override the merchant grid | D15 |
| `paymentStatus` editable without `amountPaid` | 04 §1.4 |
| `deliveryStatus` free-form, never synced | 04 §1.5, DLV-04 |
| Any status allowed at order creation (even cancelled, still decrementing stock) | 04 §1.2 |
| Delete order removes manual cash rows | 04 §3 |
| Placeholder clients accumulate; conversation not re-linked | CLI-02 |
| Cross-sell conversions counted for every pair, never reversed; stale pairs never deleted | REC-03, D18 |
| Variant SKU not unique; variant low-stock not evaluated; untracked products purchasable | CAT-03, CAT-09, GDS-06 |
| Supplier `totalSpent` includes cancelled purchases | GDS-05 |
| Agent creation silently steals pages from other agents | AGT-05 |
| Disconnect keeps webhook subscription, token and agent link | CHN-06 |
| Consumption cost hardcoded $0.0005/credit | ANA-02 |
| Numbers use UTC date vs local end-of-day | 04 §8 |
| Page analysis synchronous, re-hosts non-product images | CHN-08 job |
| Transcription has no runtime fallback | AI-07 |
