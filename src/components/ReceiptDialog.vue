<template>
  <v-dialog v-model="dialogModel" max-width="560" persistent>
    <v-card v-if="sale" rounded="lg">
      <div class="receipt-print-area">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Payment Receipt</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          <div class="mb-4">
            <div class="text-caption text-medium-emphasis">Sale ID</div>
            <div class="price-mono font-weight-bold">{{ sale.id }}</div>
          </div>

          <div class="mb-4">
            <div class="text-caption text-medium-emphasis">Date</div>
            <div>{{ new Date(sale.date).toLocaleString() }}</div>
          </div>

          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in sale.items" :key="item.productId">
                <td>{{ item.name }}</td>

                <td class="text-center">
                  {{ item.quantity }}{{ legacyUnitLabel(item) ? ` ${legacyUnitLabel(item)}` : '' }}
                </td>

                <td class="price-mono text-right">
                  {{ formatCurrency(item.quantity * item.unitPrice - (item.discount || 0)) }}
                  <div v-if="item.discount" class="text-caption text-error">
                    -{{ formatCurrency(item.discount) }} off
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>

          <v-divider class="my-4" />

          <div class="d-flex justify-space-between mb-2">
            <span>Subtotal</span>
            <strong class="price-mono">{{ formatCurrency(sale.subtotal) }}</strong>
          </div>

          <div class="d-flex justify-space-between mb-2">
            <span>Discount</span>
            <strong class="price-mono text-error">-{{ formatCurrency(sale.discount) }}</strong>
          </div>

          <div class="d-flex justify-space-between mb-2">
            <span>Tax</span>
            <strong class="price-mono">{{ formatCurrency(sale.tax) }}</strong>
          </div>

          <div class="d-flex justify-space-between text-h6">
            <span>Grand Total</span>
            <strong class="price-mono text-primary">{{ formatCurrency(sale.grandTotal) }}</strong>
          </div>

          <div v-if="secondaryTotal" class="d-flex justify-space-between text-caption text-medium-emphasis">
            <span />
            <span class="price-mono">≈ {{ secondaryTotal }}</span>
          </div>

          <v-chip class="mt-4" color="success" variant="tonal">
            Paid by {{ sale.paymentMethod }}
          </v-chip>

          <div v-if="sale.pointsRedeemed || sale.pointsEarned" class="mt-3 text-caption text-medium-emphasis">
            <div v-if="sale.pointsRedeemed">Redeemed {{ sale.pointsRedeemed }} loyalty points</div>
            <div v-if="sale.pointsEarned">Earned {{ sale.pointsEarned }} loyalty points</div>
          </div>
        </v-card-text>
      </div>

      <v-card-actions class="px-6 pb-5 no-print">
        <v-btn prepend-icon="mdi-printer-outline" variant="outlined" @click="printReceipt">
          Print
        </v-btn>

        <v-spacer />

        <v-btn color="primary" variant="flat" @click="closeDialog">
          Done
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
  import type { Sale } from '@/types/pos'
  import { computed } from 'vue'
  import { useSettings } from '@/composables/useSettings'
  import { formatCurrency, formatSecondaryCurrency } from '@/utils/currency'
  import { legacyUnitLabel } from '@/utils/legacyUnit'

  const props = defineProps<{
    sale: Sale | null
  }>()

  const dialogModel = defineModel<boolean>({ required: true })

  const { state: settingsState } = useSettings()

  // Uses the rate stored on the sale itself (captured at checkout), not
  // today's rate, so a receipt never shifts after the fact.
  const secondaryTotal = computed(() =>
    props.sale
      ? formatSecondaryCurrency(
        props.sale.grandTotal,
        settingsState.currency.secondary,
        props.sale.exchangeRate,
      )
      : '',
  )

  function closeDialog () {
    dialogModel.value = false
  }

  function printReceipt () {
    window.print()
  }
</script>
<style>
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Printing the receipt: hide everything else on the page (the app chrome,
   the dialog's own backdrop/buttons) and let only the receipt content flow
   normally, instead of trying to print the app's fixed-position overlay. */
@media print {
  body * {
    visibility: hidden;
  }

  .receipt-print-area,
  .receipt-print-area * {
    visibility: visible;
  }

  .receipt-print-area {
    position: absolute;
    inset: 0;
    padding: 24px;
  }

  .no-print {
    display: none !important;
  }
}
</style>
