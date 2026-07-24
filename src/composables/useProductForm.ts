import type { BranchStockInput, ProductInventoryPayload } from '@/composables/useSupabase'
import type { BatchUnit, Branch, Category, Product } from '@/types/pos'
import type { Ref } from 'vue'
import { reactive, ref } from 'vue'
import {
  createProductInventory,
  updateProductInventory,
  uploadProductImage,
} from '@/composables/useSupabase'
import { useToast } from '@/composables/useToast'
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/utils/stock'

export interface ProductFormState {
  id: number | null
  name: string
  code: string
  barcode: string
  categoryId: number | null
  supplierId: number | null
  description: string
  brand: string
  expiryDate: string | null
  lowStockThreshold: number
  batchUnitId: number | null
  price: number
  // Manual cost entry — a single global value now (was per-branch).
  cost: number | null
  stocks: Record<number, number>
  image: string
}

export interface UseProductFormOptions {
  categories: Ref<Category[]>
  batchUnits: Ref<BatchUnit[]>
  branches: Ref<Branch[]>
  // Whether this form instance collects/validates per-branch stock at all.
  // false on Configuration > Products — that page only owns catalog
  // identity (name/code/barcode/category/image); price/cost/unit/stock are
  // all configured later, on Inventory. Read once at setup time (not
  // reactive) — each consumer passes a fixed value.
  includeStock?: boolean
  // Whether this form instance shows/validates price/cost/unit. false on
  // Configuration > Products for the same reason as includeStock above.
  includePricing?: boolean
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
      description: '',
      brand: '',
      expiryDate: null,
      lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
      batchUnitId: null,
      price: 0,
      cost: null,
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
      description: product.description,
      brand: product.brand ?? '',
      expiryDate: product.expiryDate,
      lowStockThreshold: product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
      batchUnitId: product.batchUnitId,
      price: product.price,
      cost: product.cost,
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
    const stocks: BranchStockInput[] = []
    for (const branch of branches.value) {
      const stock = Number(form.stocks[branch.id] ?? 0)
      if (!Number.isInteger(stock) || stock < 0) {
        toast.show(`${branch.name} stock must be a non-negative whole number.`, 'warning')
        return null
      }
      stocks.push({ branchId: branch.id, stock })
    }
    return stocks
  }

  function buildPayload (): PayloadWithStocks | null {
    const categoryId = Number(form.categoryId)
    const price = Number(form.price)
    // Empty number fields come back as '' or null – normalize to null.
    const cost = form.cost === null || (form.cost as unknown) === '' ? null : Number(form.cost)
    const lowStockThreshold = Number(form.lowStockThreshold)

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
    // Every product needs exactly one unit — a catalog-level invariant now,
    // not gated behind includePricing.
    if (!form.batchUnitId) {
      toast.show('Unit is required.', 'warning')
      return null
    }
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      toast.show('Low stock threshold must be a non-negative whole number.', 'warning')
      return null
    }
    if (includePricing) {
      if (!Number.isFinite(price) || price < 0) {
        toast.show('Price must be zero or higher.', 'warning')
        return null
      }
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
        toast.show('Cost must be zero or higher.', 'warning')
        return null
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
        description: form.description.trim(),
        brand: form.brand.trim() || null,
        expiryDate: form.expiryDate,
        lowStockThreshold,
        batchUnitId: form.batchUnitId,
        price,
        cost,
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
    batchUnits,
    branches,
    loadForCreate,
    loadForEdit,
    resetImageState,
    setCroppedImage,
    buildPayload,
    submit,
  }
}
