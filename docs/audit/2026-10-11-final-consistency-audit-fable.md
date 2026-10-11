# Final consistency audit — Djaber AI v2 spec + implementation pack (2026-10-11)

Auditor: Fable 5.1 (final auditor and finaliser). Mandate: close every open decision (owner delegation of 2026-10-11), fix every inconsistency in place, and give the coding model (Opus) a zero-question pack. Inputs: `docs/specs/README.md` + 01…14, `docs/implementation/*` (00–10, CLAUDE.md, prisma-schema.prisma, api-contract.md), `docs/figma-*.md`, the Figma pages "Web V2" (124 frames) and "Mobile V2" (259 frames) read in text mode.

Companion documents: `decisions-log-2026-10-11.md` (every decision closed, with the rejected alternative and the files touched) and `figma-text-fixes.md` (machine-applicable Figma text corrections, page column Web V2 / Mobile V2).

## 1. Method

1. Marker inventory (`PROPOSED | TBD | to confirm | owner to confirm | ⏳ | open question | to define | if accepted | could | might | optionally | e.g. where a value is required`) over specs + implementation: 35 lines in README, 27 in 05, 24 in 06, 17 in 13, 13 in 00, 12 in api-contract, 26 in the Prisma schema, 1–7 in each other file (≈ 200 lines).
2. Four read-only audits in parallel: error codes (11 vs every other file), notification types + enums (schema vs prose), traceability (Figma frame ↔ 08/12 ↔ 02-route-map ↔ 06/api-contract ↔ Prisma), permissions + entity names + ambiguous sentences.
3. Rulings written once (`rulings.md`, 60 rulings R-A…R-S), then applied by six fix passes with disjoint file ownership, then a reconciliation pass (page size, ticket auto-close, trust-level body, tab slugs, soft wording) and the final greps below.
4. Figma text verified from the real text layers (both pages fully dumped; one frame, Mobile V2 [196] "Dashboard analytics", may be truncated after "INSTAGRAM" — it carries no code or value).

## 2. Findings table

Severity: **H** = would make the coder guess or build the wrong behaviour; **M** = contradiction between two files; **L** = wording / naming.

