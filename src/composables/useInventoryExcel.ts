import type {
  BranchStockInput,
  InventoryProduct,
  ProductInventoryPayload,
} from '@/composables/useSupabase'
// src/composables/useInventoryExcel.ts
// Export/import product inventory (with photos) as an .xlsx workbook.
import type { BatchUnit, Branch, Category } from '@/types/pos'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import {
  createProduct,
  saveBranchStockBulk,
  updateProduct,
  uploadProductImage,
} from '@/composables/useSupabase'

const STOCK_HEADER_PREFIX = 'Stock: '
const THUMBNAIL_PX = 72
const REQUIRED_HEADERS = ['Code', 'Barcode', 'Name', 'Category', 'Price']
// This is a fixed OOXML namespace identifier (never dereferenced as a URL),
// not a link — real spreadsheets always declare it as http, not https.
// eslint-disable-next-line unicorn/prefer-https
const MAIN_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NAMESPACED_PART_PATTERN = /^xl\/(?:workbook|styles|sharedStrings|worksheets\/sheet\d+)\.xml$/

const COLUMNS: Array<{ header: string, key: string, width: number }> = [
  { header: 'Image', key: 'image', width: 12 },
  { header: 'Code', key: 'code', width: 16 },
  { header: 'Barcode', key: 'barcode', width: 16 },
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Price', key: 'price', width: 12 },
  { header: 'Sellable Retail', key: 'sellableRetail', width: 14 },
  { header: 'Sellable Wholesale', key: 'sellableWholesale', width: 16 },
  { header: 'Batch Unit', key: 'batchUnit', width: 12 },
  { header: 'Batch Size', key: 'batchSize', width: 12 },
  { header: 'Batch Price', key: 'batchPrice', width: 12 },
]

export interface ImportError {
  row: number
  message: string
}

export interface ImportSummary {
  created: number
  updated: number
  errors: ImportError[]
}

function downloadWorkbookBuffer (buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Fetches a product photo and normalizes it to a small square JPEG so every
// embedded thumbnail is cheap and exceljs (which only embeds jpeg/png/gif)
// never chokes on an unsupported source format.
async function fetchThumbnailJpeg (url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)

    const canvas = document.createElement('canvas')
    canvas.width = THUMBNAIL_PX
    canvas.height = THUMBNAIL_PX
    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    const scale = Math.max(THUMBNAIL_PX / bitmap.width, THUMBNAIL_PX / bitmap.height)
    const drawWidth = bitmap.width * scale
    const drawHeight = bitmap.height * scale
    context.drawImage(
      bitmap,
      (THUMBNAIL_PX - drawWidth) / 2,
      (THUMBNAIL_PX - drawHeight) / 2,
      drawWidth,
      drawHeight,
    )

    const thumbnailBlob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!thumbnailBlob) {
      return null
    }
    return await thumbnailBlob.arrayBuffer()
  } catch {
    // Network/CORS failure on one photo shouldn't abort the whole export
    return null
  }
}

