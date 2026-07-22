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

      <v-col cols="12" md="3">
        <v-select
          v-model="visibilityFilter"
          density="comfortable"
          hide-details
          :items="visibilityOptions"
          :label="`Visibility in ${branchStore.activeBranch?.name ?? activeType}`"
          prepend-inner-icon="mdi-eye"
          variant="outlined"
        />
      </v-col>

      <v-col cols="12" md="3">
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
        <template v-if="activeType === 'wholesale'">
          <template v-if="item.batchPrice && item.batchSize">
            <span class="price-mono">{{ formatCurrency(item.batchPrice) }}</span>

            <div class="text-caption text-medium-emphasis">
              {{ item.batchSize }} / {{ item.batchUnitName ?? 'batch' }}
            </div>
          </template>

          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <span v-else class="price-mono">{{ formatCurrency(item.price) }}</span>
      </template>

      <template #item.stockCol="{ item }">
        <v-chip
          :color="stockColor(stockFor(item, activeType))"
          size="small"
          variant="tonal"
        >
          {{ stockFor(item, activeType) }}{{ activeType === 'wholesale' && item.batchUnitName ? ` ${item.batchUnitName}` : ' in stock' }}
        </v-chip>
      </template>

      <template #item.sellableHere="{ item }">
        <v-chip
          :color="isSellableHere(item) ? (activeType === 'wholesale' ? 'wholesale' : 'primary') : 'grey'"
          size="small"
          variant="tonal"
        >
          {{ isSellableHere(item) ? 'Sellable here' : 'Hidden here' }}
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

          <v-tooltip v-if="isSellableHere(item)" :text="onlineState.isOnline ? `Remove from ${branchStore.activeBranch?.name ?? activeType} inventory` : 'Reconnect to edit this product'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                aria-label="Remove from inventory"
                color="error"
                :disabled="!onlineState.isOnline"
                icon="mdi-archive-remove-outline"
                :loading="togglingSellableId === item.id"
                size="small"
                variant="text"
                @click="openRemoveDialog(item)"
              />
            </template>
          </v-tooltip>

          <v-tooltip v-else :text="onlineState.isOnline ? `Add to ${branchStore.activeBranch?.name ?? activeType} inventory` : 'Reconnect to edit this product'">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                aria-label="Add to inventory"
                color="primary"
                :disabled="!onlineState.isOnline"
                icon="mdi-archive-arrow-up-outline"
                :loading="togglingSellableId === item.id"
                size="small"
                variant="text"
                @click="addToInventory(item)"
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
          <span class="flex-grow-1">Remove from inventory</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          Are you sure you want to remove
          <strong>{{ productToRemove?.name }}</strong> from
          {{ branchStore.activeBranch?.name ?? activeType }}'s inventory? It
          will disappear from POS at this branch only — the product itself,
          its other branch's inventory, and its stock records are kept. You
          can add it back here any time.
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />

          <v-btn variant="text" @click="closeRemoveDialog"> Cancel </v-btn>

          <v-btn
            color="error"
            :disabled="!onlineState.isOnline"
            :loading="togglingSellableId === productToRemove?.id"
            variant="flat"
            @click="confirmRemoveFromInventory"
          >
            Remove
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
  import type { BranchStockInput, InventoryProduct, ProductInventoryPayload } from '@/composables/useSupabase'
  import type { BatchUnit, BranchType, Category, Product } from '@/types/pos'
  import { computed, onMounted, ref } from 'vue'
  import ProductFormDialog from '@/components/ProductFormDialog.vue'
  import {
    exportInventoryToExcel,
    importInventoryFromExcel,
  } from '@/composables/useInventoryExcel'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import {
    getBatchUnits,
    getCategories,
    getInventoryProducts,
    restoreProductInventory,
    updateProductInventory,
  } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'

  type VisibilityFilter = 'sellable' | 'hidden'
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
  // Defaults to only what's actually sellable in the active branch — the
  // list is scoped to the selected branch/channel by default, same as POS;
  // "Hidden here" is only for finding a product to enable for this branch.
  const visibilityFilter = ref<VisibilityFilter>('sellable')
  const statusFilter = ref<StatusFilter>('active')
  const errorMessage = ref('')
  const dialogOpen = ref(false)
  const editingProduct = ref<InventoryProduct | null>(null)
  const removeDialogOpen = ref(false)
  const productToRemove = ref<InventoryProduct | null>(null)
  const togglingSellableId = ref<number | null>(null)
  const restoringId = ref<number | null>(null)
  const exporting = ref(false)
  const importing = ref(false)
  const importFileInputRef = ref<HTMLInputElement | null>(null)
  const importResultDialogOpen = ref(false)
  const importSummary = ref<ImportSummary | null>(null)

  // Inventory follows the same active-branch split as POS: everything here
  // is scoped to whichever channel (retail/wholesale) is currently selected
  // in the branch switcher, rather than showing both channels merged in one
  // row/table.
  const activeType = computed<BranchType>(() => branchStore.isWholesale ? 'wholesale' : 'retail')

  const headers = computed(() => [
    { title: 'Product', value: 'product', sortable: false },
    { title: 'Category', value: 'categoryName', sortable: true },
    { title: activeType.value === 'wholesale' ? 'Batch Price' : 'Unit Price', value: 'priceCol', sortable: true },
    { title: activeType.value === 'wholesale' ? 'Wholesale Stock' : 'Retail Stock', value: 'stockCol', sortable: false },
    { title: 'Visibility', value: 'sellableHere', sortable: false },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const)
  const visibilityOptions = [
    { title: 'Sellable here', value: 'sellable' },
    { title: 'Hidden here', value: 'hidden' },
  ]
  const statusOptions = [
    { title: 'Active', value: 'active' },
    { title: 'Deleted', value: 'deleted' },
  ]

  function isSellableHere (product: Product) {
    return activeType.value === 'wholesale' ? product.sellableWholesale : product.sellableRetail
  }

  const filteredProducts = computed(() => {
    const query = search.value.trim().toLowerCase()

    return products.value.filter(product => {
      const matchesSearch = query
        ? [product.name, product.code, product.barcode].some(value =>
          value.toLowerCase().includes(query),
        )
        : true
      const matchesVisibility
        = visibilityFilter.value === 'sellable'
          ? isSellableHere(product)
          : !isSellableHere(product)
      const matchesStatus
        = statusFilter.value === 'active' ? !product.deletedAt : Boolean(product.deletedAt)

      return matchesSearch && matchesVisibility && matchesStatus
    })
  })

  function branchIdOf (type: BranchType) {
    return branchStore.branches.find(b => b.type === type)?.id ?? -1
  }

  function stockFor (product: InventoryProduct, type: BranchType) {
    return product.stockByBranch[branchIdOf(type)] ?? 0
  }

  function stockColor (stock: number) {
    if (stock === 0) return 'error'
    if (stock <= 5) return 'warning'
    return 'success'
  }

  function openEditDialog (product: InventoryProduct) {
    editingProduct.value = product
    dialogOpen.value = true
  }

  // Patches the newly created/updated product into the local list with the
  // same categoryName/batchUnitName/batchUnitUnit client-side joins every
  // other product in `products` already carries. costByBranch is preserved
  // from the existing row on update (editing master data never touches
  // cost) and starts empty for a genuinely new product.
  function enrichProduct (
    product: Product,
    stocks: BranchStockInput[],
    costByBranch: Record<number, number | null>,
  ): InventoryProduct {
    const categoryName = categories.value.find(c => c.id === product.categoryId)?.name ?? ''
    const matchedBatchUnit = batchUnits.value.find(bu => bu.id === product.batchUnitId)
    const stockByBranch: Record<number, number> = {}
    for (const { branchId, stock } of stocks) stockByBranch[branchId] = stock
    return {
      ...product,
      categoryName,
      batchUnitName: matchedBatchUnit?.name,
      batchUnitUnit: matchedBatchUnit?.unit,
      stock: 0,
      stockByBranch,
      costByBranch,
    }
  }

  function onProductUpdated (product: Product, stocks: BranchStockInput[]) {
    const index = products.value.findIndex(item => item.id === product.id)
    if (index !== -1) {
      products.value[index] = enrichProduct(product, stocks, products.value[index].costByBranch)
    }
  }

  function buildInventoryPayload (item: InventoryProduct): ProductInventoryPayload {
    return {
      name: item.name,
      code: item.code,
      barcode: item.barcode,
      categoryId: item.categoryId,
      price: item.price,
      batchUnitId: item.batchUnitId,
      batchSize: item.batchSize,
      batchPrice: item.batchPrice,
      sellableRetail: item.sellableRetail,
      sellableWholesale: item.sellableWholesale,
      image: item.image,
    }
  }

  // "Delete"/"Restore" here only ever flips the sellable flag for the
  // active branch's channel — never the product row's deletedAt — so
  // removing a product from one branch's inventory leaves it, its other
  // branch's inventory, and its stock records untouched.
  async function setSellableForActiveBranch (item: InventoryProduct, value: boolean): Promise<boolean> {
    togglingSellableId.value = item.id
    const payload = buildInventoryPayload(item)
    if (activeType.value === 'wholesale') payload.sellableWholesale = value
    else payload.sellableRetail = value

    try {
      await updateProductInventory({ id: item.id, ...payload }, [])
      const target = products.value.find(p => p.id === item.id)
      if (target) {
        if (activeType.value === 'wholesale') target.sellableWholesale = value
        else target.sellableRetail = value
      }
      return true
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to update inventory.',
        'error',
      )
      return false
    } finally {
      togglingSellableId.value = null
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

  async function confirmRemoveFromInventory () {
    if (!productToRemove.value) return
    const { name } = productToRemove.value
    const ok = await setSellableForActiveBranch(productToRemove.value, false)
    if (ok) {
      toast.show(`${name} removed from ${branchStore.activeBranch?.name ?? activeType.value} inventory.`)
      closeRemoveDialog()
    }
  }

  async function addToInventory (product: InventoryProduct) {
    const ok = await setSellableForActiveBranch(product, true)
    if (ok) {
      toast.show(`${product.name} added to ${branchStore.activeBranch?.name ?? activeType.value} inventory.`)
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
