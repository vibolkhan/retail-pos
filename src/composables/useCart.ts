import type { PaymentMethod, Product, Sale } from '@/types/pos'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useBranchStore } from '@/stores/branch'

export function useCart () {
  const store = useAppStore()
  const branchStore = useBranchStore()

  const cartItems = computed(() => store.cart)

  const itemCount = computed(() =>
    store.cart.reduce((total, item) => total + item.quantity, 0),
  )

  const subtotal = computed(() =>
    roundMoney(
      store.cart.reduce(
        (total, item) => total + item.unitPrice * item.quantity,
        0,
      ),
    ),
  )

  function roundMoney (value: number) {
    return Math.round(value * 100) / 100
  }

  // Wholesale sells by the batch (unit name varies per product, e.g. Case/Box)
  function stockMessage (product: Product) {
    const unit = branchStore.isWholesale ? ` ${product.batchUnit ?? 'batch'}` : ''
    return `Only ${product.stock}${unit} ${product.name} available in stock.`
  }

  function addToCart (product: Product, quantity = 1) {
    const isWholesale = branchStore.isWholesale

    if (isWholesale && (!product.sellableWholesale || !product.batchPrice || !product.batchSize)) {
      return {
        ok: false,
        message: `${product.name} is not available for wholesale.`,
      }
    }

    if (!isWholesale && !product.sellableRetail) {
      return {
        ok: false,
        message: `${product.name} is not available in the retail shop.`,
      }
    }

    if (product.stock <= 0) {
      return { ok: false, message: `${product.name} is out of stock.` }
    }

    const qty = Math.max(1, Math.floor(quantity))
    const existingItem = store.cart.find(item => item.productId === product.id)

    if (existingItem) {
      if (existingItem.quantity + qty > product.stock) {
        return { ok: false, message: stockMessage(product) }
      }
      existingItem.quantity += qty
      existingItem.stock = product.stock
      store.setCart([...store.cart])
      return { ok: true, message: `${product.name} quantity updated.` }
    }

    if (qty > product.stock) {
      return { ok: false, message: stockMessage(product) }
    }

    store.addToCart({
      productId: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      categoryName: product.categoryName ?? 'Uncategorized',
      image: product.image,
      quantity: qty,
      unitPrice: isWholesale ? product.batchPrice! : product.price,
      uom: isWholesale ? 'batch' : 'unit',
      batchUnit: product.batchUnit,
      batchSize: product.batchSize,
      stock: product.stock,
    })

    return { ok: true, message: `${product.name} added to cart.` }
  }

  function increaseQuantity (productId: number) {
    const item = store.cart.find(i => i.productId === productId)
    if (!item) {
      return { ok: false, message: 'Item not found in cart.' }
    }
    if (item.quantity >= item.stock) {
      return {
        ok: false,
        message: `Only ${item.stock} ${item.name} available in stock.`,
      }
    }
    item.quantity += 1
    store.setCart([...store.cart])
    return { ok: true, message: `${item.name} quantity updated.` }
  }

  function decreaseQuantity (productId: number) {
    const item = store.cart.find(i => i.productId === productId)
    if (!item) {
      return
    }
    if (item.quantity <= 1) {
      removeItem(productId)
      return
    }
    item.quantity -= 1
    store.setCart([...store.cart])
  }

  // Direct quantity entry (e.g. "200" cases); clamps to 1..stock
  function setQuantity (productId: number, quantity: number) {
    const item = store.cart.find(i => i.productId === productId)
    if (!item) {
      return { ok: false, message: 'Item not found in cart.' }
    }
    const qty = Math.floor(quantity)
    if (!Number.isFinite(qty) || qty < 1) {
      item.quantity = 1
    } else if (qty > item.stock) {
      item.quantity = item.stock
      store.setCart([...store.cart])
      return {
        ok: false,
        message: `Only ${item.stock} ${item.name} available in stock.`,
      }
    } else {
      item.quantity = qty
    }
    store.setCart([...store.cart])
    return { ok: true, message: `${item.name} quantity updated.` }
  }

  function removeItem (productId: number) {
    store.setCart(store.cart.filter(i => i.productId !== productId))
  }

  function clearCart () {
    store.setCart([])
  }

  async function checkout (
    discount: number,
    tax: number,
    paymentMethod: PaymentMethod,
  ) {
    if (store.cart.length === 0) {
      return { ok: false, message: 'Cart is empty. Add items before checkout.' }
    }
    if (branchStore.activeBranchId == null) {
      return { ok: false, message: 'No branch selected. Choose a branch first.' }
    }

    const safeDiscount = Math.max(0, discount || 0)
    const safeTax = Math.max(0, tax || 0)
    const saleSubtotal = subtotal.value
    const sale: Sale = {
      id: `SALE-${Date.now()}`,
      date: new Date().toISOString(),
      items: store.cart.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        uom: item.uom,
        batchUnit: item.batchUnit,
        batchSize: item.batchSize,
      })),
      subtotal: saleSubtotal,
      discount: roundMoney(safeDiscount),
      tax: roundMoney(safeTax),
      grandTotal: roundMoney(Math.max(0, saleSubtotal - safeDiscount + safeTax)),
      paymentMethod,
      branchId: branchStore.activeBranchId,
    }

    const { addSale, decrementBranchStock } = await import('@/composables/useSupabase')
    try {
      await addSale(sale)
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Payment failed. Please try again.',
      }
    }

    let message = 'Payment completed successfully.'
    try {
      await decrementBranchStock(
        sale.branchId,
        sale.items.map(({ productId, quantity }) => ({ productId, quantity })),
      )
    } catch {
      // The sale is already recorded – never fail the payment on this
      message = 'Payment completed, but stock update failed. Please adjust inventory manually.'
    }
    clearCart()
    return { ok: true, message, sale }
  }

  return {
    cartItems,
    itemCount,
    subtotal,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    setQuantity,
    removeItem,
    clearCart,
    checkout,
  }
}
