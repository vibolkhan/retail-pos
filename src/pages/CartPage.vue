<template>
  <v-container class="py-6 checkout-page" fluid>
    <v-row>
      <!-- Cart Items -->
      <v-col cols="12" lg="8">
        <v-card class="cart-card" rounded="lg" variant="flat">
          <v-empty-state
            v-if="cartItems.length === 0"
            class="py-10"
            color="primary"
            headline="Cart is empty"
            icon="mdi-cart-off"
            text="Add products from the POS page before checkout."
            title="No selected items"
          >
            <template #actions>
              <v-btn color="primary" to="/pos" variant="flat">
                Start Selling
              </v-btn>
            </template>
          </v-empty-state>

          <!-- One table for every viewport — it scrolls horizontally
               on narrow screens instead of branching into a separate
               hand-rolled card list, matching Inventory/Sales History. -->
          <div v-else class="cart-table-wrapper">
            <v-table class="pos-data-table cart-table" density="comfortable" rounded="lg">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="text-center">Quantity</th>
                  <th class="text-right">Unit Price</th>
                  <th class="text-right">Subtotal</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="item in cartItems" :key="item.productId">
                  <td>
                    <div class="d-flex align-center ga-3 py-3">
                      <v-avatar rounded="lg" size="52">
                        <v-img cover :src="item.image" />
                      </v-avatar>

                      <div>
                        <div class="font-weight-bold">{{ item.name }}</div>

                        <div class="text-caption text-medium-emphasis">
                          Code: {{ item.code }}
                        </div>

                        <v-chip
                          class="mt-1"
                          color="primary"
                          size="x-small"
                          variant="tonal"
                        >
                          {{ formatCurrency(item.unitPrice) }} / {{ uomLabel(item) }}
                        </v-chip>
                      </div>
                    </div>
                  </td>

                  <td class="text-center">
                    <div class="quantity-control">
                      <v-btn
                        density="comfortable"
                        :disabled="item.quantity <= 1"
                        icon="mdi-minus"
                        size="small"
                        variant="tonal"
                        @click="decreaseQuantity(item.productId)"
                      />

                      <input
                        class="quantity-input"
                        min="1"
                        type="number"
                        :value="item.quantity"
                        @change="handleSetQuantity(item.productId, $event)"
                      >

                      <v-btn
                        color="primary"
                        density="comfortable"
                        icon="mdi-plus"
                        size="small"
                        variant="tonal"
                        @click="handleIncrease(item.productId)"
                      />
                    </div>
                  </td>

                  <td class="price-mono text-right">
                    {{ formatCurrency(item.unitPrice) }}
                  </td>

                  <td class="price-mono text-right">
                    <strong>
                      {{ formatCurrency(item.unitPrice * item.quantity) }}
                    </strong>
                  </td>

                  <td class="text-right">
                    <v-tooltip text="Remove item">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          color="error"
                          icon="mdi-delete-outline"
                          variant="text"
                          @click="removeItem(item.productId)"
                        />
                      </template>
                    </v-tooltip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card>
      </v-col>

      <!-- Payment Summary -->
      <v-col cols="12" lg="4">
        <v-card class="payment-card" rounded="lg" variant="flat">
          <div class="summary-line">
            <span>Subtotal</span>
            <strong class="price-mono">{{ formatCurrency(subtotal) }}</strong>
          </div>

          <div class="summary-line">
            <span>Discount</span>

            <strong class="price-mono text-error">
              -{{ formatCurrency(safeDiscount) }}
            </strong>
          </div>

          <div class="summary-line">
            <span>Tax</span>
            <strong class="price-mono">{{ formatCurrency(safeTax) }}</strong>
          </div>

          <v-divider class="my-4" />

          <v-row density="comfortable">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="discount"
                density="comfortable"
                hide-details
                label="Discount"
                min="0"
                prefix="$"
                prepend-inner-icon="mdi-tag-minus-outline"
                rounded="lg"
                type="number"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="tax"
                density="comfortable"
                hide-details
                label="Tax"
                min="0"
                prefix="$"
                prepend-inner-icon="mdi-percent-outline"
                rounded="lg"
                type="number"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12">
              <div class="text-caption text-medium-emphasis font-weight-bold mb-2">
                Payment method
              </div>

              <div class="payment-chip-row">
                <v-chip
                  v-for="method in paymentMethods"
                  :key="method"
                  class="font-weight-bold"
                  :color="paymentColor(method)"
                  :variant="paymentMethod === method ? 'flat' : 'outlined'"
                  @click="paymentMethod = method"
                >
                  {{ method }}
                </v-chip>
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <div class="grand-total-box">
            <div>
              <div class="text-caption text-medium-emphasis">Amount to Pay</div>

              <div class="price-mono text-h5 font-weight-bold text-primary">
                {{ formatCurrency(grandTotal) }}
              </div>
            </div>

            <v-icon color="primary" size="34">mdi-cash-check</v-icon>
          </div>

          <div class="d-flex ga-2 mt-5">
            <v-btn
              class="flex-grow-1"
              color="primary"
              :disabled="!hasAdjustments"
              prepend-icon="mdi-refresh"
              variant="tonal"
              @click="resetAdjustments"
            >
              Reset
            </v-btn>

            <v-btn
              class="flex-grow-1"
              color="primary"
              :disabled="!canCheckout"
              :loading="isCheckingOut"
              prepend-icon="mdi-credit-card-check"
              size="large"
              variant="flat"
              @click="confirmCheckout"
            >
              Pay
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <ReceiptDialog v-model="receiptDialog" :sale="completedSale" />

  </v-container>
