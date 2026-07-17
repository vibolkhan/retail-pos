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
    'background': '#F5F7F7',
    'surface': '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#EDF2F1',
    'surface-variant': '#E1F1EC',
    'on-surface-variant': '#0A5147',
    'primary': '#0E6E64',
    'on-primary': '#FFFFFF',
    'primary-darken-1': '#0A5147',
    'secondary': '#2A6FA0',
    'on-secondary': '#FFFFFF',
    'secondary-darken-1': '#1F5A85',
    'accent': '#0A5147',
    'on-accent': '#FFFFFF',
    'error': '#B23B3A',
    'on-error': '#FFFFFF',
    'info': '#2A6FA0',
    'on-info': '#FFFFFF',
    'success': '#1F8A5B',
    'on-success': '#FFFFFF',
    'warning': '#B8790A',
    'on-warning': '#1F1600',
    'wholesale': '#A15C2A',
    'on-wholesale': '#FFFFFF',
  },
}

const lightBlueDarkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#0E1716',
    'surface': '#162220',
    'surface-bright': '#1B2826',
    'surface-light': '#101A18',
    'surface-variant': 'rgba(79, 211, 184, 0.14)',
    'on-surface-variant': '#7EE0C9',
    'primary': '#4FD3B8',
    'on-primary': '#04241E',
    'primary-darken-1': '#7EE0C9',
    'secondary': '#6FB3DE',
    'on-secondary': '#04241E',
    'secondary-darken-1': '#8FC5E6',
    'accent': '#7EE0C9',
    'on-accent': '#04241E',
    'error': '#E8837F',
    'on-error': '#3A0A08',
    'info': '#6FB3DE',
    'on-info': '#04241E',
    'success': '#4CBE86',
    'on-success': '#00390A',
    'warning': '#E0A83C',
    'on-warning': '#2E1B08',
    'wholesale': '#E3A15C',
    'on-wholesale': '#2E1B08',
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
