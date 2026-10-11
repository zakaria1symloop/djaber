# 10 — Flutter mobile app (implementation guide)

Status: final (2026-10-11, R-S). Companion of `docs/specs/14-mobile-app.md` (functional reference; wins over 03 §21). This file fixes the stack, the architecture and the coding rules of `apps/mobile` so that the coding model never has to choose.

---

## 1. Purpose and read order

The mobile app is the merchant app (Android + iOS) of Djaber v2: every merchant feature of the web except the web-only list of 14 §2, on the same REST API + WebSocket, with the same i18n keys, the same error codes and the same notification deep links. Platform (admin) features are never on mobile.

Read, in this order, before any mobile task: `CLAUDE.md` → `docs/implementation/00-build-order.md` (M12 + milestones MM1–MM5) → `docs/specs/14-mobile-app.md` → this file → `docs/implementation/02-next-route-map.md` (route paths = deep-link paths) → `docs/specs/06-api.md` §11 + `docs/implementation/api-contract.md` (DTOs, envelope, headers) → `docs/specs/11-error-catalogue.md` (codes, UI kind per code) → `docs/specs/03-functional-modules.md` §15 (notification types, deep links) → `docs/implementation/06-i18n-copy-deck.md` (keys) → `docs/specs/12-screen-states.md` §16 (GLOBAL patterns) → the Figma frames: page "Mobile V2" (base FR + V2 screens) and page "Screens" (AR/EN of base screens), file `3SieH2XU0UvTnTNRl991LO`, reading rules of 14 §1.

Milestones (00-build-order): MM1 shell + auth + system screens → MM2 inbox + orders + clients + delivery → MM3 GDS → MM4 agents + analytics + settings + credits + help → MM5 store release. Mobile starts after the P1 API is stable; the API exposes `/app/version` and `/me/devices` from M0 and the IAP endpoint from M9.

---

## 2. Stack (decided)

| Item | Value |
|---|---|
| Framework | Flutter 3.x stable channel, pinned with `fvm` in `apps/mobile/.fvmrc` (`"flutter": "stable"`); Dart 3; `flutter analyze` with `package:flutter_lints` + `custom_lint` + `riverpod_lint` |
| Packages (repo) | `apps/mobile` (the app, package name `djaber_mobile`) · `packages/mobile_api` (Dart client generated from the API OpenAPI document) · `packages/mobile_ui` (design tokens, primitives, pills, bottom sheets, state widgets — the Flutter counterpart of `packages/ui`) |
| Dependency wiring | `apps/mobile/pubspec.yaml` depends on `mobile_api` and `mobile_ui` by `path:`; no melos, no pub workspace |
| API client generation | `openapi-generator-cli` 7.x, generator `dart-dio`, input `http://localhost:4000/api/docs-json` (CI: the artifact of the API build), output `packages/mobile_api/lib/` (committed); script `pnpm mobile:api` at the repo root and job `mobile-api` in CI that fails when the committed client differs from the regenerated one |
| Serialization | `json_serializable` + `freezed` for app-side models (`features/<area>/domain`); the generated client's models are used as-is in `data`, mapped to domain models in repositories |
| HTTP | `dio` 5.x (§5) |
| State | `flutter_riverpod` 2.x + `riverpod_annotation` + `riverpod_generator` (§3) |
| Routing | `go_router` 14.x (§4) |
| Secure storage | `flutter_secure_storage` 9.x (§6) |
| Cache | `drift` 2.x on SQLite (`sqlite3_flutter_libs`) (§6) |
| Preferences | `shared_preferences` 2.x (§6) |
| Push | `firebase_core` + `firebase_messaging` 15.x (§7) |
| IAP | `in_app_purchase` 3.x (§8) |
| i18n | `slang` 4.x + `slang_flutter` (§9) |
| WebSocket | `socket_io_client` 3.x (Socket.IO namespace `/ws`, same auth as the web: `auth: { token }`, rooms per workspace; reconnect with exponential backoff 1 s → 30 s) |
| Biometrics | `local_auth` 2.x (14 MOB-R06) |
| Camera / gallery | `image_picker` 1.x (10 images per product, 5 MB each, min 600 px; the app resizes to the longest side 2 000 px before upload) |
| Barcode | `mobile_scanner` 5.x (inventory count, counter sale) |
| App links | `app_links` 6.x (`djaber://` scheme + `https://app.djaber.ai` universal / app links) |
| Share, call, browser | `share_plus` 10.x · `url_launcher` 6.x (`tel:` and the system browser for OAuth / invitations) |
| Connectivity | `connectivity_plus` 6.x (offline banner) |
| App info | `package_info_plus` 8.x (`X-App-Version`) |
| Crash reporting | `sentry_flutter` 8.x (`SENTRY_DSN_MOBILE`, release = `<version>+<build>`) |
| Codegen command | `dart run build_runner build --delete-conflicting-outputs` (riverpod, freezed, json, drift, slang) |
| Flavors | `dev` (API `http://10.0.2.2:4000` on Android emulator, `http://localhost:4000` on iOS simulator), `staging` (`https://api-staging.djaber.ai`), `prod` (`https://api.djaber.ai`); `--dart-define=FLAVOR=` + `lib/app/env.dart` |
| Min OS | Android API 24 (7.0), iOS 14 |