| id | sev | files | what | fix applied |
|---|---|---|---|---|
| F-01 | H | README, 03 §19, 04 §17, 05 §14, 06, 10, 12, 13, 00, 01, api-contract, prisma | Impersonation: "none" (D21) vs read-only vs write mode with Owner e-mail; `ImpersonationMode` enum, `mode`, `ownerNotifiedAt` in the schema | Read-only only (D21-bis); enum and columns removed; endpoints `/admin/impersonation/sessions`; every non-GET ⇒ 403; matrices regenerated |
| F-02 | H | README D43, 03 §20, 05 §1, 11 §9, 12 §13, 04-ai, 06-i18n, api-contract, prisma, 00 §6 | System messages: 3 keys vs 4 keys (`unavailable, handoff, unsupportedMedia, voiceFailed`) vs Figma 4 (handoff, hors horaires, rupture, accueil); agent-level `handoffMessage`/`outOfHoursMessage` | 4 workspace keys `handoff, out_of_hours, out_of_stock, welcome` with behaviour and fr/ar/en defaults; 3 fixed platform texts; agent columns removed |
| F-03 | H | README D49, 02 §5, 04 §14, 05 §2, 13 AT-BIL-10, 03-events §4, prisma | Dunning: suspension J+7 + read-only vs "expired ⇒ free plan"; `past_due`; `SubscriptionStatus.suspended`; credit notes | J−7 / J0 / J+3 / J+7 ⇒ `expired` ⇒ free-plan limits; no suspension for non-payment; enums fixed; no credit note (over-payment ⇒ 422) |
| F-04 | H | README D30/D51, 02 §1, 04 §16, 06 §8.1, 10, 12, 02-route-map (dialog "render disabled") | Ownership transfer forbidden (D30) vs drawn and required by deletion flow; two endpoint spellings; 2FA-only body | `POST /workspaces/:id/transfer-ownership { newOwnerUserId, password, totpCode? }`, Owner only, old owner → Admin |
| F-05 | H | README D54/D23, 04 §18, 05 §15, api-contract, prisma, 04-ai | Wizard fields "conflict D23"; `Agent.config` blob vs columns; model choice in Figma step 4 | Structured columns compiled into prompt fields at every save; no model choice; preset temperature/maxTokens |
| F-06 | H | README D52, 04 §12, 05 §11 | Trust-level promotion "⏳ to define" | new → standard automatic (≥ 10 approved, 0 rejected / 30 d), standard → trusted manual, → watch automatic, job `sched-trust-levels` |
| F-07 | H | 04 §18, 02 §5, 03 §30, 13 | Drafts counting toward `maxAgents` "owner to confirm" | Drafts never count; limit checked at activation |
| F-08 | H | README D64, 03 GDS-06, 04 §3/§20, 11 §7 vs §12.4, 13 | Over-receipt 422 vs warning; cost unchanged vs weighted average; `PURCHASE_OVER_RECEIVE` defined twice | Warning 200 ⚠ once; weighted average with half-up rounding |
| F-09 | H | 00 §0, 05-integrations §4, 07, 01, README D40/D58, CLAUDE.md, 03 §17/§28 | SATIM gateway vs Chargily; `PAYMENT_PROVIDER=satim\|chargily`; "SATIM" in 40+ places | Chargily Pay only behind `PaymentGateway`; SATIM = rails name in one sentence of 05-integrations §4.1 |
| F-10 | H | 02 §5, 07 §7, README | Seed plans "final numbers from the owner before M9"; `business` plan; free 300 credits | D68 values (free/starter/pro, 100/1 500/5 000 credits, prices 0/1 900/4 900) + packs 450/1 500/3 900 DA |
| F-11 | H | 11 §13, 06-i18n §5, 13 AT-ERR-11, 00 §6, 03/05/06/02/09/api-contract | 19 alias spellings used outside 11 §13; a second "codes to append" table in 06-i18n; `ORDER_LIMIT_EXCEEDED`, `MODERATION_PENDING`, `WORKSPACE_READ_ONLY`, `MAINTENANCE`, `IAP_ALREADY_CREDITED` not codes; 8 codes used but undefined | 11 single source: 5 codes added (`WORKSPACE_REQUIRED`, `INTERNAL`, `AUTH_REFRESH_REUSED`, `DEVICE_LIMIT`, `MODERATION_NOT_REJECTED`), 10 alias rows added to §13, every prose occurrence rewritten; 06-i18n §5 = pointer |
| F-12 | H | 03 §15 (30 rows) vs 05 §17 (26 rows) vs prisma (56), 03-events §5.1 (catch-all row), 06-i18n §2.10 (22 keys), 03 §35 French paths | Notification types split across two tables; 12 old slugs; deep links in French vs English routes; 20 types without producer | 03 §15 = 56 rows (checked by script against the enum); 05 §17 pointer; 03-events §5.1 = 56 rows with producer + throttle; i18n = 56 keys; English deep links everywhere |
| F-13 | M | 02 §3 vs 06 §9 vs 07 §1.1 vs 01 §3.2 vs 02-route-map | 27 permission disagreements (Operator sales, reports CSV, members list, credits pill, moderator impersonation, missing keys for import/transfer/views/support) | One table in 01 §3.2; the four others regenerated from it |
| F-14 | M | 02-route-map §3 vs 06/api-contract | 58 endpoint spellings on 34 route rows differ from 06; 17 duplicate paths inside 06; 13 frames with no route row; 16 route frames not cited in 08 | API column regenerated; one spelling per resource; rows `/s/[code]`, `/agent-test/[token]`, `/orders/import`; §3.6 non-route frames; 08 §7.16 full frame index |
| F-15 | M | 12 §17/§20/§24/§26 vs 06 | 14 drawn states without endpoint (jobs cancel/retry, schedule, favourites, compare, pay invoice, mark-failed, template message, stock snapshot, free delivery per wilaya, trusted device, stored cards) | 13 endpoints added to 06; `DeliveryFeeRule.freeAbove` + `ReportSchedule` added to the schema; trusted device and stored cards removed |
| F-16 | M | 03/04/05/06/10/12/13 vs prisma enums | 38 enum spelling mismatches (`pending_approval`, `image`, `merchant\|auto`, `awaiting_customer`, `deletion_policy`, `read_only`, `alerts`, `open`, `ordered`, `cash_day`, `absent`, `ignore_30d`, bare `adjustment`, 11-value `MovementReason`, `kind=pack`, `manual\|iap`, `content_rules` as suspend reason …) | Schema values everywhere; `PausedReason.moderation` added |
| F-17 | M | 04 §1.5/§22, 11 §13, 06-i18n §4, 05-integrations §2 | `picked_up`: status in the schema, "event only" in prose; `created` as a status | `picked_up` is a status; `created` → `sent`; mapping tables updated |
| F-18 | M | 00 §0 line 40 vs §2 M2, 01 §6, 08 §8 | `SkuRegistry`: "not in schema" vs "decided table" | Partial unique index, no table |
| F-19 | M | 00, 01, 03-events, 07, 08 | `DailyStat` used as a model but absent from the schema | Model added |
| F-20 | M | 06 §1, api-contract §1.4–1.5, 09 §2.1, CLAUDE.md | Envelope: `{ items, page… }` shorthand; error body without `details`/`ref`; `AppException` without `details` | `{ data, meta }` / `{ error: { code, message, params, fields, details, ref } }` everywhere; scaffold shows the exact object |
| F-21 | M | 03 §21 vs 14 §5 vs 06 §11 | Mobile endpoint names (`/me/push-tokens`, `/billing/packs/iap`, `/me/legal-acceptances`, `/me/workspaces`) vs 06 (`/me/devices`, `/credits/packs/iap/validate`, `/legal/*`, `/workspaces`); Chargily checkout on mobile | 06 names; 14 §5 and MOB-R01/R03/R07/R08 rewritten; no checkout on mobile |
| F-22 | M | 03 §25 vs 10 FL-18 vs 13 | Ticket auto-close 7 d vs 30 d | 30 d after `resolvedAt` |
| F-23 | M | 06 §1, 03 ORD-05, 08 §2 vs api-contract §1.6, 08-playbook §6 | Page size 20 vs 25 | 25 (allowed 25/50/100) |
| F-24 | M | 03 §15 vs 03-events §5.1 | Deep-link tab slug `tab=failed` vs `tab=failures` | `tab=failed` |
| F-25 | M | 13 AT-TRUST-auto vs 06 | Trust-level body `{ level }` vs `{ trustLevel }` | `{ trustLevel, reason }` |
| F-26 | L | README, CLAUDE.md, 08, 01, 08-playbook, 14 | Figma page "Web" renamed "Web V2"; mobile source unnamed | "Web V2" (id 898:24126) and "Mobile V2 (base FR) + Screens (AR/EN)" everywhere |
| F-27 | L | 03, 04, 05, 10, 11, 12, 13, 00, 01, api-contract | Entity names `CashEntry/CashDay/CashDayClose`, `Customer`, `Ticket`, `AiProviderModel`, `CreditTransaction`, `CreditBalance`, `ReportJob`, `RecommendationJob`, `OrderReminder`, `CmsPage`, `UserLegalAcceptance`, `minRequired`, `minQuantity`, `lowStockThreshold`, `targetMargin`, `Agent.config` | Schema names everywhere; the old names survive only in 11 §13 (alias row) and the V1 migration mapping of 05 §10 |
| F-28 | L | 03 DLV-04, 07 §4, 04 §22 | "adaptive" tracking cadence | Exact cadence (2 h × 3 d, 12 h, stale 30 d) |
| F-29 | L | 03 §23/§24/§25, 12 §21 | "(~1 h)", "may be sanctioned", canned replies "…" | Exact values |
| F-30 | L | 08 §7.4 vs 12 §20 | Call-outcome lists differ | Both = `CallResult` enum |
| F-31 | L | 08-playbook, CLAUDE.md, 00 §5–§6 | "stop and ask", `open-items.md`, "until the owner answers" | §6 "If something seems missing" rule table; `assumptions-log.md`; CLAUDE.md line "Never ask the owner a question…" |
| F-32 | L | prisma | `Outbox` without `@@unique([topic, key])`; `PROPOSED` comments; `Invoice.creditNote`; `targetMarginPct` nullable | Unique added; comments cleaned; column removed; default 35; `DailyStat`, `ReportSchedule`, `DeliveryFeeRule.freeAbove`, `PausedReason.moderation` added; `npx prisma validate` = valid |

