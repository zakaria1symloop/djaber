# 14 — Mobile app (Flutter) — V2 reference

Status: **final (2026-10-11, owner-delegated decisions)**. This file is the single source for the mobile app. It refines module `MOB` (03 §21). Where this file and 03 §21 differ, **this file wins**.

Figma: file `3SieH2XU0UvTnTNRl991LO`, page **“Mobile V2”** (sections `M00` → `M11`, `M99`). The old page **“Screens”** is kept untouched and is only used to read the Arabic (`· AR`) and English (`· EN`) versions of the base screens.

## 1. How to read the Mobile V2 page

Figma web page = "Web V2" (id 898:24126) — read it only for a web behaviour the mobile frames reference.

| Frame name | Meaning | What the coder does |
|---|---|---|
| no prefix (e.g. `Orders list`, `10b — Conversation`) | base screen, copied from “Screens” (French) | implement exactly as drawn |
| `V2 — <area> — <screen>` | new V2 screen | implement exactly as drawn |
| `V2 CHANGED — <area> — <screen>` | change to a base screen | implement the base screen of the same area, then apply the changes written at the bottom of the frame; on conflict the CHANGED frame wins |
| `⛔ REMPLACÉ — …` (section `M99`) | superseded base screen | do not implement |

Grey text at the bottom of a frame (style Label/Meta, muted) is a rule for the code (error code, endpoint, state). It is never displayed to the user.

Counts: 207 base frames (11 of them superseded) + 51 V2 frames = 258.

## 2. Scope

The mobile app covers every merchant feature of the web **except** the web-only list below. Super-admin (platform) features are never on mobile (D5).

**Web-only (the mobile shows the item in Paramètres with the label “Uniquement sur le web” and no action):**
1. Members and invitations (inviting, role change, removal). Accepting an invitation works on mobile.
2. Integrations: Google Sheets, API keys, outbound webhooks.
3. System messages editing.
4. Plan change, checkout, invoices, promo codes for subscriptions. The mobile shows the current plan, limits and end date only (`V2 — Plan — géré sur le web`).
5. Activation / deactivation of 2FA and recovery codes. Logging in with 2FA works on mobile.
6. Danger zone: workspace deletion, ownership transfer.
7. Scheduled reports, saved views management (saved views are applied on mobile if they exist, not created).
8. Report exports larger than one screen (XLSX/PDF jobs); the mobile shows report screens and shares a PDF of the visible report only.

Everything else exists on mobile, including CSV/XLSX product import through the system file picker (D29).

## 3. Mobile-only rules

