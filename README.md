# Retail POS System

A Vue 3 + Vite + Vuetify frontend for a retail point-of-sale workflow. This version does not use a backend API yet. It loads mock API data from JSON files in `public/data` and stores runtime cart, stock, and completed sales data in `localStorage`.

## Features

- Home dashboard with total products, today's sales, total orders, and total revenue
- POS product grid with image, name, code, barcode, category, price, and stock
- Product search by name, product code, or barcode
- Category filtering from mock JSON data
- Add-to-cart flow with stock validation and out-of-stock warnings
- Cart quantity controls, item removal, and clear-cart action
- Discount, tax, payment method, and grand-total calculation
- Checkout validation, completed order storage, product stock reduction, and receipt dialog
- Responsive Vuetify layouts for desktop and mobile
- Light-blue Vuetify themes for light and dark mode

## Mock Data

Mock API files live in `public/data`:

- `products.json`
- `categories.json`
- `carts.json`
- `sales.json`
- `users.json`

The frontend loads them with `fetch('/data/filename.json')`. Completed sales, active cart items, and updated product stock are saved in browser `localStorage`.

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
