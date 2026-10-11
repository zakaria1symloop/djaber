# 08 — Coder playbook (how the coding model works on Djaber v2)

You are implementing Djaber v2 from a finished specification and a finished Figma design. Your job is to translate, not to design. If a detail is missing, you apply the deterministic rule of §6 "If something seems missing" and record the assumption in `docs/implementation/assumptions-log.md`; you never ask the owner and you never invent a behaviour outside §6.

---

## 1. Read order (every session, in this order)

1. `CLAUDE.md` (repo root) — rules and commands.
2. `docs/implementation/00-build-order.md` — §0 (name reconciliation with the schema/contract — apply it to every other pack file), then the current milestone: scope, frames, spec sections, exit criteria.
3. `docs/implementation/01-nest-module-map.md` — which module owns the work, pipeline, guards, naming.
4. `docs/implementation/02-next-route-map.md` — route, frame, endpoints, permission, states for the screen.
5. The spec sections cited by the milestone (`docs/specs/03…13`), plus `04-business-rules.md` for any rule and `11-error-catalogue.md` for any error.
6. `docs/implementation/03…07` for events/jobs, AI, integrations, i18n keys, non-functional constraints touched by the task.
7. `docs/implementation/09-code-conventions.md` — copy the scaffolds.
8. `docs/implementation/prisma-schema.prisma` and `api-contract.md` — entity and endpoint names win over any other file.
9. The Figma frame(s) named for the screen (file `3SieH2XU0UvTnTNRl991LO`, page "Web V2", id `898:24126`); take the frame's node ID from `docs/figma-frame-index.md` and call `get_design_context` / `get_screenshot` with that node ID (never search the canvas by name); read every "ÉTAT ·" tile and every dialog in the referenced DLG catalogue.
10. Mobile tasks only (milestones MM1–MM5): `docs/specs/14-mobile-app.md` (wins over 03 §21) → `docs/implementation/10-flutter-mobile.md` → the Figma pages "Mobile V2 (base FR) + Screens (AR/EN)" (frame-prefix reading rules of 14 §1).

Do not start coding before step 9 for UI work, step 8 for API work and step 10 for mobile work.

---

## 2. Work one milestone at a time

- Only tasks inside the current milestone (`00-build-order.md`). A dependency on a later milestone ⇒ stub behind an interface + `TODO(M<n>)` comment + one line in `docs/implementation/assumptions-log.md` (create it if missing; format: `2026-10-12 | M5 | orders | create_order tool needs delivery.quote — stubbed with grid lookup until M6`).
- Order inside a milestone: schema → API → worker/jobs → web → tests → docs. Never UI before the endpoint exists (use the real API, no mocks in app code).
- Finish = all exit criteria + listed AT ids green + definition of done (§4) for every screen in scope.

---

## 3. Per-task checklist (backend resource)

Copy this list into the PR description and tick each line.

