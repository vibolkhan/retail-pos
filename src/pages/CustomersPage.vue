<template>
  <v-container class="py-6" fluid>
    <v-alert v-if="offlineNotice" class="mb-4" type="info" variant="tonal">
      {{ offlineNotice }}
    </v-alert>

    <v-row class="mb-4">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Search by name, phone, or email"
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
      :items="filteredCustomers"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.orders="{ item }">
        {{ salesFor(item.id).length }}
      </template>

      <template #item.totalSpent="{ item }">
        <span class="price-mono">{{ formatCurrency(totalSpentFor(item.id)) }}</span>
      </template>

      <template #item.loyaltyPoints="{ item }">
        <v-chip color="primary" size="small" variant="tonal">
          {{ item.loyaltyPoints }} pts
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-btn
          color="primary"
          prepend-icon="mdi-history"
          size="small"
          variant="tonal"
          @click="openHistory(item)"
        >
          Orders
        </v-btn>
      </template>

      <template #no-data>
        <v-empty-state
          class="py-8"
          color="primary"
          headline="No customers yet"
          icon="mdi-account-off-outline"
          text="Customers added at checkout will show up here."
          title="No customers found"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="historyDialogOpen" max-width="640">
      <v-card v-if="historyCustomer">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">{{ historyCustomer.name }}</span>

          <v-chip class="mr-2" color="primary" size="small" variant="tonal">
            {{ historyCustomer.loyaltyPoints }} pts
          </v-chip>

          <v-btn icon="mdi-close" variant="text" @click="historyDialogOpen = false" />
        </v-card-title>

        <v-divider />

        <v-tabs v-model="historyTab" density="compact">
          <v-tab value="orders">Orders</v-tab>
          <v-tab value="points">Points history</v-tab>
        </v-tabs>

        <v-divider />

        <v-window v-model="historyTab">
          <v-window-item value="orders">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th>Sale ID</th>
                  <th>Date</th>
                  <th class="text-right">Total</th>
                  <th class="text-right">Receipt</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="sale in salesFor(historyCustomer.id)" :key="sale.id">
                  <td class="price-mono">#{{ sale.id }}</td>
                  <td>{{ new Date(sale.date).toLocaleDateString() }}</td>
                  <td class="price-mono text-right">{{ formatCurrency(sale.grandTotal) }}</td>

                  <td class="text-right">
                    <v-btn
                      color="primary"
                      icon="mdi-receipt-text"
                      size="small"
                      variant="text"
                      @click="openReceipt(sale)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <v-window-item value="points">
            <v-card-text class="d-flex justify-end py-2">
              <v-btn
                color="primary"
                prepend-icon="mdi-plus-minus-variant"
                size="small"
                variant="tonal"
                @click="openAdjustPoints"
              >
                Adjust points
              </v-btn>
            </v-card-text>

            <v-skeleton-loader
              v-if="loadingLoyaltyHistory"
              class="rounded-lg"
              type="table-row@4"
            />

            <v-table v-else-if="loyaltyHistory.length > 0" density="comfortable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Note</th>
                  <th class="text-right">Points</th>
                  <th class="text-right">Balance</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="tx in loyaltyHistory" :key="tx.id">
                  <td>{{ new Date(tx.createdAt).toLocaleDateString() }}</td>
                  <td class="text-capitalize">{{ tx.type }}</td>
                  <td>{{ tx.note || (tx.saleId ? `Sale #${tx.saleId}` : '—') }}</td>

                  <td class="price-mono text-right" :class="tx.points >= 0 ? 'text-success' : 'text-error'">
                    {{ tx.points >= 0 ? '+' : '' }}{{ tx.points }}
                  </td>

                  <td class="price-mono text-right">{{ tx.balanceAfter }}</td>
                </tr>
              </tbody>
            </v-table>

            <v-empty-state
              v-else
              class="py-6"
              color="primary"
              headline="No points activity yet"
              icon="mdi-star-off-outline"
              title="Nothing here yet"
            />
          </v-window-item>
        </v-window>
      </v-card>
    </v-dialog>

    <v-dialog v-model="adjustPointsDialog" max-width="420">
      <v-card>
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Adjust points</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-text-field
            v-model.number="adjustForm.points"
            class="mb-3"
            density="comfortable"
            hint="Positive to add, negative to deduct"
            label="Points"
            persistent-hint
            type="number"
            variant="outlined"
          />

          <v-text-field
            v-model="adjustForm.note"
            density="comfortable"
            label="Reason (optional)"
            variant="outlined"
          />
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="adjustPointsDialog = false"> Cancel </v-btn>

          <v-btn
            color="primary"
            :disabled="!adjustForm.points"
            :loading="adjustingPoints"
            variant="flat"
            @click="submitAdjustPoints"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ReceiptDialog v-model="receiptDialogOpen" :sale="selectedSale" />
  </v-container>
