<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useInactivityTimer } from '@/composables/useInactivityTimer.js';

const router    = useRouter();
const route     = useRoute();
const authStore = useAuthStore();

// Hide the shell layout on auth pages (login / forgot / reset)
const isAuthRoute = computed(() => route.meta.isAuth === true);

// Wire up inactivity timer (only active while this component is mounted)
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

// ─── Avatar dropdown ──────────────────────────────────────────────────────────
const avatarOpen = ref(false);

function toggleAvatar()  { avatarOpen.value = !avatarOpen.value; }
function closeAvatar()   { avatarOpen.value = false; }
function logout()        { avatarOpen.value = false; authStore.logout(router); }
</script>

<template>
  <div id="app">

    <!-- ─── AUTH PAGES: full-screen, no shell ─── -->
    <template v-if="isAuthRoute">
      <router-view />
    </template>

    <!-- ─── MAIN APP SHELL ─── -->
    <template v-else>
      <!-- Header -->
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
              <button class="avatar-logout" @click="logout">
                <i class="bi bi-box-arrow-right me-2"></i>Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="main-container">
        <!-- Sidebar -->
        <aside class="sidebar">
          <nav>
            <ul class="menu-list">
              <li v-for="menu in menuItems" :key="menu.name" class="menu-li">

                <!-- Top-level with submenus -->
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

                <!-- Submenu list -->
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

                <!-- Regular item (no submenus) -->
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

        <!-- Main Content -->
        <main class="content">
          <router-view />
        </main>
      </div>

      <!-- Footer -->
      <footer class="app-footer">
        <p>© 2026 SureCafe AI. All rights reserved.</p>
      </footer>
    </template>

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

/* ─── Avatar + dropdown ─── */
.user-profile { position: relative; }

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1565c0, #42a5f5);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.5px;
  user-select: none;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.6);
  box-shadow: 0 2px 8px rgba(25,118,210,0.35);
  transition: box-shadow 0.2s, transform 0.15s;
}
.user-avatar:hover { box-shadow: 0 4px 14px rgba(25,118,210,0.45); transform: scale(1.06); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

.avatar-dropdown {
  position: absolute;
  top: calc(100% + 1px);
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.14);
  min-width: 230px;
  z-index: 500;
  padding: 16px;
  animation: dropFade 0.15s ease;
}
@keyframes dropFade { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }

.avatar-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar-header-pic {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #1565c0, #42a5f5);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e0e8ff;
}
.avatar-header-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-header-initials { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: 0.5px; }

.avatar-info  { flex: 1; min-width: 0; }
.avatar-name  { font-size: 14px; font-weight: 700; color: #0d1b2a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.avatar-email { font-size: 11.5px; color: #6b7280; margin-top: 2px; word-break: break-all; line-height: 1.3; }
.avatar-role  {
  display: inline-flex; align-items: center; margin-top: 6px;
  padding: 2px 9px; background: linear-gradient(135deg,#e0f2fe,#bae6fd); color: #0369a1;
  border-radius: 20px; font-size: 10.5px; font-weight: 600; text-transform: capitalize;
}
.avatar-divider { margin: 12px 0; border-color: #f3f4f6; }
.avatar-logout {
  width: 100%; text-align: left; border: none; background: transparent;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
  font-size: 13.5px; color: #dc2626; font-weight: 500;
  display: flex; align-items: center;
  transition: background 0.2s;
}
.avatar-logout:hover { background: #fef2f2; }

/* ─── Layout ─── */
.main-container { display: flex; flex: 1; overflow: hidden; }

/* ─── Sidebar ─── */
.sidebar {
  width: 190px;
  flex-shrink: 0;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  padding: 10px 0;
  overflow-y: auto;
}
.menu-list,
.submenu-list { list-style: none; padding: 0 !important; margin: 0; }
.menu-li,
.submenu-li   { margin: 1px 0; }
.menu-item,
.submenu-item {
  display: flex;
  align-items: center;
  padding: 7px 12px;
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 6px;
  transition: background-color 0.18s, color 0.18s;
  font-size: 13.5px;
  color: #424242;
  user-select: none;
}
.menu-item:hover,
.submenu-item:hover  { background-color: #e9ecef; color: #1976d2; }
.menu-item.active,
.submenu-item.active { background-color: #ffe8d6; color: #e65100; font-weight: 600; }
.menu-icon  { font-size: 15px; margin-right: 8px; flex-shrink: 0; }
.menu-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.submenu-item { padding-left: 28px; font-size: 13px; }

/* ─── Content ─── */
.content { flex: 1; overflow-y: auto; padding: 16px 20px; background: #f6f8fb; }

/* ─── Footer ─── */
.app-footer {
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  text-align: center;
  padding: 6px 1rem;
  font-size: 12px;
  color: #9e9e9e;
  flex-shrink: 0;
}
.app-footer p { margin: 0; }
</style>
