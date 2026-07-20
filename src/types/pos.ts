export interface Category {
  id: number
  name: string
}

export type BranchType = 'retail' | 'wholesale'

export interface Branch {
  id: number
  name: string
  type: BranchType
}

// Unit of measure a line item is sold in. Retail sells units, wholesale sells batches
// (the batch's real-world unit name lives in Product.batchUnit / CartItem.batchUnit).
export type Uom = 'unit' | 'batch'

export interface Product {
  id: number
  name: string
  code: string
  barcode: string
  categoryId: number
  categoryName?: string
  price: number
  // Wholesale batch pricing; null when the product has no batch defined.
  // batchUnit is the real-world unit name (e.g. "Case", "Box", "Pack").
  batchUnit: string | null
  batchSize: number | null
  batchPrice: number | null
  // Whether this product may be sold through each channel, independent of
  // whether batch pricing is configured.
  sellableRetail: boolean
  sellableWholesale: boolean
  // Stock for the branch the product was fetched for, in that branch's
  // selling unit (retail = units, wholesale = batches)
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
  // Per-batch price when uom === 'batch'
  unitPrice: number
  uom: Uom
  batchUnit: string | null
  batchSize: number | null
  stock: number
  // Flat discount applied to this line only, clamped to 0..(unitPrice * quantity).
  // Folded into Sale.discount at checkout alongside the cart-level discount;
  // kept per-line here too so the receipt/history can show where it came from.
  discount: number
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'QR Payment' | 'Card Payment'

export interface SaleItem {
  productId: number
  name: string
  quantity: number
  unitPrice: number
  uom: Uom
  batchUnit?: string | null
  batchSize?: number | null
  // Flat discount applied to this line at checkout; 0 when none. Already
  // folded into Sale.discount — this is kept for receipt/audit detail only.
  discount?: number
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
