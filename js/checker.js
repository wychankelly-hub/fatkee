// 答案檢查器。必須與 build.py 的 preprocess()、自訂函數、LINT 及比較邏輯一致。
// 不使用 DOM，瀏覽器及 Node（單元測試）都可以使用。

// ---------- 預處理（= build.py preprocess） ----------
export function preprocess(sql) {
  let s = String(sql).replace(/；/g, ';').replace(/ /g, ' ').trim().replace(/;+$/, '');
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  s = s.replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',');
  s = s.replace(/\bMINUS\b/gi, 'EXCEPT');
  s = s.replace(/#(\d{1,2})\/(\d{1,2})\/(\d{4})#/g,
    (m, d, mo, y) => `'${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}'`);
  s = s.replace(/(\bLIKE\s*')([^']*)(')/gi,
    (m, a, b, c) => a + b.replace(/\*/g, '%').replace(/\?/g, '_') + c);
  return s;
}

// ---------- 自訂函數（= build.py connect()） ----------
function toInt(str) {
  if (!/^\s*[+-]?\d+\s*$/.test(str)) throw new Error('invalid literal for int()');
  return parseInt(str, 10);
}
const isFalsy = d => d === null || d === undefined || d === 0 || d === '';
export function registerFunctions(db) {
  db.create_function('YEAR', (d) => isFalsy(d) ? null : toInt(String(d).slice(0, 4)));
  db.create_function('MONTH', (d) => isFalsy(d) ? null : toInt(String(d).slice(5, 7)));
  db.create_function('DAY', (d) => isFalsy(d) ? null : toInt(String(d).slice(8, 10)));
  db.create_function('LEFT', (s, n) => s == null || n == null ? null : [...String(s)].slice(0, Math.max(Math.trunc(n), 0)).join(''));
  db.create_function('RIGHT', (s, n) => {
    if (s == null || n == null) return null;
    const k = Math.trunc(n), a = [...String(s)];
    return k > 0 ? a.slice(Math.max(a.length - k, 0)).join('') : '';
  });
  db.create_function('MID', (s, st, n) => {
    if (s == null || st == null || n == null) return null;
    const a = Math.max(Math.trunc(st) - 1, 0);
    return [...String(s)].slice(a, a + Math.max(Math.trunc(n), 0)).join('');
  });
  db.create_function('LEN', (s) => s == null ? null : [...String(s)].length);
}

// ---------- DSE 扣分位（規則來自 levels.json 的 lint） ----------
export function lint(sql, rules) {
  const s = preprocess(sql);
  return rules.filter(r => new RegExp(r.pattern, 'is').test(s));
}

// ---------- 比較結果（= build.py same_rows / sorted_ok） ----------
const normVal = v => typeof v === 'number' ? Math.round(v * 1e4) / 1e4
  : (v instanceof Uint8Array ? '[blob]' : (v === undefined ? null : v));
const rowKey = r => JSON.stringify(r.map(normVal));

export function sameRows(a, b) {
  if (a.length !== b.length) return false;
  const m = new Map();
  for (const r of a) { const k = rowKey(r); m.set(k, (m.get(k) || 0) + 1); }
  for (const r of b) {
    const k = rowKey(r), n = m.get(k);
    if (!n) return false;
    m.set(k, n - 1);
  }
  return true;
}

// 兩組結果中「不同」的行數（多重集合差）
export function diffCount(a, b) {
  const m = new Map();
  for (const r of a) { const k = rowKey(r); m.set(k, (m.get(k) || 0) + 1); }
  let extra = 0;
  for (const r of b) {
    const k = rowKey(r), n = m.get(k);
    if (n) m.set(k, n - 1); else extra++;
  }
  let missing = 0;
  for (const n of m.values()) missing += n;
  return { missing, extra };
}

function cmp(x, y) {
  if (x === y) return 0;
  if (x === null) return -1;          // SQLite：NULL 排最前
  if (y === null) return 1;
  if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
  if (typeof x === 'number') return -1; // SQLite：數字排在文字之前
  if (typeof y === 'number') return 1;
  return String(x) < String(y) ? -1 : 1;
}

export function sortedOk(rows, order) {
  for (let i = 0; i < rows.length - 1; i++) {
    for (const o of order) {
      const c = cmp(normVal(rows[i][o.col]), normVal(rows[i + 1][o.col]));
      if (c === 0) continue;
      if ((o.dir === 'ASC' && c > 0) || (o.dir === 'DESC' && c < 0)) return false;
      break;
    }
  }
  return true;
}

