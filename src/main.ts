/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'

// Plugins
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

app.mount('#app')
