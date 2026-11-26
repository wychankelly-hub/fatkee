# Cloudflare 免費方案部署指南

這個版本讓 GitHub Pages 繼續提供遊戲；Cloudflare Workers 接收統計，D1 保存每日合計。你不需要租用或維護一部伺服器，也不需要購買網域。

目前尚未部署，遊戲的統計網址仍然空白，不會傳送統計。以下步驟需要你自己的 Cloudflare 帳戶。

## 1. 建立帳戶

前往 https://dash.cloudflare.com/sign-up 建立帳戶並完成電郵驗證。使用 Workers Free，毋須為這個功能升級付費方案。免費方案有請求、資料庫讀寫和儲存配額；不要把免費理解為無限使用。D1 免費配額用盡時查詢會失敗，待配額重設。請在 Cloudflare 控制台查看實際方案及用量。

參考：https://developers.cloudflare.com/d1/platform/pricing/

## 2. 在你的電腦準備程式

安裝 Node.js 24。在 GitHub 選擇包含本功能的分支，下載 ZIP 並解壓縮，或用 Git：

```sh
git clone --branch feature/anonymous-usage-dashboard https://github.com/wychankelly-hub/fatkee.git
cd fatkee/analytics/cloudflare
npm ci
npx wrangler login
```

如果用 ZIP，在解壓後的資料夾開啟終端機，進入 analytics/cloudflare，再執行最後兩個指令。登入會開啟 Cloudflare 授權頁；由你完成登入，不要把密碼或授權碼貼進聊天。

## 3. 建立 D1

```sh
npx wrangler d1 create fatkee-usage
```

指令會顯示 database_id。把它填入本資料夾的 wrangler.jsonc，取代 REPLACE_WITH_D1_DATABASE_ID。資料庫 ID 不是開發者密鑰。

## 4. 部署並設定開發者密鑰

```sh
npm run deploy
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put ADMIN_TOKEN
```

第二個指令只在你自己的電腦生成密鑰。先把它保存在密碼管理器，再於第三個指令的隱藏輸入提示貼入；不要貼入聊天、GitHub 或公開設定。首次部署到設定密鑰之間，API 只會回傳 503，不會開放讀取資料。

部署會提供類似 https://fatkee-usage.YOUR-SUBDOMAIN.workers.dev 的網址。這個公開網址可以提供給協助你設定的人，但不要提供 ADMIN_TOKEN。

## 5. 接上遊戲

把真正的公開 Worker 網址填入遊戲的 js/analytics-config.js，並增加 sw.js 的 VERSION：

```js
export const ANALYTICS_URL = 'https://你的實際網址.workers.dev';
```

合併功能 PR，等待 GitHub Pages 部署完成。開啟遊戲玩一關，再到：

https://wychankelly-hub.github.io/fatkee/developer.html

輸入你保存的密鑰，按「載入統計」。沒有密鑰的請求應回傳 401；頁面沒有從遊戲選單連結，但真正的保護是 API 的密鑰驗證。

## 用量、私隱及維護

- Workers 與 D1 都有免費配額。每個活動中的可見遊戲頁面約每 15 秒送出一次活動事件；實際容量還受事件數及索引寫入影響。只在控制台確認用量後才考慮改變方案。
- Worker 不儲存 IP、學號、答案、進度碼或玩家識別碼。Cloudflare 作為網絡供應商仍會處理連線資料。設定預設關閉 Workers Observability；不要額外開啟含請求資料的記錄／追蹤。
- 只保存每日合計；每日 UTC 00:05 清理 90 日前的資料。讀取 API 只提供最近 7/30/90 日。供應商備份可能有獨立保留期限。
- 公開寫入 API 的數字可能被偽造。每個 Worker isolate 有每分鐘 6,000 次的粗略上限，並非全域安全防線；不要用於評核或計費。免費配額耗盡也可能令合法統計暫停。
- 更換密鑰：重新執行 npx wrangler secret put ADMIN_TOKEN。
- 暫停收集：將 ANALYTICS_URL 清空、增加快取版本並重新部署遊戲。玩家亦可在設定關閉統計。
- 本地測試：在專案根目錄執行 npm test。Workers 測試使用 SQLite 模擬 D1 API；真實 Cloudflare 部署仍需帳戶完成後驗證。

原本的 Node.js 自架版本仍可使用，見 ../README.md。兩個版本擇一，不需要同時部署。


## 使用 Cloudflare 網頁連接 GitHub

也可以不安裝本地工具，直接在 Workers & Pages 建立應用並連接此 GitHub repo：

| 欄位 | 值 |
|---|---|
| Project name | `fatkee-usage` |
| Production branch | `feature/anonymous-usage-dashboard` |
| Advanced settings → Path | `analytics/cloudflare`（相對路徑，沒有開頭的斜線） |
| Build command | `npm ci` |
| Deploy command | `npx wrangler deploy` |

如果建立畫面沒有 Branch 欄位，建立應用後到 Settings → Build 設定 Production branch。不要假設重試舊建置一定會改用新分支；查看新建置的 branch 和 commit，或在目標分支提交更新，觸發新建置。

`root directory not found` 發生在執行程式之前。先確認建置使用的提交包含 `analytics/cloudflare/package.json`，再核對 Path。此功能合併前，`main` 分支並沒有這個資料夾。

