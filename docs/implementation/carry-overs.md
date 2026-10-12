# Carry-overs between stages

Items that belong to a stage's screens or flows but depend on a module built in a later stage.
Each line: where it came from → the stage that must close it. Remove the line when done (and say so in that stage's progress note).

| from | item | closes in |
|---|---|---|
| M1 | Workspace deletion: subscription cancelled at purge (pages are unsubscribed through the Meta port since M3) | M9 (billing) |
| M1 | Public account-deletion page `/account/deletion` + `POST /account-deletion/*`; `GET /me/data-export` and the export job | M11 (public pages) |
| M1 | Avatar / logo crop step of the upload dialogs (API already resizes to 512 px) | M11 polish pass |
| M1 | `(app)` routes of later stages (`/orders`, …) render the localized 404 outside the shell | each stage adds its routes; final pass in M11 checks every sidebar link |
| all | Storybook: stories exist for every primitive and for the GLOBAL states; per-screen state stories are replaced by Playwright specs per AT id + axe checks (`apps/web/e2e`) | decision recorded in assumptions-log (M1) |
| M2 | Moderation: pre-screen job `moderation-prescreen`, human queue, decisions, trust levels, `product.*` notifications (M2 auto-approves every item) | M10 |
| M2 | Outbound webhooks `stock.low`, `stock.out`, `product.updated`: outbox rows are produced, delivery is not | M11 |
| M2 | Appeal attachment as PDF (M2 accepts images only through `POST /uploads { kind: appeal_attachment }`) | M10 |
| M2 | Saved views ("Enregistrer cette vue") on products, movements, orders and clients (`view=` is accepted and ignored by the lists until then) | milestone that adds the saved-view endpoints (06 §8.1) |
| M2 | Appeal attachment field and category image field in the web (API upload kinds `appeal_attachment`, `category_image` exist) | M10 (appeals) / M11 polish |
| M2 | Conflict detection on the product form treats any change arriving within 5 s of this tab's own write as its own (a foreign edit inside that window is rebased silently) | M11 polish: tag WS events with the originating session id |
| M3 | Inbox / shell credits: the thread banner, the shell banners `credits80` / `credits100` / `negativeCredits`, the header pill and the read-only `/settings/credits` exist since M4; "Acheter des crédits" / "Renouveler" only open `/settings/credits` — pack purchase, calculator, ledger CSV export, invoices and checkout return | M9 |
| M3 | Blocked-customers list: platform rows are created by moderators; e2e uses a fixture row | M10 |
| M3 | Channel overview tile "Résolution IA" ("Commandes IA (30 j)" = `ChannelSummaryView.aiOrders30d` since M5) | M8 |
| M3 | "Comparer les plans" / "Voir les plans" on `/channels` link to `/settings/billing` (404 until then) | M9 |
| M3 | Customer messages of notifications for payment events (shipment texts `customer.orderShipped / orderOutForDelivery / orderDelivered / orderFailed` are sent since M6) | M9 (payment links) |
| M3 | Admin side of trust & safety: report decisions, platform blacklist ⇒ `CustomerBlock(source=platform)`, `sched-abuse-auto-rules`, auto-block rule, `POST /admin/channels/:id/release` (`ChannelService.releaseExternalId` exists), `MetaPermission` editor read by `sched-meta-review-poll` | M10 |
| M3 | Per-channel send limiter (10 / s, BullMQ `limiter`) and Prometheus metrics of the intake (`meta_webhook_ack_seconds`, `meta_webhook_invalid_signature_total`, `meta_send_failures_total`) | M10 (jobs & health) |
| M3 | Meta data deletion matches the `user_id` of the signed_request with `Conversation.externalSenderId`: check on the real app (App Review) that Meta sends the page-scoped id for this app | M11 (public pages, App Review pass) |
| M3 | WebSocket `resync` still answers the time only (clients refetch); client → server `typing` not handled | M11 polish |
| M4 | Web pause dialog: checkbox "Envoyer le message « hors horaires » aux clients qui écrivent" (AGV-07) — `PauseAgentSchema` takes `{ confirm }` only | when `POST /agents/:id/pause` accepts the flag (M11 polish at the latest) |
| M4 | Inbox "IA répond…" indicator: needs a server → client typing event (03-events §2 has none) | M11 polish (with the WS `typing` row above) |
| M4 | Generate-from-page review: editing the proposed instructions before applying (`ApplyGenerationSchema` has no override field); CHN-08 cards: post date and detected stock (`AnalysisItem` has neither) | M11 polish |
| M4 | Products "Agents qui le vendent" as a list filter `/agents?productId=` (`AgentsQuerySchema` has no `productId`; agent names link to `/agents/:id` meanwhile) | M11 polish |
| M4 | Insights tab: counts of the three status tabs in one answer (`meta.counts`) | M8 (analytics) or M11 polish |
| M4 | Web e2e states still served by `page.route` because the fake drivers cannot produce them over HTTP (each marked `// mock:` in `apps/web/e2e/m4-*.spec.ts`): agent `pausedReason: 'plan'`, pack credits and negative balance, preset update published, page token refused (needs reconnect), provider failures (AI unavailable, fallback model, AI_PROVIDER_ERROR, failed / running generation and analysis jobs), 410 expired test link, list 5xx states | M9 (plan downgrade, packs, `credits.negative`), M10 (presets editor, provider admin): switch those tests to the real API |
| M4 | `create_payment_link` tool (schema defined, never offered) | M9 (online payment) |
| M4 | Credit packs, purchases, promo grants, plan change mid-period, `credits.negative` (the ledger buckets and `CreditService.grant` are ready) | M9 (billing) |
| M4 | Admin side of the AI: provider keys (`AiProvider.apiKey`, sealed by `RoutingService.sealKey`), models, routes, pricing versions, presets editor, eval dashboard | M10 |
| M4 | Per-workspace concurrency cap of `ai-reply`, Prometheus metrics `ai_run_latency_seconds` / `ai_run_errors_total` / `credits_debited_total` | M10 (jobs & health) |
| M4 | FAQ import of PDF / DOCX; ice-breaker pushed to the Messenger profile API; server texts of agents (`agentText`) moved to i18n keys | M11 polish |
| M4 | Evals with `EVAL_DRIVER=live` (real models, real photos and recordings next to the vision / voice fixtures), nightly | when provider keys exist on staging (M10 / M12) |
| M5 | Order export `format=pdf` (06 §7): only `csv` / `xlsx`; the A5 slips are the PDF output | M8 (reports & exports) |
| M5 | Payment link (`POST /orders/:id/payment-link`), refunds (`POST /orders/:id/refunds`), `paymentStatus=pending_link` | M9 (online payment, P2) |
| M5 | Consumers of the `sheets` outbox rows (`sheets:<orderId>:<version>`) and of the order / customer webhook rows (acknowledged without delivery) | M11 (integrations) |
| M5 | Order address change inside 24 h: a thread event only, no automated customer text (no `customer.*` key for it) | M11 polish (copy deck key + send) |
| M5 | Home "À traiter" handled cards greyed 24 h with "fait par …" (no storage: handled items disappear) | M8 (analytics) or M11 polish |
| M5 | "Lien de paiement" and "Rembourser" dialogs of the order page (P2, Chargily) | M9 |
| M5 | Inbox `?agentId=` filter (agent page "Conversations" link tab lands on the unfiltered inbox) | M11 polish |
| M5 | Client tag suggestions: no endpoint lists the workspace tags (filters and the Tags dialog offer the tags of the loaded rows) | M11 polish |
| M6 | Analytics › Livraison tab (DLV-11): the per-courier figures (sent / delivered / failed / returned / avg days / COD collected, 30 d) are served by `GET /delivery/overview` `kpis.byCourier`; period picker, comparison and the analytics endpoint `GET /analytics/delivery` | M8 |
| M6 | Captcha on the public "Signaler ce vendeur" (`POST /track/:publicToken/report`, IP limit only) | M11 (public pages) |
| M6 | Live courier drivers checked against the real APIs with sandbox / test accounts (EcoTrack contract to verify, 03 DLV-10; Yalidine webhook subscription handshake); `COURIER_DRIVER=live` is refused outside staging / production | staging pass before go-live (M10 jobs & health) |
| M6 | Prometheus metrics `courier_requests_total{provider,outcome}`, `courier_unknown_status_total{provider,raw}` (unknown raw statuses are stored as events with `mappedStatus = null` meanwhile) | M10 (jobs & health) |
| M6 | Courier label when the provider exposes it only as a URL that needs the courier session (Yalidine label URLs are fetched through the adapter; failures fall back to the Djaber label) — re-check on staging | staging pass (M10) |
| M6 | Public header marketing links of `/s/[code]` (Fonctionnalités · Tarifs · Aide · Statut, PublicLayout 02 §1): the header shows logo · FR/AR/EN · Se connecter · Essai gratuit until those pages exist | M11 (public pages) |
| M6 | DLG "Imprimer les bordereaux" options "Un PDF par commande" and "Inclure le récapitulatif interne" (not in `LabelsJobSchema`: merged A6 / thermal / A5 only) | M11 polish (labels job options) |
| M6 | `/delivery` bulk "Exporter CSV" (MECH "Autres actions groupées"): no shipments export endpoint | M8 (reports & exports) |
| M7 | Reports of GDS-10 (23, incl. "Écarts d'inventaire", "Journal de caisse", P&L through `modules/gds/money-figures.ts`), report export / schedules | M8 |
| M7 | Cross-sell suggestions in the AI prompt: the catalogue context lists up to 2 active rules per product (since M4); the REC-01 "max 3 per turn" is enforced on the impressions only | M11 polish (prompt section dedicated to recommendations) |
| M7 | Promotion entity for the PROMOUVOIR card ("Créer la promo"): no promotion model; applying records `appliedRefType=promo` and the web opens the price form | when a promotions feature is specified |
| M7 (web) | "Exporter" of /purchases and /sales (Figma GDS-07 / GDS-08): no purchases / sales export endpoint; the reports "Achats" / "Ventes" cover it | M8 (reports & exports) |
| M7 (web) | Supplier sheet "Voir les produits (n)": `/products` has no supplier filter (the sheet links to the supplier's purchases meanwhile) | M11 polish (products `supplierId` filter) |
| M7 (web) | Saved views ("Enregistrer la vue", GDS-05 movements panel) on the GDS lists | M11 polish (saved views, as for orders) |
