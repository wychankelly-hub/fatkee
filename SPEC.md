# 發記冰室數據大危機 — Build Spec for Claude Code

A self-paced SQL revision game for weak HKDSE ICT Form 6 students (Elective 2A Databases), played mainly on **iPhone Safari**, with no teacher present. All content (story, 64 levels, data, answers) is already written and tested. Your job is to build the game around it.

## 0. Files in this folder

| File | What it is |
|---|---|
| `SPEC.md` | This spec. Read it fully before starting. |
| `levels.json` | **Generated** game content: prologue, characters, 10 worlds (intro, concept card, outro), 64 levels, DSE mistake rules. Load this at runtime. |
| `content/worlds.py`, `content/levels.py` | Source of `levels.json`. Edit content here, never in the JSON. |
| `build.py` | Validates every level against both datasets and regenerates `levels.json`. Run `python3 build.py` after any content change; it must print 「全部通過」. |
| `data/data_a.sql` | The database students see and query. |
| `data/patch_b.sql` | Hidden check data. Dataset B = run `data_a.sql`, then `patch_b.sql`. Students never see B. |

`build.py` contains the reference Python version of the preprocessing, custom functions, mistake rules and result comparison. **The JavaScript checker must behave identically** (see §7 and §12).

## 1. Who the players are (read this, it drives every decision)

- Form 6, sitting HKDSE 2027 (revised curriculum). They have learned all the SQL; this is **revision**.
- **Weak** students. They read Traditional Chinese, but **type Chinese slowly** and **do not understand difficult English**.
- They play **alone on an iPhone**, in short sessions, with no teacher to ask. Every wrong answer must explain itself.
- The DSE paper is **handwritten**. The game must train precise SQL, not trial-and-error.

## 2. Hard rules (do not break these)

1. **Students only ever type English, digits and symbols.** All conditions use codes or English values (`'S05'`, `'DRINK'`, `'Mong Kok'`). Chinese appears only in the UI and in query **output**. Never add a level whose answer needs Chinese typing.
2. **All UI text is Traditional Chinese, simple written Chinese (書面語), no Cantonese colloquial** (no 唔、咗、嘅、晒). Use HKDSE terms (數據庫、資料表、欄位、記錄、子查詢、主鍵). Show the English term in brackets the first time a key term appears. Only SQL itself is English.
3. **No drag-and-drop anywhere.** Use tap-to-select only.
4. **Students do not log in.** The game stays on GitHub Pages. Optional anonymous aggregate analytics uses a separate collector, with developer-only authenticated reads. No student IDs, SQL answers, progress codes or persistent player identifiers are collected. See analytics/README.md.
5. **Stay inside the DSE 2A syllabus:** at most 3 tables per query, one level of subquery, no `LIMIT`/`TOP`, no window functions, no CTEs. Do not add levels outside this.
6. Never put a school name anywhere in the game.

## 3. Tech stack

- Plain HTML + CSS + vanilla JavaScript (ES modules are fine). No framework is needed; if you use one, keep the build output static.
- **sql.js** (SQLite compiled to WebAssembly), loaded from cdnjs or jsDelivr, or vendored into the repo. **Check the bundled SQLite version is 3.39 or newer** (needed for `RIGHT JOIN` / `FULL OUTER JOIN`). Run `SELECT sqlite_version()` once and log it.
- Load `data_a.sql` and `patch_b.sql` as text, build database A and database B in memory. For any level that changes data (INSERT/UPDATE/CREATE …), **rebuild a fresh copy for every attempt**, so a student's earlier attempt never affects the next. Easiest: keep the SQL text and call `new SQL.Database()` + `exec(text)` each time (the data is tiny; this takes milliseconds).
- `PRAGMA foreign_keys = ON` on every new database.
- **PWA**: add a `manifest.json` (name 「發記冰室」, icon, `display: standalone`) and a simple service worker that caches the app files, `levels.json`, the data files and the sql.js wasm file, so the game works offline after the first visit. The home screen should show a one-time tip 「把遊戲加到主畫面，進度會更安全」 with a short how-to for iPhone (Share → 加至主畫面). Reason: Safari may delete website data that has not been used for 7 days; a home-screen web app keeps its data.

## 4. SQL dialect bridge (DSE SQL → SQLite)

Apply this preprocessing to every student SQL before running it (same as `preprocess()` in `build.py`):

