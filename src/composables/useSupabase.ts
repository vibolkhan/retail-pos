import type { AuthProfile } from '@/types/auth'
import type {
  BatchUnit,
  Branch,
  Category,
  Customer,
  LoyaltyTransaction,
  Product,
  Purchase,
  PurchaseStatus,
  Refund,
  Sale,
  SaleStatus,
  Supplier,
} from '@/types/pos'

// src/composables/useSupabase.ts
import { supabase } from '@/utils/supabase'

// Export payload type for product inventory (excluding id, categoryName and
// stock — stock now lives per branch in branch_stock — and deletedAt, which
// is only ever changed via deleteProductInventory/restoreProductInventory)
export type ProductInventoryPayload = Omit<Product, 'id' | 'categoryName' | 'stock' | 'deletedAt'>

export interface BranchStockInput {
  branchId: number
  stock: number
}

export interface CurrencySettings {
  base: string
  secondary: string
  exchangeRate: number
}

export interface LoyaltySettings {
  enabled: boolean
  // Points earned per 1 unit of base currency spent (grandTotal), floored.
  pointsPerCurrency: number
  // Points required to redeem for 1 unit of base currency off a sale.
  redemptionPointsPerCurrency: number
  // Balance a customer must hold before any redemption is allowed at checkout.
  minRedeemPoints: number
}

const CURRENCY_SETTINGS_KEY = 'currency'
const LOYALTY_SETTINGS_KEY = 'loyalty'

// Product with stock broken out per branch (for the Inventory page and
// Configuration > Products). Cost/price are plain columns on Product
// itself now (global, not per-branch) — only stock still varies by branch.
export type InventoryProduct = Product & {
  stockByBranch: Record<number, number>
}

// Helper to handle Supabase errors
function handleError (error: any) {
  if (error) {
    throw new Error(error.message ?? 'Supabase request failed')
  }
}

// Same as handleError, but turns a Postgres FK-violation (23503) into a
// friendly message — used by delete functions on lookup tables (categories,
// batch_units) that products reference, so "still in use" reads clearly
// instead of surfacing the raw constraint-name error.
function handleDeleteError (error: any, inUseMessage: string) {
  if (error?.code === '23503') {
    throw new Error(inUseMessage)
  }
  handleError(error)
}

// Branches
export async function getBranches (): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select()
  handleError(error)
  return (data ?? []) as Branch[]
}

// Categories
export async function getCategories (): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select()
  handleError(error)
  return (data ?? []) as Category[]
}

export async function createCategory (input: Pick<Category, 'name'>): Promise<Category> {
  const { data, error } = await supabase.from('categories').insert([input]).select().single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to create category: returned null')
  }
  return data as Category
}

export async function updateCategory (payload: Category): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: payload.name })
    .eq('id', payload.id)
    .select()
    .single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to update category: returned null')
  }
  return data as Category
}

export async function deleteCategory (id: number): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  handleDeleteError(error, 'This category is still used by one or more products.')
}

// Batch units — wholesale batch presets (Configuration > Batch Unit)
export async function getBatchUnits (): Promise<BatchUnit[]> {
  const { data, error } = await supabase.from('batch_units').select().order('name')
  handleError(error)
  return (data ?? []) as BatchUnit[]
}

export async function createBatchUnit (input: Pick<BatchUnit, 'name' | 'unit'>): Promise<BatchUnit> {
  const { data, error } = await supabase.from('batch_units').insert([input]).select().single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to create batch unit: returned null')
  }
  return data as BatchUnit
}

export async function updateBatchUnit (payload: BatchUnit): Promise<BatchUnit> {
  const { data, error } = await supabase
    .from('batch_units')
    .update({ name: payload.name, unit: payload.unit })
    .eq('id', payload.id)
    .select()
    .single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to update batch unit: returned null')
  }
  return data as BatchUnit
}

export async function deleteBatchUnit (id: number): Promise<void> {
  const { error } = await supabase.from('batch_units').delete().eq('id', id)
  handleDeleteError(error, 'This batch unit is still used by one or more products.')
}

