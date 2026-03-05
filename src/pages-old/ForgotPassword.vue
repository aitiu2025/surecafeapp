<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth.js';

const authStore = useAuthStore();

const email    = ref('');
const loading  = ref(false);
const sent     = ref(false);
const error    = ref('');
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
  <div class="auth-shell">
    <!-- Left brand panel -->
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
          <div class="feature-item"><i class="bi bi-shield-lock"></i> Secure password recovery</div>
          <div class="feature-item"><i class="bi bi-envelope-check"></i> Token expires in 1 hour</div>
          <div class="feature-item"><i class="bi bi-arrow-repeat"></i> Set a strong new password</div>
        </div>
      </div>
      <p class="brand-copy">© 2026 SureCafe AI. All rights reserved.</p>
    </div>

    <!-- Right form panel -->
    <div class="form-panel">
      <div class="form-box">

        <!-- Success state -->
        <template v-if="sent">
          <div class="success-icon-wrap"><i class="bi bi-envelope-check-fill"></i></div>
          <h2 class="form-title">Check your inbox</h2>
          <p class="form-sub">If an account exists for <strong>{{ email }}</strong>, a reset link has been sent.</p>

          <!-- Dev helper -->
          <div v-if="resetLink" class="dev-link">
            <p class="dev-label"><i class="bi bi-info-circle me-1"></i>Dev mode — copy this link:</p>
            <a :href="resetLink" class="dev-url">{{ resetLink }}</a>
          </div>

          <router-link to="/login" class="submit-btn back-btn">
            <i class="bi bi-arrow-left me-2"></i>Back to Sign In
          </router-link>
        </template>

        <!-- Form state -->
        <template v-else>
          <div class="form-header">
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

      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-shell { display:flex; min-height:100vh; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
.brand-panel {
  width:42%; flex-shrink:0;
  background:linear-gradient(145deg,#0d47a1 0%,#1565c0 40%,#1976d2 70%,#1e88e5 100%);
  display:flex; flex-direction:column; justify-content:space-between;
  padding:48px 52px; position:relative; overflow:hidden;
}
.brand-blobs { position:absolute; inset:0; pointer-events:none; }
.blob { position:absolute; border-radius:50%; opacity:0.12; background:#fff; }
.blob-1 { width:340px; height:340px; top:-100px; right:-80px; }
.blob-2 { width:220px; height:220px; bottom:60px; left:-60px; }
.blob-3 { width:140px; height:140px; bottom:200px; right:30px; opacity:0.07; }
.brand-content { position:relative; z-index:1; }
.brand-logo-wrap {
  display:inline-flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,0.15); border-radius:16px; padding:12px 20px;
  margin-bottom:32px; backdrop-filter:blur(4px);
}
.brand-logo { height:44px; object-fit:contain; }
.brand-title { font-size:32px; font-weight:800; color:#fff; margin:0 0 8px; letter-spacing:-0.5px; }
.brand-tagline { font-size:15px; color:rgba(255,255,255,0.75); margin:0 0 40px; }
.brand-features { display:flex; flex-direction:column; gap:14px; }
.feature-item { display:flex; align-items:center; gap:10px; color:rgba(255,255,255,0.9); font-size:14px; font-weight:500; }
.feature-item .bi { font-size:18px; color:#a5d6a7; flex-shrink:0; }
.brand-copy { position:relative; z-index:1; font-size:12px; color:rgba(255,255,255,0.45); margin:0; }

.form-panel { flex:1; background:#f8faff; display:flex; align-items:center; justify-content:center; padding:40px 24px; }
.form-box { width:100%; max-width:400px; background:#fff; border-radius:20px; box-shadow:0 4px 24px rgba(25,118,210,0.08); padding:44px 40px; }

.success-icon-wrap { text-align:center; margin-bottom:20px; }
.success-icon-wrap .bi { font-size:52px; color:#16a34a; }

.form-header { margin-bottom:28px; }
.form-title { font-size:24px; font-weight:800; color:#0d1b2a; margin:0 0 4px; }
.form-sub { font-size:13.5px; color:#6b7280; margin:0 0 20px; }

.alert-error {
  display:flex; align-items:flex-start; gap:10px;
  background:#fff0f0; border-left:4px solid #dc2626; border-radius:8px;
  padding:12px 14px; font-size:13.5px; color:#b91c1c; margin-bottom:20px;
}
.alert-error .bi { font-size:16px; flex-shrink:0; margin-top:1px; }

.dev-link { background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:12px 14px; margin-bottom:20px; }
.dev-label { font-size:12px; color:#92400e; margin-bottom:6px; }
.dev-url { font-size:12px; color:#1976d2; word-break:break-all; text-decoration:none; }
.dev-url:hover { text-decoration:underline; }

.field-group { margin-bottom:20px; }
.field-label { font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px; }
.field-wrap { position:relative; }
.field-icon {
  position:absolute; left:0; top:0; bottom:0; width:44px;
  display:flex; align-items:center; justify-content:center;
  background:#f0f5ff; border:1.5px solid #e0e8ff; border-right:none;
  border-radius:10px 0 0 10px; color:#1976d2; font-size:15px; pointer-events:none;
}
.field-input {
  width:100%; padding:0 16px 0 52px; height:46px;
  border:1.5px solid #e0e8ff; border-radius:10px; font-size:14px;
  color:#1a1a2e; background:#fafcff; outline:none;
  transition:border-color 0.2s,box-shadow 0.2s; box-sizing:border-box;
}
.field-input:focus { border-color:#1976d2; box-shadow:0 0 0 3px rgba(25,118,210,0.1); background:#fff; }
.field-input::placeholder { color:#adb5bd; }

.submit-btn {
  display:flex; align-items:center; justify-content:center;
  width:100%; height:48px;
  background:linear-gradient(135deg,#1565c0 0%,#1976d2 50%,#42a5f5 100%);
  color:#fff; border:none; border-radius:10px; font-size:15px; font-weight:700;
  cursor:pointer; text-decoration:none; letter-spacing:0.3px;
  transition:opacity 0.2s,transform 0.15s,box-shadow 0.2s;
  box-shadow:0 4px 14px rgba(25,118,210,0.35); margin-top:8px;
}
.submit-btn:hover:not(:disabled) { opacity:0.93; transform:translateY(-2px); box-shadow:0 6px 20px rgba(25,118,210,0.45); color:#fff; }
.submit-btn:disabled { opacity:0.65; cursor:not-allowed; box-shadow:none; }
.back-btn { background:linear-gradient(135deg,#374151,#4b5563); box-shadow:none; margin-top:12px; }

.back-link { text-align:center; margin-top:20px; }
.back-link a { font-size:13px; color:#1976d2; text-decoration:none; font-weight:500; }
.back-link a:hover { text-decoration:underline; }

@media (max-width:768px) {
  .auth-shell { flex-direction:column; }
  .brand-panel { width:100%; padding:32px 28px; }
  .brand-features { display:none; }
  .form-box { padding:32px 24px; }
}
</style>
