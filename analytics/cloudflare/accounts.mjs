// Google 登入及學生進度。
// 學生用 Google 登入（可選），每關的星數、錯題簿、錯誤及提示次數保存在 D1。
// 只有 TEACHER_EMAILS 內的帳戶可以讀取全部學生的記錄。
//
// 需要的設定：
//   GOOGLE_CLIENT_ID  （wrangler.jsonc 的 vars，公開）
//   SESSION_SECRET    （secret，至少 32 個字元）
//   TEACHER_EMAILS    （secret，以逗號分隔的老師電郵）
//   DB                （D1，已執行 migrations/0002_accounts.sql）

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const SESSION_DAYS = 30;
const MAX_BODY = 16384;
const enc = new TextEncoder();

export const ACCOUNT_PATHS = /^\/(auth\/google|me(\/(progress|sync|event))?|teacher\/students(\/[\w-]+)?|health\/accounts)$/;

// ---------- base64url ----------
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function unb64url(s) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(t), c => c.charCodeAt(0));
}
const json64 = s => JSON.parse(new TextDecoder().decode(unb64url(s)));

// ---------- 驗證 Google ID token ----------
let jwksCache = { keys: null, until: 0 };
async function googleKeys(fetcher, now) {
  if (jwksCache.keys && now < jwksCache.until) return jwksCache.keys;
  const res = await fetcher(JWKS_URL);
  if (!res.ok) throw new Error('jwks');
  const { keys } = await res.json();
  const age = Number((res.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys, until: now + Math.min(age, 86400) * 1000 };
  return keys;
}
export function resetKeyCache() { jwksCache = { keys: null, until: 0 }; }

export async function verifyGoogleToken(token, clientId, { fetcher = fetch, now = Date.now() } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('format');
  const header = json64(parts[0]), claims = json64(parts[1]);
  if (header.alg !== 'RS256') throw new Error('alg');
  const jwk = (await googleKeys(fetcher, now)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('signature');
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw new Error('iss');
  if (claims.aud !== clientId) throw new Error('aud');
  if (!(claims.exp * 1000 > now - 60000)) throw new Error('exp');
  if (claims.email_verified !== true || !claims.email || !claims.sub) throw new Error('email');
  return { sub: String(claims.sub), email: String(claims.email).toLowerCase(), name: String(claims.name || '').slice(0, 80) };
}

// ---------- 本服務自己的登入憑證（HMAC） ----------
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function makeSession(sub, secret, now = Date.now()) {
  const body = b64url(enc.encode(JSON.stringify({ sub, exp: now + SESSION_DAYS * 86400000 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return body + '.' + b64url(sig);
}
export async function readSession(header, secret, now = Date.now()) {
  const m = String(header || '').match(/^Bearer ([\w-]+)\.([\w-]+)$/);
  if (!m) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(m[2]), enc.encode(m[1])); } catch { return null; }
  if (!ok) return null;
  const p = json64(m[1]);
  return p.exp > now ? p.sub : null;
}

const teacherList = env => String(env.TEACHER_EMAILS || '').split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const isTeacher = (env, email) => teacherList(env).includes(String(email).toLowerCase());

export function accountsReady(env) {
  if (!env.GOOGLE_CLIENT_ID) return 'GOOGLE_CLIENT_ID_MISSING';
  if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) return 'SESSION_SECRET_MISSING_OR_SHORT';
  if (!teacherList(env).length) return 'TEACHER_EMAILS_MISSING';
  if (!env.DB) return 'DB_BINDING_MISSING';
  return null;
}

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) { text += decoder.decode(); break; }
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('large'); }
    text += decoder.decode(value, { stream: true });
  }
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('shape');
  return data;
}

const cleanClass = v => String(v ?? '').replace(/\D/g, '').slice(0, 5);
const today = () => new Date().toISOString();

