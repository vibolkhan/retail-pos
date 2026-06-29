<template>
  <v-container class="py-6" fluid>
    <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
      <div>
        <h1 class="text-h4 font-weight-bold mb-1">Cart</h1>

        <p class="text-body-2 text-medium-emphasis mb-0">
          Review items, apply discount and tax, then confirm payment.
        </p>
      </div>

      <v-btn
        color="error"
        :disabled="cartItems.length === 0"
        prepend-icon="mdi-delete-sweep"
        variant="tonal"
        @click="clearCart"
      >
        Clear Cart
      </v-btn>
    </div>

    <v-row>
      <v-col cols="12" lg="8">
        <v-card rounded="lg">
          <v-card-title>Selected Items</v-card-title>
          <v-divider />

          <v-empty-state
            v-if="cartItems.length === 0"
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

          <v-table v-else>
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
              <tr
                v-for="item in cartItems"
                :key="item.productId"
              >
                <td>
                  <div class="d-flex align-center ga-3 py-2">
                    <v-avatar rounded="lg" size="48">
                      <v-img cover :src="item.image" />
                    </v-avatar>

                    <div>
                      <div class="font-weight-medium">{{ item.name }}</div>
                      <div class="text-caption text-medium-emphasis">{{ item.code }}</div>
                    </div>
                  </div>
                </td>

                <td class="text-center">
                  <div class="d-inline-flex align-center ga-1">
                    <v-btn
                      density="comfortable"
                      icon="mdi-minus"
                      size="small"
                      variant="tonal"
                      @click="decreaseQuantity(item.productId)"
                    />

                    <span class="px-2 font-weight-medium">{{ item.quantity }}</span>

                    <v-btn
                      density="comfortable"
                      icon="mdi-plus"
                      size="small"
                      variant="tonal"
                      @click="handleIncrease(item.productId)"
                    />
                  </div>
                </td>

                <td class="text-right">{{ formatCurrency(item.unitPrice) }}</td>
                <td class="text-right">{{ formatCurrency(item.unitPrice * item.quantity) }}</td>

                <td class="text-right">
                  <v-btn
                    color="error"
                    icon="mdi-delete"
                    variant="text"
                    @click="removeItem(item.productId)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card class="pa-4" rounded="lg">
          <v-card-title class="px-0 pt-0">Payment Summary</v-card-title>

          <div class="d-flex justify-space-between mb-3">
            <span>Subtotal</span>
            <strong>{{ formatCurrency(subtotal) }}</strong>
          </div>

          <v-text-field
            v-model.number="discount"
            density="comfortable"
            label="Discount"
            min="0"
            prefix="$"
            type="number"
            variant="outlined"
          />

          <v-text-field
            v-model.number="tax"
            density="comfortable"
            label="Tax"
            min="0"
            prefix="$"
            type="number"
            variant="outlined"
          />

          <v-select
            v-model="paymentMethod"
            density="comfortable"
            :items="paymentMethods"
            label="Payment Method"
            variant="outlined"
          />

          <v-divider class="my-4" />

          <div class="d-flex justify-space-between align-center mb-5">
            <span class="text-h6">Grand Total</span>
            <strong class="text-h5 text-primary">{{ formatCurrency(grandTotal) }}</strong>
          </div>

          <v-btn
            block
            color="primary"
            :disabled="cartItems.length === 0"
            prepend-icon="mdi-credit-card-check"
            size="large"
            variant="flat"
            @click="confirmCheckout"
          >
            Confirm Payment
          </v-btn>
        </v-card>
      </v-col>
    </v-row>

    <ReceiptDialog
      v-model="receiptDialog"
      :sale="completedSale"
    />

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
    >
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
  import type { PaymentMethod, Sale } from '@/types/pos'
  import { computed, reactive, ref } from 'vue'
  import ReceiptDialog from '@/components/ReceiptDialog.vue'
  import { useCart } from '@/composables/useCart'
  import { formatCurrency } from '@/utils/currency'

  const paymentMethods: PaymentMethod[] = ['Cash', 'Bank Transfer', 'QR Payment', 'Card Payment']
  const {
    cartItems,
    subtotal,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
    checkout,
  } = useCart()

  const discount = ref(0)
  const tax = ref(0)
  const paymentMethod = ref<PaymentMethod>('Cash')
  const receiptDialog = ref(false)
  const completedSale = ref<Sale | null>(null)
  const snackbar = reactive({
    show: false,
    message: '',
    color: 'success',
  })

  const grandTotal = computed(() => Math.max(0, subtotal.value - Math.max(0, discount.value || 0) + Math.max(0, tax.value || 0)))

  function showMessage (message: string, color = 'success') {
    snackbar.message = message
    snackbar.color = color
    snackbar.show = true
  }

  function handleIncrease (productId: number) {
    const result = increaseQuantity(productId)

    showMessage(result.message, result.ok ? 'success' : 'warning')
  }

  function confirmCheckout () {
    const result = checkout(discount.value, tax.value, paymentMethod.value)

    if (!result.ok) {
      showMessage(result.message, 'error')
      return
    }

    completedSale.value = result.sale ?? null
    receiptDialog.value = true
    discount.value = 0
    tax.value = 0
    paymentMethod.value = 'Cash'
    showMessage(result.message, 'success')
  }
</script>
