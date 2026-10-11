# Djaber v2 — Confirmation audit of the revised specifications

**Date:** 2026-10-05 · **Auditor:** Fable (confirmation pass) · **Scope:** `docs/specs/README.md`, `01`–`13` (14 files, read in full)
**Inputs:** `2026-10-05-specs-audit-fable.md` (AUD-001…090), `2026-10-05-self-audit.md` (SA-01…44), V1 truth = `inputs/v1-backend-inventory.md`, `inputs/v1-gds-delivery-analytics-inventory.md`, `inputs/v1-web-inventory.md`. Read-only on specs.

---

## (a) Verdict

**READY WITH MINOR FIXES** — conditional on the 10 fixes in section (d) being applied in one text pass before the Figma web design starts.

| Item | Count |
|---|---|
| Prior findings re-verified | **134** (90 AUD + 44 SA) |
| … CLOSED | **125** |
| … PARTIALLY closed | **9** (AUD-014, AUD-027, AUD-050, AUD-054, AUD-055, AUD-063, AUD-066, SA-05, SA-42) |
| … OPEN | **0** |
| New findings (CF) | **33** — Blocker 0 · Major 12 · Minor 21 |

Why not NOT READY: every one of the 6 original blockers is closed in the text (Meta 24 h rules, App Review, parity statement, stock-mode table, idempotent AI runs, COD cash rule), the Decisions D11–D29 are applied consistently across files (no `in_transit` order status, no `past_due`, no `top_up` ledger kind, no impersonation, no `POST /workspaces`, no `tone`/`replyLength`, revenue = sales + delivered orders everywhere incl. 01 §3 and AT-ORD-10, credits 1/5/3 in 02 §6), and the new layer (10–13) is largely cross-consistent: every FL failure branch that names a code finds it in 11; every requirement ID cited in 13 exists in 03/04; every screen family in 08 §4 has a 12 section; every 06 endpoint traces to a requirement.

Why not READY: the rewrite introduced two regressions against D17 (FL-02 "debit 2 credits", FL-09 "top-ups") and left four behaviours defined three different ways across files (subscription expiry, e-mail verification, workspace ownership/transfer, IG token refresh threshold). A developer starting P0/P1 would also hit: no notification type keys or deep-link table (blocks NTF-01 filter and MOB-04), no billing `verify` endpoint although FL-09 and AT-BIL-01 depend on it, no 2FA login handshake, no field for a manual tracking number although D14 allows it, ~30 error codes in 11 §7–8 without ar/en text or UI behaviour, and 13 missing scenarios for ~20 P1 requirements despite claiming "one scenario per rule". All of this is text-level; only CF-03 needs an owner choice.

---

## (b) Status of all 134 prior findings

Legend: **C** closed · **P** partial · **O** open. "Where" cites the revised text that closes it.

### Fable audit AUD-001…090

