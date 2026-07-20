<template>
  <v-container class="py-6" fluid>
    <v-row justify="center">
      <v-col cols="12" md="6">
        <v-card rounded="lg" variant="flat">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">Currency settings</span>
          </v-card-title>

          <v-divider />

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              The base currency is what prices are stored and charged in. The
              secondary currency is shown alongside it (e.g. on the POS
              screen, cart, and receipts) at the exchange rate below.
            </p>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.base"
                  density="comfortable"
                  label="Base currency (ISO code)"
                  maxlength="3"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.secondary"
                  density="comfortable"
                  label="Secondary currency (ISO code)"
                  maxlength="3"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model.number="form.exchangeRate"
                  density="comfortable"
                  hint="1 unit of the base currency equals this many units of the secondary currency"
                  :label="`Exchange rate (1 ${form.base || 'base'} = ? ${form.secondary || 'secondary'})`"
                  min="0"
                  persistent-hint
                  type="number"
                  variant="outlined"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />

            <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to save settings">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="primary"
                  :disabled="!onlineState.isOnline"
                  :loading="saving"
                  variant="flat"
                  @click="save"
                >
                  Save
                </v-btn>
              </template>
            </v-tooltip>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card rounded="lg" variant="flat">
          <v-card-title class="receipt-title">
            <span class="flex-grow-1">Loyalty program</span>
            <v-switch v-model="loyaltyForm.enabled" color="primary" density="compact" hide-details />
          </v-card-title>

          <v-divider />

          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Customers earn points on every sale attached to their profile,
              and staff can redeem a customer's points balance for a
              discount at checkout.
            </p>

            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model.number="loyaltyForm.pointsPerCurrency"
                  density="comfortable"
                  :disabled="!loyaltyForm.enabled"
                  :hint="`e.g. a ${formatCurrency(1)} sale earns ${loyaltyForm.pointsPerCurrency || 0} point(s)`"
                  :label="`Points earned per ${settingsState.currency.base || 'unit'} spent`"
                  min="0"
                  persistent-hint
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model.number="loyaltyForm.redemptionPointsPerCurrency"
                  density="comfortable"
                  :disabled="!loyaltyForm.enabled"
                  :hint="`e.g. ${loyaltyForm.redemptionPointsPerCurrency || 0} points redeem for ${formatCurrency(1)} off`"
                  :label="`Points required to redeem for 1 ${settingsState.currency.base || 'unit'}`"
                  min="1"
                  persistent-hint
                  type="number"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model.number="loyaltyForm.minRedeemPoints"
                  density="comfortable"
                  :disabled="!loyaltyForm.enabled"
                  hint="Balance a customer must hold before any redemption is offered at checkout"
                  label="Minimum points balance to redeem"
                  min="0"
                  persistent-hint
                  type="number"
                  variant="outlined"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-6 pb-5">
            <v-spacer />

            <v-tooltip :disabled="onlineState.isOnline" text="Reconnect to save settings">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="primary"
                  :disabled="!onlineState.isOnline"
                  :loading="savingLoyalty"
                  variant="flat"
                  @click="saveLoyalty"
                >
                  Save
                </v-btn>
              </template>
            </v-tooltip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
  import { onMounted, reactive, ref } from 'vue'
  import { useOnline } from '@/composables/useOnline'
  import { useSettings } from '@/composables/useSettings'
  import { useToast } from '@/composables/useToast'
  import { formatCurrency } from '@/utils/currency'

  const toast = useToast()
  const { state: onlineState } = useOnline()
  const {
    state: settingsState,
    loadCurrencySettings,
    saveCurrencySettings,
    loadLoyaltySettings,
    saveLoyaltySettings,
  } = useSettings()

  const saving = ref(false)
  const form = reactive({ base: 'USD', secondary: 'KHR', exchangeRate: 0 })

  const savingLoyalty = ref(false)
  const loyaltyForm = reactive({
    enabled: true,
    pointsPerCurrency: 1,
    redemptionPointsPerCurrency: 100,
    minRedeemPoints: 100,
  })

  onMounted(async () => {
    await Promise.all([loadCurrencySettings(), loadLoyaltySettings()])
    form.base = settingsState.currency.base
    form.secondary = settingsState.currency.secondary
    form.exchangeRate = settingsState.currency.exchangeRate

    loyaltyForm.enabled = settingsState.loyalty.enabled
    loyaltyForm.pointsPerCurrency = settingsState.loyalty.pointsPerCurrency
    loyaltyForm.redemptionPointsPerCurrency = settingsState.loyalty.redemptionPointsPerCurrency
    loyaltyForm.minRedeemPoints = settingsState.loyalty.minRedeemPoints
  })

  async function save () {
    saving.value = true
    try {
      await saveCurrencySettings({
        base: form.base.trim().toUpperCase(),
        secondary: form.secondary.trim().toUpperCase(),
        exchangeRate: Math.max(0, Number(form.exchangeRate) || 0),
      })
      toast.show('Currency settings saved.')
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to save settings.',
        'error',
      )
    } finally {
      saving.value = false
    }
  }

  async function saveLoyalty () {
    savingLoyalty.value = true
    try {
      await saveLoyaltySettings({
        enabled: loyaltyForm.enabled,
        pointsPerCurrency: Math.max(0, Number(loyaltyForm.pointsPerCurrency) || 0),
        redemptionPointsPerCurrency: Math.max(1, Number(loyaltyForm.redemptionPointsPerCurrency) || 1),
        minRedeemPoints: Math.max(0, Number(loyaltyForm.minRedeemPoints) || 0),
      })
      toast.show('Loyalty settings saved.')
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Unable to save loyalty settings.',
        'error',
      )
    } finally {
      savingLoyalty.value = false
    }
  }
</script>

<style scoped>
.receipt-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