</template>

<script lang="ts" setup>
  import type { Customer, LoyaltyTransaction, Sale } from '@/types/pos'
  import { computed, onMounted, reactive, ref } from 'vue'
  import ReceiptDialog from '@/components/ReceiptDialog.vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import {
    addLoyaltyTransaction,
    adjustLoyaltyPoints,
    getCustomers,
    getLoyaltyTransactionsForCustomer,
    getSales,
  } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'
  import { useAuthStore } from '@/stores/auth'
  import { formatCurrency } from '@/utils/currency'

  const toast = useToast()
  const authStore = useAuthStore()
  const { state: onlineState } = useOnline()

  const customers = ref<Customer[]>([])
  const sales = ref<Sale[]>([])
  const loading = ref(true)
  const search = ref('')
  const offlineNotice = ref('')

  const historyDialogOpen = ref(false)
  const historyCustomer = ref<Customer | null>(null)
  const historyTab = ref('orders')
  const loyaltyHistory = ref<LoyaltyTransaction[]>([])
  const loadingLoyaltyHistory = ref(false)
  const receiptDialogOpen = ref(false)
  const selectedSale = ref<Sale | null>(null)

  const adjustPointsDialog = ref(false)
  const adjustForm = reactive({ points: 0, note: '' })
  const adjustingPoints = ref(false)

  const headers = [
    { title: 'Name', value: 'name', sortable: true },
    { title: 'Phone', value: 'phone', sortable: false },
    { title: 'Email', value: 'email', sortable: false },
    { title: 'Orders', value: 'orders', sortable: false },
    { title: 'Total spent', value: 'totalSpent', sortable: false },
    { title: 'Points', value: 'loyaltyPoints', sortable: true },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const

  const filteredCustomers = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return customers.value

    return customers.value.filter(customer =>
      [customer.name, customer.phone, customer.email].some(value =>
        value?.toLowerCase().includes(query),
      ),
    )
  })

  function salesFor (customerId: number) {
    return sales.value
      .filter(sale => sale.customerId === customerId)
      .toSorted((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  function totalSpentFor (customerId: number) {
    return salesFor(customerId).reduce((sum, sale) => sum + sale.grandTotal, 0)
  }

  async function openHistory (customer: Customer) {
    historyCustomer.value = customer
    historyDialogOpen.value = true
    historyTab.value = 'orders'

    loadingLoyaltyHistory.value = true
    try {
      loyaltyHistory.value = await getLoyaltyTransactionsForCustomer(customer.id)
    } finally {
      loadingLoyaltyHistory.value = false
    }
  }

  function openReceipt (sale: Sale) {
    selectedSale.value = sale
    receiptDialogOpen.value = true
  }

  function openAdjustPoints () {
    adjustForm.points = 0
    adjustForm.note = ''
    adjustPointsDialog.value = true
  }

  async function submitAdjustPoints () {
    const customer = historyCustomer.value
    const points = Math.trunc(adjustForm.points)
    if (!customer || !points) return

    adjustingPoints.value = true
    try {
      const balanceAfter = await adjustLoyaltyPoints(customer.id, points)
      await addLoyaltyTransaction({
        id: `LOYALTY-${Date.now()}-manual`,
        customerId: customer.id,
        type: 'adjust',
        points,
        balanceAfter,
        note: adjustForm.note.trim() || 'Manual adjustment',
        createdBy: authStore.profile?.id ?? null,
        createdAt: new Date().toISOString(),
      })

      customer.loyaltyPoints = balanceAfter
      const index = customers.value.findIndex(c => c.id === customer.id)
      if (index !== -1) customers.value[index] = { ...customers.value[index], loyaltyPoints: balanceAfter }

      loyaltyHistory.value = await getLoyaltyTransactionsForCustomer(customer.id)
      adjustPointsDialog.value = false
      toast.show('Points adjusted.')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to adjust points.', 'error')
    } finally {
      adjustingPoints.value = false
    }
  }

  onMounted(async () => {
    loading.value = true
    try {
      const [customerResult, salesResult] = await Promise.all([
        cachedFetch('customers', getCustomers, onlineState.isOnline),
        cachedFetch('sales:all', getSales, onlineState.isOnline),
      ])
      customers.value = customerResult.data
      sales.value = salesResult.data
      offlineNotice.value = customerResult.fromCache || salesResult.fromCache
        ? 'Offline — showing cached customers. Adjusting points is disabled until reconnected.'
        : ''
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to load customers.', 'error')
    } finally {
      loading.value = false
    }
  })
</script>

<style scoped>
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
</style>
