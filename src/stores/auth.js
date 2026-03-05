/**
 * Auth Store — Pinia
 * Handles login, logout, session persistence, password management,
 * and seeding the default admin user on first launch.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import bcrypt from 'bcryptjs';
import { fetchAllRecords, updateRecord, TABLES } from '@/services/airtableService.js';

const SESSION_KEY     = 'sc_auth_session';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes
const SESSION_MAX      = 8  * 60 * 60 * 1000; // 8 hours

// n8n webhook for password reset emails — fill in when ready
// const RESET_EMAIL_WEBHOOK = 'https://surecafe.app.n8n.cloud/webhook/YOUR_RESET_WEBHOOK';

export const useAuthStore = defineStore('auth', () => {
  // ─── State ────────────────────────────────────────────────────────────────
  const user         = ref(null);   // { record_id, first_name, last_name, email, role }
  const isLoggedIn   = ref(false);
  const _sessionStart = ref(null);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const isAdmin     = computed(() => user.value?.role === 'admin');
  const isRecruiter = computed(() => user.value?.role === 'recruiter');
  const isManager   = computed(() => user.value?.role === 'manager');
  const fullName    = computed(() => user.value ? `${user.value.first_name} ${user.value.last_name}` : '');
  const initials    = computed(() => {
    if (!user.value) return '';
    return `${(user.value.first_name?.[0] || '')}${(user.value.last_name?.[0] || '')}`.toUpperCase();
  });

  // ─── Login ────────────────────────────────────────────────────────────────
  async function login(email, password) {
    const records = await fetchAllRecords(TABLES.USERS, [], {
      filterByFormula: `LOWER({email})="${email.trim().toLowerCase()}"`,
    });

    if (!records.length) throw new Error('Invalid email or password.');

    const record = records[0];
    const f = record.fields;

    if (!f.is_active) throw new Error('Account is inactive. Please contact your administrator.');

    const match = await bcrypt.compare(password, f.password_hash || '');
    if (!match) throw new Error('Invalid email or password.');

    const userData = {
      record_id:       record.id,
      first_name:      f.first_name || '',
      last_name:       f.last_name  || '',
      email:           f.email      || '',
      role:            f.role       || 'user',
      profile_pic_url: f.profile_pic?.[0]?.thumbnails?.large?.url
                       || f.profile_pic?.[0]?.url
                       || null,
    };

    user.value       = userData;
    isLoggedIn.value = true;
    _sessionStart.value = Date.now();

    _saveSession();

    // Update last_login non-blocking
    updateRecord(TABLES.USERS, record.id, {
      last_login: new Date().toISOString(),
    }).catch(() => {});

    return userData;
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  function logout(router) {
    user.value        = null;
    isLoggedIn.value  = false;
    _sessionStart.value = null;
    localStorage.removeItem(SESSION_KEY);
    if (router) router.push('/login');
  }

  // ─── Session persistence ───────────────────────────────────────────────────
  function _saveSession() {
    const session = {
      user:          user.value,
      sessionStart:  _sessionStart.value,
      lastActivity:  Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;

      const session = JSON.parse(raw);
      const now = Date.now();

      if (now - session.sessionStart > SESSION_MAX) {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }
      if (now - session.lastActivity > INACTIVITY_LIMIT) {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }

      user.value          = session.user;
      isLoggedIn.value    = true;
      _sessionStart.value = session.sessionStart;
      return true;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
  }

  function updateLastActivity() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const session = JSON.parse(raw);
      session.lastActivity = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch { /* ignore */ }
  }

  /** Returns true if session has expired (and clears state). */
  function checkSessionExpiry() {
    if (!isLoggedIn.value) return true;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      user.value = null; isLoggedIn.value = false;
      return true;
    }
    try {
      const session = JSON.parse(raw);
      const now = Date.now();
      if (now - session.sessionStart > SESSION_MAX || now - session.lastActivity > INACTIVITY_LIMIT) {
        user.value = null; isLoggedIn.value = false; _sessionStart.value = null;
        localStorage.removeItem(SESSION_KEY);
        return true;
      }
      return false;
    } catch {
      user.value = null; isLoggedIn.value = false;
      localStorage.removeItem(SESSION_KEY);
      return true;
    }
  }

  // ─── Password management ──────────────────────────────────────────────────
  async function updatePassword(recordId, newPassword) {
    const hash = await bcrypt.hash(newPassword, 10);
    await updateRecord(TABLES.USERS, recordId, {
      password_hash:                 hash,
      reset_password_token:          null,
      reset_password_token_expiry:   null
    });
  }

  /**
   * Generate a password-reset token for the given email.
   * Stores token + expiry in Airtable and returns { token, recordId } so
   * the caller can build the reset URL (and optionally fire a webhook email).
   */
  async function requestPasswordReset(email) {
    const records = await fetchAllRecords(TABLES.USERS, ['email', 'first_name', 'is_active'], {
      filterByFormula: `LOWER({email})="${email.trim().toLowerCase()}"`,
    });
    // Always return a generic message to prevent email enumeration
    if (!records.length) return null;

    const record = records[0];
    const token  = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await updateRecord(TABLES.USERS, record.id, {
      reset_password_token:        token,
      reset_password_token_expiry: expiry,
    });

    return { token, recordId: record.id, firstName: record.fields.first_name };
  }

  /**
   * Verify a reset token is valid and not expired.
   * Returns the record if valid, null otherwise.
   */
  async function verifyResetToken(token) {
    const records = await fetchAllRecords(TABLES.USERS, ['reset_password_token', 'reset_password_token_expiry', 'first_name', 'email'], {
      filterByFormula: `{reset_password_token}="${token}"`,
    });
    if (!records.length) return null;

    const record = records[0];
    const expiry = record.fields.reset_password_token_expiry;
    if (!expiry || Date.now() > new Date(expiry).getTime()) return null;

    return record;
  }

  /** Patch user fields in state + persist session (for self-profile updates). */
  function patchUser(fields) {
    if (!user.value) return;
    user.value = { ...user.value, ...fields };
    _saveSession();
  }

  return {
    // State / computed
    user, isLoggedIn, isAdmin, isRecruiter, isManager, fullName, initials,
    // Actions
    login, logout,
    restoreSession, updateLastActivity, checkSessionExpiry,
    updatePassword, requestPasswordReset, verifyResetToken,
    patchUser,
  };
});
