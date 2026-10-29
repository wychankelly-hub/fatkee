import { usage, statisticsEnabled, setStatisticsEnabled } from './analytics.js';
// 發記冰室數據大危機：主程式（畫面、關卡、進度）
import { Checker, preprocess } from './checker.js';
import { encode, decode } from './progress.js';
import { TABLE_INFO, KEYWORDS, SYMBOLS, EMOJI, REVEAL } from './content-ui.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let G;           // levels.json
let CK;          // Checker
let LV = {};     // id → level
let byWorld = {};

// ---------- 儲存（localStorage 可能被封鎖，全部包 try/catch） ----------
const KEY = 'fatkee.v1';
const S = Object.assign({
  stars: {}, passed: {}, review: {}, seenPrologue: false, chips: false, classNo: '',
  a2hs: false, lastLevel: null,
}, load());
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 私密瀏覽 */ } }

// ---------- 小工具 ----------
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.hidden = true; }, ms);
}
const starStr = (n, max = 3) => `<span class="stars" aria-label="${n} 星">${'★'.repeat(n)}<span class="off">${'★'.repeat(Math.max(max - n, 0))}</span></span>`;
const go = h => { if (location.hash === h) route(); else location.hash = h; };
const TYPE_NAME = { write: '寫 SQL', order: '排列 SQL', predict: '推算結果', bug: '找出錯處', mc: '概念題' };
const isNum = v => typeof v === 'number';

function tableHTML(res, cap = true) {
  if (!res) return '';
  if (!res.columns.length) return '<p class="muted">（沒有結果欄位）</p>';
  const head = res.columns.map(c => `<th>${esc(c)}</th>`).join('');
  const body = res.rows.map(r => '<tr>' + r.map(v => v === null ? '<td><span class="null">NULL</span></td>'
    : `<td class="${isNum(v) ? 'num' : ''}">${esc(isNum(v) && !Number.isInteger(v) ? +v.toFixed(4) : v)}</td>`).join('') + '</tr>').join('');
  return `<div class="tbl-wrap"><table class="res"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    (cap ? `<div class="tbl-cap">共 ${res.rows.length} 行</div>` : '');
}

function topbar(title, { back = '#/home', right = '' } = {}) {
  return `<header class="topbar"><button class="ib" data-act="back" data-to="${back}" aria-label="返回">‹</button>
    <h1>${title}</h1>${right || '<span class="ib"></span>'}</header><div class="mosaic"></div>`;
}

// ---------- 進度計算 ----------
const worldLevels = w => byWorld[w] || [];
const worldStars = w => worldLevels(w).reduce((a, l) => a + (S.stars[l.id] || 0), 0);
const worldDone = w => worldLevels(w).filter(l => S.passed[l.id]).length;
function unlocked(l) {
  const ls = worldLevels(l.world), i = ls.indexOf(l);
  return i <= 0 || !!S.passed[ls[i - 1].id] || !!S.passed[l.id];
}
const firstUnpassed = () => G.levels.find(l => !S.passed[l.id]);
function recommendedWorld() { const l = firstUnpassed(); return l ? l.world : null; }
function nextInWorld(l) { const ls = worldLevels(l.world); return ls[ls.indexOf(l) + 1] || null; }

// ---------- 路由 ----------
window.addEventListener('hashchange', route);
function route() {
  closeSheet(true);
  document.body.classList.remove('typing');
  const [, name, arg] = (location.hash || '#/home').split('/');
  window.scrollTo(0, 0);
  app.onclick = null;
  ({
    home: Home, prologue: Prologue, map: WorldMap, world: World, level: Level, warmup: Warmup,
    outro: Outro, review: Review, chars: Chars, code: CodePage, settings: Settings,
  }[name] || Home)(arg && decodeURIComponent(arg));
}

app.addEventListener('click', e => {
  const b = e.target.closest('[data-act="back"]');
  if (b) { go(b.dataset.to); return; }
  const n = e.target.closest('[data-go]');
  if (n) go(n.dataset.go);
});

// ---------- 首頁 ----------
function Home() {
  const started = Object.keys(S.passed).length > 0;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const total = G.levels.length * 3, got = Object.values(S.stars).reduce((a, b) => a + b, 0);
  app.innerHTML = `
  <div class="home-hero">
    <div class="sign"><div class="emoji">☕🍞🍜</div><h1>${esc(G.title)}</h1></div>
    <p>${esc(G.subtitle)}</p>
  </div>
  <div class="stack">
    ${started ? `<button class="btn" data-act="continue">繼續 ▶</button>` : ''}
    <button class="btn ${started ? 'alt' : ''}" data-go="#/prologue">${S.seenPrologue ? '重看故事序幕' : '開始故事'}</button>
    <button class="btn alt" data-go="#/map">🗺 世界地圖</button>
    <div class="row">
      <button class="btn alt" data-go="#/review">📕 錯題簿${Object.keys(S.review).length ? ` (${Object.keys(S.review).length})` : ''}</button>
      <button class="btn alt" data-go="#/chars">👥 人物</button>
    </div>
    <div class="row">
      <button class="btn alt" data-go="#/code">🔑 進度碼</button>
      <button class="btn alt" data-go="#/settings">⚙️ 設定</button>
    </div>
    <p class="center muted">已得 ${got} / ${total} 粒星</p>
    <p class="center muted" style="font-size:13px">遊戲可提供匿名整體使用統計，不傳送學號或答案。可在<a href="#/settings">設定</a>關閉。</p>
    ${!standalone && !S.a2hs ? `
    <div class="card tip">
      <b>把遊戲加到主畫面，進度會更安全</b>
      <p class="muted" style="margin:4px 0">Safari 會刪除七日沒有使用的網站資料。加到主畫面後，進度會保留。</p>
      <ol><li>按 Safari 下方的「分享」按鈕 <span aria-hidden="true">⬆️</span></li><li>選「加至主畫面」</li><li>以後從主畫面的「發記冰室」圖示開啟</li></ol>
      <button class="btn ghost small" data-act="a2hs">知道了</button>
    </div>` : ''}
  </div>`;
  app.querySelector('[data-act="continue"]')?.addEventListener('click', () => {
    const last = S.lastLevel && LV[S.lastLevel];
    const target = last && !S.passed[last.id] ? last : (last && nextUnpassedAfter(last)) || firstUnpassed();
    go(target ? `#/level/${target.id}` : '#/map');
  });
  app.querySelector('[data-act="a2hs"]')?.addEventListener('click', () => { S.a2hs = true; save(); Home(); });
}
function nextUnpassedAfter(l) {
  const i = G.levels.indexOf(l);
  return G.levels.slice(i + 1).find(x => !S.passed[x.id] && unlocked(x)) || null;
}

