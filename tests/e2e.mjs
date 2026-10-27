// 瀏覽器測試：先在專案根目錄執行 python3 -m http.server 8123，再執行 node tests/e2e.mjs [輸出截圖的資料夾]
// 用 iPhone SE 及 iPhone 15 的畫面大小，模擬學生玩幾關。
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.argv[2] || 'tests/shots';
mkdirSync(OUT, { recursive: true });
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('✘', msg); } else console.log('✔', msg); };

async function noHScroll(page, label) {
  const vw = page.viewportSize().width;
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(w[0] <= vw && w[1] === vw, `${label}：沒有橫向捲動 (${w[0]}, ${w[1]} ≤ ${vw})`);
}

// Playwright 的「iPhone SE」是第一代 (320 寬)；規格要求 375 × 667（第二、三代）
const DEVICES = {
  'iPhone SE 375': { ...devices['iPhone SE'], viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 }, deviceScaleFactor: 2 },
  'iPhone 15': devices['iPhone 15'],
};
for (const devName of Object.keys(DEVICES)) {
  const dev = DEVICES[devName];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...dev, defaultBrowserType: undefined });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const tag = devName.replace(/\s/g, '');
  const shot = name => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });

  await page.goto(BASE);
  await page.waitForSelector('.home-hero');
  await shot('01-home'); await noHScroll(page, `${devName} 首頁`);

  // 序幕
  await page.click('text=開始故事');
  for (let i = 0; i < 4; i++) await page.click('.story-screen');
  await shot('02-prologue');
  await page.click('text=進入世界地圖');
  await page.waitForSelector('.world');
  await shot('03-map'); await noHScroll(page, `${devName} 世界地圖`);

  // 世界 1
  await page.click('.world >> nth=0');
  await page.waitForSelector('.concept');
  await shot('04-world1'); await noHScroll(page, `${devName} 世界頁`);
  await page.click('text=開始挑戰');

  // 1-1 排列
  await page.waitForSelector('.slots');
  const lvl11 = await page.evaluate(() => window.__game.G.levels.find(l => l.id === '1-1'));
  for (const b of lvl11.blocks) await page.click(`.pool .chip:not(.gone) >> text="${b}"`);
  await shot('05-order');
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.ok');
  check((await page.textContent('.big-stars')).startsWith('★★★'), `${devName} 1-1 三星`);
  await shot('06-order-pass');
  await page.click('#sheet [data-act="next"]');

  // 1-2 寫 SQL：先寫錯，再用彎引號寫對
  await page.waitForSelector('#ed');
  await page.fill('#ed', "SELECT ENAME PRICE FROM ITEM WHERE CAT = 'DRINK'");
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.bad');
  check((await page.textContent('#sheet')).includes('漏了逗號'), `${devName} 漏逗號提示`);
  await shot('07-wrong'); await noHScroll(page, `${devName} 回饋卡`);
  await page.click('#sheet [data-act="close"]');
  await page.click('#ed');
  await page.fill('#ed', 'SELECT ENAME, PRICE FROM ITEM WHERE CAT = ‘DRINK’');
  check(await page.evaluate(() => document.body.classList.contains('typing')), `${devName} 輸入模式`);
  // 符號鍵不會令輸入框失去焦點
  await page.click('#kbar [data-key=","]');
  check(await page.evaluate(() => document.activeElement.id === 'ed'), `${devName} 按符號鍵後仍在輸入`);
  check((await page.inputValue('#ed')).endsWith(','), `${devName} 符號鍵插入`);
  await page.click('#kbar [data-key="BS"]');
  await shot('08-typing');
  await page.click('[data-act="run"]');
  await page.waitForSelector('#out table');
  await shot('09-run'); await noHScroll(page, `${devName} 執行結果`);
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.ok');
  check((await page.textContent('.big-stars')).startsWith('★★★'), `${devName} 1-2 彎引號三星`);
  await page.click('#sheet [data-act="next"]');

  // 1-3 找錯處：先點錯一個
  await page.waitForSelector('.tokens');
  await page.click('.tok >> nth=0');
  await page.click('.tok >> nth=7');
  await page.waitForSelector('.fb-title.ok');
  check((await page.textContent('.big-stars')).startsWith('★☆') || (await page.innerHTML('.big-stars')).startsWith('★<span'), `${devName} 1-3 錯一次得一星`);
  await shot('10-bug');
  await page.click('#sheet [data-act="next"]');

  // 1-4：數字加引號 → 兩星及 DSE 扣分位；打開數據字典
  await page.waitForSelector('#ed');
  await page.click('[data-act="dict"]');
  await page.waitForSelector('.cols');
  await shot('11-dict'); await noHScroll(page, `${devName} 數據字典`);
  await page.click('#sheet [data-tab="ITEM"]');
  await page.click('#sheet .col >> text=IID');
  await page.click('#sheet [data-act="close"]');
  check((await page.inputValue('#ed')) === 'IID', `${devName} 數據字典插入欄位`);
  await page.fill('#ed', "SELECT IID, ENAME FROM ITEM WHERE PRICE < '40' AND (CAT = 'NOODLE' OR CAT = 'RICE')");
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.ok');
  check(await page.isVisible('#sheet .dse'), `${devName} DSE 扣分位`);
  check((await page.innerHTML('.big-stars')).startsWith('★★<span'), `${devName} 扣分位最多兩星`);
  await shot('12-dse');
  await page.click('#sheet [data-act="next"]');

  // 1-5 推算
  await page.waitForSelector('.opt');
  await page.click('.opt >> nth=2');
  await page.waitForSelector('.fb-title.ok');
  await page.click('#sheet [data-act="tryrun"]');
  await shot('13-predict');
  await page.click('#sheet [data-act="next"]');

  // 1-6：看三個提示 → 答案是 canvas，要自己輸入
  await page.waitForSelector('#ed');
  for (let i = 0; i < 3; i++) { await page.click('[data-act="hint"]'); await page.click('#sheet [data-act="ok"]'); }
  check(await page.isVisible('#anscv'), `${devName} 答案以圖像顯示`);
  await shot('14-answer');
  const ans = await page.evaluate(() => window.__game.G.levels.find(l => l.id === '1-6').answer);
  await page.fill('#ed', ans);
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.ok');
  check((await page.textContent('#sheet')).includes('錯題簿'), `${devName} 看答案後加入錯題簿`);
  await page.click('#sheet [data-act="next"]');

  // 世界 1 結局
  await page.waitForSelector('.story-screen');
  await page.click('text=看成績');
  await page.waitForSelector('.big-stars');
  await shot('15-outro');

  // 世界 7：揭秘場景
  await page.evaluate(() => { location.hash = '#/outro/7'; });
  await page.waitForSelector('.story-screen');
  check((await page.textContent('.story-line')).includes('疑犯'), `${devName} 世界 7 揭秘場景`);

  // 錯題簿、進度碼
  await page.goto(BASE + '#/review');
  await page.waitForSelector('.lvl');
  check((await page.textContent('#app')).includes('1-6'), `${devName} 錯題簿有 1-6`);
  await page.goto(BASE + '#/code');
  await page.waitForSelector('#code');
  const code = (await page.textContent('#code')).trim();
  await shot('16-code'); await noHScroll(page, `${devName} 進度碼`);

  // 世界 4 之後沒有關鍵字按鈕；寫錯誤 SQL 的中文錯誤訊息
  await page.evaluate(() => {
    const g = window.__game; g.G.levels.filter(l => l.world < 4 || l.id === '4-1').forEach(l => { g.S.passed[l.id] = true; });
    location.hash = '#/level/4-2';
  });
  await page.waitForSelector('#ed');
  check(await page.locator('#kbar .key.kw').count() === 0, `${devName} 世界 4 不顯示關鍵字按鈕`);
  await page.fill('#ed', 'SELECT CAT, COUNT(*) FORM ITEM GROUP BY CAT');
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.bad');
  check((await page.textContent('#sheet')).includes('FROM'), `${devName} 錯字建議 FROM`);
  await shot('17-error');

  // 老師頁
  await page.goto(BASE + 'teacher.html');
  await page.fill('#codes', code + '\nBAD-CODE');
  await page.click('#go');
  await page.waitForSelector('#out table');
  check((await page.textContent('#out')).includes('1-6'), `${devName} 老師頁顯示 0 星關卡`);
  await shot('18-teacher');

  // 每一關都可以開啟，沒有橫向捲動
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.home-hero');
  const ids = await page.evaluate(() => { const g = window.__game; g.G.levels.forEach(l => { g.S.passed[l.id] = true; }); return g.G.levels.map(l => l.id); });
  let wide = [];
  for (const id of ids) {
    await page.evaluate(i => { location.hash = '#/level/' + i; }, id);
    await page.waitForSelector(`.level h1:has-text("${id}")`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > page.viewportSize().width) wide.push(id);
  }
  check(wide.length === 0, `${devName} 全部 ${ids.length} 關可以開啟，沒有橫向捲動 ${wide.join(',')}`);
  for (let w = 1; w <= 10; w++) {
    await page.evaluate(i => { location.hash = '#/world/' + i; }, w);
    await page.waitForSelector('.concept');
  }
  check(true, `${devName} 十個世界頁可以開啟`);

  // 離線：service worker 快取後，斷網仍可開啟
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('.home-hero');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.home-hero', { timeout: 10000 }).catch(() => {});
  check(await page.isVisible('.home-hero'), `${devName} 離線時仍可開啟`);
  await page.evaluate(() => { location.hash = '#/level/2-1'; });
  await page.waitForSelector('#ed');
  await page.fill('#ed', "SELECT IID, ENAME FROM ITEM WHERE ENAME LIKE '%Bun%'");
  await page.click('[data-act="submit"]');
  await page.waitForSelector('.fb-title.ok');
  check(true, `${devName} 離線時可以判斷答案`);
  await ctx.setOffline(false);

  // 深色模式
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(BASE + '#/world/5');
  await page.waitForSelector('.concept');
  await shot('19-dark');

  check(errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, `${devName} 沒有 JS 錯誤 ${errors.join(' | ')}`);
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} 項失敗` : '\n全部通過');
process.exit(failures.length ? 1 : 0);
