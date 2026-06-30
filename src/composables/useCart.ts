import type { CartItem, PaymentMethod, Product, Sale } from '@/types/pos'
import { computed, ref, watch } from 'vue'
import { addSale, getCart, saveCart } from '@/composables/useSupabase'

const cartItems = ref<CartItem[]>([])
const cartLoaded = ref(false)
let isLoadingCart = false
let skipNextSave = false

loadCart()

async function loadCart () {
  if (isLoadingCart || cartLoaded.value) {
    return
  }

  isLoadingCart = true
  try {
    cartItems.value = await getCart()
    skipNextSave = true
    cartLoaded.value = true
  } catch (error) {
    console.error(error)
    cartLoaded.value = true
  } finally {
    isLoadingCart = false
  }
}

watch(cartItems, value => {
  if (!cartLoaded.value) {
    return
  }

  if (skipNextSave) {
    skipNextSave = false
    return
  }

  saveCart(value).catch(error => {
    console.error('Failed to save cart', error)
  })
}, { deep: true })

function roundMoney (value: number) {
  return Math.round(value * 100) / 100
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

  async function checkout (discount: number, tax: number, paymentMethod: PaymentMethod) {
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

    try {
      await addSale(sale)
      skipNextSave = true
      clearCart()

      return { ok: true, message: 'Payment completed successfully.', sale }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Payment failed. Please try again.',
      }
    }
  }

  return {
    cartItems,
    cartLoaded,
    itemCount,
    subtotal,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
    checkout,
    loadCart,
  }
}
