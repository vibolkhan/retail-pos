// src/stores/app.ts
import { defineStore } from 'pinia'
import type { CartItem } from '@/types/pos'

export const useAppStore = defineStore('app', {
  state: () => ({
    // Dark mode flag – persisted in localStorage
    isDark: localStorage.getItem('darkMode') === 'true',
    // Cart items – persisted in localStorage
    cart: (JSON.parse(localStorage.getItem('cart') ?? '[]') as CartItem[]) || [],
  }),
  actions: {
    toggleDark() {
      this.isDark = !this.isDark
      localStorage.setItem('darkMode', String(this.isDark))
    },
    setCart(items: CartItem[]) {
      this.cart = items
      localStorage.setItem('cart', JSON.stringify(this.cart))
    },
    addToCart(item: CartItem) {
      this.cart.push(item)
      localStorage.setItem('cart', JSON.stringify(this.cart))
    },
    removeFromCart(id: number) {
      this.cart = this.cart.filter((i) => i.id !== id)
      localStorage.setItem('cart', JSON.stringify(this.cart))
    },
  },
})