網頁部署前，請在 D1 Console 執行 `migrations/0001_totals.sql`，並把資料庫 ID 填入 `wrangler.jsonc`。Worker 部署後，到 Settings → Variables & Secrets 新增 Secret `ADMIN_TOKEN`；不要把它加入 Build variables 或 GitHub 檔案。未設定密鑰時 API 回傳 503 是預期行為。最後按原指南把公開 Worker 網址接上遊戲。

## Google 登入及老師面板

學生可以（自行選擇）用 Google 帳戶登入。登入後，每關的最高星數、是否過關、是否在錯題簿、答錯／提示／過關次數及最近活動時間會儲存在 D1；只有 `TEACHER_EMAILS` 內的老師可以在 `teacher.html` 看到全部學生。不會傳送或儲存學生寫的 SQL。不登入的學生照常可以玩，也可以繼續用進度碼。

這個功能與匿名統計共用同一個 Worker 和 D1，但使用另外兩個資料表（`users`、`progress`）。

### 1. 建立 Google OAuth 用戶端 ID

1. 前往 https://console.cloud.google.com/ ，建立（或選擇）一個專案。
2. 「API 和服務」→「OAuth 同意畫面」：用戶類型選「外部」，填寫應用程式名稱（例如「發記冰室」）及你的電郵。範圍只需要預設的 `email`、`profile`、`openid`，毋須提交 Google 審核。完成後按「發布應用程式」，否則只有測試用戶可以登入。
3. 「憑證」→「建立憑證」→「OAuth 用戶端 ID」→ 應用程式類型選「網頁應用程式」。
4. 「已授權的 JavaScript 來源」加入 `https://wychankelly-hub.github.io`（只填來源，不要加 `/fatkee`）。本地測試可以另加 `http://localhost:8123`。重新導向 URI 不用填。
5. 複製「用戶端 ID」（類似 `1234567890-abc.apps.googleusercontent.com`）。用戶端 ID 是公開資料，可以放入 GitHub；**用戶端密鑰不需要，也不要放入任何地方**。

### 2. 設定 Worker

1. 把用戶端 ID 填入本資料夾 `wrangler.jsonc` 的 `vars.GOOGLE_CLIENT_ID`。（`wrangler deploy` 會用這個檔案的 vars 蓋過控制台的設定，所以要填在檔案內。）
2. 在 D1 建立新資料表。用指令：

   ```sh
   npx wrangler d1 migrations apply DB --remote
   ```

   或者在 Cloudflare 控制台 → D1 → fatkee-usage → Console，貼上 `migrations/0002_accounts.sql` 的內容並執行。（用網頁連接 GitHub 部署時，部署指令不會自動建立資料表，一定要做這一步。）
3. 新增兩個 Secret（控制台 → Workers & Pages → fatkee-usage → Settings → Variables & Secrets，類型選 Secret；或用指令）：

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   npx wrangler secret put SESSION_SECRET     # 貼上上一行生成的隨機字串
   npx wrangler secret put TEACHER_EMAILS     # 老師的 Google 電郵，多於一個用逗號分隔
   ```

   `SESSION_SECRET` 用來簽發學生的登入憑證（有效 30 日）；更換它會令所有人需要重新登入。`TEACHER_EMAILS` 放在 Secret 而不是 `wrangler.jsonc`，以免老師電郵出現在公開的 GitHub。之後要加減老師，只需修改這個 Secret，毋須重新部署遊戲。
4. 部署 Worker 後，打開 `https://你的-worker.workers.dev/health/accounts`。看到 `{"ready":true}` 便完成；否則 `reason` 會說明欠缺哪一項（`GOOGLE_CLIENT_ID_MISSING`、`SESSION_SECRET_MISSING_OR_SHORT`、`TEACHER_EMAILS_MISSING`、`ACCOUNT_TABLES_MISSING`）。

### 3. 接上遊戲

把同一個用戶端 ID 填入 `js/account-config.js` 的 `GOOGLE_CLIENT_ID`，增加 `sw.js` 的 `VERSION`，然後合併及部署 GitHub Pages。`GOOGLE_CLIENT_ID` 留空時，遊戲及老師頁都不會顯示登入功能。

### 4. 測試

1. 用一個學生 Google 帳戶在遊戲首頁按「用 Google 登入」，玩一關。
2. 用老師帳戶打開 `https://wychankelly-hub.github.io/fatkee/teacher.html`，按「使用 Google 帳戶登入」，應該看到那位學生。
3. 用學生帳戶打開老師頁，應該顯示「不是老師帳戶」。

### 私隱及注意事項

- 儲存的個人資料：Google 名稱、電郵、Google 帳戶編號、學生自己輸入的學號，以及上面列出的作答次數。請先確認符合學校處理學生資料的政策，並告知學生及家長。
- 學生可在遊戲「設定」→「刪除雲端記錄」刪除自己的全部記錄；老師也可以在學生詳細記錄中刪除。
- 任何 Google 帳戶都可以登入並出現在老師面板。如有陌生帳戶，可以直接刪除。
- iPhone：在 Safari 和「加至主畫面」的版本是兩個分開的儲存空間，學生需要在實際使用的那一個登入一次。登入後兩邊的進度會經雲端合併。
- 登入時 Google 會在彈出視窗中確認帳戶。如果瀏覽器阻擋彈出視窗，請允許後再試。
