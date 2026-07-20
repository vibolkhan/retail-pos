# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install frontend deps
npm run dev          # start Vite dev server (http://localhost:3000)
npm run build        # vue-tsc --noEmit type check, then vite build (used for deploy)
npm run preview      # preview the production build
npm run type-check   # vue-tsc --build --force
npm run lint         # eslint (config: eslint-config-vuetify)
npm run lint:fix     # eslint --fix
```

Supabase mode (the live data layer) needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` — the app will fail to fetch data without them.

There is no test script configured (`playwright-audit-output/` and `test-results/` are leftover artifacts from a prior manual run, not a wired-up suite).

There is no `server/` directory anymore — the legacy Express/SQLite backend and `useMockApi.ts` composable it once described have been deleted. `src/composables/useSupabase.ts` is the only data-access layer; `README.md` still describes the old Express+SQLite setup and is out of date. `vite.config.mts` still proxies `/api` → `http://localhost:4000`, but nothing serves that port anymore — treat it as dead config, not a sign the mock API is still in play. `FEATURES.md` is a maintained plain-language feature/limitations overview (for non-technical stakeholders) — read it for a quick sense of current scope before diving into the architecture below.

### Database schema and migrations

Schema history for the live project (`acgpywmwcrssqozasxyq`, referenced in `supabase/config.toml`) is tracked as SQL files under `supabase/migrations/`, mirroring exactly what's applied remotely (verified against `supabase_migrations.schema_migrations`) — this wasn't version-controlled before and was backfilled from the live migration history rather than invented. To add a schema change: write a new timestamped `supabase/migrations/<yyyymmddhhmmss>_<name>.sql` file, then apply it with the `mcp__supabase__apply_migration` tool (or `supabase db push` via the CLI, once linked with `supabase link --project-ref acgpywmwcrssqozasxyq`) — never hand-edit the schema directly through the dashboard without also committing the corresponding migration file, or the two will drift.

A policy defined on `profiles` that subqueries `profiles` itself (e.g. "is this caller an admin?") triggers Postgres's "infinite recursion detected in policy" error at runtime, breaking login — `20260719140000_fix_profiles_rls_recursion.sql` worked around this by moving the check into a `SECURITY DEFINER` function (`is_admin_or_manager()`), which runs as its owner and isn't subject to RLS on the table it queries. Follow that pattern for any future role-check policy on `profiles`.

## Architecture

Vue 3 + Vite + Vuetify SPA. Path alias `@` → `src/`.

### Data layer

`src/composables/useSupabase.ts` talks directly to Supabase (`src/utils/supabase.ts`) and is imported by every page that needs data (`HomePage.vue`, `PosPage.vue`, `InventoryPage.vue`, `OrderHistory.vue`) and by `useCart.ts`'s checkout flow. Everything is typed against `src/types/pos.ts`.

`src/composables/useInventoryExcel.ts` (via `exceljs` + `jszip`) exports/imports the inventory as an `.xlsx` workbook — round-trips product fields, per-branch stock columns, and embedded photo thumbnails, and calls back into `useSupabase.ts`'s `createProductInventory`/`updateProductInventory`/`uploadProductImage` on import. It also normalizes workbooks that Excel has re-saved with a namespaced `<x:workbook>` root before handing them to `exceljs`, which only parses the unprefixed form. `InventoryPage.vue` is the only consumer.

### Auth and role-based access

Auth is Supabase-only:

