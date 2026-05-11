# Tested by Guettaf Dhia Eddine — 11/05/2026

**Platform:** Djaber AI
**Tester:** Guettaf Dhia Eddine
**Test date:** 10 Mai 2026
**Report received:** 11/05/2026
**Developers:** Djelil Rahim, Amrani Zakaria
**Source:** `bugs/_bugs__djaber_ai.zip` → `Rapport_Bugs_Djaber_AI.pdf`

> **Quick status:** 14 of 21 report items fixed (67%). Open: Return-status button (section 1), Template global sidebar + duplicate Ventes tab (section 2), and the full AI-agent suite — 5 items (section 4).

---

## 1. Gestion des Stocks et Commandes

### `/dashboard/stock/orders`
- **Bug:** Manque d'un bouton d'action pour changer le statut de commande en **"Retour" (Return)** en cas de retour client.
- **Screenshot:** `addReturnStatement.png`
- **Status:** Open

### `/dashboard/stock/movements`
- **Bug:** Calcul de stock erroné — lorsqu'une commande est annulée, la quantité **n'est pas réincrémentée** (reste déduite).
- **Screenshots:** `cancelOrderStockStillMinus.png`, `cancelOrderStockStillMinus2.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** `backend/src/controllers/user-orders.controller.ts` — `updateOrder` now detects status transitions to `cancelled` / `returned`, re-increments product stock, logs a return movement, removes auto caisse income, and rolls back client lifetime stats.

### `/dashboard/stock/caisse`
- **Bug:** Le prix des commandes supprimées **reste dans le total de la caisse** au lieu d'être déduit.
- **Status:** ✅ Fixed by Amrani Zakaria (11/05/2026)
- **Fix:** Same `updateOrder` patch — automatic caisse rows tied to a cancelled / returned order are wiped via `caisseTransaction.deleteMany({ sourceId, isAutomatic: true })`. `deleteOrder` already does the same.

### `/dashboard/stock/orders/new`
- **Bug:** Possibilité de créer une commande avec **uniquement le nom**, sans adresse ni numéro de téléphone.
- **Screenshot:** `create order only with client name.png`
- **Status:** ✅ Fixed by Amrani Zakaria (11/05/2026)
- **Fix:** `src/app/dashboard/stock/orders/new/page.tsx` — `handleSubmit` now blocks until: client name has at least one alphanumeric char, phone passes `isValidPhone`, wilaya is selected, and a delivery address is present (unless Stopdesk pickup is ticked).

---

## 2. Validation et Interface Utilisateur (UX/UI)

### `/dashboard/stock/products` & `/dashboard/stock/categories`
- **Bug:** Acceptation de **caractères spéciaux uniquement** pour les noms de produits et catégories.
- **Screenshots:** `caractere special.png`, `caractere special2.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** New shared helper `src/lib/validation.ts` exporting `hasAlphanumeric()` (Latin + Arabic + digits). Wired into `products/page.tsx` validateForm and `categories/page.tsx` handleSubmit — names like `@@@###` are rejected with an inline modal error before hitting the API.

### `/dashboard/stock/suppliers`
- **Bug:** Message d'erreur de doublon affiché **sur la page globale** et non sur le composant, rendant l'erreur illisible.
- **Screenshot:** `errorInPageNotComponent.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** Added `modalError` state in `suppliers/page.tsx`; submit failures (including backend duplicate-detection messages) render inside the modal in a red-bordered banner. Toast is also used for delete success/failure. Added `validateEmailOptional` + `validatePhoneOptional` so junk values like `azeae` / `aeazeaz` are blocked client-side.

### `/dashboard/stock/clients`
- **Bug:** Plusieurs clients peuvent avoir le même nom. Inconsistance du design (champs inversés) et manque de validation sur le numéro.
- **Screenshots:** `inputValidation3.png`, `ManyClientSameName.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** `clients/page.tsx` — Phone is now required and validated via `validatePhoneRequired`; field order in the modal is unified with Supplier (Name → Email | Phone → Address); on submit the form scans the loaded clients for a duplicate phone (normalised) and blocks the save with a clear inline error before the API call. `<input type="tel" pattern>` added for native UA hints.

### Template global
- **Bug:** Navigation latérale **non scrollable sur laptop**. **Doublon** de l'onglet "Ventes" dans la barre de navigation.
- **Screenshots:** `settingTabInNavBar.png`, `VenteDuplicate.png`
- **Status:** Open

