<template>
  <v-app>
    <template v-if="authStore.isReady">
      <AppHeader v-if="!route.meta.public" />

      <v-main>
        <router-view />
      </v-main>

      <v-snackbar
        v-model="showFlash"
        :color="authStore.flash?.color"
        timeout="3000"
      >
        {{ authStore.flash?.message }}
      </v-snackbar>

      <v-snackbar v-model="toast.state.show" :color="toast.state.color" timeout="3000">
        {{ toast.state.message }}
      </v-snackbar>
    </template>

    <v-main v-else class="d-flex align-center justify-center" style="height: 100vh">
      <v-progress-circular color="primary" indeterminate size="64" />
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import AppHeader from '@/components/AppHeader.vue'
  import { useToast } from '@/composables/useToast'
  import { useAuthStore } from '@/stores/auth'

  const route = useRoute()
  const authStore = useAuthStore()
  const toast = useToast()

  const showFlash = computed({
    get: () => !!authStore.flash,
    set: (value: boolean) => {
      if (!value) authStore.flash = null
    },
  })
</script>
