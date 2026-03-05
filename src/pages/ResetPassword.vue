<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

const route     = useRoute();
const router    = useRouter();
const authStore = useAuthStore();

const token      = ref('');
const recordId   = ref('');
const password   = ref('');
const confirmPwd = ref('');
const showPass   = ref(false);
const loading    = ref(false);
const verifying  = ref(true);
const tokenValid = ref(false);
const done       = ref(false);
const error      = ref('');

onMounted(async () => {
  token.value = route.query.token || '';
  if (!token.value) { verifying.value = false; return; }
  try {
    const record = await authStore.verifyResetToken(token.value);
    if (record) { recordId.value = record.id; tokenValid.value = true; }
  } catch { /* fall through */ }
  verifying.value = false;
});

async function handleReset() {
  error.value = '';
  if (!password.value || password.value.length < 8) { error.value = 'Password must be at least 8 characters.'; return; }
  if (password.value !== confirmPwd.value) { error.value = 'Passwords do not match.'; return; }
  loading.value = true;
  try {
    await authStore.updatePassword(recordId.value, password.value);
    done.value = true;
    setTimeout(() => router.push('/login'), 3000);
  } catch {
    error.value = 'Failed to reset password. Please try again.';
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

      <!-- Verifying -->
      <div v-if="verifying" class="state-center">
        <span class="spinner-border text-primary" style="width:2.5rem;height:2.5rem;"></span>
        <p class="state-text">Verifying reset link…</p>
      </div>

      <!-- Invalid token -->
      <div v-else-if="!tokenValid" class="state-center">
        <div class="state-icon error"><i class="bi bi-x-circle-fill"></i></div>
        <h3 class="state-title">Link invalid or expired</h3>
        <p class="state-sub">This reset link is no longer valid. Links expire after 1 hour.</p>
        <router-link to="/forgot-password" class="submit-btn">Request a new link</router-link>
      </div>

      <!-- Success -->
      <div v-else-if="done" class="state-center">
        <div class="state-icon success"><i class="bi bi-check-circle-fill"></i></div>
        <h3 class="state-title">Password updated!</h3>
        <p class="state-sub">Redirecting you to Sign In…</p>
      </div>

      <!-- Reset form -->
      <template v-else>
        <div class="form-heading">
          <h2 class="form-title">Reset Password</h2>
          <p class="form-sub">Enter a strong new password for your account.</p>
        </div>

        <div v-if="error" class="alert-error">
          <i class="bi bi-exclamation-triangle-fill"></i><span>{{ error }}</span>
        </div>

        <form @submit.prevent="handleReset">
          <div class="field-group">
            <label class="field-label">New Password</label>
            <div class="field-wrap">
              <span class="field-icon"><i class="bi bi-lock-fill"></i></span>
              <input v-model="password" :type="showPass ? 'text' : 'password'"
                class="field-input" placeholder="At least 8 characters" required />
              <button type="button" class="eye-btn" @click="showPass = !showPass" tabindex="-1">
                <i :class="['bi', showPass ? 'bi-eye-slash-fill' : 'bi-eye-fill']"></i>
              </button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Confirm New Password</label>
            <div class="field-wrap">
              <span class="field-icon"><i class="bi bi-lock-fill"></i></span>
              <input v-model="confirmPwd" :type="showPass ? 'text' : 'password'"
                class="field-input" placeholder="Repeat password" required />
            </div>
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-shield-lock-fill me-2"></i>
            {{ loading ? 'Updating…' : 'Update Password' }}
          </button>
        </form>
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

/* States */
.state-center { display: flex; flex-direction: column; align-items: center; text-align: center; }
.state-text { margin-top: 16px; color: #6b7280; font-size: 14px; }
.state-icon .bi { font-size: 52px; }
.state-icon.error .bi { color: #dc2626; }
.state-icon.success .bi { color: #16a34a; }
.state-title { font-size: 20px; font-weight: 700; color: #0d1b2a; margin: 14px 0 6px; }
.state-sub { font-size: 13.5px; color: #6b7280; margin: 0 0 20px; }

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
  width: 100%; padding: 0 44px 0 52px; height: 46px;
  border: 1.5px solid #dde8ff; border-radius: 10px; font-size: 14px;
  color: #1a1a2e; background: #fafcff; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
}
.field-input:focus { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.1); background: #fff; }
.field-input::placeholder { color: #adb5bd; }
.eye-btn {
  position: absolute; right: 12px; top: 50%;
  transform: translateY(-50%); border: none; background: transparent;
  color: #9ca3af; cursor: pointer; font-size: 16px; padding: 2px;
}
.eye-btn:hover { color: #374151; }

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
.submit-btn:hover:not(:disabled) { opacity: 0.93; transform: translateY(-2px); color: #fff; box-shadow: 0 6px 22px rgba(25,118,210,0.5); }
.submit-btn:disabled { opacity: 0.65; cursor: not-allowed; box-shadow: none; }

.card-footer-text { text-align: center; font-size: 11.5px; color: #adb5bd; margin: 24px 0 0; }

@media (max-width: 480px) {
  .auth-card { padding: 32px 24px 28px; border-radius: 18px; }
}
</style>
