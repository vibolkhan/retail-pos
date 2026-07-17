// src/composables/useToast.ts
import { reactive } from 'vue'

// Module-level singleton: every page shares one toast instead of each
// declaring its own local `reactive({show,message,color})` + <v-snackbar>.
const state = reactive({
  show: false,
  message: '',
  color: 'success',
})

export function useToast () {
  function show (message: string, color = 'success') {
    state.message = message
    state.color = color
    state.show = true
  }

  return { state, show }
}
