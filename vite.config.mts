import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import Vue from '@vitejs/plugin-vue'
import Fonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    Fonts({
      fontsource: {
        families: [
          {
            name: 'IBM Plex Mono',
            weights: [400, 500, 600, 700],
          },
          {
            name: 'IBM Plex Sans',
            weights: [400, 500, 600, 700],
          },
          {
            name: 'Oswald',
            weights: [500, 600, 700],
          },
        ],
      },
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    // Every route is a separate lazy chunk (router/index.ts), and each pulls
    // in its own set of Vuetify components via autoImport's deep
    // `vuetify/components/VXxx` imports — imports the esbuild dep scanner
    // can't see ahead of time since they're inserted by the SFC template
    // compiler, not present as literal import statements. Without this,
    // Vite only discovers a page's components the first time that route is
    // visited, forces a dependency re-optimize, and tells the browser to
    // reload — which aborts whatever navigation was in flight, so clicking
    // a nav item can silently reload back to the current page instead of
    // going to the clicked one. Listing them here bundles everything at
    // server start instead of piecemeal per first-visit.
    include: [
      'vuetify/components/VAlert',
      'vuetify/components/VApp',
      'vuetify/components/VAppBar',
      'vuetify/components/VAvatar',
      'vuetify/components/VBadge',
      'vuetify/components/VBottomNavigation',
      'vuetify/components/VBtn',
      'vuetify/components/VCard',
      'vuetify/components/VChip',
      'vuetify/components/VCombobox',
      'vuetify/components/VDataTable',
      'vuetify/components/VDatePicker',
      'vuetify/components/VDialog',
      'vuetify/components/VDivider',
      'vuetify/components/VEmptyState',
      'vuetify/components/VForm',
      'vuetify/components/VGrid',
      'vuetify/components/VIcon',
      'vuetify/components/VImg',
      'vuetify/components/VList',
      'vuetify/components/VMain',
      'vuetify/components/VMenu',
      'vuetify/components/VNavigationDrawer',
      'vuetify/components/VProgressCircular',
      'vuetify/components/VSelect',
      'vuetify/components/VSkeletonLoader',
      'vuetify/components/VSnackbar',
      'vuetify/components/VSwitch',
      'vuetify/components/VTable',
      'vuetify/components/VTextField',
      'vuetify/components/VTooltip',
      'chart.js',
      'jspdf',
      'jspdf-autotable',
      'exceljs',
    ],
  },
})
