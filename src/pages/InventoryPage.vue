<template>
  <v-container class="py-6" fluid>
    <div
      style="
        display: flex;
        justify-content: flex-end;
        width: 100%;
        margin-bottom: 16px;
      "
    >
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        variant="flat"
        @click="openCreateDialog"
      >
        Create Product
      </v-btn>
    </div>
    <v-alert v-if="errorMessage" class="mb-4" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <v-row class="mb-4">
      <v-col cols="12" md="8">
        <v-text-field
          v-model="search"
          clearable
          density="comfortable"
          hide-details
          label="Search by product name, code, or barcode"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          v-model="visibilityFilter"
          density="comfortable"
          hide-details
          :items="visibilityOptions"
          label="POS visibility"
          prepend-inner-icon="mdi-eye"
          variant="outlined"
        />
      </v-col>
    </v-row>

    <v-data-table
      class="pos-data-table"
      :headers="headers"
      :items="filteredProducts"
      :items-per-page="10"
      :loading="loading"
      density="comfortable"
      elevation="1"
      mobile-breakpoint="md"
      rounded="xl"
    >
      <template #item.product="{ item }">
        <div class="d-flex align-center ga-3 py-2">
          <v-avatar rounded="lg" size="48">
            <v-img cover :src="item.image" />
          </v-avatar>

          <div>
            <div class="font-weight-medium">{{ item.name }}</div>

            <div class="text-caption text-medium-emphasis">
              {{ item.code }} / {{ item.barcode }}
            </div>
          </div>
        </div>
      </template>

      <template #item.categoryName="{ item }">
        <v-chip color="primary" size="small" variant="tonal">
          {{ item.categoryName }}
        </v-chip>
      </template>

      <template #item.price="{ item }">
        {{ formatCurrency(item.price) }}
      </template>

      <template #item.stock="{ item }">
        <v-chip :color="stockColor(item.stock)" size="small" variant="tonal">
          {{ item.stock }} in stock
        </v-chip>
      </template>

      <template #item.isActive="{ item }">
        <v-chip
          :color="item.isActive ? 'success' : 'grey'"
          size="small"
          variant="tonal"
        >
          {{ item.isActive ? "Visible" : "Hidden" }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-tooltip text="Edit product">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              aria-label="Edit product"
              color="primary"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="openEditDialog(item)"
            />
          </template>
        </v-tooltip>
      </template>

      <template #no-data>
        <v-alert type="info" variant="tonal">
          No products match the current inventory filters.
        </v-alert>
      </template>
    </v-data-table>

    <v-dialog v-model="dialogOpen" max-width="760">
      <v-card>
        <v-form @submit.prevent="saveDialogProduct">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">{{ dialogTitle }}</span>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="closeDialog" />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.name"
                  density="comfortable"
                  label="Product name"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="form.code"
                  density="comfortable"
                  label="Code"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="form.barcode"
                  density="comfortable"
                  label="Barcode"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
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

              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="form.price"
                  density="comfortable"
                  label="Price"
                  min="0"
                  prefix="$"
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="form.stock"
                  density="comfortable"
                  label="Stock"
                  min="0"
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="form.image"
                  density="comfortable"
                  label="Image URL"
                  prepend-inner-icon="mdi-image"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-switch
                  v-model="form.isActive"
                  color="primary"
                  base-color="red"
                  class="custom-switch"
                  hide-details
                  inset
                  label="Display this product on POS page"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />

            <v-btn variant="text" @click="closeDialog"> Cancel </v-btn>

            <v-btn
              color="primary"
              :loading="saving"
              type="submit"
              variant="flat"
            >
              {{ dialogMode === "create" ? "Create" : "Update" }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script lang="ts" setup>
import type { ProductInventoryPayload } from "@/composables/useSupabase";
import type { Category, Product } from "@/types/pos";
import { computed, onMounted, reactive, ref } from "vue";
import {
  createProductInventory,
  getCategories,
  getInventoryProducts,
  updateProductInventory,
} from "@/composables/useSupabase";
import { formatCurrency } from "@/utils/currency";

type DialogMode = "create" | "edit";
type VisibilityFilter = "all" | "visible" | "hidden";

interface ProductForm {
  id: number | null;
  name: string;
  code: string;
  barcode: string;
  categoryId: number | null;
  price: number;
  stock: number;
  image: string;
  isActive: boolean;
}

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const saving = ref(false);
const search = ref("");
const visibilityFilter = ref<VisibilityFilter>("all");
const errorMessage = ref("");
const dialogOpen = ref(false);
const dialogMode = ref<DialogMode>("create");
const form = reactive<ProductForm>(emptyForm());
const snackbar = reactive({
  show: false,
  message: "",
  color: "success",
});

const headers = [
  { title: "Product", value: "product", sortable: false },
  { title: "Category", value: "categoryName", sortable: true },
  { title: "Price", value: "price", sortable: true },
  { title: "Stock", value: "stock", sortable: true },
  { title: "POS visibility", value: "isActive", sortable: true },
  { title: "Action", value: "actions", sortable: false, align: "end" },
] as const;
const visibilityOptions = [
  { title: "All products", value: "all" },
  { title: "Visible in POS", value: "visible" },
  { title: "Hidden from POS", value: "hidden" },
];

const dialogTitle = computed(() =>
  dialogMode.value === "create" ? "Create product" : "Edit product",
);

const filteredProducts = computed(() => {
  const query = search.value.trim().toLowerCase();

  return products.value.filter((product) => {
    const matchesSearch = query
      ? [product.name, product.code, product.barcode].some((value) =>
          value.toLowerCase().includes(query),
        )
      : true;
    const matchesVisibility =
      visibilityFilter.value === "all" ||
      (visibilityFilter.value === "visible" && product.isActive) ||
      (visibilityFilter.value === "hidden" && !product.isActive);

    return matchesSearch && matchesVisibility;
  });
});

function emptyForm(): ProductForm {
  return {
    id: null,
    name: "",
    code: "",
    barcode: "",
    categoryId: null,
    price: 0,
    stock: 0,
    image: "",
    isActive: true,
  };
}

function stockColor(stock: number) {
  if (stock === 0) return "error";
  if (stock <= 5) return "warning";
  return "success";
}

function showMessage(message: string, color = "success") {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

function closeDialog() {
  dialogOpen.value = false;
}

function openCreateDialog() {
  dialogMode.value = "create";
  Object.assign(form, emptyForm());
  dialogOpen.value = true;
}

function openEditDialog(product: Product) {
  dialogMode.value = "edit";
  Object.assign(form, {
    id: product.id,
    name: product.name,
    code: product.code,
    barcode: product.barcode,
    categoryId: product.categoryId,
    price: product.price,
    stock: product.stock,
    image: product.image,
    isActive: product.isActive,
  });
  dialogOpen.value = true;
}

function buildPayload(): ProductInventoryPayload | null {
  const categoryId = Number(form.categoryId);
  const price = Number(form.price);
  const stock = Number(form.stock);

  if (!form.name.trim()) {
    showMessage("Product name is required.", "warning");
    return null;
  }
  if (!form.code.trim()) {
    showMessage("Product code is required.", "warning");
    return null;
  }
  if (!form.barcode.trim()) {
    showMessage("Barcode is required.", "warning");
    return null;
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    showMessage("Category is required.", "warning");
    return null;
  }
  if (!Number.isFinite(price) || price < 0) {
    showMessage("Price must be zero or higher.", "warning");
    return null;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    showMessage("Stock must be a non-negative whole number.", "warning");
    return null;
  }
  if (!form.image.trim()) {
    showMessage("Product image is required.", "warning");
    return null;
  }

  return {
    name: form.name.trim(),
    code: form.code.trim(),
    barcode: form.barcode.trim(),
    categoryId,
    price,
    stock,
    image: form.image.trim(),
    isActive: form.isActive,
  };
}

async function loadProducts() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [categoryRows, productRows] = await Promise.all([
      getCategories(),
      getInventoryProducts(),
    ]);
    categories.value = categoryRows;
    products.value = productRows;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to load inventory.";
  } finally {
    loading.value = false;
  }
}

async function saveDialogProduct() {
  const payload = buildPayload();
  if (!payload) return;

  saving.value = true;

  try {
    const categoryName =
      categories.value.find((category) => category.id === payload.categoryId)
        ?.name ?? "";

    if (dialogMode.value === "create") {
      const createdProduct = await createProductInventory(payload);
      products.value = [...products.value, { ...createdProduct, categoryName }];
      showMessage(`${createdProduct.name} created.`);
    } else if (form.id) {
      const updatedProduct = await updateProductInventory({
        id: form.id,
        ...payload,
      });
      const index = products.value.findIndex(
        (item) => item.id === updatedProduct.id,
      );
      if (index !== -1) {
        products.value[index] = { ...updatedProduct, categoryName };
      }
      showMessage(`${updatedProduct.name} updated.`);
    }

    closeDialog();
  } catch (error) {
    showMessage(
      error instanceof Error ? error.message : "Unable to save product.",
      "error",
    );
  } finally {
    saving.value = false;
  }
}

onMounted(loadProducts);
</script>
<style>
/* Mobile responsive adjustments */
@media (max-width: 600px) {
  /* Ensure data table can scroll horizontally */
  .v-data-table .v-data-table__wrapper {
    overflow-x: auto;
  }
  /* Stack filter inputs vertically */
  .filter-row {
    flex-direction: column;
    gap: 0.5rem;
  }
}
.custom-switch {
  --v-switch-track-color: red !important;
  --v-switch-track-color-active: var(--v-theme-primary) !important;
}
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
