<template>
  <v-container class="py-6 sales-page" fluid>
    <v-alert v-if="offlineNotice" class="mb-4" type="info" variant="tonal">
      {{ offlineNotice }}
    </v-alert>

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
                :disabled="!onlineState.isOnline"
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
                :disabled="!onlineState.isOnline"
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
    <v-skeleton-loader
      v-if="loading"
      class="rounded-lg"
      type="table-heading, table-tbody"
    />

    <v-data-table
      v-else
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

      <template #item.cashierId="{ item }">
        {{ cashierEmail(item.cashierId) }}
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

                <v-list-item-subtitle v-if="orderItem.discount">
                  -{{ formatCurrency(orderItem.discount) }} line discount
                </v-list-item-subtitle>
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

        <div v-if="secondaryTotal(item)" class="text-caption text-medium-emphasis price-mono">
          ≈ {{ secondaryTotal(item) }}
        </div>
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

      <template #item.status="{ item }">
        <v-chip
          :color="statusColor(item.status)"
          size="small"
          variant="tonal"
        >
          {{ statusLabel(item.status) }}
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

        <v-tooltip v-if="canRefund(item)" :text="onlineState.isOnline ? 'Refund / Void' : 'Reconnect to refund/void'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              color="error"
              :disabled="!onlineState.isOnline"
              icon="mdi-cash-refund"
              size="small"
              variant="text"
              @click="openRefundDialog(item)"
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

    <v-dialog v-model="refundDialogOpen" max-width="560">
      <v-card v-if="refundSale">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Refund / Void — #{{ refundSale.id }}</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="closeRefundDialog" />
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-alert v-if="refundSale.status !== 'completed'" class="mb-4" type="info" variant="tonal">
            This sale is already {{ statusLabel(refundSale.status).toLowerCase() }}.
            {{ refundSale.status === 'partially_refunded' ? 'You can refund remaining items below.' : '' }}
          </v-alert>

          <div v-for="saleItem in refundSale.items" :key="saleItem.productId" class="d-flex align-center ga-3 mb-3">
            <div class="flex-grow-1">
              <div class="font-weight-medium">{{ saleItem.name }}</div>

              <div class="text-caption text-medium-emphasis">
                Sold {{ saleItem.quantity }} · {{ refundRemaining[saleItem.productId] ?? 0 }} refundable
              </div>
            </div>

            <v-text-field
              v-model.number="refundQuantities[saleItem.productId]"
              density="compact"
              hide-details
              :max="refundRemaining[saleItem.productId] ?? 0"
              min="0"
              style="width: 100px"
              type="number"
              variant="outlined"
            />
          </div>

          <v-text-field
            v-model="refundReason"
            class="mt-2"
            density="comfortable"
            hide-details
            label="Reason"
            variant="outlined"
          />
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-btn
            color="error"
            :disabled="refundSale.status !== 'completed' || !onlineState.isOnline"
            :loading="refundLoading"
            variant="outlined"
            @click="confirmVoidSale"
          >
            Void entire sale
          </v-btn>

          <v-spacer />

          <v-btn variant="text" @click="closeRefundDialog"> Cancel </v-btn>

          <v-btn
            color="primary"
            :disabled="!onlineState.isOnline"
            :loading="refundLoading"
            variant="flat"
            @click="confirmRefundItems"
          >
            Refund selected items
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>
  import type { AuthProfile } from '@/types/auth'
  import type { RefundItem, Sale, SaleStatus } from '@/types/pos'
  import { computed, onMounted, reactive, ref, watch } from 'vue'
  import ReceiptDialog from '@/components/ReceiptDialog.vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { useRefunds } from '@/composables/useRefunds'
  import { useSettings } from '@/composables/useSettings'
  import { getProfiles, getSales } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency, formatSecondaryCurrency } from '@/utils/currency'

  const branchStore = useBranchStore()
  const toast = useToast()
  const { state: settingsState } = useSettings()
  const { state: onlineState } = useOnline()
  const { remainingQuantities, voidSale, refundSaleItems } = useRefunds()
  const loading = ref(true)
  const sales = ref<Sale[]>([])
  const profiles = ref<AuthProfile[]>([])
  const offlineNotice = ref('')

  const searchKeyword = ref('')
  const branchFilter = ref<number | null>(null)
  // Defaults to the last 30 days rather than unbounded — bounds the default
  // getSales() request instead of pulling every sale ever recorded on every
  // visit to this page. "Clear" (below) still allows an explicit, occasional
  // full-history view.
  const startDate = ref<string | null>(defaultRangeStart())
  const endDate = ref<string | null>(new Date().toISOString())

  const startMenu = ref(false)
  const endMenu = ref(false)

  const dialog = ref(false)
  const selectedSale = ref<Sale | null>(null)

  const headers = [
    { title: 'Sale ID', value: 'id', sortable: true },
    { title: 'Date', value: 'date', sortable: true },
    { title: 'Branch', value: 'branchId', sortable: true },
    { title: 'Cashier', value: 'cashierId', sortable: false },
    { title: 'Items', value: 'items', sortable: false },
    { title: 'Subtotal', value: 'subtotal', sortable: true },
    { title: 'Discount', value: 'discount', sortable: true },
    { title: 'Tax', value: 'tax', sortable: true },
    { title: 'Total', value: 'grandTotal', sortable: true },
    { title: 'Payment', value: 'paymentMethod', sortable: true },
    { title: 'Status', value: 'status', sortable: true },
    { title: 'Actions', value: 'invoice', sortable: false, align: 'end' },
  ] as const

  const refundDialogOpen = ref(false)
  const refundSale = ref<Sale | null>(null)
  const refundRemaining = reactive<Record<number, number>>({})
  const refundQuantities = reactive<Record<number, number>>({})
  const refundReason = ref('')
  const refundLoading = ref(false)

  const hasActiveFilters = computed(() => {
    return Boolean(
      searchKeyword.value || branchFilter.value || startDate.value || endDate.value,
    )
  })

  // Date range is applied server-side (loadSales() below) — this only
  // handles branch/keyword, which don't reduce transferred rows enough to
  // be worth a network round trip on every keystroke.
  const filteredSales = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()

    return sales.value
      .filter(sale => {
        if (branchFilter.value && sale.branchId !== branchFilter.value) {
          return false
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

  function defaultRangeStart () {
    const date = new Date()
    date.setDate(date.getDate() - 29)
    return date.toISOString()
  }

  // The from/to actually sent to getSales() — start/end of day so the
  // range is inclusive of both endpoints, matching what the date pickers show.
  function dateRangeParams () {
    const range: { from?: string, to?: string } = {}
    if (startDate.value) {
      const start = new Date(startDate.value)
      start.setHours(0, 0, 0, 0)
      range.from = start.toISOString()
    }
    if (endDate.value) {
      const end = new Date(endDate.value)
      end.setHours(23, 59, 59, 999)
      range.to = end.toISOString()
    }
    return range
  }

  interface SalesRangeCache {
    range: { from?: string, to?: string }
    sales: Sale[]
  }

  async function loadSales () {
    loading.value = true
    try {
      const range = dateRangeParams()
      // Cached as a single "last viewed range" slot (not one per range) along
      // with the range itself, so if this falls back to cache while offline,
      // the banner below can say which range is actually being shown instead
      // of silently pretending the currently-selected picker range was honored.
      const result = await cachedFetch<SalesRangeCache>(
        'sales:lastRange:history',
        async () => ({ range, sales: await getSales(range) }),
        onlineState.isOnline,
      )
      sales.value = result.data.sales
      if (result.fromCache) {
        const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString() : 'the beginning'
        offlineNotice.value = `Offline — showing cached sales from ${fmt(result.data.range.from)} to ${fmt(result.data.range.to)}. Date filters and refunds/voids are disabled until reconnected.`
      } else {
        offlineNotice.value = ''
      }
    } finally {
      loading.value = false
    }
  }

  // Re-queries Supabase with the new bounds — this is what actually avoids
  // downloading unrelated history, not just re-filtering the same full set.
  watch([startDate, endDate], loadSales)

  function clearFilters () {
    searchKeyword.value = ''
    branchFilter.value = null
    // null means "all time" here — an explicit, occasional full-history
    // fetch, not the default.
    startDate.value = null
    endDate.value = null
  }

  function branchName (branchId: number) {
    return branchStore.branches.find(b => b.id === branchId)?.name ?? '—'
  }

  function branchIsWholesale (branchId: number) {
    return branchStore.branches.find(b => b.id === branchId)?.type === 'wholesale'
  }

  function cashierEmail (cashierId?: string | null) {
    if (!cashierId) return '—'
    return profiles.value.find(p => p.id === cashierId)?.email ?? '—'
  }

  // Uses the rate stored on the sale itself, not today's rate, so past
  // sales never shift after the exchange rate is later changed in Settings.
  function secondaryTotal (sale: Sale) {
    return formatSecondaryCurrency(sale.grandTotal, settingsState.currency.secondary, sale.exchangeRate)
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

  function statusLabel (status?: SaleStatus) {
    switch (status) {
      case 'voided': { return 'Voided'
      }
      case 'partially_refunded': { return 'Partially refunded'
      }
      case 'refunded': { return 'Refunded'
      }
      default: { return 'Completed'
      }
    }
  }

  function statusColor (status?: SaleStatus) {
    switch (status) {
      case 'voided': { return 'error'
      }
      case 'partially_refunded': { return 'warning'
      }
      case 'refunded': { return 'grey'
      }
      default: { return 'success'
      }
    }
  }

  function canRefund (sale: Sale) {
    return sale.status !== 'voided' && sale.status !== 'refunded'
  }

  async function openRefundDialog (sale: Sale) {
    refundSale.value = sale
    refundReason.value = ''
    for (const key of Object.keys(refundQuantities)) delete refundQuantities[Number(key)]
    for (const key of Object.keys(refundRemaining)) delete refundRemaining[Number(key)]

    const remaining = await remainingQuantities(sale)
    for (const item of sale.items) {
      refundRemaining[item.productId] = remaining.get(item.productId) ?? 0
      refundQuantities[item.productId] = 0
    }

    refundDialogOpen.value = true
  }

  function closeRefundDialog () {
    refundDialogOpen.value = false
    refundSale.value = null
  }

  async function confirmVoidSale () {
    if (!refundSale.value) return

    refundLoading.value = true
    const result = await voidSale(refundSale.value, refundReason.value || 'Voided')
    refundLoading.value = false

    if (result.ok) {
      refundSale.value.status = 'voided'
      toast.show(result.message)
      closeRefundDialog()
    } else {
      toast.show(result.message, 'error')
    }
  }

  async function confirmRefundItems () {
    if (!refundSale.value) return

    const lines: RefundItem[] = Object.entries(refundQuantities)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }))
      .filter(line => line.quantity > 0)

    refundLoading.value = true
    const result = await refundSaleItems(refundSale.value, lines, refundReason.value || 'Refund')
    refundLoading.value = false

    if (result.ok) {
      if (result.status) refundSale.value.status = result.status
      toast.show(result.message)
      closeRefundDialog()
    } else {
      toast.show(result.message, 'error')
    }
  }

  onMounted(async () => {
    const [profileResult] = await Promise.all([
      cachedFetch('profiles', getProfiles, onlineState.isOnline),
      loadSales(),
      branchStore.loadBranches(),
    ])
    profiles.value = profileResult.data
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