---

## 3. State management — Riverpod

Rules:
1. One provider per screen: `@riverpod class <ScreenSlug>Controller extends _$<ScreenSlug>Controller` returning an `AsyncValue<<ScreenSlug>State>` (freezed); the widget reads it with `ref.watch` and calls its methods for every action.
2. Repositories are providers (`@riverpod <Area>Repository <area>Repository(Ref ref)`), one per feature area, wrapping the generated `mobile_api` client and the drift cache; screens never call `mobile_api` directly.
3. No global mutable state: every shared value is a provider (`authProvider`, `currentWorkspaceProvider`, `connectivityProvider`, `appVersionGateProvider`, `legalGateProvider`, `maintenanceProvider`, `pushTokenProvider`, `localeProvider`); no singletons, no static fields, no `ChangeNotifier`.
4. Lists use `AsyncNotifier` with `PagedState<T> { items, page, hasMore, total, loadingMore, filters }`; offset lists page 25 (`pageSize=25`), cursor lists (`/conversations`, `/conversations/:id/messages`, `/notifications`) `limit=50`.
5. Mutations: `state = AsyncLoading()` on the affected row only (optimistic update forbidden except `readAt` of notifications and `unreadCount` of conversations), then `ref.invalidate` of the list and detail providers of the object.
6. WebSocket events (`<entity>.updated { id }` and the events of 06 §6) are received by `wsProvider` and dispatched to `ref.invalidate(<detailProvider>(id))`; no manual merging of payloads into state.
7. Provider disposal: `keepAlive: true` only for `auth`, `currentWorkspace`, `locale`, `connectivity`, `ws`, `pushToken`; every screen controller is auto-disposed.
8. Errors: a provider never throws to the widget; `AsyncError` carries the `ApiError` (§5) and the screen renders the state of §12 by `error.code`.

---

## 4. Routing — go_router and deep links

