import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './assets/main.css';

// ─── Page imports ──────────────────────────────────────────────────────────────
import Dashboard          from './pages/Dashboard.vue';
import CandidatePipelines from './pages/CandidatePipelines.vue';
import Candidates         from './pages/Candidates.vue';
import JobDescriptions    from './pages/JobDescriptions.vue';
import JDCandidatesMatch  from './pages/JDCandidatesMatch.vue';
import Clients            from './pages/Clients.vue';
import Reports            from './pages/Reports.vue';
import Users              from './pages/Users.vue';
import Login              from './pages/Login.vue';
import ForgotPassword     from './pages/ForgotPassword.vue';
import ResetPassword      from './pages/ResetPassword.vue';

// ─── Store import (used inside guard after Pinia is installed) ─────────────────
import { useAuthStore } from './stores/auth.js';

// ─── Routes ───────────────────────────────────────────────────────────────────
const routes = [
  // Auth routes — full-page (no app shell shown)
  { path: '/login',           component: Login,          meta: { isAuth: true } },
  { path: '/forgot-password', component: ForgotPassword, meta: { isAuth: true } },
  { path: '/reset-password',  component: ResetPassword,  meta: { isAuth: true } },

  // Protected routes
  { path: '/',                    component: Dashboard,          meta: { requiresAuth: true } },
  { path: '/candidate-pipelines', component: CandidatePipelines, meta: { requiresAuth: true } },
  { path: '/candidates',          component: Candidates,         meta: { requiresAuth: true } },
  { path: '/job-descriptions',    component: JobDescriptions,    meta: { requiresAuth: true } },
  { path: '/jd-candidates-match', component: JDCandidatesMatch,  meta: { requiresAuth: true } },
  { path: '/clients',             component: Clients,            meta: { requiresAuth: true } },
  { path: '/reports',             component: Reports,            meta: { requiresAuth: true } },

  // Admin-only
  { path: '/users', component: Users, meta: { requiresAuth: true, requiresAdmin: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// ─── App + Pinia (install Pinia BEFORE guard so useAuthStore() works) ──────────
const pinia = createPinia();
const app   = createApp(App);
app.use(pinia);

// ─── Navigation guard ─────────────────────────────────────────────────────────
let sessionRestored = false;

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();

  // Restore session from localStorage on first navigation only
  if (!sessionRestored) {
    sessionRestored = true;
    auth.restoreSession();
  }

  // Public auth pages — if already logged in, redirect to dashboard
  if (to.meta.isAuth) {
    if (auth.isLoggedIn) return next('/');
    return next();
  }

  // Protected page — must be logged in
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return next('/login');
  }

  // Admin-only page
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return next('/'); // redirect non-admin to dashboard
  }

  next();
});

app.use(router);
app.mount('#app');
