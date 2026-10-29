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
