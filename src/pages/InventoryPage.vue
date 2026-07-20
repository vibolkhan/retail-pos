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

      <v-col cols="12" md="3">
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

    <v-data-table
      class="pos-data-table"
      density="comfortable"
      elevation="1"
      :headers="headers"
      :items="filteredProducts"
      :items-per-page="10"
      :loading="loading"
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

      <template #item.price="{ item }">
        <span class="price-mono">{{ formatCurrency(item.price) }}</span>
      </template>

      <template #item.batchPrice="{ item }">
        <template v-if="item.batchPrice && item.batchSize">
          <span class="price-mono">{{ formatCurrency(item.batchPrice) }}</span>

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
            :color="item.sellableRetail ? 'primary' : 'grey'"
            size="small"
            variant="tonal"
          >
            Retail
          </v-chip>

          <v-chip
            :color="item.sellableWholesale ? 'wholesale' : 'grey'"
            size="small"
            variant="tonal"
          >
            Wholesale
          </v-chip>
        </div>
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
                size="small"
                variant="text"
                @click="openDeleteDialog(item)"
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

    <v-dialog v-model="dialogOpen" max-width="840">
      <v-card>
        <v-form @submit.prevent="saveDialogProduct">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">{{ dialogTitle }}</span>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
          </v-card-title>

          <v-divider />

          <v-card-text class="form-dialog-body">
            <section class="form-section">
              <div class="form-section-header">
                <v-icon icon="mdi-information-outline" size="18" />
                <span>Product details</span>
              </div>

              <v-row>
                <v-col class="d-flex justify-center" cols="12" md="4">
                  <div
                    class="image-dropzone"
                    :class="{ 'has-image': imagePreviewUrl, 'is-dragover': isImageDragOver }"
                    role="button"
                    tabindex="0"
                    @click="triggerFilePicker"
                    @dragleave.prevent="isImageDragOver = false"
                    @dragover.prevent="isImageDragOver = true"
                    @drop.prevent="onImageDrop"
                    @keydown.enter="triggerFilePicker"
                  >
                    <input
                      ref="fileInputRef"
                      accept="image/*"
                      class="hidden"
                      type="file"
                      @change="onFileInputChange"
                    >

                    <template v-if="imagePreviewUrl">
                      <v-img class="image-dropzone-preview" cover :src="imagePreviewUrl" />

                      <div class="image-dropzone-overlay">
                        <v-icon icon="mdi-image-edit-outline" size="24" />
                        <span class="text-caption font-weight-medium">Change photo</span>
                      </div>
                    </template>

                    <template v-else>
                      <v-icon class="opacity-50" icon="mdi-tray-arrow-up" size="32" />

                      <div class="text-caption font-weight-medium mt-2">
                        Drag &amp; drop, or click to browse
                      </div>

                      <div class="text-caption text-medium-emphasis mt-1 px-2">
                        PNG or JPG, cropped to a square
                      </div>
                    </template>
                  </div>
                </v-col>

                <v-col cols="12" md="8">
                  <v-row>
                    <v-col cols="12">
                      <v-text-field
                        v-model="form.name"
                        density="comfortable"
                        label="Product name"
                        variant="outlined"
                      />
                    </v-col>

                    <v-col cols="6">
                      <v-text-field
                        v-model="form.code"
                        density="comfortable"
                        label="Code"
                        variant="outlined"
                      />
                    </v-col>

                    <v-col cols="6">
                      <v-text-field
                        v-model="form.barcode"
                        density="comfortable"
                        label="Barcode"
                        variant="outlined"
                      />
                    </v-col>

                    <v-col cols="12">
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
                  </v-row>
                </v-col>
              </v-row>
            </section>

            <v-divider class="form-section-divider" />

            <section class="form-section">
              <div class="form-section-header">
                <v-icon icon="mdi-storefront-outline" size="18" />
                <span>Sales channels</span>
              </div>

              <v-row>
                <v-col cols="12" md="6">
                  <label class="channel-toggle" :class="{ 'is-active': form.sellableRetail }">
                    <div>
                      <div class="font-weight-medium">Retail shop</div>

                      <div class="text-caption text-medium-emphasis">
                        Sold by the unit to walk-in customers
                      </div>
                    </div>

                    <v-switch
                      v-model="form.sellableRetail"
                      color="primary"
                      hide-details
                      inset
                    />
                  </label>
                </v-col>

                <v-col cols="12" md="6">
                  <label class="channel-toggle" :class="{ 'is-active': form.sellableWholesale }">
                    <div>
                      <div class="font-weight-medium">Wholesale</div>

                      <div class="text-caption text-medium-emphasis">
                        Sold by the batch to bulk buyers
                      </div>
                    </div>

                    <v-switch
                      v-model="form.sellableWholesale"
                      color="wholesale"
                      hide-details
                      inset
                    />
                  </label>
                </v-col>
              </v-row>
            </section>

            <v-divider class="form-section-divider" />

            <section class="form-section">
              <div class="form-section-header">
                <v-icon icon="mdi-currency-usd" size="18" />
                <span>Pricing</span>
              </div>

              <v-row>
                <v-col cols="12" :md="form.sellableWholesale ? 4 : 6">
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
              </v-row>

              <v-expand-transition>
                <v-row v-if="form.sellableWholesale">
                  <v-col cols="12" md="4">
                    <v-combobox
                      v-model="form.batchUnit"
                      density="comfortable"
                      :items="batchUnitPresets"
                      variant="outlined"
                    >
                      <template #label>
                        Wholesale batch unit <span class="required-asterisk">*</span>
                      </template>
                    </v-combobox>
                  </v-col>

                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model.number="form.batchSize"
                      density="comfortable"
                      min="1"
                      type="number"
                      variant="outlined"
                    >
                      <template #label>
                        Units per batch <span class="required-asterisk">*</span>
                      </template>
                    </v-text-field>
                  </v-col>

                  <v-col cols="12" md="4">
                    <v-text-field
                      v-model.number="form.batchPrice"
                      density="comfortable"
                      min="0"
                      prefix="$"
                      type="number"
                      variant="outlined"
                    >
                      <template #label>
                        Batch price <span class="required-asterisk">*</span>
                      </template>
                    </v-text-field>
                  </v-col>
                </v-row>
              </v-expand-transition>
            </section>

            <v-divider class="form-section-divider" />

            <section class="form-section">
              <div class="form-section-header">
                <v-icon icon="mdi-warehouse" size="18" />
                <span>Stock by branch</span>
              </div>

              <v-row>
                <v-col
                  v-for="branch in visibleStockBranches"
                  :key="branch.id"
                  cols="12"
                  md="4"
                >
                  <v-text-field
                    v-model.number="form.stocks[branch.id]"
                    density="comfortable"
                    :label="`${branch.name} stock${branch.type === 'wholesale' ? ` (${form.batchUnit || 'batch'})` : ' (units)'}`"
                    min="0"
                    :prepend-inner-icon="branch.type === 'wholesale' ? 'mdi-warehouse' : 'mdi-store-outline'"
                    type="number"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </section>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />

            <v-btn variant="text" @click="closeDialog"> Cancel </v-btn>

            <v-btn
              color="primary"
              :disabled="!onlineState.isOnline"
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

    <v-dialog v-model="cropDialogOpen" max-width="480" persistent>
      <v-card>
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Crop image</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="cancelCrop" />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <div class="cropper-wrap">
            <cropper
              v-if="cropSourceUrl"
              ref="cropperRef"
              class="cropper"
              :src="cropSourceUrl"
              :stencil-props="{ aspectRatio: 1 }"
            />
          </div>

          <div class="text-caption text-medium-emphasis mt-2">
            Drag to reposition, resize the square to crop.
          </div>
        </v-card-text>

        <v-card-actions class="px-4 pb-4">
          <v-spacer />

          <v-btn variant="text" @click="cancelCrop"> Cancel </v-btn>

          <v-btn color="primary" variant="flat" @click="applyCrop">
            Apply crop
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialogOpen" max-width="420">
      <v-card>
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Delete product</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          Are you sure you want to delete
          <strong>{{ productToDelete?.name }}</strong>? It will disappear from
          the POS and inventory list, but its stock records are kept — you
          can restore it later from the "Deleted" status filter.
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />

          <v-btn variant="text" @click="closeDeleteDialog"> Cancel </v-btn>

          <v-btn
            color="error"
            :disabled="!onlineState.isOnline"
            :loading="deleting"
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
  import type {
    BranchStockInput,
    InventoryProduct,
    ProductInventoryPayload,
  } from '@/composables/useSupabase'
  import type { BranchType, Category } from '@/types/pos'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { Cropper } from 'vue-advanced-cropper'
  import {
    exportInventoryToExcel,
    importInventoryFromExcel,
  } from '@/composables/useInventoryExcel'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import {
    createProductInventory,
    deleteProductInventory,
    getCategories,
    getInventoryProducts,
    restoreProductInventory,
    updateProductInventory,
    uploadProductImage,
  } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'
  import 'vue-advanced-cropper/dist/style.css'

  type DialogMode = 'create' | 'edit'
  type ChannelFilter = 'all' | 'retail' | 'wholesale' | 'both' | 'hidden'
  type StatusFilter = 'active' | 'deleted'

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
  const toast = useToast()
  const { state: onlineState } = useOnline()
  const products = ref<InventoryProduct[]>([])
  const categories = ref<Category[]>([])
  const loading = ref(true)
  const offlineNotice = ref('')
  const saving = ref(false)
  const search = ref('')
  const channelFilter = ref<ChannelFilter>('all')
  const statusFilter = ref<StatusFilter>('active')
  const errorMessage = ref('')
  const dialogOpen = ref(false)
  const dialogMode = ref<DialogMode>('create')
  const form = reactive<ProductForm>(emptyForm())
  const deleteDialogOpen = ref(false)
  const productToDelete = ref<InventoryProduct | null>(null)
  const deleting = ref(false)
  const restoringId = ref<number | null>(null)
  const exporting = ref(false)
  const importing = ref(false)
  const importFileInputRef = ref<HTMLInputElement | null>(null)
  const importResultDialogOpen = ref(false)
  const importSummary = ref<ImportSummary | null>(null)
  const imageFile = ref<File | null>(null)
  const imagePreviewUrl = ref<string | null>(null)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isImageDragOver = ref(false)
  let imageObjectUrl: string | null = null
  const cropDialogOpen = ref(false)
  const cropSourceUrl = ref<string | null>(null)
  const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
  let cropSourceObjectUrl: string | null = null
  const CROP_OUTPUT_SIZE = 640

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
  const statusOptions = [
    { title: 'Active', value: 'active' },
    { title: 'Deleted', value: 'deleted' },
  ]

  const dialogTitle = computed(() =>
    dialogMode.value === 'create' ? 'Create product' : 'Edit product',
  )

  const visibleStockBranches = computed(() =>
    branchStore.branches.filter(branch =>
      branch.type === 'wholesale' ? form.sellableWholesale : form.sellableRetail,
    ),
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
      const matchesStatus
        = statusFilter.value === 'active' ? !product.deletedAt : Boolean(product.deletedAt)

      return matchesSearch && matchesChannel && matchesStatus
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

  function closeCropDialog () {
    cropDialogOpen.value = false
    if (cropSourceObjectUrl) {
      URL.revokeObjectURL(cropSourceObjectUrl)
      cropSourceObjectUrl = null
    }
    cropSourceUrl.value = null
  }

  function resetImageState (initialUrl: string | null = null) {
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl)
      imageObjectUrl = null
    }
    imageFile.value = null
    imagePreviewUrl.value = initialUrl
    closeCropDialog()
  }

  // Picking/dropping a file only stages the raw file – the actual image
  // comes from the crop dialog once the user confirms a selection
  function handleImageFile (file: File | null) {
    if (!file) return

    if (cropSourceObjectUrl) {
      URL.revokeObjectURL(cropSourceObjectUrl)
    }
    cropSourceObjectUrl = URL.createObjectURL(file)
    cropSourceUrl.value = cropSourceObjectUrl
    cropDialogOpen.value = true
  }

  function triggerFilePicker () {
    fileInputRef.value?.click()
  }

  function onFileInputChange (event: Event) {
    const input = event.target as HTMLInputElement
    handleImageFile(input.files?.[0] ?? null)
    input.value = ''
  }

  function onImageDrop (event: DragEvent) {
    isImageDragOver.value = false
    handleImageFile(event.dataTransfer?.files?.[0] ?? null)
  }

  function cancelCrop () {
    closeCropDialog()
  }

  async function applyCrop () {
    const result = cropperRef.value?.getResult()
    if (!result?.canvas) return

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = CROP_OUTPUT_SIZE
    outputCanvas.height = CROP_OUTPUT_SIZE
    const context = outputCanvas.getContext('2d')
    if (!context) return
    context.drawImage(result.canvas, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE)

    const blob = await new Promise<Blob | null>(resolve =>
      outputCanvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob) {
      toast.show('Unable to process the cropped image.', 'error')
      return
    }

    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl)
    }
    imageFile.value = new File([blob], 'product-image.jpg', { type: 'image/jpeg' })
    imageObjectUrl = URL.createObjectURL(blob)
    imagePreviewUrl.value = imageObjectUrl

    closeCropDialog()
  }

  function closeDialog () {
    dialogOpen.value = false
    resetImageState()
  }

  function openCreateDialog () {
    dialogMode.value = 'create'
    Object.assign(form, emptyForm())
    resetImageState()
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
    resetImageState(product.image || null)
    dialogOpen.value = true
  }

  function openDeleteDialog (product: InventoryProduct) {
    productToDelete.value = product
    deleteDialogOpen.value = true
  }

  function closeDeleteDialog () {
    deleteDialogOpen.value = false
    productToDelete.value = null
  }

  async function confirmDeleteProduct () {
    if (!productToDelete.value) return

    deleting.value = true

    try {
      await deleteProductInventory(productToDelete.value.id)
      const deleted = products.value.find(item => item.id === productToDelete.value?.id)
      if (deleted) deleted.deletedAt = new Date().toISOString()
      toast.show(`${productToDelete.value.name} deleted.`)
      closeDeleteDialog()
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to delete product.',
        'error',
      )
    } finally {
      deleting.value = false
    }
  }

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
      toast.show('Product name is required.', 'warning')
      return null
    }
    if (!form.code.trim()) {
      toast.show('Product code is required.', 'warning')
      return null
    }
    if (!form.barcode.trim()) {
      toast.show('Barcode is required.', 'warning')
      return null
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      toast.show('Category is required.', 'warning')
      return null
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.show('Price must be zero or higher.', 'warning')
      return null
    }
    if (!form.sellableRetail && !form.sellableWholesale) {
      toast.show('Enable at least one of Sell in Retail Shop or Sell in Wholesale.', 'warning')
      return null
    }
    if (form.sellableWholesale) {
      if (!batchUnit) {
        toast.show('Wholesale batch unit is required when sold wholesale.', 'warning')
        return null
      }
      if (batchSize === null || !Number.isInteger(batchSize) || batchSize < 1) {
        toast.show('Units per batch must be a whole number of at least 1.', 'warning')
        return null
      }
      if (batchPrice === null || !Number.isFinite(batchPrice) || batchPrice < 0) {
        toast.show('Batch price must be zero or higher.', 'warning')
        return null
      }
    }

    const stocks: BranchStockInput[] = []
    for (const branch of branchStore.branches) {
      const stock = Number(form.stocks[branch.id] ?? 0)
      if (!Number.isInteger(stock) || stock < 0) {
        toast.show(
          `${branch.name} stock must be a non-negative whole number.`,
          'warning',
        )
        return null
      }
      stocks.push({ branchId: branch.id, stock })
    }

    if (!form.image.trim()) {
      toast.show('Product image is required.', 'warning')
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
    offlineNotice.value = ''

    try {
      const [categoryResult, productResult] = await Promise.all([
        cachedFetch('categories', getCategories, onlineState.isOnline),
        cachedFetch('inventory', getInventoryProducts, onlineState.isOnline),
        branchStore.loadBranches(),
      ])
      categories.value = categoryResult.data
      products.value = productResult.data
      if (categoryResult.fromCache || productResult.fromCache) {
        const cachedAt = productResult.cachedAt ?? categoryResult.cachedAt
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

  async function saveDialogProduct () {
    saving.value = true

    if (imageFile.value) {
      try {
        form.image = await uploadProductImage(imageFile.value)
      } catch (error) {
        saving.value = false
        toast.show(
          error instanceof Error ? error.message : 'Unable to upload image.',
          'error',
        )
        return
      }
    }

    const built = buildPayload()
    if (!built) {
      saving.value = false
      return
    }
    const { payload, stocks } = built

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
        toast.show(`${createdProduct.name} created.`)
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
        toast.show(`${updatedProduct.name} updated.`)
      }

      closeDialog()
    } catch (error) {
      toast.show(
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
.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.required-asterisk {
  color: rgb(var(--v-theme-error));
}
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.form-dialog-body {
  padding-top: 20px;
}
.form-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.form-section-divider {
  margin-block: 8px 24px;
}
.channel-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1.5px solid rgba(var(--v-theme-on-surface), 0.12);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.channel-toggle:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
}
.channel-toggle.is-active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}
.cropper-wrap {
  height: 360px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 8px;
  overflow: hidden;
}
.cropper {
  height: 100%;
  width: 100%;
}
.image-dropzone {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 220px;
  aspect-ratio: 1 / 1;
  margin-inline: auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 12px;
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.24);
  background: rgba(var(--v-theme-on-surface), 0.03);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.image-dropzone:hover,
.image-dropzone:focus-visible {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
  outline: none;
}
.image-dropzone.is-dragover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}
.image-dropzone.has-image {
  border-style: solid;
  border-color: rgba(var(--v-theme-on-surface), 0.12);
}
.image-dropzone-preview {
  position: absolute;
  inset: 0;
}
.image-dropzone-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: white;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.image-dropzone.has-image:hover .image-dropzone-overlay,
.image-dropzone.has-image:focus-visible .image-dropzone-overlay {
  opacity: 1;
}
.import-error-list {
  max-height: 240px;
  overflow-y: auto;
  padding-left: 20px;
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
</style>
