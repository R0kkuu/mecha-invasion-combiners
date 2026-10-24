# Daily refresh

The catalog reads `data/figures.json`. After you edit that file, copy it into the JS fallback so the site still opens from `index.html` without a local server:

```bash
python3 -c "import json,pathlib; p=pathlib.Path('data/figures.json'); d=json.loads(p.read_text()); pathlib.Path('data/figures.js').write_text('window.CATALOG_DATA = '+json.dumps(d,ensure_ascii=False)+';\n')"
python3 -c "import json,pathlib; p=pathlib.Path('data/updates.json'); d=json.loads(p.read_text()); pathlib.Path('data/updates.js').write_text('window.UPDATES_DATA = '+json.dumps(d,ensure_ascii=False)+';\n')"
```

Or serve the folder (`python3 -m http.server`) and skip the copy — `js/catalog.js` fetches `data/figures.json` and `data/updates.json` first.

## Add or update a figure

1. Pick a stable `id` (folder name), e.g. `te-01b`.
2. Create `images/<id>/` and drop official photos there. Name files simply (`01.jpg`, `vehicle.jpg`). Do not hotlink Weibo.
3. Add an object to the `figures` array in `data/figures.json`. Required fields:

| Field | Notes |
|---|---|
| `id` | Matches the image folder |
| `code` | Official product code, or `"unknown"` |
| `nameEn` / `nameZh` | Official names only |
| `line` | `giant-legion` / `titan-empyrean` / `micro-core` |
| `status` | `released` / `preorder` / `gray-model` / `prototype` / `in-development` |
| `images` | Array of `{ file, credit, sourceUrl, caption, kind }` |
| `homage`, `altMode`, `combinerRole`, heights, materials, LEDs, dates, prices | Use `"unknown"` or `null` when not published. Never invent. |

4. Also set `project` (one of the ids in the top-level `projects` array), `kind` (`combiner` / `member` / `edition` / `accessory`), `role` (short combiner role, e.g. `Left leg`; say "unpublished" rather than guess) and, for two-pack members, `pack`. Add the figure id to the right `groups[].ids` list of its project. A new combiner team gets a new `projects` entry (`id`, `line`, `nameEn`, `nameZh`, `homage`, `combinerId`, `summary`, `groups`, `notes` for open questions).
5. Point `images[].file` at local paths like `images/te-01b/01.jpg`.
6. Credit the host you downloaded from (TFW2005, Tformers, TFSource, TFSafari, Tokullectibles, Arcane Collect, etc.) and keep `sourceUrl`.
7. Bump `lastUpdated`, `lastUpdatedLabel`, and `lastUpdatedIso` at the top of the JSON (Australia/Sydney).
8. Generate thumbnails (`python3 tools/thumbs.py`) and run the `figures.js` copy command above.
9. Serve the folder and check the new card + detail gallery.

## Image rules

- Official studio / Weibo recap / factory promo only.
- TFW2005 news galleries are the usual host for Weibo recaps.
- Skip fan photography, bootlegs, and random marketplace shots.
- If a figure has no official photo, leave `images: []`. The site shows “No official images yet.”

## New product line

Add a line object under `lines` (`id`, `nameEn`, `nameZh`, `blurb`) and set that `id` on figures.

## Add an update article

When official combiner news is found, add a short recap. Alerts will link to `#/update/<id>`.

1. Prepend a new object to the array in `data/updates.json` (newest first). Do not invent facts, prices, or product codes.
2. Fields:

| Field | Notes |
|---|---|
| `id` | Stable slug: `YYYY-MM-DD` plus a short topic, e.g. `2026-08-25-gla-07` |
| `date` | ISO date `YYYY-MM-DD` |
| `dateLabel` | Display date, e.g. `25 Aug 2026` |
| `title` | Short headline |
| `summary` | 2–4 short paragraphs, separated by blank lines. Official facts only. |
| `figureIds` | Array of catalog figure ids the recap is about |
| `sources` | Array of source URLs (TFW2005, Weibo, retailer pages) |
| `hero` | Optional local image path that already exists, e.g. `images/gla-07/tfw-upgrade-06.jpg` |

3. Copy JSON into the JS fallback:

```bash
python3 -c "import json,pathlib; p=pathlib.Path('data/updates.json'); d=json.loads(p.read_text()); pathlib.Path('data/updates.js').write_text('window.UPDATES_DATA = '+json.dumps(d,ensure_ascii=False)+';\n')"
```

4. If figure data also changed, bump `lastUpdated`, `lastUpdatedLabel`, and `lastUpdatedIso` at the top of `data/figures.json` (Australia/Sydney) and run the `figures.js` copy command above.
5. If you changed `css/catalog.css` or `js/catalog.js`, bump the `?v=` query string on those tags in `index.html`.
6. Open `#/updates` and `#/update/<id>` and check the home “Latest updates” block.


## Store prices (`stores`, `topPicks`)

- `figures[].stores` = array of `{store, url, price, currency, availability, checked}`. Only record a price you saw on the live store page that day; set `checked` to the date (Australia/Sydney). Drop dead or delisted links.
- `topPicks` = the 5 figure ids shown on `#/prices` and the home page; `pricesChecked` = date of the last price check.
- Re-check top-5 prices about weekly (or when an article mentions a price change).

## Publish (GitHub + Vercel)

Source of truth: GitHub repo `R0kkuu/mecha-invasion-combiners` (branch `main`). Live site: https://mecha-invasion-combiners.vercel.app (Vercel project `mecha-invasion-combiners`).

**How the live site picks up changes (current setup):** the Vercel deployment serves only `index.html`, `css/`, `js/` and `vercel.json`; `vercel.json` rewrites `/data/*`, `/images/*`, `/thumbs/*` and `/UPDATE.md` to `raw.githubusercontent.com/R0kkuu/mecha-invasion-combiners/main/...`. So for a normal daily refresh (data, articles, images) **a `git push` to `main` is the whole deploy** — live within ~5 minutes (raw GitHub cache). No Vercel or Netlify token needed.

Only if `index.html`, `css/catalog.css`, `js/catalog.js` or `vercel.json` change does Vercel need a new deployment (Vercel connector `create_deployment`, project `prj_MjZk8679hjOdrDH9drN46bXcQrla`, target `production`, those 4 files inline). Once the Vercel GitHub app is installed and the project is linked to the repo, every push deploys automatically and this step goes away.

```bash
cd /workspace/mecha-invasion-catalog
git add -A
git commit -m "refresh: <YYYY-MM-DD> <short summary>"
git push origin main
```

Then verify (allow ~5 min):

```bash
curl -s https://mecha-invasion-combiners.vercel.app/data/updates.json | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])"
```

The first id must be the newest article. Alert links use `https://mecha-invasion-combiners.vercel.app/#/update/<id>`.

Never commit tokens, `.env*`, `.netlify/`, `.vercel/` or the `/workspace/mi-review` quarantine folder. Keep unverified images out of this repo.

Netlify (`https://mecha-invasion-combiners.netlify.app`) is legacy and kept up for now; it no longer needs to be redeployed on each refresh.
