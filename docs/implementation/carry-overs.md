# Carry-overs between stages

Items that belong to a stage's screens or flows but depend on a module built in a later stage.
Each line: where it came from → the stage that must close it. Remove the line when done (and say so in that stage's progress note).

| from | item | closes in |
|---|---|---|
| M1 | In-app notifications `member.invited`, `member.joined`, `member.role_changed`, `workspace.deletion_scheduled` (M1 sends the e-mails only) | M5 (notifications module, AT-NTF) |
| M1 | Workspace deletion: Meta unsubscribe of connected pages at purge time; subscription cancelled at purge | M3 (channels) / M9 (billing) |
| M1 | Public account-deletion page `/account/deletion` + `POST /account-deletion/*`; `GET /me/data-export` and the export job | M11 (public pages) |
| M1 | Onboarding steps 4–5 main buttons (create agent / connect a page) only advance (step 3 "add products" creates the product since M2) | M3 (channel) · M4 (agent) |
| M1 | AT-AUTH-08 / AT-AUTH-09 server tests use harness routes for "channel connect" and "order delete" | M3 / M5: point them at the real routes |
| M1 | Avatar / logo crop step of the upload dialogs (API already resizes to 512 px) | M11 polish pass |
| M1 | `(app)` routes of later stages (`/orders`, …) render the localized 404 outside the shell | each stage adds its routes; final pass in M11 checks every sidebar link |
| all | Storybook: stories exist for every primitive and for the GLOBAL states; per-screen state stories are replaced by Playwright specs per AT id + axe checks (`apps/web/e2e`) | decision recorded in assumptions-log (M1) |
| M2 | `POST /products/bulk/labels` → 202 (product label sheet): needs the PDF service | M6 (labels / PDF) |
| M2 | Moderation: pre-screen job `moderation-prescreen`, human queue, decisions, trust levels, `product.*` notifications (M2 auto-approves every item) | M10 |
| M2 | AI behind interfaces: image caption (`IMAGE_CAPTION_PROVIDER`, stub = null) and create-from-photo (`PRODUCT_VISION_PROVIDER`, deterministic fake); credits (5) for ai-fill | M4 |
| M2 | Notification centre, preferences, e-mail / push fan-out for `stock.low`, `stock.out`, `job.finished`, `job.failed` (M2 writes the in-app rows only) | M5 |
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
