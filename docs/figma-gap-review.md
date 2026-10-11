# Figma gap review — 2026-10-06

Trigger: owner review of the first complete web design. Owner notes: agent creation not detailed; super-admin lacks real UX (e.g. product approval needed because the mobile app will ship on Google Play / App Store); orders list used big text buttons in rows and did not show whether an order came from the AI or a human. Owner asked for a self-driven gap pass beyond those notes.

## Gaps found and drawn (20 new frames)

| # | Gap (why it matters) | Frame(s) |
|---|---|---|
| 1 | Row actions were text buttons; no order source | **ORD-05 v2** — dense rows, SOURCE column (✦ IA + agent/canal · ✎ Manuel · ▣ Mobile · { } API · ⤒ Import), one compact "Actions ⌄" dropdown per row (open menu drawn: state-aware items, shortcuts, greyed item with reason), selection bar for bulk actions, density toggle, legend panel = the rule for every list |
| 2 | Agent creation only had step 4 | **AGT-02 steps 1, 2, 3, 5** (identity/preset, knowledge: catalogue scope + policies + FAQ + extraction, behaviour: capabilities + order-taking fields + limits + handoff rules, test & activate with readiness checklist and 8 auto scenarios) + **AGT-03 agent page** (KPIs, config summary with "edit step n", versions with restore, preset update notice) |
| 3 | Store compliance: merchant-generated products must be reviewed (counterfeit, prohibited goods, images) | **ADM-10 moderation queue** (AI pre-screen score + flags, trust levels, SLA, bulk, review panel with reason templates + merchant message, appeal) + **MOD merchant side** (list pills, rejected banner, resubmit/appeal, what triggers re-review, agent exclusion, import behaviour) |
| 4 | Store compliance: UGC reporting / blocking in a messaging app | **ADM-11 abuse reports** (reported conversations/customers/merchants/AI messages, decision panel, platform blacklist, blocked words, auto rules) + **SAFE merchant side** (block/report customer from inbox menu, blocked list, report dialog, auto rules, silent block for end customer) |
| 5 | No support channel for merchants | **ADM-12 support tickets** (SLA per plan, auto-context, canned replies, impersonation link, escalation) + **HELP merchant** (help center, status, contact form with auto-context, my tickets) |
| 6 | Mobile app lifecycle: min/forced version, maintenance, legal re-acceptance, Meta permissions, provider health | **ADM-13 platform settings** (app versions per store with force update, feature flags web/mobile %, maintenance mode, legal docs versions, Meta app permissions + review, technical providers incl. SATIM/e-mail/SMS/push/couriers/Google, limits) |
| 7 | Nobody could see queues/webhooks/AI failures | **ADM-14 jobs & health** (BullMQ queues with replay, DLQ, incidents, Meta webhook stats) |
| 8 | Credits sold on mobile must go through in-app purchase; promo codes undefined | **ADM-15 credit packs & promo codes** (store product IDs, store-tier prices, IAP server validation/refund, promo rules + error codes) |
| 9 | Admin team had one role; account deletion (Google Play requirement) had no queue | **ADM-16 admin roles & deletion requests** (role matrix super admin/support/moderator/finance/read, 2FA enforced, 30-day grace flow, blocked when owning an active workspace) |

Also: older ADM-01…09 sidebars aligned to the 15-item admin menu; ORD-05 v1 kept only as the shell source (named "superseded").

## Decisions implied by the frames (to confirm, then add to specs README)

- D36 Product moderation: every new/changed product (title, images, category, description, price ±50 %) goes through `ModerationItem`; auto-approve when AI score ≥ 0.9 and workspace trust ≥ standard and category not sensitive; otherwise human review, SLA 2 h; 1 appeal; 3 counterfeit rejections / 90 d → trust "watch".
- D37 Reports & blocking: merchants can block customers (local) and report (platform); platform blacklist for multi-workspace abuse; silent block towards the end customer; decisions < 24 h, reporter notified.
- D38 Support: in-app tickets with auto-context; SLA Pro 1 h / Starter 4 h / Free 24 h (Algiers business hours).
- D39 Mobile lifecycle: min required / recommended versions per store; forced update needs 2FA confirmation; legal docs versioned with re-acceptance on major versions; public account-deletion URL.
- D40 Credit packs on mobile are in-app purchases (server-validated receipts); pack credits never expire and are consumed after plan credits; store refunds remove credits.
- D41 Platform roles: super admin, support, moderator, finance, read-only; 2FA mandatory; impersonation read-only by default, write needs confirmation + owner e-mail.
- D42 List rows: one "Actions ⌄" dropdown per row (owner choice over icon rows); menu lists the actions of the current state, first = primary (highlighted, Enter), forbidden ones greyed with the error code; keyboard shortcuts; SOURCE column on orders; density preference per user.

## Added in the consistency pass (same day)

- **MOD — Product rejected view + appeal dialog** (04 GDS): highlighted refused fields, validation timeline, one-shot appeal with attachment.
- **PUB — Public status page** and **PUB — Public account deletion page** (new section 13 Public pages).
- Page-wide: every data-list row now uses the `Actions ⌄` chip (64 rows across 19 frames); single-CTA contexts (banners, notifications, export jobs, sessions, API keys, blocked customers, order line items) keep an explicit button.
- Sections renumbered 00 → 13 in stack order; cover rebuilt (95 frames).

## Still open (to decide)

- Mobile-specific moderation/report screens are in the mobile Figma scope, not here.
- Error codes introduced by all frames must be merged into `11-error-catalogue.md` (e.g. `MODERATION_*`, `REPORT_*`, `PROMO_*`, `USER_OWNS_WORKSPACE`, `AGENT_NO_CHANNEL`, `SALE_PARTIAL_REQUIRES_CUSTOMER`, `CASH_ENTRY_LOCKED`, `GDS_MOVEMENT_IMMUTABLE`).
