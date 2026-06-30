<template>
  <v-container class="py-6" fluid>
    <div
      class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5"
    >
      <div>
        <h1 class="text-h4 font-weight-bold mb-1">Point of Sale</h1>

        <p class="text-body-2 text-medium-emphasis mb-0">
          Search products, filter by category, and add available stock to the
          cart.
        </p>
      </div>

      <v-btn color="primary" prepend-icon="mdi-cart" to="/cart" variant="flat">
        View Cart
      </v-btn>
    </div>

    <v-row>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Search by name, product code, or barcode"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
        />
      </v-col>

      <v-col cols="12" md="4">
        <!-- Category filter chips -->
        <v-select
          v-model="selectedCategory"
          clearable
          density="comfortable"
          hide-details
          item-title="name"
          item-value="id"
          :items="categoryOptions"
          label="Filter by category"
          prepend-inner-icon="mdi-shape"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-row v-if="loading">
      <v-col v-for="index in 8" :key="index" cols="12" lg="3" md="4" sm="6">
        <v-skeleton-loader type="image, article, actions" />
      </v-col>
    </v-row>

    <v-row v-else-if="filteredProducts.length > 0">
      <v-col
        v-for="product in filteredProducts"
        :key="product.id"
        cols="12"
        lg="3"
        md="4"
        sm="6"
      >
        <ProductCard :product="product" @add="handleAddToCart" />
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      headline="No products found"
      icon="mdi-package-variant-remove"
      text="Try a different search term or category filter."
      title="Nothing matches your filters"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
import type { Category, Product } from "@/types/pos";
import { computed, onMounted, reactive, ref } from "vue";
import ProductCard from "@/components/ProductCard.vue";
import { useCart } from "@/composables/useCart";
import { getCategories, getProducts } from "@/composables/useMockApi";

const { addToCart } = useCart();

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const search = ref("");
const selectedCategory = ref<number | null>(null);
const errorMessage = ref("");
const snackbar = reactive({
  show: false,
  message: "",
  color: "success",
});

const categoryOptions = computed(() => categories.value);

const filteredProducts = computed(() => {
  const query = search.value.trim().toLowerCase();

  return products.value.filter((product) => {
    const matchesCategory = selectedCategory.value
      ? product.categoryId === selectedCategory.value
      : true;
    const matchesSearch = query
      ? [product.name, product.code, product.barcode].some((value) =>
          value.toLowerCase().includes(query),
        )
      : true;

    return matchesCategory && matchesSearch;
  });
});

function showMessage(message: string, color = "success") {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

function handleAddToCart(product: Product) {
  const result = addToCart(product);

  showMessage(result.message, result.ok ? "success" : "warning");
}

onMounted(async () => {
  try {
    const [productData, categoryData] = await Promise.all([
      getProducts(),
      getCategories(),
    ]);

    products.value = productData;
    categories.value = categoryData;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to load products.";
  } finally {
    loading.value = false;
  }
});
</script>
