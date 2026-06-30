<template>
  <v-container class="py-6 checkout-page" fluid>
    <v-row>
      <!-- Cart Items -->
      <v-col cols="12" lg="8">
        <v-card class="cart-card" rounded="xl" variant="flat">
          <v-empty-state
            v-if="cartItems.length === 0"
            class="py-10"
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

          <div v-else class="cart-table-wrapper">
            <v-table class="cart-table">
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
                          {{ formatCurrency(item.unitPrice) }} / item
                        </v-chip>
                      </div>
                    </div>
                  </td>

                  <td class="text-center">
                    <div class="quantity-control">
                      <v-btn
                        density="comfortable"
                        icon="mdi-minus"
                        size="small"
                        variant="tonal"
                        :disabled="item.quantity <= 1"
                        @click="decreaseQuantity(item.productId)"
                      />

                      <span class="quantity-value">
                        {{ item.quantity }}
                      </span>

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

                  <td class="text-right">
                    {{ formatCurrency(item.unitPrice) }}
                  </td>

                  <td class="text-right">
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
        <v-card class="payment-card" rounded="xl" variant="flat">
          <div class="summary-line">
            <span>Subtotal</span>
            <strong>{{ formatCurrency(subtotal) }}</strong>
          </div>

          <div class="summary-line">
            <span>Discount</span>
            <strong class="text-error">
              -{{ formatCurrency(safeDiscount) }}
            </strong>
          </div>

          <div class="summary-line">
            <span>Tax</span>
            <strong>{{ formatCurrency(safeTax) }}</strong>
          </div>

          <v-divider class="my-4" />

          <v-row dense>
            <v-col cols="12" sm="6" lg="12">
              <v-text-field
                v-model.number="discount"
                density="comfortable"
                label="Discount"
                min="0"
                prefix="$"
                type="number"
                variant="outlined"
                rounded="lg"
                hide-details
                prepend-inner-icon="mdi-tag-minus-outline"
              />
            </v-col>

            <v-col cols="12" sm="6" lg="12">
              <v-text-field
                v-model.number="tax"
                density="comfortable"
                label="Tax"
                min="0"
                prefix="$"
                type="number"
                variant="outlined"
                rounded="lg"
                hide-details
                prepend-inner-icon="mdi-percent-outline"
              />
            </v-col>

            <v-col cols="12">
              <v-select
                v-model="paymentMethod"
                density="comfortable"
                :items="paymentMethods"
                label="Payment Method"
                variant="outlined"
                rounded="lg"
                hide-details
                prepend-inner-icon="mdi-credit-card-outline"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <div class="grand-total-box">
            <div>
              <div class="text-caption text-medium-emphasis">Amount to Pay</div>
              <div class="text-h5 font-weight-bold text-primary">
                {{ formatCurrency(grandTotal) }}
              </div>
            </div>

            <v-icon color="primary" size="34">mdi-cash-check</v-icon>
          </div>

          <div class="d-flex ga-2 mt-5">
            <v-btn
              class="flex-grow-1"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-refresh"
              :disabled="!hasAdjustments"
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

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
import type { PaymentMethod, Sale } from "@/types/pos";
import { computed, reactive, ref } from "vue";
import ReceiptDialog from "@/components/ReceiptDialog.vue";
import { useCart } from "@/composables/useCart";
import { formatCurrency } from "@/utils/currency";

const paymentMethods: PaymentMethod[] = [
  "Cash",
  "Bank Transfer",
  "QR Payment",
  "Card Payment",
];

const {
  cartItems,
  subtotal,
  increaseQuantity,
  decreaseQuantity,
  removeItem,
  checkout,
} = useCart();

const discount = ref(0);
const tax = ref(0);
const paymentMethod = ref<PaymentMethod>("Cash");
const receiptDialog = ref(false);
const isCheckingOut = ref(false);
const completedSale = ref<Sale | null>(null);

const snackbar = reactive({
  show: false,
  message: "",
  color: "success",
});

const safeDiscount = computed(() => Math.max(0, Number(discount.value) || 0));
const safeTax = computed(() => Math.max(0, Number(tax.value) || 0));

const totalItems = computed(() =>
  cartItems.value.reduce((total, item) => total + item.quantity, 0),
);

const grandTotal = computed(() => {
  return Math.max(0, subtotal.value - safeDiscount.value + safeTax.value);
});

const hasAdjustments = computed(() => {
  return (
    safeDiscount.value > 0 ||
    safeTax.value > 0 ||
    paymentMethod.value !== "Cash"
  );
});

const canCheckout = computed(() => {
  return cartItems.value.length > 0 && !isCheckingOut.value;
});

function showMessage(message: string, color = "success") {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

function handleIncrease(productId: number) {
  const result = increaseQuantity(productId);

  showMessage(result.message, result.ok ? "success" : "warning");
}

function resetAdjustments() {
  discount.value = 0;
  tax.value = 0;
  paymentMethod.value = "Cash";
}

function paymentColor(method: PaymentMethod) {
  if (method === "Cash") return "success";
  if (method === "Bank Transfer") return "info";
  if (method === "QR Payment") return "primary";
  if (method === "Card Payment") return "deep-purple";

  return "grey";
}

async function confirmCheckout() {
  if (!canCheckout.value) return;

  isCheckingOut.value = true;

  try {
    const result = await checkout(
      safeDiscount.value,
      safeTax.value,
      paymentMethod.value,
    );

    if (!result.ok) {
      showMessage(result.message, "error");
      return;
    }

    completedSale.value = result.sale ?? null;
    receiptDialog.value = true;
    resetAdjustments();
    showMessage(result.message, "success");
  } finally {
    isCheckingOut.value = false;
  }
}
</script>

<style scoped>
.checkout-page {
  background: var(--v-theme-background);
  min-height: 100vh;
}

.summary-card {
  padding: 18px;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  background: var(--v-theme-surface);
}

.total-card {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.08),
    var(--v-theme-surface)
  );
}

.cart-card,
.payment-card {
  background: var(--v-theme-surface);
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.payment-card {
  padding: 20px;
  position: sticky;
  top: 90px;
}

.cart-table-wrapper {
  overflow-x: auto;
}

.cart-table :deep(th) {
  font-weight: 700 !important;
  background: var(--v-theme-surface-variant);
  white-space: nowrap;
}

.cart-table :deep(td) {
  border-bottom: 1px solid var(--v-theme-surface-variant);
}

.quantity-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--v-theme-surface-variant);
  padding: 6px;
  border-radius: 999px;
  border: 1px solid var(--v-theme-surface-variant);
}

.quantity-value {
  min-width: 28px;
  text-align: center;
  font-weight: 700;
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
