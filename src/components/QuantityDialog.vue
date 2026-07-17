<template>
  <v-dialog v-model="dialogModel" max-width="400">
    <v-card v-if="product" class="qty-dialog-card elevation-4" rounded="lg">
      <div class="qty-dialog-header">
        <v-avatar class="qty-dialog-avatar" rounded="lg" size="56">
          <v-img v-if="product.image" :alt="product.name" cover :src="product.image" />
          <v-icon v-else class="opacity-40" icon="mdi-image-off-outline" />
        </v-avatar>

        <div class="qty-dialog-title">
          <div class="text-subtitle-1 font-weight-bold">{{ product.name }}</div>

          <v-chip
            class="mt-1 font-weight-bold"
            color="wholesale"
            prepend-icon="mdi-warehouse"
            size="x-small"
            variant="tonal"
          >
            {{ product.batchSize }} units / {{ product.batchUnit ?? 'batch' }}
          </v-chip>
        </div>

        <v-btn icon="mdi-close" size="small" variant="text" @click="dialogModel = false" />
      </div>

      <v-card-text class="qty-dialog-body">
        <div class="qty-price-row">
          <span class="text-medium-emphasis text-body-2">Price per {{ product.batchUnit ?? 'batch' }}</span>
          <strong class="price-mono text-wholesale">{{ formatCurrency(product.batchPrice ?? 0) }}</strong>
        </div>

        <div class="quantity-control" :class="{ 'quantity-control--shake': shake }">
          <v-btn
            density="comfortable"
            :disabled="quantity <= 1"
            icon="mdi-minus"
            size="small"
            variant="tonal"
            @click="step(-1)"
          />

          <input
            v-model.number="quantity"
            autofocus
            class="quantity-input"
            min="1"
            type="number"
            @keyup.enter="confirm"
          >

          <v-btn
            color="wholesale"
            density="comfortable"
            :disabled="quantity >= product.stock"
            icon="mdi-plus"
            size="small"
            variant="tonal"
            @click="step(1)"
          />
        </div>

        <div class="quick-qty-row">
          <v-chip
            v-for="preset in quickPresets"
            :key="preset"
            class="font-weight-bold"
            :color="quantity === preset ? 'wholesale' : undefined"
            size="small"
            :variant="quantity === preset ? 'flat' : 'outlined'"
            @click="quantity = preset"
          >
            {{ preset }}
          </v-chip>
        </div>

        <Transition name="fade-slide">
          <div v-if="errorMessage" class="qty-error">
            <v-icon icon="mdi-alert-circle-outline" size="16" />
            {{ errorMessage }}
          </div>
        </Transition>

        <div class="qty-summary">
          <div>
            <div class="text-caption text-medium-emphasis">
              {{ product.stock }} {{ product.batchUnit ?? 'batch' }} in stock
            </div>

            <div class="text-caption text-medium-emphasis">Line total</div>
          </div>

          <strong class="price-mono text-h6 text-wholesale">{{ formatCurrency(lineTotal) }}</strong>
        </div>
      </v-card-text>

      <v-card-actions class="qty-dialog-actions">
        <v-btn variant="text" @click="dialogModel = false">Cancel</v-btn>

        <v-btn
          class="flex-grow-1"
          color="wholesale"
          prepend-icon="mdi-cart-plus"
          size="large"
          variant="flat"
          @click="confirm"
        >
          Add to cart
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
  import type { Product } from '@/types/pos'
  import { computed, ref, watch } from 'vue'
  import { formatCurrency } from '@/utils/currency'

  const props = defineProps<{
    product: Product | null
  }>()

  const emit = defineEmits<{
    confirm: [product: Product, quantity: number]
  }>()

  const dialogModel = defineModel<boolean>({ required: true })

  const quantity = ref(1)
  const errorMessage = ref('')
  const shake = ref(false)

  watch(dialogModel, open => {
    if (open) {
      quantity.value = 1
      errorMessage.value = ''
    }
  })

  const lineTotal = computed(() => {
    const qty = Number.isFinite(quantity.value) ? Math.max(0, quantity.value) : 0
    return qty * (props.product?.batchPrice ?? 0)
  })

  // Common bulk quantities, clamped to whatever stock is actually available
  const quickPresets = computed(() => {
    if (!props.product) return []
    return [1, 5, 10, 20].filter(preset => preset <= props.product!.stock)
  })

  function step (delta: number) {
    if (!props.product) return
    const next = (Math.floor(quantity.value) || 0) + delta
    quantity.value = Math.min(Math.max(1, next), props.product.stock)
  }

  function triggerShake () {
    shake.value = true
    window.setTimeout(() => {
      shake.value = false
    }, 350)
  }

  function confirm () {
    if (!props.product) return
    const qty = Math.floor(quantity.value)
    if (!Number.isFinite(qty) || qty < 1) {
      errorMessage.value = 'Enter a quantity of at least 1.'
      triggerShake()
      return
    }
    if (qty > props.product.stock) {
      errorMessage.value = `Only ${props.product.stock} ${props.product.batchUnit ?? 'batch'} available.`
      triggerShake()
      return
    }
    emit('confirm', props.product, qty)
    dialogModel.value = false
  }
</script>

<style scoped>
.price-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.qty-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 0;
}

.qty-dialog-avatar {
  border: 1px solid rgba(var(--v-border-color), 0.16);
}

.qty-dialog-title {
  flex: 1;
  min-width: 0;
}

.qty-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 16px;
}

.qty-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quantity-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgb(var(--v-theme-surface-variant));
  padding: 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  transition: transform 0.05s ease;
}

.quantity-control--shake {
  animation: qty-shake 0.35s ease;
}

.quantity-input {
  width: 72px;
  text-align: center;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  font-weight: 700;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border: none;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.quantity-input::-webkit-outer-spin-button,
.quantity-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.quick-qty-row {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.qty-error {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  color: rgb(var(--v-theme-error));
  font-size: 0.8125rem;
  font-weight: 600;
}

.qty-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-radius: 14px;
  background: rgba(var(--v-theme-wholesale), 0.1);
  border: 1px solid rgba(var(--v-theme-wholesale), 0.16);
}

.qty-dialog-actions {
  padding: 0 16px 16px;
  gap: 8px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes qty-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-4px); }
}
</style>