// ---------- 輔助：去掉字串內容、切出 SELECT 清單 ----------
function maskStrings(s) {
  // 把 '...' 及 "..." 的內容換成空白，保留長度，方便找關鍵字
  return s.replace(/'(?:[^']|'')*'?|"[^"]*"?/g, m => m[0] + ' '.repeat(Math.max(m.length - 2, 0)) + (m.length > 1 ? m[m.length - 1] : ''));
}

function countStatements(s) {
  const m = maskStrings(s);
  return m.split(';').filter(x => x.trim() !== '').length;
}

function topSelectList(s) {
  const m = maskStrings(s);
  const start = m.search(/\bSELECT\b/i);
  if (start < 0) return null;
  let i = start + 6, depth = 0, from = -1;
  for (; i < m.length; i++) {
    const ch = m[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && /[\s)*]/.test(m[i - 1]) && /^FROM\b/i.test(m.slice(i))) { from = i; break; }
  }
  const body = s.slice(start + 6, from < 0 ? s.length : from);
  const masked = m.slice(start + 6, from < 0 ? m.length : from);
  // 按頂層逗號分割
  const items = []; let d = 0, last = 0;
  for (let j = 0; j < masked.length; j++) {
    if (masked[j] === '(') d++;
    else if (masked[j] === ')') d--;
    else if (masked[j] === ',' && d === 0) { items.push(body.slice(last, j).trim()); last = j + 1; }
  }
  items.push(body.slice(last).trim());
  return items.map(x => x.replace(/^DISTINCT\s+/i, '').trim()).filter(Boolean);
}

const AGG = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i;
const SQL_WORDS = new Set(('SELECT FROM WHERE AND OR NOT IN LIKE BETWEEN IS NULL GROUP BY HAVING ORDER ASC DESC DISTINCT AS ' +
  'UNION ALL INTERSECT EXCEPT MINUS INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE VIEW INDEX ALTER ADD COLUMN DROP ' +
  'JOIN LEFT RIGHT INNER OUTER FULL NATURAL ON EXISTS PRIMARY KEY FOREIGN REFERENCES UNIQUE CHECK DEFAULT ' +
  'COUNT SUM AVG MAX MIN YEAR MONTH DAY UPPER LOWER LENGTH SUBSTR CASE WHEN THEN ELSE END').split(' '));

// SELECT ENAME PRICE（漏了逗號）
export function missingCommaHint(sql) {
  const items = topSelectList(preprocess(sql));
  if (!items) return null;
  for (const it of items) {
    const m = it.match(/^([A-Za-z_][\w.]*)\s+([A-Za-z_]\w*)$/);
    if (m && !SQL_WORDS.has(m[2].toUpperCase()) && !SQL_WORDS.has(m[1].toUpperCase())) {
      return `你是不是漏了逗號？SELECT ${m[1]} ${m[2]} 會把 ${m[2]} 當成別名。`;
    }
  }
  return null;
}

// SELECT IID, MAX(PRICE) FROM ITEM（有聚合函數、沒有 GROUP BY）
export function nonAggregatedHint(sql) {
  const s = preprocess(sql);
  const masked = maskStrings(s);
  if (/\bGROUP\s+BY\b/i.test(masked)) return null;
  const items = topSelectList(s);
  if (!items || !items.some(it => AGG.test(it))) return null;
  const bare = items.some(it => {
    const x = it.replace(/\s+AS\s+\w+$/i, '').trim();
    return /^[A-Za-z_][\w]*(\.[A-Za-z_]\w*)?$/.test(x) && !SQL_WORDS.has(x.toUpperCase());
  });
  return bare ? 'SELECT 中有聚合函數時，其他欄位必須寫在 GROUP BY 中。' : null;
}

// ---------- 錯誤訊息翻譯 ----------
const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'DISTINCT', 'BETWEEN', 'LIKE',
  'UNION', 'INTERSECT', 'MINUS', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'VIEW', 'INDEX',
  'ALTER', 'EXISTS', 'COUNT', 'AVG', 'SUM', 'NULL', 'JOIN', 'INNER', 'LEFT', 'NATURAL', 'PRIMARY', 'UNIQUE', 'CHECK',
  'VARCHAR', 'INTEGER', 'CHAR', 'REFERENCES', 'DESC', 'AND'];