1. **Entity**: model exists in `prisma-schema.prisma` with `workspaceId` (tenant), `createdAt/updatedAt`, `deletedAt?` if soft-deleted, `version` if listed in 04 §11. Do not edit the schema file beyond what `api-contract.md`/specs require; if a field is missing, add it as nullable with the type of the closest sibling field (§6) and log the assumption.
2. **Migration**: `pnpm --filter db prisma migrate dev --name <m>_<entity>_<change>`; migration reviewed for indexes `(workspaceId, …)`; never `db push`.
3. **DTO**: zod schema in `packages/shared/src/schemas/<entity>.ts` (shared with web/mobile), wrapped by `createZodDto` in `dto/`; reuse shared validators.
4. **Repository**: tenant-scoped queries only (`where: { id, workspaceId }`), `findFirstOrNotFound`.
5. **Service**: business rules from 04 (cite the section in a comment `// 04 §1.2`), transactions for multi-row writes, effects via `OrderEffects`/`SaleEffects`/`PurchaseEffects`, outbox for side effects, `AppException(code)` for errors.
6. **Controller**: thin; `@RequirePermission`, `@ApiScope` when API-key accessible, `@Idempotent({ required })` per `api-contract.md` §1.7, `@Audited` per 01 §3.4, Swagger decorators, `version` handling on PATCH.
7. **Guards/roles**: permission key exists in `permission-matrix.ts`; API scope mapping exists.
8. **Tests**: unit for rules; integration for each endpoint (happy, validation 422 with `fields`, 403 per role, cross-workspace 404, idempotency replay, 409 version, rate limit when applicable); fixtures via factories.
9. **WS event**: emitted through the outbox with the payload shape in `03-events-and-jobs.md` §2; client cache handler added.
10. **Jobs**: processor with deterministic `jobId`, `TenantContext`, retry policy from 03 §3; DLQ-safe.
11. **Notifications**: producer call with the type from 03 §5.1; throttle rule respected.
12. **UI route**: page under the route in `02-next-route-map.md`; uses shared components; filters in URL.
13. **States**: every state from the route row + GLOBAL catalogue implemented and in Storybook.
14. **i18n**: keys added in fr/ar/en (ar/en may be TODO-prefixed in dev only); `pnpm i18n:check` passes.
15. **Acceptance test**: the AT ids from 13 for this feature implemented as named tests.
16. **Docs**: `api-contract.md` untouched (names and shapes are final); `assumptions-log.md` updated with every §6 default applied in the task.

---

## 4. Definition of done (screen or endpoint)

An item is done when: `pnpm lint typecheck test` green; integration tests cover the permission matrix for every new route; the screen matches the Figma frame at 1440 (reviewer screenshot side by side) and the RESP frame at 1024/390 for shells; every state in `12-screen-states.md` for that screen renders (Storybook story per state); no string outside i18n; no disabled control without tooltip reason; AT ids green; audit rows exist for sensitive actions; the PR template checklist (§3) is fully ticked.

---

## 5. Verifying against the Figma

1. Open the frame named in `02-next-route-map.md`. Frame names follow `<spec id> — <screen> — <state>`.
2. List what must exist, in this order: layout (shell, tabs, columns), every pill (match `enum.*` keys), every button (match `action.*` keys), every filter (field · type · model source written on the mechanics frame), every row-menu item with its disabled reason, every "ÉTAT ·" grey tile at the bottom (each is a state to build), every dialog referenced (open the DLG catalogue frame for that section and implement each `Dialog/<title>` with its footer rule/error code).
3. Build; then screenshot your page in the same state and compare: alignment can differ by ≤ 4 px; content, states, labels and actions may not differ.
4. If the Figma shows something the specs do not define (a field, a status, an error code) ⇒ §6.

---

## 6. If something seems missing — apply the rule, never ask

The specification is final: the owner has delegated every remaining decision to the rules below. When a detail is not in the specs, the Figma, or this pack, you do **not** stop and you do **not** ask. You apply the matching rule, implement it, and append one line to `docs/implementation/assumptions-log.md` (create the file if missing): `YYYY-MM-DD | M<n> | <file or route> | <gap> | <rule applied> | <value chosen>`. The owner reviews that file after the fact and may reverse a line; until then the line is the spec.

Precedence when two sources disagree (highest first): `prisma-schema.prisma` and `api-contract.md` (names, shapes) → `00-build-order.md` §0 → `11-error-catalogue.md` (codes) → `03-functional-modules.md` §15 (notification types) → `04-business-rules.md` → `06-api.md` → `12-screen-states.md` → `08-web-screens.md` → the Figma frame → the other files. Spec values win over Figma text for every number (limits, durations, prices); Figma wins for copy (words) and layout.

