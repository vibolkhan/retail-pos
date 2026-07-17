<template>
  <v-container
    class="pos-page py-6"
    fluid
  >
    <div class="pos-toolbar elevation-2">
      <v-text-field
        v-model="search"
        class="pos-search"
        clearable
        density="comfortable"
        hide-details
        label="Search by name, product code, or barcode"
        prepend-inner-icon="mdi-magnify"
        rounded="lg"
        variant="solo-filled"
      />

      <div class="category-chip-row">
        <v-chip
          class="category-chip font-weight-bold"
          :color="selectedCategory === null ? 'primary' : undefined"
          :variant="selectedCategory === null ? 'flat' : 'outlined'"
          @click="selectedCategory = null"
        >
          All
        </v-chip>

        <v-chip
          v-for="category in categoryOptions"
          :key="category.id"
          class="category-chip font-weight-bold"
          :color="selectedCategory === category.id ? 'primary' : undefined"
          :variant="selectedCategory === category.id ? 'flat' : 'outlined'"
          @click="selectedCategory = category.id"
        >
          {{ category.name }}
        </v-chip>
      </div>
    </div>

    <Transition name="fade-slide">
      <v-alert
        v-if="errorMessage"
        class="mb-4"
        type="error"
        variant="tonal"
      >
        {{ errorMessage }}
      </v-alert>
    </Transition>

    <div v-if="loading" class="product-grid">
      <v-skeleton-loader
        v-for="index in 12"
        :key="index"
        class="rounded-lg"
        type="image, list-item-two-line"
      />
    </div>

    <TransitionGroup
      v-else-if="filteredProducts.length > 0"
      class="product-grid"
      name="product-tile"
      tag="div"
    >
      <ProductCard
        v-for="(product, index) in filteredProducts"
        :key="product.id"
        :product="product"
        :quantity-in-cart="cartQuantities.get(product.id) ?? 0"
        :style="{ '--stagger': index % 12 }"
        :wholesale="branchStore.isWholesale"
        @add="handleAddToCart"
      />
    </TransitionGroup>

    <Transition v-else appear name="pop-in">
      <v-empty-state
        color="primary"
        headline="No products found"
        icon="mdi-package-variant-remove"
        text="Try a different search term or category filter."
        title="Nothing matches your filters"
      />
    </Transition>

    <QuantityDialog
      v-model="quantityDialog"
      :product="selectedProduct"
      @confirm="handleAddCases"
    />
  </v-container>
</template>

<script lang="ts" setup>
import type { Category, Product } from '@/types/pos'
import { computed, onMounted, ref, watch } from 'vue'
import ProductCard from '@/components/ProductCard.vue'
import QuantityDialog from '@/components/QuantityDialog.vue'
import { useCart } from '@/composables/useCart'
import { getCategories, getProducts } from '@/composables/useSupabase'
import { useToast } from '@/composables/useToast'
import { useBranchStore } from '@/stores/branch'

const { addToCart, cartItems } = useCart()
const branchStore = useBranchStore()
const toast = useToast()

const quantityDialog = ref(false)
const selectedProduct = ref<Product | null>(null)

const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const search = ref('')
const selectedCategory = ref<number | null>(null)
const errorMessage = ref('')

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

  return products.value.filter((product) => {
    // Each channel only sells products explicitly enabled for it; wholesale
    // additionally requires batch pricing to be configured.
    const sellableHere = branchStore.isWholesale
      ? product.sellableWholesale && !!product.batchSize && !!product.batchPrice
      : product.sellableRetail
    const matchesCategory = selectedCategory.value
      ? product.categoryId === selectedCategory.value
      : true
    const matchesSearch = query
      ? [product.name, product.code, product.barcode].some((value) =>
          value.toLowerCase().includes(query),
        )
      : true

    return sellableHere && matchesCategory && matchesSearch
  })
})

function handleAddToCart(product: Product) {
  if (branchStore.isWholesale) {
    // Wholesale sells by the batch – ask how many
    selectedProduct.value = product
    quantityDialog.value = true
    return
  }

  const result = addToCart(product)
  toast.show(result.message, result.ok ? 'success' : 'warning')
}

function handleAddCases(product: Product, quantity: number) {
  const result = addToCart(product, quantity)
  toast.show(result.message, result.ok ? 'success' : 'warning')
}

async function load() {
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
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load products.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Refetch branch-scoped stock when the user switches branch
watch(
  () => branchStore.activeBranchId,
  () => {
    if (!loading.value) load()
  },
)
</script>

<style scoped>
.pos-page {
  animation: page-fade-in 0.4s ease both;
}

.pos-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  margin-bottom: 20px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), 0.1);
  animation: toolbar-drop-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.pos-search :deep(.v-field) {
  transition: box-shadow 0.2s ease;
}

.pos-search :deep(.v-field--focused) {
  box-shadow:
    0px 2px 3px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)),
    0px 6px 10px 4px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
}

.category-chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.category-chip {
  /* Flex children shrink by default, and Vuetify's chip has no natural
     min-width — without this the row squeezes every chip down to fit
     instead of scrolling, leaving unreadable single-letter circles on
     narrow phones. */
  flex-shrink: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.category-chip:hover {
  transform: translateY(-2px);
}

.category-chip.v-chip--variant-flat {
  box-shadow:
    0px 1px 2px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)),
    0px 2px 6px 2px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (min-width: 600px) {
  .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 840px) {
  .product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (min-width: 1145px) {
  .product-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}

/* Staggered reveal as the grid mounts or the filtered set changes; --stagger
   is set per-tile inline (index % 12) so the cascade resets every ~2 rows
   instead of a multi-second delay on long lists. */
.product-tile-enter-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: calc(var(--stagger, 0) * 40ms);
}

.product-tile-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

.product-tile-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.product-tile-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.product-tile-move {
  transition: transform 0.3s ease;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.pop-in-enter-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pop-in-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(8px);
}

@keyframes page-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes toolbar-drop-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
