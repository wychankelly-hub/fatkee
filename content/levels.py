# -*- coding: utf-8 -*-
# 所有關卡。題型：
#   order   排列 SQL：按次序點選積木（不是拖拉）
#   write   寫 SQL：自己輸入，執行後與答案比較（數據 A 及隱藏數據 B）
#   predict 推算結果：看 SQL，選答案（不可執行）
#   bug     找出錯處：點出錯的詞語（不可執行）
#   mc      概念選擇題
# 所有學生要輸入的內容只需英文、數字及符號，永遠不需要輸入中文。

L = []
def lv(**k): L.append(k)

# ───────────────────────── 世界 1：第一天上班 ─────────────────────────
lv(id="1-1", world=1, type="order", title="看看餐牌",
   story="發哥：「先給我看所有食物的編號和英文名稱。」",
   task="按正確次序點選積木，顯示所有食物的 IID 及 ENAME。",
   blocks=["SELECT", "IID, ENAME", "FROM", "ITEM"], extra=["WHERE", "ORDERS"],
   explain="SELECT 先寫要顯示的欄位，FROM 再寫資料表。這是每一句查詢的骨架。")

lv(id="1-2", world=1, type="write", title="飲品有甚麼？",
   story="珍姐：「客人常問有甚麼飲品，我想要一張飲品價錢表。」",
   task="顯示所有飲品（CAT 為 'DRINK'）的英文名稱 ENAME 及價錢 PRICE。",
   answer="SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK'",
   hints=["資料在 ITEM 表。條件寫在 WHERE 後面。",
          "SELECT ENAME, PRICE FROM ITEM WHERE CAT = ___",
          "SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK'"],
   explain="DRINK 是文字，所以要加單引號。")

lv(id="1-3", world=1, type="bug", title="細妹的 SQL",
   story="細妹想找 30 元以上的食物，寫了這句 SQL。電腦可以執行，但 DSE 評卷員會扣分。",
   task="點出有問題的地方。",
   tokens=["SELECT", "ENAME", "FROM", "ITEM", "WHERE", "PRICE", ">", "'30'"], wrong=7,
   fix="SELECT ENAME FROM ITEM WHERE PRICE > 30",
   explain="PRICE 是數字欄位，30 不可以加引號。2025 年 DSE 評卷參考明確不接受給數值加引號（例如 '2012'）。")

lv(id="1-4", world=1, type="write", title="平價主食",
   story="一位學生客人只有 40 元：「有沒有 40 元以下的麵或飯？」",
   task="顯示價錢少於 40 元，而且類別是麵（'NOODLE'）或飯（'RICE'）的食物的 IID 及 ENAME。",
   answer="SELECT IID, ENAME FROM ITEM WHERE PRICE < 40 AND (CAT = 'NOODLE' OR CAT = 'RICE')",
   alts=["SELECT IID, ENAME FROM ITEM WHERE PRICE < 40 AND CAT IN ('NOODLE', 'RICE')"],
   hints=["有兩個條件：價錢，以及類別。類別有兩個可能。",
          "AND 比 OR 先計算。CAT 的兩個條件要用括號包住：PRICE < 40 AND ( ___ OR ___ )",
          "SELECT IID, ENAME FROM ITEM WHERE PRICE < 40 AND (CAT = 'NOODLE' OR CAT = 'RICE')"],
   wrongHints=[{"sql": "SELECT IID, ENAME FROM ITEM WHERE PRICE < 40 AND CAT = 'NOODLE' OR CAT = 'RICE'",
                "msg": "結果出現了貴價的飯！沒有括號時，電腦會先計 AND，所以變成「(40 元以下的麵) 或 (所有飯)」。"}],
   explain="AND 和 OR 一起用時，一定要用括號表達你的意思。")

lv(id="1-5", world=1, type="predict", title="推算一下",
   story="阿Ken 說他不用電腦也能算出結果。你呢？",
   query="SELECT IID\nFROM ITEM\nWHERE CAT = 'DRINK' AND PRICE > 22 OR STOCK < 12",
   ask="這句 SQL 會顯示多少行？",
   options=["2", "3", "4", "5"],
   explain="先計 AND：價錢大於 22 的飲品有 D02、D03、D04；再 OR 庫存少於 12 的 D04、B04。合併後是 D02、D03、D04、B04，共 4 行（D04 只計一次）。")

lv(id="1-6", world=1, type="write", title="加價計劃",
   story="發哥看到加租信，嘆氣：「麵類每款加 5 元吧。先讓我看看加價後的價錢。」",
   task="顯示所有麵類（'NOODLE'）的 IID 及加 5 元後的價錢。（不用真的修改數據）",
   answer="SELECT IID, PRICE + 5 FROM ITEM WHERE CAT = 'NOODLE'",
   hints=["SELECT 中可以直接寫算式。",
          "SELECT IID, PRICE ___ FROM ITEM WHERE CAT = 'NOODLE'",
          "SELECT IID, PRICE + 5 FROM ITEM WHERE CAT = 'NOODLE'"],
   explain="SELECT 中的算式只影響顯示結果，不會改動表內數據。真的要改，要用 UPDATE（世界 9）。")

# ───────────────────────── 世界 2：熟客名單 ─────────────────────────
lv(id="2-1", world=2, type="write", title="所有的包",
   story="Mr Food 的助手來電：「Mr Food 想試你們所有『包』類，英文名有 Bun 的那些。」",
   task="顯示英文名稱 ENAME 中含有 'Bun' 的食物的 IID 及 ENAME。",
   answer="SELECT IID, ENAME FROM ITEM WHERE ENAME LIKE '%Bun%'",
   hints=["要找「部分文字」，用 LIKE。",
          "% 代表任何字元。Bun 前後都可能有字：LIKE '___Bun___'",
          "SELECT IID, ENAME FROM ITEM WHERE ENAME LIKE '%Bun%'"],
   explain="'%Bun%' 表示 Bun 前後可以有任何文字。只寫 'Bun%' 會漏掉 Cocktail Bun。")

lv(id="2-2", world=2, type="write", title="街坊熟客",
   story="珍姐：「旺角和深水埗的街坊最捧場，我想送他們優惠券。」",
   task="顯示住在 'Mong Kok' 或 'Sham Shui Po' 的客人的 CNAME 及 DISTRICT。",
   answer="SELECT CNAME, DISTRICT FROM CUSTOMER WHERE DISTRICT IN ('Mong Kok', 'Sham Shui Po')",
   alts=["SELECT CNAME, DISTRICT FROM CUSTOMER WHERE DISTRICT = 'Mong Kok' OR DISTRICT = 'Sham Shui Po'"],
   hints=["一個欄位，兩個可能的值。可以用 OR，也可以用 IN。",
          "SELECT CNAME, DISTRICT FROM CUSTOMER WHERE DISTRICT IN ( ___ , ___ )",
          "SELECT CNAME, DISTRICT FROM CUSTOMER WHERE DISTRICT IN ('Mong Kok', 'Sham Shui Po')"],
   explain="IN 的寫法較短，也不容易漏寫欄位名稱。地區名稱的大小寫和空格要與數據一樣。")