// ---------- 序幕 ----------
function Prologue() { storyScreen(G.prologue, '序幕', () => { S.seenPrologue = true; save(); go('#/map'); }, '進入世界地圖'); }

function storyScreen(lines, title, done, doneLabel = '繼續') {
  let i = 0;
  const draw = () => {
    app.innerHTML = `${topbar(title, { back: '#/home' })}
      <div class="story-screen" data-act="next">
        <div class="story-line">${esc(lines[i])}</div>
        <div class="dots">${lines.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
        ${i < lines.length - 1 ? '<div class="tapnote">輕按畫面繼續</div>' : `<button class="btn" data-act="done">${doneLabel}</button>`}
      </div>`;
  };
  draw();
  app.onclick = e => {
    if (e.target.closest('[data-act="back"]')) return;
    if (e.target.closest('[data-act="done"]')) { app.onclick = null; done(); return; }
    if (e.target.closest('[data-act="next"]') && i < lines.length - 1) { i++; draw(); }
  };
}

// ---------- 世界地圖 ----------
function WorldMap() {
  app.onclick = null;
  const rec = recommendedWorld();
  app.innerHTML = `${topbar('世界地圖')}
  <div class="stack">${G.worlds.map(w => {
    const ls = worldLevels(w.id), max = ls.length * 3, st = worldStars(w.id), done = worldDone(w.id);
    return `<button class="world ${w.id === rec ? 'rec' : ''}" data-go="#/world/${w.id}">
      <div class="no">${w.id}</div>
      <div class="meta">
        <div class="t">${esc(w.title)} ${w.id === rec ? '<span class="badge">建議下一站</span>' : ''}</div>
        <div class="topic">${esc(w.topic)}</div>
        <div class="bar"><i style="width:${ls.length ? done / ls.length * 100 : 0}%"></i></div>
      </div>
      <div class="center"><div class="stars">★ ${st}</div><small class="muted">/ ${max}</small></div>
    </button>`;
  }).join('')}</div>`;
}

