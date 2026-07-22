<template>
  <v-dialog v-model="dialogModel" max-width="840">
    <v-card>
      <v-form @submit.prevent="saveDialogProduct">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">{{ dialogTitle }}</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
        </v-card-title>

        <v-divider />

        <v-card-text class="form-dialog-body">
          <template v-if="showDetailsSection">
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
          </template>

          <template v-if="showPricingSection">
            <v-divider v-if="showDetailsSection" class="form-section-divider" />

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
                    @update:model-value="onUnitPriceChanged"
                  />
                </v-col>

                <template v-if="form.sellableWholesale">
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="form.batchUnitId"
                      density="comfortable"
                      :hint="selectedBatchUnit ? `${selectedBatchUnit.unit} units per batch` : ''"
                      :item-title="batchUnitLabel"
                      item-value="id"
                      :items="batchUnits"
                      persistent-hint
                      variant="outlined"
                      @update:model-value="onBatchUnitSelected"
                    >
                      <template #label>
                        Wholesale batch unit <span class="required-asterisk">*</span>
                      </template>
                    </v-select>
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
                </template>
              </v-row>
            </section>
          </template>

          <template v-if="showStockSection">
            <v-divider v-if="showDetailsSection || showPricingSection" class="form-section-divider" />

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
                    :label="`${branch.name} stock${branch.type === 'wholesale' ? ` (${selectedBatchUnit?.name || 'batch'})` : ' (units)'}`"
                    min="0"
                    :prepend-inner-icon="branch.type === 'wholesale' ? 'mdi-warehouse' : 'mdi-store-outline'"
                    type="number"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </section>
          </template>
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />

          <v-btn variant="text" @click="closeDialog"> Cancel </v-btn>

          <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to save this product">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                color="primary"
                :disabled="!onlineState.isOnline"
                :loading="saving"
                type="submit"
                v-bind="tooltipProps"
                variant="flat"
              >
                {{ mode === "create" ? "Create" : "Update" }}
              </v-btn>
            </template>
          </v-tooltip>
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
</template>

<script lang="ts" setup>
  import type { BranchStockInput } from '@/composables/useSupabase'
  import type { BatchUnit, Branch, Category, Product } from '@/types/pos'
  import { ref, toRef, watch } from 'vue'
  import { Cropper } from 'vue-advanced-cropper'
  import { useOnline } from '@/composables/useOnline'
  import { useProductForm } from '@/composables/useProductForm'
  import { useToast } from '@/composables/useToast'
  import 'vue-advanced-cropper/dist/style.css'

  const props = withDefaults(
    defineProps<{
      product?: Product | null
      stockByBranch?: Record<number, number>
      showStockSection?: boolean
      showPricingSection?: boolean
      // Product catalog identity (name/code/barcode/category/image) — false
      // on Inventory, which only edits price/channels/batch/stock and must
      // never touch catalog identity; true (default) on Configuration >
      // Products, the only place that owns it.
      showDetailsSection?: boolean
      categories: Category[]
      // Optional — only meaningful (and only need be passed) when
      // showPricingSection is true.
      batchUnits?: BatchUnit[]
      // Optional — only meaningful (and only need be passed) when
      // showStockSection is true.
      branches?: Branch[]
    }>(),
    {
      product: null,
      stockByBranch: () => ({}),
      showStockSection: true,
      showPricingSection: true,
      showDetailsSection: true,
      batchUnits: () => [],
      branches: () => [],
    },
  )

  const emit = defineEmits<{
    created: [product: Product, stocks: BranchStockInput[]]
    updated: [product: Product, stocks: BranchStockInput[]]
  }>()

  const dialogModel = defineModel<boolean>({ required: true })

  const toast = useToast()
  const { state: onlineState } = useOnline()

  function batchUnitLabel (batchUnit: BatchUnit) {
    return `${batchUnit.name} (${batchUnit.unit})`
  }

  const {
    form,
    mode,
    saving,
    imageFile: _imageFile,
    imagePreviewUrl,
    selectedBatchUnit,
    visibleStockBranches,
    loadForCreate,
    loadForEdit,
    resetImageState,
    setCroppedImage,
    onBatchUnitSelected,
    onUnitPriceChanged,
    submit,
  } = useProductForm({
    categories: toRef(props, 'categories'),
    batchUnits: toRef(props, 'batchUnits'),
    branches: toRef(props, 'branches'),
    includeStock: props.showStockSection,
    includePricing: props.showPricingSection,
  })

  const dialogTitle = ref('')

  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isImageDragOver = ref(false)
  const cropDialogOpen = ref(false)
  const cropSourceUrl = ref<string | null>(null)
  const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
  let cropSourceObjectUrl: string | null = null
  const CROP_OUTPUT_SIZE = 640

  watch(
    dialogModel,
    open => {
      if (!open) return
      closeCropDialog()
      if (props.product) {
        loadForEdit(props.product, props.stockByBranch ?? {})
        dialogTitle.value = 'Edit product'
      } else {
        loadForCreate()
        dialogTitle.value = 'Create product'
      }
    },
    { immediate: true },
  )

  function closeDialog () {
    dialogModel.value = false
    resetImageState()
    closeCropDialog()
  }

  function closeCropDialog () {
    cropDialogOpen.value = false
    if (cropSourceObjectUrl) {
      URL.revokeObjectURL(cropSourceObjectUrl)
      cropSourceObjectUrl = null
    }
    cropSourceUrl.value = null
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

    setCroppedImage(new File([blob], 'product-image.jpg', { type: 'image/jpeg' }))
    closeCropDialog()
  }

  async function saveDialogProduct () {
    const wasCreate = mode.value === 'create'
    const result = await submit()
    if (!result) return

    toast.show(`${result.product.name} ${wasCreate ? 'created' : 'updated'}.`)
    emit(wasCreate ? 'created' : 'updated', result.product, result.stocks)
    dialogModel.value = false
    resetImageState()
    closeCropDialog()
  }
</script>

<style scoped>
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
</style>
