// 老師頁：分析多個進度碼
import { decode } from './progress.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const G = await fetch('levels.json').then(r => r.json());
const worlds = G.worlds.map(w => ({ ...w, idx: G.levels.map((l, i) => l.world === w.id ? i : -1).filter(i => i >= 0) }));
let csv = '';

document.getElementById('go').onclick = () => {
  const lines = document.getElementById('codes').value.split(/\n/).map(s => s.trim()).filter(Boolean);
  const rows = [], bad = [];
  for (const line of lines) {
    const d = decode(line);
    if (!d) { bad.push(line); continue; }
    const perWorld = worlds.map(w => w.idx.reduce((a, i) => a + d.stars[i], 0));
    // 0 星關卡：同一世界中，後面已有星數的關卡之前的 0 星關卡（即看了答案才過關）
    const weak = [], todo = [];
    for (const w of worlds) {
      const last = w.idx.map(i => d.stars[i] > 0).lastIndexOf(true);
      w.idx.forEach((i, k) => { if (d.stars[i] === 0) (k < last ? weak : todo).push(G.levels[i].id); });
    }
    rows.push({ cls: d.classNo || '', perWorld, total: d.stars.reduce((a, b) => a + b, 0), weak, todo: todo.length, ones: G.levels.filter((l, i) => d.stars[i] === 1).map(l => l.id) });
  }
  rows.sort((a, b) => String(a.cls).localeCompare(String(b.cls), undefined, { numeric: true }));
  const max = G.levels.length * 3;
  const head = `<tr><th>學號</th>${worlds.map(w => `<th title="${esc(w.title)}">W${w.id}<br><small>/${w.idx.length * 3}</small></th>`).join('')}<th>總星數<br><small>/${max}</small></th><th>未完成</th><th>0 星（看了答案）</th><th>1 星</th></tr>`;
  const body = rows.map(r => `<tr><td>${esc(r.cls) || '—'}</td>${r.perWorld.map((s, k) => `<td class="${s < worlds[k].idx.length * 1.5 ? 'low' : ''}">${s}</td>`).join('')}
    <td><b>${r.total}</b></td><td>${r.todo}</td><td class="left">${r.weak.join('、') || '—'}</td><td class="left">${r.ones.join('、') || '—'}</td></tr>`).join('');
  // 全班每關平均星數
  const valid = lines.map(decode).filter(Boolean);
  const avg = G.levels.map((l, i) => ({ id: l.id, title: l.title, a: valid.length ? valid.reduce((s, d) => s + d.stars[i], 0) / valid.length : 0 }));
  const hardest = [...avg].sort((x, y) => x.a - y.a).slice(0, 8);
  document.getElementById('out').innerHTML = `
    ${bad.length ? `<div class="card" style="border-color:var(--red)"><b class="low">以下 ${bad.length} 個進度碼無效：</b><br><code>${bad.map(esc).join('<br>')}</code></div>` : ''}
    <p><b>${rows.length}</b> 位學生</p>
    <div class="tbl-wrap"><table class="res"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    ${rows.length ? `<h2 class="sec">全班平均星數最低的關卡</h2>
    <div class="tbl-wrap"><table class="res"><thead><tr><th>關卡</th><th>題目</th><th>平均星數</th></tr></thead><tbody>
    ${hardest.map(h => `<tr><td>${h.id}</td><td class="left">${esc(h.title)}</td><td>${h.a.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  csv = ['學號,' + worlds.map(w => 'W' + w.id).join(',') + ',總星數,未完成,0星關卡,1星關卡',
    ...rows.map(r => [r.cls, ...r.perWorld, r.total, r.todo, r.weak.join(' '), r.ones.join(' ')].join(','))].join('\n');
  document.getElementById('csv').disabled = !rows.length;
};

document.getElementById('csv').onclick = async () => {
  try { await navigator.clipboard.writeText(csv); alert('已複製，可以貼到 Excel。'); }
  catch (e) { prompt('請複製以下內容：', csv); }
};