- Route paths = the web paths of `02-next-route-map.md` §3 verbatim (`/home`, `/queue`, `/inbox/:conversationId`, `/orders/:id`, `/products/:id`, `/agents/:id/insights`, `/settings/credits`, `/help/tickets/:id`, `/notifications`, `/legal/:key`, …), minus the web-only routes of 14 §2 (`/settings/members`, `/settings/integrations/*`, `/settings/system-messages`, `/settings/billing/return`, `/settings/danger`, `/orders/import`, `/reports/:key` export jobs). Hash fragments of deep links (`/orders/:id#delivery`, `#calls`, `#payment`) become the query `?tab=delivery|calls|payment` on mobile.
- Deep links: scheme `djaber://` + the same path (`djaber://orders/<id>?tab=delivery`), plus universal / app links on `https://app.djaber.ai/<path>`; every `NotificationType` row of 03 §15 resolves to its web path. `djaber://oauth/return`, `djaber://invite?token=`, `djaber://verify?token=` are the return links of 14 MOB-R18. Object not found ⇒ the "Introuvable" state of §12 with "Retour"; object in another workspace of the user ⇒ switch workspace (`currentWorkspaceProvider.set(id)`) then navigate; not a member ⇒ "Introuvable".
- Shell: `StatefulShellRoute.indexedStack` with 5 tabs — Accueil (`/home`), Boîte (`/inbox`), Commandes (`/orders`), Stock (`/stock`), Plus (`/more` → the menu of `V2 CHANGED — Paramètres — menu`); every other route is pushed on top of its tab.
- Guards (`GoRouter.redirect`, evaluated in this order on every navigation):
  1. `maintenance`: `maintenanceProvider.active` ⇒ `/system/maintenance` (only `/system/maintenance` allowed; retry `GET /app/version` every 60 s; `maintenance == null` ⇒ return to the pending location).
  2. `version`: `appVersionGateProvider.forceUpdate` ⇒ `/system/update-required` (nothing else reachable; "Mettre à jour" opens `storeUrl`).
  3. `auth`: no valid session ⇒ `/login?next=<pending location>`; after login the app navigates to `next`.
  4. `legal`: `GET /legal/pending` non-empty (checked at launch, after login and on `403 LEGAL_REACCEPT_REQUIRED`) ⇒ `/system/legal` until every document is accepted with `POST /legal/accept { key, version }`.
  5. `workspace`: no `currentWorkspaceId` ⇒ `/workspaces/switch` (`GET /workspaces`); `Workspace.status='suspended'` ⇒ `/system/suspended` (read-only; "Contacter le support" allowed).
  6. `biometrics` (14 MOB-R06): enabled and cold start ⇒ `/system/lock` until `local_auth` succeeds; 3 failures ⇒ `/login`.
- `/system/*` routes are the frames of 14 §4 section M11 (`V2 — Système — …`); `/login`, `/signup`, `/forgot`, `/reset`, `/verify`, `/invite`, `/2fa` are the M01 frames.

---

## 5. Networking — dio and interceptors

`core/api/api_client.dart` builds one `Dio` instance (`baseUrl = <env>/api/v1`, `connectTimeout` 10 s, `receiveTimeout` 30 s, uploads 120 s) injected into the generated `mobile_api` client. Interceptors, in this order:

1. `HeadersInterceptor`: `Accept-Language: <locale>`, `X-App-Platform: android|ios`, `X-App-Version: <version>` (`package_info_plus`), `X-Workspace-Id: <currentWorkspaceId>` on every authenticated request, `Authorization: Bearer <accessToken>`.
2. `IdempotencyInterceptor`: on every `POST` listed in api-contract §1.7 and on every `POST` that creates money, stock or outbound messages, header `Idempotency-Key: <uuid v4>` generated when the user taps submit, kept for the retries of the same submit, dropped on 2xx/4xx.
3. `RefreshInterceptor` (single-flight): on `401 UNAUTHORIZED` (access token expired or invalid) the first failing request calls `POST /auth/refresh { refreshToken }` once (a `Completer` shared by every concurrent 401), stores the rotated pair, replays the queued requests with the new access token; refresh failure (`401 AUTH_REFRESH_REUSED` or any 4xx) ⇒ tokens cleared, `/system/session-expired` then `/login?next=<current location>` (14 MOB-R05). The refresh call itself is never intercepted.
4. `SystemStateInterceptor`: `426 APP_UPDATE_REQUIRED {minVersion, storeUrl, message}` ⇒ `appVersionGateProvider.force(storeUrl, message)` ⇒ `/system/update-required`; `503 MAINTENANCE_MODE {until}` ⇒ `maintenanceProvider.on(until)` ⇒ `/system/maintenance` (retry every 60 s); `403 LEGAL_REACCEPT_REQUIRED` ⇒ `legalGateProvider.refresh()` ⇒ `/system/legal`; `403 WORKSPACE_SUSPENDED` ⇒ `/system/suspended`; `409 WORKSPACE_DELETION_SCHEDULED {at}` ⇒ banner "Suppression programmée le {at}" + action disabled; `403 READ_ONLY_MEMBER` ⇒ banner `banner.readOnly`.
5. `ErrorMappingInterceptor`: every non-2xx body `{ error: { code, message, params, fields, details, ref } }` becomes `ApiError` (freezed: `code`, `message`, `params`, `fields`, `details`, `ref`, `status`); network / timeout ⇒ `ApiError(code: 'NETWORK', status: 0)`; the UI kind per code is read from `ErrorUi.of(code)` generated from 11 (`toast | inline | dialog | banner | state`).
6. `EnvelopeInterceptor`: `{ data, meta }` unwrapped by the generated client; `meta.warnings[]` surfaced as toasts (`error.<code>` text, tone warning); `202 { data: { jobId } }` ⇒ `JobTracker` polls `GET /jobs/:id` every 2 s until `done|partial|failed|cancelled` (the `job.updated` WS event short-circuits the poll).
7. `RetryInterceptor`: GET only, 2 retries with 500 ms / 1 500 ms on network errors and 503 without `MAINTENANCE_MODE`.
8. `LoggingInterceptor` (dev flavor only): method, path, status, duration; never headers, never bodies.