// ---------- 世界頁 ----------
function conceptHTML(w) {
  let ex;
  try {
    const r = CK.run(w.card.example);
    if (r.columns.length) ex = tableHTML(r);
    else {
      const t = (w.card.example.match(/^\s*(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(\w+)/i) || [])[1];
      if (t) {
        const db = CK.fresh('A');
        CK.exec(db, preprocess(w.card.example));
        ex = `<div class="tbl-cap">執行後的 ${esc(t)} 表：</div>` + tableHTML(CK.exec(db, `SELECT * FROM ${t}`));
        db.close();
      }
    }
  } catch (e) { ex = ''; }
  return `<div class="card concept">
    <h3>📖 ${esc(w.card.title)}</h3>
    <ul>${w.card.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <div class="tbl-cap">例子</div>
    <pre class="code">${esc(w.card.example)}</pre>
    <p class="note">${esc(w.card.exampleNote)}</p>
    ${ex || ''}
  </div>`;
}

function World(id) {
  app.onclick = null;
  const w = G.worlds.find(x => String(x.id) === String(id));
  if (!w) return go('#/map');
  const ls = worldLevels(w.id);
  app.innerHTML = `${topbar(`世界 ${w.id}：${esc(w.title)}`, { back: '#/map' })}
  <div class="bubble">${esc(w.intro)}</div>
  ${conceptHTML(w)}
  <div style="margin:14px 0"><button class="btn" data-act="start">開始挑戰</button></div>
  <h2 class="sec">關卡（${worldStars(w.id)} / ${ls.length * 3} ★）</h2>
  <div class="stack">${ls.map(l => {
    const lock = !unlocked(l);
    return `<button class="lvl ${lock ? 'locked' : ''}" data-lvl="${l.id}">
      <span class="id">${l.id}</span>
      <span class="t">${esc(l.title)} ${l.tag ? `<span class="badge">${esc(l.tag)}題</span>` : ''}<br><span class="type">${TYPE_NAME[l.type]}</span></span>
      ${lock ? '🔒' : S.passed[l.id] ? starStr(S.stars[l.id] || 0) : '<span class="muted">未完成</span>'}
    </button>`;
  }).join('')}</div>
  ${worldDone(w.id) === ls.length ? `<div style="margin-top:14px"><button class="btn alt" data-go="#/outro/${w.id}">重看本世界結局</button></div>` : ''}`;
  app.querySelectorAll('[data-lvl]').forEach(b => b.addEventListener('click', () => {
    const l = LV[b.dataset.lvl];
    if (!unlocked(l)) return toast('請先完成上一關');
    go(`#/level/${l.id}`);
  }));
  app.querySelector('[data-act="start"]').addEventListener('click', () => {
    const target = ls.find(l => !S.passed[l.id]) || ls[0];
    const pool = warmupPool(w.id);
    if (w.id >= 3 && pool.length && !World.warmed[w.id]) {
      World.warmed[w.id] = true;
      openSheet(`<div class="sh-head"><h3>🔥 溫故題</h3></div>
        <div class="sh-body"><p>開始之前，先做一題以前做過的題目熱身？溫故題不計星數，可以跳過。</p></div>
        <div class="sh-foot stack"><button class="btn" data-act="warm">做一題</button><button class="btn ghost" data-act="skip">跳過</button></div>`);
      $('#sheet [data-act="warm"]').onclick = () => { const p = pool[Math.floor(Math.random() * pool.length)]; go(`#/warmup/${p.id}~${target.id}`); };
      $('#sheet [data-act="skip"]').onclick = () => go(`#/level/${target.id}`);
    } else go(`#/level/${target.id}`);
  });
}
World.warmed = {};
const warmupPool = wid => G.levels.filter(l => l.type === 'write' && l.world < wid && S.passed[l.id]);

// ---------- 底部面板 ----------
function openSheet(html, { onClose } = {}) {
  const sh = $('#sheet'), ov = $('#overlay');
  sh.innerHTML = `<div class="grab"></div>${html}`;
  sh.hidden = false; ov.hidden = false;
  ov.onclick = () => closeSheet();
  sh.querySelectorAll('[data-act="close"]').forEach(b => b.onclick = () => closeSheet());
  openSheet.onClose = onClose;
  return sh;
}
function closeSheet(silent) {
  const sh = $('#sheet');
  if (sh.hidden) return;
  sh.hidden = true; $('#overlay').hidden = true; sh.innerHTML = '';
  const f = openSheet.onClose; openSheet.onClose = null;
  if (f && !silent) f();
}

// 數據字典
function dictSheet(world, onInsert) {
  const tables = Object.keys(TABLE_INFO).filter(t => t !== 'TWMENU' || world >= 8);
  let cur = dictSheet.last && tables.includes(dictSheet.last) ? dictSheet.last : tables[0];
  const db = CK.fresh('A');
  const draw = () => {
    dictSheet.last = cur;
    const info = TABLE_INFO[cur];
    const cols = CK.exec(db, `PRAGMA table_info(${cur})`).rows;
    const fks = CK.exec(db, `PRAGMA foreign_key_list(${cur})`).rows;
    const fkOf = c => fks.find(f => f[3] === c);
    const rows = CK.exec(db, `SELECT * FROM ${cur}`);
    sh.innerHTML = `<div class="grab"></div>
      <div class="sh-head"><h3>🗂 數據字典</h3><button class="ib" data-act="close" aria-label="關閉">✕</button></div>
      <div class="tabs">${tables.map(t => `<button class="tab ${t === cur ? 'on' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
      <div class="sh-body">
        <div class="row" style="align-items:center;margin-bottom:6px">
          <button class="tname" data-ins="${cur}" style="flex:0 0 auto">${cur}</button>
          <span>${esc(info.zh)}：${esc(info.desc)}</span>
        </div>
        ${onInsert ? '<p class="muted" style="margin:2px 0;font-size:13px">輕按表名或欄位名稱，可以把它加入 SQL。</p>' : ''}
        <div class="cols">${cols.map(c => {
          const fk = fkOf(c[1]);
          return `<button class="col" data-ins="${c[1]}"><span class="n">${c[1]}</span>
            <span class="zh">${esc(info.cols[c[1]] || '')}<br><span class="ty">${esc(c[2])}</span></span>
            ${c[5] ? '<span class="pk">PK</span>' : ''}${fk ? `<span class="fk">FK→${fk[2]}.${fk[4]}</span>` : ''}</button>`;
        }).join('')}</div>
        <div class="tbl-cap">${cur} 的全部記錄</div>
        ${tableHTML(rows)}
      </div>`;
    sh.querySelector('[data-act="close"]').onclick = () => closeSheet();
    sh.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { cur = b.dataset.tab; draw(); });
    sh.querySelectorAll('[data-ins]').forEach(b => b.onclick = () => {
      if (!onInsert) return;
      onInsert(b.dataset.ins); toast(`已加入 ${b.dataset.ins}`, 1000);
    });
  };
  const sh = openSheet('', { onClose: () => db.close() });
  draw();
}

function cardSheet(world) {
  const w = G.worlds.find(x => x.id === world);
  openSheet(`<div class="sh-head"><h3>重溫卡</h3><button class="ib" data-act="close" aria-label="關閉">✕</button></div>
    <div class="sh-body">${conceptHTML(w)}</div>`);
}

// ---------- 關卡 ----------
function Warmup(arg) {
  const [id, then] = String(arg).split('~');
  Level(id, { warmup: true, then });
}

function Level(id, opt = {}) {
  app.onclick = null;
  const l = LV[id];
  if (!l) return go('#/map');
  if (!opt.warmup && !unlocked(l)) { toast('請先完成上一關'); return go(`#/world/${l.world}`); }
  if (!opt.warmup) { S.lastLevel = l.id; save(); }
  usage.event('start', l.id);
  const st = { hints: 0, wrong: 0, shown: false, done: false };
  const best = S.stars[l.id] || 0;
  app.innerHTML = `<div class="level">
    <header class="topbar lv-head">
      <button class="ib" data-act="back" data-to="#/world/${l.world}" aria-label="返回">‹</button>
      <h1><span class="code-id">${opt.warmup ? '溫故題' : l.id}</span> ${esc(l.title)}</h1>
      <button class="ib" data-act="card" aria-label="重溫卡">📖</button>
      <button class="ib" data-act="dict" aria-label="數據字典">🗂</button>
    </header>
    <div class="mosaic hide-typing"></div>
    <div class="lv-meta hide-typing">
      ${opt.warmup ? '<span class="badge gold">溫故題 · 不計星數</span>' : `${S.passed[l.id] ? starStr(best) : ''}`}
      ${l.tag ? `<span class="badge">${esc(l.tag)}題</span>` : ''}
      <span class="muted" style="font-size:13px">${TYPE_NAME[l.type]}</span>
      ${opt.warmup ? `<button class="btn ghost small" data-act="skipwarm" style="margin-left:auto">跳過</button>` : ''}
    </div>
    <div class="bubble hide-typing">${esc(l.story)}</div>
    <p class="task hide-typing">${esc(l.task || '')}</p>
    <div class="task-line" data-act="taskline">${esc(l.task || '')}</div>
    <div id="body" style="display:contents"></div>
  </div>`;
  const root = $('.level');
  root.querySelector('[data-act="card"]').onclick = () => cardSheet(l.world);
  root.querySelector('[data-act="taskline"]').onclick = e => e.currentTarget.classList.toggle('open');
  root.querySelector('[data-act="skipwarm"]')?.addEventListener('click', () => go(`#/level/${opt.then}`));
  const body = $('#body');
  const ctx = { l, st, opt, body, root };
  ({ write: WriteLevel, order: OrderLevel, predict: ChoiceLevel, mc: ChoiceLevel, bug: BugLevel })[l.type](ctx);
  if (l.type !== 'write') root.querySelector('[data-act="dict"]').onclick = () => dictSheet(l.world, null);
}

// 過關：記錄星數、錯題簿，顯示回饋卡
function finish(ctx, stars, { result = null, caps = [], extraHTML = '' } = {}) {
  const { l, st, opt } = ctx;
  if (st.done) return;
  usage.event('complete', l.id);
  st.done = true;
  if (!opt.warmup) {
    S.passed[l.id] = true;
    S.stars[l.id] = Math.max(S.stars[l.id] || 0, stars);
    if (st.shown || st.wrong >= 3) S.review[l.id] = true;
    else if (st.hints === 0 && st.wrong <= 1) delete S.review[l.id];
    save();
  }
  const next = opt.warmup ? null : nextInWorld(l);
  const worldEnd = !opt.warmup && !next;
  const sh = openSheet(`
    <div class="sh-body">
      <div class="fb-title ok">✔ ${opt.warmup ? '熱身完成！' : '過關！'}</div>
      ${opt.warmup ? '' : `<div class="big-stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>`}
      ${!opt.warmup && st.shown ? '<p class="muted center">看了答案，這一關不得星，已加入錯題簿。之後再試一次吧！</p>' : ''}
      ${caps.map(c => `<div class="dse"><b>DSE 扣分位</b><br>${esc(c)}</div>`).join('')}
      ${extraHTML}
      ${result ? `<div class="tbl-cap">結果</div>${tableHTML(result)}` : ''}
      <div class="explain"><b>重點</b><br>${esc(l.explain)}</div>
    </div>
    <div class="sh-foot row">
      <button class="btn ghost" data-act="stay">留在這裏</button>
      <button class="btn" data-act="next">${opt.warmup ? '開始挑戰 ▶' : worldEnd ? '完成世界 ▶' : '下一關 ▶'}</button>
    </div>`);
  sh.querySelector('[data-act="stay"]').onclick = () => closeSheet();
  sh.querySelector('[data-act="next"]').onclick = () => {
    if (opt.warmup) return go(`#/level/${opt.then}`);
    if (next) go(`#/level/${next.id}`);
    else go(`#/outro/${l.world}`);
  };
}

function failSheet(html, buttons = '') {
  const sh = openSheet(`<div class="sh-body">${html}</div>
    <div class="sh-foot row">${buttons}<button class="btn" data-act="close">再試</button></div>`);
  return sh;
}

// ----- 寫 SQL -----
function WriteLevel(ctx) {
  const { l, st, body, root } = ctx;
  const kwOn = l.world <= 3 || S.chips;
  body.innerHTML = `
    <textarea class="editor" id="ed" rows="5" placeholder="在這裏輸入 SQL" aria-label="SQL"
      autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" inputmode="text"></textarea>
    <div class="hint-line" id="hintline"></div>
    <div class="kbar" id="kbar">
      ${kwOn ? `<div class="keys">${KEYWORDS.map(k => `<button class="key kw" data-key="${k}" tabindex="-1">${k}</button>`).join('')}</div>` : ''}
      <div class="keys">${SYMBOLS.map(k => `<button class="key" data-key="${esc(k)}" tabindex="-1">${k === 'BS' ? '⌫' : esc(k)}</button>`).join('')}</div>
    </div>
    <div class="actions">
      <button class="btn alt hint" data-act="hint">💡 提示</button>
      <button class="btn alt hide-typing" data-act="fmt" style="flex:0 0 auto;width:auto">格式化</button>
      <button class="btn alt" data-act="run">▶ 執行</button>
      <button class="btn" data-act="submit">提交</button>
    </div>
    <div id="hints" class="hide-typing"></div>
    <div id="out" class="result hide-typing"></div>`;
  const ed = $('#ed'), out = $('#out');
  let sel = { start: 0, end: 0 };
  const remember = () => { sel = { start: ed.selectionStart, end: ed.selectionEnd }; };
  ['keyup', 'click', 'select', 'input', 'blur'].forEach(ev => ed.addEventListener(ev, remember));

  // 輸入模式：配合鍵盤
  ed.addEventListener('focus', () => { document.body.classList.add('typing'); syncVV(); });
  ed.addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement !== ed) document.body.classList.remove('typing');
  }, 120));

  function insert(text, kind) {
    const s = document.activeElement === ed ? ed.selectionStart : sel.start;
    const e = document.activeElement === ed ? ed.selectionEnd : sel.end;
    if (text === 'BS') {
      if (s !== e) ed.setRangeText('', s, e, 'end');
      else if (s > 0) ed.setRangeText('', s - 1, s, 'end');
    } else {
      let t = text;
      const prev = ed.value[s - 1];
      if (kind === 'word' && prev && !/[\s(,.]/.test(prev)) t = ' ' + t;
      if (kind === 'kw') { if (prev && !/[\s(]/.test(prev)) t = ' ' + t; t += /\($/.test(t) ? '' : ' '; }
      ed.setRangeText(t, s, e, 'end');
    }
    remember();
    ed.dispatchEvent(new Event('input'));
  }
  bindKeys($('#kbar'), k => insert(k, KEYWORDS.includes(k) ? 'kw' : 'sym'));
  root.querySelector('[data-act="dict"]').onclick = () => { ed.blur(); dictSheet(l.world, name => insert(name, 'word')); };

  // 看了答案之後：不可以貼上；開始輸入就收起答案
  ed.addEventListener('paste', e => { if (st.shown) { e.preventDefault(); toast('請自己輸入一次，不要貼上。'); } });
  ed.addEventListener('input', () => {
    const a = $('#ansbox');
    if (a && !a.hidden && ed.value.length) { a.hidden = true; $('#ansshow').hidden = false; }
  });

  root.querySelector('[data-act="fmt"]').onclick = () => { ed.value = formatSql(ed.value); };
  root.querySelector('[data-act="run"]').onclick = () => {
    ed.blur(); document.body.classList.remove('typing');
    const r = CK.preview(l, ed.value);
    out.innerHTML = r.ok
      ? `${r.note ? `<p class="msg-ok">${esc(r.note)}</p>` : ''}${r.result ? tableHTML(r.result) : ''}`
      : `<div class="card"><div class="err-zh">${esc(r.zh)}</div>${r.en ? `<div class="err-en">${esc(r.en)}</div>` : ''}</div>`;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  root.querySelector('[data-act="hint"]').onclick = () => askHint();
  root.querySelector('[data-act="submit"]').onclick = () => {
    ed.blur(); document.body.classList.remove('typing');
    const v = CK.judge(l, ed.value);
    if (v.result) out.innerHTML = `<div class="tbl-cap">你的結果</div>${tableHTML(v.result)}`;
    else out.innerHTML = '';
    if (v.ok) {
      let stars = st.shown ? 0 : [3, 2, 1][st.hints];
      if (v.caps.length) stars = Math.min(stars, 2);
      finish(ctx, stars, { caps: v.caps });
      return;
    }
    st.wrong++; usage.event('wrong', l.id);
    const lintBox = v.kind === 'error' && v.lint.length ? v.lint.map(m => `<div class="dse"><b>DSE 扣分位</b><br>${esc(m)}</div>`).join('') : '';
    const sh = failSheet(`<div class="fb-title bad">✘ ${v.kind === 'error' ? '執行時出錯' : '還未正確'}</div>
      ${lintBox}
      <div class="err-zh">${esc(v.zh)}</div>${v.en ? `<div class="err-en">${esc(v.en)}</div>` : ''}
      ${st.wrong >= 3 && st.hints === 0 && !st.shown ? '<p>已經試了幾次。要不要看提示 1？</p>' : ''}`,
      st.wrong >= 3 && st.hints === 0 && !st.shown ? '<button class="btn alt" data-act="h1">看提示 1</button>' : '');
    sh.querySelector('[data-act="h1"]')?.addEventListener('click', () => { closeSheet(); showHint(); });
  };

  function askHint() {
    if (st.shown) return toast('已經顯示答案了。請自己輸入一次。');
    const n = st.hints + 1;
    const cost = n === 3 ? '看了答案，這一關不得星，並會加入錯題簿。你要自己輸入一次才算過關。' : `看了提示 ${n}，過關時最多得 ${'★'.repeat(3 - n)}。`;
    const sh = openSheet(`<div class="sh-head"><h3>💡 ${n === 3 ? '看答案' : `提示 ${n}`}</h3></div>
      <div class="sh-body"><p>${cost}</p></div>
      <div class="sh-foot row"><button class="btn ghost" data-act="close">取消</button><button class="btn" data-act="ok">${n === 3 ? '看答案' : '看提示'}</button></div>`);
    sh.querySelector('[data-act="ok"]').onclick = () => { closeSheet(); showHint(); };
  }
  function showHint() {
    st.hints++; usage.event('hint', l.id);
    const hb = $('#hints');
    if (st.hints < 3) {
      const h = l.hints[st.hints - 1];
      hb.insertAdjacentHTML('beforeend', `<div class="card hintbox"><div class="k">提示 ${st.hints}</div>${/___/.test(h) ? `<pre class="code">${esc(h)}</pre>` : esc(h)}</div>`);
      $('#hintline').textContent = `提示 ${st.hints}：${h}`;
      root.querySelector('[data-act="hint"]').textContent = st.hints === 2 ? '💡 答案' : '💡 提示 ' + (st.hints + 1);
    } else {
      st.shown = true;
      ed.value = '';
      hb.insertAdjacentHTML('beforeend', `<div class="card hintbox" id="anscard"><div class="k">答案（請看清楚，然後自己輸入一次）</div>
        <div id="ansbox" class="answer-lock"><canvas id="anscv" aria-label="答案"></canvas></div>
        <button class="btn ghost small" id="ansshow" hidden>再看答案</button></div>`);
      drawAnswer($('#anscv'), l.answer);
      $('#ansshow').onclick = () => { $('#ansbox').hidden = false; $('#ansshow').hidden = true; };
      $('#hintline').textContent = '答案已顯示。請自己輸入一次。';
      root.querySelector('[data-act="hint"]').disabled = true;
      hb.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

// 答案畫在 canvas 上，不能複製
function drawAnswer(cv, text) {
  const s = formatSql(text);
  const css = getComputedStyle(document.documentElement);
  const width = Math.min(cv.parentElement.clientWidth || 320, 528);
  const dpr = window.devicePixelRatio || 1;
  const ctx = cv.getContext('2d');
  const font = `15px ${css.getPropertyValue('--mono') || 'monospace'}`;
  ctx.font = font;
  const lines = [];
  for (const raw of s.split('\n')) {
    let line = '';
    for (const word of raw.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width > width - 24 && line.trim()) { lines.push(line); line = '  ' + word.trimStart(); }
      else line += word;
    }
    lines.push(line);
  }
  const lh = 22;
  cv.width = width * dpr; cv.height = (lines.length * lh + 20) * dpr;
  cv.style.width = width + 'px'; cv.style.height = (lines.length * lh + 20) + 'px';
  ctx.scale(dpr, dpr);
  ctx.fillStyle = css.getPropertyValue('--code-bg').trim() || '#20302a';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, width, lines.length * lh + 20, 10) : ctx.rect(0, 0, width, lines.length * lh + 20); ctx.fill();
  ctx.fillStyle = css.getPropertyValue('--code-ink').trim() || '#fff';
  ctx.font = font; ctx.textBaseline = 'top';
  lines.forEach((ln, i) => ctx.fillText(ln, 12, 10 + i * lh));
}

const FMT_WORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'GROUP', 'BY', 'HAVING',
  'ORDER', 'ASC', 'DESC', 'DISTINCT', 'AS', 'UNION', 'ALL', 'INTERSECT', 'MINUS', 'EXCEPT', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'VIEW', 'INDEX', 'ALTER', 'ADD', 'COLUMN', 'DROP', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'NATURAL', 'ON', 'EXISTS', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'YEAR', 'MONTH', 'DAY', 'CHAR', 'VARCHAR', 'INTEGER', 'DATE'];
function formatSql(sql) {
  const parts = String(sql).split(/('(?:[^']|'')*'?)/);
  let s = parts.map((p, i) => i % 2 ? p : p.replace(/\s+/g, ' ').replace(/\b[A-Za-z]+\b/g, w => FMT_WORDS.includes(w.toUpperCase()) ? w.toUpperCase() : w)).join('');
  const brk = /\s+(FROM|WHERE|GROUP BY|HAVING|ORDER BY|UNION ALL|UNION|INTERSECT|MINUS|EXCEPT|VALUES|SET)\b/g;
  const segs = s.split(/('(?:[^']|'')*'?)/);
  s = segs.map((p, i) => i % 2 ? p : p.replace(brk, '\n$1')).join('');
  return s.trim();
}

// 鍵盤上方的按鍵：輕按時不搶走輸入框的焦點，可以左右滑動
function bindKeys(el, onKey) {
  let sx = 0, sy = 0, moved = false, touched = false;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; }, { passive: true });
  el.addEventListener('touchmove', e => { const t = e.touches[0]; if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) moved = true; }, { passive: true });
  el.addEventListener('touchend', e => {
    const k = e.target.closest('[data-key]'); if (!k) return;
    e.preventDefault(); touched = true;
    if (!moved) onKey(k.dataset.key);
  }, { passive: false });
  el.addEventListener('mousedown', e => { if (e.target.closest('[data-key]')) e.preventDefault(); });
  el.addEventListener('click', e => {
    const k = e.target.closest('[data-key]'); if (!k) return;
    if (touched) { touched = false; return; }
    onKey(k.dataset.key);
  });
}

