<template>
  <v-container class="py-6 pnl-page" fluid>
    <!-- Filter Card -->
    <v-card class="date-filter-card mb-6" rounded="lg" variant="flat">
      <div class="filter-header">
        <span class="text-overline text-medium-emphasis">Filters</span>

        <div class="filter-header-actions">
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

          <v-btn
            color="primary"
            :disabled="filteredSales.length === 0"
            prepend-icon="mdi-file-pdf-box"
            size="small"
            variant="flat"
            @click="exportPdf"
          >
            Export PDF
          </v-btn>
        </div>
      </div>

      <v-row align="center" density="comfortable">
        <!-- Branch -->
        <v-col cols="12" md="3" sm="6">
          <v-select
            v-model="branchFilter"
            clearable
            density="comfortable"
            hide-details
            item-title="name"
            item-value="id"
            :items="branchStore.branches"
            label="Branch (all if empty)"
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

        <!-- Quick ranges -->
        <v-col cols="12" md="3" sm="6">
          <v-select
            clearable
            density="comfortable"
            :disabled="!onlineState.isOnline"
            hide-details
            :items="quickRanges"
            label="Quick range"
            prepend-inner-icon="mdi-calendar-clock"
            rounded="lg"
            variant="outlined"
            @update:model-value="applyQuickRange"
          />
        </v-col>
      </v-row>
    </v-card>

    <v-alert v-if="offlineNotice" class="mb-4" type="info" variant="tonal">
      {{ offlineNotice }}
    </v-alert>

    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <!-- Summary tiles -->
    <v-row class="mb-2">
      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Gross sales</span>
            <span class="kpi-icon"><v-icon icon="mdi-cash-multiple" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(summary.grossSales) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Discounts</span>
            <span class="kpi-icon"><v-icon icon="mdi-sale" size="16" /></span>
          </div>

          <div class="kpi-value text-error">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>-{{ formatCurrency(summary.discounts) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Tax collected</span>
            <span class="kpi-icon"><v-icon icon="mdi-receipt-text-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(summary.tax) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile kpi-tile--highlight" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Net revenue</span>
            <span class="kpi-icon"><v-icon icon="mdi-chart-line" size="16" /></span>
          </div>

          <div class="kpi-value text-primary">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(summary.netRevenue) }}</template>
          </div>

          <div v-if="!loading && secondaryNetRevenue" class="kpi-secondary text-medium-emphasis">
            ≈ {{ secondaryNetRevenue }}
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mb-6">
      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Net sales</span>
            <span class="kpi-icon"><v-icon icon="mdi-cart-check" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(summary.netSales) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Transactions</span>
            <span class="kpi-icon"><v-icon icon="mdi-receipt-text-check-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="50" />
            <template v-else>{{ summary.count }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Avg. sale</span>
            <span class="kpi-icon"><v-icon icon="mdi-calculator-variant-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(summary.average) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Items sold</span>
            <span class="kpi-icon"><v-icon icon="mdi-package-variant" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="50" />
            <template v-else>{{ summary.itemsSold }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Refunds</span>
            <span class="kpi-icon"><v-icon icon="mdi-cash-refund" size="16" /></span>
          </div>

          <div class="kpi-value text-error">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>-{{ formatCurrency(summary.refunds) }}</template>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-alert v-if="!loading && summary.itemsMissingCost > 0" class="mb-6" type="info" variant="tonal">
      COGS/Gross Profit below don't include {{ summary.itemsMissingCost }} sale line(s) in this range with no
      recorded cost — sold before cost tracking was added, or for a product never received through a purchase.
      Those lines count as $0 cost rather than an estimate.
    </v-alert>

    <v-row class="mb-6">
      <v-col cols="6" md="4">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">COGS</span>
            <span class="kpi-icon"><v-icon icon="mdi-package-variant-closed" size="16" /></span>
          </div>

          <div class="kpi-value text-error">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>-{{ formatCurrency(summary.cogs) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="4">
        <v-card class="kpi-tile kpi-tile--highlight" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Gross profit</span>
            <span class="kpi-icon"><v-icon icon="mdi-finance" size="16" /></span>
          </div>

          <div class="kpi-value text-primary">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(summary.grossProfit) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="4">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Margin</span>
            <span class="kpi-icon"><v-icon icon="mdi-percent-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="50" />
            <template v-else>{{ formatPercent(summary.margin) }}</template>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Daily breakdown -->
    <v-card class="mb-6" rounded="lg" variant="flat">
      <v-card-title class="section-title">Daily breakdown</v-card-title>

      <v-skeleton-loader v-if="loading" class="rounded-lg" type="table-heading, table-tbody" />

      <v-data-table
        v-else
        class="pos-data-table"
        density="comfortable"
        :headers="dailyHeaders"
        item-value="date"
        :items="dailyBreakdown"
        mobile-breakpoint="md"
        rounded="lg"
      >
        <template #item.date="{ item }">
          <span class="price-mono">{{ formatDateLabel(item.date) }}</span>
        </template>

        <template #item.count="{ item }">
          {{ item.count }}
        </template>

        <template #item.grossSales="{ item }">
          <span class="price-mono">{{ formatCurrency(item.grossSales) }}</span>
        </template>

        <template #item.discounts="{ item }">
          <span class="price-mono text-error">-{{ formatCurrency(item.discounts) }}</span>
        </template>

        <template #item.tax="{ item }">
          <span class="price-mono">{{ formatCurrency(item.tax) }}</span>
        </template>

        <template #item.cogs="{ item }">
          <span class="price-mono text-error">-{{ formatCurrency(item.cogs) }}</span>
        </template>

        <template #item.grossProfit="{ item }">
          <span class="price-mono">{{ formatCurrency(item.grossProfit) }}</span>
        </template>

        <template #item.netRevenue="{ item }">
          <strong class="price-mono text-primary">{{ formatCurrency(item.netRevenue) }}</strong>
        </template>

        <template #no-data>
          <v-empty-state
            class="py-8"
            color="primary"
            headline="No sales found"
            icon="mdi-chart-line-variant"
            text="Try changing your date range or branch filter."
            title="No data in this range"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- By payment method -->
    <v-card rounded="lg" variant="flat">
      <v-card-title class="section-title">By payment method</v-card-title>

      <v-skeleton-loader v-if="loading" class="rounded-lg" type="table-heading, table-tbody" />

      <v-data-table
        v-else
        class="pos-data-table"
        density="comfortable"
        :headers="paymentHeaders"
        item-value="paymentMethod"
        :items="paymentBreakdown"
        mobile-breakpoint="md"
        rounded="lg"
      >
        <template #item.paymentMethod="{ item }">
          <v-chip :color="paymentColor(item.paymentMethod)" size="small" variant="tonal">
            {{ item.paymentMethod }}
          </v-chip>
        </template>

        <template #item.count="{ item }">
          {{ item.count }}
        </template>

        <template #item.netRevenue="{ item }">
          <strong class="price-mono text-primary">{{ formatCurrency(item.netRevenue) }}</strong>
        </template>

        <template #no-data>
          <v-empty-state
            class="py-8"
            color="primary"
            headline="No sales found"
            icon="mdi-chart-line-variant"
            text="Try changing your date range or branch filter."
            title="No data in this range"
          />
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script lang="ts" setup>
  import type { Refund, Sale } from '@/types/pos'
  import autoTable from 'jspdf-autotable'
  import { computed, onMounted, ref, watch } from 'vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { useSettings } from '@/composables/useSettings'
  import { getAllRefunds, getSales } from '@/composables/useSupabase'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency, formatCurrencyAs, formatPercent } from '@/utils/currency'

  const branchStore = useBranchStore()
  const { state: settingsState } = useSettings()
  const { state: onlineState } = useOnline()
  const loading = ref(true)
  const sales = ref<Sale[]>([])
  const refunds = ref<Refund[]>([])
  const errorMessage = ref('')
  const offlineNotice = ref('')

  const branchFilter = ref<number | null>(null)
  // Defaults to the last 30 days rather than unbounded — bounds the default
  // getSales()/getAllRefunds() requests instead of pulling all-time history
  // on every visit. "Clear" (below) still allows an explicit, occasional
  // full-history view.
  const startDate = ref<string | null>(defaultRangeStart())
  const endDate = ref<string | null>(new Date().toISOString())

  const startMenu = ref(false)
  const endMenu = ref(false)

  const quickRanges = ['Today', 'Last 7 days', 'This month', 'Last month']

  const dailyHeaders = [
    { title: 'Date', value: 'date', sortable: true },
    { title: 'Transactions', value: 'count', sortable: true },
    { title: 'Gross Sales', value: 'grossSales', sortable: true },
    { title: 'Discounts', value: 'discounts', sortable: true },
    { title: 'Tax', value: 'tax', sortable: true },
    { title: 'COGS', value: 'cogs', sortable: true },
    { title: 'Gross Profit', value: 'grossProfit', sortable: true },
    { title: 'Net Revenue', value: 'netRevenue', sortable: true },
  ] as const

  const paymentHeaders = [
    { title: 'Payment Method', value: 'paymentMethod', sortable: true },
    { title: 'Transactions', value: 'count', sortable: true },
    { title: 'Net Revenue', value: 'netRevenue', sortable: true },
  ] as const

  const hasActiveFilters = computed(() =>
    Boolean(branchFilter.value || startDate.value || endDate.value),
  )

  function startOfDay (date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function endOfDay (date: Date) {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
  }

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
      range.from = startOfDay(new Date(startDate.value)).toISOString()
    }
    if (endDate.value) {
      range.to = endOfDay(new Date(endDate.value)).toISOString()
    }
    return range
  }

  // Date range is applied server-side (loadData() below) — this only
  // handles branch, which doesn't reduce transferred rows enough to be
  // worth its own network round trip.
  const filteredSales = computed(() => {
    return sales.value.filter(sale => {
      return !branchFilter.value || sale.branchId === branchFilter.value
    })
  })

  // Refunded amount per sale id — folded into net revenue below so a
  // refunded/voided sale doesn't overstate how much was actually earned.
  const refundsBySaleId = computed(() => {
    const map = new Map<string, number>()
    for (const refund of refunds.value) {
      map.set(refund.saleId, (map.get(refund.saleId) ?? 0) + refund.amount)
    }
    return map
  })

  function refundedAmount (saleId: string) {
    return refundsBySaleId.value.get(saleId) ?? 0
  }

  // Dollar cost of one sale line: costPrice is a snapshot taken at sale time
  // (see SaleItem.costPrice). Every product sells as one unit now, so COGS
  // is simply costPrice * quantity — except a *historical* sale recorded
  // before this redesign may still carry a legacy `batchSize` key in its
  // stored jsonb (not part of the current type), in which case that sale's
  // costPrice was a per-retail-unit figure and needs that multiplier to
  // stay correct; new sales never have this key, so the multiplier is
  // always 1 for them. Sales recorded before costPrice existed at all have
  // no costPrice and contribute 0 (see itemsMissingCost below, surfaced in
  // the UI rather than silently understating COGS).
  function lineCogs (item: Sale['items'][number]) {
    if (item.costPrice == null) return 0
    const legacyBatchSize = (item as { batchSize?: unknown }).batchSize
    const multiplier = typeof legacyBatchSize === 'number' && legacyBatchSize > 0 ? legacyBatchSize : 1
    return item.costPrice * multiplier * item.quantity
  }

  const salesById = computed(() => {
    const map = new Map<string, Sale>()
    for (const sale of sales.value) map.set(sale.id, sale)
    return map
  })

  // COGS reversed by refunds/voids per sale id — mirrors refundsBySaleId,
  // but computed from the ORIGINAL sale's line costPrice (not looked up
  // fresh), since that's the cost that was actually recognized at sale time.
  const refundedCogsBySaleId = computed(() => {
    const map = new Map<string, number>()
    for (const refund of refunds.value) {
      const sale = salesById.value.get(refund.saleId)
      if (!sale) continue
      let cogs = 0
      for (const refundItem of refund.items) {
        const saleItem = sale.items.find(item => item.productId === refundItem.productId)
        if (!saleItem || saleItem.costPrice == null) continue
        const legacyBatchSize = (saleItem as { batchSize?: unknown }).batchSize
        const multiplier = typeof legacyBatchSize === 'number' && legacyBatchSize > 0 ? legacyBatchSize : 1
        cogs += saleItem.costPrice * multiplier * refundItem.quantity
      }
      map.set(refund.saleId, (map.get(refund.saleId) ?? 0) + cogs)
    }
    return map
  })

  function refundedCogs (saleId: string) {
    return refundedCogsBySaleId.value.get(saleId) ?? 0
  }

  const summary = computed(() => {
    const grossSales = filteredSales.value.reduce((sum, sale) => sum + sale.subtotal, 0)
    const discounts = filteredSales.value.reduce((sum, sale) => sum + sale.discount, 0)
    const tax = filteredSales.value.reduce((sum, sale) => sum + sale.tax, 0)
    const refundsTotal = filteredSales.value.reduce((sum, sale) => sum + refundedAmount(sale.id), 0)
    const netRevenue = filteredSales.value.reduce((sum, sale) => sum + sale.grandTotal, 0) - refundsTotal
    const netSales = grossSales - discounts
    const count = filteredSales.value.length
    const itemsSold = filteredSales.value.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    )

    const grossCogs = filteredSales.value.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + lineCogs(item), 0),
      0,
    )
    const refundedCogsTotal = filteredSales.value.reduce((sum, sale) => sum + refundedCogs(sale.id), 0)
    const netCogs = grossCogs - refundedCogsTotal
    const grossProfit = netRevenue - netCogs
    const itemsMissingCost = filteredSales.value.reduce(
      (sum, sale) => sum + sale.items.filter(item => item.costPrice == null).length,
      0,
    )

    return {
      grossSales,
      discounts,
      tax,
      refunds: refundsTotal,
      netRevenue,
      netSales,
      count,
      average: count > 0 ? netRevenue / count : 0,
      itemsSold,
      cogs: netCogs,
      grossProfit,
      margin: netRevenue > 0 ? grossProfit / netRevenue : 0,
      itemsMissingCost,
    }
  })

  // Each sale converted at its OWN historical rate (falling back to today's
  // rate for sales recorded before dual-currency existed) before summing —
  // not the aggregate converted at today's rate, which would misrepresent
  // older sales if the rate has since changed.
  const secondaryNetRevenue = computed(() => {
    if (!settingsState.currency.exchangeRate) return ''

    const total = filteredSales.value.reduce((sum, sale) => {
      const rate = sale.exchangeRate || settingsState.currency.exchangeRate
      return sum + (sale.grandTotal - refundedAmount(sale.id)) * rate
    }, 0)

    return formatCurrencyAs(total, settingsState.currency.secondary)
  })

  const dailyBreakdown = computed(() => {
    const map = new Map<string, { date: string, count: number, grossSales: number, discounts: number, tax: number, cogs: number, grossProfit: number, netRevenue: number }>()

    for (const sale of filteredSales.value) {
      const key = new Date(sale.date).toISOString().slice(0, 10)
      const row = map.get(key) ?? { date: key, count: 0, grossSales: 0, discounts: 0, tax: 0, cogs: 0, grossProfit: 0, netRevenue: 0 }
      const netRevenueDelta = sale.grandTotal - refundedAmount(sale.id)
      const cogsDelta = sale.items.reduce((sum, item) => sum + lineCogs(item), 0) - refundedCogs(sale.id)
      row.count += 1
      row.grossSales += sale.subtotal
      row.discounts += sale.discount
      row.tax += sale.tax
      row.cogs += cogsDelta
      row.grossProfit += netRevenueDelta - cogsDelta
      row.netRevenue += netRevenueDelta
      map.set(key, row)
    }

    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  })

  const paymentBreakdown = computed(() => {
    const map = new Map<string, { paymentMethod: string, count: number, netRevenue: number }>()

    for (const sale of filteredSales.value) {
      const row = map.get(sale.paymentMethod) ?? { paymentMethod: sale.paymentMethod, count: 0, netRevenue: 0 }
      row.count += 1
      row.netRevenue += sale.grandTotal - refundedAmount(sale.id)
      map.set(sale.paymentMethod, row)
    }

    return [...map.values()].sort((a, b) => b.netRevenue - a.netRevenue)
  })

  interface PnlRangeCache {
    range: { from?: string, to?: string }
    sales: Sale[]
    refunds: Refund[]
  }

  async function loadData () {
    loading.value = true
    try {
      const range = dateRangeParams()
      // Cached as a single "last viewed range" slot (not one per range),
      // sales+refunds+range together, so a fall-back-to-cache while offline
      // can say which range is actually being shown instead of silently
      // pretending the currently-selected picker range was honored.
      const result = await cachedFetch<PnlRangeCache>(
        'sales:lastRange:pnl',
        async () => {
          const saleRows = await getSales(range)
          // Scoped to just the sales in view — a refund is matched to its
          // sale by id regardless of which day the refund itself was
          // recorded, so this stays correct without pulling every refund
          // ever recorded.
          const refundRows = await getAllRefunds(saleRows.map(sale => sale.id))
          return { range, sales: saleRows, refunds: refundRows }
        },
        onlineState.isOnline,
      )
      sales.value = result.data.sales
      refunds.value = result.data.refunds
      if (result.fromCache) {
        const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString() : 'the beginning'
        offlineNotice.value = `Offline — showing cached figures from ${fmt(result.data.range.from)} to ${fmt(result.data.range.to)}. Date filters are disabled until reconnected.`
      } else {
        offlineNotice.value = ''
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Unable to load sales data.'
    } finally {
      loading.value = false
    }
  }

  // Re-queries Supabase with the new bounds — this is what actually avoids
  // downloading unrelated history, not just re-filtering the same full set.
  watch([startDate, endDate], loadData)

  function clearFilters () {
    branchFilter.value = null
    // null means "all time" here — an explicit, occasional full-history
    // fetch, not the default.
    startDate.value = null
    endDate.value = null
  }

  function applyQuickRange (range: string | null) {
    const now = new Date()

    switch (range) {
      case 'Today': {
        startDate.value = now.toISOString()
        endDate.value = now.toISOString()

        break
      }
      case 'Last 7 days': {
        const start = new Date(now)
        start.setDate(start.getDate() - 6)
        startDate.value = start.toISOString()
        endDate.value = now.toISOString()

        break
      }
      case 'This month': {
        startDate.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        endDate.value = now.toISOString()

        break
      }
      case 'Last month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 0)
        startDate.value = start.toISOString()
        endDate.value = end.toISOString()

        break
      }
      default: {
        startDate.value = null
        endDate.value = null
      }
    }
  }

  function branchLabel () {
    if (!branchFilter.value) return 'All branches'
    return branchStore.branches.find(b => b.id === branchFilter.value)?.name ?? 'All branches'
  }

  function formatDateLabel (date: string) {
    return new Date(date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function rangeLabel () {
    const start = startDate.value ? formatDateLabel(startDate.value) : 'Earliest'
    const end = endDate.value ? formatDateLabel(endDate.value) : 'Latest'
    return `${start} — ${end}`
  }

  function paymentColor (paymentMethod: string) {
    const method = paymentMethod.toLowerCase()

    if (method.includes('cash')) return 'success'
    if (method.includes('card')) return 'primary'
    if (method.includes('bank')) return 'info'
    if (method.includes('qr')) return 'primary'

    return 'grey'
  }

  async function exportPdf () {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text('Profit & Loss Statement', 14, 18)

    doc.setFontSize(10)
    doc.setTextColor(90)
    doc.text(`Branch: ${branchLabel()}`, 14, 26)
    doc.text(`Range: ${rangeLabel()}`, 14, 32)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38)

    autoTable(doc, {
      startY: 44,
      head: [['Summary', 'Amount']],
      body: [
        ['Gross Sales', formatCurrency(summary.value.grossSales)],
        ['Discounts', `-${formatCurrency(summary.value.discounts)}`],
        ['Net Sales', formatCurrency(summary.value.netSales)],
        ['Tax Collected', formatCurrency(summary.value.tax)],
        ['Refunds', `-${formatCurrency(summary.value.refunds)}`],
        ['COGS', `-${formatCurrency(summary.value.cogs)}`],
        ['Gross Profit', formatCurrency(summary.value.grossProfit)],
        ['Margin', formatPercent(summary.value.margin)],
        ['Net Revenue', formatCurrency(summary.value.netRevenue)],
        ['Transactions', String(summary.value.count)],
        ['Items Sold', String(summary.value.itemsSold)],
        ['Average Sale', formatCurrency(summary.value.average)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [14, 110, 100] },
    })

    const afterSummaryY = (doc as any).lastAutoTable.finalY + 10

    autoTable(doc, {
      startY: afterSummaryY,
      head: [['Date', 'Transactions', 'Gross Sales', 'Discounts', 'Tax', 'COGS', 'Gross Profit', 'Net Revenue']],
      body: dailyBreakdown.value.map(row => [
        formatDateLabel(row.date),
        String(row.count),
        formatCurrency(row.grossSales),
        `-${formatCurrency(row.discounts)}`,
        formatCurrency(row.tax),
        `-${formatCurrency(row.cogs)}`,
        formatCurrency(row.grossProfit),
        formatCurrency(row.netRevenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [14, 110, 100] },
    })

    const afterDailyY = (doc as any).lastAutoTable.finalY + 10

    autoTable(doc, {
      startY: afterDailyY,
      head: [['Payment Method', 'Transactions', 'Net Revenue']],
      body: paymentBreakdown.value.map(row => [
        row.paymentMethod,
        String(row.count),
        formatCurrency(row.netRevenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [14, 110, 100] },
    })

    const fileStart = startDate.value ? startDate.value.slice(0, 10) : 'all'
    const fileEnd = endDate.value ? endDate.value.slice(0, 10) : 'all'
    doc.save(`PnL_${fileStart}_to_${fileEnd}.pdf`)
  }

  onMounted(async () => {
    await Promise.all([loadData(), branchStore.loadBranches()])
  })
</script>

<style scoped>
.pnl-page {
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
  gap: 8px;
  flex-wrap: wrap;
}

.filter-header-actions {
  display: flex;
  gap: 4px;
}

.date-input :deep(.v-field__prepend-inner) {
  color: rgb(var(--v-theme-primary));
}

.kpi-tile {
  border: 1px solid rgba(var(--v-border-color), 0.16);
  padding: 14px 16px;
  height: 100%;
}

.kpi-tile--highlight {
  background: rgba(var(--v-theme-primary), 0.06);
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.kpi-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.kpi-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.kpi-value {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.kpi-secondary {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 700;
}

@media (max-width: 600px) {
  .filter-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