Version gate (14 MOB-R01): at launch and on every `AppLifecycleState.resumed`, `GET /app/version?platform=<android|ios>&version=<x.y.z>` ⇒ `forceUpdate` ⇒ guard 2; `recommendUpdate` ⇒ banner `V2 — Système — Mise à jour recommandée (bandeau)` on Home, "Plus tard" hides it 7 days (`shared_preferences` key `update_recommended_hidden_until`); `maintenance` non-null ⇒ guard 1.

Uploads: `POST /uploads` multipart with `kind`, progress stream shown in the picker; errors `UPLOAD_TOO_LARGE`, `UPLOAD_TYPE_INVALID`, `IMAGE_TOO_LARGE`, `IMAGE_TYPE_INVALID` inline; warning `IMAGE_SMALL` as a toast.

---

## 6. Storage

| Store | Package | Content | Rules |
|---|---|---|---|
| Secure | `flutter_secure_storage` (Keychain / Keystore, `encryptedSharedPreferences: true` on Android) | `access_token`, `refresh_token`, `current_workspace_id`, `biometrics_enabled`, `push_token` | cleared on logout and on refresh failure; never written to logs or Sentry |
| Cache | `drift` database `cache.sqlite`, tables `cached_lists(key, workspace_id, json, fetched_at)` and `cached_details(entity, id, workspace_id, json, fetched_at)` | last response of every list (per filter key) and detail screen | read-only cache: shown with the banner `state.offline.banner` ("données du {date}") when offline or when the request fails with `NETWORK`; TTL 24 h (rows older are deleted at launch); cleared entirely on workspace switch and on logout; never used to queue a mutation (14 MOB-R04) |
| Preferences | `shared_preferences` | `locale`, `list_density`, `update_recommended_hidden_until`, `push_preprompt_shown_at`, `push_denied_reask_at`, `onboarding_tutorial_done`, `last_tab` | per device; never business data |

Offline (14 MOB-R04): `connectivityProvider` + a failed request with `NETWORK` ⇒ the screen renders its cached data with the banner of `V2 — Système — Hors ligne`; every action button and the inbox composer are disabled with the tooltip `toast.noConnection`; no mutation is queued.

---

## 7. Push — firebase_messaging

