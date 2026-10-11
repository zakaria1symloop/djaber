# Figma coverage matrix — pages · dialogs · states (2026-10-06)

Purpose: let Claude Code find every screen, modal and state before writing a component. Source of the checklist: specs 03/08/10/11/12 inventoried on 2026-10-06, diffed against the Figma file. Frame names are exact (search them in the "Web V2" page). "Catalogue" = a frame that holds several dialogs/states side by side.

## Where things live (sections 00 → 14)

| Section | Contains |
|---|---|
| 00 Reference | Entity map · filters/actions matrix · **Component sheet** (status pills per enum, UI patterns) · **Deep-link map** (NotificationType → URL) + saved views + remaining filters |
| 01 Shell & Home | Home default / new workspace / **Home & Notifications states** (skeleton, queue card variants, banners, page badges, notification type filter) · Notifications |
| 02 Inbox & Queue | Inbox thread · Queue (popovers/message types/banners/composer states are in 14) |
| 03 Orders, Delivery & Clients | Orders v2 list · order page · confirm dialog · new order · send dialog · fees + couriers · **DLV-08 overview + tracking panel** · **labels viewer + A5 print** · clients |
| 04 GDS | products list/form · **CAT-09 product full page** · categories/units · import · stock dashboard · movements · suppliers · purchases · sales · cash register · recommendations · moderation states · rejected + appeal · **services list + new purchase form + purchase/sale detail** |
| 05 Agents & Channels | agents list · wizard 1–5 · agent page · **AGT-04 configuration tab** · **AGT-08 insights queue** · playground · channels list · channel overview · **CHN-07b Messages/AI/History tabs** · analysis review |
| 06 Analytics & Reports | overview tab · **ANA-02b the 7 other tabs** (+ period picker errors) · reports hub · report template |
| 07 Settings, Billing, Help & Safety | plan & billing · **BIL-04 credits ledger + invoices + checkout return** · members · profile/workspace/security · quick replies/system messages/notifications/stock mode/danger zone · integrations · help · trust & safety |
| 08 Auth & Onboarding | login · 2FA · reset expired · sign up · verify · invitation · onboarding 1–6 · **AUTH states catalogue** (login errors/rate limit/2FA/recovery, forgot, reset, verify, invitation, create workspace, workspace switcher + user menu, onboarding transverse) |
| 09 Global states | offline · 404 · plan expired · credits exhausted · **GLOBAL catalogue** (list 6 states, form states, detail states, 403/suspended/session expired, toasts, banners with priority, system dialogs, keyboard shortcuts) |
| 10 RTL & responsive | Home AR · Inbox AR · **Orders list AR · New order AR · Product form AR** · **RESP** (1024 icon sidebar, 390 mobile web, simple-mode sidebar) |
| 11 Mechanics | filter panels, row menus, bulk, quick edit (products, orders, clients, inbox, agents/channels, delivery) |
| 12 Platform admin | 16 admin pages + **ADM-17 read-only viewers + user detail** |
| 13 Public pages | status · account deletion · **pricing** · **legal/CMS + landing/help + Meta data-deletion status** |
| 14 Dialogs & modals | **DLG Orders & delivery** (cancel, status change, assign, callback, delivered manually, returned, labels, export, address, call outcome, merge clients) · **DLG Orders II** (record payment, delete order, payment link P2, refund P2, conflict 409, courier add/test, delete courier blocked, fees actions, label unavailable, cancel parcel, new client, delete client, tags) · **DLG GDS** (category, unit, delete/archive product, bulk price, bulk category, variant generator, duplicate, supplier, supplier payment, cancel sale, collect remaining, cash manual entry, start inventory, validate inventory, column mapping) · **DLG GDS II** (plan limit, create from photo, image errors, adjust stock cases, delete category/unit reassign, product expense, purchase locks, sale locks, cash locks, recommendation rule, restore with SKU conflict) · **DLG Agents & channels** (delete, pause, resolve insight, disconnect, resume swap at limit, OAuth outcomes, per-page report, connect explainer, sync history, model unavailable, generate-from-page flow) · **DLG Inbox** (quick replies, assign, notes, delete, channel switcher, bulk bar, message types, thread banners, composer states, client panel states, queue empty) · **DLG Settings & billing** (2FA setup/disable, password, e-mail change, delete account, logo, quick reply, system message reset, delete workspace, Sheets picker/backfill, webhook, change plan/cycle/downgrade/promo, credit calculator, checkout return states, invite member, transfer ownership, language) · **DLG Platform admin** (**create plan**, delete plan blocked, subscription create/edit, suspend, grant credits, force-release channel, provider key test states, AI model, preset create, CMS entry, audit export, role change errors, invite platform member, create workspace for client, schedule deletion) |

## Conventions for the coder
- One dialog = one `Dialog/<title>` frame inside a catalogue; its footer note carries the rule or error code (from `11-error-catalogue.md`, or proposed when prefixed by a new code).
- Every list page follows GLOBAL → "Liste — 6 états"; every form follows "Formulaire — états"; every detail page follows "Fiche — états". Do not design new state patterns.
- Banners: one at a time, priority order written on the GLOBAL frame. Toasts: bottom-right, max 3.
- Row actions: `Actions ⌄` chip (ORD-05 v2); exceptions listed in `figma-web-coverage.md`.
- Pills: colours per enum are fixed on the Component sheet; reuse them on mobile.

## Known spec ↔ Figma conflicts to settle before coding
1. D21 says "no admin impersonation" but ADM-02/ADM-12 draw a read-only impersonation with reason + audit. Decide: keep D21 (remove from frames) or amend D21 (recommended: read-only, logged, 30 min).
2. System messages: 3 vs 4 keys × 3 locales across specs 03/08/11/12 — align on 4 (handoff, out-of-hours, out-of-stock, welcome).
3. Plan expired: spec = banner + free limits (no read-only); GLOBAL frame matches. Keep.
4. Codes introduced by Figma (MODERATION_*, REPORT_*, PROMO_*, CASH_ENTRY_LOCKED vs CAISSE_EDIT_AUTOMATIC, PLAN_LIMIT_GRANDFATHERED, USER_OWNS_WORKSPACE, AGENT_NO_CHANNEL, SALE_PARTIAL_REQUIRES_CUSTOMER, GDS_MOVEMENT_IMMUTABLE, COURIER_CANCEL_NOT_ALLOWED, WEBHOOK_URL_INVALID, QUICK_REPLY_TITLE_TAKEN, VARIANT_LIMIT, CUSTOMER_MERGE_IRREVERSIBLE…) → add to `11-error-catalogue.md` or map to existing ones.
5. "Aide" in specs = public help page; Figma draws an in-app help center + public help. Keep both (in-app embeds the public content).

## Not drawn on purpose
- Mobile-only states (push permission, OAuth "I'm done" fallback) — mobile Figma scope.
- Prototype links (onboarding, inbox takeover, order → send → tracking) — to wire in Figma prototype mode after owner approval.
- Charts are placeholders (bars); real chart specs are on the Component sheet.
