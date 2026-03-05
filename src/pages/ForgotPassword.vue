<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth.js';

const authStore = useAuthStore();

const email     = ref('');
const loading   = ref(false);
const sent      = ref(false);
const error     = ref('');
const resetLink = ref('');

async function handleSubmit() {
  error.value = '';
  if (!email.value.trim()) { error.value = 'Please enter your email address.'; return; }
  loading.value = true;
  try {
    const result = await authStore.requestPasswordReset(email.value.trim());
    if (result) {
      resetLink.value = `${window.location.origin}/reset-password?token=${result.token}`;
      // TODO: Replace with n8n webhook email:
      // await fetch(N8N_RESET_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'},
      //   body: JSON.stringify({ email: email.value, firstName: result.firstName, resetLink: resetLink.value }) });
    }
    sent.value = true;
  } catch {
    error.value = 'Something went wrong. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-bg">
    <div class="bg-blob bg-blob-1"></div>
    <div class="bg-blob bg-blob-2"></div>
    <div class="bg-blob bg-blob-3"></div>

    <div class="auth-card">
      <!-- Brand -->
      <div class="card-brand">
        <div class="logo-wrap">
          <img src="/logo.png" alt="SureCafe AI" class="brand-logo" />
        </div>
        <h1 class="brand-name">SureCafe <span>AI</span></h1>
        <p class="brand-tagline">Recruitment Intelligence Platform</p>
      </div>

      <div class="card-divider"></div>

      <!-- Success state -->
      <template v-if="sent">
        <div class="state-center">
          <div class="state-icon-wrap"><i class="bi bi-envelope-check-fill"></i></div>
          <h2 class="state-title">Check your inbox</h2>
          <p class="state-sub">If an account exists for <strong>{{ email }}</strong>, a reset link has been sent.</p>

          <div v-if="resetLink" class="dev-link">
            <p class="dev-label"><i class="bi bi-info-circle me-1"></i>Dev mode — copy this link:</p>
            <a :href="resetLink" class="dev-url">{{ resetLink }}</a>
          </div>

          <router-link to="/login" class="submit-btn back-btn">
            <i class="bi bi-arrow-left me-2"></i>Back to Sign In
          </router-link>
        </div>
      </template>

      <!-- Form state -->
      <template v-else>
        <div class="form-heading">
          <h2 class="form-title">Forgot Password</h2>
          <p class="form-sub">Enter your email and we'll send a reset link.</p>
        </div>

        <div v-if="error" class="alert-error">
          <i class="bi bi-exclamation-triangle-fill"></i><span>{{ error }}</span>
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="field-group">
            <label class="field-label">Email address</label>
            <div class="field-wrap">
              <span class="field-icon"><i class="bi bi-envelope-fill"></i></span>
              <input v-model="email" type="email" class="field-input" placeholder="you@company.com" required />
            </div>
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-send-fill me-2"></i>
            {{ loading ? 'Sending…' : 'Send Reset Link' }}
          </button>
        </form>

        <div class="back-link">
          <router-link to="/login"><i class="bi bi-arrow-left me-1"></i>Back to Sign In</router-link>
        </div>
      </template>

      <p class="card-footer-text">© 2026 SureCafe AI. All rights reserved.</p>
    </div>
  </div>
</template>

<style scoped>
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
.bg-blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.07); pointer-events: none; }
.bg-blob-1 { width: 520px; height: 520px; top: -160px; right: -140px; }
.bg-blob-2 { width: 360px; height: 360px; bottom: -100px; left: -120px; }
.bg-blob-3 { width: 200px; height: 200px; top: 55%; left: 60%; background: rgba(255,255,255,0.05); }