// Suppliers (Configuration > Supplier) — back-office master data, writable
// admin/manager-only, unlike customers below (checkout can quick-add a
// customer; only Purchase/Configuration touches suppliers).
export async function getSuppliers (): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select().order('name')
  handleError(error)
  return (data ?? []) as Supplier[]
}

export async function createSupplier (
  input: Pick<Supplier, 'name' | 'phone' | 'email'>,
): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').insert([input]).select().single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to create supplier: returned null')
  }
  return data as Supplier
}

export async function updateSupplier (payload: Supplier): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ name: payload.name, phone: payload.phone, email: payload.email })
    .eq('id', payload.id)
    .select()
    .single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to update supplier: returned null')
  }
  return data as Supplier
}

export async function deleteSupplier (id: number): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  handleDeleteError(error, 'This supplier is still used by one or more purchases.')
}

// Customers — readable/insertable by any authenticated user (salespeople
// search/quick-add one at checkout, not just admins).
export async function getCustomers (): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers').select().order('name')
  handleError(error)
  return (data ?? []) as Customer[]
}

export async function createCustomer (
  input: Pick<Customer, 'name' | 'phone' | 'email'>,
): Promise<Customer> {
  const { data, error } = await supabase.from('customers').insert([input]).select().single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to create customer: returned null')
  }
  return data as Customer
}

// Products (active and inactive) with stock for the given branch. Excludes
// soft-deleted products — use getInventoryProducts() to see those.
export async function getProducts (branchId: number): Promise<Product[]> {
  const [
    { data: products, error: prodError },
    { data: categories, error: catError },
    { data: batchUnits, error: batchUnitError },
    { data: suppliers, error: supplierError },
    { data: stocks, error: stockError },
  ] = await Promise.all([
    supabase.from('products').select().is('deletedAt', null),
    supabase.from('categories').select(),
    supabase.from('batch_units').select(),
    supabase.from('suppliers').select(),
    supabase.from('branch_stock').select().eq('branchId', branchId),
  ])
  handleError(prodError)
  handleError(catError)
  handleError(batchUnitError)
  handleError(supplierError)
  handleError(stockError)
  const categoryMap = new Map<number, string>()
  if (categories) {
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.name)
    }
  }
  const batchUnitMap = new Map<number, BatchUnit>()
  if (batchUnits) {
    for (const bu of batchUnits) {
      batchUnitMap.set(bu.id, bu)
    }
  }
  const supplierMap = new Map<number, string>()
  if (suppliers) {
    for (const supplier of suppliers) {
      supplierMap.set(supplier.id, supplier.name)
    }
  }
  const stockMap = new Map<number, number>()
  if (stocks) {
    for (const row of stocks) {
      stockMap.set(row.productId, row.stock)
    }
  }
  return (products as Product[]).map(p => ({
    ...p,
    categoryName: categoryMap.get(p.categoryId) ?? '',
    batchUnitName: batchUnitMap.get(p.batchUnitId)?.name,
    supplierName: p.supplierId ? supplierMap.get(p.supplierId) : undefined,
    stock: stockMap.get(p.id) ?? 0,
  }))
}