</template>

<script lang="ts" setup>
  import type { CartItem, PaymentMethod, Sale } from '@/types/pos'
  import { computed, ref } from 'vue'
  import ReceiptDialog from '@/components/ReceiptDialog.vue'
  import { useCart } from '@/composables/useCart'
  import { useToast } from '@/composables/useToast'
  import { formatCurrency } from '@/utils/currency'

  const toast = useToast()

  const paymentMethods: PaymentMethod[] = [
    'Cash',
    'Bank Transfer',
    'QR Payment',
    'Card Payment',
  ]

  const {
    cartItems,
    subtotal,
    increaseQuantity,
    decreaseQuantity,
    setQuantity,
    removeItem,
    checkout,
  } = useCart()

  const discount = ref(0)
  const tax = ref(0)
  const paymentMethod = ref<PaymentMethod>('Cash')
  const receiptDialog = ref(false)
  const isCheckingOut = ref(false)
  const completedSale = ref<Sale | null>(null)

  const safeDiscount = computed(() => Math.max(0, Number(discount.value) || 0))
  const safeTax = computed(() => Math.max(0, Number(tax.value) || 0))

  const totalItems = computed(() =>
    cartItems.value.reduce((total, item) => total + item.quantity, 0),
  )

  const grandTotal = computed(() => {
    return Math.max(0, subtotal.value - safeDiscount.value + safeTax.value)
  })

  const hasAdjustments = computed(() => {
    return (
      safeDiscount.value > 0
      || safeTax.value > 0
      || paymentMethod.value !== 'Cash'
    )
  })

  const canCheckout = computed(() => {
    return cartItems.value.length > 0 && !isCheckingOut.value
  })

  function handleIncrease (productId: number) {
    const result = increaseQuantity(productId)

    toast.show(result.message, result.ok ? 'success' : 'warning')
  }

  function uomLabel (item: CartItem) {
    return item.uom === 'batch' ? (item.batchUnit ?? 'batch') : 'item'
  }

  function handleSetQuantity (productId: number, event: Event) {
    const input = event.target as HTMLInputElement
    const result = setQuantity(productId, Number(input.value))

    if (result && !result.ok) {
      toast.show(result.message, 'warning')
    }
    // Reflect clamping even when reactivity didn't change the rendered value
    const item = cartItems.value.find(i => i.productId === productId)
    if (item) input.value = String(item.quantity)
  }

  function resetAdjustments () {
    discount.value = 0
    tax.value = 0
    paymentMethod.value = 'Cash'
  }

  function paymentColor (method: PaymentMethod) {
    if (method === 'Cash') return 'success'
    if (method === 'Bank Transfer') return 'info'
    if (method === 'QR Payment') return 'primary'
    if (method === 'Card Payment') return 'deep-purple'

    return 'grey'
  }

  async function confirmCheckout () {
    if (!canCheckout.value) return

    isCheckingOut.value = true

    try {
      const result = await checkout(
        safeDiscount.value,
        safeTax.value,
        paymentMethod.value,
      )

      if (!result.ok) {
        toast.show(result.message, 'error')
        return
      }

      completedSale.value = result.sale ?? null
      receiptDialog.value = true
      resetAdjustments()
      toast.show(result.message, 'success')
    } finally {
      isCheckingOut.value = false
    }
  }
</script>

<style scoped>
.checkout-page {
  background: rgb(var(--v-theme-background));
  min-height: 100vh;
}

.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.payment-chip-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-card {
  padding: 18px;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  background: rgb(var(--v-theme-surface));
}

.total-card {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.08),
    rgb(var(--v-theme-surface))
  );
}

.cart-card,
.payment-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.payment-card {
  padding: 20px;
  position: sticky;
  top: 90px;
}

.cart-table-wrapper {
  position: relative;
  overflow-x: auto;
}

/* On narrow screens the table (Product/Quantity/Price/Subtotal/Action)
   is wider than the viewport and scrolls horizontally inside Vuetify's own
   .v-table__wrapper — this fade is the only hint that more columns (price,
   remove) are reachable by swiping, since nothing else here suggests it. */
@media (max-width: 840px) {
  .cart-table-wrapper::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 28px;
    background: linear-gradient(to right, transparent, rgb(var(--v-theme-surface)));
    pointer-events: none;
  }
}

.cart-table :deep(th) {
  white-space: nowrap;
}

.quantity-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgb(var(--v-theme-surface-variant));
  padding: 6px;
  border-radius: 999px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.quantity-input {
  width: 56px;
  text-align: center;
  font-weight: 700;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border: none;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.quantity-input::-webkit-outer-spin-button,
.quantity-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.grand-total-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px;
  border-radius: 18px;
  background: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
}

@media (max-width: 1280px) {
  .payment-card {
    position: static;
  }
}

@media (max-width: 600px) {
  .summary-card {
    padding: 16px;
  }

  .payment-card {
    padding: 16px;
  }

  .cart-table :deep(th),
  .cart-table :deep(td) {
    white-space: nowrap;
  }
}
</style>