.auth-card {
  position: relative; z-index: 1;
  width: 100%; max-width: 420px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  padding: 40px 40px 32px;
  animation: cardIn 0.4s cubic-bezier(0.22,1,0.36,1);
}
@keyframes cardIn {
  from { opacity:0; transform:translateY(24px) scale(0.97); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}

.card-brand { text-align: center; margin-bottom: 20px; }
.logo-wrap {
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #e3f2fd, #f0f7ff);
  border: 1.5px solid #c9dff7; border-radius: 18px;
  padding: 12px 22px; margin-bottom: 16px;
}
.brand-logo { height: 42px; object-fit: contain; }
.brand-name { font-size: 26px; font-weight: 800; color: #0d1b2a; margin: 0 0 4px; letter-spacing: -0.5px; }
.brand-name span { color: #1976d2; }
.brand-tagline { font-size: 13px; color: #6b7280; margin: 0; }

.card-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e5e7eb 20%, #e5e7eb 80%, transparent);
  margin: 0 0 24px;
}

.form-heading { margin-bottom: 22px; }
.form-title { font-size: 20px; font-weight: 700; color: #0d1b2a; margin: 0 0 4px; }
.form-sub { font-size: 13px; color: #6b7280; margin: 0; }

.alert-error {
  display: flex; align-items: flex-start; gap: 10px;
  background: #fff0f0; border-left: 4px solid #dc2626;
  border-radius: 8px; padding: 11px 14px;
  font-size: 13px; color: #b91c1c; margin-bottom: 18px;
}
.alert-error .bi { font-size: 15px; flex-shrink: 0; margin-top: 1px; }

/* Success state */
.state-center { display: flex; flex-direction: column; align-items: center; text-align: center; }
.state-icon-wrap { margin-bottom: 14px; }
.state-icon-wrap .bi { font-size: 52px; color: #16a34a; }
.state-title { font-size: 20px; font-weight: 700; color: #0d1b2a; margin: 0 0 8px; }
.state-sub { font-size: 13.5px; color: #6b7280; margin: 0 0 20px; line-height: 1.5; }

.dev-link {
  background: #fffbeb; border: 1px solid #fcd34d;
  border-radius: 8px; padding: 12px 14px;
  margin-bottom: 20px; width: 100%; text-align: left;
}
.dev-label { font-size: 12px; color: #92400e; margin: 0 0 6px; }
.dev-url { font-size: 12px; color: #1976d2; word-break: break-all; text-decoration: none; }
.dev-url:hover { text-decoration: underline; }

.field-group { margin-bottom: 18px; }
.field-label { font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 7px; }
.field-wrap { position: relative; }
.field-icon {
  position: absolute; left: 0; top: 0; bottom: 0; width: 44px;
  display: flex; align-items: center; justify-content: center;
  background: #f0f5ff; border: 1.5px solid #dde8ff; border-right: none;
  border-radius: 10px 0 0 10px; color: #1976d2; font-size: 14px; pointer-events: none;
}
.field-input {
  width: 100%; padding: 0 16px 0 52px; height: 46px;
  border: 1.5px solid #dde8ff; border-radius: 10px; font-size: 14px;
  color: #1a1a2e; background: #fafcff; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
}
.field-input:focus { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.1); background: #fff; }
.field-input::placeholder { color: #adb5bd; }

.submit-btn {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 48px;
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 60%, #2196f3 100%);
  color: #fff; border: none; border-radius: 10px;
  font-size: 15px; font-weight: 700; cursor: pointer;
  text-decoration: none; letter-spacing: 0.3px;
  box-shadow: 0 4px 16px rgba(25,118,210,0.4); margin-top: 6px;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
}
.submit-btn:hover:not(:disabled) { opacity: 0.93; transform: translateY(-2px); box-shadow: 0 6px 22px rgba(25,118,210,0.5); color: #fff; }
.submit-btn:disabled { opacity: 0.65; cursor: not-allowed; box-shadow: none; }
.back-btn { background: linear-gradient(135deg, #374151, #4b5563); box-shadow: none; margin-top: 0; }

.back-link { text-align: center; margin-top: 18px; }
.back-link a { font-size: 13px; color: #1976d2; text-decoration: none; font-weight: 500; }
.back-link a:hover { text-decoration: underline; }

.card-footer-text { text-align: center; font-size: 11.5px; color: #adb5bd; margin: 24px 0 0; }

@media (max-width: 480px) {
  .auth-card { padding: 32px 24px 28px; border-radius: 18px; }
}
</style>