// ---------- 主程式 ----------
// reply(status, value) 由 worker.mjs 提供（已包含 CORS 標頭）
export async function handleAccounts(request, env, url, reply, { levels, fetcher = fetch } = {}) {
  const path = url.pathname, method = request.method;
  if (path === '/health/accounts' && method === 'GET') {
    const reason = accountsReady(env);
    if (reason) return reply(503, { ready: false, reason });
    try { await env.DB.prepare('SELECT id FROM users LIMIT 0').all(); }
    catch { return reply(503, { ready: false, reason: 'ACCOUNT_TABLES_MISSING' }); }
    return reply(200, { ready: true });
  }
  if (accountsReady(env)) return reply(503);
  const DB = env.DB;
  const progressOf = async id => (await DB.prepare(
    'SELECT level,best_stars,passed,in_review,pass_count,wrong_count,hint_count,last_at FROM progress WHERE user_id=?').bind(id).all()).results;
  const profile = (u, teacher) => ({ email: u.email, name: u.name, classNo: u.class_no, teacher });

  try {
    // 登入：用 Google 的 ID token 換取本服務的登入憑證
    if (path === '/auth/google' && method === 'POST') {
      let g;
      try { g = await verifyGoogleToken((await readJson(request)).credential, env.GOOGLE_CLIENT_ID, { fetcher }); }
      catch (e) { return reply(e.message === 'large' ? 413 : 401, { error: 'GOOGLE_TOKEN_INVALID' }); }
      const now = today();
      await DB.prepare(`INSERT INTO users (id,email,name,class_no,created_at,last_active) VALUES (?,?,?,'',?,?)
        ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name, last_active=excluded.last_active`)
        .bind(g.sub, g.email, g.name, now, now).run();
      const u = await DB.prepare('SELECT * FROM users WHERE id=?').bind(g.sub).first();
      return reply(200, { token: await makeSession(g.sub, env.SESSION_SECRET), user: profile(u, isTeacher(env, u.email)), progress: await progressOf(g.sub) });
    }

    const sub = await readSession(request.headers.get('Authorization'), env.SESSION_SECRET);
    if (!sub) return reply(401, { error: 'SIGNED_OUT' });
    const user = await DB.prepare('SELECT * FROM users WHERE id=?').bind(sub).first();
    if (!user) return reply(401, { error: 'SIGNED_OUT' });
    const teacher = isTeacher(env, user.email);

    if (path === '/me' && method === 'GET') return reply(200, { user: profile(user, teacher), progress: await progressOf(sub) });

    if (path === '/me' && method === 'DELETE') {
      await DB.prepare('DELETE FROM progress WHERE user_id=?').bind(sub).run();
      await DB.prepare('DELETE FROM users WHERE id=?').bind(sub).run();
      return reply(204);
    }

    // 合併整份進度（登入時，把手機上已有的進度送上來）
    if (path === '/me/sync' && method === 'POST') {
      const data = await readJson(request);
      const lv = data.levels && typeof data.levels === 'object' ? data.levels : {};
      const now = today();
      const stmts = [];
      for (const [id, v] of Object.entries(lv)) {
        if (!levels.has(id) || !v || typeof v !== 'object') return reply(400);
        const stars = Number(v.stars) || 0;
        if (!Number.isInteger(stars) || stars < 0 || stars > 3) return reply(400);
        stmts.push(DB.prepare(`INSERT INTO progress (user_id,level,best_stars,passed,in_review,last_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id,level) DO UPDATE SET best_stars=MAX(best_stars,excluded.best_stars),
          passed=MAX(passed,excluded.passed), in_review=excluded.in_review`)
          .bind(sub, id, stars, v.passed ? 1 : 0, v.review ? 1 : 0, now));
      }
      const cls = 'classNo' in data ? cleanClass(data.classNo) : user.class_no;
      stmts.push(DB.prepare('UPDATE users SET class_no=?, last_active=? WHERE id=?').bind(cls, now, sub));
      await DB.batch(stmts);
      return reply(200, { user: profile({ ...user, class_no: cls }, teacher), progress: await progressOf(sub) });
    }

    // 一次作答：wrong / hint / pass
    if (path === '/me/event' && method === 'POST') {
      const { level, kind, stars = 0, review = false } = await readJson(request);
      if (!levels.has(level) || !['wrong', 'hint', 'pass'].includes(kind)) return reply(400);
      if (!Number.isInteger(stars) || stars < 0 || stars > 3) return reply(400);
      const now = today();
      const p = kind === 'pass', w = kind === 'wrong' ? 1 : 0, h = kind === 'hint' ? 1 : 0;
      await DB.batch([
        DB.prepare(`INSERT INTO progress (user_id,level,best_stars,passed,in_review,pass_count,wrong_count,hint_count,last_at)
          VALUES (?,?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id,level) DO UPDATE SET
            best_stars = CASE WHEN ? THEN MAX(best_stars, excluded.best_stars) ELSE best_stars END,
            passed = MAX(passed, excluded.passed),
            in_review = CASE WHEN ? THEN excluded.in_review ELSE in_review END,
            pass_count = pass_count + excluded.pass_count,
            wrong_count = wrong_count + excluded.wrong_count,
            hint_count = hint_count + excluded.hint_count,
            last_at = excluded.last_at`)
          .bind(sub, level, p ? stars : 0, p ? 1 : 0, p && review ? 1 : 0, p ? 1 : 0, w, h, now, p ? 1 : 0, p ? 1 : 0),
        DB.prepare('UPDATE users SET last_active=? WHERE id=?').bind(now, sub),
      ]);
      return reply(204);
    }

    // ---------- 老師 ----------
    if (path.startsWith('/teacher/')) {
      if (!teacher) return reply(403, { error: 'NOT_TEACHER' });
      if (path === '/teacher/students' && method === 'GET') {
        const students = (await DB.prepare('SELECT id,email,name,class_no,created_at,last_active FROM users ORDER BY class_no,name').all()).results;
        const progress = (await DB.prepare('SELECT user_id,level,best_stars,passed,in_review,pass_count,wrong_count,hint_count,last_at FROM progress').all()).results;
        return reply(200, { students: students.map(s => ({ ...s, teacher: isTeacher(env, s.email) })), progress });
      }
      const m = path.match(/^\/teacher\/students\/([\w-]+)$/);
      if (m && method === 'DELETE') {
        await DB.prepare('DELETE FROM progress WHERE user_id=?').bind(m[1]).run();
        await DB.prepare('DELETE FROM users WHERE id=?').bind(m[1]).run();
        return reply(204);
      }
    }
    return reply(404);
  } catch (e) {
    if (e instanceof SyntaxError || ['empty', 'shape'].includes(e.message)) return reply(400);
    if (e.message === 'large') return reply(413);
    return reply(503);
  }
}