| ID | Status | Where (file § / ID) | Note |
|---|---|---|---|
| AUD-001 | C | 03 MSG-06; 05 Message `deliveryStatus skipped_window`; 07 §7; 12 §4 "outside-window skipped label"; AT-MSG-05/06 | FB `POST_PURCHASE_UPDATE`, IG skipped outside 24 h, AI never tags, HUMAN_AGENT in App Review |
| AUD-002 | C | 03 CHN-01 scope table, CHN-11; README D13; 07 §7; 12 §0 "Approval pending" | See CF-25 for scope-list completeness of the review submission |
| AUD-003 | C | 01 §1 "100 % functional parity on the retained V1 modules"; README D11; 01 §4.1–4.3 | |
| AUD-004 | C | 03 ONB-03; README D12; 08 §3 "(advanced)" markers | Recommandations unassigned → CF-22 |
| AUD-005 | C | 04 §5 "Idempotent runs"; 05 AiRun/AiToolCall; 07 §3 core flow; AT-AI-05 | |
| AUD-006 | C | 04 §1.4 COD rule; 04 §3 row "Order → delivered (COD unpaid)"; FL-07 step 5; AT-ORD-02 | |
| AUD-007 | C | README D20; 01 §5 P2; 03 GDS-10 P2; 06 reports under "(P2)"; 08 §4.11 [P2] | |
| AUD-008 | C | 04 §1.2 (`confirmed/preparing → delivered`, `→ shipped` manual); README D14; AT-ORD-02 | Manual tracking number has no field → CF-09 |
| AUD-009 | C | README D15; 04 §4 `deliveryFee`; 03 DLV-01/07; AT-ORD-09 | |
| AUD-010 | C | 03 §15 rows "New message in a needs-human conversation (throttled 1/10 min)" and "Parcel created at courier" | |
| AUD-011 | C | 02 §5 "Limit enforcement" table; AT-BIL-04 | Quota 80/100 % notification not in matrix → CF-07 |
| AUD-012 | C | 02 §5 "Expiry / downgrade"; AT-BIL-02 | FL-09 F-4 contradicts "newest first" → CF-15 |
| AUD-013 | C | 02 §5 free Subscription at sign-up; 02 §6 reservation + once/24 h; FL-01 F-4; AT-BIL-03, AT-AI-14 | Yearly-cycle period ambiguity → CF-08 |
| AUD-014 | **P** | 05 §10 mapping table; README D3; AT-MIG-01 | Enum mappings present for Order/Client/Product/Subscription; **missing**: V1 `Notification.type` → v2 types, legacy `SL-`/`PO-` numbers, Plan field renames (CF-27) |
| AUD-015 | C | 03 CHN-12; FL-05 F-5; AT-CHN-05 | Threshold stated three ways → CF-14 |
| AUD-016 | C | README D10; 03 GSH-01/02 (Picker or pasted URL); 07 §7 Google OAuth verification | |
| AUD-017 | C | 03 AI-06 two-pass; CAT-02 caption; 05 ProductImage `aiCaption`; AT-AI-08 | |
| AUD-018 | C | 03 AI-02 (≤ 60 full dump, trigram top 30, embeddings P3); 05 Product trigram idx | |
| AUD-019 | C | README D4; 03 AI-04 `create_payment_link`, AI-05, PAY-02; 12 §5 payment link dialog; FL-10 | |
| AUD-020 | C | README D9; 03 DLV-05; 05 Workspace `autoSendToCourier` | |
| AUD-021 | C | 06 §5 scope whitelist; 03 API-02; AT-API-01 | |
| AUD-022 | C | README D16; 04 §4 named figures; 01 §3 "Average basket"; ANA-03; AT-ORD-10 | |
| AUD-023 | C | 04 §1.5 `failed` + reasons; 03 DLV-08; 05 Shipment `failureReason`; 03 §15 "Parcel failed / returned" | |
| AUD-024 | C | README D28; 03 MSG-08; 04 §9 Conversation row | |
| AUD-025 | C | README D7; 02 §1; 06 (no `POST /workspaces`); 08 §1 switcher "> 1" | Ownership/transfer tension → CF-03 |
| AUD-026 | C | README D18; 03 REC-02; 05 AiRun kind without `recommendation`; 07 queues | Job.kind lacks `recommendations` → CF-17 |
| AUD-027 | **P** | README D17; 02 §6 (order 0, analysis/generation free + 3/day) | **Regression**: FL-02 step 8 "debit 2 credits" (CF-01) |
| AUD-028 | C | 03 CAT-08 reused for list filters; GDS-09 single ID, P2; 08 §4.8 "expenses & margins adv. P2" | |
| AUD-029 | C | 03 ORD-05; 06 `GET /orders?…confirmationStatus&paymentStatus&deliveryStatus&hasRemaining&clientId`; 12 §5 filters sheet | |
| AUD-030 | C | 08 §4.15; 12 §0 global states; `past_due` removed | Paywall wording contradicts 02 §5 → CF-02 |
| AUD-031 | C | 02 §3 full matrix, "source of truth for `@RequirePermission`" | Operator playground share noted; status-change row vs 04 §1.2 → CF-32 |
| AUD-032 | C | 05 Shipment partial unique + `cancelled`; 03 DLV-10 `cancelParcel?`; AT-DLV-07 | |
| AUD-033 | C | 03 DLV-04 adaptive 2 h/12 h, stale 30 d, `getStatuses`, per-account limiter; AT-DLV-05 | FL-08 step 3 simplified → CF-16 |
| AUD-034 | C | 03 AUTH-09; 06 `POST /auth/verify-email(/resend)`; 05 EmailToken | Semantics stated three ways → CF-04 |
| AUD-035 | C | 06 §1 Uploads; 03 INB-03 `POST /uploads`; 05 Upload | |
| AUD-036 | C | 06 §6 WebSocket (`auth.expiring`, `since`/`resync`, rooms) | |
| AUD-037 | C | README D22; 01 §4.2 | |
| AUD-038 | C | 03 DLV-11; ANA-02 Delivery tab + payment success/failure + CDC §7.1 map | |
| AUD-039 | C | README D21; 03 ADM-08; 06 `/admin/conversations`, `/admin/products` | |
| AUD-040 | C | 03 CAT-03, CAT-09; 04 §3 variant rules; AT-CAT-03 | |
| AUD-041 | C | 03 AI-14, CAT-10; AT-AI-13, AT-CAT-07 | |
| AUD-042 | C | 04 §9 deletion table | |
| AUD-043 | C | 09 §4 "Sale edit page exists → GDS-07" | |
| AUD-044 | C | 09 §3 "keep fixed"; 09 §4 sidebar row | |
| AUD-045 | C | 09 §1 "`db push` (no migrations; `--accept-data-loss` in CI)" | |
| AUD-046 | C | 03 CHN-01 "All pages granted on Meta's consent screen are connected (V1)" | |
| AUD-047 | C | README D19; 03 INB-04; 05 Workspace `autoPauseOnManualReply`; 03 §20 | |
| AUD-048 | C | README D23; 05 Agent (no tone/replyLength); 03 AGT-06 | |
| AUD-049 | C | README D21, D26; 01 §4.2 | |
| AUD-050 | **P** | 08 §4.1 "Accept invitation (NEW)" still under "[P0]"; 03 §20 SET (members) P1; 01 §5 P0 "workspace & roles" | Pick one phase for members/invitations and tag 08 §4.1, 03 §20, 01 §5 identically |
| AUD-051 | C | 03 §15 (parcel failed, Sheets error, webhook disabled, invite, subscription, low-stock 1/day/product) | |
| AUD-052 | C | 06 `GET /products/:id/margins` once | |
| AUD-053 | C | 06: onboarding, print, `?type`, insight body, channel PATCH status, `GET /payments`, `clientId` | |
| AUD-054 | **P** | README glossary; 05/03 `humanHandoffRules`, `responseDelaySec`, `unknown_topic` | Leftover `responseDelay` in FL-01 step 9 (CF-17) |
| AUD-055 | **P** | 05 CreditLedger kinds (no top_up); README D17; 01 §4.2 | Leftover "top-ups" in FL-09 step 1 (CF-13) |
| AUD-056 | C | 05 Workspace has no `planId`; Subscription "plan derived from it" | |
| AUD-057 | C | 05 CourierAccount `baseUrl(default '')` | |
| AUD-058 | C | 05 SheetsRow "located by `djaber_id`"; GSH-03/04; AT-GSH-01 | |
| AUD-059 | C | 05 Order `orderedAt`; 03 ORD-01; 04 §2 dates | |
| AUD-060 | C | README D24; 04 §2 cost price row | Warning envelope undefined → CF-19 |
| AUD-061 | C | 04 §2 landline `^0[2-4]\d{7}$`; name "digits allowed" | |
| AUD-062 | C | 02 §6 reservation/settlement; 04 §5 Credits | Per-turn composition → CF-08 |
| AUD-063 | **P** | 03 AI-04 `get_shipping_fee(wilayaId\|name, isStopdesk, subtotal)` | FL-02 step 4 still `get_shipping_fee(wilaya, stopdesk)` (CF-17) |
| AUD-064 | C | 03 AI-05 wilaya not served; AI-06 several products; FL-02 F-2 | |
| AUD-065 | C | 01 §4.2 preferences excluded (P3 candidate) | |
| AUD-066 | **P** | 01 §4.2 (OAuth 2.0, sandbox, samples, CDN); ORD-12 fraud; ADM-07 export | Training "handled in the project plan (07 §8)" points at NFR; 07 §10 deliverables omit training |
| AUD-067 | C | 03 CAT-02 "warning below 600 px"; CAT-01 "plain text" | |
| AUD-068 | C | 03 ANA-02 CDC §7.1 widget map | |
| AUD-069 | C | 03 AGT-07 60 turns/h, free; 02 §6 | |
| AUD-070 | C | 03 AI-10 global fallback per capability; 05 AiModel `isFallbackText/Vision`; AGT-07 shows model | |
| AUD-071 | C | 05 User.locale / Workspace.locale notes | |
| AUD-072 | C | 03 MSG-02, MSG-09; 12 §4 thread message types; 11 §9 `unsupportedMedia` | |
| AUD-073 | C | 03 ORD-02; 04 §1.2 "Manual create may be `new` or `confirmed`" | |
| AUD-074 | C | README D27; 04 §3 "Order → returned" row; AT-ORD-06 | |
| AUD-075 | C | 03 CLI-02 merge rule; AT-CLI-01 | |
| AUD-076 | C | 03 BIL-04 credit calculator; 01 §4.3 classic analytics merged | |
| AUD-077 | C | 08 §4.1 public pages listed; 01 §4.3 `/docs` → Swagger, `/app` → store links | |
| AUD-078 | C | 08 §3 one line per module; Services next to Produits | |
| AUD-079 | C | 05 IdempotencyKey; 06 §1 Idempotency | Required/optional list → CF-33 |
| AUD-080 | C | 03 AUTH-07; FL-14; 11 `ACCOUNT_OWNS_WORKSPACE` | "transfer" has no flow → CF-03 |
| AUD-081 | C | README D25; 07 §1 | |
| AUD-082 | C | 03 MOB-07; README D29; 12 §15 | |
| AUD-083 | C | README D5; 03 MOB-02 | |
| AUD-084 | C | 03 ONB-02; FL-04 step 5; AT-UX-05 | |
| AUD-085 | C | 03 CHN-05; 06 `POST /admin/channels/:id/release`; 12 §14 | |
| AUD-086 | C | 03 DLV-09; 05 Commune, CourierCommuneMap | |
| AUD-087 | C | 02 §5 upgrade/downgrade/cancel; 03 BIL-05 | |
| AUD-088 | C | 06 §1 Bulk; AT-ORD-12 | |
| AUD-089 | C | 06 §7 export columns; GDS-10 > 5 000 rows job | |
| AUD-090 | C | 03 CAT-08; 06 `GET /products?…`; 12 §8 filters sheet | |

