import type { CartItem } from '@/types/pos'
// src/stores/app.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

// Carts are stored per branch so switching branches never mixes them
function cartKey (branchId?: number) {
  const id = branchId ?? localStorage.getItem('activeBranchId') ?? '1'
  return `cart:${id}`
}

function readCart (branchId?: number): CartItem[] {
  return (JSON.parse(localStorage.getItem(cartKey(branchId)) ?? '[]') as CartItem[]) || []
}

export const useAppStore = defineStore('app', () => {
  // Dark mode flag – persisted in localStorage
  const isDark = ref(localStorage.getItem('darkMode') === 'true')
  // Cart items for the active branch – persisted in localStorage
  const cart = ref<CartItem[]>(readCart())

  function setDark (value: boolean) {
    isDark.value = value
    localStorage.setItem('darkMode', String(value))
  }

  function toggleDark () {
    setDark(!isDark.value)
  }

  function setCart (items: CartItem[]) {
    cart.value = items
    localStorage.setItem(cartKey(), JSON.stringify(cart.value))
  }

  function addToCart (item: CartItem) {
    cart.value.push(item)
    localStorage.setItem(cartKey(), JSON.stringify(cart.value))
  }

  function reloadCartForBranch (branchId: number) {
    cart.value = readCart(branchId)
  }

  return { isDark, cart, toggleDark, setDark, setCart, addToCart, reloadCartForBranch }
})