- `src/composables/useAuth.ts` wraps `supabase.auth` (`signInWithPassword`, `signOut`) and fetches the caller's row from a `profiles` table (`id, email, role`) via `getProfile`.
- `src/stores/auth.ts` (Pinia `useAuthStore`) holds `session`/`profile` and exposes `role`/`isAdmin`/`isManager`/`isSalesperson` getters. Three roles exist: `'admin' | 'manager' | 'salesperson'` (`src/types/auth.ts`) — `manager` is a distinct DB role but has identical access to `admin` everywhere in the app today (every `meta.roles` list that includes `'admin'` also includes `'manager'`); there's no separate role-management UI to differentiate them yet. `init()` memoizes its setup promise at module scope (not in state) so `router.beforeEach` — which fires on every navigation — can call it repeatedly without re-subscribing to `onAuthStateChange`.
- `applySession()` in `src/stores/auth.ts` is called concurrently from both `login()` and the `onAuthStateChange` subscription (which also refires on Supabase's periodic background token refresh) — `applySessionKey`/`applySessionPromise` key calls by `access_token` so identical concurrent calls share one in-flight `getProfile()` fetch, and a call only commits its result if no newer session has superseded it. Without this, a stale or transiently-failed call could null out an already-valid profile and spuriously trip the router guard's "no role" logout.
- `src/router/index.ts` guards every route in `router.beforeEach`: unauthenticated users are sent to `/login`; a route's `meta.roles` (declared via an augmented `RouteMeta`) is checked against `authStore.role`, redirecting unauthorized users to `roleHome()` (`/` for admin/manager, `/pos` for salesperson) with a flash message. A logged-in user with no matching `profiles` row is force-logged-out. `meta.public` exempts a route (only `/login`) from the auth check.

### Multi-branch (retail vs. wholesale)

Products and stock are branch-scoped, and a branch's `type` (`'retail' | 'wholesale'`) changes selling behavior throughout the cart flow:

- `src/stores/branch.ts` (Pinia `useBranchStore`) loads `Branch[]` via `getBranches()` and persists the selected `activeBranchId` to `localStorage`. Switching branches calls `useAppStore().reloadCartForBranch(id)` — **each branch has its own cart**, keyed as `cart:<branchId>` in `localStorage` (`src/stores/app.ts`).
- Stock lives per-branch in a `branch_stock` table, not on `products` directly — `getProducts(branchId)` and `getInventoryProducts()` (`src/composables/useSupabase.ts`) join it in. `decrementBranchStock()` calls a Postgres RPC (`decrement_branch_stock`) to atomically decrement stock after checkout rather than doing a read-then-write from the client.
- Wholesale branches sell by the batch: `Product.batchUnit`/`batchSize`/`batchPrice` and `sellableWholesale`/`sellableRetail` gate whether `useCart.ts`'s `addToCart()` allows a product into the cart and which price/unit (`uom: 'unit' | 'batch'`) it uses. `useBranchStore().isWholesale` is the switch checked throughout.
- Deleting a product is a soft-delete: `deleteProductInventory()` sets `Product.deletedAt` instead of removing the row (keeping its `branch_stock` history intact), and `restoreProductInventory()` clears it back to `null`. `getProducts(branchId)` (POS/checkout) filters `deletedAt is null`; `getInventoryProducts()` (Inventory page) returns everything, deleted included, so `InventoryPage.vue` can offer a Restore action.

### State and cart flow

- `src/stores/app.ts` (Pinia `useAppStore`) holds `cart` (per active branch, see above) and `isDark`, both persisted to `localStorage` directly inside the store actions (not via a plugin).
- `src/composables/useCart.ts` wraps the store with cart math (subtotal, quantity/stock guards, retail-vs-wholesale eligibility) and `checkout(discount, tax, paymentMethod, customerId?, redeemPoints?)`, which builds a `Sale` (stamping `cashierId` from `useAuthStore`, `exchangeRate` from `useSettings`, and the optional `customerId`) and hands it to `useSalesSyncQueue()` rather than calling Supabase directly — see "Offline mode" below for why. A stock-decrement or loyalty-step failure does not fail the sale — it's already recorded — it only changes the returned message.
- Each `CartItem` also carries its own `discount` (`setLineDiscount()`, clamped to `0..unitPrice*quantity` and reclamped whenever quantity changes via `clampLineDiscount()`). At checkout, every line's discount is folded together with the order-level discount into a single `Sale.discount` total (so existing P&L/history reporting keeps reading one number), while each `SaleItem.discount` retains its own line's amount for receipt/audit detail.
- `src/composables/useToast.ts` is a module-level singleton (`reactive` state shared across imports) so every page shows toasts through one `<v-snackbar>` state instead of declaring its own. `src/composables/useSettings.ts` follows the same singleton pattern for currency settings (see "Settings and dual currency" below).

### Offline mode

- The app is a PWA (`vite-plugin-pwa`, configured in `vite.config.mts`): `registerType: 'prompt'`, not `autoUpdate` — a newly deployed service worker sits in `waiting` until the app itself calls `updateSW(true)` (via `src/composables/usePwaUpdate.ts`, surfaced as a snackbar in `App.vue`), so a background deploy can never force-reload a cashier mid-sale. No `runtimeCaching` rules are configured for Supabase traffic — only the built app shell (JS/CSS/HTML, `navigateFallback: '/index.html'`) is precached, so every `useSupabase.ts` call still gets a real network success/failure to react to.
- `src/composables/useOnline.ts` is a module-singleton reactive `isOnline` flag off `navigator.onLine`/`online`/`offline` events — the shared signal every piece below reacts to. `src/composables/useOfflineCache.ts`'s `cachedFetch(key, fetcher, isOnline)` is the shared "network-first, fall back to the last cached value under `localStorage['posCache:v1:<key>']` on a network failure" wrapper used by `HomePage.vue`/`PosPage.vue`/`CartPage.vue`/`InventoryPage.vue`/`OrderHistory.vue`/`ProfitLossPage.vue`/`CustomersPage.vue`/`stores/branch.ts`/`useSettings.ts` — `useSupabase.ts` itself stays pure/network-only.
- `src/stores/auth.ts`'s `applySession()` also caches the fetched `profiles` row to `localStorage` (keyed `auth:profile:<userId>`) and falls back to it if `getProfile()` fails with no network *and* there's no good in-memory profile yet (the fresh-page-load case) — without this, an already-logged-in user reopening the app offline would get bounced to `/login` just because the mandatory profile fetch couldn't reach the network. The cached role is client-side UX only; Supabase RLS is still the real authorization boundary.
- `src/composables/useSalesSyncQueue.ts` is the offline checkout queue `useCart.ts`'s `checkout()` always goes through, even when online: it `enqueue()`s the built `Sale` (persisted to `localStorage['posQueue:v1:sales']` before any network call) and immediately calls `processQueueEntry()` — the exact same function background `flush()` calls later for anything that didn't finish. Each queued entry tracks **per-step** status (`saleInserted`, `stockDecremented`, `redeemApplied`/`redeemLedgerWritten`, `earnApplied`/`earnLedgerWritten`) rather than one queued/synced flag, because the insert is safely retryable (a duplicate-key error on retry means an earlier attempt already landed) while the stock/loyalty RPCs are not (each applies a delta). A genuine (non-network) failure on `saleInserted` is the only case that removes an entry outright — `checkout()`'s live call does this itself, since nothing was ever promised to the cashier yet; a background `flush()` finding the same failure on an older entry instead marks it `'failed'` and leaves it visible (a manager needs to know a promised-queued sale didn't actually land). `flush()` is triggered on reconnect and a 60s interval (`App.vue`) plus opportunistically on `PosPage.vue`/`CartPage.vue` mount, wrapped in the Web Locks API when available so two tabs on the same device can't double-process the same queue. `AppHeader.vue` shows a pending/failed-count chip from `pendingCount`/`failedCount`.
- Writes outside checkout stay online-only by design (disabled, not queued, while offline): inventory create/update/delete/restore + Excel import/export, refunds/voids, settings saves, and new-customer creation. Multi-device offline stock drift (two devices offline selling the same product can't see each other's decrements) is an accepted, pre-existing tolerance — `decrementBranchStock`/`adjustLoyaltyPoints` already clamp at 0 rather than error even fully online.