| Kind of gap | Deterministic rule (apply, then log) |
|---|---|
| Copy string (label, button, placeholder, empty-state text) | Use the French text of the Figma frame named for the route; ar/en = literal translation in the voice of `06-i18n-copy-deck.md`; key under `<screen>.*`. No Figma text ⇒ reuse the closest `action.*` / `common.*` / `state.*` key. |
| Validation of a field | Same rule as the closest sibling field in the same DTO (same type, same group). No sibling ⇒ names 120 chars, descriptions 2 000, notes 1 000, URLs 2 048 (https only), phone = `validation.phone`, money = integer DA ≥ 0, quantities = integer ≥ 1, percentages = integer 0–100. |
| Required vs optional field | Optional (nullable) unless the Figma form shows the field with the required marker or the Prisma column is NOT NULL without default. |
| Default value | The Prisma `@default`; none ⇒ null / empty array / `false` / `0`. |
| Permission on a merchant route | `admin+` (Owner and Admin). On a platform route ⇒ `super_admin` only. API-key scope ⇒ not exposed to API keys. |
| Empty / loading / error / 403 / 404 / offline state | The GLOBAL catalogue pattern (`12-screen-states.md` §16: list 6 states, form states, detail states); empty-state icon = the entity's sidebar icon. |
| Page size | 25 (allowed 25 / 50 / 100; max 100). Cursor lists: 50. |
| Sort | `createdAt desc`; ties by `id desc`. |
| Rounding / money | Integer DA, half-up, no decimals; percentages shown with 0 decimals; weights in kg with 2 decimals. |
| Date / time display | `dd MMM yyyy HH:mm` in `Africa/Algiers` (`11 oct. 2026 14:05`); date only `dd MMM yyyy`; relative "il y a n min" only in lists for < 24 h; stored UTC ISO-8601. |
| Number display | Latin digits, thin space thousands separator, `12 500 DA`; phones `05 55 12 34 56` inside `<Ltr>`. |
| Enum value with no pill colour | Grey pill with the enum label; add the `enum.<Model>.<field>.<value>` key. |
| Limit (max items, max length, max attempts) | 100. Rate limit ⇒ 60 / min / user. Retry ⇒ the queue's default in `03-events-and-jobs.md` §3. |
| Timeout | HTTP to providers 10 s; AI 45 s; PDF 60 s; courier 15 s. |
| Error code | A 422 `VALIDATION_ERROR` with `fields` for input problems; a 409 `CONFLICT` with `details` for state problems; never a new code. If a sentence in a dialog footer names a code that is not in 11, use the canonical code of 11 §13 for that sentence, or `VALIDATION_ERROR` when none matches. |
| HTTP status of a new rule | 422; 409 when the rule depends on another row's state; 403 when it depends on the role or plan. |
| Notification channel for a new event | In-app only, no e-mail, no push; throttle 1 per object per hour. |
| Deep link | The detail page of the object (`/orders/:id`, `/products/:id`, …); mobile `djaber://` + identical path. |
| Audit | Audit it (`AuditLog`) when the action changes money, stock, members, credentials, status of a workspace / user / channel, or anything under `/admin`. |
| Idempotency | Required on every POST that creates money, stock or outbound messages; optional elsewhere. |
| WS event | `<entity>.updated { id }` on the workspace room. |
| Job | Any operation > 2 s or > 500 rows runs as a BullMQ job (`202 { data: { jobId } }`). |
| Locale | `fr`; `Accept-Language` otherwise. |
| Export columns | The list columns in their displayed order, plus `id` and `createdAt`. |
| Figma shows a control the specs never mention | Build it exactly as drawn, wired to the closest existing endpoint; log it. |
| Specs mention a control the Figma does not draw | Build it with the GLOBAL catalogue components (button in the page header for a primary action, row menu item for a row action); log it. |
| External API field unknown (EcoTrack instance, Chargily parameter) | Read it from the environment variable named in `05-integrations.md`; if none is named, add `PROVIDER_<FIELD>` to `.env.example` with a comment and log it. |
| Test data | Any realistic Algerian value (names, wilayas, phones `05/06/07…`). |
| Column widths, spacing, pixel values | Match the Figma visually using design tokens. |

Nothing is left for a question: if a gap matches none of the rows, use the row "Error code" for errors, "Permission" for access, "Copy string" for text, and "Default value" for everything else.

---

## 7. Commit / PR conventions

