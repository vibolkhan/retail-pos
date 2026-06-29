/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

// Composables
import { createRouter, createWebHistory } from "vue-router";
import Index from "@/pages/index.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: Index,
    },
    {
      path: "/home",
      component: () => import("@/pages/home/HomePage.vue"),
    },
    {
      path: "/pos",
      component: () => import("@/pages/pos/POSPage.vue"),
    },
    {
      path: "/carts",
      component: () => import("@/pages/carts/CartsPage.vue"),
    },
  ],
});

export default router;
