<template>
  <v-container class="py-6" fluid>
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
      <v-col
        v-for="index in 12"
        :key="index"
        cols="6"
        lg="2"
        md="3"
        sm="4"
      >
        <v-skeleton-loader type="image, list-item-two-line" />
      </v-col>
    </v-row>

    <v-row v-else-if="filteredProducts.length > 0">
      <v-col
        v-for="product in filteredProducts"
        :key="product.id"
        cols="6"
        lg="2"
        md="3"
        sm="4"
      >
        <ProductCard
          :product="product"
          :quantity-in-cart="cartQuantities.get(product.id) ?? 0"
          :wholesale="branchStore.isWholesale"
          @add="handleAddToCart"
        />
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      headline="No products found"
      icon="mdi-package-variant-remove"
      text="Try a different search term or category filter."
      title="Nothing matches your filters"
    />

    <QuantityDialog
      v-model="quantityDialog"
      :product="selectedProduct"
      @confirm="handleAddCases"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
  import type { Category, Product } from '@/types/pos'
  import { computed, onMounted, reactive, ref, watch } from 'vue'
  import ProductCard from '@/components/ProductCard.vue'
  import QuantityDialog from '@/components/QuantityDialog.vue'
  import { useCart } from '@/composables/useCart'
  import { getCategories, getProducts } from '@/composables/useSupabase'
  import { useBranchStore } from '@/stores/branch'

  const { addToCart, cartItems } = useCart()
  const branchStore = useBranchStore()

  const quantityDialog = ref(false)
  const selectedProduct = ref<Product | null>(null)

  const products = ref<Product[]>([])
  const categories = ref<Category[]>([])
  const loading = ref(true)
  const search = ref('')
  const selectedCategory = ref<number | null>(null)
  const errorMessage = ref('')
  const snackbar = reactive({
    show: false,
    message: '',
    color: 'success',
  })

  const categoryOptions = computed(() => categories.value)

  const cartQuantities = computed(() => {
    const map = new Map<number, number>()
    for (const item of cartItems.value) {
      map.set(item.productId, item.quantity)
    }
    return map
  })

  const filteredProducts = computed(() => {
    const query = search.value.trim().toLowerCase()

    return products.value.filter(product => {
      // Each channel only sells products explicitly enabled for it; wholesale
      // additionally requires batch pricing to be configured.
      const sellableHere = branchStore.isWholesale
        ? product.sellableWholesale && !!product.batchSize && !!product.batchPrice
        : product.sellableRetail
      const matchesCategory = selectedCategory.value
        ? product.categoryId === selectedCategory.value
        : true
      const matchesSearch = query
        ? [product.name, product.code, product.barcode].some(value =>
          value.toLowerCase().includes(query),
        )
        : true

      return sellableHere && matchesCategory && matchesSearch
    })
  })

  function showMessage (message: string, color = 'success') {
    snackbar.message = message
    snackbar.color = color
    snackbar.show = true
  }

  function handleAddToCart (product: Product) {
    if (branchStore.isWholesale) {
      // Wholesale sells by the batch – ask how many
      selectedProduct.value = product
      quantityDialog.value = true
      return
    }

    const result = addToCart(product)
    showMessage(result.message, result.ok ? 'success' : 'warning')
  }

  function handleAddCases (product: Product, quantity: number) {
    const result = addToCart(product, quantity)
    showMessage(result.message, result.ok ? 'success' : 'warning')
  }

  async function load () {
    loading.value = true
    errorMessage.value = ''
    try {
      await branchStore.loadBranches()
      if (branchStore.activeBranchId == null) {
        throw new Error('No branch available.')
      }
      const [productData, categoryData] = await Promise.all([
        getProducts(branchStore.activeBranchId),
        getCategories(),
      ])

      products.value = productData
      categories.value = categoryData
    } catch (error) {
      errorMessage.value
        = error instanceof Error ? error.message : 'Unable to load products.'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  // Refetch branch-scoped stock when the user switches branch
  watch(() => branchStore.activeBranchId, () => {
    if (!loading.value) load()
  })
</script>