lv(id="2-3", world=2, type="bug", title="沒有電話的客人",
   story="珍姐想找沒有留電話的客人，但結果是一個人也沒有。",
   task="點出出錯的地方。",
   tokens=["SELECT", "CNAME", "FROM", "CUSTOMER", "WHERE", "PHONE", "=", "NULL"], wrong=6,
   fix="SELECT CNAME FROM CUSTOMER WHERE PHONE IS NULL",
   explain="NULL 代表「未知」，任何值 = NULL 都不會成立。找空值一定要寫 IS NULL；找非空值寫 IS NOT NULL。")

lv(id="2-4", world=2, type="write", title="上半年的訂單",
   story="發哥：「評判要看今年上半年的訂單。」",
   task="顯示 2026 年 1 月 1 日至 2026 年 6 月 30 日（包括這兩天）的訂單的 OID 及 ODATE。日期格式是 'YYYY-MM-DD'。",
   answer="SELECT OID, ODATE FROM ORDERS WHERE ODATE BETWEEN '2026-01-01' AND '2026-06-30'",
   alts=["SELECT OID, ODATE FROM ORDERS WHERE ODATE >= '2026-01-01' AND ODATE <= '2026-06-30'"],
   hints=["一個範圍，包括頭尾 → BETWEEN。",
          "SELECT OID, ODATE FROM ORDERS WHERE ODATE BETWEEN ___ AND ___",
          "SELECT OID, ODATE FROM ORDERS WHERE ODATE BETWEEN '2026-01-01' AND '2026-06-30'"],
   explain="BETWEEN 包括頭尾兩個值。考試中的日期寫法可能不同，例如 #30/6/2026#，用題目給的格式即可。")

lv(id="2-5", world=2, type="write", title="員工名單",
   story="比賽報名表要列出全部員工，發哥要求：「同一職位放在一起，人工高的排前面。」",
   task="顯示所有員工的 ROLE、SNAME 及 SALARY。先按 ROLE 由 A 至 Z 排列；同一職位再按 SALARY 由高至低排列。",
   answer="SELECT ROLE, SNAME, SALARY FROM STAFF ORDER BY ROLE ASC, SALARY DESC",
   sortBy=[{"col": 0, "dir": "ASC"}, {"col": 2, "dir": "DESC"}],
   hints=["ORDER BY 後面可以寫兩個欄位，用逗號分隔，先寫的先排。",
          "SELECT ROLE, SNAME, SALARY FROM STAFF ORDER BY ROLE ___, SALARY ___",
          "SELECT ROLE, SNAME, SALARY FROM STAFF ORDER BY ROLE ASC, SALARY DESC"],
   explain="ASC 可以省略，但 DESC 不可以。每個欄位要各自寫 ASC 或 DESC。")

lv(id="2-6", world=2, type="predict", title="客人來自哪裏？",
   story="細妹想在地圖上標出客人來自的地區。",
   query="SELECT DISTINCT DISTRICT\nFROM CUSTOMER",
   ask="這句 SQL 會顯示多少行？（可打開數據字典查看 CUSTOMER 表）",
   options=["3", "5", "6", "8"],
   explain="CUSTOMER 有 8 位客人，但 DISTINCT 去除重複的地區：Mong Kok、Sham Shui Po、Tsuen Wan、Sha Tin、Central，共 5 行。")

# ───────────────────────── 世界 3：發哥要數 ─────────────────────────
lv(id="3-1", world=3, type="order", title="外賣有多少？",
   story="飛毛腿：「我送了多少張外賣單？」",
   task="按正確次序點選積木，計算送遞訂單（OTYPE 為 'DELI'）的數目。",
   blocks=["SELECT", "COUNT(*)", "FROM", "ORDERS", "WHERE", "OTYPE = 'DELI'"], extra=["SUM(*)", "GROUP BY"],
   explain="計算「有多少張」用 COUNT(*)；SUM 是把數值加起來，例如數量 QTY。")

lv(id="3-2", world=3, type="write", title="飲品平均價",
   story="評判問：「你們的飲品平均賣多少錢？」",
   task="計算所有飲品（'DRINK'）的平均價錢。",
   answer="SELECT AVG(PRICE) FROM ITEM WHERE CAT = 'DRINK'",
   hints=["平均用 AVG()。只計飲品，所以要有 WHERE。",
          "SELECT AVG( ___ ) FROM ITEM WHERE ___",
          "SELECT AVG(PRICE) FROM ITEM WHERE CAT = 'DRINK'"],
   explain="WHERE 先篩選出飲品，AVG 再計算這些記錄的平均值。")

lv(id="3-3", world=3, type="write", title="今年的訂單",
   story="發哥：「2026 年到現在，一共有多少張單？」",
   task="計算 2026 年的訂單數目。",
   answer="SELECT COUNT(*) FROM ORDERS WHERE YEAR(ODATE) = 2026",
   alts=["SELECT COUNT(*) FROM ORDERS WHERE ODATE BETWEEN '2026-01-01' AND '2026-12-31'"],
   hints=["YEAR(日期) 可以取出年份。",
          "SELECT COUNT(*) FROM ORDERS WHERE YEAR( ___ ) = ___",
          "SELECT COUNT(*) FROM ORDERS WHERE YEAR(ODATE) = 2026"],
   explain="YEAR(ODATE) 得出的是數字，所以 2026 不用加引號。用 BETWEEN 一整年的日期也正確。")

lv(id="3-4", world=3, type="bug", title="客人去了哪裏？",
   story="珍姐想數一數客人總數，應該是 8 位，但結果只有 6。",
   task="點出令結果錯誤的地方。",
   tokens=["SELECT", "COUNT(PHONE)", "FROM", "CUSTOMER"], wrong=1,
   fix="SELECT COUNT(*) FROM CUSTOMER",
   explain="COUNT(欄位) 不會計算 NULL。有 2 位客人沒有電話，所以少了 2 個。數記錄數目要用 COUNT(*)，或用不會是 NULL 的欄位，例如主鍵 CID。")

lv(id="3-5", world=3, type="predict", title="有多少位客人落過單？",
   story="阿麗看着 ORDERS 表：「訂單有 15 張，但很多是熟客重複光顧……」",
   query="SELECT COUNT(DISTINCT CID)\nFROM ORDERS",
   ask="這句 SQL 的結果是多少？",
   options=["15", "8", "7", "5"],
   explain="COUNT(DISTINCT CID) 只數不同的客人。15 張訂單來自 C01、C02、C03、C04、C05、C06、C07，共 7 位。C08 從未落單，所以不是 8。")

lv(id="3-6", world=3, type="write", title="細妹的紀錄",
   story="細妹：「我想知道我處理了多少張單，還有第一張是哪天。」",
   task="計算員工 'S05' 處理的訂單數目，以及最早的訂單日期。",
   answer="SELECT COUNT(*), MIN(ODATE) FROM ORDERS WHERE SID = 'S05'",
   hints=["一句 SQL 可以同時用兩個聚合函數。最早的日期 = 最小的日期。",
          "SELECT COUNT(*), ___(ODATE) FROM ORDERS WHERE SID = ___",
          "SELECT COUNT(*), MIN(ODATE) FROM ORDERS WHERE SID = 'S05'"],
   explain="日期也可以用 MIN 和 MAX：MIN 是最早，MAX 是最近。")

