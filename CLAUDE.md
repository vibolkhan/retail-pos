# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install frontend deps
npm run dev          # start Vite dev server (http://localhost:3000)
npm run build        # vue-tsc --noEmit type check, then vite build (used for deploy)
npm run build-only   # vite build without the vue-tsc project check
npm run preview      # preview the production build
npm run type-check   # vue-tsc --build --force
npm run lint         # eslint (config: eslint-config-vuetify)
npm run lint:fix     # eslint --fix
```

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

- `src/composables/useSupabase.ts` — talks directly to Supabase (`src/utils/supabase.ts`, env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`). **This is the one actually imported by the pages** (`HomePage.vue`, `PosPage.vue`, `InventoryPage.vue`, `OrderHistory.vue`) and by `useCart.ts`'s checkout flow.
- `src/composables/useMockApi.ts` — calls the Express server in `server/` (`/api/products`, `/api/categories`, `/api/cart`, `/api/sales`), which persists to `server/data/db.sqlite`, seeded from `public/data/*.json`. The Vite dev server proxies `/api` → `http://localhost:4000` (`vite.config.mts`) for this mode.

When adding or changing data-fetching logic, check which composable the page actually imports before assuming the SQLite/Express path is live — the README describes the mock-API/SQLite flow, but the current pages have been switched to Supabase. If you change one data layer's shape, the other will drift out of sync since nothing keeps their function signatures in lockstep except the shared `ProductInventoryPayload` type.

### State and cart flow

- `src/stores/app.ts` (Pinia `useAppStore`) holds `cart` and `isDark`, both persisted to `localStorage` directly inside the store actions (not via a plugin).
- `src/composables/useCart.ts` wraps the store with cart math (subtotal, quantity/stock guards) and `checkout()`, which builds a `Sale`, calls `addSale` (dynamically imported from `useSupabase`), and clears the cart on success.

### Routing and pages

Routes are declared manually in `src/router/index.ts` (no file-based routing) and map to `src/pages/*.vue`: `HomePage`, `PosPage`, `CartPage`, `InventoryPage`, `OrderHistory`. `/carts` and `/home` are redirects kept for backward compatibility; unmatched paths redirect to `/`.

### Build/deploy

`vercel.json` deploys the static `dist/` build (`@vercel/static-build`) with SPA rewrites — the Vercel deployment only serves the frontend; it does not run the `server/` Express API, so Supabase is the only data layer that works in production.

### Editor/agent rule sources

`.ruler/` (via `@intellectronica/ruler`) is the source of truth that generates per-agent instruction files (`AGENTS.md`, etc.) for copilot/claude/trae, and configures a Vuetify MCP server (`https://mcp.vuetifyjs.com/mcp`). Edit `.ruler/AGENTS.md` / `.ruler/ruler.toml`, not the generated `AGENTS.md`, if updating cross-agent rules.
