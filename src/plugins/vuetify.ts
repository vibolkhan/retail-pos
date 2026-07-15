/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com
 */

import type { ThemeDefinition } from 'vuetify'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import '../styles/layers.css'
import 'vuetify/styles'

const lightBlueLightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    'background': '#F4FAFF',
    'surface': '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#E3F2FD',
    'surface-variant': '#C7E6F7',
    'on-surface-variant': '#294957',
    'primary': '#0288D1',
    'on-primary': '#FFFFFF',
    'primary-darken-1': '#026AA3',
    'secondary': '#4FC3F7',
    'on-secondary': '#00344E',
    'secondary-darken-1': '#039BE5',
    'accent': '#00ACC1',
    'on-accent': '#FFFFFF',
    'error': '#B3261E',
    'on-error': '#FFFFFF',
    'info': '#0277BD',
    'on-info': '#FFFFFF',
    'success': '#2E7D32',
    'on-success': '#FFFFFF',
    'warning': '#ED6C02',
    'on-warning': '#1F1600',
  },
}

const lightBlueDarkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#071923',
    'surface': '#0D2433',
    'surface-bright': '#17384A',
    'surface-light': '#143247',
    'surface-variant': '#264E63',
    'on-surface-variant': '#B9D7E7',
    'primary': '#4FC3F7',
    'on-primary': '#002F47',
    'primary-darken-1': '#0288D1',
    'secondary': '#81D4FA',
    'on-secondary': '#00344E',
    'secondary-darken-1': '#4FC3F7',
    'accent': '#26C6DA',
    'on-accent': '#002F47',
    'error': '#FFB4AB',
    'on-error': '#690005',
    'info': '#82D4FF',
    'on-info': '#00344E',
    'success': '#8BD68F',
    'on-success': '#00390A',
    'warning': '#FFB86B',
    'on-warning': '#4A2800',
  },
}

// Restore the user's explicit choice (persisted by useAppStore.setDark);
// fall back to the OS preference until they toggle for the first time.
const savedDarkMode = localStorage.getItem('darkMode')

export default createVuetify({
  theme: {
    defaultTheme:
      savedDarkMode === null
        ? 'system'
        : (savedDarkMode === 'true'
            ? 'lightBlueDark'
            : 'lightBlueLight'),
    themes: {
      light: lightBlueLightTheme,
      dark: lightBlueDarkTheme,
      lightBlueLight: lightBlueLightTheme,
      lightBlueDark: lightBlueDarkTheme,
    },
  },
  display: {
    mobileBreakpoint: 'md',
    thresholds: {
      xs: 0,
      sm: 600,
      md: 840,
      lg: 1145,
      xl: 1545,
      xxl: 2138,
    },
  },
})
