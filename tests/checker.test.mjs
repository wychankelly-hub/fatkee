// 單元測試：node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Checker, preprocess, lint, translateError, missingCommaHint, nonAggregatedHint, HARDCODE_MSG, ALL_MSG } from '../js/checker.js';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const data = JSON.parse(read('levels.json'));
const SQL = await initSqlJs();
const ck = new Checker(SQL, read('data/data_a.sql'), read('data/patch_b.sql'), data.lint);
const writes = data.levels.filter(l => l.type === 'write');

const lit = v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const curly = s => { let open = true; return s.replace(/'/g, () => (open = !open) ? '’' : '‘'); };

test('SQLite 版本 >= 3.39', () => {
  const [a, b] = ck.version().split('.').map(Number);
  assert.ok(a > 3 || (a === 3 && b >= 39), ck.version());
});

for (const l of writes) {
  test(`${l.id} 標準答案通過（三星）`, () => {
    const v = ck.judge(l, l.answer);
    assert.equal(v.ok, true, v.zh);
    assert.deepEqual(v.caps, []);
  });
  test(`${l.id} 彎引號仍然通過`, () => {
    const v = ck.judge(l, curly(l.answer) + ';');
    assert.equal(v.ok, true, v.zh);
  });
  test(`${l.id} 小寫仍然通過`, () => {
    const lower = l.answer.replace(/'[^']*'/g, m => '\u0000' + m).split('\u0000')
      .map(p => p.startsWith("'") ? p.replace(/^('[^']*')(.*)$/s, (m, q, r) => q + r.toLowerCase()) : p.toLowerCase()).join('');
    const v = ck.judge(l, lower);
    assert.equal(v.ok, true, v.zh + ' :: ' + lower);
  });
  for (const alt of l.alts || []) {
    test(`${l.id} 另一寫法通過：${alt.slice(0, 50)}`, () => {
      const v = ck.judge(l, alt);
      assert.equal(v.ok, true, v.zh);
    });
  }
  for (const wh of l.wrongHints || []) {
    test(`${l.id} 常見錯誤顯示專屬提示`, () => {
      const v = ck.judge(l, wh.sql);
      assert.equal(v.ok, false);
      assert.equal(v.zh, wh.msg);
    });
  }
  if ((l.check || {}).mode === 'result') {
    const a = ck.run(l.answer, 'A'), b = ck.run(l.answer, 'B');
    test(`${l.id} 死記答案在另一組數據失敗`, () => {
      const hard = 'VALUES ' + a.rows.map(r => '(' + r.map(lit).join(', ') + ')').join(', ');
      const v = ck.judge(l, hard);
      assert.equal(v.ok, false);
      if (!l.sortBy) assert.equal(v.zh, HARDCODE_MSG);
    });
    test(`${l.id} 數據 A 與 B 結果不同`, () => assert.notDeepEqual(a.rows, b.rows));
  }
  test(`${l.id} 有三個提示，第三個是答案`, () => {
    assert.equal(l.hints.length, 3);
    assert.equal(l.hints[2].trim(), l.answer.trim());
  });
}

test('漏寫括號（1-4）', () => {
  const l = data.levels.find(x => x.id === '1-4');
  assert.match(ck.judge(l, "SELECT IID, ENAME FROM ITEM WHERE PRICE < 40 AND CAT = 'NOODLE' OR CAT = 'RICE'").zh, /括號/);
});

test('數字加引號：通過但扣分', () => {
  const l = data.levels.find(x => x.id === '1-4');
  const v = ck.judge(l, "SELECT IID, ENAME FROM ITEM WHERE PRICE < '40' AND (CAT = 'NOODLE' OR CAT = 'RICE')");
  assert.equal(v.ok, true);
  assert.equal(v.caps.length, 1);
  assert.match(v.lint[0], /引號/);
});

test('雙引號文字', () => {
  const l = data.levels.find(x => x.id === '1-2');
  const v = ck.judge(l, 'SELECT ENAME, PRICE FROM ITEM WHERE CAT = "DRINK"');
  assert.ok(v.lint.some(m => /單引號/.test(m)));
});

test('欄位次序錯', () => {
  const l = data.levels.find(x => x.id === '1-2');
  assert.match(ck.judge(l, "SELECT PRICE, ENAME FROM ITEM WHERE CAT = 'DRINK'").zh, /次序/);
});

test('排序錯（2-5）', () => {
  const l = data.levels.find(x => x.id === '2-5');
  const v = ck.judge(l, 'SELECT ROLE, SNAME, SALARY FROM STAFF ORDER BY ROLE, SALARY');
  assert.equal(v.ok, false);
  assert.match(v.zh, /次序不對/);
});

test('少了／多了行', () => {
  const l = data.levels.find(x => x.id === '1-2');
  assert.match(ck.judge(l, "SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK' AND PRICE > 22").zh, /少了/);
  assert.match(ck.judge(l, 'SELECT ENAME, PRICE FROM ITEM').zh, /多了/);
});

test('漏了逗號', () => {
  const l = data.levels.find(x => x.id === '1-2');
  const v = ck.judge(l, "SELECT ENAME PRICE FROM ITEM WHERE CAT = 'DRINK'");
  assert.match(v.zh, /漏了逗號/);
  assert.equal(missingCommaHint('SELECT COUNT(*) AS TOTAL FROM ITEM'), null);
});

test('沒有 GROUP BY 的非聚合欄位', () => {
  assert.ok(nonAggregatedHint('SELECT IID, MAX(PRICE) FROM ITEM'));
  assert.equal(nonAggregatedHint('SELECT CAT, COUNT(*) FROM ITEM GROUP BY CAT'), null);
  assert.equal(nonAggregatedHint('SELECT COUNT(*), MIN(ODATE) FROM ORDERS'), null);
});

test('聚合函數放在 WHERE', () => {
  const l = data.levels.find(x => x.id === '7-1');
  const v = ck.judge(l, 'SELECT ENAME, PRICE FROM ITEM WHERE PRICE = MAX(PRICE)');
  assert.equal(v.ok, false);
  assert.match(v.zh, /聚合函數/);
});

test('ALL 不支援', () => {
  const l = data.levels.find(x => x.id === '7-1');
  assert.equal(ck.judge(l, 'SELECT ENAME, PRICE FROM ITEM WHERE PRICE >= ALL (SELECT PRICE FROM ITEM)').zh, ALL_MSG);
  const u = data.levels.find(x => x.id === '8-1');
  assert.notEqual(ck.judge(u, 'SELECT IID FROM ITEM UNION ALL SELECT IID FROM TWMENU').zh, ALL_MSG);
});

test('兩句 SQL', () => {
  const l = data.levels.find(x => x.id === '1-2');
  assert.match(ck.judge(l, "SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK'; DELETE FROM ITEM").zh, /一句/);
});

test('錯誤翻譯', () => {
  const names = ck.names;
  const t = (sql) => { try { ck.run(sql); return null; } catch (e) { return translateError(e.message, preprocess(sql), names).zh; } };
  assert.match(t('SELECT * FORM ITEM'), /FROM/);
  assert.match(t('SELCT * FROM ITEM'), /SELECT/);
  assert.match(t('SELECT ENAME FROM ITEMS'), /找不到資料表 ITEMS.*ITEM/);
  assert.match(t('SELECT ENAM FROM ITEM'), /找不到欄位 ENAM.*ENAME/);
  assert.match(t('SELECT OID FROM ORDERS, ODETAIL WHERE ORDERS.OID = ODETAIL.OID'), /兩個資料表/);
  assert.match(t('SELECT CAT FROM ITEM GROUPBY CAT'), /GROUP BY/);
  assert.match(t("SELECT * FROM ITEM WHERE CAT = 'DRINK"), /引號/);
  assert.match(t('SELECT * FROM ITEM WHERE (PRICE > 1'), /未寫完/);
  assert.match(t('SELECT CAT FROM ITEM HAVING COUNT(*) > 1'), /HAVING|聚合/);
  assert.match(t('SELECT IID FROM ITEM UNION SELECT IID, ENAME FROM TWMENU'), /欄位數目/);
  assert.match(t('SELECT FOO(1)'), /不支援函數 FOO/);
});

test('約束錯誤翻譯', () => {
  const l = data.levels.find(x => x.id === '9-1');
  assert.match(ck.judge(l, "INSERT INTO ITEM (IID, ENAME, CAT, PRICE, STOCK) VALUES ('D01', 'Hot Lemon Water', 'DRINK', 18, 30)").zh, /UNIQUE|主鍵/);
});

test('CREATE TABLE 限制不足', () => {
  const l = data.levels.find(x => x.id === '9-5');
  const v = ck.judge(l, 'CREATE TABLE SUPPLIER (SUPID CHAR(4) PRIMARY KEY, SUPNAME VARCHAR(30) NOT NULL, PHONE CHAR(8), RATING INTEGER CHECK (RATING BETWEEN 1 AND 5))');
  assert.equal(v.ok, false);
  assert.match(v.zh, /UNIQUE/);
  assert.equal(ck.judge(l, 'CREATE TABLE SUPPLIER (SUPID CHAR(4) PRIMARY KEY, SUPNAME VARCHAR(30) NOT NULL, PHONE CHAR(8) UNIQUE, RATING INTEGER CHECK (RATING >= 1 AND RATING <= 5))').ok, true);
});

test('UPDATE 漏了 WHERE', () => {
  const l = data.levels.find(x => x.id === '9-2');
  assert.equal(ck.judge(l, 'UPDATE ITEM SET PRICE = PRICE + 2').ok, false);
  assert.match(ck.judge(l, "SELECT * FROM ITEM WHERE CAT = 'DRINK'").zh, /沒有改變/);
});

test('UPDATE 死記編號', () => {
  const l = data.levels.find(x => x.id === '10-6');
  const sids = ck.run("SELECT SID FROM ORDERS WHERE YEAR(ODATE) = 2026 GROUP BY SID HAVING COUNT(*) >= 3").rows.map(r => `'${r[0]}'`);
  const v = ck.judge(l, `UPDATE STAFF SET SALARY = SALARY + 1000 WHERE SID IN (${sids.join(', ')})`);
  assert.equal(v.ok, false);
  assert.equal(v.zh, HARDCODE_MSG);
});

test('MINUS、Access 日期、* 萬用字元', () => {
  assert.equal(ck.judge(data.levels.find(x => x.id === '8-3'), 'select iid from item minus select iid from twmenu').ok, true);
  assert.equal(ck.judge(data.levels.find(x => x.id === '2-4'), 'SELECT OID, ODATE FROM ORDERS WHERE ODATE BETWEEN #1/1/2026# AND #30/6/2026#').ok, true);
  assert.equal(ck.judge(data.levels.find(x => x.id === '2-1'), "SELECT IID, ENAME FROM ITEM WHERE ENAME LIKE '*Bun*'").ok, true);
});

test('自訂函數', () => {
  const r = ck.run("SELECT YEAR('2026-03-04'), MONTH('2026-03-04'), DAY('2026-03-04'), LEFT('Milk Tea', 4), RIGHT('Milk Tea', 3), MID('Milk Tea', 6, 3), LEN('Milk Tea'), YEAR(NULL)").rows[0];
  assert.deepEqual(r, [2026, 3, 4, 'Milk', 'Tea', 'Tea', 8, null]);
});

test('預處理與 build.py 一致', () => {
  const samples = ["  SELECT * FROM ITEM;; ", "SELECT ‘DRINK’ ， “x”（1）", 'select iid from item minus select iid from twmenu',
    "WHERE ODATE = #3/7/2026# AND ENAME LIKE '*Bun?' AND X = '*'", 'SELECT 1；', 'SELECT IID FROM ITEM', 'SELECT IID FROM ITEM WHERE NOTMINUS = 1'];
  const py = execFileSync('python3', ['-c', `
import sys, json, importlib.util
src = open('build.py', encoding='utf-8').read().split('def connect')[0]
ns = {'__file__': 'build.py'}; exec(src, ns)
print(json.dumps([ns['preprocess'](s) for s in json.loads(sys.stdin.read())], ensure_ascii=False))
`], { cwd: new URL('.', root).pathname, input: JSON.stringify(samples) }).toString();
  assert.deepEqual(samples.map(preprocess), JSON.parse(py));
});

test('LINT 規則與 build.py 結果一致', () => {
  const samples = ["SELECT * FROM ITEM WHERE PRICE > '30'", 'SELECT * FROM ITEM WHERE PRICE ≤ 30', 'SELECT * FROM CUSTOMER WHERE PHONE = NULL',
    'SELECT * FROM ITEM WHERE CAT = "DRINK"', 'SELECT * FROM ITEM LIMIT 1', 'SELECT * FROM ITEM WHERE PRICE = MAX(PRICE)',
    'SELECT * FROM ITEM WHERE PRICE = (SELECT MAX(PRICE) FROM ITEM)', 'SELECT CAT FROM ITEM WHERE PRICE > 1 GROUP BY CAT HAVING COUNT(*) > 1'];
  const py = execFileSync('python3', ['-c', `
import sys, json
src = open('build.py', encoding='utf-8').read().split('# ---------- 比較結果')[0].replace('def connect', 'def _unused')
ns = {'__file__': 'build.py'}
exec(src.split('HERE =')[0] + src.split('PATCH_B = ')[1].split('\\n', 1)[1], ns)
print(json.dumps([ns['lint'](s) for s in json.loads(sys.stdin.read())]))
`], { cwd: new URL('.', root).pathname, input: JSON.stringify(samples) }).toString();
  assert.deepEqual(samples.map(s => lint(s, data.lint).map(r => r.code)), JSON.parse(py));
});

// ---------- 其他題型：資料要能執行，答案與數據一致 ----------
for (const l of data.levels) {
  if (l.type === 'order') test(`${l.id} 排列積木的 SQL 可以執行`, () => { ck.run(l.blocks.join(' ')); });
  if (l.type === 'bug') test(`${l.id} 修正句可以執行`, () => { ck.run(l.fix); assert.ok(l.wrong >= 0 && l.wrong < l.tokens.length); });
  if (l.type === 'predict') test(`${l.id} 推算題答案與數據一致`, () => {
    const rows = ck.run((l.evalQuery || l.query).replace(/\n/g, ' ')).rows;
    let truth;
    if (l.ask.includes('多少行')) truth = String(rows.length);
    else if (l.ask.includes('結果是')) truth = String(rows[0][0]);
    else truth = rows.map(r => r[0]).sort().join('、');
    const idx = l.options.findIndex(o => l.ask.includes('多少行') || l.ask.includes('結果是') ? o === truth : o.split('、').sort().join('、') === truth);
    assert.equal(idx, l.answer);
    if (!l.paperOnly) ck.run(l.query.replace(/\n/g, ' '));
  });
}
for (const w of data.worlds) test(`世界 ${w.id} 重溫卡例子可以執行`, () => { ck.run(w.card.example); });

// ---------- 進度碼 ----------
import { encode, decode } from '../js/progress.js';
test('進度碼來回轉換', () => {
  const stars = Array.from({ length: 64 }, (_, i) => (i * 7) % 4);
  const code = encode(stars, 6123);
  assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.deepEqual(decode(code), { classNo: 6123, stars });
  assert.deepEqual(decode(code.toLowerCase().replace(/-/g, ' ')), { classNo: 6123, stars });
  const bad = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A') + code.slice(6);
  assert.equal(decode(bad), null);
  assert.equal(decode('XXXX'), null);
});