# ───────────────────────── 世界 4：誰是最勤力伙記 ─────────────────────────
lv(id="4-1", world=4, type="order", title="每人處理多少張？",
   story="阿Ken：「每個人處理了多少張單？列出來看看！」",
   task="按正確次序點選積木，顯示每位員工的 SID 及處理的訂單數目。",
   blocks=["SELECT", "SID, COUNT(*)", "FROM", "ORDERS", "GROUP BY", "SID"], extra=["WHERE", "ORDER BY"],
   explain="「每位」、「每種」、「每個」通常代表要 GROUP BY。SELECT 的 SID 沒有聚合函數，所以要寫在 GROUP BY。")

lv(id="4-2", world=4, type="write", title="每類有幾款？",
   story="發哥：「我們每一類食物各有幾款？」",
   task="顯示每個類別 CAT 及該類別的食物數目。",
   answer="SELECT CAT, COUNT(*) FROM ITEM GROUP BY CAT",
   hints=["「每個類別」→ GROUP BY CAT。",
          "SELECT CAT, COUNT(*) FROM ITEM GROUP BY ___",
          "SELECT CAT, COUNT(*) FROM ITEM GROUP BY CAT"],
   explain="GROUP BY CAT 把相同類別的食物放在一組，COUNT(*) 計算每組有多少行。")

lv(id="4-3", world=4, type="bug", title="阿Ken 的 SQL",
   story="阿Ken 想找處理了超過 2 張單的員工，電腦卻顯示錯誤。",
   task="點出放錯的關鍵字。",
   tokens=["SELECT", "SID,", "COUNT(*)", "FROM", "ORDERS", "WHERE", "COUNT(*)", ">", "2", "GROUP", "BY", "SID"], wrong=5,
   fix="SELECT SID, COUNT(*) FROM ORDERS GROUP BY SID HAVING COUNT(*) > 2",
   explain="WHERE 在分組之前執行，那時還未有 COUNT(*) 的結果，所以不可以放聚合函數。要改用 HAVING，並放在 GROUP BY 之後。這是 DSE 最常見的失分位之一。")

lv(id="4-4", world=4, type="write", title="勤力名單",
   story="細妹：「最佳員工的候選人，要處理了最少 3 張單。」",
   task="顯示處理了 3 張或以上訂單的員工的 SID 及訂單數目。",
   answer="SELECT SID, COUNT(*) FROM ORDERS GROUP BY SID HAVING COUNT(*) >= 3",
   hints=["先 GROUP BY SID，然後用 HAVING 篩選組別。",
          "SELECT SID, COUNT(*) FROM ORDERS GROUP BY SID HAVING ___",
          "SELECT SID, COUNT(*) FROM ORDERS GROUP BY SID HAVING COUNT(*) >= 3"],
   explain="「3 張或以上」是 >= 3，不是 > 3。條件中有 COUNT，所以一定用 HAVING。")

lv(id="4-5", world=4, type="write", title="銷量排行榜",
   story="阿強：「我的焗豬扒飯一定賣得最多！」",
   task="顯示每種食物的 IID 及總銷量（QTY 的總和），由銷量最多排到最少。",
   answer="SELECT IID, SUM(QTY) FROM ODETAIL GROUP BY IID ORDER BY SUM(QTY) DESC",
   sortBy=[{"col": 1, "dir": "DESC"}],
   hints=["銷量在 ODETAIL 表的 QTY。每種食物 → GROUP BY IID。",
          "SELECT IID, SUM(QTY) FROM ODETAIL GROUP BY IID ORDER BY ___ DESC",
          "SELECT IID, SUM(QTY) FROM ODETAIL GROUP BY IID ORDER BY SUM(QTY) DESC"],
   explain="ORDER BY 可以按聚合結果排序。注意次序：GROUP BY 在前，ORDER BY 在最後。（結果：菠蘿包賣得最多，阿強很不開心。）")

lv(id="4-6", world=4, type="write", title="堂食常客",
   story="阿Ken：「我想認識堂食的熟客，方便打招呼。」",
   task="只計堂食訂單（OTYPE 為 'DINE'），顯示光顧堂食 2 次或以上的客人的 CID 及次數。",
   answer="SELECT CID, COUNT(*) FROM ORDERS WHERE OTYPE = 'DINE' GROUP BY CID HAVING COUNT(*) >= 2",
   hints=["兩個條件：「只計堂食」是分組前篩選記錄；「2 次或以上」是分組後篩選組別。",
          "SELECT CID, COUNT(*) FROM ORDERS WHERE ___ GROUP BY CID HAVING ___",
          "SELECT CID, COUNT(*) FROM ORDERS WHERE OTYPE = 'DINE' GROUP BY CID HAVING COUNT(*) >= 2"],
   explain="同一句 SQL 可以同時有 WHERE 和 HAVING：WHERE 篩選記錄，HAVING 篩選組別。這正是 DSE 常考的組合。")

lv(id="4-7", world=4, type="predict", title="哪些類別夠高級？",
   story="Mr Food 的助手：「我們只拍平均價錢超過 30 元的類別。」",
   query="SELECT CAT, AVG(PRICE)\nFROM ITEM\nGROUP BY CAT\nHAVING AVG(PRICE) > 30",
   ask="這句 SQL 會顯示多少行？",
   options=["1", "2", "3", "4"],
   explain="各類平均價：BREAD 17.75、DRINK 23.5、NOODLE 40、RICE 63。超過 30 的只有 NOODLE 和 RICE，共 2 行。")

# ───────────────────────── 世界 5：訂單追蹤 ─────────────────────────
lv(id="5-1", world=5, type="order", title="訂單配客人",
   story="飛毛腿：「我只要知道每張單是誰的！」",
   task="按正確次序點選積木，顯示每張訂單的 OID 及客人名稱 CNAME。",
   blocks=["SELECT", "OID, CNAME", "FROM", "ORDERS, CUSTOMER", "WHERE", "ORDERS.CID = CUSTOMER.CID"],
   extra=["GROUP BY", "CID = CID"],
   explain="兩個表都有 CID，所以要寫 ORDERS.CID 和 CUSTOMER.CID，電腦才知道你指哪一個。只寫 CID = CID 會出錯。")

lv(id="5-2", world=5, type="write", title="誰送外賣？",
   story="珍姐：「每張送遞單是誰負責的？我要名字，不要編號！」",
   task="顯示每張送遞訂單（OTYPE 為 'DELI'）的 OID 及負責員工的名稱 SNAME。",
   answer="SELECT OID, SNAME FROM ORDERS, STAFF WHERE ORDERS.SID = STAFF.SID AND OTYPE = 'DELI'",
   alts=["SELECT OID, SNAME FROM ORDERS INNER JOIN STAFF ON ORDERS.SID = STAFF.SID WHERE OTYPE = 'DELI'",
         "SELECT OID, SNAME FROM ORDERS NATURAL JOIN STAFF WHERE OTYPE = 'DELI'"],
   hints=["員工名稱在 STAFF 表，訂單在 ORDERS 表，兩個表用 SID 連接。",
          "SELECT OID, SNAME FROM ORDERS, STAFF WHERE ORDERS.SID = ___ AND OTYPE = ___",
          "SELECT OID, SNAME FROM ORDERS, STAFF WHERE ORDERS.SID = STAFF.SID AND OTYPE = 'DELI'"],
   explain="WHERE 中同時有「連接條件」和「篩選條件」，用 AND 連起來。INNER JOIN ... ON 及 NATURAL JOIN 的寫法也正確。")

