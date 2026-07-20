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
    isManager: (state): boolean => state.profile?.role === "manager",
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
          if (applySessionKey === key) {
            this.profile = profile;
            // Cached so a later offline reopen (profile starts null on a
            // fresh load) has something to fall back to below, instead of
            // getting logged out just because getProfile() couldn't reach
            // the network — see the catch branch.
            localStorage.setItem(`auth:profile:${profile.id}`, JSON.stringify(profile));
          }
        } catch {
          if (applySessionKey !== key) return;

          if (this.profile?.id === session.user.id) {
            // Already have a good in-memory profile for this exact user
            // (e.g. a transient background token-refresh fetch failed) —
            // keep it, don't touch it.
            return;
          }

          // No good in-memory profile yet for this user — this is the
          // first-load-ever case, where state.profile starts null. Fall
          // back to the last profile this browser saw for this same user
          // id (namespaced by id, so a different user's session can never
          // read another user's cached role) instead of nulling it, so an
          // offline reopen doesn't bounce an already-logged-in user to
          // /login. Stays null (today's behavior) if this user has no
          // cached entry.
          const cached = localStorage.getItem(`auth:profile:${session.user.id}`);
          this.profile = cached ? (JSON.parse(cached) as AuthProfile) : null;
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
      if (this.profile) {
        localStorage.removeItem(`auth:profile:${this.profile.id}`);
      }
      this.session = null;
      this.profile = null;
    },
  },
});
