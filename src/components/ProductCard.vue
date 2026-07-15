<template>
  <v-card
    class="flex h-full flex-col"
    :class="{ 'opacity-60': product.stock === 0 }"
    :disabled="product.stock === 0"
    hover
    :ripple="product.stock > 0"
    rounded="lg"
    @click="$emit('add', product)"
  >
    <div class="relative">
      <v-img
        v-if="product.image"
        :alt="product.name"
        cover
        height="110"
        :src="product.image"
      >
        <template #placeholder>
          <v-skeleton-loader type="image" />
        </template>

        <template #error>
          <div class="flex h-full items-center justify-center bg-surface">
            <v-icon class="opacity-40" icon="mdi-image-off-outline" size="32" />
          </div>
        </template>
      </v-img>

      <div v-else class="flex h-[110px] items-center justify-center bg-surface">
        <v-icon class="opacity-40" icon="mdi-image-off-outline" size="32" />
      </div>

      <v-chip
        v-if="quantityInCart > 0"
        class="elevation-1 absolute top-2 right-2 font-bold"
        color="primary"
        size="small"
        variant="flat"
      >
        ×{{ quantityInCart }}
      </v-chip>

      <div
        v-if="product.stock === 0"
        class="absolute inset-0 flex items-center justify-center"
      >
        <v-chip color="error" size="small" variant="flat">Out of stock</v-chip>
      </div>
    </div>

    <div
      class="flex grow flex-col gap-1 p-3"
      :title="`${product.code} · ${product.barcode}`"
    >
      <div class="line-clamp-2 min-h-[2.5rem] text-sm font-medium">
        {{ product.name }}
      </div>

      <div class="mt-auto flex items-center justify-between gap-2">
        <div class="flex flex-col">
          <strong class="text-primary">{{ formatCurrency(displayPrice) }}</strong>

          <span v-if="wholesale" class="text-xs text-medium-emphasis">
            / {{ product.batchUnit ?? 'batch' }} of {{ product.batchSize }}
          </span>
        </div>

        <span
          v-if="product.stock > 0"
          class="text-xs font-medium"
          :class="product.stock <= 5 ? 'text-warning' : 'text-success'"
        >
          ● {{ product.stock }}{{ wholesale ? ` ${product.batchUnit ?? 'batch'}` : '' }}
        </span>
      </div>
    </div>
  </v-card>
</template>

<script lang="ts" setup>
  import type { Product } from '@/types/pos'
  import { computed } from 'vue'
  import { formatCurrency } from '@/utils/currency'

  const props = withDefaults(
    defineProps<{
      product: Product
      quantityInCart?: number
      wholesale?: boolean
    }>(),
    { quantityInCart: 0, wholesale: false },
  )

  defineEmits<{
    add: [product: Product]
  }>()

  const displayPrice = computed(() =>
    props.wholesale ? props.product.batchPrice ?? 0 : props.product.price,
  )
</script>