### Validation inputs (général)
- **Screenshots:** `inputValidation.png`, `inputValidation2.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** Centralised validation helpers in `src/lib/validation.ts` (`isValidPhone`, `isValidEmail`, `hasAlphanumeric`, `validateName`, `validateEmailOptional`, `validatePhoneOptional`, `validatePhoneRequired`). Reused across all stock forms — phone fields now use `type="tel"` + `pattern`, email fields are checked against a strict regex on submit. Junk like `aaaaa` for a phone or `azeae` for an email is no longer accepted.

### Bouton Delete / Feedback erreur (Add Product silent failure)
- **Screenshots:** `DeleteBtn.png`, `error without feedback.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** Wired the global `useToast()` provider into `products/page.tsx`. Added a `modalError` state rendered as a red banner at the top of the Add/Edit Product form; submit errors no longer fall behind the modal overlay. Delete + save flows in suppliers / clients / categories also report success+failure via toast.

### Quantité (negative qty after cancellation)
- **Screenshot:** `quatity--.png`
- **Status:** ✅ Fixed by Amrani Zakaria (11/05/2026)
- **Fix:** Same `updateOrder` cancellation fix — on transition to `cancelled` / `returned`, stock is re-incremented and a positive return-stock movement is logged, so quantity no longer drifts negative.

---

## 3. Problèmes de Traduction et Affichage

### Multiples chemins (Dashboard, Settings, Stock, …)
- **Bug:** Problèmes de traduction généralisés sur l'ensemble des modules listés.
- **Screenshots:** `traduction.png` → `traduction14.png` (14 captures)
- **Status:** ✅ Fixed by Amrani Zakaria (11/05/2026)
- **Fix:** New `stock.*`, `settings.*`, `pages.*`, `dash.getStarted.*` key namespaces added to `src/lib/i18n.ts` for `en` / `fr` / `ar` (~190 keys × 3 = ~570 strings). Wired into 13 pages: dashboard overview (settings + pages list + Get Started + connected-page card), stock products, categories, suppliers, clients, recommendations, caisse, orders, delivery, sales, purchases, movements. Translation function pulled via `useTranslation()` from `LanguageContext`. Counts use a `{n}` placeholder replaced at render time. Server-driven values that need i18n (caisse categories, movement types, order confirmation states, delivery status) are mapped through dedicated key paths so a backend value like `cancelled` renders as `Annulée` / `ملغاة` / `Cancelled` depending on the user's language.

Based on what Guettaf flagged across the 14 `traduction*.png` screenshots, the following untranslated strings have been wired into `src/lib/i18n.ts` for `en` / `fr` / `ar`:

#### `traduction.png` — `/dashboard?section=settings`
- "Facebook API Permissions" header
- "Currently Active Permissions" section title
- "Available Advanced Permissions" section title
- "These permissions require Facebook App Review approval." helper line
- "Danger Zone" + "Delete Account" + "Permanently delete your account and all associated data."

#### `traduction2.png` — `/dashboard` overview
- "Get Started" checklist section title
- Each checklist row: "Connect a page" / "Link Facebook to start chatting", "Add products" / "Build your catalog", "Configure your AI agent" / "Personalize tone and behavior", "Make your first sale" / "Watch the AI handle inquiries"
- "Active" badge on the connected-page card
- "Facebook · Connected {date}" subtitle on the connected-page card

#### `traduction3.png` — `/dashboard?section=pages`
- "Connected channels" eyebrow + "Pages & inboxes" h1 + the helper sentence
- "Connect Instagram" / "Connect Facebook" buttons
- Stat-card labels: "Plan limit", "Instagram", "Facebook", "Total pages"
- Platform-filter pills: "All Platforms" / "Instagram" / "Facebook"
- Relative-time + platform line on a page card (`1m · Facebook`)

#### `traduction4.png` — `/dashboard/stock/products`
- "Products" h1 + "{n} products" count
- "Add Product" / "Filters" / "Low Stock" buttons
- "All Categories" select default + "Search products..." placeholder
- Table headers: Product / SKU / Category / Cost / Price / Profit / Margin / Qty / Unit
- Unit short labels (`pc`, `piece`)