- Branch `m<N>/<module>/<short-kebab>` (`m5/orders/status-machine`).
- Conventional commits: `feat(orders): status machine with OrderEffects (04 §1.2, §3)`, `fix(inbox): …`, `test(orders): AT-ORD-01…08`, `chore(db): migration …`. Body cites spec IDs and Figma frame names. Footer: the attribution line that Claude Code configures for the session (the model actually coding) — never add other attribution lines.
- One PR per task (≤ 600 changed lines excluding generated/migrations/tests); PR title = commit title; description = the §3 checklist + screenshots (Figma vs implementation) for UI + list of AT ids.
- Never commit `.env*`, secrets, generated clients, or screenshots with real customer data.
- CI must be green; no `--no-verify`, no skipped tests (`it.skip` forbidden; use `TODO(M<n>)` + an `assumptions-log.md` line instead).

---

## 8. Prompt templates per milestone (paste as the first message of a session)

Replace `<…>`; keep the structure.

### M0
```
Read CLAUDE.md, docs/implementation/00-build-order.md (M0), 01-nest-module-map.md, 09-code-conventions.md, 07-non-functional.md §6–§7.
Task: <one of: monorepo + CI | core/* (config, logging, tenancy, rbac, idempotency, audit, errors, i18n, outbox, ws, queue, storage, crypto) | packages/shared (errors, validators, enums, i18n keys) | seeds | web shell + GLOBAL states + packages/ui primitives from 02-next-route-map.md §4–§5>.
Constraints: no domain modules yet; every scaffold in 09 used verbatim; tests per 07 §8.
Output: PR per task with the checklist of 08 §3.
```

### M1
```
Read CLAUDE.md, 00-build-order.md (M1), 01 (auth, workspace), 02 (routes (auth), (onboarding), /settings/*, AUTH/ONB frames), specs 03 §1 §2 §20, 02-actors-roles.md, 04 §9, 05 §1, 06 Auth/Workspace, 10 FL-04 FL-13 FL-14, 11 §2, 12 §1 §2 §13, 13 AT-AUTH-* AT-ONB-* AT-SET-01.
Task: <auth endpoints | 2FA | members & invitations | workspace settings | onboarding | web auth screens | web settings screens>.
Figma: <frame names from 02 for the screens>.
```

### M2
```
Read 00 (M2), 01 (catalog), 02 (/products*, /categories, /services, /stock, /movements), specs 03 §8 §14 GDS-01…04, 04 §2 §3 §9, 05 §5, 06 Catalogue, 10 FL-12, 11 §5, 12 §8, 13 AT-CAT-*.
Task: <products CRUD + SKU partial unique index `(workspaceId, sku) WHERE deletedAt IS NULL` shared by Product and ProductVariant (`P2002` ⇒ `PRODUCT_SKU_ALREADY_EXISTS`) | images + media jobs | variants + generator | categories/units | stock adjustments + movements | import preview/commit | export | moderation hooks (D36) | web products list + quick edit | web product form | web product page | web import wizard>.
Figma: CAT-01, CAT-04, CAT-06, CAT-08 (+ mechanics), CAT-09, GDS-01, GDS-05, MOD *, DLG GDS I/II.
```

### M3
```
Read 00 (M3), 01 (channels, messaging), 02 (/channels*, /inbox, /queue, /settings/security SAFE part), 03-events-and-jobs.md §1–§3 (meta-inbound, media, outbox meta-send), 05-integrations.md §1, specs 03 §3 §4 §5, 04 §5 (statuses, 24 h), 05 §3, 06 Channels/Conversations/§3/§6, 10 FL-01 (1–5, F-7) FL-03 (2–6) FL-05 FL-06, 11 §3, 12 §4 §10, 13 AT-CHN-* AT-MSG-* AT-INB-*.
Task: <Meta OAuth + connect report | webhook + InboundProcessor | conversations/messages API | OutboundSendService + window rules | WS gateway + resync | inbox web 3-pane | thread message types | composer states | channels list/page web | block/report>.
```