lv(id="5-3", world=5, type="predict", title="細妹又寫錯了",
   story="細妹想顯示堂食訂單及客人名稱，但結果長得嚇人。",
   query="SELECT OID, CNAME\nFROM ORDERS, CUSTOMER\nWHERE OTYPE = 'DINE'",
   ask="ORDERS 有 8 張堂食單，CUSTOMER 有 8 位客人。這句 SQL 會顯示多少行？",
   options=["8", "16", "64", "120"],
   explain="沒有連接條件 ORDERS.CID = CUSTOMER.CID，每張堂食單會配上每一位客人：8 × 8 = 64 行。這叫笛卡兒積。DSE 寫多表查詢時，一定要檢查連接條件。")

lv(id="5-4", world=5, type="write", title="陳大文吃過甚麼？",
   story="熟客陳大文（CID 'C01'）是比賽的嘉賓：「我在這裏吃過甚麼？我都忘了。」",
   task="顯示客人 'C01' 曾經點過的食物的英文名稱 ENAME，不要重複。",
   answer="SELECT DISTINCT ENAME FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND CID = 'C01'",
   hints=["要用三個表：ORDERS（誰的單）→ ODETAIL（單內有甚麼）→ ITEM（英文名稱）。三個表要兩個連接條件。",
          "SELECT DISTINCT ENAME FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ___ = ___ AND CID = 'C01'",
          "SELECT DISTINCT ENAME FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND CID = 'C01'"],
   explain="陳大文點過幾次奶茶，沒有 DISTINCT 便會重複出現。題目寫「不要重複」，就要加 DISTINCT。")

lv(id="5-5", world=5, type="write", title="誰是誰的上司？",
   story="阿麗是新同事，不知道誰是自己的上司。",
   task="顯示每位員工的名稱，以及其上司（BOSS）的名稱。（沒有上司的發哥不用顯示）",
   answer="SELECT A.SNAME, B.SNAME FROM STAFF A, STAFF B WHERE A.BOSS = B.SID",
   hints=["BOSS 欄位存的是上司的 SID，上司也在 STAFF 表。即是 STAFF 表要連接自己！",
          "把同一個表當成兩個：STAFF A（員工）、STAFF B（上司）。SELECT A.SNAME, B.SNAME FROM STAFF A, STAFF B WHERE ___",
          "SELECT A.SNAME, B.SNAME FROM STAFF A, STAFF B WHERE A.BOSS = B.SID"],
   explain="自連接要替同一個表起兩個別名，例如 A 和 B。連接條件是「員工的 BOSS = 上司的 SID」。")

lv(id="5-6", world=5, type="write", title="誰最捧場？",
   story="發哥：「我想送禮物給消費最多的客人。每人一共花了多少錢？」",
   task="顯示每位客人的 CID 及總消費（每項的 PRICE × QTY 加起來）。",
   answer="SELECT CID, SUM(PRICE * QTY) FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID GROUP BY CID",
   hints=["要三個表：ORDERS（客人編號）、ODETAIL（數量）、ITEM（價錢）。三個表要兩個連接條件，然後按客人分組。",
          "SELECT CID, SUM(PRICE * QTY) FROM ORDERS, ODETAIL, ITEM WHERE ___ AND ___ GROUP BY CID",
          "SELECT CID, SUM(PRICE * QTY) FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID GROUP BY CID"],
   explain="SUM 內可以寫算式 PRICE * QTY。連接 + GROUP BY + SUM 是 DSE 的常見組合。")

# ───────────────────────── 世界 6：消失的菠蘿油 ─────────────────────────
lv(id="6-1", world=6, type="write", title="所有食物的訂單",
   story="珍姐：「先列出每款食物出現過的訂單。沒有人點的食物也要列出來！」",
   task="顯示所有食物的 IID，以及它出現過的訂單 OID。從未有人點的食物也要顯示，OID 會是空值。",
   answer="SELECT ITEM.IID, OID FROM ITEM LEFT JOIN ODETAIL ON ITEM.IID = ODETAIL.IID",
   hints=["「也要顯示配對不到的」→ 外連接。ITEM 要全部保留，所以 ITEM 放在 LEFT JOIN 的左邊。",
          "SELECT ITEM.IID, OID FROM ITEM LEFT JOIN ODETAIL ON ___",
          "SELECT ITEM.IID, OID FROM ITEM LEFT JOIN ODETAIL ON ITEM.IID = ODETAIL.IID"],
   explain="LEFT JOIN 保留左表的所有記錄。雞尾包和好立克從未有人點，所以 OID 是空值。")

lv(id="6-2", world=6, type="write", title="沒有人點的食物",
   story="發哥：「從來沒有人點的食物，應該從餐牌刪除。是哪幾款？」",
   task="顯示從未有人點過的食物的 IID 及 ENAME。",
   answer="SELECT IID, ENAME FROM ITEM WHERE IID NOT IN (SELECT IID FROM ODETAIL)",
   alts=["SELECT ITEM.IID, ENAME FROM ITEM LEFT JOIN ODETAIL ON ITEM.IID = ODETAIL.IID WHERE ODETAIL.OID IS NULL"],
   hints=["方法一：LEFT JOIN 之後，找 OID 是空值的行。方法二：NOT IN 子查詢。",
          "SELECT IID, ENAME FROM ITEM WHERE IID NOT IN (SELECT ___ FROM ODETAIL)",
          "SELECT IID, ENAME FROM ITEM WHERE IID NOT IN (SELECT IID FROM ODETAIL)"],
   explain="兩種方法 DSE 都給分。用 LEFT JOIN 時，IS NULL 要檢查右表的欄位。")

lv(id="6-3", world=6, type="write", title="只看不吃的客人",
   story="珍姐：「有客人登記了會員，但從未落單！」",
   task="顯示從未下過任何訂單的客人的 CNAME。",
   answer="SELECT CNAME FROM CUSTOMER WHERE CID NOT IN (SELECT CID FROM ORDERS)",
   alts=["SELECT CNAME FROM CUSTOMER LEFT JOIN ORDERS ON CUSTOMER.CID = ORDERS.CID WHERE ORDERS.OID IS NULL"],
   hints=["和上一題一樣的思路，只是換了表：CUSTOMER 和 ORDERS。",
          "SELECT CNAME FROM CUSTOMER WHERE CID NOT IN (SELECT ___ FROM ORDERS)",
          "SELECT CNAME FROM CUSTOMER WHERE CID NOT IN (SELECT CID FROM ORDERS)"],
   explain="NOT IN 的意思：CID 不在「曾經落單的客人」名單之中。")

lv(id="6-4", world=6, type="predict", title="外連接有多少行？",
   story="阿麗：「如果用左外連接把客人和訂單接起來，會有多少行？」",
   query="SELECT *\nFROM CUSTOMER LEFT JOIN ORDERS\n  ON CUSTOMER.CID = ORDERS.CID",
   ask="ORDERS 有 15 張訂單（每張都有客人），8 位客人中只有 1 位從未落單。結果有多少行？",
   options=["8", "15", "16", "23"],
   explain="15 張訂單各自配上客人，共 15 行；從未落單的吳先生也要保留，再加 1 行，共 16 行。")