### Sales lifecycle: status, refunds, and voids

- `Sale.status` (`src/types/pos.ts`) is one of `'completed' | 'voided' | 'partially_refunded' | 'refunded'`; rows written before this existed read back as `'completed'`. A `refunds` table stores each refund/void as its own row (`saleId`, `items: RefundItem[]`, `amount`, `reason`, `refundedBy`).
- `src/composables/useRefunds.ts` is the only place that mutates this: `voidSale()` refunds every line at once and sets status to `'voided'`; `refundSaleItems()` refunds specific lines (validated against `remainingQuantities()`, which subtracts prior refunds from each `SaleItem.quantity`) and sets status to `'refunded'` once every line is fully refunded, or `'partially_refunded'` otherwise. Both call `incrementBranchStock()` (the inverse RPC of `decrementBranchStock`, same security-definer trust model) to restore stock before recording the refund. `OrderHistory.vue` is the only consumer.
- Refund/void data is admin/manager-only via RLS (see `getRefundsForSale`/`getAllRefunds`/`addRefund` in `useSupabase.ts`); `getAllRefunds()` exists so `ProfitLossPage.vue` can fold refund totals into net revenue.

### Customers

`customers` is a lightweight table (`name`, `phone`, `email`) readable/insertable by any authenticated user, not just admins — `CartPage.vue` lets a salesperson search or quick-create a customer at checkout (via `getCustomers`/`createCustomer`) and attach `customerId` to the `Sale`. `CustomersPage.vue` (`/customers`, admin/manager-only) lists customers with derived order count and total spent, computed client-side by joining against `getSales()`.

### Customer loyalty

