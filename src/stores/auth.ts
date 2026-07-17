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

// applySession() is invoked from two independent places for the very same
// auth event — login() calls it explicitly, and the onAuthStateChange
// subscription (below) fires for that same SIGNED_IN event and calls it
// again, unawaited. The same pattern repeats on every background
// TOKEN_REFRESHED event Supabase's client fires periodically. Without
// dedup/sequencing, two concurrent getProfile() calls race to write
// `profile`, and a stale or transiently-failed call can silently null out
// an already-valid profile — which then trips the router guard's "no role"
// branch on the next click and force-logs the user out for no visible
// reason. applySessionKey/applySessionPromise key concurrent calls by
// access_token so identical calls share one in-flight fetch, and a call
// only commits its result if no newer session has superseded it since.
let applySessionKey: string | null = null;
let applySessionPromise: Promise<void> | null = null;

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
        try {
          const { data } = await supabase.auth.getSession();
          await this.applySession(data.session);

          supabase.auth.onAuthStateChange((_event, session) => {
            void this.applySession(session);
          });
        } catch (error) {
          // A rejected promise would otherwise stay cached here forever —
          // every future router.beforeEach awaits this same promise, so one
          // transient failure (network blip) would permanently wedge all
          // navigation until a hard page reload. Reset so the next
          // navigation attempt retries instead.
          initPromise = null;
          throw error;
        } finally {
          this.isReady = true;
        }
      })();

      return initPromise;
    },

    async applySession(session: Session | null) {
      const key = session?.access_token ?? null;

      // Same session already applied/in-flight — share that result instead
      // of firing a second, redundant getProfile() call.
      if (key === applySessionKey && applySessionPromise) {
        return applySessionPromise;
      }

      applySessionKey = key;
      this.session = session;

      if (!session) {
        this.profile = null;
        applySessionPromise = null;
        return;
      }

      applySessionPromise = (async () => {
        try {
          const profile = await getProfile(session.user.id);
          // Only commit if no newer session has superseded this call while
          // the fetch was in flight.
          if (applySessionKey === key) this.profile = profile;
        } catch {
          // A transient failure (e.g. a background token-refresh's profile
          // re-fetch) shouldn't wipe an already-known-good profile for this
          // same user and force a spurious logout on the next navigation.
          const staleForThisUser = this.profile?.id !== session.user.id;
          if (applySessionKey === key && staleForThisUser) this.profile = null;
        }
      })();

      return applySessionPromise;
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
