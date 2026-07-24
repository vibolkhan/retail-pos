<template>
  <v-container class="py-6" fluid>
    <div class="d-flex justify-end ga-2 mb-4">
      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to record a purchase">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            color="primary"
            :disabled="!onlineState.isOnline"
            prepend-icon="mdi-plus"
            variant="flat"
            @click="openCreateDialog"
          >
            Record Purchase
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
          label="Search by purchase ID, supplier, or branch"
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
      :items="filteredPurchases"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.id="{ item }">
        <span class="price-mono font-weight-bold text-primary"> #{{ item.id }} </span>
      </template>

      <template #item.date="{ item }">
        <span class="price-mono">{{ formatDate(item.date) }}</span>
      </template>

      <template #item.supplierId="{ item }">
        {{ supplierName(item.supplierId) }}
      </template>

      <template #item.branchId="{ item }">
        <v-chip
          :color="branchIsWholesale(item.branchId) ? 'wholesale' : 'primary'"
          size="small"
          variant="tonal"
        >
          {{ branchName(item.branchId) }}
        </v-chip>
      </template>

      <template #item.items="{ item }">
        <div class="d-flex align-center ga-1">
          <span>{{ item.items.length }} item(s)</span>

          <v-tooltip location="top" open-delay="100">
            <template #activator="{ props: tooltipProps }">
              <v-icon
                v-bind="tooltipProps"
                color="medium-emphasis"
                icon="mdi-information-outline"
                size="small"
              />
            </template>

            <div class="py-1">
              <div v-for="line in item.items" :key="line.productId">
                {{ productName(line.productId) }} × {{ line.quantity }} {{ productUnitName(line.productId) }}
              </div>
            </div>
          </v-tooltip>
        </div>
      </template>

      <template #item.subtotal="{ item }">
        <span class="price-mono">{{ formatCurrency(item.subtotal) }}</span>
      </template>

      <template #item.status="{ item }">
        <v-chip
          :color="item.status === 'voided' ? 'error' : 'success'"
          size="small"
          variant="tonal"
        >
          {{ item.status === 'voided' ? 'Voided' : 'Completed' }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip text="View / Void">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              color="primary"
              icon="mdi-eye-outline"
              size="small"
              variant="text"
              @click="openDetailDialog(item)"
            />
          </template>
        </v-tooltip>
      </template>

      <template #no-data>
        <v-empty-state
          class="py-8"
          color="primary"
          headline="No purchases yet"
          icon="mdi-truck-delivery-outline"
          text="Record a purchase to receive stock and cost of goods."
          title="No purchases found"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="createDialogOpen" max-width="900">
      <v-card>
        <v-form @submit.prevent="submitPurchase">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">Record Purchase</span>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="closeCreateDialog" />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="selectedBranchId"
                  density="comfortable"
                  item-title="name"
                  item-value="id"
                  :items="branchStore.branches"
                  label="Receiving branch"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-select
                  v-model="selectedSupplierId"
                  clearable
                  density="comfortable"
                  item-title="name"
                  item-value="id"
                  :items="suppliers"
                  label="Supplier"
                  variant="outlined"
                >
                  <template #no-data>
                    <v-list-item subtitle="Add suppliers from Configuration > Suppliers" title="No suppliers yet" />
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <div class="d-flex justify-space-between align-center mb-2">
              <span class="text-subtitle-2 text-medium-emphasis">Line items</span>

              <div class="d-flex ga-2">
                <v-btn
                  prepend-icon="mdi-plus"
                  size="small"
                  variant="text"
                  @click="goToCreateProduct"
                >
                  New product
                </v-btn>

                <v-tooltip v-if="selectedSupplierId" text="Add every product from this supplier">
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      color="primary"
                      prepend-icon="mdi-playlist-plus"
                      size="small"
                      variant="tonal"
                      @click="selectAllFromSupplier"
                    >
                      Add all ({{ pickableProducts.length }})
                    </v-btn>
                  </template>
                </v-tooltip>
              </div>
            </div>

            <v-data-table
              class="purchase-lines-table"
              density="comfortable"
              :headers="lineHeaders"
              item-value="rowId"
              :items="lines"
              :items-per-page="-1"
              no-data-text="No lines yet — click “Add row” below to begin."
            >
              <template #item.product="{ item }">
                <v-autocomplete
                  v-model="item.productId"
                  density="compact"
                  hide-details
                  item-title="name"
                  item-value="id"
                  :items="availableProductsForRow(item)"
                  placeholder="Select product"
                  variant="outlined"
                  @update:model-value="onLineProductChange(item)"
                />
              </template>

              <template #item.unit="{ item }">
                <span class="text-medium-emphasis">{{ productUnitName(item.productId) }}</span>
              </template>

              <template #item.quantity="{ item }">
                <v-text-field
                  v-model.number="item.quantity"
                  class="text-right"
                  density="compact"
                  hide-details
                  min="0"
                  single-line
                  type="number"
                  variant="outlined"
                />
              </template>

              <template #item.unitCost="{ item }">
                <v-text-field
                  v-model.number="item.unitCost"
                  class="text-right"
                  density="compact"
                  hide-details
                  min="0"
                  prefix="$"
                  single-line
                  type="number"
                  variant="outlined"
                />
              </template>

              <template #item.margin="{ item }">
                <v-chip
                  v-if="lineMargin(item) != null"
                  :color="marginColor(lineMargin(item))"
                  size="small"
                  variant="tonal"
                >
                  {{ formatPercent(lineMargin(item)!) }}
                </v-chip>

                <span v-else class="text-medium-emphasis">—</span>
              </template>

              <template #item.subtotal="{ item }">
                <span class="price-mono">{{ formatCurrency(item.quantity * item.unitCost) }}</span>
              </template>

              <template #item.actions="{ item }">
                <v-btn
                  aria-label="Remove line"
                  icon="mdi-close"
                  size="small"
                  variant="text"
                  @click="removeLine(item.rowId)"
                />
              </template>
            </v-data-table>

            <div class="d-flex justify-space-between align-center mt-3">
              <v-btn prepend-icon="mdi-plus" variant="tonal" @click="addEmptyLine"> Add row </v-btn>

              <div class="text-right">
                <span class="font-weight-bold mr-2">Total</span>
                <span class="price-mono text-h6">{{ formatCurrency(purchaseSubtotal) }}</span>

                <div v-if="secondaryTotal" class="text-caption text-medium-emphasis price-mono">
                  ≈ {{ secondaryTotal }}
                </div>
              </div>
            </div>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="closeCreateDialog"> Cancel </v-btn>

            <v-btn
              color="primary"
              :disabled="!onlineState.isOnline"
              :loading="saving"
              type="submit"
              variant="flat"
            >
              Save
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailDialogOpen" max-width="560">
      <v-card v-if="detailPurchase">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Purchase #{{ detailPurchase.id }}</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="detailDialogOpen = false" />
        </v-card-title>

        <v-divider />

        <v-card-text>
          <div class="d-flex flex-wrap ga-4 mb-4">
            <div>
              <div class="text-caption text-medium-emphasis">Date</div>
              <div>{{ formatDate(detailPurchase.date) }}</div>
            </div>

            <div>
              <div class="text-caption text-medium-emphasis">Supplier</div>
              <div>{{ supplierName(detailPurchase.supplierId) }}</div>
            </div>

            <div>
              <div class="text-caption text-medium-emphasis">Branch</div>
              <div>{{ branchName(detailPurchase.branchId) }}</div>
            </div>

            <div>
              <div class="text-caption text-medium-emphasis">Status</div>

              <v-chip
                :color="detailPurchase.status === 'voided' ? 'error' : 'success'"
                size="small"
                variant="tonal"
              >
                {{ detailPurchase.status === 'voided' ? 'Voided' : 'Completed' }}
              </v-chip>
            </div>
          </div>

          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Product</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit cost</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in detailPurchase.items" :key="item.productId">
                <td>{{ productName(item.productId) }}</td>
                <td class="text-right">{{ item.quantity }} {{ productUnitName(item.productId) }}</td>
                <td class="text-right price-mono">{{ formatCurrency(item.unitCost) }}</td>
                <td class="text-right price-mono">{{ formatCurrency(item.subtotal) }}</td>
              </tr>
            </tbody>
          </v-table>

          <template v-if="detailPurchase.status === 'completed'">
            <v-alert v-if="voidWarning" class="mt-4" type="warning" variant="tonal">
              {{ voidWarning }}
            </v-alert>

            <v-text-field
              v-model="voidReason"
              class="mt-4"
              density="comfortable"
              hide-details
              label="Reason (optional)"
              variant="outlined"
            />
          </template>
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <template v-if="detailPurchase.status === 'completed'">
            <v-btn
              color="error"
              :disabled="!onlineState.isOnline"
              :loading="voiding"
              variant="outlined"
              @click="confirmVoidPurchase"
            >
              Void purchase
            </v-btn>
          </template>

          <v-spacer />

          <v-btn variant="text" @click="detailDialogOpen = false"> Close </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>
  import type { InventoryProduct } from '@/composables/useSupabase'
  import type { Purchase, Supplier } from '@/types/pos'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { usePurchases } from '@/composables/usePurchases'
  import { useSettings } from '@/composables/useSettings'
  import {
    getInventoryProducts,
    getPurchases,
    getSuppliers,
  } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency, formatPercent, formatSecondaryCurrency } from '@/utils/currency'
  import { marginColor } from '@/utils/margin'

  interface PurchaseLine {
    // Local-only identity for the table row, stable across product changes —
    // productId itself can't be the key since a freshly added row starts
    // with no product selected yet.
    rowId: number
    productId: number | null
    // In the product's one unit — no conversion needed.
    quantity: number
    unitCost: number
  }

  const router = useRouter()
  const branchStore = useBranchStore()
  const toast = useToast()
  const { state: onlineState } = useOnline()
  const { state: settingsState } = useSettings()
  const { createPurchase, voidPurchase } = usePurchases()

  const purchases = ref<Purchase[]>([])
  const suppliers = ref<Supplier[]>([])
  const products = ref<InventoryProduct[]>([])
  const loading = ref(true)
  const offlineNotice = ref('')
  const errorMessage = ref('')
  const search = ref('')

  const createDialogOpen = ref(false)
  const selectedSupplierId = ref<number | null>(null)
  const selectedBranchId = ref<number | null>(null)
  const lines = ref<PurchaseLine[]>([])
  const saving = ref(false)

  const detailDialogOpen = ref(false)
  const detailPurchase = ref<Purchase | null>(null)
  const voidReason = ref('')
  const voiding = ref(false)

  const headers = [
    { title: 'Purchase ID', value: 'id', sortable: true },
    { title: 'Date', value: 'date', sortable: true },
    { title: 'Supplier', value: 'supplierId', sortable: false },
    { title: 'Branch', value: 'branchId', sortable: false },
    { title: 'Items', value: 'items', sortable: false },
    { title: 'Subtotal', value: 'subtotal', sortable: true },
    { title: 'Status', value: 'status', sortable: true },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const

  const lineHeaders = [
    { title: 'Product', value: 'product', sortable: false },
    { title: 'Unit', value: 'unit', sortable: false, align: 'center', width: 130 },
    { title: 'Qty', value: 'quantity', sortable: false, align: 'end', width: 110 },
    { title: 'Unit cost', value: 'unitCost', sortable: false, align: 'end', width: 150 },
    { title: 'Margin', value: 'margin', sortable: false, align: 'center', width: 100 },
    { title: 'Subtotal', value: 'subtotal', sortable: false, align: 'end', width: 120 },
    { title: '', value: 'actions', sortable: false, width: 48 },
  ] as const

  // Once a supplier is picked, the product picker (and "Add all") scopes
  // down to just that supplier's catalog instead of every product in the
  // system — the core fix for receiving many lines from one supplier.
  // With no supplier selected, every non-deleted product stays pickable
  // (ad-hoc/no-supplier purchases keep working as before).
  const pickableProducts = computed(() => {
    const active = products.value.filter(p => !p.deletedAt)
    if (!selectedSupplierId.value) return active
    return active.filter(p => p.supplierId === selectedSupplierId.value)
  })

  const purchaseSubtotal = computed(() =>
    lines.value.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
  )

  const secondaryTotal = computed(() =>
    formatSecondaryCurrency(
      purchaseSubtotal.value,
      settingsState.currency.secondary,
      settingsState.currency.exchangeRate,
    ),
  )

  const filteredPurchases = computed(() => {
    const query = search.value.trim().toLowerCase()

    return purchases.value
      .filter(purchase => {
        if (!query) return true
        const values = [
          purchase.id,
          supplierName(purchase.supplierId),
          branchName(purchase.branchId),
        ]
        return values.some(value => value.toLowerCase().includes(query))
      })
      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })

  // Non-blocking warning shown in the void dialog when an active purchase
  // recorded later touched the same product as the one being voided — cost
  // is product-global now (not branch-scoped), so a newer purchase at ANY
  // branch counts, not just the same one. Cost restoration on void isn't
  // order-independent (see usePurchases.ts).
  const voidWarning = computed(() => {
    if (!detailPurchase.value) return null
    const purchase = detailPurchase.value
    const conflicts = purchases.value.filter(other =>
      other.id !== purchase.id
      && other.status === 'completed'
      && new Date(other.createdAt).getTime() > new Date(purchase.createdAt).getTime()
      && other.items.some(item => purchase.items.some(pi => pi.productId === item.productId)),
    )
    if (conflicts.length === 0) return null
    return `Cost may not restore correctly — ${conflicts.length} newer purchase(s) touched a product in this purchase since it was recorded.`
  })

  function productName (productId: number) {
    return products.value.find(p => p.id === productId)?.name ?? `#${productId}`
  }

  function productUnitName (productId: number | null) {
    return products.value.find(p => p.id === productId)?.batchUnitName ?? ''
  }

  // Margin between the cost being entered on this line and the product's
  // sell price — a quick sanity check while receiving, not a stored figure.
  // Null when there's no sell price to compare against.
  function lineMargin (line: PurchaseLine) {
    const product = products.value.find(p => p.id === line.productId)
    if (!product?.price) return null
    return (product.price - line.unitCost) / product.price
  }

  // Products still selectable in a given row's dropdown — every pickable
  // product not already used by another row, plus this row's own current
  // selection (so switching away from it and back still works).
  function availableProductsForRow (line: PurchaseLine) {
    return pickableProducts.value.filter(p =>
      p.id === line.productId || !lines.value.some(other => other.productId === p.id),
    )
  }

  function supplierName (supplierId: number | null) {
    if (!supplierId) return '—'
    return suppliers.value.find(s => s.id === supplierId)?.name ?? '—'
  }

  function branchName (branchId: number) {
    return branchStore.branches.find(b => b.id === branchId)?.name ?? '—'
  }

  function branchIsWholesale (branchId: number) {
    return branchStore.branches.find(b => b.id === branchId)?.type === 'wholesale'
  }

  function formatDate (date: string) {
    return new Date(date).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Monotonic local id for table rows — not persisted, just needs to stay
  // unique within this dialog session.
  let nextRowId = 0

  function makeLine (productId: number | null): PurchaseLine {
    return { rowId: nextRowId++, productId, quantity: 0, unitCost: 0 }
  }

  // Fills in a line's unitCost default from its (now-selected) product's
  // current cost. Still overridable per line.
  function applyProductDefaults (line: PurchaseLine) {
    if (line.productId == null) return
    const product = products.value.find(p => p.id === line.productId)
    line.unitCost = product?.cost ?? 0
  }

  // Default quantity 0 (not 1) — bulk-adding many lines at once means the
  // remaining work is typing quantities down a column, not re-editing a
  // default that's almost always wrong for most of the lines.
  function addLine (productId: number) {
    if (lines.value.some(line => line.productId === productId)) return
    const line = makeLine(productId)
    applyProductDefaults(line)
    lines.value.push(line)
  }

  // Adds a blank row so a product can be chosen directly in the table,
  // rather than through a separate picker above it.
  function addEmptyLine () {
    lines.value.push(makeLine(null))
  }

  function onLineProductChange (line: PurchaseLine) {
    applyProductDefaults(line)
  }

  function removeLine (rowId: number) {
    lines.value = lines.value.filter(line => line.rowId !== rowId)
  }

  // The core fix for "200 products from one supplier": once a supplier is
  // selected, this adds every one of its (already-scoped) pickable products
  // as a line in one action instead of searching/selecting 200 times.
  function selectAllFromSupplier () {
    for (const product of pickableProducts.value) addLine(product.id)
  }

  // Product creation only happens on Configuration > Products now — this
  // navigates away, losing any in-progress purchase lines, which is an
  // accepted tradeoff for having one product-creation experience everywhere.
  function goToCreateProduct () {
    router.push('/configuration/products')
  }

  // Persists the in-progress purchase (branch/supplier/lines) so an
  // accidental refresh or dialog close doesn't lose a long 200-line entry
  // session — cleared once the purchase is actually submitted.
  const DRAFT_STORAGE_KEY = 'purchaseDraft:v1'

  interface PurchaseDraft {
    branchId: number | null
    supplierId: number | null
    lines: PurchaseLine[]
  }

  function saveDraft () {
    const draft: PurchaseDraft = {
      branchId: selectedBranchId.value,
      supplierId: selectedSupplierId.value,
      lines: lines.value,
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }

  function loadDraft (): PurchaseDraft | null {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as PurchaseDraft
    } catch {
      return null
    }
  }

  function clearDraft () {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  }

  watch([selectedSupplierId, selectedBranchId, lines], () => {
    if (createDialogOpen.value) saveDraft()
  }, { deep: true })

  function openCreateDialog () {
    const draft = loadDraft()
    if (draft && draft.lines.length > 0) {
      selectedSupplierId.value = draft.supplierId
      selectedBranchId.value = draft.branchId ?? branchStore.activeBranchId ?? branchStore.branches[0]?.id ?? null
      // Reassign rowIds rather than trusting the persisted ones — keeps them
      // unique against `nextRowId` regardless of what an older draft shape saved.
      lines.value = draft.lines.map(line => ({ ...line, rowId: nextRowId++ }))
      toast.show('Restored your unsaved purchase draft.')
    } else {
      selectedSupplierId.value = null
      selectedBranchId.value = branchStore.activeBranchId ?? branchStore.branches[0]?.id ?? null
      lines.value = []
    }
    createDialogOpen.value = true
  }

  function closeCreateDialog () {
    createDialogOpen.value = false
    clearDraft()
  }

  async function submitPurchase () {
    if (!selectedBranchId.value) {
      toast.show('Select a receiving branch.', 'warning')
      return
    }
    if (lines.value.length === 0) {
      toast.show('Add at least one line to this purchase.', 'warning')
      return
    }
    if (lines.value.some(line => line.productId == null)) {
      toast.show('Select a product for every line.', 'warning')
      return
    }

    // Every line is guaranteed a product by the check above.
    const validLines = lines.value as (PurchaseLine & { productId: number })[]

    saving.value = true
    const result = await createPurchase(
      selectedBranchId.value,
      selectedSupplierId.value,
      validLines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    )
    saving.value = false

    if (result.ok) {
      purchases.value = [result.purchase, ...purchases.value]
      toast.show('Purchase recorded.')
      createDialogOpen.value = false
      clearDraft()
    } else {
      toast.show(result.message, 'error')
    }
  }

  function openDetailDialog (purchase: Purchase) {
    detailPurchase.value = purchase
    voidReason.value = ''
    detailDialogOpen.value = true
  }

  async function confirmVoidPurchase () {
    if (!detailPurchase.value) return

    voiding.value = true
    const result = await voidPurchase(detailPurchase.value, voidReason.value || 'Voided')
    voiding.value = false

    if (result.ok) {
      detailPurchase.value.status = 'voided'
      const index = purchases.value.findIndex(p => p.id === detailPurchase.value?.id)
      if (index !== -1) purchases.value[index].status = 'voided'
      toast.show(result.message)
    } else {
      toast.show(result.message, 'error')
    }
  }

  onMounted(async () => {
    loading.value = true
    errorMessage.value = ''
    offlineNotice.value = ''

    try {
      const [purchaseResult, supplierResult, productResult] = await Promise.all([
        cachedFetch('purchases', () => getPurchases(), onlineState.isOnline),
        cachedFetch('suppliers', getSuppliers, onlineState.isOnline),
        cachedFetch('inventory', getInventoryProducts, onlineState.isOnline),
        branchStore.loadBranches(),
      ])
      purchases.value = purchaseResult.data
      suppliers.value = supplierResult.data
      products.value = productResult.data

      if (purchaseResult.fromCache || supplierResult.fromCache || productResult.fromCache) {
        offlineNotice.value = 'Offline — showing cached data. Recording a purchase is disabled until reconnected.'
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Unable to load purchases.'
    } finally {
      loading.value = false
    }
  })
</script>

<style scoped>
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
.purchase-lines-table :deep(td) {
  vertical-align: middle;
}
.purchase-lines-table :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
}
.purchase-lines-table :deep(.text-right .v-field__input) {
  text-align: right;
}
</style>