- `FirebaseMessaging.instance.getToken()` after the pre-prompt of 14 MOB-R07 (`V2 — Système — Autorisation des notifications`, shown once after the first login) and the system permission; granted ⇒ `POST /me/devices { token, platform, appVersion, deviceName, locale }` (upsert on token; `422 DEVICE_LIMIT {max: 20}` ⇒ bottom-sheet dialog `error.DEVICE_LIMIT` with the sessions list from `GET /me/sessions`, "Retirer" = `DELETE /me/sessions/:id` (revokes that session and its device token), then the registration is retried); `onTokenRefresh` ⇒ same call; logout ⇒ `DELETE /me/devices/:token` then `POST /auth/logout`.
- Denied ⇒ card "Notifications désactivées — Ouvrir les réglages" in `V2 — Paramètres — Notifications`; ask again once, 7 days later (`push_denied_reask_at`).
- Payload (03-events §5.2): `data: { type: <NotificationType enum value>, deepLink: <web path>, workspaceId, notificationId }`; `notification: { title, body }` already localized by the API.
- Foreground: `onMessage` ⇒ in-app toast (`mobile_ui` `AppToast`) with "Ouvrir"; background / terminated: `onMessageOpenedApp` and `getInitialMessage()` ⇒ `GoRouter.go('djaber://' + deepLink)` through the guards of §4 (workspace switch when `workspaceId ≠ currentWorkspaceId`).
- iOS: APNs through FCM (`apple/Runner/Runner.entitlements` `aps-environment`), `FirebaseMessaging.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: true)`; Android: notification channel `djaber_default` (importance high), icon `ic_stat_djaber`.
- Badge = unread count from `GET /notifications/unread-count` on resume.

---

## 8. In-app purchases — in_app_purchase (14 MOB-R08, D74)

Screen `V2 — Crédits — Acheter un pack (achat intégré)`; states `V2 — Crédits — Achat · états`.

1. `GET /credit-packs?platform=google_play|app_store` ⇒ packs with `googleProductId` / `appleProductId`; `InAppPurchase.instance.queryProductDetails(ids)` ⇒ store prices displayed (never the web `priceWebDzd`); a pack missing in the store response is hidden.
2. Tap "Acheter" ⇒ `buyConsumable(purchaseParam)`; the screen shows "Achat en cours…" with every button disabled.
3. `purchaseStream` ⇒ `PurchaseStatus.purchased|restored` ⇒ `POST /credits/packs/iap/validate { platform, productId, transactionId: purchase.purchaseID, receipt: verificationData.serverVerificationData (app_store), purchaseToken: verificationData.serverVerificationData (google_play) }` with `Idempotency-Key`.
4. Result `credited` ⇒ `completePurchase(purchase)` (consume / finish), state "Crédits ajoutés : +{credits}", `creditsProvider` invalidated; `already_credited` or `409 IAP_RECEIPT_ALREADY_USED` ⇒ same as credited (silent); `pending` or `503 IAP_STORE_UNAVAILABLE` ⇒ state "Validation en attente" and the purchase stays uncompleted; the app re-sends the validation on the next launch and on "Restaurer les achats"; `422 IAP_RECEIPT_INVALID` ⇒ dialog with "Réessayer" / "Contacter le support", purchase left uncompleted; `404 IAP_PRODUCT_UNKNOWN` ⇒ toast, pack hidden.
5. `PurchaseStatus.error|canceled` ⇒ state "Achat annulé" (no API call). "Restaurer les achats" ⇒ `restorePurchases()` ⇒ step 3 for every unfinished purchase.
6. Subscriptions are never sold in the app: `V2 — Plan — géré sur le web` shows the plan, limits and end date with the text "Le changement de plan et le paiement se font sur le web" and no button (14 MOB-R09, D73). Promo codes: `credits` kind only (`PROMO_MOBILE_SUBSCRIPTION_FORBIDDEN` otherwise).

---

## 9. i18n — slang

