import type { CartItem, PaymentMethod, Product, Sale } from '@/types/pos'
import { computed } from 'vue'
import { isFullyResolved, useSalesSyncQueue } from '@/composables/useSalesSyncQueue'
import { useSettings } from '@/composables/useSettings'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useBranchStore } from '@/stores/branch'

export function useCart () {
  const store = useAppStore()
  const branchStore = useBranchStore()
  const authStore = useAuthStore()
  const { state: settingsState } = useSettings()

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

  // Sum of every line's own discount (before the additional order-level
  // discount entered at checkout).
  const lineDiscountTotal = computed(() =>
    roundMoney(store.cart.reduce((total, item) => total + (item.discount ?? 0), 0)),
  )

  function roundMoney (value: number) {
    return Math.round(value * 100) / 100
  }

  // A line's discount can never exceed what that line is currently worth —
  // reclamp whenever quantity changes so a shrunk line can't stay
  // over-discounted.
  function clampLineDiscount (item: CartItem) {
    const lineTotal = item.unitPrice * item.quantity
    item.discount = Math.min(item.discount ?? 0, lineTotal)
  }

  function stockMessage (product: Product) {
    const unit = product.batchUnitName ? ` ${product.batchUnitName}` : ''
    return `Only ${product.stock}${unit} ${product.name} available in stock.`
  }

  function addToCart (product: Product, quantity = 1) {
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
      unitPrice: product.price,
      unitName: product.batchUnitName ?? null,
      stock: product.stock,
      discount: 0,
      costPrice: product.cost,
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
    clampLineDiscount(item)
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
    clampLineDiscount(item)
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
      clampLineDiscount(item)
      store.setCart([...store.cart])
      return {
        ok: false,
        message: `Only ${item.stock} ${item.name} available in stock.`,
      }
    } else {
      item.quantity = qty
    }
    clampLineDiscount(item)
    store.setCart([...store.cart])
    return { ok: true, message: `${item.name} quantity updated.` }
  }

  // Flat discount for this line only; clamped to 0..(unitPrice * quantity)
  function setLineDiscount (productId: number, discount: number) {
    const item = store.cart.find(i => i.productId === productId)
    if (!item) {
      return { ok: false, message: 'Item not found in cart.' }
    }
    const lineTotal = item.unitPrice * item.quantity
    const safe = Number.isFinite(discount) ? discount : 0
    item.discount = roundMoney(Math.max(0, Math.min(safe, lineTotal)))
    store.setCart([...store.cart])
    return { ok: true, message: `${item.name} discount updated.` }
  }

  function removeItem (productId: number) {
    store.setCart(store.cart.filter(i => i.productId !== productId))
  }

  function clearCart () {
    store.setCart([])
  }

  // Currency value of redeeming `points`, given the current loyalty rate
  // (0 when the program is off or no rate is configured).
  function pointsRedemptionValue (points: number) {
    const rate = settingsState.loyalty.redemptionPointsPerCurrency
    if (!settingsState.loyalty.enabled || !rate || points <= 0) {
      return 0
    }
    return roundMoney(points / rate)
  }

  // Most points redeemable without the sale's value going negative, given
  // the order-level discount/tax entered so far. Shared with checkout()'s
  // own clamp so the UI and the actually-applied value never disagree.
  function maxRedeemablePoints (orderDiscount: number, tax: number) {
    const rate = settingsState.loyalty.redemptionPointsPerCurrency
    if (!settingsState.loyalty.enabled || !rate) {
      return 0
    }
    const preRedemptionTotal = Math.max(
      0,
      subtotal.value - lineDiscountTotal.value - Math.max(0, orderDiscount || 0) + Math.max(0, tax || 0),
    )
    return Math.floor(preRedemptionTotal * rate)
  }

  async function checkout (
    discount: number,
    tax: number,
    paymentMethod: PaymentMethod,
    customerId: number | null = null,
    redeemPoints = 0,
  ) {
    if (store.cart.length === 0) {
      return { ok: false, message: 'Cart is empty. Add items before checkout.' }
    }
    if (branchStore.activeBranchId == null) {
      return { ok: false, message: 'No branch selected. Choose a branch first.' }
    }

    const safeOrderDiscount = Math.max(0, discount || 0)
    const safeTax = Math.max(0, tax || 0)
    const saleSubtotal = subtotal.value
    // Points can only be redeemed against a known customer, and never for
    // more than the sale is worth before redemption — reclamped here
    // (not just trusted from the UI) so a stale/malicious value can never
    // debit more points than the discount they actually bought.
    const safeRedeemPoints = customerId == null
      ? 0
      : Math.max(0, Math.min(Math.floor(redeemPoints || 0), maxRedeemablePoints(safeOrderDiscount, safeTax)))
    // The value is folded into discount below alongside line/order
    // discounts so grand total math and existing reporting (P&L) don't
    // need a separate case.
    const redeemValue = pointsRedemptionValue(safeRedeemPoints)
    // Sale.discount is the combined total (order-level + every line's own
    // discount + redeemed points' value) so existing reporting (P&L, Order
    // History) that reads a single discount figure keeps working unchanged;
    // the per-line amounts are still kept on each SaleItem for receipt/audit
    // detail, and pointsRedeemed is kept on the sale for the same reason.
    const totalDiscount = roundMoney(safeOrderDiscount + lineDiscountTotal.value + redeemValue)
    const saleGrandTotal = roundMoney(Math.max(0, saleSubtotal - totalDiscount + safeTax))
    const pointsEarned = customerId != null && settingsState.loyalty.enabled
      ? Math.floor(saleGrandTotal * settingsState.loyalty.pointsPerCurrency)
      : 0
    const sale: Sale = {
      id: `SALE-${Date.now()}`,
      date: new Date().toISOString(),
      items: store.cart.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitName: item.unitName,
        discount: item.discount ?? 0,
        costPrice: item.costPrice,
      })),
      subtotal: saleSubtotal,
      discount: totalDiscount,
      tax: roundMoney(safeTax),
      grandTotal: saleGrandTotal,
      paymentMethod,
      branchId: branchStore.activeBranchId,
      cashierId: authStore.profile?.id ?? null,
      exchangeRate: settingsState.currency.exchangeRate || null,
      customerId,
      pointsEarned: pointsEarned || null,
      pointsRedeemed: safeRedeemPoints || null,
    }

    const loyalty = customerId != null && (safeRedeemPoints > 0 || pointsEarned > 0)
      ? { customerId, redeemPoints: safeRedeemPoints, earnPoints: pointsEarned }
      : null

    // enqueue() persists the sale before any network call — nothing is ever
    // lost even if the tab dies mid-checkout (an improvement over the old
    // behavior, where a transient addSale() failure lost the sale entirely).
    // processQueueEntry() is the exact same function background sync calls
    // later for anything that doesn't finish here.
    const queue = useSalesSyncQueue()
    const entry = queue.enqueue(sale, loyalty)
    await queue.processQueueEntry(entry)

    // Fully synced already (the common online case) — nothing left for a
    // background flush to do, so don't leave it sitting in the queue.
    if (isFullyResolved(entry)) {
      queue.removeEntry(entry)
    }

    if (entry.steps.saleInserted !== 'done') {
      if (entry.status === 'failed') {
        // Genuine failure (bad data/RLS) — nothing was ever recorded, so
        // there's nothing to keep around for a later sync. This is always
        // safe to remove here: this entry was just created above, so if
        // it's already failed, it can only be from the processQueueEntry()
        // call on the previous line, not a background retry of older work.
        queue.removeEntry(entry)
        return {
          ok: false,
          message: entry.lastError ?? 'Payment failed. Please try again.',
        }
      }
      // Offline, or the network dropped right as we tried — the sale is
      // safely queued (its id is already client-generated) and will sync
      // automatically once back online.
      clearCart()
      return {
        ok: true,
        message: 'You appear to be offline — this sale has been recorded and will sync automatically.',
        sale,
        loyaltyBalance: null,
        queued: true,
      }
    }

    let message = 'Payment completed successfully.'
    if (entry.steps.stockDecremented === 'skipped') {
      message = 'Payment completed, but stock update failed. Please adjust inventory manually.'
    }
    if (entry.steps.redeemLedgerWritten === 'skipped' || entry.steps.earnLedgerWritten === 'skipped') {
      message += ' Loyalty points could not be updated — adjust the customer\'s balance manually.'
    }

    clearCart()
    return {
      ok: true,
      message,
      sale,
      loyaltyBalance: entry.redeemBalanceAfter ?? entry.earnBalanceAfter ?? null,
      queued: !isFullyResolved(entry),
    }
  }

  return {
    cartItems,
    itemCount,
    subtotal,
    lineDiscountTotal,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    setQuantity,
    setLineDiscount,
    removeItem,
    clearCart,
    checkout,
    pointsRedemptionValue,
    maxRedeemablePoints,
  }
}