- `customers.loyaltyPoints` is a running balance; every change also writes a `loyalty_transactions` row (`type: 'earn' | 'redeem' | 'adjust'`, signed `points`, `balanceAfter`, optional `saleId`) so the balance is always reconstructable — same "denormalized total + audit ledger" shape as `branch_stock`/refunds. Both are mutated through the `adjust_loyalty_points(customerId, delta)` RPC (SECURITY DEFINER, clamps at 0), never a direct `update customers`, so a salesperson's checkout and an admin's manual adjustment share one race-safe path.
- Rates live in `LoyaltySettings` (`enabled`, `pointsPerCurrency`, `redemptionPointsPerCurrency`, `minRedeemPoints`), stored under the `settings` table's `'loyalty'` key exactly like `CurrencySettings` — `useSettings.ts` loads/saves both with the same module-singleton pattern, and `App.vue` fetches both as soon as the user is authenticated.
- `useCart.ts`'s `checkout()` takes an optional `redeemPoints`, reclamps it server-math-side via `maxRedeemablePoints()` (never trusting the UI's value) so redemption can never exceed what the sale is worth, folds the redeemed value into `Sale.discount` alongside line/order discounts, and stamps `Sale.pointsEarned`/`pointsRedeemed` for receipt/ledger display. After the sale is recorded, it redeems first then earns (two ledger rows, best-effort — a failure here doesn't fail the already-completed sale, same as the stock-decrement pattern).
- `useRefunds.ts`'s `recordRefund()` (the choke point behind both `voidSale()` and `refundSaleItems()`) reverses a sale's `pointsEarned`/`pointsRedeemed` prorated to `refundAmount / sale.grandTotal` — a full void reverses 100%, a partial refund reverses its share — recorded as an `'adjust'` ledger row.
- `CustomersPage.vue` is the only place with a manual "Adjust points" action (also an `'adjust'` ledger row) and the only reader of the per-customer ledger (`getLoyaltyTransactionsForCustomer`, admin/manager-only via RLS like refunds).

### Settings and dual currency

- A generic `settings` key/value table backs `getCurrencySettings`/`updateCurrencySettings` (`useSupabase.ts`), read by any authenticated user but writable admin/manager-only via RLS. `src/composables/useSettings.ts` wraps it in the same module-level-singleton pattern as `useToast.ts`, so `SettingsPage.vue`, `CartPage.vue`, `ProductCard.vue`, `ReceiptDialog.vue`, and `ProfitLossPage.vue` all share one fetch instead of loading their own copy.
- `CurrencySettings` (`base`, `secondary`, `exchangeRate`) drives dual-currency display: `src/utils/currency.ts`'s `formatSecondaryCurrency(amount, code, rate)` converts and formats a base-currency amount into the secondary currency (returns `''` when no rate is configured, so templates can just `v-if` it), while `formatCurrencyAs(amount, code)` formats an amount that's already denominated in a given currency — used for aggregates that were converted sale-by-sale at each sale's own historical `exchangeRate` before summing, rather than re-converted at today's rate.

### Routing and pages

Routes are declared manually in `src/router/index.ts` (no file-based routing) and map to `src/pages/*.vue`: `HomePage` (`/`, admin/manager-only), `PosPage` (`/pos`), `CartPage` (`/cart`), `InventoryPage` (`/inventory`, admin/manager-only), `OrderHistory` (`/sales`, admin/manager-only), `CustomersPage` (`/customers`, admin/manager-only), `ProfitLossPage` (`/pnl`, admin/manager-only), `SettingsPage` (`/settings`, admin/manager-only), `LoginPage` (`/login`, public). `/carts` and `/home` are redirects kept for backward compatibility; unmatched paths redirect to `/`. See "Auth and role-based access" above for how `meta.roles`/`meta.public` are enforced.

`ProfitLossPage.vue` exports a filtered sales report to PDF using `jspdf` + `jspdf-autotable` (dynamically imported); `HomePage.vue` renders a dashboard chart via `chart.js`; `InventoryPage.vue` uses `vue-advanced-cropper` for product-photo cropping before upload and `useInventoryExcel.ts` for bulk export/import.

### Build/deploy

`vercel.json` deploys the static `dist/` build (`@vercel/static-build`) with SPA rewrites — the Vercel deployment only serves the frontend, so Supabase is the only data layer that works in production. `npm run build` also runs `vite-plugin-pwa`'s `generateSW`, emitting `dist/sw.js`/`dist/manifest.webmanifest` and precaching the built app shell (see "Offline mode" above) — `vercel.json`'s SPA rewrite and the service worker's own `navigateFallback` need to agree on the same "any path → `index.html`" behavior, since the rewrite obviously can't fire with no network at all.

### Styling: Tailwind + Vuetify

Both Tailwind (`@tailwindcss/vite`, `src/styles/tailwind.css`) and Vuetify (`src/styles/settings.scss`) apply to the same components — mixing Tailwind utility classes with Vuetify component props (`color`, `variant`, `density`, etc.) is intentional, not incidental. `vue-i18n` is wired up (`src/plugins/i18n.ts`) but only has placeholder `en`/`ja` messages — no page currently uses `$t()`.

### Editor/agent rule sources

`.ruler/` (via `@intellectronica/ruler`) is the source of truth that generates per-agent instruction files (`AGENTS.md`, etc.) for copilot/claude/trae, and configures a Vuetify MCP server (`https://mcp.vuetifyjs.com/mcp`). Edit `.ruler/AGENTS.md` / `.ruler/ruler.toml`, not the generated `AGENTS.md`, if updating cross-agent rules.
