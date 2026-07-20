# Retail POS — What This System Can Do

A plain-language overview of the app's capabilities and current limitations, for non-technical stakeholders.

## What this system can do

### Login & access levels
- Staff log in with email + password (no self-signup — an admin has to create accounts).
- Three account types: **Admin** and **Manager** (both see everything — dashboard, sales, inventory, customers, reports, settings) and **Salesperson** (only sees the checkout screen and cart — no access to reports, inventory, or other staff's data). Manager exists as its own account type today, but it doesn't yet have any permissions different from Admin — there's no separate manager-only restriction in place.

### Dashboard (admin/manager only)
- At-a-glance numbers: today's sales count, today's revenue, what's currently sitting in the cart.
- Charts: a 7-day revenue trend, stock levels by category, and an overall activity snapshot.
- Everything shown is for whichever store branch is currently selected.
- Still viewable offline, from the last time it loaded (see "Works offline" below).

### Checkout / point of sale
- A product grid with photos, prices, and live stock counts. Staff can search by name, product code, or scan-style barcode entry, and filter by category.
- Out-of-stock items are greyed out and can't be sold.
- At a wholesale branch, products sell by the case/box/pack instead of by the single unit, with a quantity picker for common batch sizes.
- Cart lets staff adjust quantities, remove items, apply a discount to an individual line item **and** one flat discount and one flat tax to the whole sale, and choose a payment method (Cash, Bank Transfer, QR, Card).
- Staff can search for an existing customer or quick-add a new one (name, phone, email) and attach them to the sale — or leave it anonymous/walk-in.
- Prices and totals can show a second currency alongside the main one (e.g. USD and KHR) at a fixed exchange rate set in Settings.
- Completing a sale prints an on-screen receipt, stamps which staff member rang it up, and reduces stock automatically.
- Each branch keeps its own separate, unfinished cart — switching branches doesn't lose either one's in-progress sale.

### Works offline
- The app can be installed like a real app (from the browser's "install"/"add to home screen" prompt) and keeps working with no internet connection at all — even if the browser is fully closed and reopened while offline.
- Checkout keeps working with no connection: staff can browse the product catalog (from the last time it loaded), add items to cart, and complete a sale. The sale is recorded locally and syncs automatically the moment the connection comes back — nothing is lost, and staff don't need to do anything to trigger the sync.
- A small badge in the navigation shows how many sales are still waiting to sync, so it's obvious at a glance if a device has a backlog.
- Recently-viewed dashboard, sales history, inventory, and customer data are also still viewable offline (from the last time they loaded), with an on-screen notice that it's cached data — though they can't be edited until the connection returns — inventory changes, refunds/voids, settings, and adding new customers or adjusting their loyalty points all require an active connection.
- Staff stay logged in even if a device is offline when the app is reopened — it no longer requires a live connection just to confirm who's logged in.

### Refunds and voids (admin/manager only)
- From Sales History, a completed sale can be **voided** entirely (restores all its stock and marks it Voided) or **partially refunded** by choosing which items and how many of each to give back.
- Every refund/void requires a reason, restores the returned items' stock automatically, and is tracked as its own record — a sale can be refunded again later for any items not already returned.
- Sale status is shown at a glance: Completed, Voided, Partially refunded, or Refunded.

### Customers (admin/manager only)
- A simple customer directory (name, phone, email) built from names collected at checkout, or added directly.
- Each customer's page shows how many orders they've placed and their total spend, with a link to their order history.
- **Loyalty points**: every customer carries a points balance. Each sale attached to them earns points on the amount paid, and staff can redeem existing points for a discount right at checkout. A customer's page shows a full points ledger (every earn/redeem/adjustment, with the running balance), and an admin/manager can manually add or deduct points with a note (e.g. a goodwill credit). Voiding or refunding a sale automatically claws back points it earned and restores points it spent, proportional to how much of the sale was refunded.
- The customer directory and order data are still viewable offline (from the last time they loaded), with an on-screen notice that it's cached data — adjusting points requires an active connection.

### Inventory management (admin/manager only)
- Full product list with photo, code, barcode, category, price, and per-branch stock, with color-coded low/medium/healthy stock indicators.
- Add or edit products, including a built-in photo cropping tool for product images.
- Set which channels a product can be sold through (in-store only, wholesale only, both, or neither).
- Delete products — this now archives them instead of erasing them: they disappear from checkout and the active product list, but can be **restored** later with their stock history intact.
- **Bulk update via Excel**: export the entire product catalog (including photos) to a spreadsheet, edit it, and re-import it to update everything at once. Bad rows are flagged individually rather than blocking the whole file.

### Sales history & reporting (admin/manager only)
- Searchable, filterable log of every past sale (by date, branch, payment method, keyword) — click any sale to see its receipt again, see its status, or start a refund/void.
- A Profit & Loss report with quick date presets (Today, Last 7 days, This month, etc.), summary totals (gross sales, discounts, tax, net revenue, transactions, average sale — refunds and voids are netted out), a daily breakdown, and a payment-method breakdown — exportable to PDF with one click.

### Settings (admin/manager only)
- Set the store's base currency, an optional second display currency, and the exchange rate between them — this controls the dual-currency prices shown at checkout, on receipts, and in reports.
- Configure the loyalty program's rates (see "Loyalty program settings" above), on the same page.

### Multi-branch support
- The business can run several branches at once, each flagged as retail or wholesale, with stock tracked separately per branch rather than one shared pool.

## What it can't do yet

- **No barcode scanner hardware integration** — barcode entry is just a text search field, not a camera/scanner feed.
- **No automatic low-stock alerts** — stock levels are color-coded on the inventory screen, but nothing proactively notifies anyone or triggers reordering.
- **No emailed or printed receipts** — receipts are on-screen only.
- **Manager is a separate account type in name only** — it currently has the exact same access as Admin; there's no per-branch admin restriction or narrower manager tier yet.
- **No automated testing** — correctness currently relies on manual checking, not an automated test suite.
- **Offline stock counts can drift between devices** — if two devices at the same branch are both offline and selling the same product at the same time, neither can see the other's sale until they're back online, so a brief oversell is possible (the same tolerance the system already has even when fully online, just over a longer window).
