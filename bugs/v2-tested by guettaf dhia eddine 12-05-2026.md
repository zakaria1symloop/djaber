# Tested by Guettaf Dhia Eddine — 12/05/2026 (v2)

**Platform:** Djaber AI
**Tester:** Guettaf Dhia Eddine
**Test date:** 12 Mai 2026
**Report received:** 12/05/2026
**Developer:** Amrani Zakaria
**Source:** `bugs/_bugs__djaber_ai (1).zip` → `Rapport_Bugs_Djaber_Ai_Mis_a_Jour.pdf`

> **Quick status:** 8 of 8 actionable items fixed. Remaining: AI Agent suite (Product Card, voice, image send/read — open since v1) which need backend work on the Meta messaging pipeline + a dedicated session.

---

## 1. Finance et Statistiques

### Erreur de calcul du CA (CD.png, CD2.png)
- **Bug:** `/dashboard` + `/dashboard?section=analytics` revenue includes cancelled orders. Should only count **delivered**.
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Fix:** `backend/src/controllers/user-sales.controller.ts` — tightened `getSalesStats` from `status: { notIn: ['cancelled','returned'] }` to `status: 'delivered'`. Both the overview and analytics views inherit the fix since both call the same endpoint.

### Incohérence du filtre de date Caisse (dateFilter.png)
- **Bug:** `/dashboard/stock/caisse` — period pills (Today/Week/Month/Year) refresh the stat cards but the transaction table stays on its own dateFrom/dateTo state.
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Fix:** `src/app/dashboard/stock/caisse/page.tsx` — period-pill click now also pushes the matching date window into the table filter (dateFrom = start-of-period, dateTo cleared = up to now). Backend also patched: `dateTo` was being parsed as midnight UTC so transactions logged later that same day were excluded — now treated as end-of-day when no time component is provided.

---

## 2. Gestion des Stocks et Livraisons

### Stock non réincrémenté à l'annulation (ReturnProblem.png, StockDontIncreaseWhenOrderCancel.png)
- **Bug:** Despite the v1 fix, stock still isn't restored when the tester cancels an order.
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Root cause:** The v1 fix lived inside `updateOrder`, but the tester was cancelling via the **call-outcome modal** (rejected → auto-cancels), which routes through `addOrderCall`. That endpoint changed `status` to `cancelled` but bypassed the stock-restore / caisse-wipe / client-rollback logic.
- **Fix:** Extracted a shared `rollbackOrderSideEffects(tx, userId, order, reason)` helper in `backend/src/controllers/user-orders.controller.ts` and invoked it from BOTH `updateOrder` (status transition path) and `addOrderCall` (call-rejection path). Also patched `deleteOrder` to skip re-incrementing stock if the order was already cancelled (would otherwise double-credit). Helper handles: stock increment + return movement log + caisse auto-row wipe + client lifetime stats rollback.

### Dysfonctionnement actions livraison (DeliveryAction + stats.png)
- **Bug:** Delivery actions don't respond, "Delivered" stat stuck at 0.
- **Status:** ✅ Already fixed in v1 by Djelil Rahim (see v1 fix log). The stat-stuck-at-0 was the filtered-list bug fixed last session. Tester may need to refresh the deployed build.

---

## 3. Interface et Navigation

### Page de modification 404 (EditSalesPageNotFound.png)
- **Bug:** `/dashboard/stock/sales/[saleId]/edit` returns 404.
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Fix:** Created `src/app/dashboard/stock/sales/[saleId]/edit/page.tsx`. Fetches the sale via `getSale(id)`, shows read-only summary (customer, items count, total, date), and lets the merchant edit the three fields the backend supports: payment status (paid/pending/partial pills), payment method (cash/card/transfer/CCP), and notes. Items/prices remain immutable to keep stock movements consistent.

