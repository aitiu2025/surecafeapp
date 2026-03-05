<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route  = useRoute();

const menuItems = [
  { name: 'Dashboard',           icon: 'bi-speedometer2',      link: '/' },
  { name: 'Candidate Pipelines', icon: 'bi-diagram-3',         link: '/candidate-pipelines' },
  { name: 'Candidates',          icon: 'bi-people',            link: '/candidates' },
  { name: 'Job Descriptions',    icon: 'bi-briefcase',         link: '/job-descriptions' },
  { name: 'JD-Candidates Match', icon: 'bi-intersect',         link: '/jd-candidates-match' },
  {
    name: 'Settings', icon: 'bi-gear', submenus: [
      { name: 'Clients', icon: 'bi-building', link: '/clients' },
      { name: 'Reports', icon: 'bi-bar-chart-line', link: '/reports' },
    ],
  },
];

const expandedMenu = ref('Settings'); // Settings open by default so Clients is accessible

function isActive(link) {
  return route.path === link;
}

function isSubmenuActive(submenus) {
  return submenus?.some(s => route.path === s.link);
}

function toggleSubmenu(menuName) {
  expandedMenu.value = expandedMenu.value === menuName ? null : menuName;
}

function navigateTo(link) {
  router.push(link);
}
</script>

<template>
  <div id="app">
    <!-- ─── Header ─── -->
    <header class="app-header">
      <div class="header-inner">
        <div class="logo">
          <img src="/logo.png" alt="SureCafe" />
        </div>
        <div class="user-profile">
          <span class="user-avatar">AT</span>
        </div>
      </div>
    </header>

    <div class="main-container">
      <!-- ─── Sidebar ─── -->
      <aside class="sidebar">
        <nav>
          <ul class="menu-list">
            <li v-for="menu in menuItems" :key="menu.name" class="menu-li">
              <!-- Top-level item with submenus -->
              <div
                v-if="menu.submenus"
                class="menu-item"
                :class="{ 'active': isSubmenuActive(menu.submenus) }"
                @click="toggleSubmenu(menu.name)"
              >
                <i :class="['bi', menu.icon, 'menu-icon']"></i>
                <span class="menu-label">{{ menu.name }}</span>
                <i class="bi ms-auto"
                  :class="expandedMenu === menu.name ? 'bi-chevron-up' : 'bi-chevron-down'"
                  style="font-size: 11px;"></i>
              </div>

              <!-- Submenu list -->
              <ul v-if="menu.submenus && expandedMenu === menu.name" class="submenu-list">
                <li v-for="sub in menu.submenus" :key="sub.name" class="submenu-li">
                  <div
                    class="submenu-item"
                    :class="{ 'active': isActive(sub.link) }"
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
                :class="{ 'active': isActive(menu.link) }"
                @click="navigateTo(menu.link)"
              >
                <i :class="['bi', menu.icon, 'menu-icon']"></i>
                <span class="menu-label">{{ menu.name }}</span>
              </div>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- ─── Main Content ─── -->
      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- ─── Footer ─── -->
    <footer class="app-footer">
      <p>© 2026 SureCafe AI. All rights reserved.</p>
    </footer>
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

.logo img {
  height: 38px;
  object-fit: contain;
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1976d2, #42a5f5);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.5px;
}

/* ─── Layout ─── */
.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

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
.submenu-list {
  list-style: none;
  padding: 0 !important;
  margin: 0;
}

.menu-li,
.submenu-li {
  margin: 1px 0;
}

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
.submenu-item:hover {
  background-color: #e9ecef;
  color: #1976d2;
}

.menu-item.active,
.submenu-item.active {
  background-color: #ffe8d6;
  color: #e65100;
  font-weight: 600;
}

.menu-icon {
  font-size: 15px;
  margin-right: 8px;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submenu-item {
  padding-left: 28px;
  font-size: 13px;
}

/* ─── Content ─── */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #f6f8fb;
}

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

.app-footer p {
  margin: 0;
}
</style>
