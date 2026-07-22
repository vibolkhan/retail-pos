<template>
  <v-container class="py-6" fluid>
    <div class="d-flex justify-end ga-2 mb-4">
      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to create a product">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            color="primary"
            :disabled="!onlineState.isOnline"
            prepend-icon="mdi-plus"
            variant="flat"
            @click="openCreateDialog"
          >
            Create Product
          </v-btn>
        </template>
      </v-tooltip>
    </div>

    <v-alert v-if="offlineNotice" class="mb-4" type="info" variant="tonal">
      {{ offlineNotice }}
    </v-alert>

    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Search by product name, code, or barcode"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <v-skeleton-loader
      v-if="loading"
      class="rounded-lg"
      type="table-heading, table-tbody"
    />

    <v-data-table
      v-else
      class="pos-data-table"
      density="comfortable"
      elevation="1"
      :headers="headers"
      :items="filteredProducts"
      :items-per-page="10"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.product="{ item }">
        <div class="d-flex align-center ga-3 py-2">
          <v-avatar rounded="lg" size="48">
            <v-img cover :src="item.image" />
          </v-avatar>

          <div>
            <div class="font-weight-medium">{{ item.name }}</div>

            <div class="text-caption text-medium-emphasis">
              {{ item.code }} / {{ item.barcode }}
            </div>
          </div>
        </div>
      </template>

      <template #item.categoryName="{ item }">
        <v-chip color="primary" size="small" variant="tonal">
          {{ item.categoryName }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip :text="onlineState.isOnline ? 'Edit product' : 'Reconnect to edit this product'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Edit product"
              color="primary"
              :disabled="!onlineState.isOnline"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="openEditDialog(item)"
            />
          </template>
        </v-tooltip>
      </template>

      <template #no-data>
        <v-alert type="info" variant="tonal">
          No products match this search.
        </v-alert>
      </template>
    </v-data-table>

    <ProductFormDialog
      v-model="dialogOpen"
      :categories="categories"
      :product="editingProduct"
      :show-pricing-section="false"
      :show-stock-section="false"
      @created="onProductCreated"
      @updated="onProductUpdated"
    />
  </v-container>
</template>

<script lang="ts" setup>
  import type { InventoryProduct } from '@/composables/useSupabase'
  import type { Category, Product } from '@/types/pos'
  import { computed, onMounted, ref } from 'vue'
  import ProductFormDialog from '@/components/ProductFormDialog.vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { getCategories, getInventoryProducts } from '@/composables/useSupabase'

  const { state: onlineState } = useOnline()

  const products = ref<InventoryProduct[]>([])
  const categories = ref<Category[]>([])
  const loading = ref(true)
  const offlineNotice = ref('')
  const errorMessage = ref('')
  const search = ref('')

  const dialogOpen = ref(false)
  const editingProduct = ref<InventoryProduct | null>(null)

  const headers = [
    { title: 'Product', value: 'product', sortable: false },
    { title: 'Category', value: 'categoryName', sortable: true },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const

  // Master-data editing only — deleted-state management (soft-delete/
  // restore), price/channels/batch pricing, and stock all live on
  // Inventory, so this list never shows or filters by deletedAt beyond
  // hiding deleted rows entirely.
  const filteredProducts = computed(() => {
    const query = search.value.trim().toLowerCase()

    return products.value.filter(product => {
      if (product.deletedAt) return false
      if (!query) return true
      return [product.name, product.code, product.barcode].some(value =>
        value.toLowerCase().includes(query),
      )
    })
  })

  function openCreateDialog () {
    editingProduct.value = null
    dialogOpen.value = true
  }

  function openEditDialog (product: InventoryProduct) {
    editingProduct.value = product
    dialogOpen.value = true
  }

  // Same enrichment as InventoryPage.vue's onProductCreated/onProductUpdated
  // — stockByBranch/costByBranch/batchUnitName/batchUnitUnit are preserved
  // from the existing row since this page never touches stock, cost,
  // price, channels, or batch settings.
  function enrichProduct (
    product: Product,
    existing: InventoryProduct | undefined,
  ): InventoryProduct {
    const categoryName = categories.value.find(c => c.id === product.categoryId)?.name ?? ''
    return {
      ...product,
      categoryName,
      batchUnitName: existing?.batchUnitName,
      batchUnitUnit: existing?.batchUnitUnit,
      stock: 0,
      stockByBranch: existing?.stockByBranch ?? {},
      costByBranch: existing?.costByBranch ?? {},
    }
  }

  function onProductCreated (product: Product) {
    products.value = [...products.value, enrichProduct(product, undefined)]
  }

  function onProductUpdated (product: Product) {
    const index = products.value.findIndex(item => item.id === product.id)
    if (index !== -1) {
      products.value[index] = enrichProduct(product, products.value[index])
    }
  }

  onMounted(async () => {
    loading.value = true
    errorMessage.value = ''
    offlineNotice.value = ''

    try {
      const [categoryResult, productResult] = await Promise.all([
        cachedFetch('categories', getCategories, onlineState.isOnline),
        cachedFetch('inventory', getInventoryProducts, onlineState.isOnline),
      ])
      categories.value = categoryResult.data
      products.value = productResult.data
      if (categoryResult.fromCache || productResult.fromCache) {
        const cachedAt = productResult.cachedAt ?? categoryResult.cachedAt
        offlineNotice.value = cachedAt
          ? `Offline — showing products as of ${new Date(cachedAt).toLocaleTimeString()}. Editing is disabled until reconnected.`
          : 'Offline — showing the last loaded products. Editing is disabled until reconnected.'
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Unable to load products.'
    } finally {
      loading.value = false
    }
  })
</script>
