# -*- coding: utf-8 -*-
"""驗證所有關卡並輸出 levels.json。
用法：python3 build.py
- 每條答案 SQL 都在數據 A 及隱藏數據 B 上執行
- 估結果題的正確答案由數據庫計算，不靠人手
- 搵錯處題：檢查原句確實有問題、修正句可以執行
任何問題都會令程式以錯誤結束。
"""
import json, re, sqlite3, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "content"))
from worlds import WORLDS, PROLOGUE, CHARACTERS, GAME_TITLE, GAME_SUBTITLE
from levels import LEVELS

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_A = open(os.path.join(HERE, "data/data_a.sql"), encoding="utf-8").read()
PATCH_B = open(os.path.join(HERE, "data/patch_b.sql"), encoding="utf-8").read()

# ---------- 與遊戲相同的預處理及自訂函數（JS 版要做一樣的事） ----------
def preprocess(sql):
    s = sql.replace("；", ";").replace("\u00a0", " ").strip().rstrip(";")
    s = s.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    s = s.replace("（", "(").replace("）", ")").replace("，", ",")   # 全形括號及逗號
    s = re.sub(r"\bMINUS\b", "EXCEPT", s, flags=re.I)
    # Access 式日期 #30/6/2026#（日/月/年）→ '2026-06-30'
    s = re.sub(r"#(\d{1,2})/(\d{1,2})/(\d{4})#",
               lambda m: "'%s-%02d-%02d'" % (m.group(3), int(m.group(2)), int(m.group(1))), s)
    # 只在 LIKE '...' 的樣式內：* → %，? → _
    s = re.sub(r"(\bLIKE\s*')([^']*)(')",
               lambda m: m.group(1) + m.group(2).replace("*", "%").replace("?", "_") + m.group(3), s, flags=re.I)
    return s

def _left(s, n): return None if s is None or n is None else str(s)[:max(int(n), 0)]
def _right(s, n): return None if s is None or n is None else (str(s)[-int(n):] if int(n) > 0 else "")
def _mid(s, a, n): return None if s is None or a is None or n is None else str(s)[max(int(a) - 1, 0):max(int(a) - 1, 0) + max(int(n), 0)]
def _len(s): return None if s is None else len(str(s))

def connect(dataset):
    c = sqlite3.connect(":memory:")
    c.execute("PRAGMA foreign_keys = ON")
    c.create_function("YEAR", 1, lambda d: int(str(d)[:4]) if d else None, deterministic=True)
    c.create_function("MONTH", 1, lambda d: int(str(d)[5:7]) if d else None, deterministic=True)
    c.create_function("DAY", 1, lambda d: int(str(d)[8:10]) if d else None, deterministic=True)
    c.create_function("LEFT", 2, _left, deterministic=True)
    c.create_function("RIGHT", 2, _right, deterministic=True)
    c.create_function("MID", 3, _mid, deterministic=True)
    c.create_function("LEN", 1, _len, deterministic=True)
    c.executescript(DATA_A)
    if dataset == "B":
        c.executescript(PATCH_B)
    return c

def run(sql, dataset="A"):
    c = connect(dataset)
    return c.execute(preprocess(sql)).fetchall()

# ---------- DSE 扣分位檢查（JS 版要實作相同規則） ----------
NUMERIC_COLS = ["PRICE", "STOCK", "SALARY", "QTY", "RATING"]
LINT = [
    ("quoted_number", r"\b(" + "|".join(NUMERIC_COLS) + r")\s*(=|<>|<=|>=|<|>)\s*'\d+(\.\d+)?'",
     "數字欄位的值不應加引號。DSE 評卷參考不接受給數值加引號（例如 '2012'），會被扣分。"),
    ("unicode_op", r"[≤≥≠]", "不可以用 ≤ ≥ ≠，要寫 <= >= <>。DSE 會當錯。"),
    ("eq_null", r"(=|<>|!=)\s*NULL\b", "NULL 不可以用 = 或 <> 比較，要用 IS NULL / IS NOT NULL。"),
    ("double_quote", r'"[^"]*"', "文字要用單引號 ' '，不要用雙引號。"),
    ("limit", r"\b(LIMIT|TOP)\b", "LIMIT / TOP 不是 DSE 課程的內容，考試時不要使用。"),
    ("agg_in_where", r"\bWHERE\b(?:(?!\bGROUP\b|\bHAVING\b|\(\s*SELECT\b).)*\b(COUNT|SUM|AVG|MAX|MIN)\s*\(",
     "聚合函數不可以放在 WHERE。分組後的條件用 HAVING；找最大／最小值用子查詢。"),
]
def lint(sql):
    s = preprocess(sql)
    found = []
    for code, pat, msg in LINT:
        if re.search(pat, s, flags=re.I | re.S):
            found.append(code)
    return found