export async function exportInventoryToExcel (
  products: InventoryProduct[],
  branches: Branch[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Inventory')

  sheet.columns = [
    ...COLUMNS,
    ...branches.map(branch => ({
      header: `${STOCK_HEADER_PREFIX}${branch.name}`,
      key: `stock_${branch.id}`,
      width: 16,
    })),
  ]
  sheet.getRow(1).font = { bold: true }

  for (const product of products) {
    const row = sheet.addRow({
      code: product.code,
      barcode: product.barcode,
      name: product.name,
      category: product.categoryName ?? '',
      price: product.price,
      sellableRetail: product.sellableRetail,
      sellableWholesale: product.sellableWholesale,
      batchUnit: product.batchUnitName ?? '',
      batchSize: product.batchSize ?? '',
      batchPrice: product.batchPrice ?? '',
      ...Object.fromEntries(
        branches.map(branch => [`stock_${branch.id}`, product.stockByBranch[branch.id] ?? 0]),
      ),
    })
    row.height = 56

    if (product.image) {
      const buffer = await fetchThumbnailJpeg(product.image)
      if (buffer) {
        const imageId = workbook.addImage({ buffer, extension: 'jpeg' })
        sheet.addImage(imageId, {
          tl: { col: 0.1, row: row.number - 1 + 0.1 },
          ext: { width: THUMBNAIL_PX - 8, height: THUMBNAIL_PX - 8 },
        })
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  downloadWorkbookBuffer(buffer, `inventory-${stamp}.xlsx`)
}

function cellValueToText (value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map(part => part.text).join('')
    }
    if ('text' in value) {
      return String((value as { text: unknown }).text ?? '')
    }
    if ('result' in value) {
      return String((value as { result: unknown }).result ?? '')
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    return ''
  }
  return String(value).trim()
}

function parseBoolean (text: string, fallback: boolean): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) {
    return fallback
  }
  return ['true', 'yes', '1', 'y'].includes(normalized)
}

interface ImportContext {
  categories: Category[]
  batchUnits: BatchUnit[]
  branches: Branch[]
  existingProducts: InventoryProduct[]
}

interface BatchFields {
  batchUnitId: number | null
  batchSize: number | null
  batchPrice: number | null
}

function parseBatchFields (
  sellableWholesale: boolean,
  batchUnitText: string,
  batchSizeText: string,
  batchPriceText: string,
  batchUnitIdByName: Map<string, number>,
): BatchFields {
  if (!sellableWholesale) {
    return { batchUnitId: null, batchSize: null, batchPrice: null }
  }

  const batchSize = batchSizeText ? Number(batchSizeText) : null
  const batchPrice = batchPriceText ? Number(batchPriceText) : null

  if (!batchUnitText) {
    throw new Error('Batch Unit is required when Sellable Wholesale is true.')
  }
  const batchUnitId = batchUnitIdByName.get(batchUnitText.trim().toLowerCase())
  if (!batchUnitId) {
    throw new Error(`Unknown batch unit "${batchUnitText}".`)
  }
  if (batchSize === null || !Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Batch Size must be a whole number of at least 1.')
  }
  if (batchPrice === null || !Number.isFinite(batchPrice) || batchPrice < 0) {
    throw new Error('Batch Price must be a non-negative number.')
  }

  return { batchUnitId, batchSize, batchPrice }
}

function parseRowStocks (
  row: ExcelJS.Row,
  branches: Branch[],
  stockColumnByBranchId: Map<number, number>,
  existing: InventoryProduct | undefined,
): BranchStockInput[] {
  const stocks: BranchStockInput[] = []
  for (const branch of branches) {
    const col = stockColumnByBranchId.get(branch.id)
    const cellText = col ? cellValueToText(row.getCell(col).value) : ''
    if (!cellText) {
      stocks.push({ branchId: branch.id, stock: existing?.stockByBranch[branch.id] ?? 0 })
      continue
    }
    const stock = Number(cellText)
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error(`Stock for "${branch.name}" must be a non-negative whole number.`)
    }
    stocks.push({ branchId: branch.id, stock })
  }
  return stocks
}

async function resolveRowImage (
  workbook: ExcelJS.Workbook,
  imageId: number | undefined,
  existingImage: string,
): Promise<string> {
  let image = existingImage
  if (imageId !== undefined) {
    const embedded = workbook.getImage(imageId)
    if (embedded.buffer) {
      const uploadFile = new File(
        [embedded.buffer as unknown as BlobPart],
        `product-image.${embedded.extension}`,
        { type: `image/${embedded.extension}` },
      )
      image = await uploadProductImage(uploadFile)
    }
  }
  if (!image) {
    throw new Error('Product image is required (embed a photo in the Image column).')
  }
  return image
}

// Some tools that re-save an exported workbook (e.g. Excel's "repair" pass
// after opening a third-party-generated file) rebind the main spreadsheetML
// namespace to a prefix, e.g. `<x:workbook>` instead of exceljs's own
// unprefixed `<workbook>`. exceljs's reader matches element names literally
// and can't parse that, so strip the prefix from element names before
// handing the buffer to exceljs (attribute prefixes like `r:id` are a
// different namespace and are left untouched).
async function normalizeNamespacedWorkbook (buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer)
  let changed = false

  for (const name of Object.keys(zip.files)) {
    if (!NAMESPACED_PART_PATTERN.test(name)) {
      continue
    }
    const entry = zip.files[name]
    if (entry.dir) {
      continue
    }

    const xml = await entry.async('string')
    const match = new RegExp(String.raw`xmlns:(\w+)="${MAIN_NAMESPACE}"`).exec(xml)
    if (!match) {
      continue
    }

    const prefix = match[1]
    const normalized = xml
      .replace(new RegExp(`<${prefix}:`, 'g'), '<')
      .replace(new RegExp(`</${prefix}:`, 'g'), '</')
    zip.file(name, normalized)
    changed = true
  }

  return changed ? zip.generateAsync({ type: 'arraybuffer' }) : buffer
}