### Défaut d'affichage image produit (imageProblem.png)
- **Bug:** Existing product images don't display in the Edit Product modal — thumbnails are black/empty.
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Fix:** `src/components/stock/ImageUploader.tsx` — was blindly doing `src={`${API_BASE_URL}${img.url}`}`. Rehosted images (from FB analyzer or GCS) are stored as **absolute** URLs, so the concat produced `https://api/https://api/uploads/...` and 404s. Added a `resolveImageUrl()` helper that only prepends when the URL is relative (same pattern used by the product list and the page-stock views).

### Défaut UI Fournisseurs — bouton Active (StatusBtn.png)
- **Bug:** Edit Supplier modal's Active toggle handle is visually disconnected from the track in Arabic (RTL).
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Fix:** `src/app/dashboard/stock/suppliers/page.tsx` — replaced physical-axis `translate-x-5` / `translate-x-1` with a flexbox-based toggle (`flex justify-end` when active, `flex justify-start` when inactive). Flex layout mirrors automatically in RTL so the handle now snaps to the correct end in both directions. Also localised the Active/Inactive label. Same flex-toggle pattern applied to the Low Stock toggle on the products filter panel.

---

## 4. Localisation et Agent IA

### Traductions + problèmes LTR sur filtres en Arabe (traduction.png à traduction61.png — 60 captures)
- **Bug:** Filter panel labels (`CATEGORY`, `SELLING PRICE (DA)`, `COST PRICE (DA)`, `QUANTITY`, `NET PROFIT (DA)`, `MARGIN (%)`, `STOCK LEVEL`, `STATUS`, `LOW STOCK ONLY`, `APPLY FILTERS`, `CLEAR ALL`) remained in English. Range-slider number inputs reversed in RTL displaying as `100000 to 0` instead of `0 to 100000`.
- **Status:** ✅ Fixed by Amrani Zakaria (12/05/2026)
- **Fix:**
  - Added a new `stock.filter.*` namespace to `src/lib/i18n.ts` (en / fr / ar) covering all filter-panel labels.
  - `src/app/dashboard/stock/products/page.tsx`: wired the new keys for every filter section + `Apply Filters` / `Clear All` footer buttons.
  - `src/components/stock/RangeSlider.tsx`: locked the number-inputs container and the range-bounds labels to `dir="ltr"` so "min — to — max" reads left-to-right in both languages. Numbers are universal; flipping them is the cause of "100000 to 0" confusion.

### Dysfonctionnements Agent IA
- **Bug:** Product Card structure not respected, no voice response, can't send/read product images.
- **Status:** Open — out of scope this session. Needs a dedicated pass on the Meta messaging pipeline (`backend/src/services/messenger.service.ts` + `transcription.service.ts` + agent prompt-template engine).

---

## Session 3 — 12/05/2026 fix log

**Developer:** Amrani Zakaria
**Scope:** v2 bug report — finance / stock / navigation / UI / RTL i18n
**Files touched:**

| File | Change |
|---|---|
| `backend/src/controllers/user-orders.controller.ts` | NEW `rollbackOrderSideEffects` helper; `updateOrder` + `addOrderCall` + `deleteOrder` all use it; double-credit guard in deleteOrder |
| `backend/src/controllers/user-sales.controller.ts` | CA tightened to `status: 'delivered'` only |
| `backend/src/controllers/user-caisse.controller.ts` | `dateTo` treated as end-of-day for bare date strings |
| `src/app/dashboard/stock/caisse/page.tsx` | Period pills now drive the table date filter too |
| `src/app/dashboard/stock/sales/[saleId]/edit/page.tsx` | NEW — edit page for sales (payment + notes) |
| `src/components/stock/ImageUploader.tsx` | `resolveImageUrl()` skips API_BASE_URL prefix for absolute URLs |
| `src/app/dashboard/stock/suppliers/page.tsx` | Flex-justify Active toggle, localised Active/Inactive |
| `src/app/dashboard/stock/products/page.tsx` | Filter panel translated; Low-Stock toggle flex-mirror |
| `src/components/stock/RangeSlider.tsx` | `dir="ltr"` on numeric inputs + range labels |
| `src/lib/i18n.ts` | New `stock.filter.*` namespace (× en/fr/ar) |

**Verification:** `npx tsc --noEmit` clean on both frontend and backend.