## 3. Coverage checks (end state)

| Check | Result |
|---|---|
| Decisions D1–D78 in README | all marked settled; D36–D71 "DECIDED 2026-10-11 (owner-delegated default)"; D72–D78 mobile; no ⏳ |
| Figma frame ↔ 08 ↔ 02-route-map ↔ 06 ↔ Prisma | 124 Web V2 frames: every frame named in 02-route-map §3 or §3.6; 08 §7.16 indexes every frame; every route row's endpoints exist in 06 with the same spelling; every 06 entity is a Prisma model (0 missing) |
| Error codes | 11 defines 208 HTTP-coded codes (+ 7 warnings / info flags) and every code used in 06, api-contract, implementation, i18n deck, 12, 13, 10, 03, 04 and both Figma pages (aliases resolved through 11 §13); `rg` for the 19 alias spellings outside 11 §13 = 0 |
| Notification types | `NotificationType` enum = 56 values = 03 §15 rows = 03-events §5.1 rows = i18n §2.10 keys; each with channels, producer, throttle, web deep link; mobile = `djaber://` + same path |
| Enums | every enum of the schema compared with 04/05/api-contract/i18n deck; 0 mismatches left (api-contract states that unwritten unions = the Prisma enum of the same name) |
| Permissions | 01 §3.2 is the single table; 02-actors §3, 06 §9, 07 §1.1 and the 02-route-map column agree with it (merchant 41 keys; platform `admin.<area>.read\|write` × 5 roles, no write impersonation) |
| Prisma | `npx prisma validate` (prisma 6.19.3): **valid**; 124 models, 143 enums; `@@unique([topic, key])` on `Outbox` |
| Markers | `rg "PROPOSED\|TBD\|to confirm\|owner to confirm\|⏳\|open question"` over `docs/specs` + `docs/implementation` = **0** (the only hit is README line "There are no open questions") |
| Soft wording | `could / might / optionally` in normative text = 0; remaining `e.g.` (15) all illustrate a format, never a value |
| Mobile | 14-mobile-app.md final; 03 §21 aligned; 06 §11 defines every mobile endpoint with shapes; 11 has every code used in 14 and in the Mobile V2 frames (`ABUSE_REPORT_DUPLICATE` and `CUSTOMER_BLOCK_PLATFORM` drawn on 2 frames are aliases → text fixes); 10-flutter-mobile.md written |

