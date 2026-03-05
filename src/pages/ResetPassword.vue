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
  } catch (e) {
    error.value = 'Failed to reset password. Please try again.';
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
        <div class="brand-logo-wrap"><img src="/logo.png" alt="SureCafe AI" class="brand-logo" /></div>
        <h1 class="brand-title">SureCafe AI</h1>
        <p class="brand-tagline">Recruitment Intelligence Platform</p>
        <div class="brand-features">
          <div class="feature-item"><i class="bi bi-shield-lock-fill"></i> Minimum 8 characters</div>
          <div class="feature-item"><i class="bi bi-key-fill"></i> Use a unique password</div>
          <div class="feature-item"><i class="bi bi-check2-circle"></i> Link expires in 1 hour</div>
        </div>
      </div>
      <p class="brand-copy">© 2026 SureCafe AI. All rights reserved.</p>
    </div>

    <!-- Right form panel -->
    <div class="form-panel">
      <div class="form-box">

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
          <div class="form-header">
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
.brand-logo-wrap { display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.15); border-radius:16px; padding:12px 20px; margin-bottom:32px; backdrop-filter:blur(4px); }
.brand-logo { height:44px; object-fit:contain; }
.brand-title { font-size:32px; font-weight:800; color:#fff; margin:0 0 8px; letter-spacing:-0.5px; }
.brand-tagline { font-size:15px; color:rgba(255,255,255,0.75); margin:0 0 40px; }
.brand-features { display:flex; flex-direction:column; gap:14px; }
.feature-item { display:flex; align-items:center; gap:10px; color:rgba(255,255,255,0.9); font-size:14px; font-weight:500; }
.feature-item .bi { font-size:18px; color:#a5d6a7; flex-shrink:0; }
.brand-copy { position:relative; z-index:1; font-size:12px; color:rgba(255,255,255,0.45); margin:0; }

.form-panel { flex:1; background:#f8faff; display:flex; align-items:center; justify-content:center; padding:40px 24px; }
.form-box { width:100%; max-width:400px; background:#fff; border-radius:20px; box-shadow:0 4px 24px rgba(25,118,210,0.08); padding:44px 40px; }

.state-center { display:flex; flex-direction:column; align-items:center; text-align:center; padding:10px 0; }
.state-text { margin-top:16px; color:#6b7280; font-size:14px; }
.state-icon .bi { font-size:52px; }
.state-icon.error .bi { color:#dc2626; }
.state-icon.success .bi { color:#16a34a; }
.state-title { font-size:20px; font-weight:700; color:#0d1b2a; margin:14px 0 6px; }
.state-sub { font-size:13.5px; color:#6b7280; margin:0 0 20px; }

.form-header { margin-bottom:28px; }
.form-title { font-size:24px; font-weight:800; color:#0d1b2a; margin:0 0 4px; }
.form-sub { font-size:13.5px; color:#6b7280; margin:0; }

.alert-error { display:flex; align-items:flex-start; gap:10px; background:#fff0f0; border-left:4px solid #dc2626; border-radius:8px; padding:12px 14px; font-size:13.5px; color:#b91c1c; margin-bottom:20px; }
.alert-error .bi { font-size:16px; flex-shrink:0; margin-top:1px; }

.field-group { margin-bottom:20px; }
.field-label { font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px; }
.field-wrap { position:relative; }
.field-icon { position:absolute; left:0; top:0; bottom:0; width:44px; display:flex; align-items:center; justify-content:center; background:#f0f5ff; border:1.5px solid #e0e8ff; border-right:none; border-radius:10px 0 0 10px; color:#1976d2; font-size:15px; pointer-events:none; }
.field-input { width:100%; padding:0 44px 0 52px; height:46px; border:1.5px solid #e0e8ff; border-radius:10px; font-size:14px; color:#1a1a2e; background:#fafcff; outline:none; transition:border-color 0.2s,box-shadow 0.2s; box-sizing:border-box; }
.field-input:focus { border-color:#1976d2; box-shadow:0 0 0 3px rgba(25,118,210,0.1); background:#fff; }
.field-input::placeholder { color:#adb5bd; }
.eye-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); border:none; background:transparent; color:#9ca3af; cursor:pointer; font-size:16px; padding:2px; }
.eye-btn:hover { color:#374151; }

.submit-btn { display:flex; align-items:center; justify-content:center; width:100%; height:48px; background:linear-gradient(135deg,#1565c0,#42a5f5); color:#fff; border:none; border-radius:10px; font-size:15px; font-weight:700; cursor:pointer; text-decoration:none; box-shadow:0 4px 14px rgba(25,118,210,0.35); margin-top:8px; transition:opacity 0.2s,transform 0.15s; }
.submit-btn:hover:not(:disabled) { opacity:0.93; transform:translateY(-2px); color:#fff; }
.submit-btn:disabled { opacity:0.65; cursor:not-allowed; }

@media (max-width:768px) {
  .auth-shell { flex-direction:column; }
  .brand-panel { width:100%; padding:32px 28px; }
  .brand-features { display:none; }
  .form-box { padding:32px 24px; }
}
</style>
