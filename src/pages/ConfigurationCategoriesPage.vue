<template>
  <v-container class="py-6" fluid>
    <div class="d-flex justify-end ga-2 mb-4">
      <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to create a category">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            color="primary"
            :disabled="!onlineState.isOnline"
            prepend-icon="mdi-plus"
            variant="flat"
            @click="openCreateDialog"
          >
            Create Category
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
          label="Search by category name"
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
      :items="filteredCategories"
      mobile-breakpoint="md"
      rounded="lg"
    >
      <template #item.actions="{ item }">
        <v-tooltip :text="onlineState.isOnline ? 'Edit category' : 'Reconnect to edit this category'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Edit category"
              color="primary"
              :disabled="!onlineState.isOnline"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="openEditDialog(item)"
            />
          </template>
        </v-tooltip>

        <v-tooltip :text="onlineState.isOnline ? 'Delete category' : 'Reconnect to delete this category'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Delete category"
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
          headline="No categories yet"
          icon="mdi-shape-outline"
          text="Create a category to start grouping products."
          title="No categories found"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card>
        <v-form @submit.prevent="saveDialogCategory">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">{{ editingCategory ? 'Edit Category' : 'Create Category' }}</span>
            <v-btn icon="mdi-close" variant="text" @click="dialogOpen = false" />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-text-field
              v-model="form.name"
              autofocus
              density="comfortable"
              label="Name"
              required
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
      <v-card v-if="deletingCategory">
        <v-card-title class="receipt-title">
          <span class="flex-grow-1">Delete Category</span>
        </v-card-title>

        <v-divider />

        <v-card-text>
          Delete <strong>{{ deletingCategory.name }}</strong>? This can't be undone.
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
  import type { Category } from '@/types/pos'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { cachedFetch } from '@/composables/useOfflineCache'
  import { useOnline } from '@/composables/useOnline'
  import { createCategory, deleteCategory, getCategories, updateCategory } from '@/composables/useSupabase'
  import { useToast } from '@/composables/useToast'

  const toast = useToast()
  const { state: onlineState } = useOnline()

  const categories = ref<Category[]>([])
  const loading = ref(true)
  const search = ref('')
  const offlineNotice = ref('')

  const dialogOpen = ref(false)
  const editingCategory = ref<Category | null>(null)
  const saving = ref(false)
  const form = reactive({ name: '' })

  const deleteDialogOpen = ref(false)
  const deletingCategory = ref<Category | null>(null)
  const deleting = ref(false)

  const headers = [
    { title: 'Name', value: 'name', sortable: true },
    { title: 'Action', value: 'actions', sortable: false, align: 'end' },
  ] as const

  const filteredCategories = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return categories.value

    return categories.value.filter(category => category.name.toLowerCase().includes(query))
  })

  function openCreateDialog () {
    editingCategory.value = null
    form.name = ''
    dialogOpen.value = true
  }

  function openEditDialog (category: Category) {
    editingCategory.value = category
    form.name = category.name
    dialogOpen.value = true
  }

  async function saveDialogCategory () {
    const name = form.name.trim()
    if (!name) {
      toast.show('Category name is required.', 'warning')
      return
    }

    saving.value = true
    try {
      if (editingCategory.value) {
        const updated = await updateCategory({ id: editingCategory.value.id, name })
        const index = categories.value.findIndex(c => c.id === updated.id)
        if (index !== -1) categories.value[index] = updated
        toast.show('Category updated.')
      } else {
        const created = await createCategory({ name })
        categories.value.push(created)
        toast.show('Category created.')
      }
      dialogOpen.value = false
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to save category.', 'error')
    } finally {
      saving.value = false
    }
  }

  function openDeleteDialog (category: Category) {
    deletingCategory.value = category
    deleteDialogOpen.value = true
  }

  async function confirmDelete () {
    const category = deletingCategory.value
    if (!category) return

    deleting.value = true
    try {
      await deleteCategory(category.id)
      categories.value = categories.value.filter(c => c.id !== category.id)
      deleteDialogOpen.value = false
      toast.show('Category deleted.')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to delete category.', 'error')
    } finally {
      deleting.value = false
    }
  }

  onMounted(async () => {
    loading.value = true
    try {
      const result = await cachedFetch('categories', getCategories, onlineState.isOnline)
      categories.value = result.data
      offlineNotice.value = result.fromCache
        ? 'Offline — showing cached categories. Creating, editing, and deleting is disabled until reconnected.'
        : ''
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Unable to load categories.', 'error')
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
