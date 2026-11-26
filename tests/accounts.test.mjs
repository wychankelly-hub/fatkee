// Google 登入及老師面板的 Worker API 測試。用自己生成的 RSA 金鑰模擬 Google 的簽名。
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../analytics/cloudflare/worker.mjs';
import { resetKeyCache, makeSession, readSession } from '../analytics/cloudflare/accounts.mjs';

const ORIGIN = 'https://wychankelly-hub.github.io';
const CLIENT = 'test-client.apps.googleusercontent.com';
const b64url = buf => Buffer.from(buf).toString('base64url');

const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const other = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);

async function googleToken(claims, key = privateKey, kid = 'k1') {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    iss: 'https://accounts.google.com', aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 3600,
    email_verified: true, ...claims,
  }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body));
  return head + '.' + body + '.' + b64url(sig);
}

function setup(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  for (const f of ['0001_totals.sql', '0002_accounts.sql'])
    db.exec(readFileSync(new URL('../analytics/cloudflare/migrations/' + f, import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...values) => stmt(sql, values),
    async run() { return db.prepare(sql).run(...args); },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
  });
  const DB = { prepare: sql => stmt(sql), async batch(list) { for (const s of list) await s.run(); } };
  const env = {
    DB, SITE_ORIGIN: ORIGIN, ADMIN_TOKEN: 'a'.repeat(64), GOOGLE_CLIENT_ID: CLIENT,
    SESSION_SECRET: 's'.repeat(40), TEACHER_EMAILS: 'Teacher@School.edu.hk, second@gmail.com',
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://www.googleapis.com/oauth2/v3/certs');
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Cache-Control': 'max-age=600' } });
  };
  resetKeyCache();
  t.after(() => { globalThis.fetch = realFetch; });
  const call = (path, { method = 'GET', body, token, origin = ORIGIN } = {}) => worker.fetch(new Request('https://collector.example' + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { Origin: origin, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  }), env);
  const login = async claims => (await call('/auth/google', { method: 'POST', body: { credential: await googleToken(claims) } })).json();
  return { db, env, call, login };
}

test('accounts health reports missing configuration without secrets', async t => {
  const { env } = setup(t);
  const health = e => worker.fetch(new Request('https://collector.example/health/accounts'), e);
  assert.deepEqual(await (await health(env)).json(), { ready: true });
  for (const [e, reason] of [
    [{ ...env, GOOGLE_CLIENT_ID: '' }, 'GOOGLE_CLIENT_ID_MISSING'],
    [{ ...env, SESSION_SECRET: 'short' }, 'SESSION_SECRET_MISSING_OR_SHORT'],
    [{ ...env, TEACHER_EMAILS: '' }, 'TEACHER_EMAILS_MISSING'],
  ]) {
    const r = await health(e);
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { ready: false, reason });
  }
});

test('Google sign-in rejects forged, expired or wrong-audience tokens', async t => {
  const { call } = setup(t);
  const tryToken = async credential => (await call('/auth/google', { method: 'POST', body: { credential } })).status;
  assert.equal(await tryToken('not-a-jwt'), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com' }, other.privateKey)), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com', aud: 'other' })), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com', exp: 1000 })), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com', iss: 'https://evil.example' })), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com', email_verified: false })), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com' }, privateKey, 'unknown')), 401);
  assert.equal(await tryToken(await googleToken({ sub: '1', email: 'a@gmail.com' })), 200);
  // 其他網站不可以使用
  assert.equal((await call('/auth/google', { method: 'POST', body: {}, origin: 'https://evil.example' })).status, 403);
});

