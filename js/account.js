// Google 登入（可選）及雲端進度。遊戲和老師頁共用。
// 未登入或離線時，遊戲照常運作；作答記錄先放在本機的佇列，連線後才送出。
import { GOOGLE_CLIENT_ID, ACCOUNT_URL } from './account-config.js';

const KEY = 'fatkee.account', QKEY = 'fatkee.account.queue', MAX_QUEUE = 500;

export function createAccount({ clientId, endpoint, fetcher, storage }) {
  const base = String(endpoint || '').replace(/\/$/, '');
  const read = (k, d) => { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { v === null ? storage.removeItem(k) : storage.setItem(k, JSON.stringify(v)); } catch { /* 私密瀏覽 */ } };
  let state = read(KEY, null);          // { token, user: { email, name, classNo, teacher } }
  const listeners = new Set();
  const changed = () => listeners.forEach(f => { try { f(state && state.user); } catch { /* 忽略 */ } });

  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const res = await fetcher(base + path, {
      method, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth && state ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && auth) { signOut(); const e = new Error('SIGNED_OUT'); e.status = 401; throw e; }
    if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
    return res.status === 204 ? null : res.json();
  }

  function signOut() {
    state = null; write(KEY, null); write(QKEY, null);
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* 未載入 */ }
    changed();
  }

  let flushing = null;
  async function flush() {
    if (!state || flushing) return flushing;
    flushing = (async () => {
      let q = read(QKEY, []);
      while (q.length && state) {
        try { await api('/me/event', { method: 'POST', body: q[0] }); }
        catch (e) { if (e.status === 400) { /* 無效記錄，丟棄 */ } else break; }
        q = read(QKEY, []).slice(1); write(QKEY, q);
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }

  return {
    enabled: !!(clientId && base),
    clientId,
    get user() { return state && state.user; },
    get pending() { return read(QKEY, []).length; },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    async signIn(credential) {
      const r = await api('/auth/google', { method: 'POST', body: { credential }, auth: false });
      state = { token: r.token, user: r.user };
      write(KEY, state); changed();
      return r;
    },
    signOut,
    async me() { const r = await api('/me'); state.user = r.user; write(KEY, state); return r; },
    async sync(levels, classNo) {
      const r = await api('/me/sync', { method: 'POST', body: classNo === undefined ? { levels } : { levels, classNo } });
      state.user = r.user; write(KEY, state); changed();
      return r;
    },
    // kind: 'wrong' | 'hint' | 'pass'
    record(level, kind, extra = {}) {
      if (!state) return;
      const q = read(QKEY, []);
      q.push({ level, kind, ...extra });
      write(QKEY, q.slice(-MAX_QUEUE));
      flush().catch(() => {});
    },
    flush,
    async deleteMe() { await api('/me', { method: 'DELETE' }); signOut(); },
    students() { return api('/teacher/students'); },
    deleteStudent(id) { return api('/teacher/students/' + encodeURIComponent(id), { method: 'DELETE' }); },
  };
}

export const account = createAccount({
  clientId: GOOGLE_CLIENT_ID, endpoint: ACCOUNT_URL,
  fetcher: (...a) => fetch(...a), storage: globalThis.localStorage,
});

if (typeof window !== 'undefined') window.addEventListener('online', () => account.flush().catch(() => {}));

// ---------- Google 登入按鈕（Google Identity Services） ----------
let gisLoad = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoad = gisLoad || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gisLoad = null; reject(new Error('GIS')); };
    document.head.appendChild(s);
  });
  return gisLoad;
}

// 在 el 內放 Google 登入按鈕。onCredential(credential) 收到 Google 的 ID token。
export async function renderGoogleButton(el, onCredential) {
  if (!account.enabled) { el.textContent = ''; return; }
  el.innerHTML = '<span class="muted" style="font-size:14px">載入 Google 登入……</span>';
  try { await loadGis(); }
  catch { el.innerHTML = '<span class="muted" style="font-size:14px">未能載入 Google 登入。請檢查網絡（離線時不能登入）。</span>'; return; }
  window.google.accounts.id.initialize({
    client_id: account.clientId, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true,
    callback: r => { if (r && r.credential) onCredential(r.credential); },
  });
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, {
    type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'zh-HK',
    width: Math.min(Math.max(el.clientWidth || 300, 200), 400),
  });
}
