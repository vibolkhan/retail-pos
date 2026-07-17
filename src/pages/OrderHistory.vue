<template>
  <v-container class="py-6 sales-page" fluid>
    <!-- Filter Card -->
    <v-card class="date-filter-card mb-6" rounded="lg" variant="flat">
      <div class="filter-header">
        <span class="text-overline text-medium-emphasis">Filters</span>

        <v-btn
          color="primary"
          :disabled="!hasActiveFilters"
          prepend-icon="mdi-filter-remove-outline"
          size="small"
          variant="text"
          @click="clearFilters"
        >
          Clear
        </v-btn>
      </div>

      <v-row align="center" density="comfortable">
        <!-- Search -->
        <v-col cols="12" md="4">
          <v-text-field
            v-model="searchKeyword"
            clearable
            density="comfortable"
            hide-details
            label="Search sale ID, payment, or product"
            prepend-inner-icon="mdi-magnify"
            rounded="lg"
            variant="outlined"
          />
        </v-col>

        <!-- Branch -->
        <v-col cols="12" md="2" sm="6">
          <v-select
            v-model="branchFilter"
            clearable
            density="comfortable"
            hide-details
            item-title="name"
            item-value="id"
            :items="branchStore.branches"
            label="Branch"
            prepend-inner-icon="mdi-store"
            rounded="lg"
            variant="outlined"
          />
        </v-col>

        <!-- Start Date -->
        <v-col cols="12" md="3" sm="6">
          <v-menu
            v-model="startMenu"
            :close-on-content-click="false"
            location="bottom"
            offset="8"
            transition="scale-transition"
          >
            <template #activator="{ props }">
              <v-text-field
                v-model="startDate"
                v-bind="props"
                class="date-input"
                clearable
                density="comfortable"
                hide-details
                label="Start Date"
                placeholder="Select start date"
                prepend-inner-icon="mdi-calendar-start"
                readonly
                rounded="lg"
                variant="outlined"
              />
            </template>

            <v-card elevation="6" rounded="lg">
              <v-date-picker
                v-model="startDate"
                color="primary"
                @update:model-value="startMenu = false"
              />
            </v-card>
          </v-menu>
        </v-col>

        <!-- End Date -->
        <v-col cols="12" md="3" sm="6">
          <v-menu
            v-model="endMenu"
            :close-on-content-click="false"
            location="bottom"
            offset="8"
            transition="scale-transition"
          >
            <template #activator="{ props }">
              <v-text-field
                v-model="endDate"
                v-bind="props"
                class="date-input"
                clearable
                density="comfortable"
                hide-details
                label="End Date"
                placeholder="Select end date"
                prepend-inner-icon="mdi-calendar-end"
                readonly
                rounded="lg"
                variant="outlined"
              />
            </template>

            <v-card elevation="6" rounded="lg">
              <v-date-picker
                v-model="endDate"
                color="primary"
                @update:model-value="endMenu = false"
              />
            </v-card>
          </v-menu>
        </v-col>
      </v-row>
    </v-card>

    <!-- Sales Table -->
    <v-data-table
      class="pos-data-table sales-table"
      density="comfortable"
      elevation="1"
      :headers="headers"
      item-value="id"
      :items="filteredSales"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.id="{ item }">
        <span class="price-mono font-weight-bold text-primary"> #{{ item.id }} </span>
      </template>

      <template #item.date="{ item }">
        <span class="price-mono">{{ formatSaleDate(item.date) }}</span>
      </template>

      <template #item.branchId="{ item }">
        <v-chip
          :color="branchIsWholesale(item.branchId) ? 'wholesale' : 'primary'"
          size="small"
          variant="tonal"
        >
          {{ branchName(item.branchId) }}
        </v-chip>
      </template>

      <template #item.items="{ item }">
        <v-menu location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              color="primary"
              prepend-icon="mdi-information"
              size="small"
              variant="tonal"
            >
              {{ item.items.length }} Items
            </v-btn>
          </template>

          <v-card min-width="260" rounded="lg">
            <v-list density="compact">
              <v-list-subheader>Order Items</v-list-subheader>

              <v-list-item
                v-for="orderItem in item.items"
                :key="orderItem.productId"
              >
                <v-list-item-title>
                  {{ orderItem.quantity }}{{ orderItem.uom === 'batch' ? ' ' + (orderItem.batchUnit ?? 'batch') : '' }} x {{ orderItem.name }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>
      </template>

      <template #item.subtotal="{ item }">
        <span class="price-mono">{{ formatCurrency(item.subtotal) }}</span>
      </template>

      <template #item.discount="{ item }">
        <span class="price-mono text-error"> -{{ formatCurrency(item.discount) }} </span>
      </template>

      <template #item.tax="{ item }">
        <span class="price-mono">{{ formatCurrency(item.tax) }}</span>
      </template>

      <template #item.grandTotal="{ item }">
        <strong class="price-mono text-primary">
          {{ formatCurrency(item.grandTotal) }}
        </strong>
      </template>

      <template #item.paymentMethod="{ item }">
        <v-chip
          :color="paymentColor(item.paymentMethod)"
          size="small"
          variant="tonal"
        >
          {{ item.paymentMethod }}
        </v-chip>
      </template>

      <template #item.invoice="{ item }">
        <v-tooltip text="View invoice">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              color="primary"
              icon="mdi-receipt-text"
              size="small"
              variant="text"
              @click="openInvoice(item)"
            />
          </template>
        </v-tooltip>
      </template>

      <template #no-data>
        <v-empty-state
          class="py-8"
          color="primary"
          headline="No sales found"
          icon="mdi-receipt-text-off"
          text="Try changing your search or date filters."
          title="No sales in this range"
        />
      </template>
    </v-data-table>

    <ReceiptDialog v-model="dialog" :sale="selectedSale" />
  </v-container>
</template>

<script lang="ts" setup>
  import type { Sale } from '@/types/pos'
  import { computed, onMounted, ref } from 'vue'
  import ReceiptDialog from '@/components/ReceiptDialog.vue'
  import { getSales } from '@/composables/useSupabase'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'

  const branchStore = useBranchStore()
  const sales = ref<Sale[]>([])

  const searchKeyword = ref('')
  const branchFilter = ref<number | null>(null)
  const startDate = ref<string | null>(null)
  const endDate = ref<string | null>(null)

  const startMenu = ref(false)
  const endMenu = ref(false)

  const dialog = ref(false)
  const selectedSale = ref<Sale | null>(null)

  const headers = [
    { title: 'Sale ID', value: 'id', sortable: true },
    { title: 'Date', value: 'date', sortable: true },
    { title: 'Branch', value: 'branchId', sortable: true },
    { title: 'Items', value: 'items', sortable: false },
    { title: 'Subtotal', value: 'subtotal', sortable: true },
    { title: 'Discount', value: 'discount', sortable: true },
    { title: 'Tax', value: 'tax', sortable: true },
    { title: 'Total', value: 'grandTotal', sortable: true },
    { title: 'Payment', value: 'paymentMethod', sortable: true },
    { title: 'Invoice', value: 'invoice', sortable: false, align: 'end' },
  ] as const

  const hasActiveFilters = computed(() => {
    return Boolean(
      searchKeyword.value || branchFilter.value || startDate.value || endDate.value,
    )
  })

  const filteredSales = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()

    return sales.value
      .filter(sale => {
        const saleDate = new Date(sale.date)

        if (branchFilter.value && sale.branchId !== branchFilter.value) {
          return false
        }

        if (startDate.value) {
          const start = new Date(startDate.value)
          start.setHours(0, 0, 0, 0)

          if (saleDate < start) return false
        }

        if (endDate.value) {
          const end = new Date(endDate.value)
          end.setHours(23, 59, 59, 999)

          if (saleDate > end) return false
        }

        if (keyword) {
          const searchableValues = [
            String(sale.id),
            sale.paymentMethod,
            ...sale.items.map(item => item.name),
          ]

          const matchesKeyword = searchableValues.some(value =>
            value.toLowerCase().includes(keyword),
          )

          if (!matchesKeyword) return false
        }

        return true
      })
      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })

  function clearFilters () {
    searchKeyword.value = ''
    branchFilter.value = null
    startDate.value = null
    endDate.value = null
  }

  function branchName (branchId: number) {
    return branchStore.branches.find(b => b.id === branchId)?.name ?? '—'
  }

  function branchIsWholesale (branchId: number) {
    return branchStore.branches.find(b => b.id === branchId)?.type === 'wholesale'
  }

  function openInvoice (sale: Sale) {
    selectedSale.value = sale
    dialog.value = true
  }

  function formatSaleDate (date: string) {
    return new Date(date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function paymentColor (paymentMethod: string) {
    const method = paymentMethod.toLowerCase()

    if (method.includes('cash')) return 'success'
    if (method.includes('card')) return 'primary'
    if (method.includes('bank')) return 'info'
    if (method.includes('qr')) return 'primary'

    return 'grey'
  }

  onMounted(async () => {
    const [saleRows] = await Promise.all([getSales(), branchStore.loadBranches()])
    sales.value = saleRows
  })
</script>

<style scoped>
.sales-page {
  background: rgb(var(--v-theme-background));
  min-height: 100vh;
}

.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.date-filter-card {
  padding: 20px;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  background: rgb(var(--v-theme-surface));
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.date-input :deep(.v-field__prepend-inner) {
  color: rgb(var(--v-theme-primary));
}

.sales-table {
  background: rgb(var(--v-theme-surface));
}

@media (max-width: 600px) {
  .sales-table {
    overflow-x: auto;
  }
}
</style>
