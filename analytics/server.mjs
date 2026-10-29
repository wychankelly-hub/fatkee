import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function createCollector({ token, origin, database = ':memory:' }) {
  if (!token || token.length < 32) throw new Error('ADMIN_TOKEN must contain at least 32 characters');
  if (!origin || new URL(origin).origin !== origin) throw new Error('SITE_ORIGIN must be an exact origin');
  const levels = new Set(JSON.parse(readFileSync(new URL('../levels.json', import.meta.url))).levels.map(l => l.id));
  const db = new DatabaseSync(database);
  db.exec('CREATE TABLE IF NOT EXISTS totals(day TEXT, event TEXT, level TEXT, count INTEGER NOT NULL, PRIMARY KEY(day,event,level))');
  const add = db.prepare('INSERT INTO totals VALUES(?,?,?,?) ON CONFLICT(day,event,level) DO UPDATE SET count=count+excluded.count');
  const hash = s => createHash('sha256').update(s).digest();
  const authorized = header => timingSafeEqual(hash(header || ''), hash('Bearer ' + token));
  let budget = 0, minute = 0;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    if (req.headers.origin !== origin) { res.writeHead(403).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/stats' && req.method === 'GET') {
      if (!authorized(req.headers.authorization)) { res.writeHead(401).end(); return; }
      const days = Number(url.searchParams.get('days') || 7);
      if (![7, 30, 90].includes(days)) { res.writeHead(400).end(); return; }
      const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0,10);
      const rows = db.prepare('SELECT * FROM totals WHERE day >= ? ORDER BY day,level,event').all(since);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ rows, days, timezone: 'UTC' })); return;
    }
    if (url.pathname !== '/events' || req.method !== 'POST') { res.writeHead(404).end(); return; }
    const currentMinute = Math.floor(Date.now()/60000);
    if (minute !== currentMinute) { minute = currentMinute; budget = 0; }
    if (++budget > 6000) { res.writeHead(429).end(); return; }
    if (!(req.headers['content-type'] || '').startsWith('application/json')) { res.writeHead(415).end(); return; }
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 512) { res.writeHead(413).end(); return; }
      }
      const data = JSON.parse(body);
      if (!data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'event,level,seconds') throw new Error();
      const { event, level, seconds } = data;
      if (!['visit','active','start','complete','wrong','hint'].includes(event)) throw new Error();
      if (['visit','active'].includes(event) ? level !== '' : !levels.has(level)) throw new Error();
      if (event === 'active' ? !Number.isInteger(seconds) || seconds < 1 || seconds > 30 : seconds !== 0) throw new Error();
      const day = new Date().toISOString().slice(0,10);
      // Store only daily counters. Never persist request headers, IPs or event records.
      add.run(day, event, level, event === 'active' ? seconds : 1);
      db.prepare("DELETE FROM totals WHERE day < date('now', '-89 days')").run();
      res.writeHead(204).end();
    } catch { res.writeHead(400).end(); }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCollector({
    token: process.env.ADMIN_TOKEN, origin: process.env.SITE_ORIGIN,
    database: process.env.ANALYTICS_DB || 'analytics.sqlite',
  });
  server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1');
}
