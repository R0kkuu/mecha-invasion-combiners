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
- Items older than 30 days are ignored; max 20 items per POST. A broken feed is logged and skipped.
- Never add news.tfw2005.com, tfsource.com or weibo.com directly.
