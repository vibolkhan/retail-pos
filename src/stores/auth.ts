// src/stores/auth.ts
import type { Session } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import {
  getProfile,
  signInWithPassword,
  signOut as authSignOut,
} from "@/composables/useAuth";
import type { AuthProfile, Role } from "@/types/auth";
import { supabase } from "@/utils/supabase";

// Module-level (non-reactive) memoized promise. Kept outside the store's
// state on purpose: router.beforeEach fires on every navigation (including
// internal redirects), so init() must be safe to call repeatedly without
// re-subscribing to onAuthStateChange each time.
let initPromise: Promise<void> | null = null;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: null as Session | null,
    profile: null as AuthProfile | null,
    isReady: false,
    flash: null as null | { message: string; color: string },
  }),

  getters: {
    isAuthenticated: (state) => !!state.session,
    role: (state): Role | null => state.profile?.role ?? null,
    isAdmin: (state): boolean => state.profile?.role === "admin",
    isSalesperson: (state): boolean => state.profile?.role === "salesperson",
  },

  actions: {
    init() {
      if (initPromise) return initPromise;

      initPromise = (async () => {
        const { data } = await supabase.auth.getSession();
        await this.applySession(data.session);

        supabase.auth.onAuthStateChange((_event, session) => {
          void this.applySession(session);
        });

        this.isReady = true;
      })();

      return initPromise;
    },

    async applySession(session: Session | null) {
      this.session = session;

      if (!session) {
        this.profile = null;
        return;
      }

      try {
        this.profile = await getProfile(session.user.id);
      } catch {
        this.profile = null;
      }
    },

    async login(email: string, password: string) {
      const { session } = await signInWithPassword(email, password);
      await this.applySession(session);
    },

    async logout() {
      await authSignOut();
      this.session = null;
      this.profile = null;
    },
  },
});