lv(id="6-5", world=6, type="write", title="菠蘿油的去向",
   story="珍姐：「先查清楚：哪些訂單賣出過菠蘿油（'B02'）？是誰經手的？」",
   task="顯示有菠蘿油 'B02' 的訂單的 OID、ODATE 及負責員工 SID。",
   answer="SELECT ORDERS.OID, ODATE, SID FROM ORDERS, ODETAIL WHERE ORDERS.OID = ODETAIL.OID AND IID = 'B02'",
   alts=["SELECT OID, ODATE, SID FROM ORDERS WHERE OID IN (SELECT OID FROM ODETAIL WHERE IID = 'B02')"],
   hints=["日期和員工在 ORDERS，食物編號在 ODETAIL。用 OID 連接。",
          "SELECT ORDERS.OID, ODATE, SID FROM ORDERS, ODETAIL WHERE ORDERS.OID = ODETAIL.OID AND ___",
          "SELECT ORDERS.OID, ODATE, SID FROM ORDERS, ODETAIL WHERE ORDERS.OID = ODETAIL.OID AND IID = 'B02'"],
   explain="SELECT 中的 OID 兩個表都有，要寫 ORDERS.OID，否則會出現「欄位名稱不清楚 (ambiguous)」的錯誤。")

lv(id="6-6", world=6, type="write", title="少了多少個？",
   story="珍姐：「庫存記錄顯示菠蘿油少了 9 個。到底賣出了多少個？」",
   task="計算菠蘿油 'B02' 總共賣出的數量。",
   answer="SELECT SUM(QTY) FROM ODETAIL WHERE IID = 'B02'",
   hints=["賣出的數量在 ODETAIL 的 QTY。要加起來。",
          "SELECT ___(QTY) FROM ODETAIL WHERE IID = 'B02'",
          "SELECT SUM(QTY) FROM ODETAIL WHERE IID = 'B02'"],
   explain="只賣出了 4 個，庫存卻少了 9 個……5 個菠蘿油去了哪裏？（下一個世界揭曉！）")

# ───────────────────────── 世界 7：真兇是誰 ─────────────────────────
lv(id="7-1", world=7, type="write", title="最貴的一碟",
   story="Mr Food：「我只拍最貴的那一款。」",
   task="顯示價錢最高的食物的 ENAME 及 PRICE。",
   answer="SELECT ENAME, PRICE FROM ITEM WHERE PRICE = (SELECT MAX(PRICE) FROM ITEM)",
   hints=["先用子查詢找出最高價錢，再找哪一款等於這個價錢。",
          "SELECT ENAME, PRICE FROM ITEM WHERE PRICE = (SELECT ___ FROM ITEM)",
          "SELECT ENAME, PRICE FROM ITEM WHERE PRICE = (SELECT MAX(PRICE) FROM ITEM)"],
   explain="子查詢 (SELECT MAX(PRICE) FROM ITEM) 先得出 68，外面再找 PRICE = 68 的食物。")

lv(id="7-2", world=7, type="bug", title="DSE 不收的寫法",
   story="阿Ken 說他有更短的寫法。",
   task="點出 DSE 評卷員不接受的地方。",
   tokens=["SELECT", "ENAME", "FROM", "ITEM", "WHERE", "PRICE", "=", "MAX(PRICE)"], wrong=7,
   fix="SELECT ENAME FROM ITEM WHERE PRICE = (SELECT MAX(PRICE) FROM ITEM)",
   explain="聚合函數不可以直接放在 WHERE。2025 年 DSE 評卷參考明確寫明不接受 WHERE PRICE = MAX(PRICE)。一定要用子查詢。")

lv(id="7-3", world=7, type="write", title="高薪一族",
   story="細妹（小聲）：「誰的人工比平均高？」",
   task="顯示薪金 SALARY 高於全體員工平均薪金的員工的 SNAME 及 SALARY。",
   answer="SELECT SNAME, SALARY FROM STAFF WHERE SALARY > (SELECT AVG(SALARY) FROM STAFF)",
   hints=["和上一題一樣，平均值要放在子查詢內。",
          "SELECT SNAME, SALARY FROM STAFF WHERE SALARY > (SELECT ___ FROM STAFF)",
          "SELECT SNAME, SALARY FROM STAFF WHERE SALARY > (SELECT AVG(SALARY) FROM STAFF)"],
   explain="子查詢先計算平均薪金，外面的查詢再逐個比較。")

lv(id="7-4", world=7, type="write", title="焗豬扒飯的粉絲",
   story="阿強：「誰點過我的焗豬扒飯（'R01'）？我要親自多謝他們！」",
   task="顯示曾經點過 'R01' 的客人的 CNAME。",
   answer="SELECT CNAME FROM CUSTOMER WHERE CID IN (SELECT CID FROM ORDERS, ODETAIL WHERE ORDERS.OID = ODETAIL.OID AND IID = 'R01')",
   alts=["SELECT DISTINCT CNAME FROM CUSTOMER, ORDERS, ODETAIL WHERE CUSTOMER.CID = ORDERS.CID AND ORDERS.OID = ODETAIL.OID AND IID = 'R01'"],
   hints=["子查詢找出點過 R01 的客人編號 CID（要連接 ORDERS 和 ODETAIL）；外面用 IN 找客人名稱。",
          "SELECT CNAME FROM CUSTOMER WHERE CID IN (SELECT CID FROM ORDERS, ODETAIL WHERE ___ AND IID = 'R01')",
          "SELECT CNAME FROM CUSTOMER WHERE CID IN (SELECT CID FROM ORDERS, ODETAIL WHERE ORDERS.OID = ODETAIL.OID AND IID = 'R01')"],
   explain="用 IN 子查詢，就算陳大文點過兩次，名字也只出現一次。如果改用三表連接，就要加 DISTINCT。")

lv(id="7-5", world=7, type="predict", title="EXISTS 是甚麼意思？",
   story="阿麗寫了一句 SQL，然後說：「疑犯不在這份名單上。」",
   query="SELECT SNAME\nFROM STAFF S\nWHERE EXISTS (SELECT *\n              FROM ORDERS O\n              WHERE O.SID = S.SID\n                AND O.OTYPE = 'DINE')",
   ask="這句 SQL 會顯示哪些員工？",
   options=["細妹、阿Ken、阿麗", "所有員工", "珍姐、飛毛腿", "發哥、阿強、肥波"],
   evalQuery="SELECT SNAME FROM STAFF S WHERE EXISTS (SELECT * FROM ORDERS O WHERE O.SID = S.SID AND O.OTYPE = 'DINE')",
   explain="對每一位員工，EXISTS 檢查「有沒有至少一張由他負責的堂食單」。有的話就顯示。處理過堂食單的是細妹、阿Ken 和阿麗。")

lv(id="7-6", world=7, type="predict", title="ALL 的意思",
   story="阿麗：「再看看這一句。」（這是紙筆題，遊戲的數據庫不支援 ALL。）",
   query="SELECT SNAME\nFROM STAFF\nWHERE SALARY >= ALL (SELECT SALARY\n                     FROM STAFF\n                     WHERE ROLE = 'COOK')",
   ask="這句 SQL 會顯示哪些員工？（廚師阿強 19000，肥波 17500）",
   options=["發哥、阿強", "發哥", "阿強、肥波", "發哥、阿強、肥波"],
   evalQuery="SELECT SNAME FROM STAFF WHERE SALARY >= (SELECT MAX(SALARY) FROM STAFF WHERE ROLE = 'COOK')",
   paperOnly=True,
   explain=">= ALL 代表「大於或等於子查詢中的每一個值」，即是大於或等於最高的 19000。發哥 30000 和阿強 19000 符合。阿強自己也符合，因為是「大於或等於」。")

