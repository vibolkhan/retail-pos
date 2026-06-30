<template>
  <v-app-bar color="primary" flat>
    <v-app-bar-title class="font-weight-bold">
      Retail POS System
    </v-app-bar-title>

    <v-spacer />

    <v-btn
      v-for="item in navigationItems"
      :key="item.to"
      :active="route.path === item.to"
      class="d-none d-sm-inline-flex"
      :prepend-icon="item.icon"
      :to="item.to"
      variant="text"
    >
      {{ item.title }}
    </v-btn>

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
  </v-app-bar>

  <v-bottom-navigation class="d-sm-none" color="primary" grow>
    <v-btn
      v-for="item in navigationItems"
      :key="item.to"
      :to="item.to"
    >
      <v-icon :icon="item.icon" />
      <span>{{ item.title }}</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useCart } from '@/composables/useCart'

  const route = useRoute()
  const theme = useTheme()
  const { itemCount } = useCart()

  const cartRoute = '/cart'
  const navigationItems = [
    { title: 'Home', icon: 'mdi-view-dashboard', to: '/' },
    { title: 'POS', icon: 'mdi-cash-register', to: '/pos' },
    { title: 'Cart', icon: 'mdi-cart', to: cartRoute },
    { title: 'Sales', icon: 'mdi-history', to: '/sales' },
  ]

  const themeIcon = computed(() => theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night')

  function toggleTheme () {
    theme.change(theme.global.current.value.dark ? 'lightBlueLight' : 'lightBlueDark')
  }
</script>