| Step | Why |
|---|---|
| Trim, remove a trailing `;` | Students may or may not type it. |
| Curly quotes `‘ ’ “ ”` → straight `' "` | iOS Smart Punctuation inserts curly quotes; without this every string condition fails. |
| Full-width `（ ） ，` → `( ) ,` | Chinese keyboard leftovers. |
| `MINUS` → `EXCEPT` (whole word, case-insensitive) | DSE uses MINUS; SQLite only has EXCEPT. |
| (Optional) `#30/6/2026#` → `'2026-06-30'` | Access-style dates appear in DSE marking schemes. |
| (Optional) inside a `LIKE '...'` pattern only, `*` → `%`, `?` → `_` | DSE accepts Access-style wildcards. |

Register custom functions on every database: `YEAR(d)`, `MONTH(d)`, `DAY(d)` (dates are stored as `'YYYY-MM-DD'` text), and optionally `LEFT(s,n)`, `RIGHT(s,n)`, `MID(s,start,len)`, `LEN(s)` (SQLite already has `UPPER`, `LOWER`, `LENGTH`, `SUBSTR`).

**Known gaps — do not try to fake these:**
- `>= ALL (subquery)` / `< ALL (...)`: SQLite does not support `ALL`. Levels using it are `predict` levels with `paperOnly: true`; they are never executed. If a student types `ALL` in a write level, show: 「遊戲的數據庫不支援 ALL。考試時可以用 ALL；在這裏請改用子查詢配合 MAX 或 MIN。」
- SQLite does not enforce `CHAR(n)` length and allows NULL in non-integer primary keys. The CREATE TABLE level's tests avoid relying on these.
- SQLite does integer division (`38*110/100` = 41). No level depends on it; if you add levels, avoid it.
- `NOT IN` returns nothing if the subquery contains NULL. The data avoids NULLs in foreign-key columns on purpose so that DSE-style `NOT IN` answers work. Keep it that way.

## 5. Screens and flow