// Inventory – returns all products with category name and per-branch stock
export async function getInventoryProducts (): Promise<InventoryProduct[]> {
  const [
    { data: products, error: prodError },
    { data: categories, error: catError },
    { data: batchUnits, error: batchUnitError },
    { data: suppliers, error: supplierError },
    { data: stocks, error: stockError },
  ] = await Promise.all([
    supabase.from('products').select(),
    supabase.from('categories').select(),
    supabase.from('batch_units').select(),
    supabase.from('suppliers').select(),
    supabase.from('branch_stock').select(),
  ])
  handleError(prodError)
  handleError(catError)
  handleError(batchUnitError)
  handleError(supplierError)
  handleError(stockError)
  const categoryMap = new Map<number, string>()
  if (categories) {
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.name)
    }
  }
  const batchUnitMap = new Map<number, BatchUnit>()
  if (batchUnits) {
    for (const bu of batchUnits) {
      batchUnitMap.set(bu.id, bu)
    }
  }
  const supplierMap = new Map<number, string>()
  if (suppliers) {
    for (const supplier of suppliers) {
      supplierMap.set(supplier.id, supplier.name)
    }
  }
  const stockByProduct = new Map<number, Record<number, number>>()
  if (stocks) {
    for (const row of stocks) {
      const stockEntry = stockByProduct.get(row.productId) ?? {}
      stockEntry[row.branchId] = row.stock
      stockByProduct.set(row.productId, stockEntry)
    }
  }
  return (products as Product[]).map(p => ({
    ...p,
    categoryName: categoryMap.get(p.categoryId) ?? '',
    batchUnitName: batchUnitMap.get(p.batchUnitId)?.name,
    supplierName: p.supplierId ? supplierMap.get(p.supplierId) : undefined,
    stock: 0,
    stockByBranch: stockByProduct.get(p.id) ?? {},
  }))
}

async function saveBranchStock (productId: number, stocks: BranchStockInput[]) {
  if (stocks.length === 0) {
    return
  }
  await saveBranchStockBulk(stocks.map(s => ({ productId, ...s })))
}

// Bulk variant used by the Excel import path (useInventoryExcel.ts) to
// collapse what would otherwise be one upsert per product into a single
// request for the whole import.
export async function saveBranchStockBulk (
  rows: Array<{ productId: number, branchId: number, stock: number }>,
): Promise<void> {
  if (rows.length === 0) {
    return
  }
  const { error } = await supabase.from('branch_stock').upsert(rows)
  handleError(error)
}

// Storage bucket that holds product photos (must exist as a public bucket
// in the Supabase project)
const PRODUCT_IMAGE_BUCKET = 'product-images'

// Uploads a product photo and returns its public URL
export async function uploadProductImage (file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  handleError(error)

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Product-row-only writes, with no branch_stock side effect — used by the
// Excel bulk import path (useInventoryExcel.ts), which batches every row's
// stock into one saveBranchStockBulk() call after the whole import finishes
// instead of one upsert per row. createProductInventory/updateProductInventory
// below (the single-product-edit path) build on these plus a per-call
// saveBranchStock().
export async function createProduct (payload: ProductInventoryPayload): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([payload])
    .select()
    .single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to create product: returned null')
  }
  return data as Product
}

export async function updateProduct (payload: ProductInventoryPayload & { id: number }): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', payload.id)
    .select()
    .single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to update product: returned null')
  }
  return data as Product
}

// Create/Update product inventory payload (excluding id and categoryName)
export async function createProductInventory (
  payload: ProductInventoryPayload,
  stocks: BranchStockInput[],
): Promise<Product> {
  const product = await createProduct(payload)
  await saveBranchStock(product.id, stocks)
  return product
}

export async function updateProductInventory (
  payload: ProductInventoryPayload & { id: number },
  stocks: BranchStockInput[],
): Promise<Product> {
  const product = await updateProduct(payload)
  await saveBranchStock(payload.id, stocks)
  return product
}

