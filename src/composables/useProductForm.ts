import type { BranchStockInput, ProductInventoryPayload } from '@/composables/useSupabase'
import type { BatchUnit, Branch, Category, Product } from '@/types/pos'
import type { Ref } from 'vue'
import { computed, reactive, ref } from 'vue'
import {
  createProductInventory,
  updateProductInventory,
  uploadProductImage,
} from '@/composables/useSupabase'
import { useToast } from '@/composables/useToast'

export interface ProductFormState {
  id: number | null
  name: string
  code: string
  barcode: string
  categoryId: number | null
  supplierId: number | null
  price: number
  batchUnitId: number | null
  batchPrice: number | null
  sellableRetail: boolean
  sellableWholesale: boolean
  stocks: Record<number, number>
  image: string
}

export interface UseProductFormOptions {
  categories: Ref<Category[]>
  batchUnits: Ref<BatchUnit[]>
  branches: Ref<Branch[]>
  // Whether this form instance collects/validates per-branch stock at all.
  // false on Configuration > Products — that page only owns catalog
  // identity (name/code/barcode/category/image); price, channels, and
  // stock are all configured later, on Inventory. Read once at setup time
  // (not reactive) — each consumer passes a fixed value.
  includeStock?: boolean
  // Whether this form instance shows/validates price, sellable channels,
  // and batch unit/price. false on Configuration > Products for the same
  // reason as includeStock above — those fields move to Inventory,
  // conceptually "how this product sells," not catalog identity.
  includePricing?: boolean
}

function roundCurrency (value: number) {
  return Math.round(value * 100) / 100
}