### Self-audit SA-01…44

| ID | Status | Where | Note |
|---|---|---|---|
| SA-01 | C | 04 §1.2 V1 statuses; `in_transit` only in `deliveryStatus` (04 §1.5) and Shipment (05) | |
| SA-02 | C | 04 §1.4, 04 §3, FL-07 step 5 | |
| SA-03 | C | 03 §11 intro; README D9 | |
| SA-04 | C | 03 DLV-05; FL-08 step 1; AT-DLV-01 | |
| SA-05 | **P** | README D17; 02 §6 | Owner took Fable default (order 0); FL-02 step 8 still debits 2 (CF-01) |
| SA-06 | C | 03 CHN-01 auto-connect + per-page report; FL-05 step 3–4 | |
| SA-07 | C | 03 MSG-07 (image + text P1, FB generic template P2, IG stays image + text) | |
| SA-08 | C | README D19 | |
| SA-09 | C | 03 CHN-12 | Threshold drift → CF-14 |
| SA-10 | C | 03 §15 rows (parcel created, needs-human message, credits exhausted customer message) | |
| SA-11 | C | README D21 | |
| SA-12 | C | 02 §5 `trial, active, expired, cancelled`; 05 Subscription | |
| SA-13 | C | 03 PAY-01; 05 Order/Sale `paymentMethod(cash/card/transfer/ccp/other)`; 05 §10 | |
| SA-14 | C | 03 DLV-09; 04 §2 commune "free text until seeded"; 05 CourierCommuneMap | |
| SA-15 | C | 03 CAT-01 `trackStock`; GDS-10; 04 §3; AT-CAT-02 | |
| SA-16 | C | 03 ONB-02; AT-UX-05 | |
| SA-17 | C | 03 AGT-03; 12 §9 Generate "apply (new agent / update linked agent confirm)" | |
| SA-18 | C | README D24 (warning instead of block); CAT-01 "same validation on create/update" | |
| SA-19 | C | 04 §2 SKU rule; 05 ProductVariant note | |
| SA-20 | C | 03 ANA-02 cost from `AiRun` tokens × model prices | |
| SA-21 | C | 03 GDS-08; 04 §3 "auto rows removed only" | |
| SA-22 | C | 03 ORD-08; 04 §9 Order; AT-ORD-07 | |
| SA-23 | C | 04 §1.3 guards verbatim | |
| SA-24 | C | 03 GDS-10 `[CDC §7.5]`, XLSX + PDF; P2 per D20 | |
| SA-25 | C | README D10; 03 GSH-* | |
| SA-26 | C | 03 DLV-10 "EcoTrack contract verified against provider docs before build"; 07 §9 contract tests | |
| SA-27 | C | 03 INB-03 "4 V1 defaults seeded per locale"; 05 QuickReply | |
| SA-28 | C | 03 AGT-02 four presets with parameters; 05 AgentPreset seeded | |
| SA-29 | C | 04 §2 Agent fields row | |
| SA-30 | C | 03 CAT-06; FL-12 | |
| SA-31 | C | 05 §10 Client row; AT-MIG-01 | |
| SA-32 | C | 03 CLI-02; FL-02 step 7 | |
| SA-33 | C | 04 §4 named figures; ANA-03 | |
| SA-34 | C | README D18; 03 REC-02 | |
| SA-35 | C | 03 REC-03; 05 RecommendationEvent | |
| SA-36 | C | 03 ORD-05; 08 §1 UX rule; AT-ORD-15 | |
| SA-37 | C | 03 NTF-01 | |
| SA-38 | C | 07 §6 raw body; 06 §3 | |
| SA-39 | C | 03 MSG-06 "AI never uses tags"; AT-MSG-06 | |
| SA-40 | C | 03 ONB-03 "web and mobile nav derive from the setting" | |
| SA-41 | C | README D26; 05 §10 CmsPage → `fr` | |
| SA-42 | **P** | 03 BIL-04 merchant calculator; ADM-05 "pricing calculator (V1)" | Admin calculator inputs/outputs (model, chats/day, % image/voice, credit peg, plan recommendation) still not described; absent from 12 §14 |
| SA-43 | C | 08 §4.13 Credits (ledger + calculator); 08 §4.10 per-page report; 01 §4.3 | |
| SA-44 | C | 01 §4.3 "Removed from V1" | |

