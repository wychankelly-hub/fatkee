import { ANALYTICS_URL } from './analytics-config.js';
const $ = s => document.querySelector(s);
const status = $('#status'), results = $('#results');
let pending;
$('#logout').onclick = () => {
  pending?.abort(); pending = null; $('#token').value = ''; results.hidden = true;
  $('#daily').replaceChildren(); $('#levels').replaceChildren(); $('#metrics').replaceChildren();
  status.textContent = '密鑰已清除。'; $('#refresh').disabled = false;
};
function row(target, values) {
  const tr = document.createElement('tr');
  for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
  target.append(tr);
}
$('#login').onsubmit = async e => {
  e.preventDefault();
  results.hidden = true;
  if (!ANALYTICS_URL) { status.textContent = '統計服務尚未設定。請參閱 analytics/README.md。'; return; }
  pending?.abort();
  const controller = new AbortController(); pending = controller;
  const timeout = setTimeout(() => controller.abort(), 10000);
  $('#refresh').disabled = true; status.textContent = '正在載入…';
  try {
    const response = await fetch(ANALYTICS_URL.replace(/\/$/, '') + '/stats?days=' + $('#days').value, {
      headers: { Authorization: 'Bearer ' + $('#token').value },
      credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal,
    });
    if (response.status === 401) throw new Error('密鑰不正確。');
    if (!response.ok) throw new Error('統計服務暫時無法使用。');
    const { rows } = await response.json();
    const days = {}, levels = {}, totals = {};
    for (const r of rows) {
      totals[r.event] = (totals[r.event] || 0) + r.count;
      const day = days[r.day] ||= {};
      day[r.event] = (day[r.event] || 0) + r.count;
      if (r.level) { const level = levels[r.level] ||= {}; level[r.event] = (level[r.event] || 0) + r.count; }
    }
    $('#metrics').replaceChildren();
    for (const [label, value] of [['訪問次數',totals.visit || 0],['活動分鐘',((totals.active || 0)/60).toFixed(1)],['開始關卡',totals.start || 0],['過關次數',totals.complete || 0]]) {
      const card = document.createElement('div'); card.className = 'card';
      const strong = document.createElement('strong'); strong.textContent = value;
      card.append(label, strong); $('#metrics').append(card);
    }
    $('#daily').replaceChildren(); $('#levels').replaceChildren();
    for (const [date, d] of Object.entries(days).sort()) row($('#daily'), [date,d.visit || 0,((d.active || 0)/60).toFixed(1),d.complete || 0]);
    for (const [id, l] of Object.entries(levels).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}))) {
      row($('#levels'), [id,l.start || 0,l.complete || 0,l.start ? ((l.complete || 0)/l.start*100).toFixed(1)+'%' : '—',l.wrong || 0,l.hint || 0]);
    }
    results.hidden = false; status.textContent = rows.length ? '已更新統計。' : '此期間尚未收到統計資料。';
  } catch (error) {
    if (pending === controller) status.textContent = error.name === 'AbortError' ? '連線已取消或逾時，請重試。' : error.message;
  } finally { clearTimeout(timeout); if (pending === controller) $('#refresh').disabled = false; }
};
if (!ANALYTICS_URL) status.textContent = '統計服務尚未設定。';
