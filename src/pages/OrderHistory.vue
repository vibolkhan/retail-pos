<template>
  <v-container class="py-6" fluid>
    <v-row align="center" class="mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold mb-2">Sales History</h1>
      </v-col>
    </v-row>

    <v-data-table
      class="elevation-1"
      :headers="headers"
      :items="sales"
      :items-per-page="10"
    >
      <template #item.items="{ item }">
        <div>
          <v-chip
            v-for="orderItem in item.items"
            :key="orderItem.productId"
            class="ma-1"
            color="primary"
            size="small"
            variant="tonal"
          >
            {{ orderItem.quantity }} x {{ orderItem.name }}
          </v-chip>
        </div>
      </template>

      <template #item.subtotal="{ item }">
        {{ formatCurrency(item.subtotal) }}
      </template>

      <template #item.discount="{ item }">
        -{{ formatCurrency(item.discount) }}
      </template>

      <template #item.tax="{ item }">
        {{ formatCurrency(item.tax) }}
      </template>

      <template #item.grandTotal="{ item }">
        <strong class="text-primary">{{ formatCurrency(item.grandTotal) }}</strong>
      </template>

      <template #no-data>
        <v-alert type="info" variant="tonal">No sales have been recorded yet.</v-alert>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts" setup>
  import type { Sale } from '@/types/pos'
  import { onMounted, ref } from 'vue'
  import { getSales } from '@/composables/useMockApi'
  import { formatCurrency } from '@/utils/currency'

  const sales = ref<Sale[]>([])

  const headers = [
    { title: 'Sale ID', value: 'id', sortable: true },
    { title: 'Date', value: 'date', sortable: true },
    { title: 'Items', value: 'items', sortable: false },
    { title: 'Subtotal', value: 'subtotal', sortable: true },
    { title: 'Discount', value: 'discount', sortable: true },
    { title: 'Tax', value: 'tax', sortable: true },
    { title: 'Total', value: 'grandTotal', sortable: true },
    { title: 'Payment', value: 'paymentMethod', sortable: true },
  ]

  onMounted(async () => {
    sales.value = await getSales()
  })
</script>

<style scoped>
/* Ensure table adapts on mobile */
@media (max-width: 600px) {
  .v-data-table .v-data-table__wrapper {
    overflow-x: auto;
  }
}
</style>