Decision consistency sweep (D11–D29), grep-verified across all 14 files: no `in_transit` in `Order.status` (04 §1.2, 05 Order) · no `past_due` · no `top_up` ledger kind (05 CreditLedger) but one prose leftover (CF-13) · no impersonation except as exclusion · no `POST /workspaces` · no `tone`/`replyLength` · stock mode per D12 in ONB-03 and 08 §3 · revenue per D16 in 04 §4, 01 §3, ANA-03, AT-ORD-10 · credits per D17 in 02 §6 but not in FL-02 step 8 (CF-01) · order statuses per D14 in 04 §1.2, 12 §5 tabs, AT-ORD-01/02.

---

## (c) New findings

Severity: **Major** = a developer would build the wrong thing or stop to ask; **Minor** = ambiguity, leftover, or small gap.

| ID | Sev | File / section | Finding | Evidence | Concrete fix text |
|---|---|---|---|---|---|
| CF-01 | Major | 10 FL-02 step 8 | AI order still debits credits. Contradicts D17, 02 §6 ("AI order … 0") and AT-AI-04 ("1 credit (text) charged, 0 for order"). Regression from the rewrite. | FL-02 step 8: "recommendation conversion attribution, **debit 2 credits**." | Replace with "no credit for the order (D17); the turn's text/image/voice credits are settled in FL-01 step 14." |
| CF-02 | Major | 02 §5 · 04 §5 · 12 §0 · 08 §4.15 · FL-09 step 4 | Subscription expiry has three behaviours: 02 §5 "at expiry → free-plan limits, nothing deleted"; 04 §5 AI answers only if "subscription not expired" (so AI stops entirely); 12 §0 / 08 §4.15 "Paywall … mutations disabled except billing / read-only"; FL-09 step 4 "resources above the free limits are kept but read-only". | Quoted lines. | Single rule in 02 §5: "On `currentPeriodEnd` the paid Subscription becomes `expired` and a new free Subscription (`provider=none`, status `active`) is created the same instant; free-plan limits and credits apply; excess resources paused per the downgrade table; **no workspace-wide read-only**." Delete "subscription not expired" from 04 §5 (replace by "credits available on the current subscription"). 12 §0 Paywall row → "Plan expiré — limites du plan gratuit appliquées" banner + paused badges; remove "mutations disabled". Same wording in 08 §4.15. |
| CF-03 | Major | README D7 · 02 §1 · 05 User · FL-04 F-4 · FL-13 · 11 `LAST_OWNER`, `ACCOUNT_OWNS_WORKSPACE` · AUTH-07 | Ownership model is inconsistent: D7 "one owned workspace per user" and `User.ownedWorkspaceId→` (non-null) vs FL-04 F-4 "invited member signs up … no new workspace" (user owns nothing) vs FL-13 "Owner removes self ⇒ blocked unless another Owner exists" and `LAST_OWNER` "assign another owner" (several owners, i.e. transfer) vs `ACCOUNT_OWNS_WORKSPACE` "Delete or **transfer** your workspace first" — no transfer endpoint or flow exists, and a transferee already owns a workspace under D7. Invited-only users can never create a workspace (no `POST /workspaces`). | 05 §1 User; 06 Workspace & team endpoints; 10 FL-04/13; 11 §2. | Owner decision, Fable default: (1) exactly one Owner per workspace = `Membership.role=owner` unique per workspace; (2) `User.ownedWorkspaceId?` nullable; sign-up through an invitation link creates no workspace; (3) no ownership transfer in v2 — remove `LAST_OWNER`, change `ACCOUNT_OWNS_WORKSPACE` text to "Supprimez votre espace d'abord", FL-13 "Owner cannot be removed or demoted"; (4) invited-only users may create their own workspace later via `POST /workspaces` guarded by `ownedWorkspaceId IS NULL` (one per user, D7 intact) — or state explicitly that they cannot. Add as D30. |
| CF-04 | Major | 03 AUTH-09 · FL-04 step 2 · AT-AUTH-08 · 11 `AUTH_EMAIL_UNVERIFIED` | E-mail verification semantics differ: AUTH-09 "unverified accounts cannot connect channels and are reminded after 7 days" (block from day 0); FL-04 "usable unverified for 7 days, then verification required" (everything blocked after 7 d); AT-AUTH-08 "after 7 days cannot connect a channel" (block only channels, only after 7 d). | Quoted lines. | Pick one and copy it into all three: "Unverified users can use everything except **connecting a channel** (`AUTH_EMAIL_UNVERIFIED` immediately, dialog with resend); a banner appears from day 1; reminder e-mail at day 7." Update AT-AUTH-08 to "unverified account (day 0) cannot connect a channel". |
| CF-05 | Major | FL-09 step 3 · AT-BIL-01 · 06 Billing | "webhook … **or `verify`** ⇒ activate" and AT-BIL-01 "verify endpoint replay ⇒ no-op" reference an endpoint that 06 does not list (only `POST /billing/checkout`, `GET /billing/subscription`, `POST /billing/cancel`, `GET /billing/payments`). The checkout return page (`?payment=success`) has no defined way to learn activation if the webhook is late. | 06 §2 Billing; 10 FL-09; 13 AT-BIL-01. | Add to 06: `POST /billing/checkout/:checkoutId/verify` (Owner, workspace-scoped, calls Chargily `GET /checkouts/:id`, idempotent on `BillingPayment.providerCheckoutId`, amount must equal plan price × cycle). 12 §13 return page states: `verifying… / success / pending (webhook not yet received, auto-poll 5 s × 12) / failed`. |
| CF-06 | Major | 03 §15 · NTF-01 · MOB-04 · 05 Notification · 05 §10 | The notification matrix has no **type key** per row and no **deep-link target** column, although NTF-01 requires "filter by every type" and "deep links (web routes + mobile routes)", MOB-04 "deep links for every NTF row", 05 `Notification.type` is untyped, and 05 §10 cannot map V1 types (`ai_order`, `agent_insight`, `stock_alert`, `delivery_sent`, `paused_message`). | 03 §15 table columns: Event / In-app / Email / Push / Customer only. | Add two columns to 03 §15: `type` slug and `deep link`. Proposed: `order.ai_created`→Order page · `conversation.handoff`→Thread · `conversation.needs_human_message`→Thread · `agent.insight`→Agent page › Insights · `ai.error`→Queue · `stock.low`/`stock.out`→Products?lowStock=1 · `shipment.created`/`.out_for_delivery`/`.delivered`/`.failed`/`.returned`→Order page › delivery block · `payment.received`/`.failed`→Order page › payment · `channel.needs_reconnect`→Channels › page card · `channel.paused_by_plan`→Settings › Plan · `credits.80`/`credits.exhausted`→Settings › Credits · `subscription.expiring`/`.expired`→Settings › Plan · `member.invited`/`.joined`→Settings › Members · `sheets.error`→Settings › Integrations › Sheets · `webhook.disabled`→Settings › Integrations › Webhooks · `job.finished`→job result screen (import done / analysis review / bulk results dialog / export download). Declare the Postgres enum in 05 and the V1 mapping in 05 §10 (`stock_alert` credits rows → `credits.exhausted`, `paused_message` → `conversation.needs_human_message`). |
| CF-07 | Major | 03 §15 · 02 §5 · FL-03 F-1 · AUTH-09 · FL-14 · 05 Workspace · 03 §20 | Matrix is declared "single source of truth" and AT-NTF-01 is table-driven from it, but events defined elsewhere are missing: conversation quota 80 % / 100 % (02 §5 "Owner notified at 80 % / 100 %"); handoff unattended 30 min (FL-03 F-1 "Re-notify Owner"); e-mail verification reminder 7 d (AUTH-09); workspace deletion confirmation e-mail (FL-14). FL-03 F-1 says "(configurable)" but no Workspace field or Settings entry exists. | Quoted lines; 05 Workspace fields. | Add rows: "Conversation quota 80 % / 100 % — in-app ● email ● push —"; "Handoff unattended {n} min — in-app ● push ● (Owner)"; "Verify your e-mail (day 7) — email only"; "Workspace deleted — email only". Add `Workspace.handoffReminderMin (default 30, 0 = off)` to 05 and to 03 §20 / 12 §13. |
| CF-08 | Major | 02 §5–6 · 05 Subscription · 07 §3 `scheduled` · AT-AI-14 | (a) "Period = subscription period" makes `monthlyCredits` and `maxConversationsPerMonth` a 12-month bucket on yearly plans (12× too generous) — V1 reset was calendar-monthly. (b) Free plan has `billingCycle none`; who advances `currentPeriodEnd` monthly is unstated. (c) Per-turn cost composition is undefined: a turn with text + image costs 5 or 6? AT-AI-14 assumes 5 at balance 1 ("image message (cost 5)"). | 02 §6 "Period = subscription period"; 05 Subscription `billingCycle(monthly/yearly/none)`. | 02 §6: "Credit period = one month starting on the subscription's `currentPeriodStart` day-of-month (yearly plans and the free plan: 12 consecutive monthly periods; the `scheduled` job opens the next period at 00:00 Africa/Algiers). Same monthly period for `maxConversationsPerMonth`." Per-turn cost: "text 1 **or** image 5 **or** voice 3 — the highest applicable, one charge per turn (V1)". Update AT-AI-14 wording accordingly. |
| CF-09 | Major | README D14 · 04 §1.2 · 04 §1.5 · 05 Shipment/Order · 06 `POST /orders/:id/shipments` · 05 CourierCommuneMap | (a) D14 allows "`→ shipped` (manual tracking)" but `Shipment.courierAccountId→` is non-null and Order has no tracking field: the manual tracking number has nowhere to live; `deliveryStatus` for self-delivered orders (`not_sent`? `delivered`?) is undefined. (b) Stop-desk parcels need a stop-desk/centre id (Yalidine `stopdesk_id`, ZR centre) — `CourierCommuneMap.stopdeskIds` exists but Order, ClientAddress, Shipment and the `POST /orders/:id/shipments` body carry only `isStopdesk`; the V1 quirk "`stopdesk_id:''` never supplied" will repeat. | 05 §7; 06 Delivery; inv-gds §Delivery quirks. | 05: `Shipment.courierAccountId?` nullable + `provider(manual/zrexpress/ecotrack/yalidine)`, `Order.stopdeskId?`, `ClientAddress.stopdeskId?`, `Shipment.stopdeskId?`. 04 §1.5: "Manual `→ shipped` creates a Shipment `provider=manual`, status `sent`, optional `trackingNumber`; manual `→ delivered` sets `deliveryStatus=delivered` with no shipment." 06 shipment body: `+ stopdeskId? (required when isStopdesk and provider has stop-desks)`; send dialog (12 §6): "stop-desk select (from CourierCommuneMap) when stop-desk". |
| CF-10 | Major | 11 §7, §8, §5 (IMAGE_* row), §5 (`UNIT_IN_USE`) | The catalogue's own contract ("Every error: HTTP status, code, message fr/ar/en, UI behaviour, recovery") is not met for ~30 codes listed as compressed prose: §7 (9 codes, fr only or none, "All inline/toast"), §8 (20 codes, no ar/en, several with no UI: `PLAN_NOT_FOUND`, `PLAN_IS_FREE`, `PLAN_IN_USE`, `SUBSCRIPTION_ALREADY_ACTIVE`, `SHEETS_NOT_CONNECTED`, `ADMIN_CANNOT_DEMOTE_SELF`, `CMS_SLUG_INVALID`), IMAGE_* row with "…" for ar/en. 07 §4 says CI fails on missing i18n keys; P1 billing codes are among them. | 11 §7–8 as written. | Expand §7 and §8 into full table rows with the six columns; fill the IMAGE_* and `UNIT_IN_USE` ar/en cells. |
| CF-11 | Major | 13 (whole) · 04 line 3 "Each rule has a unit test (13)" · 13 line 3 "One scenario per rule" | P1 requirements with **no** scenario in 13: ONB-01/03, CHN-03/05/07/08/09, MSG-02/04/07, INB-01/05/06/08/09, AGT-01/02/03/04/05/06/08/09, AI-11/12/13, CAT-05/07/08/11, CLI-03/04, ORD-01/02/04 (except rejected path)/06/07 result step/10/11, DLV-01 seed/09, PAY-01, NTF-01/02/03, ANA-01, BIL-01/03/04/05, 04 §8 dates, 04 §9 cascades for agent/channel/conversation/member, 04 §10 counters; FL-05 F-1/F-3/F-6, FL-06 F-2/F-5, FL-07 F-2/F-5/F-6, FL-09 F-1/F-4, FL-12 column errors, FL-14, FL-15. (P2 GDS/REC/ANA/ADM/GSH have almost none.) | Cross-check of "Covers" column against 03/04/10 IDs. | Either add the scenarios (≈ 45 rows) or change both claims to "critical rules" and add a coverage column to 03 ("AT: …") so gaps are visible. Minimum for P1: AGT-05 move dialog, INB-05 reopen-on-message, INB-06 auto-assign, ORD-07 result step buttons, CAT-05 adjust variants/untracked, CLI-04 aggregates, NTF-01 filter/unread count, NTF-03 token pruning, ONB-03 nav derives from setting, 04 §9 agent delete, channel disconnect, 04 §10 counter after migration. |
| CF-12 | Major | 03 AUTH-05 · 06 Auth · 11 `AUTH_2FA_REQUIRED` · 12 §1 Login | The 2FA login handshake is undefined: login returns `AUTH_2FA_REQUIRED` (401) but nothing says how the client proves the first factor to `POST /auth/2fa/verify` (no challenge/`mfaToken`, no TTL, no rate-limit key); recovery-code regeneration has no endpoint; "Super Admin cannot disable 2FA" (AT-AUTH-07) has no error code. | 06 lines 32–38; 11 §2. | 06: `POST /auth/login` → `200 { mfaToken (5 min, single use) }` when TOTP enabled; `POST /auth/2fa/verify { mfaToken, code \| recoveryCode }` → tokens; `POST /auth/2fa/recovery-codes` (password) regenerates 10 codes; `POST /auth/2fa/disable` ⇒ `403 TWO_FA_REQUIRED_FOR_ROLE` for Super Admin (add to 11 §2). AUTH-08 rate limit keyed on `mfaToken`. |
| CF-13 | Minor | FL-09 step 1 | "balance = plan monthly + **top-ups** − debits" — top-ups are excluded (D17, 01 §4.2). | Quoted. | "balance = `monthlyCredits` − Σ debits in the current credit period (02 §6)". |
| CF-14 | Minor | FL-05 F-5 · CHN-12 · AT-CHN-05 | IG token refresh threshold: FL-05 F-5 "Scheduled refresh at 30 d"; CHN-12 "when `tokenExpiresAt < now + 10 d`"; AT-CHN-05 "expiresAt in 9 d ⇒ refresh". | Quoted. | Align FL-05 F-5 to CHN-12: "daily job refreshes when `tokenExpiresAt < now + 10 d`; failure ⇒ F-4". |
| CF-15 | Minor | FL-09 F-4 · 02 §5 | Downgrade with excess pages: FL-09 F-4 "Owner picks which to keep"; 02 §5 "newest first" automatic. | Quoted. | FL-09 F-4: "Pages beyond the limit are paused automatically (newest first, 02 §5); the Owner may swap which pages are active from the Channels list (resume one ⇒ pause another, confirm dialog)." |
| CF-16 | Minor | FL-08 step 3 · FL-07 step 6 · ORD-06 · 12 §5 Order page | Simplified/contradictory restatements of 04: FL-08 "poll every 2 h while non-terminal" (DLV-04: adaptive 2 h/12 h, stale 30 d); FL-07 step 6 "returned ⇒ stock restored" unconditionally (04 §3: only after "return received") and actor `U` generic (04 §1.2: `delivered → returned` Admin+); ORD-06/12 §5 "read-only when delivered" yet `delivered → returned` must stay available. | Quoted. | FL-08 step 3 → "per DLV-04 cadence"; FL-07 step 6 → "returned (Admin+ from `delivered`) ⇒ auto income rows removed, return cost expense (D27); stock restored when 'return received' is ticked"; ORD-06 → "read-only fields; actions limited to Mark returned (Admin+) and notes". |
| CF-17 | Minor | 10 FL-01 step 2/9, FL-02 step 4, FL-06 step 3 · 04 §9 · 03 CAT-10 · 05 Job | Leftovers: FL-01 step 2 dedup key `(channelId, externalMessageId)` vs MSG-03/05 `(conversationId, externalId)`; FL-01 step 9 `responseDelay` (glossary: `responseDelaySec`); FL-02 step 4 `get_shipping_fee(wilaya, stopdesk)` lacks `subtotal` (AI-04); FL-06 step 3 "(D-default)" → D19; 04 §9 Workspace row "purge after 30 days (D)" dangling tag; CAT-10 contains drafting self-talk ("blocked only while referenced by an open order? No — allowed;"); `Job.kind` lacks `recommendations` (REC-02) and `labels` (12 §6 "merged (job)"). | Quoted. | Apply the glossary and the referenced IDs; rewrite CAT-10 as "Archive (soft delete) is always allowed; SKU freed; …"; add the two Job kinds; number the workspace purge decision (D31: 30 days). |
| CF-18 | Minor | FL-01 steps 7, 8, 10, 13 · MSG-07 | FL-01 omits: the credit **reservation** at job start (02 §6; AT-BIL-03) — step 8 only "checks", step 14 "debits"; the conversation-quota gate (02 §5) alongside the credit gate; image-only message with `imageRecognition` off ("drop images, continue with text" ⇒ empty turn) should fall to the `unsupportedMedia` reply; max product cards per reply (V1 ≤ 5). | Quoted. | Step 8: "credit **and** conversation-quota gate; insufficient ⇒ F-4"; step 10: "reserve planned credits (`reserved` row)"; step 7: "image-only and recognition off ⇒ F-3"; MSG-07: "≤ 5 cards per reply". |
| CF-19 | Minor | 04 §2 · 11 §10 · 06 §1 | Field error keys `product.sku_taken`, `client.phone_taken` sit outside the `validation.*` namespace that 11 §10 says `fields` map to; it is unclear whether SKU/phone conflicts return `409 PRODUCT_SKU_ALREADY_EXISTS` or `422 VALIDATION_ERROR` + field; `warning.selling_below_cost` has no place in the response envelope (06 §1 defines errors only) and no fr/ar/en text. | Quoted. | 04 §2 keys → `validation.sku_taken`, `validation.phone_taken`; rule: "conflicts return the 409 code **and** `fields:{sku:'validation.sku_taken'}`". 06 §1: success envelope `meta.warnings[{code, params}]`; 11: new §"Warnings" table with `SELLING_BELOW_COST` fr/ar/en, UI = inline hint, non-blocking. |
| CF-20 | Minor | 06 vs 12 §8, §13; INB-01 | Behaviours specified in 12/03 without an endpoint: product restore (12 §8 "archived state (restore)"; archive is `deletedAt`, not `isActive`); invitation resend (12 §13 "resend/revoke"); Inbox tab server counts (INB-01) — `GET /conversations` returns only `meta.total`. | Quoted. | Add `POST /products/:id/restore` (409 `PRODUCT_SKU_ALREADY_EXISTS` if SKU reused), `POST /workspace/invitations/:id/resend` (60 s cooldown), `GET /conversations/counts?channelId` → `{all, active, needs_human, resolved, archived, unread}`. |
| CF-21 | Minor | 11 | Codes needed by stated behaviour but absent: courier delete blocked with active shipments (12 §6) → `COURIER_HAS_ACTIVE_SHIPMENTS`; workspace suspended (ADM-02) → `WORKSPACE_SUSPENDED` 403 + 12 §0 state; `SALE_INSUFFICIENT_STOCK` (V1, GDS-07); `IMAGE_ANALYSIS_UNAVAILABLE` 503 (V1); generic `UPLOAD_TOO_LARGE` / `UPLOAD_TYPE_INVALID` for pdf/audio uploads (06 §1). `STOCK_INSUFFICIENT` and `ORDER_INSUFFICIENT_STOCK` coexist without a usage rule. | 11 §5–6; 06 §1 Uploads. | Add the five codes with fr/ar/en + UI; note "`STOCK_INSUFFICIENT` = stock adjustments and sales lines; `ORDER_INSUFFICIENT_STOCK` = order lines (manual and AI tool)". |
| CF-22 | Minor | README D12 · 03 ONB-03 · 08 §3 | Recommandations in simple mode is unassigned: D12/ONB-03 list it neither in "hides" nor in "keeps"; 08 §3 marks it "(P2)" only. V1 simple mode hid Cross-Sell. | inv-web §2. | Add "recommendations" to the D12 hidden list (V1 parity) and mark 08 §3 "Recommandations (advanced, P2)". |
| CF-23 | Minor | 08 §3 vs 08 §4.4, 12 §4 | Queue content drifts: nav "(needs-human + insights + **failed parcels**)" vs screen "Queue (needs-human + insights)" vs 12 §4 Queue list without parcels. | Quoted. | Queue = needs-human conversations + pending insights; nav badge = their sum; failed parcels remain on Home "À traiter" and Delivery › Overview. |
| CF-24 | Minor | 08 §4.1, §3 vs 12 | Screens without states in 12: Pricing, Legal & CMS pages, Landing/features/help (public: loading, 404, unpublished slug, locale fallback when a CMS locale is missing), the "Aide" nav item (in-app help target undefined), and Settings sub-sections Quick replies / System messages / Workspace profile only covered by the generic "default, saving, saved toast, validation". | 12 §1, §13. | Add 12 §1b "Public & CMS": `[S] · published · unpublished/404 · locale fallback to `fr` with notice`; define "Aide" = link to the public help page in the user's locale; add Quick replies (list/[E]/add/edit/delete/reorder) and System messages (3 × 3 with preview, reset to default) rows. |
| CF-25 | Minor | 03 CHN-11 · 07 §7 vs CHN-01, CHN-03 | App Review submission list (`pages_messaging`, `instagram_manage_messages`, `pages_read_user_content`, Human Agent) omits scopes CHN-01/03 request that also need advanced access for non-role users: `pages_read_engagement`, `pages_manage_metadata`, `instagram_basic`, `business_management`, `instagram_business_basic`, `instagram_business_manage_messages`. Whether `business_management` is actually needed is unverified. | CHN-01 scope table. | CHN-11: "submit **every** scope listed in CHN-01 and CHN-03 plus Human Agent; verify on the V1 app which already hold advanced access; `business_management` only if `/me/accounts` returns business-owned pages without it in testing." |
| CF-26 | Minor | README Decisions · 03 AUTH-09, AI-02 · 04 §5 · GSH-06 | Items tagged **new** or untagged with no V1/CDC/PH2 source and no Decision: AUTH-09 e-mail verification; 04 §5 abuse guard "≥ 50 inbound / 10 min ⇒ handoff" (and FL-01 F-8 "20+ in 1 min ⇒ window 10 s"); AI-02 "≤ 60 products" threshold; GSH-06 filters (D10 covers one-way only). README states "nothing invented beyond the sources". | Quoted. | Add D30–D33 (or source tags) for these four; keep them. |
| CF-27 | Minor | 05 §10 | Migration rows missing: V1 `Notification.type` → v2 types (needs CF-06); legacy sale `SL-YYYYMMDD-NNNN` and purchase `PO-…` numbers (kept or renumbered `VNT-`/`ACH-`? only orders say "numbers kept"); V1 Plan `maxConversations→maxConversationsPerMonth`, `maxTeamMembers→maxMembers`, `currency` dropped; V1 `Page.isActive=false` rows still hold a plaintext token — state "token discarded, status `disconnected`". | 05 §10 rows Sale/Purchase "same", Plan "same". | Add the four rules; default: legacy sale/purchase numbers preserved, counters start after max. |
| CF-28 | Minor | AT-ORD-07 · 04 §9 Order · ORD-08 | "delete shipped ⇒ rollback then deleted" ignores an active courier parcel (Shipment `sent`/`in_transit`): the courier still delivers and collects COD for a deleted order. | 05 Shipment partial unique; DLV-10 `cancelParcel?`. | 04 §9 Order: "hard delete blocked while a Shipment is active (`DELIVERY_ORDER_ALREADY_SENT`); cancel the parcel first (adapter `cancelParcel`, else mark returned)". Update AT-ORD-07 to "delete shipped with manual shipment ⇒ ok; with active courier parcel ⇒ 409". |
| CF-29 | Minor | 01 §3 Abandon rate · 04 §1.1 · 05 Conversation.context | The KPI needs a stored "recap shown" event; `Conversation.context.cart` has no timestamp or flag, and nothing clears the cart after order/cancel. | Quoted. | 04 §1.1: "`context.cart = {items[], recapShownAt?, orderId?}`; `recapShownAt` set when the AI sends the recap (FL-02 step 5), cart cleared on `create_order` or 7 days after `recapShownAt`; Abandon = carts with `recapShownAt` in period and no `orderId`". |
| CF-30 | Minor | ORD-12 · FL-02 F-3 · 05 Client.riskLevel / Order.riskLevel | Evaluation moment undefined beyond creation; two fields with no derivation rule; what the inbox "risk badge" (12 §4) reads from. | Quoted. | "Client.riskLevel recomputed on every order cancellation and nightly (`high` if ≥ 3 cancelled in 30 d); Order.riskLevel = Client value snapshotted at creation; badges read Client (list/inbox) and Order (order page)". |
| CF-31 | Minor | 03 vs inv-web §3, inv-gds §Analytics, inv-backend §Agents/§Admin | Small V1 behaviours neither carried nor excluded: header sound on rising unread (V1 WebAudio beep); Analytics › Channels `potentialScore` + note; agent metrics `lastActiveDate`; admin users filters `activity=with-pages\|with-agents\|inactive`, min/max pages/products/revenue; Plan `currency` field. | Inventories cited. | Add to 01 §4.3 "Removed from V1" (beep, potentialScore, currency) or to the requirement (AGT-09 `lastActiveAt`; ADM-02 filters "as V1"); add NTF-02 "sound on new message (web, default off)". |
| CF-32 | Minor | 02 §3 row "orders: … status change ● ● ●" vs 04 §1.2 | Matrix grants Operator every status change; 04 §1.2 restricts `delivered → returned` to Admin+ (and 12 §5 return dialog). | Quoted. | Footnote in 02 §3: "`delivered → returned` and fee/discount edits: Admin+ (04 §1.2)". |
| CF-33 | Minor | 06 §1 Idempotency | "`Idempotency-Key` on every mutating POST" does not say whether it is required (400 if absent) or optional, nor who generates it (web/mobile/API clients). | Quoted. | "Required (400 `IDEMPOTENCY_KEY_MISSING`) on `POST /orders`, `/sales`, `/purchases`, `/orders/:id/shipments`, `/shipments/bulk`, `/conversations/:id/messages`, `/billing/checkout`, `/products/import/:jobId/commit`; optional elsewhere; clients generate UUID v4 per submit attempt and reuse it on retry." Add the code to 11 §1. |

