# Carry-overs between stages

Items that belong to a stage's screens or flows but depend on a module built in a later stage.
Each line: where it came from → the stage that must close it. Remove the line when done (and say so in that stage's progress note).

| from | item | closes in |
|---|---|---|
| M1 | E-mail fan-out of `member.role_changed` and `member.invited` to the team per preferences (in-app rows exist since M3) | M5 (notification preferences, e-mail / push channels) |
| M1 | Workspace deletion: subscription cancelled at purge (pages are unsubscribed through the Meta port since M3) | M9 (billing) |
| M1 | Public account-deletion page `/account/deletion` + `POST /account-deletion/*`; `GET /me/data-export` and the export job | M11 (public pages) |
| M1 | Onboarding step 4 main button (create agent) only advances (step 3 creates the product since M2, step 5 starts the connect flow since M3) | M4 (agent) |
| M1 | AT-AUTH-09 server test uses a harness route for "order delete" (AT-AUTH-08 uses the real connect route since M3) | M5: point it at the real route |
| M1 | Avatar / logo crop step of the upload dialogs (API already resizes to 512 px) | M11 polish pass |
| M1 | `(app)` routes of later stages (`/orders`, …) render the localized 404 outside the shell | each stage adds its routes; final pass in M11 checks every sidebar link |
| all | Storybook: stories exist for every primitive and for the GLOBAL states; per-screen state stories are replaced by Playwright specs per AT id + axe checks (`apps/web/e2e`) | decision recorded in assumptions-log (M1) |
| M2 | `POST /products/bulk/labels` → 202 (product label sheet): needs the PDF service | M6 (labels / PDF) |
| M2 | Moderation: pre-screen job `moderation-prescreen`, human queue, decisions, trust levels, `product.*` notifications (M2 auto-approves every item) | M10 |
| M2 | AI behind interfaces: image caption (`IMAGE_CAPTION_PROVIDER`, stub = null) and create-from-photo (`PRODUCT_VISION_PROVIDER`, deterministic fake); credits (5) for ai-fill | M4 |
| M2 | Notification preferences (`GET\|PUT /notification-preferences`), e-mail / push fan-out for every type (the centre endpoints and the in-app rows exist since M3; channels plug in with `NotificationProducer.registerChannel`) | M5 |
| M2 | Outbound webhooks `stock.low`, `stock.out`, `product.updated`: outbox rows are produced, delivery is not | M11 |
| M2 | Appeal attachment as PDF (M2 accepts images only through `POST /uploads { kind: appeal_attachment }`) | M10 |
| M2 | Products list: "Ajouter à un agent" (bulk + row), agent chips of the filter panel, "Agents qui le vendent" link | M4 (agents) |
| M2 | Products: "Commandes de ce produit" link (row menu, quick-edit sheet, product page), movement references to orders / sales / purchases as links | M5 (orders) · M7 (GDS operations) |
| M2 | `POST /products/bulk/labels` + "Étiquettes" (bulk bar, product page menu) | M6 (labels) |
| M2 | KPI tiles of `/movements` and filter-following KPIs of `/products` (need `/stock/movements/stats`, `/products/stats`) | M7 / M8 |
| M2 | Stock dashboard block "ACHATS & FOURNISSEURS", "Réapprovisionner" → purchase, product expenses editor | M7 |
| M2 | Saved views ("Enregistrer cette vue") on products and movements | milestone that adds the saved-view endpoints (06 §8.1) |
| M2 | Appeal attachment field and category image field in the web (API upload kinds `appeal_attachment`, `category_image` exist) | M10 (appeals) / M11 polish |
| M2 | Conflict detection on the product form treats any change arriving within 5 s of this tab's own write as its own (a foreign edit inside that window is rebased silently) | M11 polish: tag WS events with the originating session id |
| M3 | Inbox client panel and conversation menu: "Nouvelle commande pour {client}", order cards linking to `/orders/:id`, "Fiche client", "Commandes de ce client", "Compléter la fiche", "Marquer « risque »" (`POST /clients/:id/risk`) | M5 (clients, orders) |
| M3 | Inbox: "Insights IA de ce fil", banner IA INDISPONIBLE (`aiUnavailable` flag on the conversation), click on "IA" → detail of the turn (`GET /messages/:id/ai-run`) | M4 (AI pipeline) |
| M3 | Inbox: `GLOBAL — Credits exhausted — thread state` — the thread banner is rendered when the conversation carries `creditsExhausted`; the flag, the shell banner `credits100` and "Acheter des crédits" arrive with billing | M9 |
| M3 | Inbox: sound on a new customer message (`User.prefs.soundOnMessage`) and its toggle in Settings › Notifications | M5 (notification preferences) |
| M3 | /notifications "Préférences" button (→ /settings/notifications, NTF-02) | M5 |
| M3 | /queue insight cards: "Ajouter aux instructions" / "Ignorer" (`POST /agent-insights/:id/resolve`) and the insights list itself (`GET /agent-insights` answers 404 until then: column empty, badge = needs-human only) | M4 |
| M3 | Blocked-customers list: platform rows are created by moderators; e2e uses a fixture row | M10 |
| M3 | Channel page "IA & agent": Changer ⌄ / Détacher / Rattacher / Créer un agent; agent selector + "Rattacher et terminer" of the connect report; "Agent IA prêt · Régénérer" on channel cards; "Extraire le catalogue" row action; tab "Analyse du catalogue" (CHN-08) | M4 |
| M3 | Channel overview tiles "Commandes IA (30 j)" and "Résolution IA" | M5 / M8 |
| M3 | "Comparer les plans" / "Voir les plans" on `/channels` link to `/settings/billing` (404 until then) | M9 |
| M3 | `PUT /channels/:id/agent`, `PUT /channels/:id/icebreaker`, page analysis (`POST\|GET /channels/:id/analysis`, import), `GET /messages/:id/ai-run` | M4 (agents, AI) |
| M3 | AI side of the intake: `ai-reply / reply` processor consuming `BatchingService`, credits / quota gates (FL-01 F-4), voice with transcription off (F-2), `welcome` / `out_of_hours` texts, insight on handoff | M4 |
| M3 | Customer messages of notifications (`NotificationProducer` → `OutboundSendService.sendSystemText(…, { kind: 'transactional' })`) for order / shipment / payment events | M5 / M6 (producers) |
| M3 | Admin side of trust & safety: report decisions, platform blacklist ⇒ `CustomerBlock(source=platform)`, `sched-abuse-auto-rules`, auto-block rule, `POST /admin/channels/:id/release` (`ChannelService.releaseExternalId` exists), `MetaPermission` editor read by `sched-meta-review-poll` | M10 |
| M3 | Per-channel send limiter (10 / s, BullMQ `limiter`) and Prometheus metrics of the intake (`meta_webhook_ack_seconds`, `meta_webhook_invalid_signature_total`, `meta_send_failures_total`) | M10 (jobs & health) |
| M3 | Meta data deletion matches the `user_id` of the signed_request with `Conversation.externalSenderId`: check on the real app (App Review) that Meta sends the page-scoped id for this app | M11 (public pages, App Review pass) |
| M3 | WebSocket `resync` still answers the time only (clients refetch); client → server `typing` not handled | M11 polish |
