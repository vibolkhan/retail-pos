# Retail POS System

A Vue 3 + Vite + Vuetify frontend for a retail point-of-sale workflow backed by an Express + SQLite API. Runtime products, cart items, stock, and completed sales are stored in `server/data/db.sqlite`.

## Features

- Home dashboard with total products, today's sales, total sales, and total revenue
- POS product grid with image, name, code, barcode, category, price, and stock
- Product search by name, product code, or barcode
- Inventory screen for stock management and POS product visibility
- Category filtering from mock JSON data
- Add-to-cart flow with stock validation and out-of-stock warnings
- Cart quantity controls, item removal, and clear-cart action
- Discount, tax, payment method, and grand-total calculation
- Checkout validation, completed sale storage, product stock reduction, and receipt dialog
- Responsive Vuetify layouts for desktop and mobile
- Light-blue Vuetify themes for light and dark mode

## Data Storage

Initial seed files live in `public/data`:

- `products.json`
- `categories.json`
- `carts.json`
- `sales.json`
- `users.json`

On startup, the backend seeds empty SQLite tables from these files. The frontend reads and writes runtime data through `/api/products`, `/api/categories`, `/api/cart`, and `/api/sales`.

## Project Structure

```text
src/
  components/
    AppHeader.vue
    ProductCard.vue
    ReceiptDialog.vue
  composables/
    useCart.ts
    useMockApi.ts
  pages/
    HomePage.vue
    PosPage.vue
    CartPage.vue
  plugins/
    index.ts
    vuetify.ts
  router/
    index.ts
  types/
    pos.ts
  utils/
    currency.ts
  App.vue
  main.ts
public/
  data/
    products.json
    categories.json
    carts.json
    sales.json
    users.json
```

## Install

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:3000/`.

## Build

```bash
npm run build
```

For a Vite-only production bundle without TypeScript project checking:

```bash
npm run build-only
```