// ----- 排列積木 -----
function OrderLevel(ctx) {
  const { l, st, body } = ctx;
  const pool = shuffle([...l.blocks, ...l.extra].map((t, i) => ({ t, i })));
  let placed = [];
  const draw = () => {
    body.innerHTML = `
      <div class="tbl-cap">你的 SQL（輕按積木放回去）</div>
      <div class="slots">${l.blocks.map((_, k) => placed[k] ? `<button class="chip placed" data-out="${k}">${esc(placed[k].t)}</button>` : '<span class="slot"></span>').join('')}</div>
      <div class="tbl-cap">積木（輕按加入）</div>
      <div class="pool">${pool.map(c => `<button class="chip ${placed.includes(c) ? 'gone' : ''}" data-in="${c.i}">${esc(c.t)}</button>`).join('')}</div>
      <div class="row"><button class="btn ghost" data-act="clear">清除</button><button class="btn" data-act="submit" ${placed.filter(Boolean).length === l.blocks.length ? '' : 'disabled'}>提交</button></div>`;
    body.querySelectorAll('[data-in]').forEach(b => b.onclick = () => {
      const c = pool.find(x => x.i === +b.dataset.in);
      if (placed.includes(c) || st.done) return;
      const k = [...Array(l.blocks.length).keys()].find(j => !placed[j]);
      if (k === undefined) return toast('答案已滿。輕按上面的積木可以放回去。');
      placed[k] = c; draw();
    });
    body.querySelectorAll('[data-out]').forEach(b => b.onclick = () => { if (st.done) return; placed[+b.dataset.out] = undefined; draw(); });
    body.querySelector('[data-act="clear"]').onclick = () => { if (!st.done) { placed = []; draw(); } };
    body.querySelector('[data-act="submit"]').onclick = submit;
  };
  function submit() {
    const seq = placed.map(c => c.t);
    if (seq.every((t, k) => t === l.blocks[k])) {
      let result = null;
      try { result = CK.run(seq.join(' ')); } catch (e) { /* 不會發生 */ }
      finish(ctx, st.wrong ? 1 : 3, { result, extraHTML: `<pre class="code">${esc(seq.join(' '))}</pre>` });
      return;
    }
    st.wrong++; usage.event('wrong', l.id);
    const extra = seq.find(t => l.extra.includes(t));
    const k = seq.findIndex((t, j) => t !== l.blocks[j]);
    failSheet(`<div class="fb-title bad">✘ 次序不對</div>
      <div class="err-zh">${extra ? `「${esc(extra)}」這塊積木不需要用。` : `由第 ${k + 1} 塊積木開始不對。`}</div>
      <p class="muted">提示：先 SELECT 要顯示的欄位，再 FROM 資料表，然後才是條件。</p>`);
  }
  draw();
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ----- 推算結果 / 概念選擇題 -----
function ChoiceLevel(ctx) {
  const { l, st, body } = ctx;
  const predict = l.type === 'predict';
  body.innerHTML = `
    ${predict ? `<pre class="code">${esc(l.query)}</pre>
      ${l.paperOnly ? '<p class="muted" style="font-size:13px">（紙筆題：遊戲的數據庫不支援 ALL，這句不能執行。）</p>' : ''}` : ''}
    <p class="ask">${esc(predict ? l.ask : l.question)}</p>
    <div>${l.options.map((o, i) => `<button class="opt ${predict ? 'mono' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
  body.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (st.done) return;
    const i = +b.dataset.i;
    if (i !== l.answer) {
      if (b.classList.contains('wrong')) return;
      st.wrong++; usage.event('wrong', l.id);
      b.classList.add('wrong', 'shake');
      toast('不對，再想一想。');
      return;
    }
    b.classList.add('right');
    let extra = '';
    if (predict && !l.paperOnly) extra = `<button class="btn alt small" data-act="tryrun" style="width:100%">▶ 執行看看</button><div id="tryout"></div>`;
    const sh = finish(ctx, st.wrong ? 1 : 3, { extraHTML: extra });
    const t = $('#sheet [data-act="tryrun"]');
    if (t) t.onclick = () => { $('#tryout').innerHTML = tableHTML(CK.run(l.query.replace(/\n/g, ' '))); t.remove(); };
    return sh;
  });
}

