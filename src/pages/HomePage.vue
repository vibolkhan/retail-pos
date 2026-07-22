<template>
  <v-container class="py-6 py-md-8" fluid>
    <v-row align="center" class="mb-6">
      <v-col cols="12" md="7">
        <v-chip
          class="mb-4"
          color="primary"
          :prepend-icon="branchStore.isWholesale ? 'mdi-warehouse' : 'mdi-store'"
          variant="tonal"
        >
          {{ branchStore.activeBranch?.name ?? 'Retail POS System' }}
        </v-chip>

        <h1 class="text-h4 text-md-h3 font-weight-bold mb-3">
          Welcome back, Cashier
        </h1>

        <p class="text-body-1 text-medium-emphasis mb-5">
          {{ todayLabel }} — here's how the floor is doing.
        </p>

        <v-btn
          color="primary"
          prepend-icon="mdi-cash-register"
          size="large"
          to="/pos"
          variant="flat"
        >
          Start Selling
        </v-btn>
      </v-col>
    </v-row>

    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-alert v-if="offlineNotice" class="mb-4" type="info" variant="tonal">
      {{ offlineNotice }}
    </v-alert>

    <v-row class="mb-2">
      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Sales today</span>
            <span class="kpi-icon"><v-icon icon="mdi-receipt-text-check-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="50" />
            <template v-else>{{ todaySales.length }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Revenue today</span>
            <span class="kpi-icon"><v-icon icon="mdi-currency-usd" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(todayRevenue) }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Items in cart</span>
            <span class="kpi-icon"><v-icon icon="mdi-cart-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="50" />
            <template v-else>{{ itemCount }}</template>
          </div>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card class="kpi-tile" rounded="lg" variant="flat">
          <div class="kpi-top">
            <span class="kpi-label">Cart value</span>
            <span class="kpi-icon"><v-icon icon="mdi-clock-outline" size="16" /></span>
          </div>

          <div class="kpi-value">
            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <template v-else>{{ formatCurrency(subtotal) }}</template>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="chart-grid">
      <v-col cols="12" lg="5">
        <section class="chart-panel chart-panel--primary">
          <div class="chart-header">
            <span class="panel-icon"><v-icon icon="mdi-chart-donut" size="14" /></span>

            <div>
              <h2 class="text-subtitle-2 font-weight-bold">Retail POS activity map</h2>
              <div class="text-caption text-medium-emphasis">System flow, today</div>
            </div>
          </div>

          <div class="chart-frame">
            <v-skeleton-loader v-if="loading" class="chart-frame-skeleton" type="image" />
            <canvas v-else ref="flowChartRef" aria-label="POS system flow chart" />
          </div>
        </section>
      </v-col>

      <v-col cols="12" lg="7">
        <section class="chart-panel">
          <div class="chart-header">
            <span class="panel-icon"><v-icon icon="mdi-chart-line" size="14" /></span>

            <div>
              <h2 class="text-subtitle-2 font-weight-bold">Last 7 days sales trend</h2>
              <div class="text-caption text-medium-emphasis">Revenue</div>
            </div>

            <v-skeleton-loader v-if="loading" type="text" width="70" />
            <span v-else class="metric-pill">{{ formatCurrency(totalRevenue) }}</span>
          </div>

          <div class="chart-frame chart-frame--wide">
            <v-skeleton-loader v-if="loading" class="chart-frame-skeleton" type="image" />
            <canvas v-else ref="revenueChartRef" aria-label="Seven day revenue trend chart" />
          </div>
        </section>
      </v-col>

      <v-col cols="12">
        <section class="chart-panel">
          <div class="chart-header">
            <span class="panel-icon"><v-icon icon="mdi-warehouse" size="14" /></span>

            <div>
              <h2 class="text-subtitle-2 font-weight-bold">
                Stock by product category{{ branchStore.isWholesale ? ' (wholesale)' : '' }}
              </h2>

              <div class="text-caption text-medium-emphasis">Inventory</div>
            </div>

            <v-skeleton-loader v-if="loading" type="text" width="90" />
            <span v-else class="metric-pill">{{ products.length }} products</span>
          </div>

          <div class="chart-frame chart-frame--wide">
            <v-skeleton-loader v-if="loading" class="chart-frame-skeleton" type="image" />
            <canvas v-else ref="inventoryChartRef" aria-label="Inventory category stock chart" />
          </div>
        </section>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
  import type { Product, Sale } from '@/types/pos'
  import { Chart, type ChartConfiguration, registerables } from 'chart.js'
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useTheme } from 'vuetify'
  import { useCart } from '@/composables/useCart'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { getProducts, getSales } from '@/composables/useSupabase'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'

  Chart.register(...registerables)

  const theme = useTheme()
  const branchStore = useBranchStore()
  const { state: onlineState } = useOnline()
  const loading = ref(true)
  const products = ref<Product[]>([])
  const allSales = ref<Sale[]>([])
  // Dashboard is scoped to the active branch
  const sales = computed(() =>
    allSales.value.filter(sale => sale.branchId === branchStore.activeBranchId),
  )
  const errorMessage = ref('')
  const offlineNotice = ref('')
  const flowChartRef = ref<HTMLCanvasElement | null>(null)
  const revenueChartRef = ref<HTMLCanvasElement | null>(null)
  const inventoryChartRef = ref<HTMLCanvasElement | null>(null)
  const { itemCount, subtotal } = useCart()

  let flowChart: Chart | null = null
  let revenueChart: Chart | null = null
  let inventoryChart: Chart | null = null

  const todayLabel = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
  }).format(new Date())

  const todaySales = computed(() => {
    const today = new Date().toDateString()

    return sales.value.filter(
      sale => new Date(sale.date).toDateString() === today,
    )
  })

  const todayRevenue = computed(() =>
    todaySales.value.reduce((total, sale) => total + sale.grandTotal, 0),
  )

  const totalRevenue = computed(() =>
    sales.value.reduce((total, sale) => total + sale.grandTotal, 0),
  )

  const sevenDayRevenue = computed(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    })

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const dateKey = date.toDateString()
      const total = sales.value
        .filter(sale => new Date(sale.date).toDateString() === dateKey)
        .reduce((sum, sale) => sum + sale.grandTotal, 0)

      return {
        label: formatter.format(date),
        total,
      }
    })
  })

  const stockByCategory = computed(() => {
    const categories = products.value.reduce<Record<string, number>>((acc, product) => {
      const category = product.categoryName || 'Uncategorized'
      acc[category] = (acc[category] || 0) + product.stock

      return acc
    }, {})

    return Object.entries(categories)
      .reduce<Array<[string, number]>>((sortedEntries, entry) => {
        const insertIndex = sortedEntries.findIndex(
          ([, stock]) => stock < entry[1],
        )

        if (insertIndex === -1) {
          sortedEntries.push(entry)
        } else {
          sortedEntries.splice(insertIndex, 0, entry)
        }

        return sortedEntries
      }, [])
      .slice(0, 8)
  })

  function themeHex (name: string) {
    const value = theme.current.value.colors[name as keyof typeof theme.current.value.colors]
    return typeof value === 'string' ? value : '#0E6E64'
  }

  function withAlpha (hex: string, alpha: number) {
    const int = Number.parseInt(hex.replace('#', ''), 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  function buildCharts () {
    destroyCharts()

    const teal = themeHex('primary')
    const copper = themeHex('wholesale')
    const success = themeHex('success')
    const warning = themeHex('warning')
    const axisColor = withAlpha(themeHex('on-surface-variant'), 0.7)
    const gridColor = withAlpha(themeHex('on-surface-variant'), 0.12)

    const flowChartConfig: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Products', 'Cart Items', 'Today Sales', 'Total Sales'],
        datasets: [
          {
            data: [
              products.value.length,
              itemCount.value,
              todaySales.value.length,
              sales.value.length,
            ].map(value => Math.max(value, 1)),
            backgroundColor: [teal, copper, success, warning],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        cutout: '64%',
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: axisColor },
          },
        },
      },
    }

    const revenueChartConfig: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: sevenDayRevenue.value.map(day => day.label),
        datasets: [
          {
            label: 'Revenue',
            data: sevenDayRevenue.value.map(day => day.total),
            borderColor: teal,
            backgroundColor: withAlpha(teal, 0.14),
            fill: true,
            tension: 0.35,
            pointBackgroundColor: teal,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: { ticks: { color: axisColor }, grid: { color: gridColor } },
          y: {
            beginAtZero: true,
            ticks: {
              color: axisColor,
              callback: value => formatCurrency(Number(value)),
            },
            grid: { color: gridColor },
          },
        },
      },
    }

    const inventoryChartConfig: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: stockByCategory.value.map(([category]) => category),
        datasets: [
          {
            label: 'Stock',
            data: stockByCategory.value.map(([, stock]) => stock),
            backgroundColor: copper,
            borderRadius: 6,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: { ticks: { color: axisColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: axisColor }, grid: { color: gridColor } },
        },
      },
    }

    if (flowChartRef.value) {
      flowChart = new Chart(flowChartRef.value, flowChartConfig)
    }

    if (revenueChartRef.value) {
      revenueChart = new Chart(revenueChartRef.value, revenueChartConfig)
    }

    if (inventoryChartRef.value) {
      inventoryChart = new Chart(inventoryChartRef.value, inventoryChartConfig)
    }
  }

  function destroyCharts () {
    flowChart?.destroy()
    revenueChart?.destroy()
    inventoryChart?.destroy()
    flowChart = null
    revenueChart = null
    inventoryChart = null
  }

  async function loadDashboard () {
    loading.value = true
    try {
      await branchStore.loadBranches()
      if (branchStore.activeBranchId == null) {
        throw new Error('No branch available.')
      }
      const branchId = branchStore.activeBranchId
      const [productResult, salesResult] = await Promise.all([
        cachedFetch(`products:${branchId}`, () => getProducts(branchId), onlineState.isOnline),
        cachedFetch('sales:all', getSales, onlineState.isOnline),
      ])

      products.value = productResult.data
      allSales.value = salesResult.data
      offlineNotice.value = productResult.fromCache || salesResult.fromCache
        ? 'Offline — showing cached dashboard data. It will refresh automatically once you\'re back online.'
        : ''
      errorMessage.value = ''
      await nextTick()
      buildCharts()
    } catch (error) {
      errorMessage.value
        = error instanceof Error ? error.message : 'Unable to load dashboard data.'
    } finally {
      loading.value = false
    }
  }

  onMounted(loadDashboard)

  // Rebuild branch-scoped charts when the user switches branch
  watch(() => branchStore.activeBranchId, () => {
    loadDashboard()
  })

  // Chart.js draws colors onto canvas pixels, so a light/dark toggle needs
  // an explicit rebuild — CSS variables alone won't repaint it.
  watch(() => theme.current.value.dark, () => {
    buildCharts()
  })

  onBeforeUnmount(() => {
    destroyCharts()
  })
</script>

<style scoped>
.chart-panel {
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.06);
}

.kpi-tile {
  border: 1px solid rgba(var(--v-border-color), 0.16);
  padding: 14px 16px;
  height: 100%;
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
  font-size: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.chart-grid {
  row-gap: 1rem;
}

.chart-panel {
  height: 100%;
  padding: 1.25rem;
}

.chart-panel--primary {
  background:
    linear-gradient(180deg, rgba(var(--v-theme-primary), 0.08), transparent 42%),
    rgb(var(--v-theme-surface));
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.panel-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgb(var(--v-theme-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.chart-frame {
  position: relative;
  height: 320px;
}

.chart-frame--wide {
  height: 300px;
}

.chart-frame-skeleton,
.chart-frame-skeleton :deep(.v-skeleton-loader__bone) {
  height: 100%;
}

.metric-pill {
  margin-left: auto;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.875rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  white-space: nowrap;
}

@media (max-width: 600px) {
  .chart-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-pill {
    margin-left: 0;
  }

  .chart-frame,
  .chart-frame--wide {
    height: 260px;
  }
}
</style>