| Id | Rule |
|---|---|
| MOB-R01 | **Version gate.** At launch and on every return to foreground call `GET /app/version?platform=android|ios&version=x.y.z`. `status=update_required` ⇒ blocking screen `V2 — Système — Mise à jour requise` (no other screen reachable). `status=update_recommended` ⇒ banner `V2 — Système — Mise à jour recommandée (bandeau)` on Home; “Plus tard” hides it for 7 days. |
| MOB-R02 | **Maintenance.** Any response `503 MAINTENANCE_MODE` ⇒ screen `V2 — Système — Maintenance`; retry automatically every 60 s. |
| MOB-R03 | **Legal re-acceptance.** Any response `LEGAL_REACCEPT_REQUIRED` ⇒ screen `V2 — Système — Conditions mises à jour` listing `GET /legal/pending → [{ key, version, url }]`; continue only after `POST /legal/accept { key, version }` for every pending document. |
| MOB-R04 | **Offline.** Lists and details are readable from the last cache with the banner of `V2 — Système — Hors ligne`. Every action button and the inbox composer are disabled. No mutation is queued offline, with no exception. |
| MOB-R05 | **Session.** Access token 15 min, refresh rotation; tokens in secure storage (Keychain / Keystore). Refresh failure ⇒ `V2 — Système — Session expirée`, then return to the pending deep link after login. |
| MOB-R06 | **Biometrics.** After the first successful login offer “Déverrouillage par empreinte / Face ID”; when enabled, ask at each cold start; 3 failures ⇒ password login. Toggle in `V2 — Compte — Sécurité`. |
| MOB-R07 | **Push.** Show the pre-prompt `V2 — Système — Autorisation des notifications` once after the first login, then the system prompt. Granted ⇒ `POST /me/devices { token, platform, appVersion, deviceName?, locale }` (upsert on token; `422 DEVICE_LIMIT {max: 20}` ⇒ toast "20 appareils max."); logout ⇒ `DELETE /me/devices/:token`. Denied ⇒ card “Notifications désactivées — Ouvrir les réglages” in `V2 — Paramètres — Notifications`; ask again once, 7 days later. Every `NotificationType` opens its `djaber://` target (03 §35); if the object belongs to another workspace of the user, switch workspace first. |
| MOB-R08 | **Credit packs = in-app purchase.** Buying credits on mobile uses Google Play Billing / StoreKit consumables (`V2 — Crédits — Acheter un pack (achat intégré)`). After the store confirms, send the receipt to `POST /credits/packs/iap/validate { platform: google_play|app_store, productId, receipt|purchaseToken, transactionId } → { status, creditsAdded, balance }`; credit only after server validation (`IAP_RECEIPT_INVALID`, `IAP_RECEIPT_ALREADY_USED`); then consume/finish the transaction. Pack list = `GET /credit-packs?platform=google_play|app_store`. States in `V2 — Crédits — Achat · états`. “Restaurer les achats” re-sends unfinished receipts. Prices displayed are the store prices. |
| MOB-R09 | **No subscription purchase on mobile.** No price, no checkout button, no external payment link for plans. Text: “Le changement de plan et le paiement se font sur le web”. |
| MOB-R10 | **Row actions.** List rows have no buttons. `⋯` (or tap on the row’s status) opens the bottom sheet `V2 — Commandes — Actions (feuille)`, built from the same `ActionDescriptor[]` the API returns for the web `Actions ⌄` menu: first item = primary action, disabled items greyed with the reason. Long-press = multi-selection. Bulk results use `V2 — Commandes — Résultats de l’action groupée`. This applies to every list. |
| MOB-R11 | **Order source.** Every order row and the order detail show the source line: `✦ IA · <agent> · <canal>` / `✎ Manuel · <membre>` / `▣ Mobile · <membre>` / `{ } API · <clé>` / `⤒ Import · <fichier>`. Orders created in the app are saved with `source = mobile`. |
| MOB-R12 | **Moderation.** Product list and detail show the validation pill (`VALIDÉ`, `EN ATTENTE`, `REFUSÉ`, `CONTESTATION`). Refused product ⇒ `V2 — Produit — refusé` with “Enregistrer et resoumettre” and “Contester (1 fois)” (`V2 — Produit — Contester le refus`). |
| MOB-R13 | **Trust & safety.** The conversation menu contains “Marquer « risque »”, “Signaler à Djaber”, “Bloquer ce client” (`V2 — Boîte — Menu conversation`, `V2 — Boîte — Signaler à Djaber`). Blocked list in `V2 — Paramètres — Clients bloqués`; Admin+ unblock; platform blocks show `CUSTOMER_BLOCKED_BY_PLATFORM` (lock pill, no "Débloquer"). |
| MOB-R14 | **Support.** `V2 — Aide — centre d’aide` (guides open in an in-app web view of the public help), `V2 — Aide — Contacter le support`, `V2 — Aide — Demande (fil)`. The app attaches workspace, plan, platform, app version, current screen. |
| MOB-R15 | **Account deletion.** `V2 — Compte — Supprimer mon compte` (password; blocked with `ACCOUNT_OWNS_WORKSPACE` when the user owns a workspace). Required by Google Play and the App Store. |
| MOB-R16 | **Agent wizard.** Creating an agent uses the 5 steps `V2 — Agent — Assistant 1/5 … 5/5` (same fields and rules as web AGT-02). The merchant never chooses an AI model. Versions: `V2 — Agent — Versions`. |
| MOB-R17 | **Banners.** One banner at a time, same priority as the web: suspended > reconnect > credits 100 % > plan expired > credits 80 % > plan expiring > Meta approval pending > e-mail unverified (`V2 — Système — Bandeaux (priorité)`). |
| MOB-R18 | **External flows.** Meta OAuth, Google OAuth and accepting an invitation open the system browser and return through an app link (`djaber://oauth/return`, `djaber://invite?token=`, `djaber://verify?token=`). While waiting, the app shows “En attente du retour…” with the button “J’ai terminé” that re-checks the state. |
| MOB-R19 | **Device features.** Camera and gallery for product photos (10 images, 5 MB each, min 600 px); barcode scan in inventory count and counter sale; tap-to-call a client; share sheet for label and report PDFs. |
| MOB-R20 | **Languages.** fr, ar (RTL), en; same keys as the web copy deck (`docs/implementation/06-i18n-copy-deck.md`); numbers, phones and amounts stay left-to-right in Arabic. |

## 4. Screen map (section → base screens → V2 additions)