### Cross-file checks performed (section 3 of the brief) — results

| Check | Result |
|---|---|
| Every FL failure branch names a code that exists in 11 | Yes for all named codes (FL-01 F-6, FL-02 F-5, FL-04 F-1, FL-05 F-2/F-3, FL-06 F-3, FL-07 F-1…F-6, FL-08 F-1/F-2/F-3/F-6, FL-09 F-1/F-3, FL-10, FL-11, FL-12, FL-13, FL-15). Branches without a named code (FL-01 F-1…F-5, F-7…F-9, FL-02 F-1…F-4, FL-03 F-1/F-3) are system behaviours, not API errors — acceptable; see CF-18 for FL-01 gaps. |
| Every FL branch maps to a state in 12 | Yes (thread banners/labels in 12 §4; dialogs in §5–6; connect report in §10; return page in §13). |
| Every code in 11 has a UI behaviour | No — §7/§8 compressed lists (CF-10). |
| Every requirement ID in 13 exists in 03/04 | Yes, all 160 references resolve. Reverse direction fails (CF-11). |
| Every 08 §4 screen has states in 12 | Yes for merchant/admin screens; public pages and "Aide" missing (CF-24). |
| Every NTF row has a deep-link target in 08 | Targets exist in 08 §4 but the mapping is unwritten (CF-06). |
| Every 06 endpoint ↔ requirement | Forward: all endpoints trace (incl. `GET /payments` → CDC §8.1, `POST /webhooks/google` optional). Reverse: four missing endpoints (CF-05, CF-12, CF-20). |
| Decisions D11–D29 applied consistently | Yes except FL-02 step 8 (D17), FL-09 step 1 (D17), FL-09 F-4 (D12/02 §5 downgrade rule), FL-05 F-5 (CHN-12). |
| V1 parity regressions in the rewrite | None of substance; small items in CF-31; sale/purchase number migration unstated (CF-27). |
| Inventions without Decision tag | CF-26 (four items). |

