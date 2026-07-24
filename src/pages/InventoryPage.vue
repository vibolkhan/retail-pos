<template>
  <v-container class="py-6" fluid>
    <div class="d-flex justify-end ga-2 mb-4">
      <input
        ref="importFileInputRef"
        accept=".xlsx"
        class="hidden"
        type="file"
        @change="onImportFileChange"
      >

      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to import inventory">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :disabled="!onlineState.isOnline"
            :loading="importing"
            prepend-icon="mdi-file-upload-outline"
            variant="outlined"
            @click="triggerImportPicker"
          >
            Import Excel
          </v-btn>
        </template>
      </v-tooltip>

      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to export inventory (product photos need a live connection)">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :disabled="!onlineState.isOnline"
            :loading="exporting"
            prepend-icon="mdi-file-download-outline"
            variant="outlined"
            @click="onExportClick"
          >
            Export Excel
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
      <v-col cols="12" md="8">
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

      <v-col cols="12" md="4">
        <v-select
          v-model="statusFilter"
          density="comfortable"
          hide-details
          :items="statusOptions"
          label="Status"
          prepend-inner-icon="mdi-archive-outline"
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

      <template #item.priceCol="{ item }">
        <span class="price-mono">{{ formatCurrency(item.price) }}</span>
      </template>

      <template #item.costCol="{ item }">
        <span v-if="item.cost != null" class="price-mono">
          {{ formatCurrency(item.cost) }}
        </span>

        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.marginCol="{ item }">
        <v-chip
          v-if="marginFor(item) != null"
          :color="marginColor(marginFor(item))"
          size="small"
          variant="tonal"
        >
          {{ formatPercent(marginFor(item)!) }}
        </v-chip>

        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.stockCol="{ item }">
        <v-chip
          :color="stockColor(stockFor(item), item.lowStockThreshold)"
          size="small"
          variant="tonal"
        >
          {{ stockFor(item) }} in stock
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <template v-if="item.deletedAt">
          <v-tooltip :text="onlineState.isOnline ? 'Restore product' : 'Reconnect to restore this product'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                aria-label="Restore product"
                color="primary"
                :disabled="!onlineState.isOnline"
                icon="mdi-restore"
                :loading="restoringId === item.id"
                size="small"
                variant="text"
                @click="restoreProduct(item)"
              />
            </template>
          </v-tooltip>
        </template>

        <template v-else>
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

          <v-tooltip :text="onlineState.isOnline ? 'Delete product' : 'Reconnect to delete this product'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                aria-label="Delete product"
                color="error"
                :disabled="!onlineState.isOnline"
                icon="mdi-delete-outline"
                :loading="deletingId === item.id"
                size="small"
                variant="text"
                @click="openRemoveDialog(item)"
              />
            </template>
          </v-tooltip>
        </template>
      </template>

      <template #no-data>
        <v-alert type="info" variant="tonal">
          No products match the current inventory filters.
        </v-alert>
      </template>
    </v-data-table>

    <ProductFormDialog
      v-model="dialogOpen"
      :batch-units="batchUnits"
      :branches="branchStore.branches"
      :categories="categories"
      :product="editingProduct"
      :show-details-section="false"
      show-stock-section
      :stock-by-branch="editingProduct?.stockByBranch"
      @updated="onProductUpdated"
    />

    <v-dialog v-model="removeDialogOpen" max-width="420">
      <v-card>
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Delete product</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          Are you sure you want to delete
          <strong>{{ productToRemove?.name }}</strong>? It will disappear
          from every branch's POS and Inventory list — its stock records are
          kept, and you can restore it any time from the Status filter above
          (set to "Deleted").
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />

          <v-btn variant="text" @click="closeRemoveDialog"> Cancel </v-btn>

          <v-btn
            color="error"
            :disabled="!onlineState.isOnline"
            :loading="deletingId === productToRemove?.id"
            variant="flat"
            @click="confirmDeleteProduct"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="importResultDialogOpen" max-width="480">
      <v-card>
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Import results</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="importResultDialogOpen = false" />
        </v-card-title>

        <v-divider />

        <v-card-text>
          <div class="mb-3">
            {{ importSummary?.created ?? 0 }} created, {{ importSummary?.updated ?? 0 }} updated.
          </div>

          <template v-if="importSummary?.errors.length">
            <div class="text-error font-weight-medium mb-2">
              {{ importSummary.errors.length }} row(s) skipped:
            </div>

            <ul class="import-error-list">
              <li v-for="err in importSummary.errors" :key="err.row">
                Row {{ err.row }}: {{ err.message }}
              </li>
            </ul>
          </template>
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />

          <v-btn color="primary" variant="flat" @click="importResultDialogOpen = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script lang="ts" setup>
  import type { ImportSummary } from '@/composables/useInventoryExcel'
  import type { BranchStockInput, InventoryProduct } from '@/composables/useSupabase'
  import type { BatchUnit, Category, Product } from '@/types/pos'
  import { computed, onMounted, ref } from 'vue'
  import ProductFormDialog from '@/components/ProductFormDialog.vue'
  import {
    exportInventoryToExcel,
    importInventoryFromExcel,
  } from '@/composables/useInventoryExcel'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import {
    deleteProductInventory,
    getBatchUnits,
    getCategories,
    getInventoryProducts,
    restoreProductInventory,
  } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency, formatPercent } from '@/utils/currency'
  import { marginColor } from '@/utils/margin'
  import { isLowStock } from '@/utils/stock'

  type StatusFilter = 'active' | 'deleted'

  const branchStore = useBranchStore()
  const toast = useToast()
  const { state: onlineState } = useOnline()
  const products = ref<InventoryProduct[]>([])
  const categories = ref<Category[]>([])
  const batchUnits = ref<BatchUnit[]>([])
  const loading = ref(true)
  const offlineNotice = ref('')
  const search = ref('')
  const statusFilter = ref<StatusFilter>('active')
  const errorMessage = ref('')
  const dialogOpen = ref(false)
  const editingProduct = ref<InventoryProduct | null>(null)
  const removeDialogOpen = ref(false)
  const productToRemove = ref<InventoryProduct | null>(null)
  const deletingId = ref<number | null>(null)
  const restoringId = ref<number | null>(null)
  const exporting = ref(false)
  const importing = ref(false)
  const importFileInputRef = ref<HTMLInputElement | null>(null)
  const importResultDialogOpen = ref(false)
  const importSummary = ref<ImportSummary | null>(null)

  const headers = [
    { title: 'Product', value: 'product', sortable: false },
    { title: 'Category', value: 'categoryName', sortable: true },
    { title: 'Price', value: 'priceCol', sortable: true },
    { title: 'Cost', value: 'costCol', sortable: false },
    { title: 'Margin', value: 'marginCol', sortable: false },
    { title: 'Stock', value: 'stockCol', sortable: false },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const
  const statusOptions = [
    { title: 'Active', value: 'active' },
    { title: 'Deleted', value: 'deleted' },
  ]

  const filteredProducts = computed(() => {
    const query = search.value.trim().toLowerCase()

    return products.value.filter(product => {
      const matchesSearch = query
        ? [product.name, product.code, product.barcode].some(value =>
          value.toLowerCase().includes(query),
        )
        : true
      const matchesStatus
        = statusFilter.value === 'active' ? !product.deletedAt : Boolean(product.deletedAt)

      return matchesSearch && matchesStatus
    })
  })

  function stockFor (product: InventoryProduct) {
    return product.stockByBranch[branchStore.activeBranchId ?? -1] ?? 0
  }

  function stockColor (stock: number, threshold: number | null) {
    if (stock === 0) return 'error'
    if (isLowStock(stock, threshold)) return 'warning'
    return 'success'
  }

  function marginFor (product: InventoryProduct) {
    if (product.cost == null || !product.price) return null
    return (product.price - product.cost) / product.price
  }

  function openEditDialog (product: InventoryProduct) {
    editingProduct.value = product
    dialogOpen.value = true
  }

  // Patches the newly updated product into the local list with the same
  // categoryName/batchUnitName client-side joins every other product in
  // `products` already carries.
  function enrichProduct (
    product: Product,
    stocks: BranchStockInput[],
  ): InventoryProduct {
    const categoryName = categories.value.find(c => c.id === product.categoryId)?.name ?? ''
    const matchedBatchUnit = batchUnits.value.find(bu => bu.id === product.batchUnitId)
    const stockByBranch: Record<number, number> = {}
    for (const { branchId, stock } of stocks) {
      stockByBranch[branchId] = stock
    }
    return {
      ...product,
      categoryName,
      batchUnitName: matchedBatchUnit?.name,
      stock: 0,
      stockByBranch,
    }
  }

  function onProductUpdated (product: Product, stocks: BranchStockInput[]) {
    const index = products.value.findIndex(item => item.id === product.id)
    if (index !== -1) {
      products.value[index] = enrichProduct(product, stocks)
    }
  }

  function openRemoveDialog (product: InventoryProduct) {
    productToRemove.value = product
    removeDialogOpen.value = true
  }

  function closeRemoveDialog () {
    removeDialogOpen.value = false
    productToRemove.value = null
  }

  // Soft-deletes the product from the whole catalog (every branch at once)
  // — there's no more per-branch/channel visibility toggle now that retail
  // vs wholesale selling doesn't exist. Stock records are kept, and it can
  // be brought back any time via restoreProduct() below (Status: Deleted).
  async function confirmDeleteProduct () {
    if (!productToRemove.value) return
    const { id, name } = productToRemove.value
    deletingId.value = id
    try {
      await deleteProductInventory(id)
      const target = products.value.find(p => p.id === id)
      if (target) target.deletedAt = new Date().toISOString()
      toast.show(`${name} deleted.`)
      closeRemoveDialog()
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to delete product.',
        'error',
      )
    } finally {
      deletingId.value = null
    }
  }

  // Global restore — only relevant to the rare, fully-soft-deleted product
  // (Status filter: "Deleted"), a legacy state no longer reachable from
  // this page's own Delete action above.
  async function restoreProduct (product: InventoryProduct) {
    restoringId.value = product.id
    try {
      await restoreProductInventory(product.id)
      const restored = products.value.find(item => item.id === product.id)
      if (restored) restored.deletedAt = null
      toast.show(`${product.name} restored.`)
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to restore product.',
        'error',
      )
    } finally {
      restoringId.value = null
    }
  }

  async function onExportClick () {
    exporting.value = true
    try {
      await exportInventoryToExcel(products.value, branchStore.branches)
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to export inventory.',
        'error',
      )
    } finally {
      exporting.value = false
    }
  }

  function triggerImportPicker () {
    importFileInputRef.value?.click()
  }

  async function onImportFileChange (event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    input.value = ''
    if (!file) return

    importing.value = true

    try {
      const summary = await importInventoryFromExcel(file, {
        categories: categories.value,
        batchUnits: batchUnits.value,
        branches: branchStore.branches,
        existingProducts: products.value,
      })
      await loadProducts()
      importSummary.value = summary
      importResultDialogOpen.value = true

      if (summary.errors.length === 0) {
        toast.show(`Import complete: ${summary.created} created, ${summary.updated} updated.`)
      } else {
        toast.show(`Import finished with ${summary.errors.length} row error(s).`, 'warning')
      }
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to import inventory.',
        'error',
      )
    } finally {
      importing.value = false
    }
  }

  async function loadProducts () {
    loading.value = true
    errorMessage.value = ''
    offlineNotice.value = ''

    try {
      const [categoryResult, batchUnitResult, productResult] = await Promise.all([
        cachedFetch('categories', getCategories, onlineState.isOnline),
        cachedFetch('batchUnits', getBatchUnits, onlineState.isOnline),
        cachedFetch('inventory', getInventoryProducts, onlineState.isOnline),
        branchStore.loadBranches(),
      ])
      categories.value = categoryResult.data
      batchUnits.value = batchUnitResult.data
      products.value = productResult.data
      if (categoryResult.fromCache || batchUnitResult.fromCache || productResult.fromCache) {
        const cachedAt = productResult.cachedAt ?? categoryResult.cachedAt ?? batchUnitResult.cachedAt
        offlineNotice.value = cachedAt
          ? `Offline — showing inventory as of ${new Date(cachedAt).toLocaleTimeString()}. Editing is disabled until reconnected.`
          : 'Offline — showing the last loaded inventory. Editing is disabled until reconnected.'
      }
    } catch (error) {
      errorMessage.value
        = error instanceof Error ? error.message : 'Unable to load inventory.'
    } finally {
      loading.value = false
    }
  }

  onMounted(loadProducts)
</script>
<style>
/* Mobile responsive adjustments */
@media (max-width: 600px) {
  /* Ensure data table can scroll horizontally */
  .v-data-table .v-data-table__wrapper {
    overflow-x: auto;
  }
  /* Stack filter inputs vertically */
  .filter-row {
    flex-direction: column;
    gap: 0.5rem;
  }
}
.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.import-error-list {
  max-height: 240px;
  overflow-y: auto;
  padding-left: 20px;
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
</style>
