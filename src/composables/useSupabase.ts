import type {
  Branch,
  Category,
  Product,
  Sale,
} from '@/types/pos'

// src/composables/useSupabase.ts
import { supabase } from '@/utils/supabase'

// Export payload type for product inventory (excluding id, categoryName and
// stock — stock now lives per branch in branch_stock)
export type ProductInventoryPayload = Omit<Product, 'id' | 'categoryName' | 'stock'>

export interface BranchStockInput {
  branchId: number
  stock: number
}

// Product with stock broken out per branch (for the Inventory page)
export type InventoryProduct = Product & {
  stockByBranch: Record<number, number>
}

// Helper to handle Supabase errors
function handleError (error: any) {
  if (error) {
    throw new Error(error.message ?? 'Supabase request failed')
  }
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

// Products (active and inactive) with stock for the given branch
export async function getProducts (branchId: number): Promise<Product[]> {
  const [
    { data: products, error: prodError },
    { data: categories, error: catError },
    { data: stocks, error: stockError },
  ] = await Promise.all([
    supabase.from('products').select(),
    supabase.from('categories').select(),
    supabase.from('branch_stock').select().eq('branchId', branchId),
  ])
  handleError(prodError)
  handleError(catError)
  handleError(stockError)
  const categoryMap = new Map<number, string>()
  if (categories) {
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.name)
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
    stock: stockMap.get(p.id) ?? 0,
  }))
}

// Inventory – returns all products with category name and per-branch stock
export async function getInventoryProducts (): Promise<InventoryProduct[]> {
  const [
    { data: products, error: prodError },
    { data: categories, error: catError },
    { data: stocks, error: stockError },
  ] = await Promise.all([
    supabase.from('products').select(),
    supabase.from('categories').select(),
    supabase.from('branch_stock').select(),
  ])
  handleError(prodError)
  handleError(catError)
  handleError(stockError)
  const categoryMap = new Map<number, string>()
  if (categories) {
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.name)
    }
  }
  const stockByProduct = new Map<number, Record<number, number>>()
  if (stocks) {
    for (const row of stocks) {
      const entry = stockByProduct.get(row.productId) ?? {}
      entry[row.branchId] = row.stock
      stockByProduct.set(row.productId, entry)
    }
  }
  return (products as Product[]).map(p => ({
    ...p,
    categoryName: categoryMap.get(p.categoryId) ?? '',
    stock: 0,
    stockByBranch: stockByProduct.get(p.id) ?? {},
  }))
}

async function saveBranchStock (productId: number, stocks: BranchStockInput[]) {
  if (stocks.length === 0) {
    return
  }
  const rows = stocks.map(({ branchId, stock }) => ({
    productId,
    branchId,
    stock,
  }))
  const { error } = await supabase.from('branch_stock').upsert(rows)
  handleError(error)
}

// Create/Update product inventory payload (excluding id and categoryName)
export async function createProductInventory (
  payload: ProductInventoryPayload,
  stocks: BranchStockInput[],
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([payload])
    .select()
    .single()
  handleError(error)
  if (!data) {
    throw new Error('Failed to create product: returned null')
  }
  await saveBranchStock(data.id, stocks)
  return data as Product
}

export async function updateProductInventory (
  payload: ProductInventoryPayload & { id: number },
  stocks: BranchStockInput[],
): Promise<Product> {
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
  await saveBranchStock(payload.id, stocks)
  return data as Product
}

// Sales
export async function getSales (): Promise<Sale[]> {
  const { data, error } = await supabase.from('sales').select()
  handleError(error)
  return (data ?? []) as Sale[]
}

export async function addSale (sale: Sale): Promise<void> {
  // branchName is a client-side join, not a sales column
  const { branchName: _branchName, ...row } = sale
  const { error } = await supabase.from('sales').insert([row])
  handleError(error)
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