## 4. Rewritten ambiguous sentences (representative list; every one is now an exact value)

| file | before | after |
|---|---|---|
| 04 §14 | "⏳ owner to confirm which of the two paths is the default for a silent non-renewal" | J+7 ⇒ `Subscription.status=expired` ⇒ 02 §5 single rule; no suspension |
| 04 §18 | "drafts are excluded from `maxAgents`? **No** — drafts count (⏳ … default: count)" | Drafts never count; limit checked at activation on `status ∈ active\|paused` |
| 04 §18 | "`Agent.config JSON` … merchant edits either the structured form or raw instructions" | Structured `Agent` columns compiled at every save into `customInstructions` / `humanHandoffRules` |
| 04 §20 | "over-receipt accepted … (replaces the 422 — ⏳) … weighted average (⏳ owner to pick V1 behaviour or Figma's)" | `200 ⚠ PURCHASE_OVER_RECEIVE {ordered, received}`; `costPrice = round_half_up((stock × costPrice + recvQty × unitCost) / (stock + recvQty))` |
| 04 §12 | "`standard` / `trusted` set manually … (automatic promotion ⏳)" | thresholds and job named |
| 04 §21 | "Import orders (CSV) … ⏳ scope to confirm" | P2, columns, `POST /orders/import` + `/commit` |
| 03 DLV-04 / 07 §4 | "adaptive 2 h for 3 days then 12 h" | "every 2 h for the first 3 days after `sent`, then every 12 h; after 30 d ⇒ `stale`" |
| 03 §23 / 12 §21 | "EN ATTENTE (~1 h)" | "EN ATTENTE (SLA 2 h ouvrées)" |
| 03 §24 | "Repeated false reports may be sanctioned" | no automatic sanction; dialog note "Les signalements abusifs sont examinés par Djaber." |
| 03 §25 | canned replies "…" | `/sheets-reconnect`, `/meta-reconnect`, `/credits-explained`, `/courier-setup`, `/invoice-copy` |
| 05 §5 | "≤ 10 (spec); Figma shows 8 max — see open question" | "≤ 10 per product (`IMAGES_LIMIT`)" |
| 06 §8.11 | "bulk/{approve\|reject\|assign} { ids[], … }" | `{ ids[], decision?, reasonTemplateKey?, merchantMessage?, assigneeId? }` + required-per-action rule |
| 11 §13 | "`DELIVERY_ORDER_ALREADY_SENT` or `DELIVERY_ORDER_NOT_CONFIRMED` per case" | "…ALREADY_SENT when the order has an active shipment, else …NOT_CONFIRMED" |
| 07 §7 | "final numbers from the owner before M9" | D68 seed values |
| api-contract §1.10 | "the spec limits stand until the owner decides (report open question)" | "10 images per product, 5 MB each, min 600 px" |
| 00 §6 | "Until the owner answers, the coder applies the decision written after 'Pack decision'" | "Decisions carried into this pack (closed 2026-10-11)" with 7 final rules |
| 08 §5 | "alignment can differ by a few px" | "≤ 4 px" |
| 08 §8 M12 | "Yalidine (if pending)" | "Yalidine adapter if not delivered in M6" |
| 10 FL-06 | "list by workspace (optionally channel)" | "filtered by channel when `channelId` is set" |
| 01 §6 orders | "optionally sends `customer.reminderScheduled`" | "when the body has `notifyCustomer=true`" |
| 03 §21 MOB-07 | "Chargily checkout … via system browser" | no checkout on mobile; packs = IAP; plan page "Gérer sur le web" |
| 13 (end) | "Open questions for the owner" (15 items) | deleted; each closed in the decisions log §C |