---

## (d) The 10 most important remaining fixes (apply before Figma)

1. **CF-01** — FL-02 step 8: delete "debit 2 credits"; AI orders are free (D17).
2. **CF-02** — One expiry rule: expired paid plan ⇒ free Subscription created, free limits/credits, excess resources paused; remove "subscription not expired" from 04 §5 and "mutations disabled" from 12 §0 / 08 §4.15.
3. **CF-03** — Decide ownership (owner choice): single Owner per workspace, `ownedWorkspaceId` nullable for invited sign-ups, no transfer in v2 (drop `LAST_OWNER`), state whether invited-only users may create a workspace.
4. **CF-06** — Add `type` and `deep link` columns to the NTF matrix, the Postgres enum in 05, and the V1 type mapping in 05 §10.
5. **CF-08** — Credit/quota period = monthly on all cycles; free-plan period advanced by the scheduled job; per-turn cost = highest applicable (1/5/3), one charge per turn.
6. **CF-09** — Manual shipment model (`Shipment.provider=manual`, nullable courier, tracking number) and `stopdeskId` on Order/ClientAddress/Shipment + send body.
7. **CF-05** — Add `POST /billing/checkout/:checkoutId/verify` and the return-page states (verifying / success / pending-poll / failed).
8. **CF-04** — One e-mail-verification rule copied into AUTH-09, FL-04 step 2 and AT-AUTH-08.
9. **CF-12** — Define the 2FA login handshake (`mfaToken` → `/auth/2fa/verify`), recovery-code regeneration, and the Super Admin disable error.
10. **CF-10** — Expand 11 §7–8 (and the IMAGE_* / `UNIT_IN_USE` cells) into full rows with fr/ar/en, UI behaviour and recovery.

Then in the same pass, 15 minutes each: CF-07 (matrix rows + `handoffReminderMin`), CF-11 (missing P1 scenarios), CF-13/14/15/16/17 (leftovers), CF-22 (recommendations in simple mode).

---

## Method

All 14 spec files were read in full; the two prior audits and the three V1 inventories were read in full. Each of the 134 prior findings was located in the revised text by section/ID; "closed" means the proposed fix (or the owner's Decision) is present and not contradicted elsewhere; "partial" means present but with a surviving contradiction or leftover, cited. Decision consistency was verified by regex sweep over all files (`in_transit`, `past_due`, `top_up|top-up`, `impersonat`, `POST /workspaces`, `tone`, `replyLength`, `BO-01`, `rowNumber`, `planId`, `2 credits`, `pending`). Cross-file checks were done by enumerating every FL branch, every 11 code, every 13 "Covers" value, every 08 §4 screen, every NTF row and every 06 endpoint against their counterparts. No spec file was modified.
