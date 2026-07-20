<template>
  <div class="login-page">
    <v-row class="login-row" no-gutters>
      <v-col class="login-brand" cols="12" md="6">
        <div class="login-brand-inner">
          <v-avatar class="login-brand-avatar" color="on-primary" rounded="lg" size="64" variant="tonal">
            <v-icon icon="mdi-receipt-text-outline" size="34" />
          </v-avatar>

          <h1 class="text-h4 font-weight-bold login-brand-title">Retail POS</h1>

          <p class="text-body-1 login-brand-tagline">
            Manage sales, inventory, and checkout — all in one place.
          </p>

          <div class="login-feature">
            <v-icon icon="mdi-cash-register" size="20" />
            <span>Fast, guided checkout at the counter</span>
          </div>

          <div class="login-feature">
            <v-icon icon="mdi-warehouse" size="20" />
            <span>Real-time inventory and stock levels</span>
          </div>

          <div class="login-feature">
            <v-icon icon="mdi-chart-line" size="20" />
            <span>Sales history and revenue at a glance</span>
          </div>
        </div>
      </v-col>

      <v-col class="login-form-col" cols="12" md="6">
        <v-card class="login-card" max-width="420" rounded="lg" variant="flat" width="100%">
          <v-card-text class="login-card-text">
            <div class="login-form-header">
              <v-avatar class="login-mobile-avatar" color="primary" rounded="lg" size="52" variant="tonal">
                <v-icon icon="mdi-receipt-text-outline" size="28" />
              </v-avatar>

              <h2 class="text-h5 font-weight-bold">Welcome back</h2>

              <p class="text-body-2 text-medium-emphasis login-form-subtitle">
                Sign in with your store account to continue
              </p>
            </div>

            <v-form @submit.prevent="handleSubmit">
              <v-text-field
                v-model="email"
                autocomplete="username"
                class="login-field"
                density="comfortable"
                label="Email"
                prepend-inner-icon="mdi-email-outline"
                rounded="lg"
                type="email"
                variant="outlined"
              />

              <v-text-field
                v-model="password"
                :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                autocomplete="current-password"
                density="comfortable"
                label="Password"
                prepend-inner-icon="mdi-lock-outline"
                rounded="lg"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                @click:append-inner="showPassword = !showPassword"
              />

              <v-btn
                block
                class="login-submit"
                color="primary"
                :loading="submitting"
                prepend-icon="mdi-login"
                rounded="lg"
                size="large"
                type="submit"
                variant="flat"
              >
                Sign In
              </v-btn>
            </v-form>

            <p class="text-caption text-medium-emphasis login-footnote">
              Don't have an account? Contact your administrator.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const email = ref("");
const password = ref("");
const submitting = ref(false);
const showPassword = ref(false);

async function handleSubmit() {
  if (!email.value.trim()) {
    toast.show("Email is required.", "error");
    return;
  }
  if (!password.value) {
    toast.show("Password is required.", "error");
    return;
  }

  submitting.value = true;

  try {
    await authStore.login(email.value.trim(), password.value);

    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : null;
    router.replace(redirect || (authStore.isSalesperson ? "/pos" : "/"));
  } catch {
    toast.show("Invalid email or password.", "error");
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
}

.login-row {
  min-height: 100vh;
  margin: 0;
}

.login-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background:
    linear-gradient(160deg, rgba(var(--v-theme-primary), 0.94), rgba(var(--v-theme-primary-darken-1), 0.96)),
    rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.login-brand-inner {
  max-width: 380px;
}

.login-brand-avatar {
  margin-bottom: 24px;
}

.login-brand-title {
  margin-bottom: 12px;
}

.login-brand-tagline {
  color: rgba(var(--v-theme-on-primary), 0.85);
  margin-bottom: 32px;
}

.login-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  color: rgba(var(--v-theme-on-primary), 0.92);
}

.login-form-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.login-card-text {
  padding: 32px;
}

.login-form-header {
  text-align: left;
  margin-bottom: 24px;
}

.login-form-subtitle {
  margin-top: 4px;
}

.login-mobile-avatar {
  display: none;
}

.login-field {
  margin-bottom: 12px;
}

.login-submit {
  margin-top: 20px;
}

.login-footnote {
  text-align: center;
  margin-top: 24px;
  margin-bottom: 0;
}

@media (max-width: 959px) {
  .login-brand {
    display: none;
  }

  .login-mobile-avatar {
    display: inline-flex;
    margin-bottom: 16px;
  }

  .login-form-header {
    text-align: center;
  }
}
</style>