function editDistance(a, b) {   // Damerau（相鄰對調算一步）
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

function closest(word, list, maxD = 2) {
  const w = word.toUpperCase();
  if (w.length < 3) return null;
  let best = null, bd = 99;
  for (const k of list) {
    const kk = k.replace(' ', '');
    if (kk === w) return null;
    const dd = editDistance(w, kk);
    if (dd < bd && dd <= maxD && dd < kk.length - 1) { bd = dd; best = k; }
  }
  return best;
}

// 在整句 SQL 中找「像關鍵字但拼錯」的字
function typoInSql(sql, known) {
  const words = maskStrings(sql).match(/[A-Za-z_]+/g) || [];
  const knownSet = new Set(known.map(x => x.toUpperCase()));
  for (const w of words) {
    const W = w.toUpperCase();
    if (SQL_WORDS.has(W) || knownSet.has(W) || W.length < 4) continue;
    if (W === 'GROUPBY') return ['GROUPBY', 'GROUP BY'];
    if (W === 'ORDERBY') return ['ORDERBY', 'ORDER BY'];
    const k = closest(W, KEYWORDS);
    if (k) return [w, k];
  }
  return null;
}

export const ALL_MSG = '遊戲的數據庫不支援 ALL。考試時可以用 ALL；在這裏請改用子查詢配合 MAX 或 MIN。';
export const usesAll = sql => /(=|<|>)\s*ALL\s*\(/i.test(maskStrings(preprocess(sql)));

// names: { tables: [...], columns: [...] } 用來建議正確拼寫
export function translateError(msg, sql = '', names = { tables: [], columns: [] }) {
  const en = String(msg || '');
  const known = [...names.tables, ...names.columns];
  let m;
  const typo = () => {
    const t = typoInSql(sql, known);
    return t ? `你是不是想寫 ${t[1]}？（你寫了 ${t[0]}）` : '';
  };
  if ((m = en.match(/no such column: ([\w.]+)/i))) {
    const col = m[1];
    const quoted = new RegExp('"' + col.replace(/.*\./, '') + '"', 'i').test(sql);
    if (quoted) return { zh: `文字要用單引號 ' '，不要用雙引號。電腦把 "${col}" 當成了欄位名稱。`, en };
    const c = closest(col.replace(/.*\./, ''), names.columns, 2);
    return { zh: `找不到欄位 ${col}。請檢查拼寫，或打開 🗂 數據字典查看。` + (c ? `你是不是想寫 ${c}？` : ''), en };
  }
  if ((m = en.match(/no such table: ([\w.]+)/i))) {
    const t = closest(m[1], names.tables, 2);
    return { zh: `找不到資料表 ${m[1]}。請檢查拼寫。` + (t ? `你是不是想寫 ${t}？` : ''), en };
  }
  if ((m = en.match(/ambiguous column name: ([\w.]+)/i)))
    return { zh: `欄位 ${m[1]} 在兩個資料表都有，請寫成「表名.${m[1]}」，例如 ORDERS.${m[1]}。`, en };
  if ((m = en.match(/near "([^"]*)": syntax error/i))) {
    const x = m[1];
    if (x.toUpperCase() === 'ALL') return { zh: ALL_MSG, en };
    let zh = `「${x}」附近有語法錯誤。檢查：關鍵字有沒有串錯？有沒有漏了逗號或括號？子句次序對不對（SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY）？`;
    const k = /^[A-Za-z]+$/.test(x) && !SQL_WORDS.has(x.toUpperCase()) ? closest(x, KEYWORDS) : null;
    if (x.toUpperCase() === 'GROUPBY' || x.toUpperCase() === 'ORDERBY') zh += `你是不是想寫 ${x.slice(0, 5).toUpperCase()} BY？`;
    else if (k) zh += `你是不是想寫 ${k}？`;
    else { const t = typo(); if (t) zh += t; }
    return { zh, en };
  }
  if (/misuse of aggregate/i.test(en))
    return { zh: '聚合函數（COUNT、SUM、AVG、MAX、MIN）不可以放在 WHERE。分組後的條件用 HAVING；找最大／最小值用子查詢。', en };
  if (/incomplete input/i.test(en)) return { zh: 'SQL 未寫完。檢查括號和引號是否成對。', en };
  if (/unrecognized token/i.test(en)) return { zh: "有引號沒有關上。文字要用一對單引號 ' ' 包住。", en };
  if (/do not have the same number of result columns/i.test(en))
    return { zh: 'UNION / INTERSECT / MINUS 兩邊的欄位數目必須相同。', en };
  if (/GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate query/i.test(en)) return { zh: 'HAVING 要和 GROUP BY 一起使用。', en };
  if (/UNIQUE constraint failed/i.test(en)) return { zh: '違反 UNIQUE 或主鍵限制：這個值已經存在。', en };
  if (/NOT NULL constraint failed/i.test(en)) return { zh: '違反 NOT NULL 限制：這個欄位不可以是空值。', en };
  if (/CHECK constraint failed/i.test(en)) return { zh: '違反 CHECK 限制：數值不符合條件。', en };
  if (/FOREIGN KEY constraint failed/i.test(en)) return { zh: '違反參照完整性：外鍵指向的記錄不存在，或仍有其他記錄參照它。', en };
  if ((m = en.match(/no such function: (\w+)/i)))
    return { zh: `遊戲不支援函數 ${m[1]}。常用的有 COUNT、SUM、AVG、MAX、MIN、YEAR、UPPER、LENGTH。`, en };
  if (/already exists/i.test(en)) return { zh: '這個名稱已經存在，請檢查名稱。', en };
  const t = typo();
  return { zh: '執行時出錯。請對照重溫卡再檢查一次。' + t, en };
}

// ---------- 檢查器 ----------
export class Checker {
  constructor(SQL, dataA, patchB, lintRules = []) {
    this.SQL = SQL; this.dataA = dataA; this.patchB = patchB; this.rules = lintRules;
    this.cache = new Map();
    const db = this.fresh('A');
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0].values.map(r => r[0]);
    const cols = new Set();
    for (const t of tables) for (const r of db.exec(`PRAGMA table_info(${t})`)[0].values) cols.add(r[1]);
    db.close();
    this.names = { tables: [...tables, 'SUPPLIER', 'VIPORDER'], columns: [...cols, 'SUPID', 'SUPNAME', 'RATING', 'EMAIL', 'IDX_ODATE'] };
  }

  fresh(ds = 'A') {
    const db = new this.SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    registerFunctions(db);
    db.exec(this.dataA);
    if (ds === 'B') db.exec(this.patchB);
    return db;
  }

  version() {
    const db = new this.SQL.Database();
    const v = db.exec('SELECT sqlite_version()')[0].values[0][0];
    db.close();
    return v;
  }

  // 執行一句已預處理的 SQL；出錯時拋出 Error
  exec(db, s) {
    const stmt = db.prepare(s);
    try {
      const columns = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) rows.push(stmt.get());
      return { columns, rows };
    } finally { stmt.free(); }
  }

  // 公開：在新的數據庫上執行（不判斷對錯）
  run(sql, ds = 'A', db = null) {
    const own = !db;
    db = db || this.fresh(ds);
    try { return this.exec(db, preprocess(sql)); } finally { if (own) db.close(); }
  }

  err(e, sql) {
    const t = translateError(e && e.message, preprocess(sql), this.names);
    return { ok: false, kind: 'error', zh: t.zh, en: t.en };
  }

  // 執行前的共同檢查
  precheck(sql) {
    const s = preprocess(sql);
    if (!s) return { ok: false, kind: 'error', zh: '請先輸入 SQL。', en: '' };
    if (/[㐀-鿿]/.test(maskStrings(s)))
      return { ok: false, kind: 'error', zh: 'SQL 中有中文字。關鍵字、表名和欄位名都要用英文輸入。', en: '' };
    if (countStatements(s) > 1)
      return { ok: false, kind: 'error', zh: '一次只可以執行一句 SQL。請刪除中間的分號 ;', en: '' };
    if (usesAll(s)) return { ok: false, kind: 'error', zh: ALL_MSG, en: '' };
    return null;
  }

  // 「執行」按鈕：只執行，不判斷
  preview(level, sql) {
    const pre = this.precheck(sql);
    if (pre) return pre;
    const check = level.check || { mode: 'result' };
    const db = this.fresh('A');
    try {
      const r = this.exec(db, preprocess(sql));
      if (check.mode === 'state') {
        try { return { ok: true, note: '執行成功。以下是執行後的資料：', result: this.exec(db, check.query) }; }
        catch (e) { return { ok: true, note: '執行成功。', result: r.columns.length ? r : null }; }
      }
      if (check.mode === 'columns') return { ok: true, note: `執行成功。以下是 ${check.table} 表現在的欄位：`, result: this.exec(db, `SELECT name AS 欄位, type AS 類型 FROM pragma_table_info('${check.table}')`) };
      if (check.mode === 'index') return { ok: true, note: `執行成功。${check.table} 表現在的索引：`, result: this.exec(db, `SELECT name AS 索引 FROM pragma_index_list('${check.table}')`) };
      if (!r.columns.length) return { ok: true, note: '執行成功。', result: null };
      return { ok: true, result: r };
    } catch (e) { return this.err(e, sql); }
    finally { db.close(); }
  }

  expected(level, ds) {
    const key = level.id + ds;
    if (!this.cache.has(key)) this.cache.set(key, this.run(level.answer, ds));
    return this.cache.get(key);
  }

  stateAfter(sql, check, ds) {
    const db = this.fresh(ds);
    try {
      this.exec(db, preprocess(sql));
      if (check.mode === 'state') return this.exec(db, check.query).rows;
      if (check.mode === 'columns') return this.exec(db, `PRAGMA table_info(${check.table})`).rows.map(r => String(r[1]).toUpperCase());
      if (check.mode === 'index') {
        const idx = this.exec(db, `PRAGMA index_list(${check.table})`).rows.map(r => String(r[1]).toUpperCase());
        let cols = [];
        const real = this.exec(db, `PRAGMA index_list(${check.table})`).rows.map(r => r[1]).find(n => String(n).toUpperCase() === check.name.toUpperCase());
        if (real) cols = this.exec(db, `PRAGMA index_info(${real})`).rows.map(r => String(r[2]).toUpperCase());
        return { indexes: idx, cols };
      }
      if (check.mode === 'tests') {
        return check.tests.map(t => { try { this.exec(db, t.sql); return 'ok'; } catch (e) { return 'fail'; } });
      }
      throw new Error('unknown mode ' + check.mode);
    } finally { db.close(); }
  }

  // 「提交」：判斷對錯
  // 回傳 { ok, kind: 'pass'|'wrong'|'error', zh, en, lint:[msg], caps:[msg], result }
  judge(level, sql) {
    const pre = this.precheck(sql);
    const lintHits = lint(sql, this.rules).map(r => r.message);
    if (pre) return { ...pre, lint: lintHits, caps: [] };
    const check = level.check || { mode: 'result' };
    const caps = [...lintHits];
    const out = (o) => ({ lint: lintHits, caps, ...o });
    if (check.mode === 'result') return this.judgeResult(level, sql, out, caps);

    // ----- 改變數據 / 結構的題目 -----
    let sa;
    try { sa = this.stateAfter(sql, check, 'A'); }
    catch (e) { return out(this.err(e, sql)); }
    let display = null;
    try { display = this.preview(level, sql).result; } catch (e) { /* 只用於顯示 */ }

    if (check.mode === 'tests') {
      for (let i = 0; i < check.tests.length; i++) {
        if (sa[i] !== check.tests[i].expect)
          return out({ ok: false, kind: 'wrong', zh: `測試 ${i + 1} 不通過：${check.tests[i].msg}。`, result: display });
      }
      return out({ ok: true, kind: 'pass', result: display });
    }
    if (check.mode === 'columns') {
      if (!sa.includes('EMAIL'))
        return out({ ok: false, kind: 'wrong', zh: `${check.table} 表中找不到新欄位 EMAIL。請檢查欄位名稱。`, result: display });
      return out({ ok: true, kind: 'pass', result: display });
    }
    if (check.mode === 'index') {
      if (!sa.indexes.includes(check.name.toUpperCase()))
        return out({ ok: false, kind: 'wrong', zh: `找不到名為 ${check.name} 的索引。請檢查名稱及資料表。`, result: display });
      if (JSON.stringify(sa.cols) !== JSON.stringify(check.columns.map(c => c.toUpperCase())))
        return out({ ok: false, kind: 'wrong', zh: `索引 ${check.name} 的欄位不對：題目要 (${check.columns.join(', ')})。`, result: display });
      return out({ ok: true, kind: 'pass', result: display });
    }
    // state
    for (const ds of ['A', 'B']) {
      let got;
      try { got = ds === 'A' ? sa : this.stateAfter(sql, check, 'B'); }
      catch (e) { return out(this.err(e, sql)); }
      const exp = this.stateAfter(level.answer, check, ds);
      if (!sameRows(got, exp)) {
        if (ds === 'B') return out({ ok: false, kind: 'wrong', zh: HARDCODE_MSG, result: display });
        let before = null;
        try { const db = this.fresh('A'); before = this.exec(db, check.query).rows; db.close(); } catch (e) { /* 檢視還未建立 */ }
        if (before && sameRows(before, got))
          return out({ ok: false, kind: 'wrong', zh: '執行後，資料表的內容沒有改變。你的 SQL 有沒有真的修改數據？請檢查 WHERE 條件。', result: display });
        const d = diffCount(exp, got);
        const n = Math.max(d.missing, d.extra);
        return out({ ok: false, kind: 'wrong', zh: `執行後的數據和要求不一樣（有 ${n} 行不同）。請檢查 SET 的算式和 WHERE 條件。`, result: display });
      }
    }
    return out({ ok: true, kind: 'pass', result: display });
  }

  judgeResult(level, sql, out, caps) {
    let mine;
    try { mine = this.run(sql, 'A'); } catch (e) { return out(this.err(e, sql)); }
    const lintFirst = m => (out({}).lint.length ? out({}).lint[0] + '\n' : '') + m;
    if (!mine.columns.length)
      return out({ ok: false, kind: 'wrong', zh: '這一題要用 SELECT 查詢並顯示結果。', result: null });
    const exp = this.expected(level, 'A');
    const N = exp.columns.length, M = mine.columns.length;
    if (N !== M) {
      let zh = `欄位數目不對：題目要 ${N} 個欄位，你的結果有 ${M} 個。`;
      if (M === N - 1) { const h = missingCommaHint(sql); if (h) zh += '\n' + h; }
      return out({ ok: false, kind: 'wrong', zh: lintFirst(zh), result: mine });
    }
    if (!sameRows(mine.rows, exp.rows)) {
      for (const wh of level.wrongHints || []) {
        try { if (sameRows(this.run(wh.sql, 'A').rows, mine.rows)) return out({ ok: false, kind: 'wrong', zh: lintFirst(wh.msg), result: mine }); }
        catch (e) { /* 忽略 */ }
      }
      if (N > 1 && N <= 4 && permutedMatch(mine.rows, exp.rows, N))
        return out({ ok: false, kind: 'wrong', zh: lintFirst('數值正確，但欄位的次序和題目要求不同。請按題目的次序寫 SELECT 後面的欄位。'), result: mine });
      const k = mine.rows.length - exp.rows.length;
      let zh;
      if (k < 0) zh = `你的結果少了 ${-k} 行。檢查：WHERE 條件是否太嚴？AND / OR 有沒有用錯？是否需要外連接？`;
      else if (k > 0) zh = `你的結果多了 ${k} 行。檢查：WHERE 條件是否太寬鬆？需要 DISTINCT 嗎？多表查詢有沒有寫齊連接條件？`;
      else zh = '行數正確，但有些數值不對。檢查：條件、計算方法及 SELECT 的欄位是否正確。';
      return out({ ok: false, kind: 'wrong', zh: lintFirst(zh), result: mine });
    }
    if (level.sortBy && !sortedOk(mine.rows, level.sortBy)) {
      const desc = level.sortBy.map((o, i) => `${i ? '再按' : '先按'}「${exp.columns[o.col]}」${o.dir === 'ASC' ? '由小至大 (ASC)' : '由大至小 (DESC)'}`).join('，');
      return out({ ok: false, kind: 'wrong', zh: lintFirst(`結果正確，但次序不對。題目要求：${desc}排列。`), result: mine });
    }
    let mineB;
    try { mineB = this.run(sql, 'B'); } catch (e) { return out({ ok: false, kind: 'wrong', zh: HARDCODE_MSG, result: mine }); }
    const expB = this.expected(level, 'B');
    if (!sameRows(mineB.rows, expB.rows) || (level.sortBy && !sortedOk(mineB.rows, level.sortBy)))
      return out({ ok: false, kind: 'wrong', zh: HARDCODE_MSG, result: mine });
    const na = nonAggregatedHint(sql);
    if (na) caps.push(na);
    return out({ ok: true, kind: 'pass', result: mine });
  }
}

export const HARDCODE_MSG = '你的答案在另一組測試數據上不正確。你是不是直接寫了某個編號或數值，而不是寫出條件？';

function permutedMatch(a, b, n) {
  const perms = [];
  const p = (arr, rest) => rest.length ? rest.forEach((x, i) => p([...arr, x], rest.filter((_, j) => j !== i))) : perms.push(arr);
  p([], [...Array(n).keys()]);
  return perms.some(pm => pm.some((x, i) => x !== i) && sameRows(a.map(r => pm.map(i => r[i])), b));
}
