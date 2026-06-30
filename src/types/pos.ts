export interface Category {
  id: number
  name: string
}

export interface Product {
  id: number
  name: string
  code: string
  barcode: string
  categoryId: number
  categoryName?: string
  price: number
  stock: number
  image: string
  isActive: boolean
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
  stock: number
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'QR Payment' | 'Card Payment'

export interface SaleItem {
  productId: number
  name: string
  quantity: number
  unitPrice: number
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
}

export interface User {
  id: number
  name: string
  email: string
  role: string
}
