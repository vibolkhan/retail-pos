import type { Category, Product, Sale, User } from '@/types/pos'

const stockStorageKey = 'retail-pos-product-stock'
const completedSalesStorageKey = 'retail-pos-sales'

async function loadJson<T> (path: string): Promise<T> {
  const response = await fetch(path)

  if (!response.ok) {
    throw new Error(`Unable to load ${path}`)
  }

  return response.json() as Promise<T>
}

function readJsonStorage<T> (key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)

    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

export function getStoredProductStock () {
  return readJsonStorage<Record<number, number>>(stockStorageKey, {})
}

export function setStoredProductStock (stock: Record<number, number>) {
  localStorage.setItem(stockStorageKey, JSON.stringify(stock))
}

export async function getCategories () {
  return loadJson<Category[]>('/data/categories.json')
}

export async function getProducts () {
  const [products, categories] = await Promise.all([
    loadJson<Product[]>('/data/products.json'),
    getCategories(),
  ])
  const categoryMap = new Map(categories.map(category => [category.id, category.name]))
  const stockOverrides = getStoredProductStock()

  return products.map(product => ({
    ...product,
    categoryName: categoryMap.get(product.categoryId) ?? 'Uncategorized',
    stock: stockOverrides[product.id] ?? product.stock,
  }))
}

export async function getSales () {
  const mockSales = await loadJson<Sale[]>('/data/sales.json')
  const completedSales = readJsonStorage<Sale[]>(completedSalesStorageKey, [])

  return [...mockSales, ...completedSales]
}

export async function getUsers () {
  return loadJson<User[]>('/data/users.json')
}
