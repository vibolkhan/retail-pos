<template>
  <v-card class="h-100 d-flex flex-column" rounded="lg" :class="{'opacity-60': product.stock === 0}">
    <v-img
      :alt="product.name"
      cover
      height="170"
      :src="product.image"
    >
      <template #placeholder>
        <v-skeleton-loader type="image" />
      </template>
    </v-img>

    <v-card-title class="pb-1 text-wrap" style="flex-grow: 0;">
      {{ product.name }}
    </v-card-title>

    <v-card-subtitle class="pb-0" style="flex-grow: 0;">
      {{ product.code }} / {{ product.barcode }}
    </v-card-subtitle>

    <v-card-text class="d-flex flex-column ga-3 flex-grow-1" style="flex-grow: 1;">
      <div class="d-flex align-center justify-space-between ga-2">
        <v-chip color="primary" size="small" variant="tonal">
          {{ product.categoryName }}
        </v-chip>

        <strong class="text-primary text-h6">{{ formatCurrency(product.price) }}</strong>
      </div>

      <v-alert
        v-if="product.stock === 0"
        density="compact"
        text="Out of stock"
        type="warning"
        variant="tonal"
      />

      <div v-else class="text-body-2 text-medium-emphasis">
        Stock: {{ product.stock }}
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn
        block
        color="primary"
        :disabled="product.stock === 0"
        prepend-icon="mdi-cart-plus"
        variant="flat"
        @click="$emit('add', product)"
      >
        Add to Cart
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
  import type { Product } from '@/types/pos'
  import { formatCurrency } from '@/utils/currency'

  defineProps<{
    product: Product
  }>()

  defineEmits<{
    add: [product: Product]
  }>()
</script>
