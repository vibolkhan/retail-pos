/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'

// Plugins
import { usePwaUpdate } from '@/composables/usePwaUpdate'
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Stores
import { useAuthStore } from '@/stores/auth'

// Styles
import 'unfonts.css'
import './styles/tailwind.css'
import './styles/main.scss'

const app = createApp(App)

registerPlugins(app)

// Kick off session/profile load immediately. Intentionally not awaited:
// App.vue gates rendering on isReady, and the router guard awaits this
// same memoized promise — awaiting here too would only delay first paint.
useAuthStore().init()

// registerSW() no-ops harmlessly if service workers aren't supported (e.g.
// during `vite dev`, where devOptions.enabled: false skips SW injection
// entirely) — safe to call unconditionally.
const pwaUpdate = usePwaUpdate()
const updateSW = registerSW({
  onNeedRefresh () {
    pwaUpdate.state.needsRefresh = true
  },
  onOfflineReady () {
    pwaUpdate.state.offlineReady = true
  },
})
pwaUpdate.setUpdater(() => updateSW(true))

app.mount('#app')
