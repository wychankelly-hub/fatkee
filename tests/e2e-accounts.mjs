// 瀏覽器測試：Google 登入、雲端進度、老師面板。
// Google 的登入按鈕及 Cloudflare Worker 都以假資料代替，不需要真的帳戶。
// 先在專案根目錄執行 python3 -m http.server 8123，再執行 node tests/e2e-accounts.mjs [截圖資料夾]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.argv[2] || 'tests/shots';
mkdirSync(OUT, { recursive: true });
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('✘', msg); } else console.log('✔', msg); };

// ---------- 假的 Worker（記憶體內） ----------
const API = 'https://worker.test';
const users = new Map(), progress = new Map(), events = [];
const TEACHERS = ['teacher@school.hk'];
let nextLogin = { sub: 'stu1', email: 'student@gmail.com', name: '陳小明' };
const row = (uid, lv) => {
  const k = uid + '|' + lv;
  if (!progress.has(k)) progress.set(k, { user_id: uid, level: lv, best_stars: 0, passed: 0, in_review: 0, pass_count: 0, wrong_count: 0, hint_count: 0, last_at: new Date().toISOString() });
  return progress.get(k);
};
const mine = uid => [...progress.values()].filter(p => p.user_id === uid);
const prof = u => ({ email: u.email, name: u.name, classNo: u.class_no, teacher: TEACHERS.includes(u.email) });

async function fakeApi(route) {
  const req = route.request(), url = new URL(req.url()), body = req.postData() ? JSON.parse(req.postData()) : null;
  const send = (status, data) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }, body: data === undefined ? '' : JSON.stringify(data) });
  if (req.method() === 'OPTIONS') return send(204);
  if (url.pathname === '/events') return send(204);
  if (url.pathname === '/auth/google') {
    const g = nextLogin;
    if (!users.has(g.sub)) users.set(g.sub, { id: g.sub, email: g.email, name: g.name, class_no: '', created_at: new Date().toISOString(), last_active: new Date().toISOString() });
    return send(200, { token: 'tok-' + g.sub, user: prof(users.get(g.sub)), progress: mine(g.sub) });
  }
  const uid = (req.headers().authorization || '').replace('Bearer tok-', '');
  const u = users.get(uid);
  if (!u) return send(401, { error: 'SIGNED_OUT' });
  if (url.pathname === '/me' && req.method() === 'GET') return send(200, { user: prof(u), progress: mine(uid) });
  if (url.pathname === '/me/sync') {
    for (const [lv, v] of Object.entries(body.levels)) { const r = row(uid, lv); r.best_stars = Math.max(r.best_stars, v.stars); r.passed = Math.max(r.passed, v.passed ? 1 : 0); r.in_review = v.review ? 1 : 0; }
    if ('classNo' in body) u.class_no = body.classNo;
    return send(200, { user: prof(u), progress: mine(uid) });
  }
  if (url.pathname === '/me/event') {
    events.push(body);
    const r = row(uid, body.level);
    if (body.kind === 'wrong') r.wrong_count++;
    if (body.kind === 'hint') r.hint_count++;
    if (body.kind === 'pass') { r.best_stars = Math.max(r.best_stars, body.stars); r.passed = 1; r.pass_count++; r.in_review = body.review ? 1 : 0; }
    return send(204);
  }
  if (url.pathname === '/teacher/students') {
    if (!TEACHERS.includes(u.email)) return send(403, { error: 'NOT_TEACHER' });
    return send(200, { students: [...users.values()].map(x => ({ ...x, teacher: TEACHERS.includes(x.email) })), progress: [...progress.values()] });
  }
  return send(404);
}

