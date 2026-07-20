// src/composables/useOnline.ts
// Module-level singleton (same pattern as useToast.ts): the connectivity
// listeners only need registering once for the app's lifetime, and every
// consumer (offline read cache, sales sync queue, UI banners) reads the
// same shared reactive flag instead of each wiring its own listeners.
import { reactive } from 'vue'

const state = reactive({
  isOnline: navigator.onLine,
})

window.addEventListener('online', () => {
  state.isOnline = true
})

window.addEventListener('offline', () => {
  state.isOnline = false
})

export function useOnline () {
  return { state }
}
