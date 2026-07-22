<template>
  <v-card
    class="product-card elevation-1 group flex h-full flex-col"
    :class="{ 'opacity-60': product.stock === 0 }"
    :disabled="product.stock === 0"
    :ripple="product.stock > 0"
    rounded="lg"
    variant="flat"
    @click="$emit('add', product)"
  >
    <div class="product-card-media relative overflow-hidden">
      <v-img
        v-if="product.image"
        :alt="product.name"
        class="product-card-image"
        cover
        height="100%"
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

      <div v-else class="flex h-full items-center justify-center bg-surface">
        <v-icon class="opacity-40" icon="mdi-image-off-outline" size="32" />
      </div>

      <div class="product-card-sheen" />

      <Transition name="chip-pop">
        <v-chip
          v-if="quantityInCart > 0"
          :key="quantityInCart"
          class="elevation-2 absolute top-2 right-2 font-bold"
          color="primary"
          size="small"
          variant="flat"
        >
          ×{{ quantityInCart }}
        </v-chip>
      </Transition>

      <div
        v-if="product.stock === 0"
        class="stock-overlay absolute inset-0 flex items-center justify-center"
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
          <strong class="price-mono text-primary">{{ formatCurrency(displayPrice) }}</strong>

          <span v-if="secondaryPrice" class="text-xs text-medium-emphasis price-mono">
            ≈ {{ secondaryPrice }}
          </span>

          <span v-if="wholesale" class="text-xs text-medium-emphasis">
            / {{ product.batchUnitName ?? 'batch' }} of {{ product.batchSize }}
          </span>
        </div>

        <span
          v-if="product.stock > 0"
          class="text-xs font-medium"
          :class="product.stock <= 5 ? 'text-warning' : 'text-success'"
        >
          ● {{ product.stock }}{{ wholesale ? ` ${product.batchUnitName ?? 'batch'}` : '' }}
        </span>
      </div>
    </div>
  </v-card>
</template>

<script lang="ts" setup>
  import type { Product } from '@/types/pos'
  import { computed } from 'vue'
  import { useSettings } from '@/composables/useSettings'
  import { formatCurrency, formatSecondaryCurrency } from '@/utils/currency'

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

  const { state: settingsState } = useSettings()

  const displayPrice = computed(() =>
    props.wholesale ? props.product.batchPrice ?? 0 : props.product.price,
  )

  const secondaryPrice = computed(() =>
    formatSecondaryCurrency(
      displayPrice.value,
      settingsState.currency.secondary,
      settingsState.currency.exchangeRate,
    ),
  )
</script>

<style scoped>
.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.product-card {
  border: 1px solid rgba(var(--v-border-color), 0.16);
  transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.15s ease, background-color 0.15s ease;
  will-change: transform;
}

/* Square thumbnail, matching the 1:1 crop used for the product photo in
   the Inventory form (src/pages/InventoryPage.vue) so the framing here is
   the same as what was cropped, instead of `cover` re-cropping it again. */
.product-card-media {
  aspect-ratio: 1 / 1;
}

.product-card:not(.v-card--disabled):hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
  background: rgba(var(--v-theme-primary), 0.05);
  transform: translateY(-5px);
  box-shadow:
    0px 2px 3px 0px rgba(var(--v-shadow-color), var(--v-shadow-key-opacity, 0.3)),
    0px 6px 10px 4px rgba(var(--v-shadow-color), var(--v-shadow-ambient-opacity, 0.15));
}

.product-card:not(.v-card--disabled):active {
  transform: translateY(-2px) scale(0.98);
  transition-duration: 0.1s;
}

/* Zoom the product image slightly on hover; container clips via
   overflow-hidden so the zoom never spills past the card's rounded edge. */
.product-card-image {
  transition: transform 0.4s ease;
}

.product-card:not(.v-card--disabled):hover .product-card-image {
  transform: scale(1.08);
}

/* A soft diagonal sheen sweeps across the thumbnail on hover — a cheap,
   purely decorative signal that the card is interactive. */
.product-card-sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 40%,
    rgba(255, 255, 255, 0.16) 50%,
    transparent 60%
  );
  transform: translateX(-120%);
  transition: transform 0.6s ease;
}

.product-card:not(.v-card--disabled):hover .product-card-sheen {
  transform: translateX(120%);
}

.stock-overlay {
  background: rgba(var(--v-theme-surface), 0.7);
  backdrop-filter: blur(2px);
}

/* Quantity badge pops in with a slight overshoot each time the cart
   quantity changes (re-keyed on quantityInCart so repeat adds re-trigger). */
.chip-pop-enter-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}

.chip-pop-leave-active {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.chip-pop-enter-from,
.chip-pop-leave-to {
  opacity: 0;
  transform: scale(0.4);
}
</style>
