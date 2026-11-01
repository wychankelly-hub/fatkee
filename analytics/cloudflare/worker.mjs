import game from '../../levels.json' with { type: 'json' };

const levels = new Set(game.levels.map(level => level.id));
let minute = 0, requests = 0;
async function authorized(header, token) {
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(header || ''), digest('Bearer ' + token)]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > 512) { await reader.cancel(); throw new Error('large'); }
    text += decoder.decode(value, { stream: true });
  }
}
export default {
  async fetch(request, env) {
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
    };
    const reply = (status, value) => new Response(value === undefined ? null : JSON.stringify(value), {
      status, headers: value === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    });
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32 || !env.DB || !env.SITE_ORIGIN) return reply(503);
    if (request.headers.get('Origin') !== env.SITE_ORIGIN) return reply(403);
    Object.assign(headers, {
      'Access-Control-Allow-Origin': env.SITE_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    if (request.method === 'OPTIONS') return reply(204);
    const url = new URL(request.url);
    if (url.pathname === '/stats' && request.method === 'GET') {
      if (!await authorized(request.headers.get('Authorization'), env.ADMIN_TOKEN)) return reply(401);
      const days = Number(url.searchParams.get('days') || 7);
      if (![7, 30, 90].includes(days)) return reply(400);
      const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      try {
        const { results: rows } = await env.DB.prepare('SELECT * FROM totals WHERE day >= ? ORDER BY day,level,event').bind(since).all();
        return reply(200, { rows, days, timezone: 'UTC' });
      } catch { return reply(503); }
    }
    if (url.pathname !== '/events' || request.method !== 'POST') return reply(404);
    // Best-effort per-isolate cap; no IP addresses or visitor identifiers are retained.
    const current = Math.floor(Date.now() / 60000);
    if (current !== minute) { minute = current; requests = 0; }
    if (++requests > 6000) return reply(429);
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return reply(415);
    let data;
    try { data = JSON.parse(await readBody(request)); }
    catch (error) { return reply(error.message === 'large' ? 413 : 400); }
    if (!data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'event,level,seconds') return reply(400);
    const { event, level, seconds } = data;
    if (!['visit', 'active', 'start', 'complete', 'wrong', 'hint'].includes(event)) return reply(400);
    if (['visit', 'active'].includes(event) ? level !== '' : !levels.has(level)) return reply(400);
    if (event === 'active' ? !Number.isInteger(seconds) || seconds < 1 || seconds > 30 : seconds !== 0) return reply(400);
    try {
      await env.DB.prepare('INSERT INTO totals VALUES(?,?,?,?) ON CONFLICT(day,event,level) DO UPDATE SET count=count+excluded.count')
        .bind(new Date().toISOString().slice(0, 10), event, level, event === 'active' ? seconds : 1).run();
      return reply(204);
    } catch { return reply(503); }
  },
  async scheduled(_controller, env) {
    await env.DB.prepare("DELETE FROM totals WHERE day < date('now', '-89 days')").run();
  },
};
