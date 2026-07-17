/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: Role[]
    public?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes: [
    {
      path: '/',
      component: () => import('@/pages/HomePage.vue'),
      meta: { roles: ['admin'] },
    },
    { path: '/home', redirect: '/' },
    {
      path: '/pos',
      component: () => import('@/pages/PosPage.vue'),
      meta: { roles: ['admin', 'salesperson'] },
    },
    {
      path: '/cart',
      component: () => import('@/pages/CartPage.vue'),
      meta: { roles: ['admin', 'salesperson'] },
    },
    {
      path: '/inventory',
      component: () => import('@/pages/InventoryPage.vue'),
      meta: { roles: ['admin'] },
    },
    { path: '/carts', redirect: '/cart' },
    {
      path: '/sales',
      component: () => import('@/pages/OrderHistory.vue'),
      meta: { roles: ['admin'] },
    },
    {
      path: '/pnl',
      component: () => import('@/pages/ProfitLossPage.vue'),
      meta: { roles: ['admin'] },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    // catch‑all for unknown routes – redirect to home (prevents 404 on refresh)
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

function roleHome(isAdmin: boolean) {
  return isAdmin ? '/' : '/pos'
}

router.beforeEach(async to => {
  const authStore = useAuthStore()
  try {
    await authStore.init()
  } catch {
    // init() resets itself for a retry on the next navigation; fall through
    // to the unauthenticated path below instead of aborting this navigation.
  }

  if (to.meta.public) {
    if (to.name === 'login' && authStore.isAuthenticated && authStore.role) {
      return roleHome(authStore.isAdmin)
    }
    return true
  }

  if (!authStore.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!authStore.role) {
    await authStore.logout()
    authStore.flash = {
      message: 'No profile found for this account. Contact an administrator.',
      color: 'error',
    }
    return '/login'
  }

  const allowedRoles = to.meta.roles
  if (allowedRoles && !allowedRoles.includes(authStore.role)) {
    authStore.flash = {
      message: 'You are not authorized to view that page.',
      color: 'error',
    }
    return roleHome(authStore.isAdmin)
  }

  return true
})

export default router
