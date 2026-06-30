import type { CartItem, Category, Product, Sale, User } from '@/types/pos'

async function request<T> (path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error ?? `Unable to load ${path}`)
  }

  return response.json() as Promise<T>
}

async function loadJson<T> (path: string): Promise<T> {
  return request<T>(path)
}

export async function getCategories () {
  return request<Category[]>('/api/categories')
}

export async function getProducts () {
  return request<Product[]>('/api/products')
}

export async function getCart () {
  return request<CartItem[]>('/api/cart')
}

export async function saveCart (items: CartItem[]) {
  await request<{ success: boolean }>('/api/cart', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
}

export async function getSales () {
  return request<Sale[]>('/api/sales')
}

export async function getUsers () {
  return loadJson<User[]>('/data/users.json')
}

export async function addSale (sale: Sale): Promise<void> {
  await request<{ success: boolean }>('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sale),
  })
}