#### `traduction5.png` — `/dashboard/stock/categories`
- "Categories" h1 + "{n} categories" count
- "Add Category" / "Filters" / "Search categories..." placeholder
- Empty state: "No Categories" + "Create categories to organize your products"

#### `traduction6.png` — `/dashboard/stock/suppliers`
- "Suppliers" h1 + "{n} suppliers" count
- "Add Supplier" / "Filters"
- Stat cards: "Total Suppliers" / "Active" / "With Purchases"
- "From date" / "To date" date placeholders + "Search suppliers..." placeholder
- Empty state: "No Suppliers" + "Add suppliers to manage your purchases"

#### `traduction7.png` — `/dashboard/stock/clients`
- "Clients" h1 + "Customers saved from AI conversations and confirmed orders" helper
- Stat cards: "Total Clients" / "Active" / "With Orders" / "Total Spent"
- "Search by name or email..." + "Search by phone..." placeholders
- "From date" / "To date" date placeholders
- Table headers: Client / Contact / Address / Conversations / Orders / Total Spent / Source / Actions
- Source badge: "AI Chat" / "Manual"

#### `traduction8.png` — `/dashboard/stock/recommendations`
- "Cross-Sell / Up-Sell" h1 + "AI-powered product recommendations to boost sales" helper
- "Generate Recommendations" button
- Stat cards: "Total Rules" / "Impressions" / "Conversions" / "Revenue" + sublabels (`from cross-sell`, `rate 0%`, `times shown`, `{n} active`)
- Filter pills: "All" / "Active" / "Inactive" / "All Types" / "Up-Sell" / "Cross-Sell"
- "Search products..." placeholder
- Empty state: "No recommendations yet" + 'Click "Generate Recommendations" to analyze your products'

#### `traduction9.png` — `/dashboard/stock/caisse`
- "Caisse" h1 + "Cash register & treasury management" helper
- "Add Transaction" / "Filters"
- Period pills: "Today" / "This Week" / "This Month" / "This Year"
- Stat cards: "Balance" / "Total Income" / "Total Expenses" / "Transactions"
- "Search reference or description..." placeholder
- Table headers: Date / Type / Category / Description / Reference / Amount / Source / Actions
- Source pill: "Auto" / "Manual"
- Type pill: "income" / "expense"
- Category pill labels: "order" / "sale" / "purchase" / "salary" / "rent" / "utilities" / "marketing" / "shipping" / "other"
- Auto-generated description prefix: "Order {n} payment (COD - delivered)"

#### `traduction10.png` — `/dashboard/stock/orders`
- "Orders" h1 + "{n} orders" count
- "New Order" / "Filters"
- Stat cards: "Total Orders" / "Pending" / "Need Calling" / "Total Value"
- Status filter pills: "All" / "New" / "Confirmed" / "Preparing" / "Shipped" / "Delivered" / "Cancelled" / "Returned"
- "From date" / "To date" / "Search by order #, client, phone, product..." placeholders
- Table headers: # Order / Client / Items / Total / Paid / Remaining / Status / Confirmation / Date
- Status badges: "pending" / "confirmed" / "shipped" / "delivered" / "cancelled" / "returned" / "preparing"
- Confirmation badges: "Not Called" / "No Answer" / "Confirmed" / "Rejected"
- AI/Manual source pill on each row

#### `traduction11.png` — `/dashboard/stock/delivery`
- "Delivery" h1 + "Send orders to delivery companies and track shipments" helper
- "Providers" / "Fees" / refresh buttons
- Stat cards: "Ready to Ship" / "Shipped" / "In Transit" / "Delivered"
- Filter pills: "All" / "Ready" / "Sent" / "In Transit" / "Delivered"
- "Search orders..." placeholder
- Table headers: Order / Client / Address / Total / Provider / Tracking / Status / Actions
- "Send" action + "Not Sent" badge

#### `traduction12.png` — `/dashboard/stock/sales`
- "Sales" h1 + "{n} sales" count
- "New Sale" / "Filters"
- Stat cards: "Total Sales" / "Revenue" / "Avg Order Value" / "Pending"
- Payment filter pills: "All" / "Paid" / "Remaining"
- "From date" / "To date" / "Search sales..." placeholders
- Period pills: "Today" / "Week" / "Month" / "Year"
- Empty state: "No Sales"

