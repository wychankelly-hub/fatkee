# -*- coding: utf-8 -*-
# 故事及世界設定。所有文字用簡單書面語（繁體中文），避免廣東話口語。
# 專有名詞第一次出現時附英文。

GAME_TITLE = "發記冰室數據大危機"
GAME_SUBTITLE = "HKDSE ICT 選修 2A 數據庫 · SQL 溫習遊戲"

PROLOGUE = [
    "旺角有一間開了二十五年的茶餐廳，叫「發記冰室」。",
    "老闆發哥今年五十八歲，只會用計數機，不會用電腦。",
    "這個月，業主宣佈加租三成。電視台的「全港最強茶餐廳」比賽冠軍可獲獎金五十萬元——發哥決定參加！",
    "可是參賽要交出完整的數據分析報告。發哥看着電腦上的數據庫 (database)，一臉茫然。",
    "「你是新請的數據庫管理員 (database administrator)？太好了！發記的命運，就交給你了！」",
]

# 角色表（遊戲中可在「人物」頁查看，幫助學生記住數據內容）
CHARACTERS = [
    {"id": "S01", "name": "發哥", "desc": "老闆。很愛面子，每次試新菜都說是「質量檢查」。"},
    {"id": "S02", "name": "珍姐", "desc": "收銀員。記性極好，全旺角的八卦都知道。"},
    {"id": "S03", "name": "阿強", "desc": "大廚。焗豬扒飯是他的驕傲，誰說不好吃他會生氣。"},
    {"id": "S04", "name": "肥波", "desc": "廚師。永遠肚餓，口袋裏總有食物。"},
    {"id": "S05", "name": "細妹", "desc": "侍應。最勤力，但常常寫錯單。"},
    {"id": "S06", "name": "阿Ken", "desc": "侍應。自稱「旺角最型侍應」。"},
    {"id": "S07", "name": "飛毛腿", "desc": "送遞員。跑得很快，但經常迷路。"},
    {"id": "S08", "name": "阿麗", "desc": "新來的侍應。很文靜，觀察力很強。"},
    {"id": "C07", "name": "Mr Food", "desc": "著名食評 YouTuber。他的一條影片可以令一間餐廳爆滿，也可以令它倒閉。"},
]

