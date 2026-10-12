# Carry-overs between stages

Items that belong to a stage's screens or flows but depend on a module built in a later stage.
Each line: where it came from → the stage that must close it. Remove the line when done (and say so in that stage's progress note).

| from | item | closes in |
|---|---|---|
| M1 | E-mail fan-out of `member.role_changed` and `member.invited` to the team per preferences (in-app rows exist since M3) | M5 (notification preferences, e-mail / push channels) |
| M1 | Workspace deletion: subscription cancelled at purge (pages are unsubscribed through the Meta port since M3) | M9 (billing) |
| M1 | Public account-deletion page `/account/deletion` + `POST /account-deletion/*`; `GET /me/data-export` and the export job | M11 (public pages) |
| M1 | AT-AUTH-09 server test uses a harness route for "order delete" (AT-AUTH-08 uses the real connect route since M3) | M5: point it at the real route |
| M1 | Avatar / logo crop step of the upload dialogs (API already resizes to 512 px) | M11 polish pass |
| M1 | `(app)` routes of later stages (`/orders`, …) render the localized 404 outside the shell | each stage adds its routes; final pass in M11 checks every sidebar link |
| all | Storybook: stories exist for every primitive and for the GLOBAL states; per-screen state stories are replaced by Playwright specs per AT id + axe checks (`apps/web/e2e`) | decision recorded in assumptions-log (M1) |
| M2 | `POST /products/bulk/labels` → 202 (product label sheet): needs the PDF service | M6 (labels / PDF) |
| M2 | Moderation: pre-screen job `moderation-prescreen`, human queue, decisions, trust levels, `product.*` notifications (M2 auto-approves every item) | M10 |
| M2 | Notification preferences (`GET\|PUT /notification-preferences`), e-mail / push fan-out for every type (the centre endpoints and the in-app rows exist since M3; channels plug in with `NotificationProducer.registerChannel`) | M5 |
| M2 | Outbound webhooks `stock.low`, `stock.out`, `product.updated`: outbox rows are produced, delivery is not | M11 |
| M2 | Appeal attachment as PDF (M2 accepts images only through `POST /uploads { kind: appeal_attachment }`) | M10 |
| M2 | Products: "Commandes de ce produit" link (row menu, quick-edit sheet, product page), movement references to orders / sales / purchases as links | M5 (orders) · M7 (GDS operations) |
| M2 | `POST /products/bulk/labels` + "Étiquettes" (bulk bar, product page menu) | M6 (labels) |
| M2 | KPI tiles of `/movements` and filter-following KPIs of `/products` (need `/stock/movements/stats`, `/products/stats`) | M7 / M8 |
| M2 | Stock dashboard block "ACHATS & FOURNISSEURS", "Réapprovisionner" → purchase, product expenses editor | M7 |
| M2 | Saved views ("Enregistrer cette vue") on products and movements | milestone that adds the saved-view endpoints (06 §8.1) |
| M2 | Appeal attachment field and category image field in the web (API upload kinds `appeal_attachment`, `category_image` exist) | M10 (appeals) / M11 polish |
| M2 | Conflict detection on the product form treats any change arriving within 5 s of this tab's own write as its own (a foreign edit inside that window is rebased silently) | M11 polish: tag WS events with the originating session id |
| M3 | Inbox client panel and conversation menu: "Nouvelle commande pour {client}", order cards linking to `/orders/:id`, "Fiche client", "Commandes de ce client", "Compléter la fiche", "Marquer « risque »" (`POST /clients/:id/risk`) | M5 (clients, orders) |
| M3 | Inbox / shell credits: the thread banner, the shell banners `credits80` / `credits100` / `negativeCredits`, the header pill and the read-only `/settings/credits` exist since M4; "Acheter des crédits" / "Renouveler" only open `/settings/credits` — pack purchase, calculator, ledger CSV export, invoices and checkout return | M9 |
| M3 | Inbox: sound on a new customer message (`User.prefs.soundOnMessage`) and its toggle in Settings › Notifications | M5 (notification preferences) |
| M3 | /notifications "Préférences" button (→ /settings/notifications, NTF-02) | M5 |
| M3 | Blocked-customers list: platform rows are created by moderators; e2e uses a fixture row | M10 |
| M3 | Channel overview tiles "Commandes IA (30 j)" and "Résolution IA" | M5 / M8 |
| M3 | "Comparer les plans" / "Voir les plans" on `/channels` link to `/settings/billing` (404 until then) | M9 |
| M3 | Customer messages of notifications (`NotificationProducer` → `OutboundSendService.sendSystemText(…, { kind: 'transactional' })`) for order / shipment / payment events | M5 / M6 (producers) |
| M3 | Admin side of trust & safety: report decisions, platform blacklist ⇒ `CustomerBlock(source=platform)`, `sched-abuse-auto-rules`, auto-block rule, `POST /admin/channels/:id/release` (`ChannelService.releaseExternalId` exists), `MetaPermission` editor read by `sched-meta-review-poll` | M10 |
| M3 | Per-channel send limiter (10 / s, BullMQ `limiter`) and Prometheus metrics of the intake (`meta_webhook_ack_seconds`, `meta_webhook_invalid_signature_total`, `meta_send_failures_total`) | M10 (jobs & health) |
| M3 | Meta data deletion matches the `user_id` of the signed_request with `Conversation.externalSenderId`: check on the real app (App Review) that Meta sends the page-scoped id for this app | M11 (public pages, App Review pass) |
| M3 | WebSocket `resync` still answers the time only (clients refetch); client → server `typing` not handled | M11 polish |
| M4 | Web pause dialog: checkbox "Envoyer le message « hors horaires » aux clients qui écrivent" (AGV-07) — `PauseAgentSchema` takes `{ confirm }` only | when `POST /agents/:id/pause` accepts the flag (M11 polish at the latest) |
| M4 | Agents menu "Voir les commandes générées" (`/orders?source=ai&agentId=`), agent page tabs Conversations / Commandes of AGT-03 | M5 (orders) |
| M4 | Inbox "IA répond…" indicator: needs a server → client typing event (03-events §2 has none) | M11 polish (with the WS `typing` row above) |
| M4 | Generate-from-page review: editing the proposed instructions before applying (`ApplyGenerationSchema` has no override field); CHN-08 cards: post date and detected stock (`AnalysisItem` has neither) | M11 polish |
| M4 | Products "Agents qui le vendent" as a list filter `/agents?productId=` (`AgentsQuerySchema` has no `productId`; agent names link to `/agents/:id` meanwhile) | M11 polish |
| M4 | Insights tab: counts of the three status tabs in one answer (`meta.counts`) | M8 (analytics) or M11 polish |
| M4 | Web e2e states still served by `page.route` because the fake drivers cannot produce them over HTTP (each marked `// mock:` in `apps/web/e2e/m4-*.spec.ts`): agent `pausedReason: 'plan'`, pack credits and negative balance, preset update published, page token refused (needs reconnect), provider failures (AI unavailable, fallback model, AI_PROVIDER_ERROR, failed / running generation and analysis jobs), 410 expired test link, list 5xx states | M9 (plan downgrade, packs, `credits.negative`), M10 (presets editor, provider admin): switch those tests to the real API |
| M4 | `create_order` / `cancel_order`: schemas, validation, limits, dry run and replay are in place behind `ORDER_TOOLS` (`modules/ai/tools/order-tools.ts`); M4 answers "orders module not available" + handoff | M5: bind `OrderService.createFromAi` / `OrderEffects.cancel` to `ORDER_TOOLS` (duplicate guard, stock, client merge, `order.ai_created`, cart in `Conversation.context`); finish AT-AI-04 / 05 / 06 / 07 on real orders |
| M4 | `create_payment_link` tool (schema defined, never offered) | M9 (online payment) |
| M4 | Credit packs, purchases, promo grants, plan change mid-period, `credits.negative` (the ledger buckets and `CreditService.grant` are ready) | M9 (billing) |
| M4 | Admin side of the AI: provider keys (`AiProvider.apiKey`, sealed by `RoutingService.sealKey`), models, routes, pricing versions, presets editor, eval dashboard | M10 |
| M4 | Per-workspace concurrency cap of `ai-reply`, Prometheus metrics `ai_run_latency_seconds` / `ai_run_errors_total` / `credits_debited_total` | M10 (jobs & health) |
| M4 | FAQ import of PDF / DOCX; ice-breaker pushed to the Messenger profile API; server texts of agents (`agentText`) moved to i18n keys | M11 polish |
| M4 | Evals with `EVAL_DRIVER=live` (real models, real photos and recordings next to the vision / voice fixtures), nightly | when provider keys exist on staging (M10 / M12) |
