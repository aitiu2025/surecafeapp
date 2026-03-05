/**
 * useInactivityTimer
 * Attaches activity listeners to the window and runs a periodic check.
 * Auto-logouts the user after INACTIVITY_LIMIT of no activity,
 * or when SESSION_MAX is reached (checked in the store).
 *
 * Usage: call in App.vue onMounted when user is logged in.
 */
import { onMounted, onUnmounted } from 'vue';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
const CHECK_INTERVAL  = 60_000; // check every 60 seconds

export function useInactivityTimer(authStore, router) {
  let intervalId  = null;
  let lastUpdate  = 0;

  function onActivity() {
    const now = Date.now();
    if (now - lastUpdate > 60_000) { // throttle — update at most once per minute
      lastUpdate = now;
      authStore.updateLastActivity();
    }
  }

  function runCheck() {
    if (!authStore.isLoggedIn) return;
    const expired = authStore.checkSessionExpiry();
    if (expired) router.push('/login');
  }

  function onVisibilityChange() {
    if (!document.hidden) runCheck(); // user returns to tab → check immediately
  }

  onMounted(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    intervalId = setInterval(runCheck, CHECK_INTERVAL);
  });

  onUnmounted(() => {
    ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (intervalId) clearInterval(intervalId);
  });
}