#### `traduction13.png` — `/dashboard/stock/purchases`
- "Purchases" h1 + "{n} purchase orders" count
- "New Purchase" / "Filters"
- Stat cards: "Total Purchases" / "Total Spent" / "Pending" / "Received"
- Payment filter pills: "All" / "Paid" / "Remaining"
- "From date" / "To date" / "Search purchases..." placeholders
- Empty state: "No Purchases" + "Create your first purchase order"

#### `traduction14.png` — `/dashboard/stock/movements`
- "Stock Movements" h1 + "Audit trail of all stock changes" helper
- "Filters" + "From date" / "To date" placeholders
- Table headers: Reason / Quantity / Type / Product / Date
- Type badges: "Out" / "In" / "Return" / "Adjustment"
- Auto-generated reason prefix: "AI order", "Deleted order {orderNumber}", "Cancelled order {orderNumber}", "Returned order {orderNumber}"

### `/dashboard/stock/orders/`
- **Bug:** Les détails de l'adresse (**Région et Wilaya**) sont absents lors de la consultation d'une commande.
- **Screenshot:** `FullAdressMissing.png`
- **Status:** ✅ Fixed by Amrani Zakaria (11/05/2026)
- **Fix:** `src/components/stock/ConfirmOrderModal.tsx` — added `wilayaId`, `communeName`, `isStopdesk` to the frontend `Order` type (`src/lib/user-stock-api.ts`); modal now fetches the wilaya list once (module-level cache) and renders a full destination block: street address line + `"Commune, NN — Wilaya"` region line + a `Stopdesk (agency pickup)` chip when applicable. Falls back to `no address` only when **all** of address / commune / wilaya / stopdesk are empty.

---

## 4. Agent IA et Automatisation

- **Suppression:** L'IA **crée une nouvelle commande** au lieu d'en supprimer une.
- **Règles d'intervention:** "Human Intervention Rules" **inopérantes**.
- **Vision:** Reconnaissance d'image **défaillante**.
- **Vocal:** Écoute et réponse vocale **non fonctionnelles**.
- **Templates:** "Product Display Template" **ne marche pas**.
- **Status:** Open

---

## 5. Analyse et Statistiques

### `/dashboard/stock/`
- **Bug:** Le **chiffre d'affaires exclut** les commandes en ligne/manuelles, ne comptabilisant que les ventes directes.
- **Screenshot:** `chiffresDaffaireNeContientLesCommande.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** `backend/src/controllers/user-sales.controller.ts` — `getSalesStats` now aggregates both `Sale` and `Order` tables. Combined `totalRevenue`, `totalSales`, `paidSales`, `pendingSales` and `averageOrderValue` now reflect walk-in sales **and** online/manual orders. Orders with status `cancelled` or `returned` are excluded.

### `/dashboard/stock/delivery`
- **Bug:** Actions inactives sur la page et **statistiques bloquées à 0**.
- **Screenshot:** `DeliveryActionDontWork.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** `src/app/dashboard/stock/delivery/page.tsx` — stat cards were being computed from the **filtered** list (so any non-current-tab counters showed 0). Introduced an `allOrders` state holding the unfiltered API response; the four stat cards now read from it, while the table still uses the filtered view. Cancelled / returned orders excluded from `Ready to Ship`.

### Commandes annulées dans le calcul
- **Screenshot:** `CancelledOrderInCalcul.png`
- **Status:** ✅ Fixed by Djelil Rahim (11/05/2026)
- **Fix:** `getSalesStats` excludes `cancelled` / `returned` via `status: { notIn: [...] }`. Same statuses trigger caisse-row wipe + stock restore inside `updateOrder`.

---

## Summary

| Category | Items | Fixed | Open |
|---|---|---|---|
| 1. Stocks & Commandes | 4 | 3 | 1 (Return-status button) |
| 2. Validation / UX-UI | 7 | 6 | 1 (template global — sidebar + duplicate "Ventes") |
| 3. Traduction & Affichage | 2 | 2 | 0 |
| 4. Agent IA & Automatisation | 5 | 0 | 5 (full AI suite) |
| 5. Analyse & Statistiques | 3 | 3 | 0 |
| **Total** | **21** | **14** | **7** |

All screenshots are available in `bugs/extracted/`.

---

## Session 1 — 11/05/2026 fix log