// Soft-deletes a product from the whole catalog (every branch at once —
// there's no more per-branch/channel visibility toggle now that retail vs
// wholesale selling doesn't exist). Keeps its branch_stock rows intact so a
// Restore doesn't lose stock history.
export async function deleteProductInventory (id: number): Promise<void> {
  const { data, error } = await supabase
    .from('products')
    .update({ deletedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
  handleError(error)
  if (!data || data.length === 0) {
    throw new Error(
      'Product was not deleted — no matching row was updated (check update permissions/RLS policy on "products").',
    )
  }
}

// Un-deletes a product previously soft-deleted via deleteProductInventory
// (or a pre-existing legacy row already in that state).
export async function restoreProductInventory (id: number): Promise<void> {
  const { data, error } = await supabase
    .from('products')
    .update({ deletedAt: null })
    .eq('id', id)
    .select()
  handleError(error)
  if (!data || data.length === 0) {
    throw new Error(
      'Product was not restored — no matching row was updated (check update permissions/RLS policy on "products").',
    )
  }
}

// Sales — from/to (ISO date strings) scope the query to a date range, so
// history/report pages don't have to pull every sale ever recorded just to
// show a day/week/month. Omit both for the full (unbounded) history.
export async function getSales (range: { from?: string, to?: string } = {}): Promise<Sale[]> {
  let query = supabase.from('sales').select()
  if (range.from) {
    query = query.gte('date', range.from)
  }
  if (range.to) {
    query = query.lte('date', range.to)
  }
  const { data, error } = await query.order('date', { ascending: false })
  handleError(error)
  return (data ?? []) as Sale[]
}

export async function addSale (sale: Sale): Promise<void> {
  // branchName/cashierEmail/customerName are client-side joins, not sales columns
  const {
    branchName: _branchName,
    cashierEmail: _cashierEmail,
    customerName: _customerName,
    ...row
  } = sale
  const { error } = await supabase.from('sales').insert([row])
  handleError(error)
}

export async function updateSaleStatus (saleId: string, status: SaleStatus): Promise<void> {
  const { error } = await supabase.from('sales').update({ status }).eq('id', saleId)
  handleError(error)
}

// Refunds/voids — admin-only (RLS)
export async function getRefundsForSale (saleId: string): Promise<Refund[]> {
  const { data, error } = await supabase.from('refunds').select().eq('saleId', saleId)
  handleError(error)
  return (data ?? []) as Refund[]
}

// All refunds, for folding refund totals into P&L reporting. saleIds scopes
// this to refunds against a known set of sales (e.g. the currently
// date-filtered ones) instead of pulling every refund ever recorded — a
// refund is matched to its sale by id regardless of when the refund itself
// happened, so this stays correct even if the refund post-dates the range.
export async function getAllRefunds (saleIds?: string[]): Promise<Refund[]> {
  let query = supabase.from('refunds').select()
  if (saleIds) {
    if (saleIds.length === 0) {
      return []
    }
    query = query.in('saleId', saleIds)
  }
  const { data, error } = await query
  handleError(error)
  return (data ?? []) as Refund[]
}

export async function addRefund (refund: Refund): Promise<void> {
  const { error } = await supabase.from('refunds').insert([refund])
  handleError(error)
}

// Atomically restores per-branch stock after a refund/void (mirrors
// decrementBranchStock; same security-definer RPC trust model).
export async function incrementBranchStock (
  branchId: number,
  items: Array<{ productId: number, quantity: number }>,
): Promise<void> {
  const { error } = await supabase.rpc('increment_branch_stock', {
    p_branch_id: branchId,
    p_items: items,
  })
  handleError(error)
}

// Purchases — stock-receiving events, admin/manager-only (RLS). Header row
// + jsonb items array, same shape as sales/refunds — no child table.
export async function getPurchases (range: { from?: string, to?: string } = {}): Promise<Purchase[]> {
  let query = supabase.from('purchases').select()
  if (range.from) {
    query = query.gte('date', range.from)
  }
  if (range.to) {
    query = query.lte('date', range.to)
  }
  const { data, error } = await query.order('date', { ascending: false })
  handleError(error)
  return (data ?? []) as Purchase[]
}

export async function addPurchase (purchase: Purchase): Promise<void> {
  // branchName/supplierName/createdByEmail/voidedByEmail are client-side
  // joins, not purchases columns
  const {
    branchName: _branchName,
    supplierName: _supplierName,
    createdByEmail: _createdByEmail,
    voidedByEmail: _voidedByEmail,
    ...row
  } = purchase
  const { error } = await supabase.from('purchases').insert([row])
  handleError(error)
}

export async function updatePurchaseStatus (
  purchaseId: string,
  status: PurchaseStatus,
  voidedBy?: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'voided') {
    patch.voidedAt = new Date().toISOString()
    patch.voidedBy = voidedBy ?? null
  }
  const { error } = await supabase.from('purchases').update(patch).eq('id', purchaseId)
  handleError(error)
}

// Atomically bumps branch_stock.stock and overwrites branch_stock.cost for
// every line of a purchase, returning each line's cost *before* this update
// (previousCost) so the caller can snapshot it into the purchase's items
// for a later void to restore exactly.
export async function receivePurchaseStock (
  branchId: number,
  items: Array<{ productId: number, quantity: number, unitCost: number }>,
): Promise<Array<{ productId: number, quantity: number, unitCost: number, previousCost: number | null }>> {
  const { data, error } = await supabase.rpc('receive_purchase_stock', {
    p_branch_id: branchId,
    p_items: items,
  })
  handleError(error)
  return (data ?? []) as Array<{ productId: number, quantity: number, unitCost: number, previousCost: number | null }>
}

// Reverses a voided purchase's stock/cost effects (mirrors
// incrementBranchStock's shape). See the void-ordering tradeoff noted on
// PurchaseItem/usePurchases.ts — cost restoration isn't order-independent.
export async function voidPurchaseStock (
  branchId: number,
  items: Array<{ productId: number, quantity: number, previousCost: number | null }>,
): Promise<void> {
  const { error } = await supabase.rpc('void_purchase_stock', {
    p_branch_id: branchId,
    p_items: items,
  })
  handleError(error)
}

// Currency settings — readable by any authenticated user (POS/Cart need the
// rate to show dual pricing), writable by admins only (RLS).
export async function getCurrencySettings (): Promise<CurrencySettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', CURRENCY_SETTINGS_KEY)
    .maybeSingle()
  handleError(error)
  return (data?.value as CurrencySettings) ?? null
}