- Source of keys = the copy deck (`06-i18n-copy-deck.md`): the files `packages/shared/src/i18n/messages/{fr,ar,en}.json` are copied at build (`pnpm mobile:i18n`, run by `pnpm mobile:api` and in CI) into `apps/mobile/assets/i18n/strings_{fr,ar,en}.i18n.json`; `slang` generates `lib/l10n/strings.g.dart` (`build.yaml`: `input_directory: assets/i18n`, `output_directory: lib/l10n`, `fallback_strategy: base_locale`, `base_locale: fr`, ICU plurals and params as in the deck). No key is written in the app that is not in the deck; a mobile-only string is added to the deck first (key under `mobile.<screen>.*`).
- Locale = `User.locale` after login, device locale before; switch in `V2 — Compte` ⇒ `LocaleSettings.setLocale`, `PATCH /me { locale }`, `Accept-Language` header updated.
- `ar` ⇒ `Directionality(textDirection: TextDirection.rtl)` from `MaterialApp.localizationsDelegates` + `supportedLocales [fr, ar, en]`; layouts use `EdgeInsetsDirectional`, `AlignmentDirectional`, `start/end`; directional icons mirrored with `Transform.flip` under RTL; charts stay LTR.
- Numbers, phones, amounts, SKUs, order numbers, tracking numbers always LTR and Latin digits: wrap in `Ltr` (`packages/mobile_ui/lib/src/ltr.dart` = `Directionality(textDirection: TextDirection.ltr, child: Text(…))`), formatting with `NumberFormat('#,##0', 'fr')` and the thin no-break space, `12 500 DA`; dates `dd MMM yyyy HH:mm` in `Africa/Algiers` (`timezone` package, `tz.getLocation('Africa/Algiers')`).
- Error messages: the API message is displayed as returned (already localized by `Accept-Language`); `error.<CODE>` keys exist in the deck for offline / client-side cases.
- Fonts: Geist (fr/en), Changa (ar), JetBrains Mono (labels), bundled in `assets/fonts/` and declared in `pubspec.yaml`.

---

## 10. Folder layout (`apps/mobile/lib`)

```
lib/
  main_dev.dart · main_staging.dart · main_prod.dart        // flavors → app/bootstrap.dart
  app/            bootstrap.dart (ProviderScope, Sentry, Firebase, slang), app.dart (MaterialApp.router), router.dart (§4), env.dart, theme.dart (uses mobile_ui tokens), shell.dart (5 tabs)
  core/
    api/          api_client.dart, interceptors/*.dart (§5), api_error.dart, envelope.dart, job_tracker.dart, ws_client.dart
    auth/         auth_provider.dart, session.dart, biometrics.dart, workspace_provider.dart
    storage/      secure_store.dart, cache_db.dart (drift), prefs.dart
    push/         push_provider.dart, push_handlers.dart
    iap/          iap_provider.dart, iap_flow.dart (§8)
    theme/        tokens.dart (re-export of mobile_ui), text_styles.dart
    i18n/         locale_provider.dart, formatters.dart (money, dates, phones)
    system/       version_gate.dart, maintenance.dart, legal_gate.dart, connectivity.dart
  features/
    <area>/                                   // auth, home, notifications, channels, inbox, orders, delivery, clients, stock, products, categories, suppliers, purchases, sales, cash, inventories, recommendations, agents, analytics, reports, settings, account, credits, help, system
      data/       <area>_repository.dart (+ cache), mappers.dart
      domain/     models (freezed), enums (re-exported from mobile_api)
      ui/         one widget file per Mobile V2 frame (§11), <screen>_controller.dart (§3), widgets/
  l10n/           strings.g.dart (generated by slang)
```

`packages/mobile_ui/lib/src/`: `tokens.dart` (colours, spacing, radii, typography = the values of `packages/ui` tokens), `pill.dart` (one `Pill(enumKey)` rendering `enum.*` keys with the Component sheet colours), `action_sheet.dart` (§11), `states/` (`SkeletonList`, `EmptyState`, `FilteredEmptyState`, `ErrorState`, `OfflineBanner`, `LoadMoreRow`, `NotFoundState`, `ForbiddenState`), `banners.dart` (priority stack of 14 MOB-R17), `app_toast.dart`, `bottom_sheet_dialog.dart` (11 §10: `banner` ⇒ top sheet, `dialog` ⇒ bottom sheet), `ltr.dart`, `form/` (text, phone, money, select, date, image picker).

---

## 11. Screen ↔ frame rule

