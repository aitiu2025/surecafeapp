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
  <div class="auth-shell">

    <!-- ─── Left Brand Panel ─── -->
    <div class="brand-panel">
      <div class="brand-blobs">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
      </div>
      <div class="brand-content">
        <div class="brand-logo-wrap">
          <img src="/logo.png" alt="SureCafe AI" class="brand-logo" />
        </div>
        <h1 class="brand-title">SureCafe AI</h1>
        <p class="brand-tagline">Recruitment Intelligence Platform</p>
        <div class="brand-features">
          <div class="feature-item"><i class="bi bi-check2-circle"></i> Smart candidate matching</div>
          <div class="feature-item"><i class="bi bi-check2-circle"></i> AI-powered interview analysis</div>
          <div class="feature-item"><i class="bi bi-check2-circle"></i> Real-time pipeline tracking</div>
        </div>
      </div>
      <p class="brand-copy">© 2026 SureCafe AI. All rights reserved.</p>
    </div>

    <!-- ─── Right Form Panel ─── -->
    <div class="form-panel">
      <div class="form-box">
        <div class="form-header">
          <h2 class="form-title">Welcome back</h2>
          <p class="form-sub">Sign in to your account to continue</p>
        </div>

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
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ─── Shell layout ─── */
.auth-shell {
  display: flex;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
}

/* ─── Left brand panel ─── */
.brand-panel {
  width: 42%;
  flex-shrink: 0;
  background: linear-gradient(145deg, #0d47a1 0%, #1565c0 40%, #1976d2 70%, #1e88e5 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 52px;
  position: relative;
  overflow: hidden;
}

/* Decorative blobs */
.brand-blobs { position: absolute; inset: 0; pointer-events: none; }
.blob {
  position: absolute;
  border-radius: 50%;
  opacity: 0.12;
  background: #fff;
}
.blob-1 { width: 340px; height: 340px; top: -100px; right: -80px; }
.blob-2 { width: 220px; height: 220px; bottom: 60px; left: -60px; }
.blob-3 { width: 140px; height: 140px; bottom: 200px; right: 30px; opacity: 0.07; }

.brand-content { position: relative; z-index: 1; }

.brand-logo-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.15);
  border-radius: 16px;
  padding: 12px 20px;
  margin-bottom: 32px;
  backdrop-filter: blur(4px);
}
.brand-logo { height: 44px; object-fit: contain; }

.brand-title {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 8px;
  letter-spacing: -0.5px;
}

.brand-tagline {
  font-size: 15px;
  color: rgba(255,255,255,0.75);
  margin: 0 0 40px;
  font-weight: 400;
}

.brand-features { display: flex; flex-direction: column; gap: 14px; }

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255,255,255,0.9);
  font-size: 14px;
  font-weight: 500;
}
.feature-item .bi {
  font-size: 18px;
  color: #a5d6a7;
  flex-shrink: 0;
}

.brand-copy {
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: rgba(255,255,255,0.45);
  margin: 0;
}

/* ─── Right form panel ─── */
.form-panel {
  flex: 1;
  background: #f8faff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.form-box {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(25,118,210,0.08);
  padding: 44px 40px;
}

.form-header { margin-bottom: 28px; }
.form-title {
  font-size: 24px;
  font-weight: 800;
  color: #0d1b2a;
  margin: 0 0 4px;
}
.form-sub { font-size: 13.5px; color: #6b7280; margin: 0; }

/* ─── Error ─── */
.alert-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fff0f0;
  border-left: 4px solid #dc2626;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13.5px;
  color: #b91c1c;
  margin-bottom: 20px;
}
.alert-error .bi { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

/* ─── Field ─── */
.field-group { margin-bottom: 20px; }

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
  left: 0;
  top: 0;
  bottom: 0;
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f5ff;
  border: 1.5px solid #e0e8ff;
  border-right: none;
  border-radius: 10px 0 0 10px;
  color: #1976d2;
  font-size: 15px;
  pointer-events: none;
}

.field-input {
  width: 100%;
  padding: 0 44px 0 52px;
  height: 46px;
  border: 1.5px solid #e0e8ff;
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
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  padding: 2px;
  line-height: 1;
}
.eye-btn:hover { color: #374151; }

/* ─── Submit button ─── */
.submit-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #42a5f5 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.3px;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 4px 14px rgba(25,118,210,0.35);
  margin-top: 8px;
}
.submit-btn:hover:not(:disabled) {
  opacity: 0.93;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(25,118,210,0.45);
}
.submit-btn:disabled { opacity: 0.65; cursor: not-allowed; box-shadow: none; }

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .auth-shell { flex-direction: column; }
  .brand-panel { width: 100%; padding: 32px 28px; min-height: auto; }
  .brand-features { display: none; }
  .form-box { padding: 32px 24px; }
}
</style>
