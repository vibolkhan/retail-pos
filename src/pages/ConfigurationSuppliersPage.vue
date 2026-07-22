<template>
  <v-container class="py-6" fluid>
    <div class="d-flex justify-end ga-2 mb-4">
      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to create a supplier">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            color="primary"
            :disabled="!onlineState.isOnline"
            prepend-icon="mdi-plus"
            variant="flat"
            @click="openCreateDialog"
          >
            Create Supplier
          </v-btn>
        </template>
      </v-tooltip>
    </div>

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
      :items="filteredSuppliers"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.phone="{ item }">
        <span>{{ item.phone || '—' }}</span>
      </template>

      <template #item.email="{ item }">
        <span>{{ item.email || '—' }}</span>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip :text="onlineState.isOnline ? 'Edit supplier' : 'Reconnect to edit this supplier'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Edit supplier"
              color="primary"
              :disabled="!onlineState.isOnline"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="openEditDialog(item)"
            />
          </template>
        </v-tooltip>

        <v-tooltip :text="onlineState.isOnline ? 'Delete supplier' : 'Reconnect to delete this supplier'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Delete supplier"
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

      <template #no-data>
        <v-empty-state
          class="py-8"
          color="primary"
          headline="No suppliers yet"
          icon="mdi-truck-outline"
          text="Create a supplier to use when recording purchases."
          title="No suppliers found"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card>
        <v-form @submit.prevent="saveDialogSupplier">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">{{ editingSupplier ? 'Edit Supplier' : 'Create Supplier' }}</span>
            <v-btn icon="mdi-close" variant="text" @click="dialogOpen = false" />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-text-field
              v-model="form.name"
              autofocus
              class="mb-3"
              density="comfortable"
              label="Name"
              required
              variant="outlined"
            />

            <v-text-field
              v-model="form.phone"
              class="mb-3"
              density="comfortable"
              label="Phone"
              variant="outlined"
            />

            <v-text-field
              v-model="form.email"
              density="comfortable"
              label="Email"
              variant="outlined"
            />
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />
            <v-btn variant="text" @click="dialogOpen = false"> Cancel </v-btn>

            <v-btn
              color="primary"
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

    <v-dialog v-model="deleteDialogOpen" max-width="420">
      <v-card v-if="deletingSupplier">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Delete Supplier</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          Delete <strong>{{ deletingSupplier.name }}</strong>? This can't be undone.
        </v-card-text>

        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false"> Cancel </v-btn>

          <v-btn
            color="error"
            :loading="deleting"
            variant="flat"
            @click="confirmDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang="ts" setup>
  import type { Supplier } from '@/types/pos'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { createSupplier, deleteSupplier, getSuppliers, updateSupplier } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'

  const toast = useToast()
  const { state: onlineState } = useOnline()

  const suppliers = ref<Supplier[]>([])
  const loading = ref(true)
  const search = ref('')
  const offlineNotice = ref('')

  const dialogOpen = ref(false)
  const editingSupplier = ref<Supplier | null>(null)
  const saving = ref(false)
  const form = reactive({ name: '', phone: '', email: '' })

  const deleteDialogOpen = ref(false)
  const deletingSupplier = ref<Supplier | null>(null)
  const deleting = ref(false)

  const headers = [
    { title: 'Name', value: 'name', sortable: true },
    { title: 'Phone', value: 'phone', sortable: true },
    { title: 'Email', value: 'email', sortable: true },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const

  const filteredSuppliers = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return suppliers.value

    return suppliers.value.filter(supplier =>
      [supplier.name, supplier.phone, supplier.email].some(
        value => value?.toLowerCase().includes(query),
      ),
    )
  })

  function openCreateDialog () {
    editingSupplier.value = null
    form.name = ''
    form.phone = ''
    form.email = ''
    dialogOpen.value = true
  }

  function openEditDialog (supplier: Supplier) {
    editingSupplier.value = supplier
    form.name = supplier.name
    form.phone = supplier.phone ?? ''
    form.email = supplier.email ?? ''
    dialogOpen.value = true
  }

  async function saveDialogSupplier () {
    const name = form.name.trim()
    if (!name) {
      toast.show('Name is required.', 'warning')
      return
    }

    saving.value = true
    try {
      const payload = { name, phone: form.phone.trim() || null, email: form.email.trim() || null }
      if (editingSupplier.value) {
        const updated = await updateSupplier({ id: editingSupplier.value.id, ...payload })
        const index = suppliers.value.findIndex(s => s.id === updated.id)
        if (index !== -1) suppliers.value[index] = updated
        toast.show('Supplier updated.')
      } else {
        const created = await createSupplier(payload)
        suppliers.value.push(created)
        toast.show('Supplier created.')
      }
      dialogOpen.value = false
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to save supplier.', 'error')
    } finally {
      saving.value = false
    }
  }

  function openDeleteDialog (supplier: Supplier) {
    deletingSupplier.value = supplier
    deleteDialogOpen.value = true
  }

  async function confirmDelete () {
    const supplier = deletingSupplier.value
    if (!supplier) return

    deleting.value = true
    try {
      await deleteSupplier(supplier.id)
      suppliers.value = suppliers.value.filter(s => s.id !== supplier.id)
      deleteDialogOpen.value = false
      toast.show('Supplier deleted.')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to delete supplier.', 'error')
    } finally {
      deleting.value = false
    }
  }

  onMounted(async () => {
    loading.value = true
    try {
      const result = await cachedFetch('suppliers', getSuppliers, onlineState.isOnline)
      suppliers.value = result.data
      offlineNotice.value = result.fromCache
        ? 'Offline — showing cached suppliers. Creating, editing, and deleting is disabled until reconnected.'
        : ''
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to load suppliers.', 'error')
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
</style>
