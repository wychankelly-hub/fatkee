// 介面用的固定內容：數據字典的中文解釋、按鍵、人物圖示、揭秘場景。

export const TABLE_INFO = {
  STAFF: {
    zh: '員工', desc: '發記的員工',
    cols: { SID: '員工編號', SNAME: '名稱', ROLE: '職位 (BOSS / CASHIER / COOK / WAITER / DELIVERY)', SALARY: '月薪', HDATE: '入職日期', BOSS: '上司的員工編號' },
  },
  ITEM: {
    zh: '食物', desc: '旺角總店餐牌',
    cols: { IID: '食物編號', INAME: '中文名稱', ENAME: '英文名稱', CAT: '類別 (DRINK / BREAD / NOODLE / RICE)', PRICE: '價錢', STOCK: '庫存' },
  },
  CUSTOMER: {
    zh: '客人', desc: '登記會員',
    cols: { CID: '客人編號', CNAME: '名稱', PHONE: '電話', DISTRICT: '地區', VIP: '是否 VIP (Y / N)' },
  },
  ORDERS: {
    zh: '訂單', desc: '每張訂單',
    cols: { OID: '訂單編號', CID: '客人編號', SID: '負責員工', ODATE: '日期', OTYPE: '類型 (DINE 堂食 / TAKE 外賣自取 / DELI 送遞)' },
  },
  ODETAIL: {
    zh: '訂單內容', desc: '每張訂單點了甚麼',
    cols: { OID: '訂單編號', IID: '食物編號', QTY: '數量' },
  },
  TWMENU: {
    zh: '荃灣分店餐牌', desc: '荃灣分店的餐牌',
    cols: { IID: '食物編號', ENAME: '英文名稱', PRICE: '價錢' },
  },
};

export const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS NULL', 'DISTINCT',
  'ORDER BY', 'ASC', 'DESC', 'GROUP BY', 'HAVING', 'COUNT(', 'SUM(', 'AVG(', 'MAX(', 'MIN(', 'YEAR(', 'AS',
  'JOIN', 'ON', 'UNION', 'INTERSECT', 'MINUS', 'EXISTS'];

// 最常用的放前面（窄螢幕不用左右滑動也看得到）
export const SYMBOLS = ["'", ',', '(', ')', '=', '*', '<', '>', '.', '%', '_', 'BS'];

export const EMOJI = { S01: '👨‍🍳', S02: '💰', S03: '🍳', S04: '🍞', S05: '📝', S06: '😎', S07: '🛵', S08: '🔍', C07: '🎥' };

// 世界 7 最後一關之後的揭秘場景（在結尾之前顯示）
export const REVEAL = [
  '阿麗：「疑犯有三位：發哥、阿強、肥波。」',
  '阿強：「那個星期我一直在廚房，閉路電視可以作證！」',
  '肥波：「那個星期我放假，根本不在店裏！」',
  '所有人一起望向發哥……',
  '阿麗：「發哥，你的嘴角……還有菠蘿油的牛油。」',
];