// ----- 找出錯處 -----
function BugLevel(ctx) {
  const { l, st, body } = ctx;
  body.innerHTML = `<p class="ask">輕按有問題的部分：</p>
    <div class="tokens">${l.tokens.map((t, i) => `<button class="tok" data-i="${i}">${esc(t)}</button>`).join('')}</div>`;
  body.querySelectorAll('.tok').forEach(b => b.onclick = () => {
    if (st.done) return;
    const i = +b.dataset.i;
    if (i !== l.wrong) {
      if (b.classList.contains('wrong')) return;
      st.wrong++; usage.event('wrong', l.id); b.classList.add('wrong', 'shake'); toast('這部分沒有問題，再找找。');
      return;
    }
    b.classList.add('right');
    finish(ctx, st.wrong ? 1 : 3, { extraHTML: `<div class="tbl-cap">改正後</div><pre class="code">${diffFix(l.tokens, l.fix)}</pre>` });
  });
}
// 標示修正句中改動了的部分
function diffFix(tokens, fix) {
  const a = tokens, b = fix.split(/\s+/);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const keep = new Set();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { keep.add(j); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return b.map((w, j) => keep.has(j) ? esc(w) : `<mark>${esc(w)}</mark>`).join(' ');
}

// ---------- 世界結局 ----------
function Outro(id) {
  const w = G.worlds.find(x => String(x.id) === String(id));
  if (!w) return go('#/map');
  const finale = worldLevels(w.id).some(l => l.finale);
  const lines = [...(finale ? REVEAL : []), w.outro];
  storyScreen(lines, `世界 ${w.id} 完成`, () => {
    const ls = worldLevels(w.id), next = G.worlds.find(x => x.id === w.id + 1);
    app.onclick = null;
    app.innerHTML = `${topbar(`世界 ${w.id} 完成`, { back: '#/map' })}
      <div class="card center stack">
        <div class="fb-title ok" style="justify-content:center">🎉 ${esc(w.title)}</div>
        <div class="big-stars">★ ${worldStars(w.id)} / ${ls.length * 3}</div>
        <div>${ls.map(l => `<div class="row" style="justify-content:space-between;text-align:left"><span>${l.id} ${esc(l.title)}</span><span style="flex:0 0 auto">${S.passed[l.id] ? starStr(S.stars[l.id] || 0) : '—'}</span></div>`).join('')}</div>
      </div>
      <div class="stack" style="margin-top:14px">
        ${next ? `<button class="btn" data-go="#/world/${next.id}">下一個世界：${esc(next.title)} ▶</button>` : '<p class="center"><b>恭喜你完成全部十個世界！</b><br>到「進度碼」把你的成績交給老師吧。</p>'}
        <button class="btn alt" data-go="#/map">世界地圖</button>
      </div>`;
  }, '看成績');
}

// ---------- 錯題簿 ----------
function Review() {
  app.onclick = null;
  const ids = G.levels.filter(l => S.review[l.id]);
  app.innerHTML = `${topbar('錯題簿')}
    <p class="muted">看了答案、或者錯了三次或以上的關卡會放在這裏。不用提示、在第一或第二次就答對，便會移出錯題簿。</p>
    <div class="stack">${ids.length ? ids.map(l => `<button class="lvl" data-go="#/level/${l.id}">
      <span class="id">${l.id}</span><span class="t">${esc(l.title)}<br><span class="type">${TYPE_NAME[l.type]}</span></span>${starStr(S.stars[l.id] || 0)}</button>`).join('')
      : '<div class="card center">錯題簿是空的。做得好！👍</div>'}</div>`;
}

// ---------- 人物 ----------
function Chars() {
  app.onclick = null;
  app.innerHTML = `${topbar('人物')}
    <p class="muted">人物的編號就是數據庫中的編號，例如 STAFF 表的 SID、CUSTOMER 表的 CID。</p>
    <div class="stack">${G.characters.map(c => `<div class="card char"><div class="em">${EMOJI[c.id] || '🙂'}</div>
      <div><div class="nm">${esc(c.name)} <span class="id">${esc(c.id)}</span></div><div>${esc(c.desc)}</div></div></div>`).join('')}</div>`;
}

// ---------- 進度碼 ----------
const starArray = () => G.levels.map(l => S.stars[l.id] || 0);
function CodePage() {
  app.onclick = null;
  const code = encode(starArray(), S.classNo);
  app.innerHTML = `${topbar('進度碼')}
    <div class="stack">
      <div class="card stack">
        <b>你的進度碼</b>
        <div class="codebox" id="code">${code}</div>
        <button class="btn" data-act="copy">📋 複製</button>
        <p class="muted" style="margin:0;font-size:14px">把進度碼交給老師，或者在新手機輸入進度碼，便可以還原進度。進度碼只記錄每關的星數。</p>
      </div>
      <div class="card stack">
        <label for="cls"><b>學號</b>（只輸入數字，例如 6 班 12 號可以寫 612）</label>
        <input class="field" id="cls" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="off" value="${esc(S.classNo)}">
        <button class="btn alt" data-act="savecls">儲存學號</button>
      </div>
      <div class="card stack">
        <label for="inp"><b>還原進度</b></label>
        <input class="field mono" id="inp" placeholder="XXXX-XXXX-…" autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false">
        <button class="btn alt" data-act="restore">還原</button>
      </div>
    </div>`;
  $('[data-act="copy"]').onclick = async () => {
    try { await navigator.clipboard.writeText(code); toast('已複製'); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($('#code'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('請按「拷貝」複製已選取的進度碼');
    }
  };
  $('[data-act="savecls"]').onclick = () => {
    const v = $('#cls').value.replace(/\D/g, '');
    if (v && +v > 65535) return toast('學號太長了');
    S.classNo = v; save(); toast('已儲存'); CodePage();
  };
  $('[data-act="restore"]').onclick = () => {
    const d = decode($('#inp').value);
    if (!d) return toast('進度碼不正確，請檢查有沒有打錯。', 3000);
    const sh = openSheet(`<div class="sh-head"><h3>還原進度？</h3></div>
      <div class="sh-body"><p>現在這部手機上的進度會被取代。</p></div>
      <div class="sh-foot row"><button class="btn ghost" data-act="close">取消</button><button class="btn red" data-act="ok">還原</button></div>`);
    sh.querySelector('[data-act="ok"]').onclick = () => { applyCode(d); closeSheet(); toast('已還原進度'); CodePage(); };
  };
}
function applyCode(d) {
  S.stars = {}; S.passed = {}; S.review = {};
  G.levels.forEach((l, i) => {
    const s = d.stars[i] || 0;
    if (s > 0) { S.stars[l.id] = s; S.passed[l.id] = true; }
  });
  // 0 星但後面的關卡已過關 → 當作「看了答案才過關」
  for (const w of G.worlds) {
    const ls = worldLevels(w.id);
    const last = ls.map(l => !!S.passed[l.id]).lastIndexOf(true);
    ls.forEach((l, i) => { if (i < last && !S.passed[l.id]) { S.passed[l.id] = true; S.stars[l.id] = 0; S.review[l.id] = true; } });
  }
  if (d.classNo) S.classNo = String(d.classNo);
  save();
}

// ---------- 設定 ----------
function Settings() {
  app.onclick = null;
  app.innerHTML = `${topbar('設定')}
    <div class="stack">
      <div class="card"><label class="switch"><input type="checkbox" id="chips" ${S.chips ? 'checked' : ''}>
        <span>所有世界都顯示關鍵字按鈕<br><small class="muted">世界 1 至 3 一定會顯示。考試要自己默寫關鍵字，建議由世界 4 開始自己輸入。</small></span></label></div>
      <div class="card"><label class="switch"><input type="checkbox" id="statistics" ${statisticsEnabled() ? 'checked' : ''}><span>允許匿名使用統計<br><small class="muted">啟用統計服務後，只傳送訪問、可見頁面活動時間及關卡活動次數，不傳送學號、答案或進度碼。不使用玩家識別碼；可隨時關閉。網絡服務供應商仍會處理連線資料。瀏覽器的隱私設定優先。</small></span></label></div>
      <button class="btn alt" data-act="tip">重新顯示「加到主畫面」提示</button>
      <button class="btn red" data-act="reset">清除所有進度</button>
      <p class="muted center" style="font-size:13px">數據庫：SQLite ${esc(CK.version())}</p>
    </div>`;
  $('#statistics').onchange = e => { setStatisticsEnabled(e.target.checked); Settings(); };
  $('#chips').onchange = e => { S.chips = e.target.checked; save(); };
  $('[data-act="tip"]').onclick = () => { S.a2hs = false; save(); toast('已在首頁顯示'); };
  $('[data-act="reset"]').onclick = () => {
    const sh = openSheet(`<div class="sh-head"><h3>清除所有進度？</h3></div>
      <div class="sh-body"><p>所有星數及錯題簿都會刪除，不能復原。建議先到「進度碼」抄下你的進度碼。</p></div>
      <div class="sh-foot row"><button class="btn ghost" data-act="close">取消</button><button class="btn red" data-act="ok">清除</button></div>`);
    sh.querySelector('[data-act="ok"]').onclick = () => {
      Object.assign(S, { stars: {}, passed: {}, review: {}, seenPrologue: false, lastLevel: null });
      save(); closeSheet(); go('#/home');
    };
  };
}

// ---------- 鍵盤及可視範圍 ----------
function syncVV() {
  const v = window.visualViewport;
  const r = document.documentElement.style;
  r.setProperty('--vvh', (v ? v.height : innerHeight) + 'px');
  r.setProperty('--vvtop', (v ? v.offsetTop : 0) + 'px');
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', syncVV);
  visualViewport.addEventListener('scroll', syncVV);
}
syncVV();

// ---------- 啟動 ----------
async function boot() {
  try {
    const [SQL, levels, a, b] = await Promise.all([
      window.initSqlJs({ locateFile: f => `vendor/${f}` }),
      fetch('levels.json').then(r => r.json()),
      fetch('data/data_a.sql').then(r => r.text()),
      fetch('data/patch_b.sql').then(r => r.text()),
    ]);
    G = levels;
    G.levels.forEach(l => { LV[l.id] = l; (byWorld[l.world] = byWorld[l.world] || []).push(l); });
    CK = new Checker(SQL, a, b, G.lint);
    const ver = CK.version();
    console.log('SQLite version', ver);
    const [maj, min] = ver.split('.').map(Number);
    if (maj === 3 && min < 39) console.warn('SQLite 版本低於 3.39，RIGHT / FULL JOIN 不能使用');
    usage.start();
    window.__game = { G, CK, S };
    if (!location.hash) location.replace('#/home');
    route();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="loading"><p>載入失敗</p><p class="muted" style="font-size:15px;font-weight:400">請檢查網絡，然後重新載入。<br><small>${esc(e.message)}</small></p>
      <button class="btn" onclick="location.reload()">重新載入</button></div>`;
  }
}
boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

