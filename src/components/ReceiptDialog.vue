<template>
  <v-dialog v-model="dialogModel" max-width="560" persistent>
    <v-card v-if="sale" rounded="lg">
      <v-card-title class="receipt-title">
        <span>Payment Receipt</span>
        <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
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
                {{ item.quantity }}{{ item.uom === 'batch' ? ` ${item.batchUnit ?? 'batch'}` : '' }}
                <div v-if="item.uom === 'batch' && item.batchSize" class="text-caption text-medium-emphasis">
                  × {{ item.batchSize }} units
                </div>
              </td>

              <td class="price-mono text-right">
                {{ formatCurrency(item.quantity * item.unitPrice) }}
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

        <v-chip class="mt-4" color="success" variant="tonal">
          Paid by {{ sale.paymentMethod }}
        </v-chip>
      </v-card-text>

      <v-card-actions>
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
  import { formatCurrency } from '@/utils/currency'

  defineProps<{
    sale: Sale | null
  }>()

  const dialogModel = defineModel<boolean>({ required: true })

  function closeDialog () {
    dialogModel.value = false
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
</style>