test('students save progress; only teachers read everyone', async t => {
  const { call, login } = setup(t);
  const s = await login({ sub: 'stu1', email: 'Student@Gmail.com', name: '陳同學' });
  assert.equal(s.user.teacher, false);
  assert.equal(s.user.email, 'student@gmail.com');
  assert.deepEqual(s.progress, []);
  const token = s.token;

  // 未登入
  assert.equal((await call('/me')).status, 401);
  assert.equal((await call('/me', { token: token + 'x' })).status, 401);

  // 合併手機上的進度
  let r = await call('/me/sync', { method: 'POST', token, body: { classNo: '6A12', levels: { '1-1': { stars: 3, passed: true }, '1-2': { stars: 1, passed: true, review: true } } } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.classNo, '612');
  assert.equal((await call('/me/sync', { method: 'POST', token, body: { levels: { '9-99': { stars: 3 } } } })).status, 400);
  assert.equal((await call('/me/sync', { method: 'POST', token, body: { levels: { '1-1': { stars: 7 } } } })).status, 400);
  // 較低的星數不會蓋過較高的
  await call('/me/sync', { method: 'POST', token, body: { levels: { '1-1': { stars: 1, passed: true } } } });

  // 作答事件
  for (const kind of ['wrong', 'wrong', 'hint']) assert.equal((await call('/me/event', { method: 'POST', token, body: { level: '1-4', kind } })).status, 204);
  assert.equal((await call('/me/event', { method: 'POST', token, body: { level: '1-4', kind: 'pass', stars: 2, review: false } })).status, 204);
  assert.equal((await call('/me/event', { method: 'POST', token, body: { level: '1-4', kind: 'pass', stars: 0, review: true } })).status, 204);
  assert.equal((await call('/me/event', { method: 'POST', token, body: { level: '1-4', kind: 'cheat' } })).status, 400);
  assert.equal((await call('/me/event', { method: 'POST', token, body: { level: '1-4', kind: 'pass', stars: 9 } })).status, 400);
  assert.equal((await call('/me/event', { method: 'POST', token, body: 'x'.repeat(20000) })).status, 413);

  const me = await (await call('/me', { token })).json();
  const p = Object.fromEntries(me.progress.map(x => [x.level, x]));
  assert.equal(p['1-1'].best_stars, 3);
  assert.equal(p['1-2'].in_review, 1);
  assert.deepEqual([p['1-4'].best_stars, p['1-4'].passed, p['1-4'].in_review, p['1-4'].wrong_count, p['1-4'].hint_count, p['1-4'].pass_count], [2, 1, 1, 2, 1, 2]);

  // 學生不可以看全班
  assert.equal((await call('/teacher/students', { token })).status, 403);

  // 老師（電郵大小寫不同也可以）
  const tch = await login({ sub: 'tch1', email: 'teacher@school.edu.hk', name: '黃老師' });
  assert.equal(tch.user.teacher, true);
  const all = await (await call('/teacher/students', { token: tch.token })).json();
  const stu = all.students.find(x => x.id === 'stu1');
  assert.equal(stu.name, '陳同學');
  assert.equal(stu.class_no, '612');
  assert.equal(all.students.find(x => x.id === 'tch1').teacher, true);
  assert.equal(all.progress.filter(x => x.user_id === 'stu1').length, 3);

  // 老師刪除一位學生
  assert.equal((await call('/teacher/students/stu1', { method: 'DELETE', token: tch.token })).status, 204);
  assert.equal((await call('/me', { token })).status, 401);
  assert.equal((await (await call('/teacher/students', { token: tch.token })).json()).progress.length, 0);
});

test('students can delete their own cloud record', async t => {
  const { call, login } = setup(t);
  const s = await login({ sub: 'stu2', email: 'b@gmail.com', name: 'B' });
  await call('/me/event', { method: 'POST', token: s.token, body: { level: '2-1', kind: 'pass', stars: 3 } });
  assert.equal((await call('/me', { method: 'DELETE', token: s.token })).status, 204);
  const again = await login({ sub: 'stu2', email: 'b@gmail.com', name: 'B' });
  assert.deepEqual(again.progress, []);
});

test('session tokens expire and cannot be altered', async () => {
  const secret = 'x'.repeat(40);
  const tok = await makeSession('abc', secret, 0);
  assert.equal(await readSession('Bearer ' + tok, secret, 1000), 'abc');
  assert.equal(await readSession('Bearer ' + tok, secret, 31 * 86400000), null);
  assert.equal(await readSession('Bearer ' + tok, 'y'.repeat(40), 1000), null);
  const [body, sig] = tok.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'teacher', exp: 9e15 })).toString('base64url');
  assert.equal(await readSession('Bearer ' + forged + '.' + sig, secret, 1000), null);
  assert.equal(await readSession('Bearer ' + body, secret, 1000), null);
});
