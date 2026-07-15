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
  // Joined client-side for display; never persisted
  branchName?: string
}

export interface User {
  id: number
  name: string
  email: string
  role: string
}
