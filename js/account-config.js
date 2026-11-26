// 公開設定：Google 登入。不可放入任何密鑰。
// GOOGLE_CLIENT_ID：Google Cloud Console 建立的「網頁應用程式」OAuth 用戶端 ID。留空 = 不顯示登入功能。
// ACCOUNT_URL：Cloudflare Worker 的網址（與統計服務相同）。
import { ANALYTICS_URL } from './analytics-config.js';
export const GOOGLE_CLIENT_ID = '';
export const ACCOUNT_URL = ANALYTICS_URL;
