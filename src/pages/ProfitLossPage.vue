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

        <!-- Quick ranges -->
        <v-col cols="12" md="3" sm="6">
          <v-select
            clearable
            density="comfortable"
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
          <div class="kpi-value">{{ formatCurrency(summary.grossSales) }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Discounts</span>
            <span class="kpi-icon"><v-icon icon="mdi-sale" size="16" /></span>
          </div>
          <div class="kpi-value text-error">-{{ formatCurrency(summary.discounts) }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Tax collected</span>
            <span class="kpi-icon"><v-icon icon="mdi-receipt-text-outline" size="16" /></span>
          </div>
          <div class="kpi-value">{{ formatCurrency(summary.tax) }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile kpi-tile--highlight" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Net revenue</span>
            <span class="kpi-icon"><v-icon icon="mdi-chart-line" size="16" /></span>
          </div>
          <div class="kpi-value text-primary">{{ formatCurrency(summary.netRevenue) }}</div>
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
          <div class="kpi-value">{{ formatCurrency(summary.netSales) }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Transactions</span>
            <span class="kpi-icon"><v-icon icon="mdi-receipt-text-check-outline" size="16" /></span>
          </div>
          <div class="kpi-value">{{ summary.count }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Avg. sale</span>
            <span class="kpi-icon"><v-icon icon="mdi-calculator-variant-outline" size="16" /></span>
          </div>
          <div class="kpi-value">{{ formatCurrency(summary.average) }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Items sold</span>
            <span class="kpi-icon"><v-icon icon="mdi-package-variant" size="16" /></span>
          </div>
          <div class="kpi-value">{{ summary.itemsSold }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Daily breakdown -->
    <v-card class="mb-6" rounded="lg" variant="flat">
      <v-card-title class="section-title">Daily breakdown</v-card-title>

      <v-data-table
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

      <v-data-table
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
  import type { Sale } from '@/types/pos'
  import autoTable from 'jspdf-autotable'
  import { computed, onMounted, ref } from 'vue'
  import { getSales } from '@/composables/useSupabase'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'

  const branchStore = useBranchStore()
  const sales = ref<Sale[]>([])
  const errorMessage = ref('')

  const branchFilter = ref<number | null>(null)
  const startDate = ref<string | null>(null)
  const endDate = ref<string | null>(null)

  const startMenu = ref(false)
  const endMenu = ref(false)

  const quickRanges = ['Today', 'Last 7 days', 'This month', 'Last month']

  const dailyHeaders = [
    { title: 'Date', value: 'date', sortable: true },
    { title: 'Transactions', value: 'count', sortable: true },
    { title: 'Gross Sales', value: 'grossSales', sortable: true },
    { title: 'Discounts', value: 'discounts', sortable: true },
    { title: 'Tax', value: 'tax', sortable: true },
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

  const filteredSales = computed(() => {
    return sales.value.filter(sale => {
      const saleDate = new Date(sale.date)

      if (branchFilter.value && sale.branchId !== branchFilter.value) {
        return false
      }

      if (startDate.value && saleDate < startOfDay(new Date(startDate.value))) {
        return false
      }

      if (endDate.value && saleDate > endOfDay(new Date(endDate.value))) {
        return false
      }

      return true
    })
  })

  const summary = computed(() => {
    const grossSales = filteredSales.value.reduce((sum, sale) => sum + sale.subtotal, 0)
    const discounts = filteredSales.value.reduce((sum, sale) => sum + sale.discount, 0)
    const tax = filteredSales.value.reduce((sum, sale) => sum + sale.tax, 0)
    const netRevenue = filteredSales.value.reduce((sum, sale) => sum + sale.grandTotal, 0)
    const netSales = grossSales - discounts
    const count = filteredSales.value.length
    const itemsSold = filteredSales.value.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    )

    return {
      grossSales,
      discounts,
      tax,
      netRevenue,
      netSales,
      count,
      average: count > 0 ? netRevenue / count : 0,
      itemsSold,
    }
  })

  const dailyBreakdown = computed(() => {
    const map = new Map<string, { date: string, count: number, grossSales: number, discounts: number, tax: number, netRevenue: number }>()

    for (const sale of filteredSales.value) {
      const key = new Date(sale.date).toISOString().slice(0, 10)
      const row = map.get(key) ?? { date: key, count: 0, grossSales: 0, discounts: 0, tax: 0, netRevenue: 0 }
      row.count += 1
      row.grossSales += sale.subtotal
      row.discounts += sale.discount
      row.tax += sale.tax
      row.netRevenue += sale.grandTotal
      map.set(key, row)
    }

    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  })

  const paymentBreakdown = computed(() => {
    const map = new Map<string, { paymentMethod: string, count: number, netRevenue: number }>()

    for (const sale of filteredSales.value) {
      const row = map.get(sale.paymentMethod) ?? { paymentMethod: sale.paymentMethod, count: 0, netRevenue: 0 }
      row.count += 1
      row.netRevenue += sale.grandTotal
      map.set(sale.paymentMethod, row)
    }

    return [...map.values()].sort((a, b) => b.netRevenue - a.netRevenue)
  })

  function clearFilters () {
    branchFilter.value = null
    startDate.value = null
    endDate.value = null
  }

  function applyQuickRange (range: string | null) {
    const now = new Date()

    if (range === 'Today') {
      startDate.value = now.toISOString()
      endDate.value = now.toISOString()
    } else if (range === 'Last 7 days') {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      startDate.value = start.toISOString()
      endDate.value = now.toISOString()
    } else if (range === 'This month') {
      startDate.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      endDate.value = now.toISOString()
    } else if (range === 'Last month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      startDate.value = start.toISOString()
      endDate.value = end.toISOString()
    } else {
      startDate.value = null
      endDate.value = null
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
      head: [['Date', 'Transactions', 'Gross Sales', 'Discounts', 'Tax', 'Net Revenue']],
      body: dailyBreakdown.value.map(row => [
        formatDateLabel(row.date),
        String(row.count),
        formatCurrency(row.grossSales),
        `-${formatCurrency(row.discounts)}`,
        formatCurrency(row.tax),
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
    try {
      const [saleRows] = await Promise.all([getSales(), branchStore.loadBranches()])
      sales.value = saleRows
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Unable to load sales data.'
    }
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