# ---------- 比較結果 ----------
def norm_row(r):
    return tuple(round(v, 4) if isinstance(v, float) else v for v in r)

def same_rows(a, b):
    return sorted(map(norm_row, a), key=repr) == sorted(map(norm_row, b), key=repr)

def sorted_ok(rows, order):
    for i in range(len(rows) - 1):
        for o in order:
            x, y = rows[i][o["col"]], rows[i + 1][o["col"]]
            if x == y:
                continue
            if (o["dir"] == "ASC" and x > y) or (o["dir"] == "DESC" and x < y):
                return False
            break
    return True

def state_after(sql, check, dataset):
    c = connect(dataset)
    c.execute(preprocess(sql))
    mode = check["mode"]
    if mode == "state":
        return c.execute(check["query"]).fetchall()
    if mode == "columns":
        return [r[1] for r in c.execute(f"PRAGMA table_info({check['table']})")]
    if mode == "index":
        idx = [r[1].upper() for r in c.execute(f"PRAGMA index_list({check['table']})")]
        cols = [r[2] for r in c.execute(f"PRAGMA index_info({check['name']})")]
        return {"indexes": idx, "cols": cols}
    if mode == "tests":
        out = []
        for t in check["tests"]:
            try:
                c.execute(t["sql"]); out.append("ok")
            except sqlite3.Error:
                out.append("fail")
        return out
    raise ValueError(mode)

# ---------- 驗證 ----------
errors, warnings = [], []
def err(lid, msg): errors.append(f"[{lid}] {msg}")
def warn(lid, msg): warnings.append(f"[{lid}] {msg}")

ids = [l["id"] for l in LEVELS]
if len(ids) != len(set(ids)):
    errors.append("關卡編號重複")

