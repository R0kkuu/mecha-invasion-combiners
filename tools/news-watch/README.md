# news-watch

`.github/workflows/news-watch.yml` runs `watch.py` every 2 hours (minute 17) and on manual dispatch.
It reads `feeds.json`, keeps unseen items that mention Mecha Invasion (the official Weibo feed is taken whole),
and POSTs one payload to the Grok Bot routine webhook:

```json
{"source":"news-watch","items":[{"title":"…","link":"…","date":"ISO-8601","source":"feed name","feedId":"…","matched":["…"],"summary":"…"}]}
```

- Secrets: `MI_WEBHOOK_URL`, `MI_WEBHOOK_KEY`. Optional repo variable `MI_WEBHOOK_KEY_HEADER` (default `Authorization`, sent as `Bearer <key>`; any other header name gets the raw key).
- State: `.news-watch-state/seen.json` in the GitHub Actions cache (key `news-watch-state-<run_id>`, newest 5 kept). Nothing is committed, so no Vercel deploy.
- First run, a reseed, or a newly added feed only seeds state; nothing is posted for it.
- Items older than 10 days (`maxAgeDays`) are ignored; max 20 items per POST. A broken feed is logged and skipped.
- Noise filters, none of which wake the bot: a normalised title already seen on any feed (Google News re-lists old posts with new ids); a link already cited in `data/updates.json` sources (read from the repo, else the live site); and for `threadFeeds` (TFW2005 boards) any thread URL seen before, so bumps on old threads are left to the Thursday refresh. Thread URLs are kept 365 days, items and titles 120 days, all in the same cached `seen.json`.
- Feed health goes to the Actions job summary as a table: OK, or FAILED when every URL for a feed errors. The newest item date is info only; quiet feeds are normal.
- `MI_DRY_RUN=1` runs everything except the webhook POST (local testing).
- Never add news.tfw2005.com, tfsource.com or weibo.com directly.