### M4
```
Read 00 (M4), 01 (ai, agents), 04-ai-pipeline.md entirely, 03 §3 (ai-reply, media transcribe), 02 (/agents*, /channels/:id/analysis), specs 03 §6 §7 CHN-08, 04 §5, 02 §6, 05 §4, 06 Agents & AI, 10 FL-01 (6–15) FL-02 FL-15, 11 §4, 12 §9, 13 AT-AI-* AT-AGT-*.
Task: <ProviderRegistry + routing | PromptBuilder sections | ToolRegistry + tools | AiRunService replay | ReplyProcessor | vision 2-pass | transcription | credits reserve/settle | playground | insights | agent wizard API (draft, steps, versions, FAQ) | agent generation job | page analysis job | web wizard steps 1–5 | web agent page/config/insights/playground>.
Figma: AGT-01…08, CHN-08, DLG Agents & channels, GLOBAL credits exhausted.
```

### M5
```
Read 00 (M5), 01 (clients, orders, delivery fees/geo, notifications, analytics home), 02 (/orders*, /clients*, /delivery/fees, /home, /notifications, /settings/notifications), 03 §2 (order.*, notification.*), §5, specs 03 §9 §10 §11 DLV-01/02/09 §12 PAY-01 §15 §16 ANA-01, 04 §1–§4 §8 §10 §11, 05 §6 §7, 06 Clients/Orders/Delivery(fees,geo)/Notifications, 10 FL-02 (7–8) FL-07, 11 §6, 12 §3 §5 §7 §13, 13 AT-CLI-* AT-ORD-* AT-DLV-09/10 AT-NTF-* AT-ANA-01.
Task: <clients + merge + risk | orders create + numbering | OrderStateMachine + OrderEffects | calls/payments/callback/assign/address | bulk + export + print | fee grid + quote | notifications producer + prefs + FCM | home | web orders list (ORD-05 v2) | web order page + dialogs | web new order | web clients | web home | web notifications>.
Figma: ORD-02/05 v2/06/07 (+ AR), CLI-03 (+ mechanics), DLV-01/03 grid, DLV-06/ORD-09 A5, ANA-01 (+ AR, states), NTF-01, DLG Orders I/II.
```

### M6
```
Read 00 (M6), 01 (delivery), 05-integrations.md §2 §8, 03 §3 (courier queue) §4 (tracking sync), 02 (/delivery*, order page delivery block), specs 03 §11, 04 §1.5 §3 §9, 05 §7, 06 Delivery/§3, 10 FL-08, 11 §6, 12 §6, 13 AT-DLV-01…08.
Task: <CourierAdapter + ZR Express | EcoTrack | Yalidine | manual | courier accounts + test | send single/bulk + processor | tracking sync + mapping | labels + fallback PDF + merge | overview | web couriers | web send dialog | web overview + tracking panel | web labels viewer>.
```

### M7
```
Read 00 (M7), 01 (gds, recommendations), 02 (/suppliers*, /purchases*, /sales*, /cash, /inventories*, /recommendations), specs 03 §13 §14 GDS-05…09 §31 §33, 04 §3 §4 §9 §10, 05 §5 §8, 06 Recommendations/GDS operations, 11 §7, 12 §12, 13 AT-ORD-10/11 AT-CLI-05.
Task: <suppliers | purchases + PurchaseEffects + receive/cancel (weighted-average cost) | sales + SaleEffects + payments | cash register + locks + CashClosing (POST /cash/close, /cash/days/:day/reopen) | product expenses/margins | inventories (InventoryCount, POST /inventories, PUT /inventories/:id/lines, /validate) | recommendation engine + rules (/stock-recommendations*) | web screens per route>.
Figma: GDS-06…10, CAT-11/GDS-06b, DLG GDS I/II.
```

### M8
```
Read 00 (M8), 01 (analytics, gds reports), 02 (/analytics/*, /reports*), specs 03 §16 §14 GDS-10, 04 §4 §8, 01 §3, 11 §7, 12 §11, 13 AT-ORD-10/13.
Task: <DailyStat rollups | analytics tabs | 23 report definitions | XLSX/PDF export jobs | web analytics | web reports hub + template>.
Figma: ANA-02, ANA-02b, ANA-03, ANA-04.
```