1. **Home**: title, 「繼續」 (resume), 「開始故事」 (prologue on first play), 「世界地圖」, 「錯題簿」, 「人物」, 「進度碼」, 「設定」.
2. **Prologue**: the 5 lines from `prologue`, shown one at a time, tap to continue.
3. **World map**: 10 worlds as a vertical list of cards (not a wide map — phone portrait). Each card: number, title, topic, stars earned / possible, a small progress bar. **All worlds are open** (it is revision; students should be able to jump to a weak topic). Mark the recommended next world.
4. **World start**: intro line → **concept card** (重溫卡: title, bullet points, example SQL with the example's result table shown underneath, `exampleNote`). Button 「開始挑戰」. The card can be reopened from any level in that world (📖 button).
5. **Warm-up (溫故題)**: from world 3 onwards, before the first level, offer one random `write` level the student has already passed from an earlier world. Skippable. This is spaced retrieval practice; it gives no stars.
6. **Levels** in order within the world (level n+1 unlocks when n is passed).
7. **World end**: the `outro` line, stars summary. After world 7's final level (`finale: true`) show the reveal scene (發哥 confesses) before the outro.
8. **錯題簿 (review list)**: every level where the student used hint 3 or needed 3+ wrong attempts. Tap to replay. Remove from the list after a clean pass (no hints, first or second try).
9. **人物**: the `characters` list. Helps students remember who is who in the data.

## 6. Level screens (by `type`)

Common header: world/level number (e.g. 4-3), title, ★ count, 📖 concept card, 🗂 data dictionary.
Below it: the `story` line (small, italic, one speech bubble), then the `task` (larger, bold). Some levels have `tag: "挑戰"`; show a small 「挑戰題」 badge.

### `write` — type SQL
- A monospace text area. **Required attributes**: `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" inputmode="text"`, `font-size` at least **16px** (smaller makes iOS zoom in on focus).
- **Symbol bar** fixed directly above the keyboard (see §8): `*` `,` `'` `(` `)` `=` `<` `>` `%` `.` `_` and a ⌫ key. Each tap inserts at the cursor.
- **Keyword chips** (`SELECT FROM WHERE AND OR GROUP BY HAVING ORDER BY …`) shown only in worlds 1–3; from world 4 on, students type keywords themselves (they must spell them in the exam). A setting can turn chips back on.
- **Column/table chips**: tapping a table or column name in the data dictionary inserts it at the cursor. This is fine (the DSE paper gives the schema) and saves a lot of phone typing.
- Buttons: 「執行」 (run; shows result table or error, no judgement), 「提交」 (submit; judged), 「提示」 (hints, see §10).
- Allow uppercase or lowercase SQL. Optionally show a 「格式化」 button that uppercases keywords and adds line breaks before main clauses.

### `order` — 排列 SQL (tap blocks)
- Show `blocks` + `extra` shuffled as tappable chips. Tapping a chip moves it to the next empty slot in the answer line; tapping a placed chip sends it back. No dragging.
- Submit compares the sequence to `blocks` exactly. `extra` chips are distractors. On success, run the joined SQL and show its result.

### `predict` — 推算結果 (no Run button)
- Show `query` in a code block (keep line breaks), the `ask`, and `options` as large tap buttons (full width, min 48px tall).
- `answer` is the correct option index (computed by `build.py` from the real data). Show `explain` after answering, right or wrong. If not `paperOnly`, after answering offer 「執行看看」 to run the query on dataset A.

### `bug` — 找出錯處 (no Run button)
- Show `tokens` as a row of tappable word chips (wrap onto several lines). The student taps the wrong one. `wrong` is the correct token index.
- Then show `fix` with the changed part highlighted, plus `explain`.

### `mc` — 概念選擇題
- `question` + `options` as tap buttons; `answer` is the index; then `explain`.

## 7. Judging `write` levels

`check.mode` decides how. The model answer is `answer`; `alts` are other correct answers (they are already proven equivalent; you do not need to run them at runtime).

**`result` (default)**
1. Run the student's SQL on **dataset A**. If it errors → error feedback (§9). Stop.
2. Run `answer` on A. Compare:
   - Different number of columns → 「欄位數目不對：題目要 N 個欄位，你的結果有 M 個。」
   - Compare rows **as a multiset** (order ignored), numbers rounded to 4 decimal places. Column **names** and aliases are never compared.
   - Fewer/more rows → 「你的結果少了 / 多了 k 行。」 plus a pointer to check WHERE / DISTINCT / join conditions.
   - Same row count but different values → 「行數正確，但有些數值不對。」
3. If the level has `sortBy` (a list of `{col, dir}`; col is a 0-based column index): check the student's rows are sorted by those columns in those directions, ties allowed. Wrong → 「結果正確，但次序不對。題目要求……」
4. If A passes, run student SQL and `answer` on **dataset B** the same way. If B fails → 「你的答案在另一組測試數據上不正確。你是不是直接寫了某個編號或數值，而不是寫出條件？」 (this catches hard-coded answers).
5. If `wrongHints` exist and the student's result on A equals the result of a `wrongHints[i].sql`, show that message instead of the generic one.

**`state`** (INSERT/UPDATE/CREATE VIEW): run the student SQL on a fresh A, then run `check.query` and compare with the same steps after running `answer` on a fresh A. Then repeat on B. Compare rows as a multiset.

**`tests`** (CREATE TABLE): run the student SQL on a fresh A, then run each `check.tests[i].sql` in order on the same database. Each must succeed (`"ok"`) or fail (`"fail"`) as listed. For the first mismatch, show its `msg`.

**`columns`** (ALTER TABLE ADD): after running, `PRAGMA table_info(<table>)` must include the new column (`EMAIL`).

**`index`** (CREATE INDEX): after running, `PRAGMA index_list(<table>)` contains `check.name` and `PRAGMA index_info(<name>)` lists exactly `check.columns`.

**DSE mistake warnings (`lint` in levels.json)**: before running, test the preprocessed SQL against each `lint[i].pattern` (case-insensitive, dot matches newline). These catch things SQLite accepts but the DSE marks wrong (numbers in quotes, `≤`, `= NULL`, double-quoted strings, aggregate in WHERE, LIMIT). If a pattern matches **and the result is otherwise correct**, the level passes with **at most 2 stars**, and the message is shown in an orange 「DSE 扣分位」 box. If the result is also wrong, show the lint message first, since it is usually the cause.

Two more heuristics worth adding in JS (not in the JSON):
- **Missing comma** in the SELECT list (`SELECT ENAME PRICE FROM …` silently becomes an alias): if the column count is short by one and the SELECT list contains two bare identifiers separated only by a space → 「你是不是漏了逗號？SELECT ENAME PRICE 會把 PRICE 當成別名。」
- **Non-aggregated column with an aggregate and no GROUP BY** (`SELECT IID, MAX(PRICE) FROM ITEM` runs in SQLite but is wrong in the DSE) → 2-star cap with 「SELECT 中有聚合函數時，其他欄位必須寫在 GROUP BY 中。」

## 8. iPhone layout (the most important part to get right)

- Design for **375 × 667** (iPhone SE) first; it must also look right at 390–430 wide. Portrait only.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; respect `env(safe-area-inset-*)`.
- **No horizontal page scroll, ever.** Wide result tables scroll sideways **inside their own box** (`overflow-x: auto`), with the first column sticky. Use a compact table font (13–14px).
- **Keyboard handling**: when the text area is focused, the visible area shrinks to about half the screen. Use `window.visualViewport` to keep the symbol bar sitting on top of the keyboard and the 執行 / 提交 buttons reachable. While typing, collapse the story line and show only a one-line version of the task (tap to expand). Use `dvh` units, not `vh`.
- Tap targets **at least 44 × 44 px**; option buttons full width.
- The **data dictionary** (🗂) is a bottom sheet that slides up over the level: one tab per table, each showing columns (name, type, Chinese meaning, PK/FK marks) and, below, all rows of dataset A (it is small). Tapping a column or table name inserts it into the editor.
- The **result panel** appears below the editor; on submit, a feedback card slides up from the bottom with the message, stars and 「下一關」 / 「再試」.
- Font: system font stack for Chinese (`-apple-system, "PingFang HK", "Noto Sans TC", sans-serif`); monospace for SQL (`ui-monospace, Menlo, monospace`).
- Support light and dark mode (`prefers-color-scheme`).
- Test with Playwright WebKit using the iPhone SE and iPhone 15 device presets, plus a manual check on a real iPhone if possible (Smart Punctuation only happens on real devices).

**Look and feel**: a Hong Kong 茶餐廳 (cha chaan teng) theme: mosaic-tile accents, menu-board style headers, warm cream background, green/red accents. Keep it light and fast; no large images. Small emoji are fine for characters (☕🍞🍜). Readability beats decoration.

## 9. Error messages (SQLite → simple Chinese)

Translate the database error before showing it. Show the Chinese message large, and the original English error small and grey underneath (some students will see English errors in Hong Kong schools).

| SQLite error contains | Show |
|---|---|
| `no such column: X` | 找不到欄位 X。請檢查拼寫，或打開 🗂 數據字典查看。 |
| `no such table: X` | 找不到資料表 X。請檢查拼寫。 |
| `ambiguous column name: X` | 欄位 X 在兩個資料表都有，請寫成「表名.X」，例如 ORDERS.X。 |
| `near "X": syntax error` | 「X」附近有語法錯誤。檢查：關鍵字有沒有串錯？有沒有漏了逗號或括號？子句次序對不對（SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY）？ If X is within edit distance 2 of a keyword, add 「你是不是想寫 FROM？」 (FORM→FROM, SELCT→SELECT, WHER→WHERE, GROUPBY→GROUP BY). If X is `ALL`, use the ALL message in §4. |
| `misuse of aggregate` | 聚合函數（COUNT、SUM、AVG、MAX、MIN）不可以放在 WHERE。分組後的條件用 HAVING；找最大／最小值用子查詢。 |
| `incomplete input` | SQL 未寫完。檢查括號和引號是否成對。 |
| `unrecognized token` | 有引號沒有關上。文字要用一對單引號 ' ' 包住。 |
| `do not have the same number of result columns` | UNION / INTERSECT / MINUS 兩邊的欄位數目必須相同。 |
| `a GROUP BY clause is required before HAVING` | HAVING 要和 GROUP BY 一起使用。 |
| `UNIQUE constraint failed` | 違反 UNIQUE 或主鍵限制：這個值已經存在。 |
| `NOT NULL constraint failed` | 違反 NOT NULL 限制：這個欄位不可以是空值。 |
| `CHECK constraint failed` | 違反 CHECK 限制：數值不符合條件。 |
| `FOREIGN KEY constraint failed` | 違反參照完整性：外鍵指向的記錄不存在，或仍有其他記錄參照它。 |
| `no such function: X` | 遊戲不支援函數 X。常用的有 COUNT、SUM、AVG、MAX、MIN、YEAR、UPPER、LENGTH。 |
| anything else | 執行時出錯。請對照重溫卡再檢查一次。 |

## 10. Hints, stars and attempts

- Each `write` level has exactly 3 `hints`: (1) which idea/clause to use, (2) a skeleton with `___` blanks, (3) the full model answer.
- Stars: pass with no hint → ★★★; after hint 1 or a DSE-mistake warning → ★★; after hint 2 → ★. After **hint 3** the student sees the answer, the editor is cleared, and they must **type it in themselves** to finish (0 stars, level added to 錯題簿). Do not allow copy-paste of the shown answer into the editor (show it as an image-like block, or hide it once they start typing).
- Wrong attempts do not cost stars (we want students to try), but after 3 wrong submissions, gently suggest 「要不要看提示 1？」.
- After any pass, show `explain` (the teaching point) before 「下一關」. This matters: it is where DSE marking tips live.
- `order` / `predict` / `bug` / `mc`: ★★★ on the first try, ★ after a wrong try (the student must still pick the right answer to continue); always show `explain`.

## 11. Saving progress and the 進度碼

- Save to `localStorage` after every level (wrap every read/write in try/catch; the game must still run if storage is blocked, e.g. private browsing).
- **進度碼 (progress code)**: a short code that encodes stars per level (2 bits × 64 levels = 16 bytes) plus a version byte and a checksum, written in Crockford Base32 (no I, L, O, U), grouped as `XXXX-XXXX-…`. Screen 「進度碼」 shows the code with a 「複製」 button, and has a box to type a code to restore progress. Optionally ask for a class number (digits only) once, and include it in the code.
- This gives the teacher a simple check without a server: students paste their code to the teacher. Add a **teacher page** (`teacher.html`, not linked from the game menu) where the teacher pastes many codes (one per line) and sees a table: class number, stars per world, total, and which levels are in each student's 錯題簿-equivalent (0-star levels).

## 12. Data dictionary content (Chinese meanings)

| Table | Meaning | Columns |
|---|---|---|
| STAFF 員工 | 發記的員工 | SID 員工編號 (PK) · SNAME 名稱 · ROLE 職位 (BOSS/CASHIER/COOK/WAITER/DELIVERY) · SALARY 月薪 · HDATE 入職日期 · BOSS 上司的員工編號 (FK → STAFF.SID) |
| ITEM 食物 | 旺角總店餐牌 | IID 食物編號 (PK) · INAME 中文名稱 · ENAME 英文名稱 · CAT 類別 (DRINK/BREAD/NOODLE/RICE) · PRICE 價錢 · STOCK 庫存 |
| CUSTOMER 客人 | 登記會員 | CID 客人編號 (PK) · CNAME 名稱 · PHONE 電話 · DISTRICT 地區 · VIP 是否 VIP (Y/N) |
| ORDERS 訂單 | 每張訂單 | OID 訂單編號 (PK) · CID 客人編號 (FK) · SID 負責員工 (FK) · ODATE 日期 · OTYPE 類型 (DINE 堂食 / TAKE 外賣自取 / DELI 送遞) |
| ODETAIL 訂單內容 | 每張訂單點了甚麼 | OID (PK, FK) · IID (PK, FK) · QTY 數量 |
| TWMENU 荃灣分店餐牌 | 只在世界 8 使用 | IID 食物編號 (PK) · ENAME 英文名稱 · PRICE 價錢 |

Show TWMENU only from world 8 on, so it does not confuse students earlier.

## 13. Build order (suggested)

1. Scaffold: static page, load sql.js, build A and B, log SQLite version.
2. JS checker module (`checker.js`): preprocess, custom functions, run, compare, order check, lint, error translation. **Write unit tests** that, for every `write` level in `levels.json`, check that `answer` passes, each `alts` entry passes, each `wrongHints` SQL fails, and that a hard-coded version fails on B where possible. Also test the curly-quote case: replace `'` with `‘ ’` in an answer and confirm it still passes.
3. Level screens for the five types.
4. iPhone layout pass: keyboard, symbol bar, data dictionary sheet, result table. Test with Playwright WebKit iPhone presets.
5. Story screens, world map, stars, 錯題簿, warm-up.
6. Saving, progress code, teacher page.
7. PWA (manifest + service worker), GitHub Pages deploy.

## 14. Do not

- Do not add drag-and-drop, timers or leaderboards (weak students; self-paced revision).
- Do not require Chinese input anywhere, including names or settings.
- Do not show `LIMIT` or other non-syllabus SQL in hints, explanations or the concept cards.
- Do not edit `levels.json` by hand; change `content/*.py` and rerun `python3 build.py`.
- Do not show dataset B or mention it by name to students.

