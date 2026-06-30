<template>
  <v-container class="py-6 py-md-8" fluid>
    <v-row align="center" class="mb-6">
      <v-col cols="12" md="7">
        <v-chip
          class="mb-4"
          color="primary"
          prepend-icon="mdi-store"
          variant="tonal"
        >
          Retail POS System
        </v-chip>

        <h1 class="text-h4 text-md-h3 font-weight-bold mb-3">
          Welcome back, Cashier
        </h1>

        <p class="text-body-1 text-medium-emphasis mb-5">
          Manage sales, products, and cart activity from a SQLite-backed dashboard.
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

      <v-col cols="12" md="5">
        <section class="system-summary">
          <div>
            <div class="text-overline text-primary">Today</div>
            <div class="text-h5 font-weight-bold mb-2">{{ todayLabel }}</div>

            <div class="summary-grid">
              <span>Sales: {{ todaySales.length }}</span>
              <span>Revenue: {{ formatCurrency(todayRevenue) }}</span>
              <span>Cart Items: {{ itemCount }}</span>
              <span>Cart Value: {{ formatCurrency(subtotal) }}</span>
            </div>
          </div>
        </section>
      </v-col>
    </v-row>

    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-row class="chart-grid">
      <v-col cols="12" lg="5">
        <section class="chart-panel chart-panel--primary">
          <div class="chart-header">
            <div>
              <div class="text-overline text-primary">System Flow</div>
              <h2 class="text-h6 font-weight-bold">Retail POS activity map</h2>
            </div>

            <v-icon color="primary" icon="mdi-chart-donut" />
          </div>

          <div class="chart-frame">
            <canvas ref="flowChartRef" aria-label="POS system flow chart" />
          </div>
        </section>
      </v-col>

      <v-col cols="12" lg="7">
        <section class="chart-panel">
          <div class="chart-header">
            <div>
              <div class="text-overline text-success">Revenue</div>
              <h2 class="text-h6 font-weight-bold">Last 7 days sales trend</h2>
            </div>

            <span class="metric-pill">{{ formatCurrency(totalRevenue) }}</span>
          </div>

          <div class="chart-frame chart-frame--wide">
            <canvas ref="revenueChartRef" aria-label="Seven day revenue trend chart" />
          </div>
        </section>
      </v-col>

      <v-col cols="12">
        <section class="chart-panel">
          <div class="chart-header">
            <div>
              <div class="text-overline text-warning">Inventory</div>
              <h2 class="text-h6 font-weight-bold">Stock by product category</h2>
            </div>

            <span class="metric-pill">{{ products.length }} products</span>
          </div>

          <div class="chart-frame chart-frame--wide">
            <canvas ref="inventoryChartRef" aria-label="Inventory category stock chart" />
          </div>
        </section>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
  import type { Product, Sale } from '@/types/pos'
  import { Chart, type ChartConfiguration, registerables } from 'chart.js'
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useCart } from '@/composables/useCart'
  import { getProducts, getSales } from '@/composables/useMockApi'
  import { formatCurrency } from '@/utils/currency'

  Chart.register(...registerables)

  const products = ref<Product[]>([])
  const sales = ref<Sale[]>([])
  const errorMessage = ref('')
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

  function buildCharts () {
    destroyCharts()

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
            backgroundColor: ['#1867c0', '#00bcd4', '#4caf50', '#ff9800'],
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
            borderColor: '#2e7d32',
            backgroundColor: 'rgba(46, 125, 50, 0.14)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#2e7d32',
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
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => formatCurrency(Number(value)),
            },
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
            backgroundColor: '#fb8c00',
            borderRadius: 8,
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
          y: {
            beginAtZero: true,
          },
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

  onMounted(async () => {
    try {
      const [productData, saleData] = await Promise.all([
        getProducts(),
        getSales(),
      ])

      products.value = productData
      sales.value = saleData
      await nextTick()
      buildCharts()
    } catch (error) {
      errorMessage.value
        = error instanceof Error ? error.message : 'Unable to load dashboard data.'
    }
  })

  onBeforeUnmount(() => {
    destroyCharts()
  })
</script>

<style scoped>
.system-summary,
.chart-panel {
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.system-summary {
  padding: 1.5rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.875rem;
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
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.chart-frame {
  position: relative;
  height: 320px;
}

.chart-frame--wide {
  height: 300px;
}

.metric-pill {
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.875rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  white-space: nowrap;
}

@media (max-width: 600px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .chart-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .chart-frame,
  .chart-frame--wide {
    height: 260px;
  }
}
</style>
