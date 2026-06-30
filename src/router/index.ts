/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes: [
    {
      path: '/',
      component: () => import('@/pages/HomePage.vue'),
    },
    { path: '/home', redirect: '/' },
    { path: '/pos', component: () => import('@/pages/PosPage.vue') },
    { path: '/cart', component: () => import('@/pages/CartPage.vue') },
    { path: '/inventory', component: () => import('@/pages/InventoryPage.vue') },
    { path: '/carts', redirect: '/cart' },
    { path: '/sales', component: () => import('@/pages/OrderHistory.vue') },
    // catch‑all for unknown routes – redirect to home (prevents 404 on refresh)
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
