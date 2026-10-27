# 發記冰室數據大危機

HKDSE ICT 選修 2A（數據庫）SQL 溫習遊戲。這是一個靜態網站：不用登入，沒有後端，不收集任何資料。遊戲主要在 iPhone Safari 上玩。


## 檔案

| 路徑 | 用途 |
|---|---|
| `index.html`, `css/`, `js/app.js` | 遊戲介面 |
| `js/checker.js` | 答案檢查器（與 `build.py` 的 `preprocess()`、自訂函數、LINT 及比較邏輯一致） |
| `js/progress.js` | 進度碼（Crockford Base32） |
| `js/content-ui.js` | 數據字典的中文解釋、按鍵、人物圖示、世界 7 揭秘場景 |
| `teacher.html`, `js/teacher.js` | 老師頁（遊戲選單不會連結到這頁） |
| `content/*.py` → `levels.json` | 遊戲內容。修改後執行 `python3 build.py` |
| `data/data_a.sql`, `data/patch_b.sql` | 數據 A，以及隱藏的檢查數據 B |
| `vendor/sql-wasm.*` | sql.js 1.13.0（SQLite 3.49.1） |
| `sw.js`, `manifest.json`, `icons/` | PWA：離線使用、加到主畫面 |
| `tests/` | 單元測試及瀏覽器測試 |

## 修改內容

```sh
python3 build.py        # 必須印出「全部通過」
npm install && npm test # 檢查器單元測試：每個 write 關卡的答案、另一寫法、常見錯誤、死記答案、彎引號
```

修改了任何遊戲檔案後，把 `sw.js` 的 `VERSION` 加一，學生的手機才會更新快取。


## 老師頁

打開 `…/teacher.html`，貼上學生的進度碼（每行一個），可看到每位學生每個世界的星數、總星數，以及看了答案才過關的關卡。進度碼只記錄每關的星數（0–3），所以「最後一關 0 星」與「未做」無法分辨，兩者都會計入「未完成」。
