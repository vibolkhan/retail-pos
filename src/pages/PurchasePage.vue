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
                {{ productName(line.productId) }} × {{ line.quantity }}
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
            <v-btn icon="mdi-close" variant="text" @click="createDialogOpen = false" />
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

            <v-autocomplete
              v-model="productPickerId"
              class="mb-4"
              clearable
              density="comfortable"
              hide-details
              item-title="name"
              item-value="id"
              :items="pickableProducts"
              label="Add product"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              @update:model-value="onProductPicked"
            >
              <template #prepend-item>
                <v-list-item
                  prepend-icon="mdi-plus"
                  title="Create new product"
                  @click="goToCreateProduct"
                />

                <v-divider class="mt-2" />
              </template>

              <template #item="{ item, props: itemProps }">
                <v-list-item
                  v-bind="itemProps"
                  :subtitle="lineQuantity(item.id) ? `Added to purchase · qty ${lineQuantity(item.id)}` : undefined"
                >
                  <template v-if="lineQuantity(item.id)" #append>
                    <v-icon color="success" icon="mdi-check-circle" size="small" />
                  </template>
                </v-list-item>
              </template>
            </v-autocomplete>

            <v-empty-state
              v-if="lines.length === 0"
              class="py-6"
              icon="mdi-truck-outline"
              text="Search for a product above to add a line."
              title="No lines yet"
            />

            <v-table v-else class="purchase-lines-table" density="comfortable">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="text-right" style="width: 110px">Qty</th>
                  <th class="text-right" style="width: 150px">Unit cost</th>
                  <th class="text-right" style="width: 120px">Subtotal</th>
                  <th style="width: 48px" />
                </tr>
              </thead>

              <tbody>
                <tr v-for="(line, index) in lines" :key="line.productId">
                  <td class="font-weight-medium">{{ productName(line.productId) }}</td>

                  <td>
                    <v-text-field
                      v-model.number="line.quantity"
                      class="text-right"
                      density="compact"
                      hide-details
                      min="1"
                      single-line
                      type="number"
                      variant="outlined"
                    />
                  </td>

                  <td>
                    <v-text-field
                      v-model.number="line.unitCost"
                      class="text-right"
                      density="compact"
                      hide-details
                      min="0"
                      prefix="$"
                      single-line
                      type="number"
                      variant="outlined"
                    />
                  </td>

                  <td class="price-mono text-right">
                    {{ formatCurrency(line.quantity * line.unitCost) }}
                  </td>

                  <td>
                    <v-btn
                      aria-label="Remove line"
                      icon="mdi-close"
                      size="small"
                      variant="text"
                      @click="lines.splice(index, 1)"
                    />
                  </td>
                </tr>
              </tbody>

              <tfoot>
                <tr>
                  <td class="text-right font-weight-bold" colspan="3">Subtotal</td>
                  <td class="price-mono text-right text-h6">{{ formatCurrency(purchaseSubtotal) }}</td>
                  <td />
                </tr>
              </tfoot>
            </v-table>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="createDialogOpen = false"> Cancel </v-btn>

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
                <td class="text-right">{{ item.quantity }}</td>
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
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { usePurchases } from '@/composables/usePurchases'
  import {
    getInventoryProducts,
    getPurchases,
    getSuppliers,
  } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useBranchStore } from '@/stores/branch'
  import { formatCurrency } from '@/utils/currency'

  interface PurchaseLine {
    productId: number
    quantity: number
    unitCost: number
  }

  const router = useRouter()
  const branchStore = useBranchStore()
  const toast = useToast()
  const { state: onlineState } = useOnline()
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
  const productPickerId = ref<number | null>(null)

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

  const pickableProducts = computed(() => products.value.filter(p => !p.deletedAt))

  const purchaseSubtotal = computed(() =>
    lines.value.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
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
  // recorded later touched the same product+branch as the one being voided
  // — cost restoration on void isn't order-independent (see usePurchases.ts).
  const voidWarning = computed(() => {
    if (!detailPurchase.value) return null
    const purchase = detailPurchase.value
    const conflicts = purchases.value.filter(other =>
      other.id !== purchase.id
      && other.status === 'completed'
      && other.branchId === purchase.branchId
      && new Date(other.createdAt).getTime() > new Date(purchase.createdAt).getTime()
      && other.items.some(item => purchase.items.some(pi => pi.productId === item.productId)),
    )
    if (conflicts.length === 0) return null
    return `Cost may not restore correctly — ${conflicts.length} newer purchase(s) touched a product in this purchase since it was recorded.`
  })

  function productName (productId: number) {
    return products.value.find(p => p.id === productId)?.name ?? `#${productId}`
  }

  function lineQuantity (productId: number) {
    return lines.value.find(line => line.productId === productId)?.quantity ?? 0
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

  function addLine (productId: number) {
    const existing = lines.value.find(line => line.productId === productId)
    if (existing) {
      existing.quantity += 1
      return
    }
    const product = products.value.find(p => p.id === productId)
    const cost = selectedBranchId.value ? product?.costByBranch[selectedBranchId.value] : null
    lines.value.push({ productId, quantity: 1, unitCost: cost ?? 0 })
  }

  function onProductPicked (productId: number | null) {
    if (productId) addLine(productId)
    productPickerId.value = null
  }

  // Product creation only happens on Configuration > Products now — this
  // navigates away, losing any in-progress purchase lines, which is an
  // accepted tradeoff for having one product-creation experience everywhere.
  function goToCreateProduct () {
    router.push('/configuration/products')
  }

  function openCreateDialog () {
    selectedSupplierId.value = null
    selectedBranchId.value = branchStore.activeBranchId ?? branchStore.branches[0]?.id ?? null
    lines.value = []
    productPickerId.value = null
    createDialogOpen.value = true
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

    saving.value = true
    const result = await createPurchase(selectedBranchId.value, selectedSupplierId.value, lines.value)
    saving.value = false

    if (result.ok) {
      purchases.value = [result.purchase, ...purchases.value]
      toast.show('Purchase recorded.')
      createDialogOpen.value = false
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
  text-align: right;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