WORLDS = [
    {
        "id": 1, "title": "第一天上班", "topic": "SELECT、FROM、WHERE、AND / OR",
        "intro": "發哥：「第一個任務很簡單——幫我看看餐牌上有甚麼！我連自己賣甚麼都記不清了……」",
        "card": {
            "title": "重溫卡：最基本的查詢",
            "points": [
                "SELECT 後面寫「要顯示的欄位」，用逗號分隔；* 代表全部欄位。",
                "FROM 後面寫「資料表 (table) 的名稱」。",
                "WHERE 後面寫「條件」，只顯示符合條件的記錄 (record)。",
                "文字要用單引號 ' '；數字不用引號。DSE 會扣「數字加引號」的分。",
                "AND 要兩個條件都成立；OR 只要一個成立。兩者一起用時，記得加括號。",
            ],
            "example": "SELECT ENAME, PRICE\nFROM ITEM\nWHERE CAT = 'DRINK' AND PRICE < 24",
            "exampleNote": "顯示價錢少於 24 元的飲品的英文名稱及價錢。",
        },
        "outro": "發哥：「原來我們有十二款食物！我一直以為只有菠蘿包和奶茶……」",
    },
    {
        "id": 2, "title": "熟客名單", "topic": "LIKE、IN、BETWEEN、IS NULL、ORDER BY、DISTINCT",
        "intro": "珍姐：「比賽要我們介紹熟客。我記得每個客人的八卦，但記不住他們的電話號碼……靠你了！」",
        "card": {
            "title": "重溫卡：更多條件與排序",
            "points": [
                "LIKE 配合 % 找部分文字：'%Bun%' 代表「中間有 Bun」；'P%' 代表「P 字開頭」。",
                "IN ('A', 'B') 等於 = 'A' OR = 'B'，寫法更短。",
                "BETWEEN x AND y 包括 x 和 y 本身。",
                "找空值 (NULL) 一定要用 IS NULL，不可以用 = NULL。",
                "ORDER BY 欄位 ASC（由小至大，預設）/ DESC（由大至小）。",
                "DISTINCT 去除重複的結果。",
            ],
            "example": "SELECT CNAME, DISTRICT\nFROM CUSTOMER\nWHERE DISTRICT IN ('Mong Kok', 'Central')\nORDER BY CNAME",
            "exampleNote": "顯示住在旺角或中環的客人，按名稱排序。",
        },
        "outro": "珍姐：「張伯原來沒有留電話！難怪他每次都說『你們打電話給我吧』……」",
    },
    {
        "id": 3, "title": "發哥要數", "topic": "COUNT、SUM、AVG、MAX、MIN、YEAR()",
        "intro": "發哥：「評判一定會問營業數字。可是我平時只靠『感覺』……今次要真的計數了！」",
        "card": {
            "title": "重溫卡：聚合函數 (aggregate function)",
            "points": [
                "COUNT(*) 數記錄的數目；COUNT(欄位) 不會計算 NULL。",
                "COUNT(DISTINCT 欄位) 數「不同的值」有多少個。",
                "SUM 總和、AVG 平均、MAX 最大、MIN 最小。",
                "沒有 GROUP BY 時，整個結果只會有一行。",
                "YEAR(日期) 取出年份，例如 YEAR(ODATE) = 2026。",
                "AS 可以替結果欄位改名，例如 COUNT(*) AS TOTAL。",
            ],
            "example": "SELECT COUNT(*) AS TOTAL, MAX(PRICE)\nFROM ITEM\nWHERE CAT = 'BREAD'",
            "exampleNote": "麵包類有多少款？最貴的是多少錢？",
        },
        "outro": "發哥：「計完數我才知道……原來去年十二月生意最好！」",
    },
    {
        "id": 4, "title": "誰是最勤力伙記", "topic": "GROUP BY、HAVING",
        "intro": "阿Ken：「比賽有『最佳員工』獎！我一定是最勤力的！」細妹：「你肯定？用數據說話吧。」",
        "card": {
            "title": "重溫卡：分組 GROUP BY 與 HAVING",
            "points": [
                "GROUP BY 欄位：把相同值的記錄分成一組，每組計算一次聚合函數。",
                "SELECT 中沒有用聚合函數的欄位，必須寫在 GROUP BY 中。",
                "WHERE：分組「之前」篩選記錄；不可以放聚合函數。",
                "HAVING：分組「之後」篩選組別；可以放聚合函數。",
                "次序一定是：SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY。",
            ],
            "example": "SELECT CAT, COUNT(*)\nFROM ITEM\nWHERE PRICE > 20\nGROUP BY CAT\nHAVING COUNT(*) >= 2",
            "exampleNote": "先只看 20 元以上的食物，再按類別分組，只顯示有 2 款或以上的類別。",
        },
        "outro": "數據顯示：最勤力的是飛毛腿！阿Ken：「……送外賣不算吧？」",
    },
    {
        "id": 5, "title": "訂單追蹤", "topic": "等連接、自然連接、三表連接、自連接",
        "intro": "飛毛腿又迷路了！訂單上只有編號 CID，沒有客人名稱。「我怎知道 C02 是誰？！」",
        "card": {
            "title": "重溫卡：連接 (join) 多個資料表",
            "points": [
                "一個資料表的資料不夠，就要把兩個表「接」起來。",
                "等連接 (equi-join)：FROM A, B WHERE A.欄 = B.欄。",
                "兩個表有相同欄位名稱時，要寫 表名.欄位，例如 ORDERS.CID。",
                "忘記寫連接條件，會得出「每行配每行」的笛卡兒積 (Cartesian product)，結果多得可怕。",
                "三個表要兩個連接條件；同一個表連接自己叫自連接 (self-join)，要用別名 (alias)。",
            ],
            "example": "SELECT OID, CNAME\nFROM ORDERS, CUSTOMER\nWHERE ORDERS.CID = CUSTOMER.CID",
            "exampleNote": "每張訂單配上客人的名稱。",
        },
        "outro": "飛毛腿：「有名有地區，我今次一定不會迷路！」（十分鐘後，他打電話回來問路。）",
    },
    {
        "id": 6, "title": "消失的菠蘿油", "topic": "外連接 (LEFT JOIN)、IS NULL、NOT IN",
        "intro": "珍姐壓低聲音：「我查過庫存……菠蘿油少了很多，但收銀機沒有記錄賣出。有人偷吃！」",
        "card": {
            "title": "重溫卡：找「沒有」的東西",
            "points": [
                "普通連接只顯示兩邊都配對到的記錄。",
                "左外連接 (LEFT JOIN)：左邊的表全部保留；配對不到的，右邊欄位顯示 NULL。",
                "所以 LEFT JOIN ... WHERE 右表.欄 IS NULL，就是「從來沒有配對到」的記錄。",
                "另一個方法：WHERE 欄 NOT IN (SELECT 欄 FROM 另一表)。",
                "兩種寫法 DSE 都接受，選你熟的那一種。",
            ],
            "example": "SELECT STAFF.SID, SNAME\nFROM STAFF LEFT JOIN ORDERS\n  ON STAFF.SID = ORDERS.SID\nWHERE ORDERS.OID IS NULL",
            "exampleNote": "從未處理過訂單的員工。",
        },
        "outro": "賣出的菠蘿油只有 4 個，庫存卻少了 9 個。有 5 個菠蘿油，消失了……",
    },
    {
        "id": 7, "title": "真兇是誰", "topic": "子查詢 (subquery)：= ( )、IN、NOT IN、EXISTS、ALL",
        "intro": "阿麗：「我有一個想法。偷吃的人，應該是一個『不用落單』的人……」",
        "card": {
            "title": "重溫卡：子查詢",
            "points": [
                "子查詢 = 放在括號內的另一句 SELECT，先執行，再把結果交給外面的查詢。",
                "找最大、最小、平均值時，聚合函數要放在子查詢內：WHERE PRICE = (SELECT MAX(PRICE) FROM ITEM)。",
                "WHERE PRICE = MAX(PRICE) 是錯的！2025 年 DSE 評卷參考明確不接受。",
                "IN / NOT IN：值在不在子查詢結果之中。",
                "EXISTS：子查詢有沒有結果（至少一行）。",
                ">= ALL (子查詢)：大於或等於子查詢的每一個值。",
                "DSE 課程只考一層子查詢。",
            ],
            "example": "SELECT ENAME\nFROM ITEM\nWHERE PRICE = (SELECT MIN(PRICE) FROM ITEM)",
            "exampleNote": "最便宜的食物。",
        },
        "outro": "真相大白！發哥紅着臉承認：「我……我只是在做質量檢查！五個菠蘿油，都是試味用的！」",
    },
    {
        "id": 8, "title": "荃灣開分店", "topic": "UNION、INTERSECT、MINUS、CREATE VIEW",
        "intro": "破案之後，發記人氣大增，在荃灣開了分店！可是兩間店的餐牌不一樣，發哥又亂了……",
        "card": {
            "title": "重溫卡：集合運算與檢視",
            "points": [
                "UNION：合併兩個查詢的結果，去除重複。UNION ALL：保留重複。",
                "INTERSECT：兩邊都有的。MINUS（有些系統叫 EXCEPT）：上面有、下面沒有的。",
                "兩個查詢的欄位數目必須相同。",
                "檢視 (view) 是一個「虛擬資料表」：CREATE VIEW 名稱 AS SELECT ...",
                "檢視的好處：簡化複雜查詢；只讓用戶看到部分欄位，保護私隱。",
            ],
            "example": "SELECT IID FROM ITEM\nINTERSECT\nSELECT IID FROM TWMENU",
            "exampleNote": "兩間店都有賣的食物編號。",
        },
        "outro": "分店經理：「有了檢視，我只看到我需要的資料，好方便！」",
    },
    {
        "id": 9, "title": "餐廳大改造", "topic": "CREATE TABLE、INSERT、UPDATE、DELETE、ALTER、INDEX、回滾",
        "intro": "比賽前一星期，發記要大改造：新菜式、新供應商、加價……每一步都要改數據庫！",
        "card": {
            "title": "重溫卡：修改數據與資料表",
            "points": [
                "INSERT INTO 表 (欄1, 欄2) VALUES (值1, 值2)：新增記錄。",
                "UPDATE 表 SET 欄 = 新值 WHERE 條件：修改記錄。忘記 WHERE 會改動全部記錄！",
                "DELETE FROM 表 WHERE 條件：刪除記錄（表還在）。DROP TABLE：連表一起刪除。",
                "ALTER TABLE 表 ADD 欄 類型：加入新欄位。",
                "CREATE TABLE 的限制：PRIMARY KEY、NOT NULL、UNIQUE、CHECK、FOREIGN KEY ... REFERENCES。",
                "CREATE INDEX：加快搜尋，但會佔空間，也令新增及修改較慢。",
                "回滾 (rollback)：交易 (transaction) 中途失敗時，取消已做的改動，回到交易開始前的狀態。",
            ],
            "example": "UPDATE ITEM\nSET PRICE = PRICE + 1\nWHERE CAT = 'BREAD'",
            "exampleNote": "所有麵包加價 1 元。",
        },
        "outro": "改造完成！發哥：「明天就是決賽了。最後一關，大家一起上！」",
    },
    {
        "id": 10, "title": "全港最強茶餐廳決賽", "topic": "綜合 DSE 題型",
        "intro": "決賽現場，評判 Mr Food 坐在第一行：「我會問六條問題，每一條都要用 SQL 回答。開始！」",
        "card": {
            "title": "重溫卡：解題四步",
            "points": [
                "1. 要顯示甚麼？→ 寫 SELECT。",
                "2. 資料在哪些表？→ 寫 FROM，記得連接條件。",
                "3. 有甚麼條件？分組前用 WHERE，分組後用 HAVING。",
                "4. 要排序嗎？→ ORDER BY。",
                "寫完後，在腦中用一兩行數據「空運行」一次，看看結果對不對。",
            ],
            "example": "SELECT CAT, AVG(PRICE)\nFROM ITEM\nGROUP BY CAT\nORDER BY AVG(PRICE) DESC",
            "exampleNote": "每類食物的平均價錢，由高至低。",
        },
        "outro": "Mr Food 放下筆：「數據清楚，分析準確。今年的全港最強茶餐廳——發記冰室！」發哥哭了，然後去吃了一個菠蘿油。",
    },
]
