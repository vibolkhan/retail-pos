<template>
  <!-- Desktop / tablet: persistent left rail is the primary nav (nothing
       occupied this role before — the bottom nav below is `d-sm-none`,
       so >=600px previously had no way to reach Home/Inventory/Sales
       except the URL bar), plus a top bar next to it for the current page
       title and the status/account controls (moved up from the rail
       footer, which now only shows the logged-in user). -->
  <template v-if="smAndUp">
    <v-navigation-drawer
      class="app-rail"
      color="surface"
      permanent
      width="236"
    >
      <div class="rail-brand">
        <v-avatar color="primary" rounded="lg" size="30">
          <v-icon color="on-primary" icon="mdi-receipt-text-outline" size="16" />
        </v-avatar>

        <span class="rail-brand-word">Retail POS</span>
      </div>

      <v-menu>
        <template #activator="{ props: menuProps }">
          <button
            aria-label="Switch branch"
            class="branch-pill"
            :class="branchStore.isWholesale ? 'branch-pill--wholesale' : 'branch-pill--retail'"
            type="button"
            v-bind="menuProps"
          >
            <v-icon :icon="branchIcon" size="16" />
            <span class="bp-name">{{ branchStore.activeBranch?.name ?? 'Branch' }}</span>
            <v-icon icon="mdi-chevron-down" size="14" />
          </button>
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

      <v-list v-model:opened="openGroups" class="rail-nav" density="compact" nav>
        <template v-for="item in navigationItems" :key="item.to">
          <v-list-group v-if="item.children" :value="item.to">
            <template #activator="{ props: groupProps }">
              <v-list-item
                v-bind="groupProps"
                class="rail-item"
                :prepend-icon="item.icon"
                rounded="lg"
                :title="item.title"
              />
            </template>

            <v-list-item
              v-for="child in item.children"
              :key="child.to"
              class="rail-item rail-item--child"
              :prepend-icon="child.icon"
              rounded="lg"
              :title="child.title"
              :to="child.to"
            />
          </v-list-group>

          <v-list-item
            v-else
            class="rail-item"
            :prepend-icon="item.icon"
            rounded="lg"
            :title="item.title"
            :to="item.to"
          >
            <template v-if="item.to === cartRoute && itemCount > 0" #append>
              <v-badge color="primary" :content="itemCount" inline />
            </template>
          </v-list-item>
        </template>
      </v-list>

      <v-spacer />

      <div class="rail-footer">
        <v-divider class="mb-2" />

        <div class="rail-footer-row">
          <div class="rail-user">
            <span class="rail-user-email">{{ authStore.profile?.email }}</span>
            <span class="rail-user-role">{{ authStore.role }}</span>
          </div>

          <v-btn
            aria-label="Log out"
            icon="mdi-logout"
            size="small"
            variant="text"
            @click="handleLogout"
          />
        </div>
      </div>
    </v-navigation-drawer>

    <v-app-bar :color="channelColor" flat>
      <v-app-bar-title>{{ pageTitle }}</v-app-bar-title>

      <v-spacer />

      <v-tooltip v-if="pendingCount > 0 || failedCount > 0" location="bottom">
        <template #activator="{ props: tooltipProps }">
          <v-chip
            class="mr-2"
            :color="failedCount > 0 ? 'error' : 'warning'"
            :prepend-icon="failedCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-cloud-sync-outline'"
            size="small"
            v-bind="tooltipProps"
            variant="tonal"
          >
            {{ failedCount > 0 ? `${failedCount} need attention` : `${pendingCount} pending sync` }}
          </v-chip>
        </template>

        <span v-if="failedCount > 0">
          {{ failedCount }} offline sale(s) couldn't sync automatically — a manager should check them.
        </span>

        <span v-else>
          {{ pendingCount }} sale(s) recorded offline, waiting to sync once reconnected.
        </span>
      </v-tooltip>

      <v-btn
        aria-label="Toggle theme"
        class="ml-1"
        :icon="themeIcon"
        variant="text"
        @click="toggleTheme"
      />

      <v-btn aria-label="Cart" class="ml-1" :to="cartRoute" variant="text">
        <v-badge v-if="itemCount > 0" color="error" :content="itemCount">
          <v-icon icon="mdi-cart" />
        </v-badge>

        <v-icon v-else icon="mdi-cart" />
      </v-btn>
    </v-app-bar>
  </template>

  <!-- Mobile: slim top bar with a hamburger that opens the full nav list
       in a slide-out drawer, instead of a bottom tab bar. -->
  <template v-else>
    <v-app-bar :color="channelColor" flat>
      <v-app-bar-nav-icon aria-label="Open menu" @click="mobileDrawerOpen = true" />

      <v-app-bar-title class="rail-brand-word">
        Retail POS
      </v-app-bar-title>

      <v-spacer />

      <v-chip
        v-if="pendingCount > 0 || failedCount > 0"
        class="ml-1"
        :color="failedCount > 0 ? 'error' : 'warning'"
        density="comfortable"
        :prepend-icon="failedCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-cloud-sync-outline'"
        size="small"
        variant="tonal"
      >
        {{ failedCount > 0 ? failedCount : pendingCount }}
      </v-chip>

      <v-btn
        aria-label="Toggle theme"
        class="ml-1"
        :icon="themeIcon"
        variant="text"
        @click="toggleTheme"
      />

      <!-- Cart and Logout sit together at the end — branch switching moved
           into the drawer below, alongside the rest of the nav. -->
      <v-btn aria-label="Cart" class="ml-1" :to="cartRoute" variant="text">
        <v-badge v-if="itemCount > 0" color="error" :content="itemCount">
          <v-icon icon="mdi-cart" />
        </v-badge>

        <v-icon v-else icon="mdi-cart" />
      </v-btn>

      <v-btn
        aria-label="Log out"
        class="ml-1"
        icon="mdi-logout"
        variant="text"
        @click="handleLogout"
      />
    </v-app-bar>

    <v-navigation-drawer v-model="mobileDrawerOpen" class="app-rail" location="left" temporary>
      <v-menu>
        <template #activator="{ props: menuProps }">
          <button
            aria-label="Switch branch"
            class="branch-pill"
            :class="branchStore.isWholesale ? 'branch-pill--wholesale' : 'branch-pill--retail'"
            type="button"
            v-bind="menuProps"
          >
            <v-icon :icon="branchIcon" size="16" />
            <span class="bp-name">{{ branchStore.activeBranch?.name ?? 'Branch' }}</span>
            <v-icon icon="mdi-chevron-down" size="14" />
          </button>
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

      <v-list v-model:opened="openGroups" class="rail-nav" density="compact" nav>
        <template v-for="item in navigationItems" :key="item.to">
          <v-list-group v-if="item.children" :value="item.to">
            <template #activator="{ props: groupProps }">
              <v-list-item
                v-bind="groupProps"
                class="rail-item"
                :prepend-icon="item.icon"
                rounded="lg"
                :title="item.title"
              />
            </template>

            <v-list-item
              v-for="child in item.children"
              :key="child.to"
              class="rail-item rail-item--child"
              :prepend-icon="child.icon"
              rounded="lg"
              :title="child.title"
              :to="child.to"
              @click="mobileDrawerOpen = false"
            />
          </v-list-group>

          <v-list-item
            v-else
            class="rail-item"
            :prepend-icon="item.icon"
            rounded="lg"
            :title="item.title"
            :to="item.to"
            @click="mobileDrawerOpen = false"
          >
            <template v-if="item.to === cartRoute && itemCount > 0" #append>
              <v-badge color="primary" :content="itemCount" inline />
            </template>
          </v-list-item>
        </template>
      </v-list>
    </v-navigation-drawer>
  </template>