export async function updateCurrencySettings (settings: CurrencySettings): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: CURRENCY_SETTINGS_KEY, value: settings })
  handleError(error)
}

// Loyalty program settings — same read/write breadth as currency settings.
export async function getLoyaltySettings (): Promise<LoyaltySettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', LOYALTY_SETTINGS_KEY)
    .maybeSingle()
  handleError(error)
  return (data?.value as LoyaltySettings) ?? null
}

export async function updateLoyaltySettings (settings: LoyaltySettings): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: LOYALTY_SETTINGS_KEY, value: settings })
  handleError(error)
}

// Atomically applies a signed points delta to a customer's balance (earn is
// positive, redeem is negative) and returns the resulting balance. Backed by
// a SECURITY DEFINER RPC that clamps at 0, same trust/race model as
// decrement/incrementBranchStock.
export async function adjustLoyaltyPoints (customerId: number, delta: number): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_loyalty_points', {
    p_customer_id: customerId,
    p_delta: delta,
  })
  handleError(error)
  return data as number
}

export async function addLoyaltyTransaction (transaction: LoyaltyTransaction): Promise<void> {
  const { error } = await supabase.from('loyalty_transactions').insert([transaction])
  handleError(error)
}

// Admin/manager-only (RLS) — powers the points ledger on the Customers page.
export async function getLoyaltyTransactionsForCustomer (customerId: number): Promise<LoyaltyTransaction[]> {
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select()
    .eq('customerId', customerId)
    .order('createdAt', { ascending: false })
  handleError(error)
  return (data ?? []) as LoyaltyTransaction[]
}

// Admin-only (RLS): used to join a sale's cashierId to a display email
// in Order History / P&L, since sales only stores the id.
export async function getProfiles (): Promise<AuthProfile[]> {
  const { data, error } = await supabase.from('profiles').select('id, email, role')
  handleError(error)
  return (data ?? []) as AuthProfile[]
}

// Atomically decrement per-branch stock after a sale (security definer RPC,
// callable by any authenticated user; clamps at 0)
export async function decrementBranchStock (
  branchId: number,
  items: Array<{ productId: number, quantity: number }>,
): Promise<void> {
  const { error } = await supabase.rpc('decrement_branch_stock', {
    p_branch_id: branchId,
    p_items: items,
  })
  handleError(error)
}
