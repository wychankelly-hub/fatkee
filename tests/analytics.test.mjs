import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollector } from '../analytics/server.mjs';
import { createAnalytics } from '../js/analytics.js';

test('client sends allowlisted counters, suppresses privacy/offline errors and hidden time', async () => {
  const sent = []; let now = 0, allowed = true, visible = true;
  const tracker = createAnalytics({endpoint:'https://collector.example', fetcher: (url, options) => {
    sent.push({url,...options}); return Promise.reject(new Error('offline'));
  }, allowed:()=>allowed, visible:()=>visible, now:()=>now});
  tracker.start(); tracker.start();
  tracker.event('start','1-1'); now = 15000; tracker.tick();
  visible = false; now = 30000; tracker.tick();
  allowed = false; tracker.event('wrong','1-1');
  await Promise.resolve();
  assert.equal(sent.length,3);
  assert.deepEqual(JSON.parse(sent[2].body),{event:'active',level:'',seconds:15});
  assert.equal(sent[0].credentials,'omit');
  assert.equal(sent[0].referrerPolicy,'no-referrer');
  const disabled = createAnalytics({endpoint:'',fetcher:()=>assert.fail(),allowed:()=>true,visible:()=>true,now:()=>0});
  disabled.start(); disabled.event('visit');
});

test('collector authenticates reads, aggregates, validates and rejects personal fields', async t => {
  const token = 'a'.repeat(64), origin = 'https://wychankelly-hub.github.io';
  const server = createCollector({token,origin});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base = 'http://127.0.0.1:'+server.address().port;
  const post = data => fetch(base+'/events',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const stats = (auth = token, days = 7) => fetch(base+'/stats?days='+days,{headers:{Origin:origin,Authorization:'Bearer '+auth}});
  assert.equal((await stats('wrong')).status,401);
  assert.equal((await fetch(base+'/stats')).status,403);
  assert.equal((await post({event:'visit',level:'',seconds:0})).status,204);
  assert.equal((await post({event:'visit',level:'',seconds:0})).status,204);
  assert.equal((await post({event:'active',level:'',seconds:15})).status,204);
  assert.equal((await post({event:'start',level:'1-1',seconds:0})).status,204);
  for (const event of ['complete','wrong','hint']) assert.equal((await post({event,level:'1-1',seconds:0})).status,204);
  assert.equal((await post({event:'start',level:'unknown',seconds:0})).status,400);
  assert.equal((await post({event:'active',level:'',seconds:999})).status,400);
  assert.equal((await post({event:'visit',level:'',seconds:0,student:'612'})).status,400);
  assert.equal((await post({event:'visit',level:'',seconds:0,answer:'SELECT *'})).status,400);
  assert.equal((await stats(token,365)).status,400);
  const response = await stats();
  assert.equal(response.headers.get('cache-control'),'no-store');
  const data = await response.json();
  assert.equal(data.rows.find(r=>r.event==='visit').count,2);
  assert.equal(data.rows.find(r=>r.event==='active').count,15);
  assert.deepEqual(Object.keys(data.rows[0]).sort(),['count','day','event','level']);
});
