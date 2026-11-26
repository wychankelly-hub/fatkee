// 老師頁：用 Google 登入，查看所有已登入學生的雲端進度。
import { account, renderGoogleButton } from './account.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = iso => {
  if (!iso) return '—';
  const d = new Date(iso), days = Math.floor((Date.now() - d) / 86400000);
  const rel = days <= 0 ? '今日' : days === 1 ? '昨日' : `${days} 日前`;
  return `${rel}<br><small class="muted">${d.toLocaleDateString('zh-HK')}</small>`;
};
const starStr = n => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;

export function initTeacherCloud(G) {
  const box = document.getElementById('cloud');
  const worlds = G.worlds.map(w => ({ ...w, levels: G.levels.filter(l => l.world === w.id) }));
  let data = null, view = { q: '', sort: 'class', open: null };

  if (!account.enabled) {
    box.innerHTML = `<div class="card"><b>Google 登入未啟用</b><p class="muted" style="margin:4px 0 0">
      設定 js/account-config.js 的 GOOGLE_CLIENT_ID 後，學生登入的進度會在這裏顯示。見 analytics/cloudflare/README.md。</p></div>`;
    return;
  }

  function signedOut(msg = '') {
    box.innerHTML = `<div class="card stack">
      <b>老師登入</b>
      <p class="muted" style="margin:0">用已登記為老師的 Google 帳戶登入，便可以看到所有已登入學生的進度。</p>
      ${msg ? `<p class="low" style="margin:0">${esc(msg)}</p>` : ''}
      <div id="gbtn" style="min-height:44px"></div></div>`;
    renderGoogleButton(document.getElementById('gbtn'), async credential => {
      try {
        const r = await account.signIn(credential);
        if (!r.user.teacher) return notTeacher();
        load();
      } catch { signedOut('登入失敗，請稍後再試。'); }
    });
  }

  function notTeacher() {
    const u = account.user;
    box.innerHTML = `<div class="card stack"><b>${esc(u.email)} 不是老師帳戶</b>
      <p class="muted" style="margin:0">只有加入了 TEACHER_EMAILS 的電郵可以查看學生記錄。</p>
      <button class="btn alt small" id="out1">登出，換另一個帳戶</button></div>`;
    document.getElementById('out1').onclick = () => { account.signOut(); signedOut(); };
  }

  async function load() {
    box.innerHTML = '<div class="card">載入學生記錄……</div>';
    try { data = await account.students(); }
    catch (e) {
      if (e.status === 403) return notTeacher();
      if (e.status === 401) return signedOut('登入已過期，請重新登入。');
      box.innerHTML = `<div class="card stack"><b class="low">未能載入學生記錄（${esc(e.message)}）</b>
        <button class="btn alt small" id="retry">再試</button></div>`;
      document.getElementById('retry').onclick = load;
      return;
    }
    render();
  }

  function summarize() {
    const by = new Map();
    for (const p of data.progress) {
      if (!by.has(p.user_id)) by.set(p.user_id, {});
      by.get(p.user_id)[p.level] = p;
    }
    return data.students.filter(s => !s.teacher).map(s => {
      const p = by.get(s.id) || {};
      const vals = Object.values(p);
      return {
        ...s, p,
        perWorld: worlds.map(w => w.levels.reduce((a, l) => a + (p[l.id]?.best_stars || 0), 0)),
        total: vals.reduce((a, x) => a + x.best_stars, 0),
        passed: vals.filter(x => x.passed).length,
        review: G.levels.filter(l => p[l.id]?.in_review).map(l => l.id),
        wrong: vals.reduce((a, x) => a + x.wrong_count, 0),
        hints: vals.reduce((a, x) => a + x.hint_count, 0),
      };
    });
  }

  function render() {
    const u = account.user;
    let rows = summarize();
    const all = rows;
    const q = view.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => [r.name, r.email, r.class_no].some(v => String(v).toLowerCase().includes(q)));
    const cmp = {
      class: (a, b) => String(a.class_no || '~').localeCompare(String(b.class_no || '~'), undefined, { numeric: true }) || a.name.localeCompare(b.name),
      total: (a, b) => b.total - a.total,
      low: (a, b) => a.total - b.total,
      recent: (a, b) => String(b.last_active).localeCompare(String(a.last_active)),
      wrong: (a, b) => b.wrong - a.wrong,
    }[view.sort];
    rows.sort(cmp);
    const max = G.levels.length;
    const head = `<tr><th>學號</th><th>學生</th>${worlds.map(w => `<th title="${esc(w.title)}">W${w.id}<br><small>/${w.levels.length * 3}</small></th>`).join('')}
      <th>總星數<br><small>/${max * 3}</small></th><th>過關<br><small>/${max}</small></th><th>錯題簿</th><th>答錯</th><th>提示</th><th>最近活動</th></tr>`;
    const body = rows.map(r => `<tr class="pick" data-id="${esc(r.id)}"><td>${esc(r.class_no) || '—'}</td>
      <td class="left"><b>${esc(r.name) || '—'}</b><br><small class="muted">${esc(r.email)}</small></td>
      ${r.perWorld.map((s, k) => `<td class="${worlds[k].levels.some(l => r.p[l.id]) && s < worlds[k].levels.length * 1.5 ? 'low' : ''}">${s}</td>`).join('')}
      <td><b>${r.total}</b></td><td>${r.passed}</td><td>${r.review.length || ''}</td><td>${r.wrong}</td><td>${r.hints}</td><td>${when(r.last_active)}</td></tr>`).join('');

    // 全班：平均星數最低、答錯最多的關卡
    const stat = G.levels.map(l => {
      const ps = all.map(r => r.p[l.id]).filter(Boolean);
      return { l, n: ps.filter(p => p.passed).length, avg: ps.length ? ps.reduce((a, p) => a + p.best_stars, 0) / ps.length : null,
        wrong: ps.reduce((a, p) => a + p.wrong_count, 0), review: ps.filter(p => p.in_review).length };
    }).filter(x => x.avg !== null);
    const hardest = [...stat].sort((a, b) => b.wrong - a.wrong || a.avg - b.avg).slice(0, 10);

    box.innerHTML = `
      <div class="card who"><span>已登入：<b>${esc(u.name || u.email)}</b> <small class="muted">${esc(u.email)}</small></span>
        <span class="tools"><button class="btn alt small" id="reload">重新整理</button><button class="btn ghost small" id="signout">登出</button></span></div>
      <h2 class="sec" style="margin-top:8px">已登入的學生（${all.length} 位）</h2>
      ${all.length ? `
      <div class="tools">
        <input class="field" id="q" placeholder="搜尋名稱、電郵或學號" value="${esc(view.q)}" autocomplete="off">
        <select id="sort" aria-label="排序">
          ${[['class', '按學號'], ['total', '總星數（高至低）'], ['low', '總星數（低至高）'], ['recent', '最近活動'], ['wrong', '答錯最多']].map(([v, t]) => `<option value="${v}" ${view.sort === v ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <button class="btn alt small" id="csv2">複製為 CSV</button>
      </div>
      <p class="muted" style="margin:0;font-size:13px">按一位學生查看每一關的詳細記錄。紅色數字：該世界已開始但星數偏低。</p>
      <div class="tbl-wrap"><table class="res"><thead>${head}</thead><tbody>${body || `<tr><td colspan="${worlds.length + 8}">沒有符合的學生</td></tr>`}</tbody></table></div>
      <div id="detail"></div>
      ${hardest.length ? `<h2 class="sec">全班最需要溫習的關卡</h2>
      <div class="tbl-wrap"><table class="res"><thead><tr><th>關卡</th><th>題目</th><th>做過的學生</th><th>平均星數</th><th>答錯總數</th><th>在錯題簿</th></tr></thead><tbody>
      ${hardest.map(h => `<tr><td>${h.l.id}</td><td class="left">${esc(h.l.title)}</td><td>${h.n}</td><td>${h.avg.toFixed(1)}</td><td>${h.wrong}</td><td>${h.review}</td></tr>`).join('')}
      </tbody></table></div>` : ''}`
      : '<div class="card">還沒有學生登入。學生在遊戲首頁按「用 Google 登入」後，便會出現在這裏。</div>'}`;

    document.getElementById('reload').onclick = load;
    document.getElementById('signout').onclick = () => { account.signOut(); data = null; signedOut(); };
    const qi = document.getElementById('q');
    if (qi) qi.oninput = () => { view.q = qi.value; render(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    const so = document.getElementById('sort');
    if (so) so.onchange = () => { view.sort = so.value; render(); };
    box.querySelectorAll('tr.pick').forEach(tr => tr.onclick = () => { view.open = tr.dataset.id; detail(all.find(r => r.id === view.open)); });
    const c2 = document.getElementById('csv2');
    if (c2) c2.onclick = () => copyCsv(rows);
    if (view.open) { const r = all.find(x => x.id === view.open); if (r) detail(r, false); }
  }

  function detail(r, scroll = true) {
    const el = document.getElementById('detail');
    el.innerHTML = `<div class="card stack" style="margin-top:12px">
      <div class="who"><span><b style="font-size:18px">${esc(r.name) || '—'}</b> <small class="muted">${esc(r.email)}</small>
        ${r.class_no ? ` · 學號 ${esc(r.class_no)}` : ''}<br><small class="muted">首次登入 ${new Date(r.created_at).toLocaleDateString('zh-HK')} · 總星數 ${r.total} · 過關 ${r.passed} / ${G.levels.length}</small></span>
        <span class="tools"><button class="btn ghost small" id="close">收起</button><button class="btn red small" id="del">刪除此學生的記錄</button></span></div>
      ${r.review.length ? `<div><b>錯題簿：</b>${r.review.join('、')}</div>` : ''}
      ${worlds.map(w => `<div><b>世界 ${w.id}：${esc(w.title)}</b>（${r.perWorld[w.id - 1]} / ${w.levels.length * 3} ★）
        <div class="lv-grid" style="margin-top:6px">${w.levels.map(l => {
          const p = r.p[l.id];
          if (!p) return `<div class="lv-cell todo"><b>${l.id}</b> ${esc(l.title)}<br><small>未做</small></div>`;
          return `<div class="lv-cell ${p.in_review ? 'rev' : ''} ${p.passed ? '' : 'todo'}"><b>${l.id}</b> ${esc(l.title)}<br>
            ${p.passed ? starStr(p.best_stars) : '<small>未過關</small>'}${p.in_review ? ' <span class="badge">錯題</span>' : ''}<br>
            <small class="muted">答錯 ${p.wrong_count} · 提示 ${p.hint_count} · 過關 ${p.pass_count} 次</small></div>`;
        }).join('')}</div></div>`).join('')}
    </div>`;
    document.getElementById('close').onclick = () => { view.open = null; el.innerHTML = ''; };
    document.getElementById('del').onclick = async () => {
      if (!confirm(`刪除 ${r.name || r.email} 的所有雲端記錄？這不能復原。學生下次登入時，會由他手機上的進度重新開始。`)) return;
      try { await account.deleteStudent(r.id); view.open = null; load(); }
      catch { alert('刪除失敗，請稍後再試。'); }
    };
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function copyCsv(rows) {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['學號,名稱,電郵,' + worlds.map(w => 'W' + w.id).join(',') + ',總星數,過關,錯題簿,答錯,提示,最近活動',
      ...rows.map(r => [q(r.class_no), q(r.name), q(r.email), ...r.perWorld, r.total, r.passed, q(r.review.join(' ')), r.wrong, r.hints, q(r.last_active)].join(','))].join('\n');
    try { await navigator.clipboard.writeText('﻿' + csv); alert('已複製，可以貼到 Excel。'); }
    catch { prompt('請複製以下內容：', csv); }
  }

  if (account.user) load(); else signedOut();
}
