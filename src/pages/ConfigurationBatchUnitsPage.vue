<template>
  <v-container class="py-6" fluid>
    <div class="d-flex justify-end ga-2 mb-4">
      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to create a batch unit">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            color="primary"
            :disabled="!onlineState.isOnline"
            prepend-icon="mdi-plus"
            variant="flat"
            @click="openCreateDialog"
          >
            Create Batch Unit
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
          label="Search by name or unit"
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
      :items="filteredBatchUnits"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.unit="{ item }">
        <v-chip color="wholesale" size="small" variant="tonal">
          {{ item.unit }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip :text="onlineState.isOnline ? 'Edit batch unit' : 'Reconnect to edit this batch unit'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Edit batch unit"
              color="primary"
              :disabled="!onlineState.isOnline"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="openEditDialog(item)"
            />
          </template>
        </v-tooltip>

        <v-tooltip :text="onlineState.isOnline ? 'Delete batch unit' : 'Reconnect to delete this batch unit'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Delete batch unit"
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
          headline="No batch units yet"
          icon="mdi-package-variant-closed"
          text="Create a batch unit (e.g. Case, Box, Carton) to use on wholesale products."
          title="No batch units found"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card>
        <v-form @submit.prevent="saveDialogBatchUnit">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">{{ editingBatchUnit ? 'Edit Batch Unit' : 'Create Batch Unit' }}</span>
            <v-btn icon="mdi-close" variant="text" @click="dialogOpen = false" />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-text-field
              v-model="form.name"
              autofocus
              class="mb-3"
              density="comfortable"
              hint="Shown in the batch unit picker and on receipts, e.g. &quot;Case&quot;"
              label="Name"
              persistent-hint
              required
              variant="outlined"
            />

            <v-text-field
              v-model.number="form.unit"
              density="comfortable"
              hint="Number of retail units in one batch of this preset, e.g. 12"
              label="Units per batch"
              min="1"
              persistent-hint
              required
              type="number"
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
      <v-card v-if="deletingBatchUnit">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Delete Batch Unit</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          Delete <strong>{{ deletingBatchUnit.name }}</strong>? This can't be undone.
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
  import type { BatchUnit } from '@/types/pos'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { createBatchUnit, deleteBatchUnit, getBatchUnits, updateBatchUnit } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'

  const toast = useToast()
  const { state: onlineState } = useOnline()

  const batchUnits = ref<BatchUnit[]>([])
  const loading = ref(true)
  const search = ref('')
  const offlineNotice = ref('')

  const dialogOpen = ref(false)
  const editingBatchUnit = ref<BatchUnit | null>(null)
  const saving = ref(false)
  const form = reactive({ name: '', unit: 1 })

  const deleteDialogOpen = ref(false)
  const deletingBatchUnit = ref<BatchUnit | null>(null)
  const deleting = ref(false)

  const headers = [
    { title: 'Name', value: 'name', sortable: true },
    { title: 'Units per batch', value: 'unit', sortable: true },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const

  const filteredBatchUnits = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return batchUnits.value

    return batchUnits.value.filter(batchUnit =>
      [batchUnit.name, String(batchUnit.unit)].some(value => value.toLowerCase().includes(query)),
    )
  })

  function openCreateDialog () {
    editingBatchUnit.value = null
    form.name = ''
    form.unit = 1
    dialogOpen.value = true
  }

  function openEditDialog (batchUnit: BatchUnit) {
    editingBatchUnit.value = batchUnit
    form.name = batchUnit.name
    form.unit = batchUnit.unit
    dialogOpen.value = true
  }

  async function saveDialogBatchUnit () {
    const name = form.name.trim()
    const unit = Number(form.unit)
    if (!name) {
      toast.show('Name is required.', 'warning')
      return
    }
    if (!Number.isInteger(unit) || unit < 1) {
      toast.show('Units per batch must be a whole number of at least 1.', 'warning')
      return
    }

    saving.value = true
    try {
      if (editingBatchUnit.value) {
        const updated = await updateBatchUnit({ id: editingBatchUnit.value.id, name, unit })
        const index = batchUnits.value.findIndex(b => b.id === updated.id)
        if (index !== -1) batchUnits.value[index] = updated
        toast.show('Batch unit updated.')
      } else {
        const created = await createBatchUnit({ name, unit })
        batchUnits.value.push(created)
        toast.show('Batch unit created.')
      }
      dialogOpen.value = false
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to save batch unit.', 'error')
    } finally {
      saving.value = false
    }
  }

  function openDeleteDialog (batchUnit: BatchUnit) {
    deletingBatchUnit.value = batchUnit
    deleteDialogOpen.value = true
  }

  async function confirmDelete () {
    const batchUnit = deletingBatchUnit.value
    if (!batchUnit) return

    deleting.value = true
    try {
      await deleteBatchUnit(batchUnit.id)
      batchUnits.value = batchUnits.value.filter(b => b.id !== batchUnit.id)
      deleteDialogOpen.value = false
      toast.show('Batch unit deleted.')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to delete batch unit.', 'error')
    } finally {
      deleting.value = false
    }
  }

  onMounted(async () => {
    loading.value = true
    try {
      const result = await cachedFetch('batchUnits', getBatchUnits, onlineState.isOnline)
      batchUnits.value = result.data
      offlineNotice.value = result.fromCache
        ? 'Offline — showing cached batch units. Creating, editing, and deleting is disabled until reconnected.'
        : ''
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to load batch units.', 'error')
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