for lvl in LEVELS:
    lid, t = lvl["id"], lvl["type"]
    try:
        if t == "write":
            check = lvl.get("check", {"mode": "result"})
            if lint(lvl["answer"]):
                err(lid, f"答案本身觸發扣分規則 {lint(lvl['answer'])}")
            if check["mode"] == "result":
                ra, rb = run(lvl["answer"], "A"), run(lvl["answer"], "B")
                if not ra:
                    err(lid, "答案在數據 A 沒有結果")
                if same_rows(ra, rb):
                    warn(lid, "數據 A 與 B 結果相同，未能捉到死記答案")
                for o in [lvl.get("sortBy")] if lvl.get("sortBy") else []:
                    if not sorted_ok(ra, o) or not sorted_ok(rb, o):
                        err(lid, "答案的排序與 sortBy 設定不符")
                for alt in lvl.get("alts", []):
                    for ds in "AB":
                        if not same_rows(run(alt, ds), run(lvl["answer"], ds)):
                            err(lid, f"另一寫法結果不同（數據 {ds}）：{alt}")
                for wh in lvl.get("wrongHints", []):
                    if same_rows(run(wh["sql"], "A"), ra):
                        err(lid, "常見錯誤寫法的結果竟然和答案一樣")
                lvl["_expectedA"] = [list(map(lambda v: v, r)) for r in ra]
            else:
                sa, sb = state_after(lvl["answer"], check, "A"), state_after(lvl["answer"], check, "B")
                if check["mode"] == "state":
                    before_a = connect("A").execute(check["query"]).fetchall() if "VIEW" not in lvl["answer"].upper() else None
                    if before_a is not None and same_rows(before_a, sa):
                        err(lid, "執行答案後數據沒有改變")
                    if same_rows(sa, sb):
                        warn(lid, "數據 A 與 B 狀態相同")
                if check["mode"] == "tests":
                    exp = [x["expect"] for x in check["tests"]]
                    if sa != exp:
                        err(lid, f"限制測試結果 {sa}，應為 {exp}")
                if check["mode"] == "columns" and "EMAIL" not in sa:
                    err(lid, "加欄位後找不到 EMAIL")
                if check["mode"] == "index" and (check["name"] not in sa["indexes"] or sa["cols"] != check["columns"]):
                    err(lid, f"索引檢查失敗 {sa}")
                for alt in lvl.get("alts", []):
                    if state_after(alt, check, "A") != sa:
                        err(lid, f"另一寫法結果不同：{alt}")
            if len(lvl.get("hints", [])) != 3:
                err(lid, "提示應有 3 個")
            if lvl["hints"][2].strip() != lvl["answer"].strip():
                err(lid, "第三個提示應等於標準答案")

        elif t == "order":
            sql = " ".join(lvl["blocks"])
            run(sql, "A")
            for x in lvl["extra"]:
                if x in lvl["blocks"]:
                    err(lid, f"干擾積木 {x} 與正確積木重複")

        elif t == "bug":
            buggy = " ".join(lvl["tokens"])
            run(lvl["fix"], "A")
            problem = None
            try:
                r = run(buggy, "A")
                if lint(buggy):
                    problem = "lint:" + ",".join(lint(buggy))
                elif not same_rows(r, run(lvl["fix"], "A")):
                    problem = "different result"
            except sqlite3.Error as e:
                problem = "error:" + str(e)
            if not problem:
                err(lid, "錯誤句子其實沒有問題")
            lvl["_problem"] = problem

        elif t == "predict":
            q = lvl.get("evalQuery") or lvl["query"]
            rows = run(q.replace("\n", " "), "A")
            opts = lvl["options"]
            if "多少行" in lvl["ask"]:
                truth = str(len(rows))
                match = [i for i, o in enumerate(opts) if o == truth]
            elif "結果是" in lvl["ask"]:
                truth = str(rows[0][0])
                match = [i for i, o in enumerate(opts) if o == truth]
            else:
                names = sorted(r[0] for r in rows)
                truth = "、".join(names)
                match = [i for i, o in enumerate(opts) if sorted(o.split("、")) == names]
            if len(match) != 1:
                err(lid, f"正確答案 {truth} 不在選項中（或出現多次）")
            else:
                lvl["answer"] = match[0]
            if not lvl.get("paperOnly"):
                run(lvl["query"].replace("\n", " "), "A")
        elif t == "mc":
            if not (0 <= lvl["answer"] < len(lvl["options"])):
                err(lid, "選擇題答案超出範圍")
        else:
            err(lid, f"未知題型 {t}")
    except sqlite3.Error as e:
        err(lid, f"SQL 錯誤：{e}")