| Section | Base screens (implement as drawn) | V2 frames |
|---|---|---|
| M01 Démarrage & authentification | 01 Splash, 02–04 Onboarding, 05 Connexion, 06 Créer un compte, 07 Mot de passe oublié, 08 E-mail envoyé | `V2 — Auth — Connexion · erreurs`, `— Double authentification`, `— Vérifier l’e-mail`, `— Invitation`, `— Changer d’espace` |
| M02 Tutoriel | T1a–T6 | — |
| M03 Accueil, menu & notifications | 09 Accueil, 09a Menu, 09b Notifications (+ filtre, vide) | banners from M11 |
| M04 Pages connectées | 12 · v2, 13 · v2, Page overview/messages/AI settings/history/products/analysis (+ states) | — |
| M05 Boîte de réception | 10 Boîte, 10a Changer de page, 10b Conversation (+ états) | `V2 — Boîte — Menu conversation`, `— Signaler à Djaber`, `— Conversation · bandeaux et messages V2` |
| M06 Commandes, livraison & clients | Clients (list, details, add/edit, delete), Orders (list + states, detail + states, confirm ×3, new ×3, returned, delete), Delivery (overview, send, track, fees, providers) | `V2 CHANGED — Commandes — liste (source IA / humain)`, `V2 — Commandes — Actions (feuille)`, `— Résultat de l’appel`, `— Programmer un rappel`, `— Annuler (motif)`, `— Marquer livrée (COD)`, `— Résultats de l’action groupée`, `V2 — Livraison — Échecs à traiter` |
| M07 Stock (GDS) | 16s Services, 16 Aperçu (+ Avancé), 17 Produits, 18 Ajouter (+ variantes), Edit product, Adjust stock, unit, expenses, delete, low-stock, 17a détail, Categories, Suppliers, Sales, Purchases, Movements, Cash register, Recommendations | `V2 CHANGED — Produits — liste (validation Djaber)`, `V2 — Produit — refusé`, `— Contester le refus`, `— créer depuis une photo`, `V2 — Stock — Inventaire (comptage)`, `— Valider l’inventaire`, `V2 — Caisse — Clôturer la journée` |
| M08 Agents IA | 14 (+ états), 14a problèmes, 14b tester, 14c · v2 · modifier, 14d supprimer, 15c modifier (+ pages, quitter, chargement) | `V2 — Agent — Assistant 1/5 … 5/5`, `— Versions`, `— Résoudre un insight` |
| M09 Analytique & rapports | Dashboard analytics, Analytics ×7 (+ période personnalisée), Reports ×24 | — |
| M10 Paramètres, compte, crédits & aide | 11 Paramètres (content reused as sub-screens: Mode stock, Compte, Permissions), 11a Profil | `V2 CHANGED — Paramètres — menu`, `V2 — Paramètres — Notifications`, `— Clients bloqués`, `V2 — Compte — Sécurité`, `— Supprimer mon compte`, `V2 — Crédits — solde et historique`, `— Acheter un pack (achat intégré)`, `— Achat · états`, `V2 — Plan — géré sur le web`, `V2 — Aide — centre d’aide`, `— Contacter le support`, `— Demande (fil)` |
| M11 Système & états globaux | — | `V2 — Système — Mise à jour requise`, `— Mise à jour recommandée (bandeau)`, `— Maintenance`, `— Conditions mises à jour`, `— Hors ligne`, `— Session expirée`, `— Espace suspendu`, `— Autorisation des notifications`, `— Bandeaux (priorité)` |
| M99 Remplacés | `15`, `15b`, `15b.1`–`15b.5`, `12` (first version), `13` (first version), `14c` (first version) | replaced by M08 wizard, the `· v2` variants in M04, and `14c · v2 · modifier` |

`11 — Paramètres`: the long single page becomes the menu `V2 CHANGED — Paramètres — menu`; its sections “Mode stock”, “Compte” and “Permissions” become three sub-screens with the same content; its “Plan” section (plan cards with purchase) is not implemented and is replaced by `V2 — Plan — géré sur le web`.

## 5. API used only by mobile (all defined in 06 §11)

`GET /app/version` · `POST /me/devices` · `DELETE /me/devices/:token` · `POST /credits/packs/iap/validate` · `GET /legal/pending` + `POST /legal/accept { key, version }` · `GET /workspaces` (switcher). All other calls are the web endpoints with the header `X-Workspace-Id`.

## 6. Phase

Mobile is phase P3 and starts after the P1 API is stable (07, `docs/implementation/00-build-order.md`). The NestJS API must expose the mobile-only endpoints from milestone M0 (`GET /app/version`, `POST /me/devices`) and M9 (`POST /credits/packs/iap/validate`) so that the Flutter work does not need backend changes.

Flutter milestones (in this order): **MM1** shell, auth, workspace switcher, system screens (M01, M11) → **MM2** inbox, orders, delivery, clients (M05, M06, M03) → **MM3** GDS: products, stock, inventory, cash (M07) → **MM4** agents, analytics, settings, credits, help (M08, M09, M10, M04) → **MM5** store release (store listings, IAP products, review). Technical stack, package layout and coding rules: `docs/implementation/10-flutter-mobile.md`.