lv(id="7-7", world=7, type="write", title="疑犯名單",
   story="阿麗：「偷吃菠蘿油的人，從來不用處理訂單——所以收銀機沒有他的記錄！」",
   task="顯示從未處理過任何訂單的員工的 SNAME。",
   answer="SELECT SNAME FROM STAFF WHERE SID NOT IN (SELECT SID FROM ORDERS)",
   alts=["SELECT SNAME FROM STAFF LEFT JOIN ORDERS ON STAFF.SID = ORDERS.SID WHERE ORDERS.OID IS NULL",
         "SELECT SNAME FROM STAFF S WHERE NOT EXISTS (SELECT * FROM ORDERS O WHERE O.SID = S.SID)"],
   hints=["從未出現在 ORDERS 表的 SID → NOT IN。",
          "SELECT SNAME FROM STAFF WHERE SID NOT IN (SELECT ___ FROM ORDERS)",
          "SELECT SNAME FROM STAFF WHERE SID NOT IN (SELECT SID FROM ORDERS)"],
   explain="疑犯有三位：發哥、阿強、肥波。阿強一直在廚房，有閉路電視作證；肥波那個星期放假……那就只剩下……",
   finale=True)

# ───────────────────────── 世界 8：荃灣開分店 ─────────────────────────
lv(id="8-1", world=8, type="write", title="兩店總餐牌",
   story="發哥：「兩間店加起來，一共賣多少款？我要一張不重複的總表。」",
   task="顯示旺角總店（ITEM）及荃灣分店（TWMENU）所有食物的 IID，不要重複。",
   answer="SELECT IID FROM ITEM UNION SELECT IID FROM TWMENU",
   hints=["合併兩個查詢的結果，而且去除重複 → UNION。",
          "SELECT IID FROM ITEM ___ SELECT IID FROM TWMENU",
          "SELECT IID FROM ITEM UNION SELECT IID FROM TWMENU"],
   explain="UNION 會自動去除重複。兩邊都是 SELECT 一個欄位，欄位數目相同。")

lv(id="8-2", world=8, type="predict", title="UNION ALL",
   story="分店經理用了另一個寫法。",
   query="SELECT IID FROM ITEM\nUNION ALL\nSELECT IID FROM TWMENU",
   ask="ITEM 有 12 款，TWMENU 有 6 款，其中 4 款兩店都有。結果有多少行？",
   options=["12", "14", "16", "18"],
   explain="UNION ALL 不去除重複，所以是 12 + 6 = 18 行。如果用 UNION，就是 12 + 6 − 4 = 14 行。")

lv(id="8-3", world=8, type="write", title="總店獨家",
   story="發哥：「哪些是只有旺角總店才吃得到的？這是我們的招牌！」",
   task="顯示在 ITEM 中有、但 TWMENU 中沒有的食物的 IID。",
   answer="SELECT IID FROM ITEM MINUS SELECT IID FROM TWMENU",
   alts=["SELECT IID FROM ITEM WHERE IID NOT IN (SELECT IID FROM TWMENU)"],
   hints=["「上面有、下面沒有」→ MINUS。用 NOT IN 也可以。",
          "SELECT IID FROM ITEM ___ SELECT IID FROM TWMENU",
          "SELECT IID FROM ITEM MINUS SELECT IID FROM TWMENU"],
   explain="MINUS 在部分系統叫 EXCEPT，DSE 兩個都接受。")

lv(id="8-4", world=8, type="write", title="兩店都有",
   story="分店經理：「兩間店都有賣的，價錢應該一致。先找出是哪幾款。」",
   task="顯示兩間店都有賣的食物的 IID。",
   answer="SELECT IID FROM ITEM INTERSECT SELECT IID FROM TWMENU",
   alts=["SELECT IID FROM ITEM WHERE IID IN (SELECT IID FROM TWMENU)"],
   hints=["「兩邊都有」→ INTERSECT。",
          "SELECT IID FROM ITEM ___ SELECT IID FROM TWMENU",
          "SELECT IID FROM ITEM INTERSECT SELECT IID FROM TWMENU"],
   explain="INTERSECT 取兩個結果的共同部分。用 IN 子查詢也可以得到相同結果。")

lv(id="8-5", world=8, type="write", title="VIP 專用檢視",
   story="發哥：「分店經理只需要看 VIP 的訂單，不可以看到客人電話。」",
   task="建立名為 VIPORDER 的檢視，顯示 VIP 客人（VIP 為 'Y'）的訂單的 OID、CNAME 及 ODATE。",
   answer="CREATE VIEW VIPORDER AS SELECT OID, CNAME, ODATE FROM ORDERS, CUSTOMER WHERE ORDERS.CID = CUSTOMER.CID AND VIP = 'Y'",
   check={"mode": "state", "query": "SELECT OID, CNAME, ODATE FROM VIPORDER"},
   hints=["先寫好 SELECT，再在前面加 CREATE VIEW 名稱 AS。",
          "CREATE VIEW VIPORDER AS SELECT OID, CNAME, ODATE FROM ORDERS, CUSTOMER WHERE ___ AND VIP = 'Y'",
          "CREATE VIEW VIPORDER AS SELECT OID, CNAME, ODATE FROM ORDERS, CUSTOMER WHERE ORDERS.CID = CUSTOMER.CID AND VIP = 'Y'"],
   explain="建立檢視後，經理可以直接 SELECT * FROM VIPORDER，看不到 PHONE 欄位。")

lv(id="8-6", world=8, type="mc", title="為甚麼用檢視？",
   story="分店經理問：「直接給我整個 CUSTOMER 表不就可以嗎？」",
   question="以下哪一項是使用檢視 (view) 的好處？",
   options=["可以限制用戶只看到部分欄位，保護私隱",
            "可以令數據庫佔用較少儲存空間",
            "可以自動備份數據",
            "可以令查詢一定執行得更快"],
   answer=0,
   explain="檢視可以隱藏敏感欄位（例如電話），也可以把複雜的查詢簡化。檢視不會儲存另一份數據，所以「省空間」或「備份」都不對；「一定更快」也不正確。")

# ───────────────────────── 世界 9：餐廳大改造 ─────────────────────────
lv(id="9-1", world=9, type="write", title="新飲品",
   story="阿強研發了新飲品：熱檸水！",
   task="新增一款食物：IID 'D09'，ENAME 'Hot Lemon Water'，CAT 'DRINK'，PRICE 18，STOCK 30。（中文名稱 INAME 留空，不用輸入）",
   answer="INSERT INTO ITEM (IID, ENAME, CAT, PRICE, STOCK) VALUES ('D09', 'Hot Lemon Water', 'DRINK', 18, 30)",
   check={"mode": "state", "query": "SELECT * FROM ITEM ORDER BY IID"},
   hints=["只填部分欄位時，要在表名後面列出欄位名稱。",
          "INSERT INTO ITEM (IID, ENAME, CAT, PRICE, STOCK) VALUES ( ___ )",
          "INSERT INTO ITEM (IID, ENAME, CAT, PRICE, STOCK) VALUES ('D09', 'Hot Lemon Water', 'DRINK', 18, 30)"],
   explain="文字加單引號，數字不加。數值的次序要和欄位名稱的次序一樣。")

