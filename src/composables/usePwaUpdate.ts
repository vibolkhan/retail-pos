// src/composables/usePwaUpdate.ts
// Module-level singleton (same pattern as useToast.ts): the service worker
// only needs registering once for the app's lifetime, and every component
// that shows an "update available" banner reads the same shared state.
import { reactive } from 'vue'

const state = reactive({
  needsRefresh: false,
  offlineReady: false,
})

let updater: (() => Promise<void>) | null = null

// Called once from main.ts with the updateSW() function returned by
// virtual:pwa-register's registerSW(). Kept out of this composable's own
// registerSW() call so this file (and anything importing it) stays testable
// without pulling in the virtual module directly.
function setUpdater (fn: () => Promise<void>) {
  updater = fn
}

// Applies a waiting service worker update. Deliberately never called
// automatically (registerType: 'prompt' in vite.config.mts) — a POS
// mid-checkout should never be force-reloaded out from under a cashier.
async function applyUpdate () {
  if (updater) {
    await updater()
  }
}

export function usePwaUpdate () {
  return { state, setUpdater, applyUpdate }
}