export function useProductForm (options: UseProductFormOptions) {
  const { categories, batchUnits, branches, includeStock = true, includePricing = true } = options
  const toast = useToast()

  function emptyForm (): ProductFormState {
    const stocks: Record<number, number> = {}
    for (const branch of branches.value) {
      stocks[branch.id] = 0
    }
    return {
      id: null,
      name: '',
      code: '',
      barcode: '',
      categoryId: null,
      supplierId: null,
      price: 0,
      batchUnitId: null,
      batchPrice: null,
      // Not sellable anywhere until Inventory configures a price/channel —
      // a brand-new catalog entry from Configuration > Products shouldn't
      // silently appear in POS at $0.
      sellableRetail: false,
      sellableWholesale: false,
      stocks,
      image: '',
    }
  }

  const mode = ref<'create' | 'edit'>('create')
  const saving = ref(false)
  const form = reactive<ProductFormState>(emptyForm())

  const imageFile = ref<File | null>(null)
  const imagePreviewUrl = ref<string | null>(null)
  let imageObjectUrl: string | null = null

  const selectedBatchUnit = computed(() =>
    batchUnits.value.find(batchUnit => batchUnit.id === form.batchUnitId) ?? null,
  )

  const visibleStockBranches = computed(() => {
    if (!includeStock) {
      return []
    }
    return branches.value.filter(branch =>
      branch.type === 'wholesale' ? form.sellableWholesale : form.sellableRetail,
    )
  })

  // Units per batch is no longer entered manually — it's the batch unit
  // preset's configured quantity (Configuration > Batch Unit). Selecting a
  // preset here only suggests "Batch price" (unit price × units-per-batch);
  // that stays a plain v-model field the admin can still type over
  // afterward. Only fires from an actual user selection, not when the form
  // is populated programmatically in loadForEdit, so opening an existing
  // product for edit never clobbers its saved price.
  function onBatchUnitSelected (batchUnitId: number | null) {
    const batchUnit = batchUnits.value.find(item => item.id === batchUnitId)
    if (!batchUnit) {
      return
    }
    form.batchPrice = roundCurrency(Number(form.price) * batchUnit.unit)
  }

  // Keeps the batch price suggestion in sync while a batch unit is already
  // selected and the admin is still adjusting unit price — same "suggest,
  // don't force" rule as onBatchUnitSelected above.
  function onUnitPriceChanged (price: number) {
    if (!selectedBatchUnit.value) {
      return
    }
    form.batchPrice = roundCurrency(Number(price) * selectedBatchUnit.value.unit)
  }

  function resetImageState (initialUrl: string | null = null) {
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl)
      imageObjectUrl = null
    }
    imageFile.value = null
    imagePreviewUrl.value = initialUrl
  }

  // Called once a crop dialog confirms a selection — the actual cropping UI
  // (Cropper instance, canvas, drag/drop) stays in ProductFormDialog.vue
  // since it's DOM-bound; this only owns the resulting file's lifecycle.
  function setCroppedImage (file: File) {
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl)
    }
    imageFile.value = file
    imageObjectUrl = URL.createObjectURL(file)
    imagePreviewUrl.value = imageObjectUrl
  }

  function loadForCreate () {
    mode.value = 'create'
    Object.assign(form, emptyForm())
    resetImageState()
  }

  function loadForEdit (product: Product, stockByBranch: Record<number, number>) {
    mode.value = 'edit'
    const stocks: Record<number, number> = {}
    for (const branch of branches.value) {
      stocks[branch.id] = stockByBranch[branch.id] ?? 0
    }
    Object.assign(form, {
      id: product.id,
      name: product.name,
      code: product.code,
      barcode: product.barcode,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      price: product.price,
      batchUnitId: product.batchUnitId,
      batchPrice: product.batchPrice,
      sellableRetail: product.sellableRetail,
      sellableWholesale: product.sellableWholesale,
      stocks,
      image: product.image,
    })
    resetImageState(product.image || null)
  }

  interface PayloadWithStocks {
    payload: ProductInventoryPayload
    stocks: BranchStockInput[]
  }

  // Validates and collects the per-branch stock inputs. Returns null (after
  // showing a toast) on a validation failure — distinct from an empty array,
  // which just means includeStock is false and no stock section was shown.
  function collectStockInputs (): BranchStockInput[] | null {
    // When a product is sold through both channels, keep the retail float
    // above one batch's worth of units — a single wholesale batch sale
    // shouldn't be able to outweigh (or empty out) the retail side.
    const requireRetailAboveBatchUnit
      = form.sellableRetail && form.sellableWholesale && selectedBatchUnit.value

    const stocks: BranchStockInput[] = []
    for (const branch of branches.value) {
      const stock = Number(form.stocks[branch.id] ?? 0)
      if (!Number.isInteger(stock) || stock < 0) {
        toast.show(
          `${branch.name} stock must be a non-negative whole number.`,
          'warning',
        )
        return null
      }
      if (
        requireRetailAboveBatchUnit
        && branch.type === 'retail'
        && stock <= selectedBatchUnit.value!.unit
      ) {
        toast.show(
          `${branch.name} retail stock must be more than the batch unit quantity (${selectedBatchUnit.value!.unit}).`,
          'warning',
        )
        return null
      }
      stocks.push({ branchId: branch.id, stock })
    }
    return stocks
  }

  function buildPayload (): PayloadWithStocks | null {
    const categoryId = Number(form.categoryId)
    const price = Number(form.price)
    const batchUnitId = form.batchUnitId
    const batchSize = selectedBatchUnit.value?.unit ?? null
    // Empty number fields come back as '' or null – normalize to null
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
    if (includePricing) {
      if (!Number.isFinite(price) || price < 0) {
        toast.show('Price must be zero or higher.', 'warning')
        return null
      }
      if (!form.sellableRetail && !form.sellableWholesale) {
        toast.show('Enable at least one of Sell in Retail Shop or Sell in Wholesale.', 'warning')
        return null
      }
      if (form.sellableWholesale) {
        if (!batchUnitId || batchSize === null) {
          toast.show('Wholesale batch unit is required when sold wholesale.', 'warning')
          return null
        }
        if (batchPrice === null || !Number.isFinite(batchPrice) || batchPrice < 0) {
          toast.show('Batch price must be zero or higher.', 'warning')
          return null
        }
      }
    }

    const stocks = includeStock ? collectStockInputs() : []
    if (stocks === null) {
      return null
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
        supplierId: form.supplierId,
        price,
        // Clear stale batch data when wholesale is switched off
        batchUnitId: form.sellableWholesale ? batchUnitId : null,
        batchSize: form.sellableWholesale ? batchSize : null,
        batchPrice: form.sellableWholesale ? batchPrice : null,
        sellableRetail: form.sellableRetail,
        sellableWholesale: form.sellableWholesale,
        image: form.image.trim(),
      },
      stocks,
    }
  }

  async function submit (): Promise<{ product: Product, stocks: BranchStockInput[] } | null> {
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
        return null
      }
    }

    const built = buildPayload()
    if (!built) {
      saving.value = false
      return null
    }
    const { payload, stocks } = built

    try {
      const product = mode.value === 'create'
        ? await createProductInventory(payload, stocks)
        : await updateProductInventory({ id: form.id!, ...payload }, stocks)
      return { product, stocks }
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to save product.',
        'error',
      )
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    form,
    mode,
    saving,
    imageFile,
    imagePreviewUrl,
    categories,
    selectedBatchUnit,
    visibleStockBranches,
    loadForCreate,
    loadForEdit,
    resetImageState,
    setCroppedImage,
    onBatchUnitSelected,
    onUnitPriceChanged,
    buildPayload,
    submit,
  }
}