</template>

<script lang="ts" setup>
  import type { Role } from '@/types/auth'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay, useTheme } from 'vuetify'
  import { useCart } from '@/composables/useCart'
  import { useSalesSyncQueue } from '@/composables/useSalesSyncQueue'
  import { useAppStore } from '@/stores/app'
  import { useAuthStore } from '@/stores/auth'
  import { useBranchStore } from '@/stores/branch'

  const router = useRouter()
  const route = useRoute()
  const theme = useTheme()
  const { smAndUp } = useDisplay()
  const { itemCount } = useCart()
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const branchStore = useBranchStore()
  const { pendingCount, failedCount } = useSalesSyncQueue()

  onMounted(() => {
    branchStore.loadBranches()
  })

  const branchIcon = computed(() =>
    branchStore.isWholesale ? 'mdi-warehouse' : 'mdi-store',
  )

  // Mobile chrome (app bar + bottom nav) recolors to the active branch's
  // channel — teal for retail, copper for wholesale — the same signal the
  // rail's branch pill and every stock/channel chip carry elsewhere.
  const channelColor = computed(() =>
    branchStore.isWholesale ? 'wholesale' : 'primary',
  )

  const cartRoute = '/cart'

  type NavChild = { title: string, icon: string, to: string, roles: Role[] }
  type NavItem = NavChild & { children?: NavChild[] }

  const allNavigationItems: NavItem[] = [
    { title: 'Home', icon: 'mdi-view-dashboard', to: '/', roles: ['admin', 'manager'] },
    { title: 'POS', icon: 'mdi-cash-register', to: '/pos', roles: ['admin', 'manager', 'salesperson'] },
    { title: 'Cart', icon: 'mdi-cart', to: cartRoute, roles: ['admin', 'manager', 'salesperson'] },
    { title: 'Inventory', icon: 'mdi-warehouse', to: '/inventory', roles: ['admin', 'manager'] },
    { title: 'Purchase', icon: 'mdi-truck-delivery-outline', to: '/purchases', roles: ['admin', 'manager'] },
    { title: 'Sales', icon: 'mdi-history', to: '/sales', roles: ['admin', 'manager'] },
    {
      title: 'Configuration',
      icon: 'mdi-tune-variant',
      // Not a real route — the activator never binds `:to`, so this is only
      // used as the v-for key / v-list-group identity. It must not equal
      // any child's `to`, or Vuetify's active-route tracking treats the
      // group itself as "the" active item and collapses it right as you
      // click into that matching child.
      to: '/configuration',
      roles: ['admin', 'manager'],
      children: [
        { title: 'Settings', icon: 'mdi-cog-outline', to: '/settings', roles: ['admin', 'manager'] },
        { title: 'Customers', icon: 'mdi-account-multiple-outline', to: '/customers', roles: ['admin', 'manager'] },
        { title: 'P&L', icon: 'mdi-finance', to: '/pnl', roles: ['admin', 'manager'] },
        { title: 'Category', icon: 'mdi-shape-outline', to: '/configuration/categories', roles: ['admin', 'manager'] },
        { title: 'Batch Unit', icon: 'mdi-package-variant-closed', to: '/configuration/batch-units', roles: ['admin', 'manager'] },
        { title: 'Product', icon: 'mdi-package-variant', to: '/configuration/products', roles: ['admin', 'manager'] },
        { title: 'Supplier', icon: 'mdi-truck-outline', to: '/configuration/suppliers', roles: ['admin', 'manager'] },
      ],
    },
  ]

  const navigationItems = computed(() =>
    allNavigationItems.filter(item => authStore.role && item.roles.includes(authStore.role)),
  )

  // v-list-group's expand state is normally tracked internally by v-list —
  // navigating to a child (e.g. Settings) re-evaluates which item is
  // "active" and Vuetify's default open-strategy collapses any group that
  // isn't the active one, closing Configuration right as you click into
  // one of its own children. Owning the opened array ourselves and keeping
  // a group's key in it whenever the current route matches one of its
  // children stops that — the group only closes if the user clicks it shut.
  const openGroups = ref<string[]>([])
  watch(
    () => route.path,
    path => {
      for (const item of allNavigationItems) {
        if (item.children?.some(child => child.to === path) && !openGroups.value.includes(item.to)) {
          openGroups.value = [...openGroups.value, item.to]
        }
      }
    },
    { immediate: true },
  )

  // Mobile has no room for a tab bar wide enough to fit every nav item, so
  // it opens the same list in a slide-out drawer instead (triggered from
  // the hamburger icon in the mobile app bar below).
  const mobileDrawerOpen = ref(false)

  // No page currently renders its own title, and routes carry no title
  // meta — the nav item list is the only place a route-to-label mapping
  // already exists, so the desktop top bar reuses it instead of duplicating it.
  // Configuration's children aren't top-level entries, so they're searched too.
  const pageTitle = computed(() => {
    for (const item of allNavigationItems) {
      const child = item.children?.find(c => c.to === route.path)
      if (child) return child.title
      if (item.to === route.path) return item.title
    }
    return 'Retail POS'
  })

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

