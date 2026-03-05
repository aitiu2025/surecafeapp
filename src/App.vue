<script setup>
import { ref, computed, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useInactivityTimer } from '@/composables/useInactivityTimer.js';
import bcrypt from 'bcryptjs';
import { fetchAllRecords, updateRecord, TABLES } from '@/services/airtableService.js';

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;

const router    = useRouter();
const route     = useRoute();
const authStore = useAuthStore();

const isAuthRoute = computed(() => route.meta.isAuth === true);

useInactivityTimer(authStore, router);

// ─── Sidebar menu ──────────────────────────────────────────────────────────────
const menuItems = computed(() => [
  { name: 'Dashboard',           icon: 'bi-speedometer2', link: '/' },
  { name: 'Candidate Pipelines', icon: 'bi-diagram-3',    link: '/candidate-pipelines' },
  { name: 'Candidates',          icon: 'bi-people',       link: '/candidates' },
  { name: 'Job Descriptions',    icon: 'bi-briefcase',    link: '/job-descriptions' },
  { name: 'JD-Candidates Match', icon: 'bi-intersect',    link: '/jd-candidates-match' },
  {
    name: 'Settings', icon: 'bi-gear',
    submenus: [
      { name: 'Clients', icon: 'bi-building',       link: '/clients' },
      { name: 'Reports', icon: 'bi-bar-chart-line', link: '/reports' },
      ...(authStore.isAdmin
        ? [{ name: 'Users', icon: 'bi-people-fill', link: '/users' }]
        : []),
    ],
  },
]);

const expandedMenu = ref('Settings');

function isActive(link)          { return route.path === link; }
function isSubmenuActive(subs)   { return subs?.some(s => route.path === s.link); }
function toggleSubmenu(name)     { expandedMenu.value = expandedMenu.value === name ? null : name; }
function navigateTo(link)        { router.push(link); }

// ─── Avatar dropdown ───────────────────────────────────────────────────────────
const avatarOpen = ref(false);

function toggleAvatar()  { avatarOpen.value = !avatarOpen.value; }
function closeAvatar()   { avatarOpen.value = false; }
function logout()        { avatarOpen.value = false; authStore.logout(router); }

// ─── Self-profile edit modal ───────────────────────────────────────────────────
const profileOpen    = ref(false);
const profileSaving  = ref(false);
const profileError   = ref('');
const profileForm = reactive({ first_name: '', last_name: '', password: '' });

const profilePicFile      = ref(null);
const profilePicPreview   = ref('');
const profilePicInputRef  = ref(null);
const removingProfilePic  = ref(false);

function openProfile() {
  avatarOpen.value = false;
  profileError.value = '';
  profilePicFile.value = null;
  profilePicPreview.value = '';
  Object.assign(profileForm, {
    first_name: authStore.user?.first_name || '',
    last_name:  authStore.user?.last_name  || '',
    password:   '',
  });
  profileOpen.value = true;
}

function closeProfile() {
  profileOpen.value = false;
  profilePicFile.value = null;
  profilePicPreview.value = '';
}

function onProfilePicChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    profileError.value = 'Image must be under 2 MB.';
    e.target.value = '';
    return;
  }
  profilePicFile.value    = file;
  profilePicPreview.value = URL.createObjectURL(file);
}

