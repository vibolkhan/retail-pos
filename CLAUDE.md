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

The legacy Express/SQLite backend in `server/` has its own `package.json` and `node_modules` — run it separately:

```bash
cd server
npm install
npm run dev     # nodemon index.js, listens on :4000
npm start       # node index.js
```

## Architecture

Vue 3 + Vite + Vuetify SPA. Path alias `@` → `src/`.

### Two parallel data layers — only one is actually wired up

There are **two independent implementations** of the data-access API, both typed against `src/types/pos.ts`:

- `src/composables/useSupabase.ts` — talks directly to Supabase (`src/utils/supabase.ts`). **This is the one actually imported by the pages** (`HomePage.vue`, `PosPage.vue`, `InventoryPage.vue`, `OrderHistory.vue`) and by `useCart.ts`'s checkout flow.
- `src/composables/useMockApi.ts` — calls the Express server in `server/` (`/api/products`, `/api/categories`, `/api/cart`, `/api/sales`), which persists to `server/data/db.sqlite`, seeded from `public/data/*.json`. The Vite dev server proxies `/api` → `http://localhost:4000` (`vite.config.mts`) for this mode.

When adding or changing data-fetching logic, check which composable the page actually imports before assuming the SQLite/Express path is live — the README describes the mock-API/SQLite flow, but the current pages have been switched to Supabase. If you change one data layer's shape, the other will drift out of sync since nothing keeps their function signatures in lockstep except the shared `ProductInventoryPayload` type.

### Auth and role-based access

Auth is Supabase-only (no equivalent exists in the mock-API layer):

- `src/composables/useAuth.ts` wraps `supabase.auth` (`signInWithPassword`, `signOut`) and fetches the caller's row from a `profiles` table (`id, email, role`) via `getProfile`.
- `src/stores/auth.ts` (Pinia `useAuthStore`) holds `session`/`profile` and exposes `role`/`isAdmin`/`isSalesperson` getters. Only two roles exist: `'admin' | 'salesperson'` (`src/types/auth.ts`). `init()` memoizes its setup promise at module scope (not in state) so `router.beforeEach` — which fires on every navigation — can call it repeatedly without re-subscribing to `onAuthStateChange`.
- `src/router/index.ts` guards every route in `router.beforeEach`: unauthenticated users are sent to `/login`; a route's `meta.roles` (declared via an augmented `RouteMeta`) is checked against `authStore.role`, redirecting unauthorized users to `roleHome()` (`/` for admin, `/pos` for salesperson) with a flash message. A logged-in user with no matching `profiles` row is force-logged-out. `meta.public` exempts a route (only `/login`) from the auth check.

### Multi-branch (retail vs. wholesale)

Products and stock are branch-scoped, and a branch's `type` (`'retail' | 'wholesale'`) changes selling behavior throughout the cart flow:

- `src/stores/branch.ts` (Pinia `useBranchStore`) loads `Branch[]` via `getBranches()` and persists the selected `activeBranchId` to `localStorage`. Switching branches calls `useAppStore().reloadCartForBranch(id)` — **each branch has its own cart**, keyed as `cart:<branchId>` in `localStorage` (`src/stores/app.ts`).
- Stock lives per-branch in a `branch_stock` table, not on `products` directly — `getProducts(branchId)` and `getInventoryProducts()` (`src/composables/useSupabase.ts`) join it in. `decrementBranchStock()` calls a Postgres RPC (`decrement_branch_stock`) to atomically decrement stock after checkout rather than doing a read-then-write from the client.
- Wholesale branches sell by the batch: `Product.batchUnit`/`batchSize`/`batchPrice` and `sellableWholesale`/`sellableRetail` gate whether `useCart.ts`'s `addToCart()` allows a product into the cart and which price/unit (`uom: 'unit' | 'batch'`) it uses. `useBranchStore().isWholesale` is the switch checked throughout.

### State and cart flow

- `src/stores/app.ts` (Pinia `useAppStore`) holds `cart` (per active branch, see above) and `isDark`, both persisted to `localStorage` directly inside the store actions (not via a plugin).
- `src/composables/useCart.ts` wraps the store with cart math (subtotal, quantity/stock guards, retail-vs-wholesale eligibility) and `checkout()`, which builds a `Sale`, calls `addSale` then `decrementBranchStock` (both dynamically imported from `useSupabase`), and clears the cart on success. A stock-decrement failure does not fail the sale — it's already recorded — it only changes the returned message.

### Routing and pages

Routes are declared manually in `src/router/index.ts` (no file-based routing) and map to `src/pages/*.vue`: `HomePage` (`/`, admin-only), `PosPage` (`/pos`), `CartPage` (`/cart`), `InventoryPage` (`/inventory`, admin-only), `OrderHistory` (`/sales`, admin-only), `ProfitLossPage` (`/pnl`, admin-only), `LoginPage` (`/login`, public). `/carts` and `/home` are redirects kept for backward compatibility; unmatched paths redirect to `/`. See "Auth and role-based access" above for how `meta.roles`/`meta.public` are enforced.

`ProfitLossPage.vue` exports a filtered sales report to PDF using `jspdf` + `jspdf-autotable` (dynamically imported); `HomePage.vue` renders a dashboard chart via `chart.js`. `pg` is a dependency but unused in `src/` — Postgres access goes through `@supabase/supabase-js`, not a direct client.

### Build/deploy

`vercel.json` deploys the static `dist/` build (`@vercel/static-build`) with SPA rewrites — the Vercel deployment only serves the frontend; it does not run the `server/` Express API, so Supabase is the only data layer that works in production.

### Styling: Tailwind + Vuetify

Both Tailwind (`@tailwindcss/vite`, `src/styles/tailwind.css`) and Vuetify (`src/styles/settings.scss`) apply to the same components — mixing Tailwind utility classes with Vuetify component props (`color`, `variant`, `density`, etc.) is intentional, not incidental. `vue-i18n` is wired up (`src/plugins/i18n.ts`) but only has placeholder `en`/`ja` messages — no page currently uses `$t()`.

### Editor/agent rule sources

`.ruler/` (via `@intellectronica/ruler`) is the source of truth that generates per-agent instruction files (`AGENTS.md`, etc.) for copilot/claude/trae, and configures a Vuetify MCP server (`https://mcp.vuetifyjs.com/mcp`). Edit `.ruler/AGENTS.md` / `.ruler/ruler.toml`, not the generated `AGENTS.md`, if updating cross-agent rules.