- One widget file per Mobile V2 frame, under `features/<area>/ui/`. File name = frame name slug: drop the prefix `V2 — ` or `V2 CHANGED — `, strip accents (NFD), lowercase, replace every run of non `[a-z0-9]` by `_`, trim `_`; suffix `_screen.dart` for a screen, `_sheet.dart` when the frame name contains `(feuille)`, `_banner.dart` when it contains `(bandeau)`, `_dialog.dart` for a dialog frame. `V2 — Commandes — Actions (feuille)` ⇒ `commandes_actions_sheet.dart`; `10b — Conversation` ⇒ `10b_conversation_screen.dart`; `V2 — Système — Mise à jour requise` ⇒ `systeme_mise_a_jour_requise_screen.dart`.
- First line of the file: `// FIG: <frame name verbatim>`; a file that implements a base frame plus a `V2 CHANGED` frame lists both lines (`// FIG: Orders list` then `// FIG: V2 CHANGED — Commandes — liste (source IA / humain)`).
- `V2 CHANGED — <area> — <screen>` = the base widget of the same area + the changes written at the bottom of the CHANGED frame; on conflict the CHANGED frame wins. `⛔ REMPLACÉ — …` (section M99) = not built. AR/EN variants (page "Screens") are the same widget with the locale switched; no separate file.
- Row actions (14 MOB-R10, D77): list rows have no buttons; `⋯` or a tap on the status pill opens `ActionSheet(actions: row.actions)` built from the `ActionDescriptor[]` returned by the API for the row (`{ key, enabled, reasonCode?, primary?, shortcut? }`): the `primary` item first and highlighted, disabled items greyed with the footer `"{label} grisé : {error.<reasonCode>} ({reasonCode})"`, labels from `action.<key>`; long-press = multi-select; bulk results in `V2 — Commandes — Résultats de l'action groupée` (OK / ERREUR code / IGNORÉE reason, "Réessayer les n erreurs"). Every list uses it.
- The grey Label/Meta text at the bottom of a frame is a rule for the code (error code, endpoint, state), never rendered.
- Every string is a slang key; every pill is `Pill('enum.<Model>.<field>.<value>')`; every filter is in the controller state and in the route query (`?status=new,confirmed`), so that a deep link with a query opens the filtered list.

---

## 12. States

Every mobile frame state (the "ÉTAT ·" tiles of the Mobile V2 frames and the `· états` frames of 14 §4) is implemented, plus the GLOBAL patterns of 12 §16 with the `mobile_ui` widgets:

| Pattern | Mobile implementation |
|---|---|
| List — 6 states | `SkeletonList` (5 rows, 300 ms delay) · `EmptyState` (entity icon, one-line reason, one primary CTA) · `FilteredEmptyState` ("Aucun résultat", active filters named, "Effacer les filtres") · `ErrorState` ("Impossible de charger (ref. {ref})", "Réessayer") · `OfflineBanner` over the cached list, actions disabled · `LoadMoreRow` (skeleton row at the bottom, "{count} de plus") |
| Form — states | saving (button spinner, fields locked) · validation (summary at top + inline `fields` → `validation.*`) · leave guard (`PopScope`, "Quitter sans enregistrer ?") · `409 CONFLICT` (bottom sheet "Modifié par quelqu'un d'autre", draft kept, "Recharger" / "Écraser") · saved (toast 3 s + pop) |
| Detail — states | `NotFoundState` (404, "Retour") · deleted (date, actor, "restaurable par un admin pendant 30 j") · `ForbiddenState` (403, role shown) |
| System screens | `V2 — Système — Mise à jour requise` (426) · `— Mise à jour recommandée (bandeau)` · `— Maintenance` (503, retry 60 s) · `— Conditions mises à jour` (legal) · `— Hors ligne` · `— Session expirée` · `— Espace suspendu` (`WORKSPACE_SUSPENDED`, reason, "Contacter le support") · `— Autorisation des notifications` · lock screen (biometrics) · Plan expiré and Crédits épuisés = the banners of MOB-R17 with their CTA |
| Toasts | bottom, 5 s, max 3 stacked, optional action; `toast.*` keys |
| Banners | one at a time, priority of 14 MOB-R17 (`V2 — Système — Bandeaux (priorité)`): suspendu > reconnexion > crédits 100 % > plan expiré > crédits 80 % > plan expire > approbation Meta > e-mail non vérifié; the update-recommended banner sits below them on Home only |
| Dialogs | every `dialog` UI kind of 11 = bottom sheet with the form content preserved on error; destructive confirmation requires the typed number / name when the web dialog does |
| Job in progress | `JobTracker` sheet "{label} · {pct} %" with "Continuer en arrière-plan" / "Annuler la tâche"; completion toast with "Ouvrir" |