## 5. Gap defaults applied by the fix passes (logged for the owner; all follow 08 §6 / rulings R-Q)

shipment.failed deep link `/delivery?tab=failed&order=:id` · `credits.negative` customer text = `customer.unavailable` · ticket `closed` 30 d after `resolvedAt` · purchase cancel while `draft\|pending\|partial`, delete while `draft\|pending` unpaid · "de zéro" agents take preset defaults from the platform default route · `subscription.expiring` also at J−7 before `trialEndsAt` · `picked_up` ⇒ `Order.deliveryStatus=in_transit` · weighted average with `stock + recvQty = 0` ⇒ `unitCost` · cash closing theoretical = previous counted + Σ cash rows · returned without restock ⇒ `adjustment_out reason=loss` · legal re-acceptance scope per key · promo credits `bucket=plan, reason="promo:<code>"` · trial extension moves both `trialEndsAt` and `currentPeriodEnd` · import-order rows fail individually · `GET /invitations/:token` fields, `INVITATION_EMAIL_MISMATCH` · `POST /workspace/deletion/cancel` 409 when not scheduled · `POST /jobs/:id/retry` from `failed\|partial` · `GET /stock/snapshot` fields · `POST /shipments/:id/mark-failed` keeps `shipped` · template messages on Instagram ⇒ `REPLY_OUTSIDE_WINDOW` · `POST /billing/invoices/:id/pay` only `unpaid` · `dayOfMonth` 1–28 · `DELETE /me/devices/:token` 204 idempotent · public tracking report 3/h/IP · `InventoryCount` `draft` → `counting` at first saved line · mobile `POST /billing/checkout` ⇒ 403 · `billing.plan` (Owner) split from `billing.write` (Owner+Admin) · web routes `/inventory`, `/admin/team` kept (API `/inventories`, `/admin/platform-members`) · scheduler times `sched-trust-levels 03:45`, `sched-preset-updates 06:00`, `sched-report-schedules 07:00` · `product.approved` grouped 1/day/workspace · health replay/retry job-id suffixes · page size 25 · customer inbound image for vision ≤ 5 MB · `enum.Shipment.status.pending` = "ENVOI EN COURS", `enum.Subscription.status.dunning` = "RELANCE" · plan seed extras `maxApiKeys 0/0/5`, `maxWebhooks 0/0/5`, `syncHistoryDays 7/30/90`, pack store ids `djaber.credits.<slug>` · mobile tabs Accueil / Boîte / Commandes / Stock / Plus, Android 24+, iOS 14+ · `SMS_PROVIDER ∈ noop\|twilio`.

## 6. Verdict

Every decision is closed and recorded; every marker is gone; names, codes, notification types, enums, permissions and endpoints are consistent across the 16 spec files, the 12 implementation files, the schema and both Figma pages (Figma text corrections listed in `figma-text-fixes.md`). The coding model has a deterministic rule for every kind of gap (08 §6) and an explicit instruction never to ask (CLAUDE.md).

**READY.**


## 7. Post-audit actions (2026-10-11)

- Figma text fixes applied: 95 / 95 (see figma-text-fixes.md, "Application status").
- Marker scan re-run after the fixes: 0 open markers in docs/specs and docs/implementation.