// 假的 Google Identity Services：按鈕一按便「登入」
const FAKE_GIS = `window.google = { accounts: { id: {
  initialize(o) { this.cb = o.callback; },
  renderButton(el) { const b = document.createElement('button'); b.className = 'fake-google'; b.textContent = '使用 Google 帳戶登入'; b.onclick = () => this.cb({ credential: 'fake.jwt.token' }); el.appendChild(b); },
  disableAutoSelect() {},
} } };`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], serviceWorkers: 'block' });
await ctx.route('**/js/account-config.js', r => r.fulfill({ contentType: 'text/javascript', body: `export const GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com'; export const ACCOUNT_URL = '${API}';` }));
await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
await ctx.route(API + '/**', fakeApi);
await ctx.route('https://fatkee-usage.wychan-kelly.workers.dev/**', r => r.fulfill({ status: 204 }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shot = n => page.screenshot({ path: `${OUT}/acct-${n}.png`, fullPage: false });

// 1. 未登入先玩一關（本機進度）
await page.goto(BASE + '#/home');
await page.waitForSelector('.home-hero');
check(await page.isVisible('#acct .fake-google'), '首頁顯示 Google 登入按鈕');
await shot('01-home-signed-out');
await page.evaluate(() => { window.__game.S.passed['1-1'] = true; location.hash = '#/level/1-2'; });
await page.waitForSelector('#ed');
await page.fill('#ed', "SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK'");
await page.click('[data-act="submit"]');
await page.waitForSelector('.fb-title.ok');
check(events.length === 0, '未登入時不會上載');

// 2. 登入 → 本機進度合併到雲端
await page.goto(BASE + '#/home');
await page.click('#acct .fake-google');
await page.waitForSelector('#acct:has-text("已登入")');
await shot('02-home-signed-in');
await page.waitForTimeout(300);
check(progress.get('stu1|1-2')?.best_stars === 3, '登入後本機進度送到雲端');

// 3. 登入後作答：答錯、提示、過關都記錄
await page.evaluate(() => { window.__game.S.passed['1-3'] = true; location.hash = '#/level/1-4'; });
await page.waitForSelector('#ed');
await page.fill('#ed', 'SELECT IID FROM ITEM');
await page.click('[data-act="submit"]');
await page.waitForSelector('.fb-title.bad');
await page.click('#sheet [data-act="close"]');
await page.click('[data-act="hint"]'); await page.click('#sheet [data-act="ok"]');
await page.fill('#ed', "SELECT IID, ENAME FROM ITEM WHERE PRICE < 40 AND (CAT = 'NOODLE' OR CAT = 'RICE')");
await page.click('[data-act="submit"]');
await page.waitForSelector('.fb-title.ok');
await page.waitForTimeout(400);
const r14 = progress.get('stu1|1-4');
check(r14 && r14.wrong_count === 1 && r14.hint_count === 1 && r14.best_stars === 2 && r14.passed === 1, '答錯、提示及星數已上載');
check(events.every(e => Object.keys(e).every(k => ['level', 'kind', 'stars', 'review'].includes(k))), '上載內容不包含 SQL');

// 4. 設定頁：學號同步、登出
await page.goto(BASE + '#/code');
await page.fill('#cls', '612');
await page.click('[data-act="savecls"]');
await page.waitForTimeout(300);
check(users.get('stu1').class_no === '612', '學號同步到雲端');
await page.goto(BASE + '#/settings');
await page.waitForSelector('#acct [data-act="signout"]');
await shot('03-settings');

// 5. 換一部「新手機」登入：雲端進度下載
const ctx2 = await browser.newContext({ ...devices['iPhone SE'], viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });
for (const [p, h] of [['**/js/account-config.js', r => r.fulfill({ contentType: 'text/javascript', body: `export const GOOGLE_CLIENT_ID = 'x'; export const ACCOUNT_URL = '${API}';` })],
  ['https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS })], [API + '/**', fakeApi],
  ['https://fatkee-usage.wychan-kelly.workers.dev/**', r => r.fulfill({ status: 204 })]]) await ctx2.route(p, h);
const p2 = await ctx2.newPage();
await p2.goto(BASE + '#/home');
await p2.click('#acct .fake-google');
await p2.waitForSelector('#acct:has-text("已登入")');
await p2.waitForTimeout(300);
const s2 = await p2.evaluate(() => window.__game.S);
check(s2.stars['1-4'] === 2 && s2.stars['1-2'] === 3 && s2.classNo === '612', '新手機登入後取回雲端進度及學號');
const w = await p2.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
check(w[0] <= 375, '375 寬首頁沒有橫向捲動（已登入）');

// 6. 老師頁：學生帳戶看不到；老師帳戶看到全部
await page.goto(BASE + 'teacher.html');
await page.waitForSelector('#cloud');
check(await page.isVisible('#cloud:has-text("不是老師帳戶")'), '學生帳戶打開老師頁 → 拒絕');
await page.click('#out1');
nextLogin = { sub: 'tch1', email: 'teacher@school.hk', name: '黃老師' };
await page.click('#cloud .fake-google');
await page.waitForSelector('#cloud table');
const txt = await page.textContent('#cloud');
check(txt.includes('陳小明') && txt.includes('612') && txt.includes('已登入的學生（1 位）'), '老師看到學生（不包括老師自己）');
await page.setViewportSize({ width: 1200, height: 900 });
await shot('04-teacher');
await page.click('#cloud tr.pick');
await page.waitForSelector('#detail .lv-grid');
check((await page.textContent('#detail')).includes('答錯 1 · 提示 1'), '學生詳細記錄');
await shot('05-teacher-detail');
await page.fill('#q', 'nobody');
check((await page.textContent('#cloud')).includes('沒有符合的學生'), '搜尋');

check(errors.length === 0, '沒有 JS 錯誤 ' + errors.join(' | '));
await browser.close();
console.log(failures.length ? `\n${failures.length} 項失敗` : '\n全部通過');
process.exit(failures.length ? 1 : 0);
