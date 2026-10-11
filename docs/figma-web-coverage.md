# Figma web design — coverage vs specs

File: https://www.figma.com/design/3SieH2XU0UvTnTNRl991LO — page **Web V2** (page id `898:24126`; mobile reference = page **Mobile V2**, see `specs/14-mobile-app.md`; old mobile screens stay in page **Screens**). Frame naming: `<spec id> — <screen> — <state>`. Design system = the mobile file's variables, text styles and components (08 §1); web-only components built inline (sidebar, top bar, data table, filter bar, side sheet, dialog, banners, pills, buttons).

**Status 2026-10-06 (evening): exhaustive pass done — every page, tab, dialog/modal and state from the specs is drawn (see `figma-coverage-matrix.md` for the where-is-what table) — 124 frames in 16 sections numbered 00 → 14 in stack order (14 = Dialogs & modals, 10 = RTL & responsive) (00 Cover, 00 Reference, 01 Shell & Home, 02 Inbox & Queue, 03 Orders/Delivery/Clients, 04 GDS, 05 Agents & Channels, 06 Analytics & Reports, 07 Settings/Billing/Help/Safety, 08 Auth & Onboarding, 09 Global states, 10 RTL, 11 Mechanics, 12 Platform admin, 13 Public pages). The cover frame lists every frame per section.**

Gap-pass additions (2026-10-06): ORD-05 v2 (dense rows, SOURCE column, one "Actions ⌄" dropdown per row with state-aware items and shortcuts — the canonical list row pattern), AGT-02 steps 1/2/3/5 + AGT-03 agent page, ADM-10 moderation queue + MOD merchant states, ADM-11 abuse reports + SAFE merchant trust & safety, ADM-12 support + HELP merchant help center, ADM-13 platform settings (app versions/force update, flags, legal, Meta, providers), ADM-14 jobs & health, ADM-15 credit packs & promo codes (store IAP), ADM-16 admin roles & account-deletion requests. Admin sidebar is now 15 items on every ADM frame.

## Sections and frames

| Section | Frames | What each shows |
|---|---|---|
| 00 Cover | Djaber Web — index | list of all sections/frames |
| 00 Reference | REF entity & navigation map · REF filters/actions/quick-edit matrix | model fields per entity, cross-navigation table, per-page filter/action matrix |
| 01 Shell & Home | ANA-01 Home default · Home new workspace + banners · NTF-01 Notifications | queue, KPIs, checklist, banners (e-mail unverified, credits 80 %), notification types + deep links |
| 02 Inbox & Queue | INB Inbox thread with handoff · QUEUE items | 3 panes, tabs, handoff banner, composer, client panel; needs-human cards + insights |
| 03 Orders, Delivery & Clients | ORD-05 list · ORD-06 order page · ORD-07 confirm dialog · ORD-02 new order form · DLV-05 send dialog · DLV-01/03 fee grid + couriers · CLI-03 clients + sheet | selection/bulk, status pills, COD, client conflict, variant pick, fee quote, 58 wilayas grid, ZR Express/EcoTrack/Yalidine settings, client risk + merge |
| 04 GDS (stock) | CAT-08 products · CAT-01 product form · CAT-04 categories & units · CAT-06 import wizard · GDS-01 stock dashboard + adjust · GDS-05 movements + filter panel · GDS-06 suppliers · GDS-07 purchases + receive · GDS-08 sales + partial payment · GDS-09 cash register (locked auto rows, closing) · GDS-10 recommendations (rule-based, job, stats) | full V1 stock module, simple/advanced notes, immutable ledger rules |
| 05 Agents & Channels | AGT-01 list · AGT-02 wizard step 4 · AGT-07 playground · CHN-06 channels · CHN-07 channel overview · CHN-08 analysis review | plan limits, channel move dialog, dry run with tool calls, Meta approval states, catalogue extraction review |
| 11 Analytics & Reports | ANA-02 analytics overview (8 tabs, period picker, comparison, states) · ANA-03 reports hub (23 reports, export jobs) · ANA-04 report template (filters, totals, >5000 rows job) | |
| 06 Settings & Billing | BIL-01 plan & billing · SET members · SET profile/workspace/security · SET quick replies/system messages/notifications/stock mode/danger zone · SET integrations (Sheets, API keys shown once + scopes, webhooks + deliveries/replay/disabled) | |
| 07 Auth & Onboarding | AUTH login · login 2FA · reset expired · sign up (field errors, e-mail taken) · verify e-mail (done + other states) · accept invitation (logged out, D30) · ONB steps 1, 2, 3, 4, 5, 6 | |
| 08 Global states | Offline · 404 · Plan expired · Credits exhausted | |
| 09 RTL (AR) | Home AR · Inbox AR | mirrored shell, Changa, numbers LTR |
| 10 Mechanics | Products filter panel · Products bulk + row menu · Product quick edit + relations · Orders filter panel · Orders row menu + bulk results · Clients filters + menu · Inbox filters + menu · Agents filters + card menu / Channels card actions · Delivery filters + row menu by state + bulk send results | every filter with model source, every action with target page or disabled reason |
| 12 Platform admin | ADM-01 overview · ADM-02 workspaces + menu + sheet (impersonation rules) · ADM-03 users · ADM-04 plans editor (versioning, impact warning) · ADM-05 subscriptions & invoices (dunning, manual payment) · ADM-06 AI providers, routing/fallback, pricing calculator · ADM-07 agent presets (versions, locales, publish checks) · ADM-08 CMS per locale (FR/AR/EN, scheduling) · ADM-09 audit log + diff | |

## Conventions the coder (Opus) should rely on
- **Row actions**: every data list row carries one `Actions ⌄` dropdown (state-aware items, first = primary, forbidden items greyed with the error code, keyboard shortcuts) — see ORD-05 v2. Exceptions keep one explicit button: banners (Réessayer / Choisir un plan / Acheter des crédits), notification rows (Ouvrir ›), export jobs (Télécharger / Annuler / Réessayer), sessions (Déconnecter), API keys (Révoquer), blocked customers (Débloquer), order line items (✕).
- Shell: `Sidebar` (Menu Row instances, active = `ink/raised` fill) + `Main` (`Top bar` + `Content`). Admin shell = same with its own menu and a "← Retour à mon espace" row.
- Lists: search box + filter buttons + chips + table (header row `ink/raised`, hairline bottom borders) + pagination row; filter panels are absolute-positioned sheets listing **field · type · model source**; row menus list **action · target / disabled reason (error code)**.
- Error codes shown in frames (e.g. `GDS_MOVEMENT_IMMUTABLE`, `CASH_ENTRY_LOCKED`, `PLAN_LIMIT_GRANDFATHERED`, `ADMIN_IMPERSONATION_FORBIDDEN_ACTION`) are proposals — reconcile with `docs/specs/11-error-catalogue.md` before coding; add missing ones there.
- Grey "ÉTAT ·" tiles at the bottom of frames enumerate the other states of that screen (empty, loading, errors) when they are not drawn separately.

## Known limitations of the generated frames
- Text inside component instances (Page Card stats, Escalation Card) stays in French on the AR frames.
- Icons use the mobile icon set defaults; web-specific icons (table sort, filter) are placeholders.
- Frames are 1440 wide; 1024 and 390 checks still to do.
- Tables are drawn with fixed column widths; a few long cells are clipped behind overlays (intended overlays, not content loss).