### M9
```
Read 00 (M9), 01 (billing, payments), 05-integrations.md §4 §5, 03 §4 (credit periods, expiry, dunning), 02 (/settings/billing*, /settings/credits, /pricing), specs 03 §17, 02 §5 §6, 05 §2, 06 Billing & credits, 10 FL-09, 11 §8, 12 §13, 13 AT-BIL-*.
Task: <plans + limits + expiry job | PaymentGateway Chargily | checkout + return + verify | invoices PDF | credits ledger + packs + promo | POST /credits/packs/iap/validate + store notifications | dunning (R-J) | web billing | web credits + calculator | web return page>.
Figma: BIL-01, BIL-04/BIL-03, PUB Pricing, GLOBAL plan expired, DLG Settings & billing, ADM-15.
```

### M10
```
Read 00 (M10), 01 (admin), 02 (/admin/*), 03 §3.2 (health contract), 07-non-functional.md §1.1 §1.4, specs 03 §19, 05 §9, 06 Platform admin, 11 §8, 12 §14, docs/specs/README.md decisions D36–D42.
Task: <admin shell + overview | workspaces/users + actions | plans/subscriptions/invoices | AI providers/models/routes/calculator | presets | CMS | audit + export | jobs & health + incidents | platform settings | moderation queue + merchant MOD | abuse reports + blacklist + blocked words | support tickets + merchant HELP | platform roles + deletion requests | viewers + impersonation>.
Figma: ADM-01…17, DLG Platform admin, HELP, SAFE, MOD.
```

### M11
```
Read 00 (M11), 01 (public, integrations, sheets, payments links), 05-integrations.md §3 §4.3 §6, 03 §6 (outbound webhooks), 02 ((public) routes, /settings/integrations), specs 03 §12 PAY-02…04 §18 §22, 06 §4 §5, 10 FL-10 FL-11, 11 §8, 13 AT-API-* AT-GSH-01.
Task: <public pages + CMS rendering + status + account deletion | API keys + scope guard + Swagger | outbound webhooks + deliveries + replay | Google Sheets OAuth/picker/upsert/backfill | order payment links + refunds | web integrations screen>.
```

### M12
```
Read 00 (M12), specs 14-mobile-app.md §5 §6, 03 §21, 07 §5, 05-integrations.md §5, 06 §11, 03-events §5.2, ADM-13 frame.
Task: <GET /app/version + GET /legal/pending + POST /legal/accept | POST|DELETE /me/devices + push deep-link payload | POST /credits/packs/iap/validate + store notifications | app links (djaber://oauth/return, djaber://invite, djaber://verify) | OpenAPI → Dart client (packages/mobile_api) in CI | Yalidine if not delivered in M6 | autoSendToCourier setting>.
```

### MM (Flutter)
```
Read CLAUDE.md, docs/specs/14-mobile-app.md, docs/implementation/10-flutter-mobile.md, 02-next-route-map.md (routes for deep links), specs 06 §11, 11, 03 §15.
Task: <MM1 shell + auth + version gate + legal + push pre-prompt | MM2 inbox + orders + clients + delivery | MM3 GDS (stock, inventories, counter sale, cash) | MM4 agents wizard + analytics + settings + credits IAP + help | MM5 store release (account deletion, reporting, screenshots)>.
Figma: Mobile V2 frames <frame names of 14 §4 for the task; AR/EN of base screens from page "Screens">.
```

---

## 9. Do / Don't

**Do**
- Cite the spec section or Figma frame in a code comment next to every rule you implement.
- Use the scaffolds of 09 verbatim; change names only to the entity's.
- Keep PRs small and milestone-scoped.
- When unsure, apply §6 and record the assumption in `assumptions-log.md`.

**Don't**
- Don't ask the owner a question; §6 always gives an answer.
- Don't invent fields, statuses, copy, screens, endpoints or behaviours outside the §6 rules.
- Don't bypass guards, idempotency or the outbox "temporarily".
- Don't mock the API inside the web app.
- V1 secrets: follow root `CLAUDE.md` rule 9 (V1 `.env*` may be read to fill this repo's git-ignored `.env`; never print, log or commit a value; `.deploy-secrets*`, `.github-deploy-key*`, SSH keys stay off-limits; no production side effects from dev).
- Don't skip tests or states to finish faster.
