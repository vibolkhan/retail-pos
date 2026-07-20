// src/composables/useSettings.ts
import type { CurrencySettings, LoyaltySettings } from '@/composables/useSupabase'
import { reactive } from 'vue'
import { cachedFetch } from '@/composables/useOfflineCache'
import { useOnline } from '@/composables/useOnline'
import {
  getCurrencySettings,
  getLoyaltySettings,
  updateCurrencySettings,
  updateLoyaltySettings,
} from '@/composables/useSupabase'

// Module-level singleton (same pattern as useToast.ts): every page shares
// one fetch of currency settings instead of each page loading its own copy.
const DEFAULT_CURRENCY: CurrencySettings = { base: 'USD', secondary: 'KHR', exchangeRate: 0 }
const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  pointsPerCurrency: 1,
  redemptionPointsPerCurrency: 100,
  minRedeemPoints: 100,
}

const state = reactive({
  currency: { ...DEFAULT_CURRENCY },
  loaded: false,
  loyalty: { ...DEFAULT_LOYALTY },
  loyaltyLoaded: false,
})

let loadPromise: Promise<void> | null = null

async function loadCurrencySettings () {
  if (loadPromise) {
    return loadPromise
  }

  loadPromise = (async () => {
    // Load-bearing offline, not cosmetic: checkout's totals/points math
    // reads state.currency/state.loyalty, so a fetch failure with nothing
    // cached yet must NOT silently fall back to the hardcoded defaults
    // above and let a sale total using the wrong exchange rate.
    const { data } = await cachedFetch('settings:currency', getCurrencySettings, useOnline().state.isOnline)
    if (data) {
      state.currency = data
    }
    state.loaded = true
  })().catch(error => {
    loadPromise = null
    throw error
  })

  return loadPromise
}

async function saveCurrencySettings (settings: CurrencySettings) {
  await updateCurrencySettings(settings)
  state.currency = settings
}

let loyaltyLoadPromise: Promise<void> | null = null

async function loadLoyaltySettings () {
  if (loyaltyLoadPromise) {
    return loyaltyLoadPromise
  }

  loyaltyLoadPromise = (async () => {
    const { data } = await cachedFetch('settings:loyalty', getLoyaltySettings, useOnline().state.isOnline)
    if (data) {
      state.loyalty = data
    }
    state.loyaltyLoaded = true
  })().catch(error => {
    loyaltyLoadPromise = null
    throw error
  })

  return loyaltyLoadPromise
}

async function saveLoyaltySettings (settings: LoyaltySettings) {
  await updateLoyaltySettings(settings)
  state.loyalty = settings
}

export function useSettings () {
  return {
    state,
    loadCurrencySettings,
    saveCurrencySettings,
    loadLoyaltySettings,
    saveLoyaltySettings,
  }
}
