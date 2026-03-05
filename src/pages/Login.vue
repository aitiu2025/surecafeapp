<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

const router    = useRouter();
const authStore = useAuthStore();

const email    = ref('');
const password = ref('');
const showPass = ref(false);
const loading  = ref(false);
const error    = ref('');

async function handleLogin() {
  error.value = '';
  if (!email.value.trim() || !password.value) {
    error.value = 'Please enter your email and password.';
    return;
  }
  loading.value = true;
  try {
    await authStore.login(email.value.trim(), password.value);
    router.push('/');
  } catch (e) {
    error.value = e.message || 'Login failed. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-bg">
    <!-- Decorative blobs -->
    <div class="bg-blob bg-blob-1"></div>
    <div class="bg-blob bg-blob-2"></div>
    <div class="bg-blob bg-blob-3"></div>

    <div class="auth-card">
      <!-- Logo + brand -->
      <div class="card-brand">
        <div class="logo-wrap">
          <img src="/logo.png" alt="SureCafe AI" class="brand-logo" />
        </div>
        <p class="brand-tagline">Recruitment Intelligence Platform</p>
      </div>

      <div class="card-divider"></div>

      <!-- Form heading -->
      <div class="form-heading">
        <h2 class="form-title">Welcome back</h2>
        <p class="form-sub">Sign in to your account to continue</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="alert-error">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span>{{ error }}</span>
      </div>

      <form @submit.prevent="handleLogin" autocomplete="on">
        <!-- Email -->
        <div class="field-group">
          <label class="field-label">Email address</label>
          <div class="field-wrap">
            <span class="field-icon"><i class="bi bi-envelope-fill"></i></span>
            <input
              v-model="email"
              type="email"
              class="field-input"
              placeholder="you@company.com"
              autocomplete="username"
              required
            />
          </div>
        </div>

        <!-- Password -->
        <div class="field-group">
          <div class="field-label-row">
            <label class="field-label">Password</label>
            <router-link to="/forgot-password" class="forgot-link">Forgot password?</router-link>
          </div>
          <div class="field-wrap">
            <span class="field-icon"><i class="bi bi-lock-fill"></i></span>
            <input
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              class="field-input"
              placeholder="Enter your password"
              autocomplete="current-password"
              required
            />
            <button type="button" class="eye-btn" @click="showPass = !showPass" tabindex="-1">
              <i :class="['bi', showPass ? 'bi-eye-slash-fill' : 'bi-eye-fill']"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="bi bi-box-arrow-in-right me-2"></i>
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>

      <p class="card-footer-text">© 2026 SureCafe AI. All rights reserved.</p>
    </div>
  </div>
</template>

<style scoped>
/* ─── Full-page background ─── */
.auth-bg {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0d47a1 0%, #1565c0 35%, #1976d2 65%, #42a5f5 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

/* Decorative blobs */
.bg-blob {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  pointer-events: none;
}
.bg-blob-1 { width: 520px; height: 520px; top: -160px; right: -140px; }
.bg-blob-2 { width: 360px; height: 360px; bottom: -100px; left: -120px; }
.bg-blob-3 { width: 200px; height: 200px; top: 55%; left: 60%; background: rgba(255,255,255,0.05); }

/* ─── Card ─── */
.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  padding: 15px 40px;
  animation: cardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes cardIn {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

/* ─── Brand section ─── */
.card-brand { text-align: center; margin-bottom: 10px; }

.logo-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.brand-logo { height: 60px; object-fit: contain; }

.brand-name {
  font-size: 26px;
  font-weight: 800;
  color: #0d1b2a;
  margin: 0 0 4px;
  letter-spacing: -0.5px;
}
.brand-name span { color: #1976d2; }

.brand-tagline {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  font-weight: 400;
}

/* ─── Divider ─── */
.card-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e5e7eb 20%, #e5e7eb 80%, transparent);
  margin: 0 0 10px;
}

/* ─── Form heading ─── */
.form-heading { margin-bottom: 22px; text-align: center;}
.form-title {
  font-size: 20px;
  font-weight: 700;
  color: #0d1b2a;
  margin: 0 0 4px;
}
.form-sub { font-size: 13px; color: #6b7280; margin: 0; }

/* ─── Error ─── */
.alert-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fff0f0;
  border-left: 4px solid #dc2626;
  border-radius: 8px;
  padding: 11px 14px;
  font-size: 13px;
  color: #b91c1c;
  margin-bottom: 18px;
}
.alert-error .bi { font-size: 15px; flex-shrink: 0; margin-top: 1px; }

/* ─── Fields ─── */
.field-group { margin-bottom: 18px; }

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  display: block;
  margin-bottom: 7px;
}
.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 7px;
}
.forgot-link {
  font-size: 12.5px;
  color: #1976d2;
  text-decoration: none;
  font-weight: 500;
}
.forgot-link:hover { text-decoration: underline; }

.field-wrap { position: relative; }

.field-icon {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f5ff;
  border: 1.5px solid #dde8ff;
  border-right: none;
  border-radius: 10px 0 0 10px;
  color: #1976d2;
  font-size: 14px;
  pointer-events: none;
}

.field-input {
  width: 100%;
  padding: 0 44px 0 52px;
  height: 46px;
  border: 1.5px solid #dde8ff;
  border-radius: 10px;
  font-size: 14px;
  color: #1a1a2e;
  background: #fafcff;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.field-input:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25,118,210,0.1);
  background: #fff;
}
.field-input::placeholder { color: #adb5bd; }

.eye-btn {
  position: absolute;
  right: 12px; top: 50%;
  transform: translateY(-50%);
  border: none; background: transparent;
  color: #9ca3af; cursor: pointer;
  font-size: 16px; padding: 2px; line-height: 1;
}
.eye-btn:hover { color: #374151; }

/* ─── Submit ─── */
.submit-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 60%, #2196f3 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.3px;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 4px 16px rgba(25,118,210,0.4);
  margin-top: 6px;
}
.submit-btn:hover:not(:disabled) {
  opacity: 0.93;
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(25,118,210,0.5);
}
.submit-btn:disabled { opacity: 0.65; cursor: not-allowed; box-shadow: none; }

/* ─── Footer text ─── */
.card-footer-text {
  text-align: center;
  font-size: 11.5px;
  color: #adb5bd;
  margin: 24px 0 0;
}

/* ─── Responsive ─── */
@media (max-width: 480px) {
  .auth-card { padding: 10px 40px 10px 40px; border-radius: 18px; }
  .brand-name { font-size: 22px; }
}
</style>