export async function importInventoryFromExcel (
  file: File,
  { categories, batchUnits, branches, existingProducts }: ImportContext,
): Promise<ImportSummary> {
  const workbook = new ExcelJS.Workbook()
  const rawBuffer = await file.arrayBuffer()

  try {
    await workbook.xlsx.load(await normalizeNamespacedWorkbook(rawBuffer))
  } catch {
    throw new Error(
      'This file could not be read as a valid Excel workbook. Re-export a fresh copy from this page and only edit cell values or photos before re-importing.',
    )
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new Error('The workbook has no worksheets.')
  }

  const columnByHeader = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellValueToText(cell.value)
    if (header) {
      columnByHeader.set(header, colNumber)
    }
  })

  for (const header of REQUIRED_HEADERS) {
    if (!columnByHeader.has(header)) {
      throw new Error(`Missing required column "${header}" in the imported file.`)
    }
  }

  const stockColumnByBranchId = new Map<number, number>()
  for (const branch of branches) {
    const col = columnByHeader.get(`${STOCK_HEADER_PREFIX}${branch.name}`)
    if (col) {
      stockColumnByBranchId.set(branch.id, col)
    }
  }

  const imageByRow = new Map<number, number>()
  for (const image of sheet.getImages()) {
    const rowNumber = Math.round(image.range.tl.nativeRow) + 1
    imageByRow.set(rowNumber, Number(image.imageId))
  }

  const categoryIdByName = new Map(
    categories.map(category => [category.name.trim().toLowerCase(), category.id]),
  )
  const batchUnitIdByName = new Map(
    batchUnits.map(batchUnit => [batchUnit.name.trim().toLowerCase(), batchUnit.id]),
  )
  const existingByCode = new Map(
    existingProducts.map(product => [product.code.trim().toLowerCase(), product]),
  )

  function text (row: ExcelJS.Row, header: string): string {
    const col = columnByHeader.get(header)
    return col ? cellValueToText(row.getCell(col).value) : ''
  }

  const summary: ImportSummary = { created: 0, updated: 0, errors: [] }
  const lastRow = sheet.actualRowCount
  // Collected across every row and written in one saveBranchStockBulk()
  // call after the loop, instead of one branch_stock upsert per product —
  // a 500-row import would otherwise be 500 extra round trips.
  const pendingStocks: Array<{ productId: number, branchId: number, stock: number }> = []

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const code = text(row, 'Code')
    const name = text(row, 'Name')
    if (!code && !name) {
      continue
    } // blank spacer row

    try {
      const barcode = text(row, 'Barcode')
      const categoryName = text(row, 'Category')
      const price = Number(text(row, 'Price'))
      const sellableRetail = parseBoolean(text(row, 'Sellable Retail'), true)
      const sellableWholesale = parseBoolean(text(row, 'Sellable Wholesale'), false)

      if (!code) {
        throw new Error('Code is required.')
      }
      if (!name) {
        throw new Error('Name is required.')
      }
      if (!barcode) {
        throw new Error('Barcode is required.')
      }

      const categoryId = categoryIdByName.get(categoryName.trim().toLowerCase())
      if (!categoryId) {
        throw new Error(`Unknown category "${categoryName}".`)
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Price must be a non-negative number.')
      }
      if (!sellableRetail && !sellableWholesale) {
        throw new Error('At least one of Sellable Retail / Sellable Wholesale must be true.')
      }

      const { batchUnitId, batchSize, batchPrice } = parseBatchFields(
        sellableWholesale,
        text(row, 'Batch Unit'),
        text(row, 'Batch Size'),
        text(row, 'Batch Price'),
        batchUnitIdByName,
      )

      const existing = existingByCode.get(code.trim().toLowerCase())
      const stocks = parseRowStocks(row, branches, stockColumnByBranchId, existing)
      const image = await resolveRowImage(workbook, imageByRow.get(rowNumber), existing?.image ?? '')

      const payload: ProductInventoryPayload = {
        name,
        code,
        barcode,
        categoryId,
        // Not a column in the workbook — preserved from the existing row on
        // update (same as batchUnitName/batchUnitUnit elsewhere), null for
        // a genuinely new product until assigned from Configuration > Products.
        supplierId: existing?.supplierId ?? null,
        price,
        batchUnitId,
        batchSize,
        batchPrice,
        sellableRetail,
        sellableWholesale,
        image,
      }

      let productId: number
      if (existing) {
        await updateProduct({ id: existing.id, ...payload })
        productId = existing.id
        summary.updated++
      } else {
        const created = await createProduct(payload)
        productId = created.id
        summary.created++
      }
      for (const { branchId, stock } of stocks) {
        pendingStocks.push({ productId, branchId, stock })
      }
    } catch (error) {
      summary.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Unknown error.',
      })
    }
  }

  await saveBranchStockBulk(pendingStocks)

  return summary
}