# ---------- 故事及解釋中提到的數據事實 ----------
facts = [
    ("1-5 D02、D03、D04、B04", "SELECT IID FROM ITEM WHERE CAT = 'DRINK' AND PRICE > 22 OR STOCK < 12", lambda r: sorted(x[0] for x in r) == ["B04", "D02", "D03", "D04"]),
    ("2-6 五個地區", "SELECT DISTINCT DISTRICT FROM CUSTOMER", lambda r: len(r) == 5),
    ("3-4 COUNT(PHONE)=6", "SELECT COUNT(PHONE), COUNT(*) FROM CUSTOMER", lambda r: r[0] == (6, 8)),
    ("3-5 十五張訂單", "SELECT COUNT(*) FROM ORDERS", lambda r: r[0][0] == 15),
    ("4-5 菠蘿包賣得最多", "SELECT IID FROM ODETAIL GROUP BY IID ORDER BY SUM(QTY) DESC LIMIT 2", lambda r: r[0][0] == "B01"),
    ("4-7 各類平均價", "SELECT CAT, AVG(PRICE) FROM ITEM GROUP BY CAT ORDER BY CAT", lambda r: [round(x[1], 2) for x in r] == [17.75, 23.5, 40.0, 63.0]),
    ("W4 飛毛腿最勤力", "SELECT SID FROM ORDERS GROUP BY SID ORDER BY COUNT(*) DESC LIMIT 1", lambda r: r[0][0] == "S07"),
    ("5-3 8 張堂食、8 位客人", "SELECT (SELECT COUNT(*) FROM ORDERS WHERE OTYPE='DINE'), (SELECT COUNT(*) FROM CUSTOMER)", lambda r: r[0] == (8, 8)),
    ("6-1 雞尾包及好立克無人點", "SELECT IID FROM ITEM WHERE IID NOT IN (SELECT IID FROM ODETAIL)", lambda r: sorted(x[0] for x in r) == ["B03", "D04"]),
    ("6-4 每張訂單有客人、一人未落單", "SELECT (SELECT COUNT(*) FROM ORDERS WHERE CID IS NULL), (SELECT COUNT(*) FROM CUSTOMER WHERE CID NOT IN (SELECT CID FROM ORDERS))", lambda r: r[0] == (0, 1)),
    ("6-4 吳先生未落單", "SELECT CNAME FROM CUSTOMER WHERE CID NOT IN (SELECT CID FROM ORDERS)", lambda r: r == [("吳先生",)]),
    ("6-6 賣出 4 個菠蘿油", "SELECT SUM(QTY) FROM ODETAIL WHERE IID='B02'", lambda r: r[0][0] == 4),
    ("7-1 最高價 68", "SELECT MAX(PRICE) FROM ITEM", lambda r: r[0][0] == 68),
    ("7-6 廚師薪金", "SELECT SALARY FROM STAFF WHERE ROLE='COOK' ORDER BY SALARY DESC", lambda r: [x[0] for x in r] == [19000, 17500]),
    ("7-7 三位疑犯", "SELECT SNAME FROM STAFF WHERE SID NOT IN (SELECT SID FROM ORDERS)", lambda r: sorted(x[0] for x in r) == sorted(["發哥", "阿強", "肥波"])),
    ("8-2 12、6、4", "SELECT (SELECT COUNT(*) FROM ITEM), (SELECT COUNT(*) FROM TWMENU), (SELECT COUNT(*) FROM ITEM WHERE IID IN (SELECT IID FROM TWMENU))", lambda r: r[0] == (12, 6, 4)),
    ("10-5 DINE 8 DELI 4 TAKE 3", "SELECT OTYPE, COUNT(*) FROM ORDERS GROUP BY OTYPE ORDER BY OTYPE", lambda r: r == [("DELI", 4), ("DINE", 8), ("TAKE", 3)]),
    ("9-4 C08 無訂單（故事中先刪除 C08）", "SELECT COUNT(*) FROM ORDERS WHERE CID='C08'", lambda r: r[0][0] == 0),
]
for name, q, ok in facts:
    try:
        if not ok(run(q, "A")):
            errors.append(f"[事實] {name} 不成立：{run(q, 'A')}")
    except sqlite3.Error as e:
        errors.append(f"[事實] {name} SQL 錯誤 {e}")

# 每個世界的例子 SQL 也要能執行
for w in WORLDS:
    ex = w["card"]["example"].replace("\n", " ")
    try:
        c = connect("A"); c.execute(preprocess(ex)).fetchall()
    except sqlite3.Error as e:
        errors.append(f"[世界 {w['id']} 例子] {e}")

print(f"關卡數目：{len(LEVELS)}；題型：", {t: sum(1 for l in LEVELS if l['type'] == t) for t in ['order', 'write', 'predict', 'bug', 'mc']})
for w in warnings: print("提醒", w)
if errors:
    for e in errors: print("錯誤", e)
    sys.exit(1)

# ---------- 輸出 ----------
for l in LEVELS:
    l.pop("_expectedA", None); l.pop("_problem", None)
    if l["type"] == "write":
        l.setdefault("check", {"mode": "result"})
out = {
    "title": GAME_TITLE, "subtitle": GAME_SUBTITLE, "prologue": PROLOGUE,
    "characters": CHARACTERS, "worlds": WORLDS, "levels": LEVELS,
    "lint": [{"code": c, "pattern": p, "message": m} for c, p, m in LINT],
}
with open(os.path.join(HERE, "levels.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("全部通過，已輸出 levels.json")
