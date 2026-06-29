import type { CartItem, PaymentMethod, Product, Sale } from '@/types/pos'
import { computed, ref, watch } from 'vue'
import { getStoredProductStock, setStoredProductStock } from '@/composables/useMockApi'

const cartStorageKey = 'retail-pos-cart'
const completedSalesStorageKey = 'retail-pos-sales'

const cartItems = ref<CartItem[]>(readJsonStorage<CartItem[]>(cartStorageKey, []))

watch(cartItems, value => {
  localStorage.setItem(cartStorageKey, JSON.stringify(value))
}, { deep: true })

function readJsonStorage<T> (key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)

    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function roundMoney (value: number) {
  return Math.round(value * 100) / 100
}

function persistCompletedSale (sale: Sale) {
  const sales = readJsonStorage<Sale[]>(completedSalesStorageKey, [])
  localStorage.setItem(completedSalesStorageKey, JSON.stringify([...sales, sale]))
}

function reduceProductStock () {
  const storedStock = getStoredProductStock()

  for (const item of cartItems.value) {
    storedStock[item.productId] = Math.max(0, (storedStock[item.productId] ?? item.stock) - item.quantity)
  }

  setStoredProductStock(storedStock)
}

export function useCart () {
  const itemCount = computed(() => cartItems.value.reduce((total, item) => total + item.quantity, 0))
  const subtotal = computed(() => roundMoney(
    cartItems.value.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
  ))

  function addToCart (product: Product) {
    if (product.stock <= 0) {
      return { ok: false, message: `${product.name} is out of stock.` }
    }

    const existingItem = cartItems.value.find(item => item.productId === product.id)

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        return { ok: false, message: `Only ${product.stock} ${product.name} available in stock.` }
      }

      existingItem.quantity += 1
      existingItem.stock = product.stock

      return { ok: true, message: `${product.name} quantity updated.` }
    }

    cartItems.value.push({
      productId: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      categoryName: product.categoryName ?? 'Uncategorized',
      image: product.image,
      quantity: 1,
      unitPrice: product.price,
      stock: product.stock,
    })

    return { ok: true, message: `${product.name} added to cart.` }
  }

  function increaseQuantity (productId: number) {
    const item = cartItems.value.find(cartItem => cartItem.productId === productId)

    if (!item) {
      return { ok: false, message: 'Item not found in cart.' }
    }

    if (item.quantity >= item.stock) {
      return { ok: false, message: `Only ${item.stock} ${item.name} available in stock.` }
    }

    item.quantity += 1

    return { ok: true, message: `${item.name} quantity updated.` }
  }

  function decreaseQuantity (productId: number) {
    const item = cartItems.value.find(cartItem => cartItem.productId === productId)

    if (!item) {
      return
    }

    if (item.quantity <= 1) {
      removeItem(productId)
      return
    }

    item.quantity -= 1
  }

  function removeItem (productId: number) {
    cartItems.value = cartItems.value.filter(item => item.productId !== productId)
  }

  function clearCart () {
    cartItems.value = []
  }

  function checkout (discount: number, tax: number, paymentMethod: PaymentMethod) {
    if (cartItems.value.length === 0) {
      return { ok: false, message: 'Cart is empty. Add items before checkout.' }
    }

    const safeDiscount = Math.max(0, discount || 0)
    const safeTax = Math.max(0, tax || 0)
    const saleSubtotal = subtotal.value
    const sale: Sale = {
      id: `SALE-${Date.now()}`,
      date: new Date().toISOString(),
      items: cartItems.value.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal: saleSubtotal,
      discount: roundMoney(safeDiscount),
      tax: roundMoney(safeTax),
      grandTotal: roundMoney(Math.max(0, saleSubtotal - safeDiscount + safeTax)),
      paymentMethod,
    }

    reduceProductStock()
    persistCompletedSale(sale)
    clearCart()

    return { ok: true, message: 'Payment completed successfully.', sale }
  }

  return {
    cartItems,
    itemCount,
    subtotal,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
    checkout,
  }
}