lv(id="9-2", world=9, type="write", title="飲品加價",
   story="發哥：「加租了，所有飲品加 2 元吧。」",
   task="把所有飲品（'DRINK'）的價錢增加 2 元。",
   answer="UPDATE ITEM SET PRICE = PRICE + 2 WHERE CAT = 'DRINK'",
   check={"mode": "state", "query": "SELECT IID, PRICE FROM ITEM ORDER BY IID"},
   hints=["修改數據用 UPDATE ... SET ... WHERE ...",
          "UPDATE ITEM SET PRICE = ___ WHERE CAT = 'DRINK'",
          "UPDATE ITEM SET PRICE = PRICE + 2 WHERE CAT = 'DRINK'"],
   explain="PRICE = PRICE + 2 代表「新價錢 = 舊價錢 + 2」。如果漏寫 WHERE，全部食物都會加價！")

lv(id="9-3", world=9, type="write", title="停止入貨",
   story="發哥：「從來沒有人點的食物，不要再入貨了，庫存改為 0。」",
   task="把從未有人點過的食物的庫存 STOCK 設為 0。",
   answer="UPDATE ITEM SET STOCK = 0 WHERE IID NOT IN (SELECT IID FROM ODETAIL)",
   check={"mode": "state", "query": "SELECT IID, STOCK FROM ITEM ORDER BY IID"},
   hints=["UPDATE 的 WHERE 也可以用子查詢。「從未有人點過」→ 世界 6 學過的 NOT IN。",
          "UPDATE ITEM SET STOCK = 0 WHERE IID NOT IN (SELECT ___ FROM ODETAIL)",
          "UPDATE ITEM SET STOCK = 0 WHERE IID NOT IN (SELECT IID FROM ODETAIL)"],
   explain="UPDATE 配合子查詢是 DSE 常見題型（例如 2025 年 UPDATE + EXISTS）。")

lv(id="9-4", world=9, type="mc", title="刪除的次序",
   story="客人 C08 要求刪除他的所有資料。可是如果客人有訂單，事情就沒那麼簡單……",
   question="假設要刪除一位「有訂單」的客人，並且數據庫設有參照完整性 (referential integrity)。以下哪個刪除次序正確？",
   options=["ODETAIL → ORDERS → CUSTOMER",
            "CUSTOMER → ORDERS → ODETAIL",
            "ORDERS → CUSTOMER → ODETAIL",
            "只需刪除 CUSTOMER，其他表會自動刪除"],
   answer=0,
   explain="ODETAIL 的 OID 參照 ORDERS，ORDERS 的 CID 參照 CUSTOMER。要先刪除「參照別人」的記錄，最後才刪除「被參照」的記錄，否則會違反參照完整性。")

lv(id="9-5", world=9, type="write", title="供應商資料表",
   story="發記要記錄供應商的資料。發哥的要求寫在紙巾上……",
   task="建立 SUPPLIER 表：SUPID CHAR(4) 為主鍵；SUPNAME VARCHAR(30) 不可以是空值；PHONE CHAR(8) 不可以重複；RATING INTEGER，數值必須在 1 至 5 之間。",
   answer="CREATE TABLE SUPPLIER (SUPID CHAR(4) PRIMARY KEY, SUPNAME VARCHAR(30) NOT NULL, PHONE CHAR(8) UNIQUE, RATING INTEGER CHECK (RATING BETWEEN 1 AND 5))",
   check={"mode": "tests", "tests": [
       {"sql": "INSERT INTO SUPPLIER VALUES ('P001', 'Kam Kee Bakery', '23456789', 5)", "expect": "ok", "msg": "正常的記錄應該可以加入"},
       {"sql": "INSERT INTO SUPPLIER VALUES ('P001', 'Lucky Tea', '27777777', 4)", "expect": "fail", "msg": "SUPID 重複應該被拒絕（PRIMARY KEY）"},
       {"sql": "INSERT INTO SUPPLIER VALUES ('P002', NULL, '28888888', 3)", "expect": "fail", "msg": "SUPNAME 是空值應該被拒絕（NOT NULL）"},
       {"sql": "INSERT INTO SUPPLIER VALUES ('P003', 'Lucky Tea', '23456789', 3)", "expect": "fail", "msg": "PHONE 重複應該被拒絕（UNIQUE）"},
       {"sql": "INSERT INTO SUPPLIER VALUES ('P004', 'Lucky Tea', '29999999', 6)", "expect": "fail", "msg": "RATING 是 6 應該被拒絕（CHECK）"},
       {"sql": "INSERT INTO SUPPLIER VALUES ('P005', 'Lucky Tea', '26666666', 1)", "expect": "ok", "msg": "RATING 是 1 應該可以加入（1 至 5 包括 1）"},
   ]},
   hints=["每個欄位一行：欄位名稱、數據類型、限制。用逗號分隔。",
          "CREATE TABLE SUPPLIER (SUPID CHAR(4) PRIMARY KEY, SUPNAME VARCHAR(30) ___, PHONE CHAR(8) ___, RATING INTEGER CHECK ( ___ ))",
          "CREATE TABLE SUPPLIER (SUPID CHAR(4) PRIMARY KEY, SUPNAME VARCHAR(30) NOT NULL, PHONE CHAR(8) UNIQUE, RATING INTEGER CHECK (RATING BETWEEN 1 AND 5))"],
   explain="四種限制：PRIMARY KEY（唯一且不可空）、NOT NULL、UNIQUE、CHECK（自訂條件）。CHECK (RATING >= 1 AND RATING <= 5) 也正確。")

lv(id="9-6", world=9, type="write", title="加入電郵",
   story="珍姐：「我想用電郵通知客人比賽結果，可是表裏沒有電郵這一欄。」",
   task="在 CUSTOMER 表加入一個新欄位 EMAIL，數據類型為 VARCHAR(40)。",
   answer="ALTER TABLE CUSTOMER ADD EMAIL VARCHAR(40)",
   alts=["ALTER TABLE CUSTOMER ADD COLUMN EMAIL VARCHAR(40)"],
   check={"mode": "columns", "table": "CUSTOMER"},
   hints=["修改資料表的結構用 ALTER TABLE。",
          "ALTER TABLE CUSTOMER ADD ___ ___",
          "ALTER TABLE CUSTOMER ADD EMAIL VARCHAR(40)"],
   explain="ALTER TABLE 改的是表的結構（欄位），UPDATE 改的是表內的數據。兩者不要混淆。")

lv(id="9-7", world=9, type="write", title="加快搜尋",
   story="訂單越來越多，按日期搜尋變慢了。",
   task="在 ORDERS 表的 ODATE 欄位建立一個名為 IDX_ODATE 的索引 (index)。",
   answer="CREATE INDEX IDX_ODATE ON ORDERS (ODATE)",
   check={"mode": "index", "name": "IDX_ODATE", "table": "ORDERS", "columns": ["ODATE"]},
   hints=["CREATE INDEX 索引名稱 ON 表名 (欄位)",
          "CREATE INDEX IDX_ODATE ON ___ ( ___ )",
          "CREATE INDEX IDX_ODATE ON ORDERS (ODATE)"],
   explain="索引令搜尋更快，但會佔用額外空間，而且每次新增或修改記錄時都要更新索引，所以不應為所有欄位建立索引。")