---

## 13. Tests

- Widget tests: one test file per frame widget (`test/features/<area>/<slug>_test.dart`) rendering every state of §12 for that frame with a `ProviderScope` override of the controller (golden files per state and per locale `fr`/`ar`, `flutter test --update-goldens` only in a dedicated PR).
- Unit tests: interceptors (§5: refresh single-flight, idempotency header, 426/503/403 handlers), formatters (§9), slug function (§11), deep-link resolver (§4), IAP flow (§8) with a fake `InAppPurchase`.
- Integration tests (`integration_test/`, `flutter test integration_test --flavor staging` against staging with the seeded demo workspace): one test per rule of 14 §3, named `AT-MOB-<nn>` with `nn` = the `MOB-R<nn>` number (`AT-MOB-01` version gate … `AT-MOB-20` languages), plus every AT of `13-acceptance-tests.md` whose feature exists on mobile, named by its AT id.
- Store review checklist test (`AT-MOB-15`, `AT-MOB-13`): account deletion in-app, report / block a customer, moderation evidence export reachable.
- CI: `flutter analyze` + `flutter test` on every PR touching `apps/mobile` or `packages/mobile_*`; `mobile-api` client drift check; integration suite nightly on staging and before every store release (MM5).

---

## 14. Do / Don't

**Do**
- Generate the API client from the OpenAPI document; never hand-write a request model.
- Read every row action from `ActionDescriptor[]`; never decide client-side whether an action is allowed.
- Send `X-Workspace-Id`, `X-App-Platform`, `X-App-Version` on every authenticated request and `Idempotency-Key` on every creating POST.
- Show the cached data with the offline banner; disable every mutation while offline.
- Open every push notification through the router with its `djaber://` deep link.
- Validate every store purchase on the server before showing credits; complete the store transaction only after `credited` / `already_credited`.
- Use the deck keys through slang; keep numbers, phones and amounts LTR.
- Put `// FIG: <frame name>` at the top of every frame widget file.

**Don't**
- Don't queue mutations offline; don't retry non-GET requests automatically.
- Don't store tokens anywhere but `flutter_secure_storage`; don't log headers or bodies.
- Don't sell or display subscription prices in the app; don't open Chargily on mobile.
- Don't build `⛔ REMPLACÉ` frames or any platform (admin) screen.
- Don't invent a state, a pill colour, a label or an endpoint: §15.
- Don't use `setState` for business state, global singletons or `ChangeNotifier`.
- Don't render Arabic-Indic digits anywhere.

---

## 15. Zero-question rule

`08-coder-playbook.md` §6 applies to mobile tasks exactly as to web tasks: when a detail is in neither 14, this file, the specs, the API contract nor the Mobile V2 / Screens frames, apply the matching row of 08 §6 (copy ⇒ the French text of the frame, ar/en literal; validation ⇒ closest sibling field; permission ⇒ the `ActionDescriptor`; state ⇒ the GLOBAL pattern of §12; page size 25 / cursor 50; sort `createdAt desc`; deep link ⇒ the object's page; locale `fr`), implement it, and append one line to `docs/implementation/assumptions-log.md` (`YYYY-MM-DD | MM<n> | <file or route> | <gap> | <rule applied> | <value chosen>`). Never stop a task to ask.
