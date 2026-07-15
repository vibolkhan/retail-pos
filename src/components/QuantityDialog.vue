<template>
  <v-dialog v-model="dialogModel" max-width="360">
    <v-card v-if="product" rounded="lg">
      <v-card-title class="text-h6">{{ product.name }}</v-card-title>

      <v-card-text class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-medium-emphasis">Price per {{ product.batchUnit ?? 'batch' }} ({{ product.batchSize }} units)</span>

          <strong class="text-primary">{{ formatCurrency(product.batchPrice ?? 0) }}</strong>
        </div>

        <v-text-field
          v-model.number="quantity"
          autofocus
          density="comfortable"
          :error-messages="errorMessage"
          hide-details="auto"
          :label="product.batchUnit ?? 'Batch'"
          min="1"
          type="number"
          @keyup.enter="confirm"
        />

        <div class="flex items-center justify-between text-sm">
          <span class="text-medium-emphasis">{{ product.stock }} {{ product.batchUnit ?? 'batch' }} in stock</span>

          <strong>{{ formatCurrency(lineTotal) }}</strong>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn variant="text" @click="dialogModel = false">Cancel</v-btn>

        <v-btn color="primary" variant="flat" @click="confirm">Add to cart</v-btn>
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

  function confirm () {
    if (!props.product) return
    const qty = Math.floor(quantity.value)
    if (!Number.isFinite(qty) || qty < 1) {
      errorMessage.value = 'Enter a quantity of at least 1.'
      return
    }
    if (qty > props.product.stock) {
      errorMessage.value = `Only ${props.product.stock} ${props.product.batchUnit ?? 'batch'} available.`
      return
    }
    emit('confirm', props.product, qty)
    dialogModel.value = false
  }
</script>
