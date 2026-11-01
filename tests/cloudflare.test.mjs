import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../analytics/cloudflare/worker.mjs';

test('Workers API enforces private reads, aggregate-only schema and bounded input', async t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../analytics/cloudflare/migrations/0001_totals.sql', import.meta.url), 'utf8'));
  const adapter = (sql, args = []) => ({
    bind: (...values) => adapter(sql, values),
    async run() { return db.prepare(sql).run(...args); },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  });
  const env = { DB: { prepare: sql => adapter(sql) }, ADMIN_TOKEN: 'a'.repeat(64), SITE_ORIGIN: 'https://wychankelly-hub.github.io' };
  const health = settings => worker.fetch(new Request('https://collector.example/health'), settings);
  assert.deepEqual(await (await health(env)).json(), { version: 'health-v1', ready: true });
  for (const [settings, reason] of [
    [{ ...env, SITE_ORIGIN: '' }, 'SITE_ORIGIN_MISSING'],
    [{ ...env, ADMIN_TOKEN: '' }, 'ADMIN_TOKEN_MISSING'],
    [{ ...env, ADMIN_TOKEN: 'short' }, 'ADMIN_TOKEN_TOO_SHORT'],
    [{ ...env, DB: undefined }, 'DB_BINDING_MISSING'],
    [{ ...env, DB: { prepare() { throw Error('sensitive error'); } } }, 'DATABASE_QUERY_FAILED'],
  ]) {
    const response = await health(settings);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { version: 'health-v1', ready: false, reason });
  }
  const request = (path, init = {}) => new Request('https://collector.example' + path, {
    ...init, headers: { Origin: env.SITE_ORIGIN, ...init.headers },
  });
  const post = data => worker.fetch(request('/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }), env);
  assert.equal((await worker.fetch(request('/stats'), env)).status, 401);
  assert.equal((await worker.fetch(request('/stats', { headers: { Origin: 'https://other.example' } }), env)).status, 403);
  assert.equal((await worker.fetch(request('/events', { method: 'OPTIONS' }), env)).status, 204);
  assert.equal((await worker.fetch(request('/stats'), { ...env, ADMIN_TOKEN: '' })).status, 503);
  for (const settings of [
    { ...env, ADMIN_TOKEN: '' },
    { ...env, ADMIN_TOKEN: 'short' },
    { ...env, DB: undefined },
  ]) {
    const preflight = await worker.fetch(request('/stats', {
      method: 'OPTIONS', headers: {
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    }), settings);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /Authorization/);
    const unavailable = await worker.fetch(request('/stats'), settings);
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('Access-Control-Allow-Origin'), env.SITE_ORIGIN);
    assert.equal((await worker.fetch(request('/stats', {
      method: 'OPTIONS', headers: { Origin: 'https://other.example' },
    }), settings)).status, 403);
  }
  for (const event of ['visit', 'visit', 'active', 'start', 'complete', 'wrong', 'hint']) {
    assert.equal((await post({ event, level: ['visit','active'].includes(event) ? '' : '1-1', seconds: event === 'active' ? 15 : 0 })).status, 204);
  }
  for (const invalid of [
    { event: 'visit', level: '', seconds: 0, student: '612' },
    { event: 'visit', level: '', seconds: 0, answer: 'SELECT *' },
    { event: 'start', level: 'unknown', seconds: 0 },
    { event: 'active', level: '', seconds: 31 },
    { event: 'active', level: '', seconds: 1.5 },
  ]) assert.equal((await post(invalid)).status, 400);
  assert.equal((await post({ text: 'a'.repeat(600) })).status, 413);
  const auth = { headers: { Authorization: 'Bearer ' + env.ADMIN_TOKEN } };
  assert.equal((await worker.fetch(request('/stats?days=365', auth), env)).status, 400);
  const response = await worker.fetch(request('/stats?days=7', auth), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const { rows } = await response.json();
  assert.equal(rows.find(row => row.event === 'visit').count, 2);
  assert.equal(rows.find(row => row.event === 'active').count, 15);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['count','day','event','level']);
  db.exec("INSERT INTO totals VALUES('2000-01-01','visit','',100)");
  await worker.scheduled({}, env);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM totals WHERE day='2000-01-01'").get().n, 0);
  const broken = { ...env, DB: { prepare() { throw Error('private internal error'); } } };
  const unavailable = await worker.fetch(request('/stats', auth), broken);
  assert.equal(unavailable.status, 503);
  assert.equal(await unavailable.text(), '');
});
