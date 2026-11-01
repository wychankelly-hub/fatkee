# Anonymous usage statistics

For a managed hosting option without maintaining a server, follow [the Cloudflare Workers + D1 guide](cloudflare/README.md) (Traditional Chinese). This Node.js server is the alternative for an existing host. Deploy only one collector.

The game remains on GitHub Pages. `developer.html` displays aggregate visits, visible-page activity minutes, level starts, completions, wrong attempts and hints for 7/30/90 days. The read API requires an owner-held bearer key. Hiding the page is not the access control.

## Deploy

1. Use a separate host with **Node.js 24**, HTTPS termination and a persistent disk. GitHub Pages cannot run this server. No hosting account or automatic backend deployment is configured by this PR.
2. Copy this repository to that host. Set these environment variables using the host's secret settings:
   - `ADMIN_TOKEN`: a random secret of at least 32 characters (e.g. generate with `openssl rand -hex 32`). Never commit it, add it to a URL, or put it in browser configuration.
   - `SITE_ORIGIN=https://wychankelly-hub.github.io` (origin only, without `/fatkee`).
   - `ANALYTICS_DB=/persistent/path/analytics.sqlite`.
   - Optional `PORT` (default 8787), `HOST` (default 127.0.0.1; set 0.0.0.0 for hosts that require it).
3. Run `node analytics/server.mjs` under your host's process manager. Route HTTPS traffic to it. Keep the database on persistent storage. No npm dependencies are required by the collector.
4. Put only the public HTTPS collector base URL (no trailing slash) in `js/analytics-config.js`. Increase the service-worker VERSION when changing configuration. Merge/deploy the Pages changes.
5. Open `https://wychankelly-hub.github.io/fatkee/developer.html`, enter the owner key, and load statistics. The key stays in the current page's memory; it is not saved by the app. Use “清除密鑰” to clear it and the displayed results.
6. Check that an unauthenticated GET to `/stats` fails, then play a level and confirm counters appear after refreshing the panel.

## Counting and privacy

- No cookies, persistent visitor IDs, student IDs, SQL text, progress codes, referrers or raw event records are stored by this application.
- Counts are aggregated immediately by server UTC day, event and validated level ID. Only the last 90 UTC dates are retained during ingestion; reads are limited to 7/30/90 days.
- A visit means a successful game load, not a unique person. Reloads count again. Replays and warm-ups count as level starts/completions. Wrong attempts are actual judged wrong answers, not SQL Run clicks.
- Completion ratio is completions/starts in the selected period, not a cohort pass rate. It can exceed 100% at date boundaries.
- Activity samples every 15 seconds while the page is visible. Hidden intervals, long sleep intervals, offline use, failures and blocked requests are omitted. A visible but idle page still counts; this is not measured attention.
- Requests are best effort, with no retry queue or offline replay, so totals are approximate. A request already sent cannot be withdrawn by switching off statistics.
- Players can disable collection in Settings. Do Not Track / Global Privacy Control prevent sending; blocked local storage also disables collection. Collection is inactive while the public endpoint is empty.
- The network host necessarily receives connection metadata such as IP addresses. Configure your reverse proxy/provider to disable or minimize access logs; do not claim end-to-end IP anonymity.

## Operations and limits

Rotate the key by restarting the collector with a new secret. Back up the SQLite file using SQLite-aware tooling; keep backups private and define their retention separately. Deleting the database while the service is stopped resets totals.

The public event API accepts only six event types, known level IDs, a 512-byte body and bounded activity seconds. A global 6,000-request/minute ingestion cap limits basic floods without retaining IP addresses. **Public counters can still be forged:** CORS is browser policy, not sender authentication. Put request-size/rate limits at your HTTPS proxy too. These statistics are for product feedback, never assessment or billing. The collector intentionally has no per-student drill-down.

Validate with `node --test tests/analytics.test.mjs`; existing game checks remain `python3 build.py` and `npm test`.
