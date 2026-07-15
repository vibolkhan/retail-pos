<template>
  <v-app-bar color="primary" flat>
    <v-app-bar-title class="font-weight-bold">
      Retail POS
    </v-app-bar-title>

    <v-spacer />

    <v-menu>
      <template #activator="{ props: menuProps }">
        <v-btn
          aria-label="Switch branch"
          class="ml-1"
          v-bind="menuProps"
          :prepend-icon="branchIcon"
          variant="text"
        >
          <span class="hidden sm:inline">{{ branchStore.activeBranch?.name ?? 'Branch' }}</span>
          <v-icon icon="mdi-chevron-down" size="small" />
        </v-btn>
      </template>

      <v-list density="compact">
        <v-list-item
          v-for="branch in branchStore.branches"
          :key="branch.id"
          :active="branch.id === branchStore.activeBranchId"
          :prepend-icon="branch.type === 'wholesale' ? 'mdi-warehouse' : 'mdi-store'"
          :title="branch.name"
          @click="branchStore.setActiveBranch(branch.id)"
        />
      </v-list>
    </v-menu>

    <v-btn
      aria-label="Toggle theme"
      class="ml-1"
      :icon="themeIcon"
      variant="text"
      @click="toggleTheme"
    />

    <v-btn
      aria-label="Open cart"
      class="ml-1"
      icon
      :to="cartRoute"
      variant="text"
    >
      <v-badge
        color="error"
        :content="itemCount"
        :model-value="itemCount > 0"
      >
        <v-icon icon="mdi-cart" />
      </v-badge>
    </v-btn>

    <v-btn
      aria-label="Log out"
      class="ml-1"
      icon="mdi-logout"
      variant="text"
      @click="handleLogout"
    />
  </v-app-bar>

  <v-bottom-navigation class="d-sm-none" color="primary" grow>
    <v-btn
      v-for="item in navigationItems"
      :key="item.to"
      class="flex-column"
      :to="item.to"
      variant="text"
    >
      <v-icon :icon="item.icon" />
      <span class="text-caption">{{ item.title }}</span>
    </v-btn>
  </v-bottom-navigation>

</template>

<script lang="ts" setup>
  import type { Role } from '@/types/auth'
  import { computed, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useCart } from '@/composables/useCart'
  import { useAppStore } from '@/stores/app'
  import { useAuthStore } from '@/stores/auth'
  import { useBranchStore } from '@/stores/branch'

  const router = useRouter()
  const theme = useTheme()
  const { itemCount } = useCart()
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const branchStore = useBranchStore()

  onMounted(() => {
    branchStore.loadBranches()
  })

  const branchIcon = computed(() =>
    branchStore.isWholesale ? 'mdi-warehouse' : 'mdi-store',
  )

  const cartRoute = '/cart'
  const allNavigationItems: Array<{ title: string, icon: string, to: string, roles: Role[] }> = [
    { title: 'Home', icon: 'mdi-view-dashboard', to: '/', roles: ['admin'] },
    { title: 'POS', icon: 'mdi-cash-register', to: '/pos', roles: ['admin', 'salesperson'] },
    { title: 'Cart', icon: 'mdi-cart', to: cartRoute, roles: ['admin', 'salesperson'] },
    { title: 'Inventory', icon: 'mdi-warehouse', to: '/inventory', roles: ['admin'] },
    { title: 'Sales', icon: 'mdi-history', to: '/sales', roles: ['admin'] },
  ]

  const navigationItems = computed(() =>
    allNavigationItems.filter(item => authStore.role && item.roles.includes(authStore.role)),
  )

  const themeIcon = computed(() => theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night')

  function toggleTheme () {
    const nextDark = !theme.global.current.value.dark
    theme.change(nextDark ? 'lightBlueDark' : 'lightBlueLight')
    appStore.setDark(nextDark)
  }

  async function handleLogout () {
    await authStore.logout()
    router.push('/login')
  }
</script>
