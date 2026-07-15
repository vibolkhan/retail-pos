<template>
  <v-container class="py-6" fluid>
    <div
      style="
        display: flex;
        justify-content: flex-end;
        width: 100%;
        margin-bottom: 16px;
      "
    >
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        variant="flat"
        @click="openCreateDialog"
      >
        Create Product
      </v-btn>
    </div>

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
          v-model="channelFilter"
          density="comfortable"
          hide-details
          :items="channelOptions"
          label="Sales channel"
          prepend-inner-icon="mdi-eye"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <v-data-table
      class="pos-data-table"
      density="comfortable"
      elevation="1"
      :headers="headers"
      :items="filteredProducts"
      :items-per-page="10"
      :loading="loading"
      mobile-breakpoint="md"
      rounded="xl"
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

      <template #item.price="{ item }">
        {{ formatCurrency(item.price) }}
      </template>

      <template #item.batchPrice="{ item }">
        <template v-if="item.batchPrice && item.batchSize">
          {{ formatCurrency(item.batchPrice) }}
          <div class="text-caption text-medium-emphasis">
            {{ item.batchSize }} / {{ item.batchUnit ?? 'batch' }}
          </div>
        </template>

        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.retailStock="{ item }">
        <v-chip
          :color="stockColor(stockFor(item, 'retail'))"
          size="small"
          variant="tonal"
        >
          {{ stockFor(item, 'retail') }} in stock
        </v-chip>
      </template>

      <template #item.wholesaleStock="{ item }">
        <v-chip
          :color="stockColor(stockFor(item, 'wholesale'))"
          size="small"
          variant="tonal"
        >
          {{ stockFor(item, 'wholesale') }}{{ item.batchUnit ? ` ${item.batchUnit}` : '' }}
        </v-chip>
      </template>

      <template #item.channels="{ item }">
        <div class="d-flex ga-1">
          <v-chip
            :color="item.sellableRetail ? 'success' : 'grey'"
            size="small"
            variant="tonal"
          >
            Retail
          </v-chip>

          <v-chip
            :color="item.sellableWholesale ? 'info' : 'grey'"
            size="small"
            variant="tonal"
          >
            Wholesale
          </v-chip>
        </div>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip text="Edit product">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Edit product"
              color="primary"
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
          No products match the current inventory filters.
        </v-alert>
      </template>
    </v-data-table>

    <v-dialog v-model="dialogOpen" max-width="760">
      <v-card>
        <v-form @submit.prevent="saveDialogProduct">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">{{ dialogTitle }}</span>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.name"
                  density="comfortable"
                  label="Product name"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="form.code"
                  density="comfortable"
                  label="Code"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="form.barcode"
                  density="comfortable"
                  label="Barcode"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="form.categoryId"
                  density="comfortable"
                  item-title="name"
                  item-value="id"
                  :items="categories"
                  label="Category"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="form.price"
                  density="comfortable"
                  label="Unit price"
                  min="0"
                  prefix="$"
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-combobox
                  v-model="form.batchUnit"
                  density="comfortable"
                  :disabled="!form.sellableWholesale"
                  hint="Required when sold wholesale"
                  :items="batchUnitPresets"
                  label="Wholesale batch unit"
                  persistent-hint
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="form.batchSize"
                  density="comfortable"
                  :disabled="!form.sellableWholesale"
                  hint="Required when sold wholesale"
                  label="Units per batch"
                  min="1"
                  persistent-hint
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="form.batchPrice"
                  density="comfortable"
                  :disabled="!form.sellableWholesale"
                  hint="Required when sold wholesale"
                  label="Batch price"
                  min="0"
                  persistent-hint
                  prefix="$"
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col
                v-for="branch in branchStore.branches"
                :key="branch.id"
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model.number="form.stocks[branch.id]"
                  density="comfortable"
                  :label="`${branch.name} stock${branch.type === 'wholesale' ? ` (${form.batchUnit || 'batch'})` : ' (units)'}`"
                  min="0"
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="form.image"
                  density="comfortable"
                  label="Image URL"
                  prepend-inner-icon="mdi-image"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-switch
                  v-model="form.sellableRetail"
                  base-color="red"
                  class="custom-switch"
                  color="primary"
                  hide-details
                  inset
                  label="Sell in Retail Shop"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-switch
                  v-model="form.sellableWholesale"
                  base-color="red"
                  class="custom-switch"
                  color="primary"
                  hide-details
                  inset
                  label="Sell in Wholesale"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />

            <v-btn variant="text" @click="closeDialog"> Cancel </v-btn>

            <v-btn
              color="primary"
              :loading="saving"
              type="submit"
              variant="flat"
            >
              {{ dialogMode === "create" ? "Create" : "Update" }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
  import type {
    BranchStockInput,
    InventoryProduct,
    ProductInventoryPayload,
  } from '@/composables/useSupabase'
  import type { BranchType, Category } from '@/types/pos'
  import { computed, onMounted, reactive, ref } from 'vue'
  import {
    createProductInventory,
    getCategories,
    getInventoryProducts,
    updateProductInventory,
  } from '@/composables/useSupabase'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'

  type DialogMode = 'create' | 'edit'
  type ChannelFilter = 'all' | 'retail' | 'wholesale' | 'both' | 'hidden'

  interface ProductForm {
    id: number | null
    name: string
    code: string
    barcode: string
    categoryId: number | null
    price: number
    batchUnit: string | null
    batchSize: number | null
    batchPrice: number | null
    sellableRetail: boolean
    sellableWholesale: boolean
    stocks: Record<number, number>
    image: string
  }

  const batchUnitPresets = ['Case', 'Box', 'Pack', 'Dozen', 'Bundle']

  const branchStore = useBranchStore()
  const products = ref<InventoryProduct[]>([])
  const categories = ref<Category[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const search = ref('')
  const channelFilter = ref<ChannelFilter>('all')
  const errorMessage = ref('')
  const dialogOpen = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const form = reactive<ProductForm>(emptyForm())
  const snackbar = reactive({
    show: false,
    message: '',
    color: 'success',
  })

  const headers = [
    { title: 'Product', value: 'product', sortable: false },
    { title: 'Category', value: 'categoryName', sortable: true },
    { title: 'Unit Price', value: 'price', sortable: true },
    { title: 'Batch Price', value: 'batchPrice', sortable: true },
    { title: 'Retail Stock', value: 'retailStock', sortable: false },
    { title: 'Wholesale Stock', value: 'wholesaleStock', sortable: false },
    { title: 'Channels', value: 'channels', sortable: false },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const
  const channelOptions = [
    { title: 'All products', value: 'all' },
    { title: 'Retail only', value: 'retail' },
    { title: 'Wholesale only', value: 'wholesale' },
    { title: 'Both channels', value: 'both' },
    { title: 'Hidden (neither)', value: 'hidden' },
  ]

  const dialogTitle = computed(() =>
    dialogMode.value === 'create' ? 'Create product' : 'Edit product',
  )

  const filteredProducts = computed(() => {
    const query = search.value.trim().toLowerCase()

    return products.value.filter(product => {
      const matchesSearch = query
        ? [product.name, product.code, product.barcode].some(value =>
          value.toLowerCase().includes(query),
        )
        : true
      const matchesChannel
        = channelFilter.value === 'all'
          || (channelFilter.value === 'retail' && product.sellableRetail && !product.sellableWholesale)
          || (channelFilter.value === 'wholesale' && product.sellableWholesale && !product.sellableRetail)
          || (channelFilter.value === 'both' && product.sellableRetail && product.sellableWholesale)
          || (channelFilter.value === 'hidden' && !product.sellableRetail && !product.sellableWholesale)

      return matchesSearch && matchesChannel
    })
  })

  function emptyForm (): ProductForm {
    const stocks: Record<number, number> = {}
    for (const branch of branchStore.branches) stocks[branch.id] = 0
    return {
      id: null,
      name: '',
      code: '',
      barcode: '',
      categoryId: null,
      price: 0,
      batchUnit: null,
      batchSize: null,
      batchPrice: null,
      sellableRetail: true,
      sellableWholesale: false,
      stocks,
      image: '',
    }
  }

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

  function showMessage (message: string, color = 'success') {
    snackbar.message = message
    snackbar.color = color
    snackbar.show = true
  }

  function closeDialog () {
    dialogOpen.value = false
  }

  function openCreateDialog () {
    dialogMode.value = 'create'
    Object.assign(form, emptyForm())
    dialogOpen.value = true
  }

  function openEditDialog (product: InventoryProduct) {
    dialogMode.value = 'edit'
    const stocks: Record<number, number> = {}
    for (const branch of branchStore.branches) {
      stocks[branch.id] = product.stockByBranch[branch.id] ?? 0
    }
    Object.assign(form, {
      id: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      categoryId: product.categoryId,
      price: product.price,
      batchUnit: product.batchUnit,
      batchSize: product.batchSize,
      batchPrice: product.batchPrice,
      sellableRetail: product.sellableRetail,
      sellableWholesale: product.sellableWholesale,
      stocks,
      image: product.image,
    })
    dialogOpen.value = true
  }

  interface PayloadWithStocks {
    payload: ProductInventoryPayload
    stocks: BranchStockInput[]
  }

  function buildPayload (): PayloadWithStocks | null {
    const categoryId = Number(form.categoryId)
    const price = Number(form.price)
    // Empty number fields come back as '' or null – normalize to null
    const batchUnit = typeof form.batchUnit === 'string' && form.batchUnit.trim()
      ? form.batchUnit.trim()
      : null
    const batchSize = form.batchSize === null || (form.batchSize as unknown) === ''
      ? null
      : Number(form.batchSize)
    const batchPrice = form.batchPrice === null || (form.batchPrice as unknown) === ''
      ? null
      : Number(form.batchPrice)

    if (!form.name.trim()) {
      showMessage('Product name is required.', 'warning')
      return null
    }
    if (!form.code.trim()) {
      showMessage('Product code is required.', 'warning')
      return null
    }
    if (!form.barcode.trim()) {
      showMessage('Barcode is required.', 'warning')
      return null
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      showMessage('Category is required.', 'warning')
      return null
    }
    if (!Number.isFinite(price) || price < 0) {
      showMessage('Price must be zero or higher.', 'warning')
      return null
    }
    if (!form.sellableRetail && !form.sellableWholesale) {
      showMessage('Enable at least one of Sell in Retail Shop or Sell in Wholesale.', 'warning')
      return null
    }
    if (form.sellableWholesale) {
      if (!batchUnit) {
        showMessage('Wholesale batch unit is required when sold wholesale.', 'warning')
        return null
      }
      if (batchSize === null || !Number.isInteger(batchSize) || batchSize < 1) {
        showMessage('Units per batch must be a whole number of at least 1.', 'warning')
        return null
      }
      if (batchPrice === null || !Number.isFinite(batchPrice) || batchPrice < 0) {
        showMessage('Batch price must be zero or higher.', 'warning')
        return null
      }
    }

    const stocks: BranchStockInput[] = []
    for (const branch of branchStore.branches) {
      const stock = Number(form.stocks[branch.id] ?? 0)
      if (!Number.isInteger(stock) || stock < 0) {
        showMessage(
          `${branch.name} stock must be a non-negative whole number.`,
          'warning',
        )
        return null
      }
      stocks.push({ branchId: branch.id, stock })
    }

    if (!form.image.trim()) {
      showMessage('Product image is required.', 'warning')
      return null
    }

    return {
      payload: {
        name: form.name.trim(),
        code: form.code.trim(),
        barcode: form.barcode.trim(),
        categoryId,
        price,
        // Clear stale batch data when wholesale is switched off
        batchUnit: form.sellableWholesale ? batchUnit : null,
        batchSize: form.sellableWholesale ? batchSize : null,
        batchPrice: form.sellableWholesale ? batchPrice : null,
        sellableRetail: form.sellableRetail,
        sellableWholesale: form.sellableWholesale,
        image: form.image.trim(),
      },
      stocks,
    }
  }

  async function loadProducts () {
    loading.value = true
    errorMessage.value = ''

    try {
      const [categoryRows, productRows] = await Promise.all([
        getCategories(),
        getInventoryProducts(),
        branchStore.loadBranches(),
      ])
      categories.value = categoryRows
      products.value = productRows
    } catch (error) {
      errorMessage.value
        = error instanceof Error ? error.message : 'Unable to load inventory.'
    } finally {
      loading.value = false
    }
  }

  async function saveDialogProduct () {
    const built = buildPayload()
    if (!built) return
    const { payload, stocks } = built

    saving.value = true

    try {
      const categoryName
        = categories.value.find(category => category.id === payload.categoryId)
          ?.name ?? ''
      const stockByBranch: Record<number, number> = {}
      for (const { branchId, stock } of stocks) stockByBranch[branchId] = stock

      if (dialogMode.value === 'create') {
        const createdProduct = await createProductInventory(payload, stocks)
        products.value = [
          ...products.value,
          { ...createdProduct, categoryName, stock: 0, stockByBranch },
        ]
        showMessage(`${createdProduct.name} created.`)
      } else if (form.id) {
        const updatedProduct = await updateProductInventory(
          { id: form.id, ...payload },
          stocks,
        )
        const index = products.value.findIndex(
          item => item.id === updatedProduct.id,
        )
        if (index !== -1) {
          products.value[index] = {
            ...updatedProduct,
            categoryName,
            stock: 0,
            stockByBranch,
          }
        }
        showMessage(`${updatedProduct.name} updated.`)
      }

      closeDialog()
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Unable to save product.',
        'error',
      )
    } finally {
      saving.value = false
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
.custom-switch {
  --v-switch-track-color: red !important;
  --v-switch-track-color-active: var(--v-theme-primary) !important;
}
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
