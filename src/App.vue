<template>
  <v-app id="inspire">
    <v-navigation-drawer v-model="drawer">
      <v-card class="mx-auto pa-4" max-width="300" elevation="0">
        <v-list density="compact">
          <v-list-item
            v-for="(item, i) in items"
            :key="i"
            :value="item"
            color="primary"
            :to="item.to"
          >
            <template v-slot:prepend>
              <v-icon :icon="item.icon"></v-icon>
            </template>

            <v-list-item-title v-text="item.text"></v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-navigation-drawer>

    <v-app-bar>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>

      <v-app-bar-title>Retail POS System</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from "vue";

const drawer = ref(null);

const items = [
  { text: "Home", icon: "mdi-home", to: "/" },
  { text: "POS", icon: "mdi-cash-register", to: "/pos" },
  { text: "Carts", icon: "mdi-cart", to: "/carts" },
];
</script>

<script>
export default {
  data: () => ({ drawer: null }),
};
</script>
