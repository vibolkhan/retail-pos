<template>
  <v-container class="py-6 py-md-8" fluid>
    <v-row class="mb-6" align="center">
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
        <!-- Today Overview Card -->
        <v-card
          class="pa-5 overview-card"
          rounded="lg"
          variant="flat"
          color="primary"
        >
          <div class="text-overline">Today</div>
          <div class="text-h5 font-weight-bold mb-2">{{ todayLabel }}</div>
          <div class="text-body-2 opacity-80 mb-2">
            <v-chip class="ma-1" color="info" variant="tonal" size="small">
              Sales: {{ todaySales.length }}
            </v-chip>
            <v-chip class="ma-1" color="success" variant="tonal" size="small">
              Revenue:
              {{
                formatCurrency(todaySales.reduce((t, s) => t + s.grandTotal, 0))
              }}
            </v-chip>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-row>
      <v-col
        cols="12"
        md="3"
        sm="6"
        v-for="card in dashboardCards"
        :key="card.title"
        class="mb-4"
      >
        <v-card class="pa-5 overview-card" rounded="lg">
          <div class="d-flex align-center justify-space-between mb-4">
            <v-avatar :color="card.color" variant="tonal">
              <v-icon :icon="card.icon" />
            </v-avatar>
            <span class="text-caption text-medium-emphasis">Dashboard</span>
          </div>
          <div class="text-body-2 text-medium-emphasis">{{ card.title }}</div>
          <div class="text-h5 font-weight-bold mt-1">{{ card.value }}</div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import type { Product, Sale } from "@/types/pos";
import { computed, onMounted, ref } from "vue";
import { getProducts, getSales } from "@/composables/useMockApi";
import { formatCurrency } from "@/utils/currency";

const products = ref<Product[]>([]);
const sales = ref<Sale[]>([]);
const errorMessage = ref("");

const todayLabel = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
}).format(new Date());

const todaySales = computed(() => {
  const today = new Date().toDateString();

  return sales.value.filter(
    (sale) => new Date(sale.date).toDateString() === today,
  );
});

const dashboardCards = computed(() => [
  {
    title: "Total Products",
    value: products.value.length.toString(),
    icon: "mdi-package-variant-closed",
    color: "primary",
  },
  {
    title: "Today's Sales",
    value: todaySales.value.length.toString(),
    icon: "mdi-receipt-text-check",
    color: "info",
  },
  {
    title: "Total Sales",
    value: sales.value.length.toString(),
    icon: "mdi-cart-check",
    color: "success",
  },
  {
    title: "Total Revenue",
    value: formatCurrency(
      sales.value.reduce((total, sale) => total + sale.grandTotal, 0),
    ),
    icon: "mdi-cash-multiple",
    color: "warning",
  },
]);

onMounted(async () => {
  try {
    const [productData, saleData] = await Promise.all([
      getProducts(),
      getSales(),
    ]);

    products.value = productData;
    sales.value = saleData;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to load dashboard data.";
  }
});
</script>

<style scoped>
.overview-card {
  padding: 1.5rem;
}
</style>