function clearProfilePic() {
  profilePicFile.value    = null;
  profilePicPreview.value = '';
  if (profilePicInputRef.value) profilePicInputRef.value.value = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadProfilePic(recordId, file) {
  const base64 = await fileToBase64(file);
  const url = `https://content.airtable.com/v0/${BASE_ID}/${recordId}/profile_pic/uploadAttachment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, filename: file.name, file: base64 }),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data?.attachment?.thumbnails?.large?.url || data?.attachment?.url || null;
}

async function saveProfile() {
  profileError.value = '';
  if (!profileForm.first_name.trim() || !profileForm.last_name.trim()) {
    profileError.value = 'First name and last name are required.'; return;
  }
  if (profileForm.password && profileForm.password.length < 8) {
    profileError.value = 'Password must be at least 8 characters.'; return;
  }

  profileSaving.value = true;
  try {
    const recordId = authStore.user.record_id;
    const fields = {
      first_name: profileForm.first_name.trim(),
      last_name:  profileForm.last_name.trim(),
    };
    if (profileForm.password) {
      fields.password_hash = await bcrypt.hash(profileForm.password, 10);
    }

    // Step 1 — clear existing pic first, then upload new one
    if (profilePicFile.value) {
      if (authStore.user.profile_pic_url) {
        removingProfilePic.value = true;
        await updateRecord(TABLES.USERS, recordId, { profile_pic: [] });
        removingProfilePic.value = false;
      }
      await uploadProfilePic(recordId, profilePicFile.value);
    }

    // Step 2 — update other fields
    await updateRecord(TABLES.USERS, recordId, fields);

    // Step 3 — re-fetch record to get the accurate Airtable thumbnail URL
    let newPicUrl = authStore.user.profile_pic_url || null;
    if (profilePicFile.value) {
      const records = await fetchAllRecords(TABLES.USERS, ['profile_pic'], {
        filterByFormula: `LOWER({email})="${authStore.user.email.toLowerCase()}"`,
      });
      if (records.length) {
        const f = records[0].fields;
        newPicUrl = f.profile_pic?.[0]?.thumbnails?.large?.url
                 || f.profile_pic?.[0]?.url
                 || null;
      }
    }

    // Step 4 — patch auth store → reactive update everywhere instantly
    authStore.patchUser({
      first_name:      fields.first_name,
      last_name:       fields.last_name,
      profile_pic_url: newPicUrl,
    });

    profileOpen.value    = false;
    profilePicFile.value = null;
    profilePicPreview.value = '';
  } catch (e) {
    profileError.value = 'Save failed: ' + e.message;
  } finally {
    profileSaving.value      = false;
    removingProfilePic.value = false;
  }
}
</script>

<template>
  <div id="app">

    <!-- ─── AUTH PAGES ─── -->
    <template v-if="isAuthRoute">
      <router-view />
    </template>

    <!-- ─── MAIN APP SHELL ─── -->
    <template v-else>
      <header class="app-header">
        <div class="header-inner">
          <div class="logo">
            <img src="/logo.png" alt="SureCafe" />
          </div>

          <!-- User avatar + dropdown -->
          <div class="user-profile" @mouseleave="closeAvatar">
            <div class="user-avatar" @click="toggleAvatar" :title="authStore.fullName">
              <img v-if="authStore.user?.profile_pic_url"
                :src="authStore.user.profile_pic_url"
                class="avatar-img" alt="profile" />
              <span v-else>{{ authStore.initials || 'SC' }}</span>
            </div>

            <div v-if="avatarOpen" class="avatar-dropdown">
              <!-- Profile header -->
              <div class="avatar-header">
                <div class="avatar-header-pic">
                  <img v-if="authStore.user?.profile_pic_url"
                    :src="authStore.user.profile_pic_url"
                    class="avatar-header-img" alt="profile" />
                  <span v-else class="avatar-header-initials">{{ authStore.initials || 'SC' }}</span>
                </div>
                <div class="avatar-info">
                  <div class="avatar-name">{{ authStore.fullName }}</div>
                  <div class="avatar-email">{{ authStore.user?.email }}</div>
                  <span class="avatar-role">
                    <i class="bi bi-shield-check-fill me-1"></i>{{ authStore.user?.role }}
                  </span>
                </div>
              </div>

              <hr class="avatar-divider" />

              <!-- Actions -->
              <button class="avatar-action" @click="openProfile">
                <i class="bi bi-person-gear"></i>
                <span>Edit Profile</span>
              </button>
              <button class="avatar-logout" @click="logout">
                <i class="bi bi-box-arrow-right"></i>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="main-container">
        <aside class="sidebar">
          <nav>
            <ul class="menu-list">
              <li v-for="menu in menuItems" :key="menu.name" class="menu-li">
                <div
                  v-if="menu.submenus"
                  class="menu-item"
                  :class="{ active: isSubmenuActive(menu.submenus) }"
                  @click="toggleSubmenu(menu.name)"
                >
                  <i :class="['bi', menu.icon, 'menu-icon']"></i>
                  <span class="menu-label">{{ menu.name }}</span>
                  <i class="bi ms-auto"
                    :class="expandedMenu === menu.name ? 'bi-chevron-up' : 'bi-chevron-down'"
                    style="font-size:11px;"></i>
                </div>
                <ul v-if="menu.submenus && expandedMenu === menu.name" class="submenu-list">
                  <li v-for="sub in menu.submenus" :key="sub.name" class="submenu-li">
                    <div
                      class="submenu-item"
                      :class="{ active: isActive(sub.link) }"
                      @click="navigateTo(sub.link)"
                    >
                      <i :class="['bi', sub.icon, 'menu-icon']"></i>
                      <span class="menu-label">{{ sub.name }}</span>
                    </div>
                  </li>
                </ul>
                <div
                  v-if="!menu.submenus"
                  class="menu-item"
                  :class="{ active: isActive(menu.link) }"
                  @click="navigateTo(menu.link)"
                >
                  <i :class="['bi', menu.icon, 'menu-icon']"></i>
                  <span class="menu-label">{{ menu.name }}</span>
                </div>
              </li>
            </ul>
          </nav>
        </aside>

        <main class="content">
          <router-view />
        </main>
      </div>

      <footer class="app-footer">
        <p>© 2026 SureCafe AI. All rights reserved.</p>
      </footer>
    </template>

    <!-- ─── Self-Profile Edit Modal ─── -->
    <transition name="modal-fade">
      <div v-if="profileOpen" class="profile-overlay" @click.self="closeProfile">
        <div class="profile-modal">
          <!-- Header -->
          <div class="profile-modal-header">
            <div class="profile-modal-icon"><i class="bi bi-person-gear"></i></div>
            <div>
              <h5 class="profile-modal-title">Edit Profile</h5>
              <p class="profile-modal-sub">Update your personal details</p>
            </div>
            <button class="profile-close-btn" @click="closeProfile">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <div class="profile-modal-body">
            <!-- Error -->
            <div v-if="profileError" class="profile-err">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ profileError }}
            </div>

            <!-- Profile pic section -->
            <div class="ppic-section">
              <div class="ppic-wrap">
                <div class="ppic-circle">
                  <img v-if="profilePicPreview || authStore.user?.profile_pic_url"
                    :src="profilePicPreview || authStore.user.profile_pic_url"
                    class="ppic-img" alt="profile" />
                  <span v-else class="ppic-initials">{{ authStore.initials || 'SC' }}</span>
                </div>
                <!-- Camera overlay -->
                <label class="ppic-camera">
                  <i class="bi bi-camera-fill"></i>
                  <input ref="profilePicInputRef" type="file" accept="image/*"
                    style="display:none;" @change="onProfilePicChange" />
                </label>
                <!-- Remove icon (only when new file chosen) -->
                <button v-if="profilePicPreview" type="button"
                  class="ppic-remove" @click="clearProfilePic" title="Remove selection">
                  <i class="bi bi-x"></i>
                </button>
              </div>
              <p class="ppic-hint">JPG, PNG, GIF · Max 2 MB</p>
            </div>

            <div class="profile-divider"></div>

            <!-- Form fields -->
            <div class="row g-3">
              <div class="col-6">
                <label class="pf-label">First Name</label>
                <input v-model="profileForm.first_name" type="text" class="pf-input" placeholder="First name" />
              </div>
              <div class="col-6">
                <label class="pf-label">Last Name</label>
                <input v-model="profileForm.last_name" type="text" class="pf-input" placeholder="Last name" />
              </div>
              <div class="col-12">
                <label class="pf-label">Email <span class="pf-readonly-badge">Read-only</span></label>
                <input :value="authStore.user?.email" type="email" class="pf-input pf-readonly" readonly />
              </div>
              <div class="col-12">
                <label class="pf-label">
                  New Password
                  <span class="pf-optional">— leave blank to keep current</span>
                </label>
                <input v-model="profileForm.password" type="password" class="pf-input"
                  placeholder="Min. 8 characters" />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="profile-modal-footer">
            <button class="pf-cancel" @click="closeProfile">Cancel</button>
            <button class="pf-save" @click="saveProfile" :disabled="profileSaving">
              <span v-if="profileSaving">
                <span class="spinner-border spinner-border-sm me-2"></span>
                {{ removingProfilePic ? 'Updating photo…' : 'Saving…' }}
              </span>
              <span v-else><i class="bi bi-check-lg me-2"></i>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  overflow: hidden;
}

/* ─── Header ─── */
.app-header {
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 1rem;
  height: 52px;
  flex-shrink: 0;
  z-index: 100;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}
.logo img { height: 38px; object-fit: contain; }

/* ─── Avatar ─── */
.user-profile { position: relative; }

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1565c0, #42a5f5);
  color: #fff;
  font-size: 13px; font-weight: 700;
  cursor: pointer; letter-spacing: 0.5px;
  user-select: none; overflow: hidden;
  border: 2px solid rgba(255,255,255,0.6);
  box-shadow: 0 2px 8px rgba(25,118,210,0.35);
  transition: box-shadow 0.2s, transform 0.15s;
}
.user-avatar:hover { box-shadow: 0 4px 14px rgba(25,118,210,0.45); transform: scale(1.06); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* ─── Dropdown ─── */
.avatar-dropdown {
  position: absolute;
  top: calc(100% + 1px); right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.14);
  min-width: 260px;
  z-index: 500;
  padding: 16px;
  animation: dropFade 0.15s ease;
}
@keyframes dropFade {
  from { opacity:0; transform:translateY(-6px); }
  to   { opacity:1; transform:translateY(0); }
}

.avatar-header { display: flex; align-items: center; gap: 12px; }
.avatar-header-pic {
  width: 48px; height: 48px;
  border-radius: 50%; flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #1565c0, #42a5f5);
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #e0e8ff;
}
.avatar-header-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-header-initials { font-size: 17px; font-weight: 700; color: #fff; }

.avatar-info { flex: 1; min-width: 0; }
.avatar-name  { font-size: 14px; font-weight: 700; color: #0d1b2a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.avatar-email { font-size: 11.5px; color: #6b7280; margin-top: 2px; word-break: break-all; line-height: 1.3; }
.avatar-role  {
  display: inline-flex; align-items: center; margin-top: 6px;
  padding: 2px 9px;
  background: linear-gradient(135deg, #e0f2fe, #bae6fd);
  color: #0369a1; border-radius: 20px;
  font-size: 10.5px; font-weight: 600; text-transform: capitalize;
}

.avatar-divider { margin: 12px 0; border-color: #f3f4f6; }

.avatar-action,
.avatar-logout {
  width: 100%; border: none; background: transparent;
  padding: 9px 10px; border-radius: 9px; cursor: pointer;
  font-size: 13.5px; font-weight: 500;
  display: flex; align-items: center; gap: 10px;
  transition: background 0.18s;
  margin-bottom: 2px;
}
.avatar-action { color: #374151; }
.avatar-action:hover { background: #f3f4f6; }
.avatar-action .bi, .avatar-logout .bi { font-size: 15px; flex-shrink: 0; }
.avatar-logout { color: #dc2626; }
.avatar-logout:hover { background: #fef2f2; }

/* ─── Layout ─── */
.main-container { display: flex; flex: 1; overflow: hidden; }

/* ─── Sidebar ─── */
.sidebar {
  width: 190px; flex-shrink: 0;
  background: #f8f9fa; border-right: 1px solid #e0e0e0;
  padding: 10px 0; overflow-y: auto;
}
.menu-list, .submenu-list { list-style: none; padding: 0 !important; margin: 0; }
.menu-li, .submenu-li   { margin: 1px 0; }
.menu-item, .submenu-item {
  display: flex; align-items: center;
  padding: 7px 12px; cursor: pointer;
  border-radius: 6px; margin: 1px 6px;
  transition: background-color 0.18s, color 0.18s;
  font-size: 13.5px; color: #424242; user-select: none;
}
.menu-item:hover, .submenu-item:hover  { background-color: #e9ecef; color: #1976d2; }
.menu-item.active, .submenu-item.active { background-color: #ffe8d6; color: #e65100; font-weight: 600; }
.menu-icon  { font-size: 15px; margin-right: 8px; flex-shrink: 0; }
.menu-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.submenu-item { padding-left: 28px; font-size: 13px; }

/* ─── Content ─── */
.content { flex: 1; overflow-y: auto; padding: 16px 20px; background: #f6f8fb; }

/* ─── Footer ─── */
.app-footer {
  background: #f8f9fa; border-top: 1px solid #e0e0e0;
  text-align: center; padding: 6px 1rem;
  font-size: 12px; color: #9e9e9e; flex-shrink: 0;
}
.app-footer p { margin: 0; }

/* ─── Profile Modal Overlay ─── */
.profile-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(2px);
  z-index: 1100;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.profile-modal {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.22);
  width: 100%; max-width: 480px;
  overflow: hidden;
}

.profile-modal-header {
  display: flex; align-items: center; gap: 14px;
  padding: 20px 24px; border-bottom: 1px solid #f0f0f0;
}
.profile-modal-icon {
  width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
  background: #e0f2fe; color: #0369a1;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.profile-modal-title { font-size: 16px; font-weight: 700; color: #0d1b2a; margin: 0 0 2px; }
.profile-modal-sub   { font-size: 12px; color: #6b7280; margin: 0; }
.profile-close-btn {
  margin-left: auto; border: none; background: #f3f4f6; color: #374151;
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 14px; transition: background 0.18s;
}
.profile-close-btn:hover { background: #e5e7eb; }

.profile-modal-body { padding: 22px 24px; }

.profile-err {
  background: #fff0f0; border-left: 4px solid #dc2626;
  border-radius: 8px; padding: 11px 14px;
  font-size: 13px; color: #b91c1c; margin-bottom: 16px;
}

/* Profile pic section (centered + overlay) */
.ppic-section { text-align: center; margin-bottom: 6px; }
.ppic-wrap    { position: relative; display: inline-block; margin-bottom: 8px; }
.ppic-circle  {
  width: 88px; height: 88px; border-radius: 50%;
  background: linear-gradient(135deg, #1565c0, #42a5f5);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; border: 3px solid #dde8ff;
}
.ppic-img      { width: 100%; height: 100%; object-fit: cover; }
.ppic-initials { font-size: 30px; font-weight: 700; color: #fff; letter-spacing: 1px; }

.ppic-camera {
  position: absolute; bottom: 2px; right: 2px;
  width: 28px; height: 28px; border-radius: 50%;
  background: #1976d2; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; cursor: pointer;
  border: 2px solid #fff;
  transition: background 0.18s;
}
.ppic-camera:hover { background: #1565c0; }

.ppic-remove {
  position: absolute; top: 0; right: 0;
  width: 22px; height: 22px; border-radius: 50%;
  background: #dc2626; color: #fff;
  border: 2px solid #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; cursor: pointer; padding: 0;
  transition: background 0.18s;
}
.ppic-remove:hover { background: #b91c1c; }

.ppic-hint { font-size: 11.5px; color: #9ca3af; margin: 0; }

.profile-divider { height: 1px; background: #f3f4f6; margin: 16px 0; }

.pf-label {
  display: block; font-size: 13px; font-weight: 600;
  color: #374151; margin-bottom: 6px;
}
.pf-optional { font-weight: 500; font-size: 11.5px; color: #ed7d06; }
.pf-readonly-badge {
  display: inline-block; font-size: 10px; font-weight: 600;
  background: #f3f4f6; color: #6b7280; border-radius: 4px;
  padding: 1px 6px; margin-left: 6px; vertical-align: middle;
}
.pf-input {
  width: 100%; height: 42px;
  border: 1.5px solid #e5e7eb; border-radius: 9px;
  padding: 0 12px; font-size: 14px; color: #1a1a2e;
  background: #fafcff; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.pf-input:focus { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.1); background: #fff; }
.pf-readonly { background: #f9fafb; color: #6b7280; cursor: not-allowed; }

.profile-modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 24px; border-top: 1px solid #f0f0f0;
}
.pf-cancel {
  border: 1.5px solid #e5e7eb; background: #fff; color: #374151;
  border-radius: 9px; padding: 9px 20px;
  font-size: 14px; font-weight: 500; cursor: pointer;
  transition: background 0.18s;
}
.pf-cancel:hover { background: #f9fafb; }
.pf-save {
  background: linear-gradient(135deg, #1565c0, #1976d2, #2196f3);
  color: #fff; border: none; border-radius: 9px;
  padding: 9px 22px; font-size: 14px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center;
  box-shadow: 0 3px 12px rgba(25,118,210,0.3);
  transition: opacity 0.2s, transform 0.15s;
}
.pf-save:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.pf-save:disabled { opacity: 0.65; cursor: not-allowed; }

/* Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.22s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