lv(id="9-8", world=9, type="mc", title="交易做到一半",
   story="飛毛腿用手機付款給供應商，App 先扣了發記的錢，然後……手機沒電了！供應商沒有收到錢。",
   question="數據庫應如何處理這個未完成的交易 (transaction)？",
   options=["回滾 (rollback)：取消已做的扣款，回到交易開始前的狀態",
            "保留已扣的款項，等飛毛腿充電後再處理",
            "刪除整個發記的帳戶記錄",
            "建立索引，加快下次付款的速度"],
   answer=0,
   explain="交易中的步驟要麼全部完成，要麼全部取消。中途失敗時，回滾可以把數據還原到交易開始前的狀態，保持數據一致。")

# ───────────────────────── 世界 10：決賽 ─────────────────────────
lv(id="10-1", world=10, type="write", title="決賽第一題",
   story="Mr Food：「每個地區有多少位 VIP？只告訴我多於 1 位的地區。」",
   task="只計 VIP 客人（VIP 為 'Y'），顯示 VIP 數目多於 1 的地區 DISTRICT 及 VIP 數目。",
   answer="SELECT DISTRICT, COUNT(*) FROM CUSTOMER WHERE VIP = 'Y' GROUP BY DISTRICT HAVING COUNT(*) > 1",
   hints=["WHERE 先只留 VIP；GROUP BY 地區；HAVING 篩選數目。",
          "SELECT DISTRICT, COUNT(*) FROM CUSTOMER WHERE ___ GROUP BY ___ HAVING ___",
          "SELECT DISTRICT, COUNT(*) FROM CUSTOMER WHERE VIP = 'Y' GROUP BY DISTRICT HAVING COUNT(*) > 1"],
   explain="WHERE + GROUP BY + HAVING 一起用，是 DSE 卷二 A 幾乎每年都考的組合。")

lv(id="10-2", world=10, type="write", title="決賽第二題",
   story="Mr Food：「2025 年 12 月的營業額是多少？」",
   task="計算 2025 年 12 月所有訂單的總營業額（每項 PRICE × QTY 的總和）。",
   answer="SELECT SUM(PRICE * QTY) FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND ODATE BETWEEN '2025-12-01' AND '2025-12-31'",
   hints=["日期在 ORDERS、數量在 ODETAIL、價錢在 ITEM：三個表，兩個連接條件，再加日期條件。",
          "SELECT SUM(PRICE * QTY) FROM ORDERS, ODETAIL, ITEM WHERE ___ AND ___ AND ODATE BETWEEN ___ AND ___",
          "SELECT SUM(PRICE * QTY) FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND ODATE BETWEEN '2025-12-01' AND '2025-12-31'"],
   explain="三表連接 + 聚合 + 日期範圍，是典型的 DSE 綜合題。")

lv(id="10-3", world=10, type="write", title="決賽第三題",
   story="Mr Food：「哪些飲品比你們飲品的平均價錢貴？」",
   task="顯示價錢高於「所有飲品平均價錢」的飲品的 ENAME 及 PRICE。",
   answer="SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK' AND PRICE > (SELECT AVG(PRICE) FROM ITEM WHERE CAT = 'DRINK')",
   hints=["外面要篩選飲品，子查詢內也要只計飲品的平均價錢。兩個地方都要寫 CAT = 'DRINK'。",
          "SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK' AND PRICE > (SELECT AVG(PRICE) FROM ITEM WHERE ___)",
          "SELECT ENAME, PRICE FROM ITEM WHERE CAT = 'DRINK' AND PRICE > (SELECT AVG(PRICE) FROM ITEM WHERE CAT = 'DRINK')"],
   explain="常見錯誤：子查詢忘記寫 WHERE CAT = 'DRINK'，結果和「全部食物的平均價錢」比較。")

lv(id="10-4", world=10, type="write", title="決賽第四題",
   story="Mr Food：「有沒有客人只吃麵、從不吃飯？我想訪問他。」",
   task="顯示曾經點過麵類（'NOODLE'），但從未點過飯類（'RICE'）的客人的 CNAME。",
   answer="SELECT CNAME FROM CUSTOMER WHERE CID IN (SELECT CID FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND CAT = 'NOODLE') AND CID NOT IN (SELECT CID FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND CAT = 'RICE')",
   tag="挑戰",
   hints=["兩個子查詢：一個找「點過麵的 CID」，一個找「點過飯的 CID」。外面用 IN 和 NOT IN。",
          "SELECT CNAME FROM CUSTOMER WHERE CID IN (點過麵的 CID) AND CID NOT IN (點過飯的 CID)。每個子查詢都要連接 ORDERS、ODETAIL、ITEM。",
          "SELECT CNAME FROM CUSTOMER WHERE CID IN (SELECT CID FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND CAT = 'NOODLE') AND CID NOT IN (SELECT CID FROM ORDERS, ODETAIL, ITEM WHERE ORDERS.OID = ODETAIL.OID AND ODETAIL.IID = ITEM.IID AND CAT = 'RICE')"],
   explain="把難題拆開：先各自寫好兩個子查詢，再用 IN / NOT IN 組合。每個子查詢只有一層，符合課程範圍。")

lv(id="10-5", world=10, type="predict", title="決賽第五題",
   story="Mr Food：「不用電腦，告訴我這句 SQL 的結果。」",
   query="SELECT OTYPE, COUNT(*)\nFROM ORDERS\nGROUP BY OTYPE\nHAVING COUNT(*) > 4",
   ask="ORDERS 中：DINE 8 張、DELI 4 張、TAKE 3 張。這句 SQL 會顯示多少行？",
   options=["0", "1", "2", "3"],
   explain="只有 DINE 的 8 張大於 4。DELI 剛好 4 張，「> 4」不成立。所以只有 1 行。")

lv(id="10-6", world=10, type="write", title="決賽最後一題",
   story="Mr Food：「最後一題。勤力的員工應該加人工——你來決定誰。」",
   task="2026 年處理了 3 張或以上訂單的員工，每人的 SALARY 增加 1000。",
   answer="UPDATE STAFF SET SALARY = SALARY + 1000 WHERE SID IN (SELECT SID FROM ORDERS WHERE YEAR(ODATE) = 2026 GROUP BY SID HAVING COUNT(*) >= 3)",
   check={"mode": "state", "query": "SELECT SID, SALARY FROM STAFF ORDER BY SID"},
   tag="挑戰",
   hints=["UPDATE 的 WHERE 用 IN 子查詢；子查詢內用 GROUP BY 和 HAVING 找出合資格的 SID。",
          "UPDATE STAFF SET SALARY = SALARY + 1000 WHERE SID IN (SELECT SID FROM ORDERS WHERE ___ GROUP BY SID HAVING ___)",
          "UPDATE STAFF SET SALARY = SALARY + 1000 WHERE SID IN (SELECT SID FROM ORDERS WHERE YEAR(ODATE) = 2026 GROUP BY SID HAVING COUNT(*) >= 3)"],
   explain="子查詢內可以有 GROUP BY 和 HAVING。這題結合了世界 3、4、7、9 的內容。恭喜你完成決賽！")

LEVELS = L
