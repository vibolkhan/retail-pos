/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

import type { Role } from '@/types/auth'
import { createRouter, createWebHistory } from 'vue-router'
import CartPage from '@/pages/CartPage.vue'
import CustomersPage from '@/pages/CustomersPage.vue'
import HomePage from '@/pages/HomePage.vue'
import InventoryPage from '@/pages/InventoryPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import OrderHistory from '@/pages/OrderHistory.vue'
import PosPage from '@/pages/PosPage.vue'
import ProfitLossPage from '@/pages/ProfitLossPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import { useAuthStore } from '@/stores/auth'

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
      component: HomePage,
      meta: { roles: ['admin', 'manager'] },
    },
    { path: '/home', redirect: '/' },
    {
      path: '/pos',
      component: PosPage,
      meta: { roles: ['admin', 'manager', 'salesperson'] },
    },
    {
      path: '/cart',
      component: CartPage,
      meta: { roles: ['admin', 'manager', 'salesperson'] },
    },
    {
      path: '/inventory',
      component: InventoryPage,
      meta: { roles: ['admin', 'manager'] },
    },
    { path: '/carts', redirect: '/cart' },
    {
      path: '/sales',
      component: OrderHistory,
      meta: { roles: ['admin', 'manager'] },
    },
    {
      path: '/customers',
      component: CustomersPage,
      meta: { roles: ['admin', 'manager'] },
    },
    {
      path: '/pnl',
      component: ProfitLossPage,
      meta: { roles: ['admin', 'manager'] },
    },
    {
      path: '/settings',
      component: SettingsPage,
      meta: { roles: ['admin', 'manager'] },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { public: true },
    },
    // catch‑all for unknown routes – redirect to home (prevents 404 on refresh)
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

function roleHome (role: Role | null) {
  return role === 'salesperson' ? '/pos' : '/'
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
      return roleHome(authStore.role)
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
    return roleHome(authStore.role)
  }

  return true
})

export default router