<style scoped>
/* v-navigation-drawer renders its default slot inside a nested
   .v-navigation-drawer__content div, not on the component's own root —
   the flex column + gap/padding have to target that inner div directly
   or the v-spacer below has no flex container to grow inside of. */
.app-rail :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 14px;
  gap: 18px;
}

.rail-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}

.rail-brand-word {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* The mobile app-bar packs the wordmark alongside three icon buttons in
   much less width than the desktop rail gets — tighten it so "Retail POS"
   never truncates on narrow phones. */
.v-app-bar .rail-brand-word {
  font-size: 13px;
  letter-spacing: 0.02em;
}

.branch-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  border-radius: 6px;
  padding: 10px 11px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

.branch-pill--retail {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-primary));
}

.branch-pill--wholesale {
  background: rgba(var(--v-theme-wholesale), 0.14);
  color: rgb(var(--v-theme-wholesale));
}

.branch-pill .bp-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-nav {
  overflow-y: auto;
}

.rail-nav :deep(.v-list-item) {
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 2px;
}

.rail-nav :deep(.rail-item--child) {
  padding-inline-start: 28px !important;
}

/* Replace Vuetify's filled active pill with a quiet tint + a left accent
   bar — reads as "current page" without competing with the branch pill
   or the cart badge for the same teal. */
.rail-nav :deep(.v-list-item--active) {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-primary));
  position: relative;
}

.rail-nav :deep(.v-list-item--active)::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: rgb(var(--v-theme-primary));
  opacity: 1;
}

.rail-footer-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
}

.rail-user {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 0 6px;
}

.rail-user-email {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-user-role {
  font-size: 10.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
