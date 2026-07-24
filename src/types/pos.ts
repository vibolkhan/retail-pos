export interface Category {
  id: number
  name: string
}

// A named unit of sale (e.g. "Piece", "Box", "Kg") — configured on the
// Configuration > Unit page and referenced by every Product.batchUnitId.
// `unit` was historically a "retail units per batch" multiplier for
// wholesale-only products; nothing computes with it anymore now that every
// product sells as exactly one of these units with no sub-unit conversion —
// it's kept only as informational/legacy reference data.
export interface BatchUnit {
  id: number
  name: string
  unit: number
}

export type BranchType = 'retail' | 'wholesale'

// Branches are physical stock locations ("warehouses") only — `type` is
// purely a label/icon now and has no effect on pricing, unit, or selling
// behavior (that used to differ between retail and wholesale branches;
// every product now sells the same way everywhere).
export interface Branch {
  id: number
  name: string
  type: BranchType
}

export interface Product {
  id: number
  name: string
  code: string
  barcode: string
  categoryId: number
  categoryName?: string
  // Default/primary supplier this product is received from — optional,
  // same "joined client-side, never persisted" pattern as categoryName.
  // Lets Purchases filter/bulk-add a supplier's whole catalog in one go.
  supplierId: number | null
  supplierName?: string
  description: string
  brand: string | null
  // ISO date/timestamp string, e.g. best-before tracking for perishables.
  expiryDate: string | null
  // Per-product low-stock alert threshold; null falls back to
  // DEFAULT_LOW_STOCK_THRESHOLD (src/utils/stock.ts).
  lowStockThreshold: number | null
  price: number
  // Cost of goods, a single global value (was per-branch on branch_stock —
  // see supabase/migrations/20260723100000_add_products_cost_and_new_fields.sql).
  // Only ever written by receiving a Purchase or editing the product form;
  // null until the product has either happened.
  cost: number | null
  // Every product sells as exactly one unit, chosen from Configuration >
  // Unit (batch_units table/route name unchanged, only the label is
  // "Unit" now). batchUnitName is joined client-side, like categoryName.
  batchUnitId: number
  batchUnitName?: string
  // Stock for the branch the product was fetched for.
  stock: number
  image: string
  // Soft-delete marker; null/undefined means active. Deleted products keep
  // their branch_stock rows so a Restore doesn't lose stock history.
  deletedAt?: string | null
}

export interface CartItem {
  productId: number
  name: string
  code: string
  barcode: string
  categoryName: string
  image: string
  quantity: number
  unitPrice: number
  // Snapshot of the product's configured unit name at add-to-cart time, for
  // display ("$5 / Piece") and carried through to SaleItem.unitName at
  // checkout. Null only if the product somehow has no unit joined.
  unitName: string | null
  stock: number
  // Flat discount applied to this line only, clamped to 0..(unitPrice * quantity).
  // Folded into Sale.discount at checkout alongside the cart-level discount;
  // kept per-line here too so the receipt/history can show where it came from.
  discount: number
  // Snapshot of the product's cost at add-to-cart time, carried through to
  // SaleItem.costPrice at checkout.
  costPrice: number | null
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'QR Payment' | 'Card Payment'

export interface SaleItem {
  productId: number
  name: string
  quantity: number
  unitPrice: number
  // Optional/nullable — sales recorded before this field existed don't
  // have it; OrderHistory/ReceiptDialog/CartPage fall back gracefully
  // (see src/utils/legacyUnit.ts) rather than showing "undefined".
  unitName?: string | null
  // Flat discount applied to this line at checkout; 0 when none. Already
  // folded into Sale.discount — this is kept for receipt/audit detail only.
  discount?: number
  // Snapshot of the product's cost at the moment this item was sold — not
  // looked up from the product's *current* cost, since a later purchase can
  // overwrite it. COGS for this line is simply costPrice * quantity (no
  // unit conversion — every product sells as one unit). Null/undefined for
  // sales recorded before this field existed, or for a product never
  // purchased/cost-entered — Profit & Loss reports those lines' COGS as 0,
  // not an estimate.
  costPrice?: number | null
}

export type SaleStatus = 'completed' | 'voided' | 'partially_refunded' | 'refunded'

export interface Customer {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  createdAt?: string
  loyaltyPoints: number
}

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjust'

// One row per earn/redeem/manual-adjust against a customer's points
// balance. points is signed (positive credits, negative debits);
// balanceAfter is the resulting total, both captured at write time so the
// ledger reads correctly even if the rate settings change later.
export interface LoyaltyTransaction {
  id: string
  customerId: number
  saleId?: string | null
  type: LoyaltyTransactionType
  points: number
  balanceAfter: number
  note?: string | null
  createdBy?: string | null
  createdAt: string
}

export interface Sale {
  id: string
  date: string
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  grandTotal: number
  paymentMethod: PaymentMethod
  branchId: number
  // Who rang up this sale; null on rows recorded before cashier tracking existed.
  cashierId?: string | null
  // Defaults to 'completed' in the DB; sales recorded before refunds existed
  // read back as 'completed' too.
  status?: SaleStatus
  // Base->secondary exchange rate in effect at sale time; null on rows
  // recorded before dual-currency existed or if the rate wasn't configured.
  exchangeRate?: number | null
  // Optional walk-in-vs-known-customer link; null/undefined for anonymous sales.
  customerId?: number | null
  // Loyalty points earned/redeemed by this sale; null when there's no
  // customer or the program was disabled at checkout time. pointsRedeemed's
  // currency value is already folded into `discount` above — these are kept
  // for receipt/ledger display and for reversing on refund/void.
  pointsEarned?: number | null
  pointsRedeemed?: number | null
  // Joined client-side for display; never persisted
  branchName?: string
  cashierEmail?: string
  customerName?: string
}

// A line refunded/voided from a sale — always a subset of that sale's items.
export interface RefundItem {
  productId: number
  quantity: number
}

export interface Refund {
  id: string
  saleId: string
  items: RefundItem[]
  amount: number
  reason: string
  refundedBy?: string | null
  createdAt: string
}

// Purchase supplier — back-office master data, admin/manager-only writes
// (Configuration > Supplier), unlike customers which any authenticated
// user can quick-add at checkout.
export interface Supplier {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  createdAt?: string
}

// One received/voided line of a purchase. previousCost is the product's
// global cost immediately before this line was applied — captured at
// receive time by receive_purchase_stock() so void_purchase_stock() can
// restore it exactly. Cost restoration on void isn't order-independent if
// a newer purchase of the same product (at ANY branch, not just this one —
// cost is product-global now) has since landed — see usePurchases.ts.
export interface PurchaseItem {
  productId: number
  // Quantity in the product's one unit — no conversion needed, since every
  // product sells/stocks/purchases in exactly the same unit.
  quantity: number
  unitCost: number
  previousCost: number | null
  subtotal: number
}

export type PurchaseStatus = 'completed' | 'voided'

// A stock-receiving event: quantity received into a branch, at a cost that
// overwrites the product's single global cost (see Product.cost) — stock
// stays branch-scoped, cost does not.
export interface Purchase {
  id: string
  date: string
  branchId: number
  supplierId: number | null
  items: PurchaseItem[]
  subtotal: number
  status: PurchaseStatus
  createdBy?: string | null
  createdAt: string
  voidedAt?: string | null
  voidedBy?: string | null
  // Joined client-side for display; never persisted
  branchName?: string
  supplierName?: string
  createdByEmail?: string
  voidedByEmail?: string
}
