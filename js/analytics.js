import { ANALYTICS_URL } from './analytics-config.js';

export function createAnalytics({ endpoint, fetcher, visible, allowed, now }) {
  let started = false, last = now();
  const send = (event, level = '', seconds = 0) => {
    if (!endpoint || !allowed() || !started) return;
    // Explicit allowlist: never serialize game state, answers or progress codes.
    try {
      Promise.resolve(fetcher(endpoint + '/events', {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ event, level, seconds }),
      })).catch(() => {});
    } catch {}
  };
  return {
    start() { if (started) return; started = true; last = now(); send('visit'); },
    event: send,
    tick() {
      const current = now(), seconds = Math.floor((current - last) / 1000);
      last = current;
      if (visible() && seconds > 0 && seconds <= 30) send('active', '', seconds);
    },
    resetClock() { last = now(); },
  };
}
const permitted = () => {
  try { return localStorage.getItem('fatkee.analytics.off') !== '1' &&
    navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl; } catch { return false; }
};
export const usage = createAnalytics({
  endpoint: ANALYTICS_URL.replace(/\/$/, ''), fetcher: (...args) => fetch(...args),
  visible: () => document.visibilityState === 'visible',
  allowed: permitted, now: () => performance.now(),
});
export function statisticsEnabled() { return permitted(); }
export function setStatisticsEnabled(value) {
  try { localStorage.setItem('fatkee.analytics.off', value ? '0' : '1'); } catch {}
}
if (typeof document !== 'undefined') {
  setInterval(() => usage.tick(), 15000);
  document.addEventListener('visibilitychange', () => usage.resetClock());
}