**Developer:** Djelil Rahim
**Scope:** general validation + feedback errors + analytics (sections 1, 2, 5)
**Files touched:**

| File | Change |
|---|---|
| `src/lib/validation.ts` | NEW — shared phone/email/name validators (Latin + Arabic + digits) |
| `src/app/dashboard/stock/suppliers/page.tsx` | inline modal error, validate email + phone, toast feedback |
| `src/app/dashboard/stock/clients/page.tsx` | required phone, dup-phone client guard, modal error, unified field order, `type="tel"` |
| `src/app/dashboard/stock/products/page.tsx` | alphanumeric check on SKU + name, modal error banner, toast feedback |
| `src/app/dashboard/stock/categories/page.tsx` | alphanumeric check, modal error, toast feedback |
| `src/app/dashboard/stock/delivery/page.tsx` | stats computed from unfiltered set; cancelled excluded from "Ready to Ship" |
| `backend/src/controllers/user-sales.controller.ts` | `getSalesStats` aggregates Sale + Order, excludes cancelled/returned |

---

## Session 2 — 11/05/2026 fix log

**Developer:** Amrani Zakaria
**Scope:** order-flow data integrity, missing region/wilaya display, full i18n rollout (sections 1, 3)
**Files touched:**

| File | Change |
|---|---|
| `backend/src/controllers/user-orders.controller.ts` | `updateOrder` restores stock + wipes caisse + rolls back client stats on `cancelled` / `returned` transitions |
| `src/app/dashboard/stock/orders/new/page.tsx` | required phone + wilaya + address (or Stopdesk), toast feedback |
| `src/components/stock/ConfirmOrderModal.tsx` | shows full destination: street address + `Commune, NN — Wilaya` + Stopdesk chip (fixes `FullAdressMissing.png`) |
| `src/lib/user-stock-api.ts` | added `wilayaId` / `communeName` / `isStopdesk` to the frontend `Order` type |
| `src/lib/i18n.ts` | NEW namespaces `stock.*`, `settings.*`, `pages.*`, `dash.getStarted.*` — ~190 keys × en/fr/ar = ~570 strings, +791 lines |
| `src/app/dashboard/page.tsx` | wired Settings panel (Facebook permissions + Danger zone) + Pages list + Get Started checklist + connected-page card |
| `src/app/dashboard/stock/products/page.tsx` | wired headers, table columns, search, low-stock toggle, filter button |
| `src/app/dashboard/stock/categories/page.tsx` | wired headers, search, empty state |
| `src/app/dashboard/stock/suppliers/page.tsx` | wired headers, stat cards, search, date pickers, empty state |
| `src/app/dashboard/stock/clients/page.tsx` | wired headers, stat cards, search, date pickers, table columns, AI/Manual source pill |
| `src/app/dashboard/stock/recommendations/page.tsx` | wired headers, stat cards, filter pills, empty state, type pill |
| `src/app/dashboard/stock/caisse/page.tsx` | wired headers, period pills, stat cards, table columns, type/category/source pills (renamed `t` loop param to `tx` to avoid translation shadow) |
| `src/app/dashboard/stock/orders/page.tsx` | wired headers, stat cards, status tabs, table columns, confirmation labels, search |
| `src/app/dashboard/stock/delivery/page.tsx` | wired headers, stat cards, filter pills, search, status badge labels |
| `src/app/dashboard/stock/sales/page.tsx` | wired headers, stat cards, payment/period filters, empty state |
| `src/app/dashboard/stock/purchases/page.tsx` | wired headers, stat cards, payment filter, empty state |
| `src/app/dashboard/stock/movements/page.tsx` | wired headers, table columns, type badges (In / Out / Return / Adjustment) |

**Verification:** `npx tsc --noEmit` clean on both frontend and backend after every batch.

**Total diff for sessions 1 + 2:** 18 files, +1416 / -322 lines.

---

## Out of scope (next session)

- **Section 1** — UI button to trigger "Retour" (Return) on `/dashboard/stock/orders` (the backend data path is consistent; only the trigger button is missing).
- **Section 2** — Template global: sidebar non-scrollable on laptop + duplicate "Ventes" tab in nav bar.
- **Section 4** — AI Agent suite (delete-intent creates new order, Human Intervention Rules inoperative, vision recognition broken, voice listening/response broken, Product Display Template doesn't render).

