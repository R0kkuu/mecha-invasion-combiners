#!/usr/bin/env python3
"""Mecha Invasion news watcher.

Fetches the feeds in feeds.json, keeps items not seen before that mention
Mecha Invasion, and POSTs one JSON payload to the Grok Bot routine webhook.
Standard library only. Never fails the job because one feed is broken.

Env:
  MI_WEBHOOK_URL         webhook URL (secret). Missing -> no POST, just a log note.
  MI_WEBHOOK_KEY         sender key (secret).
  MI_WEBHOOK_KEY_HEADER  header for the key (default "Authorization", sent as
                         "Bearer <key>"; any other header gets the raw key).
  MI_STATE_FILE          seen-state path (default .news-watch-state/seen.json)
  MI_RESEED=1            rebuild state without POSTing
  MI_TEST_PING=1         send a test payload (items: []) even with no news
  MI_DRY_RUN=1           do everything except the webhook POST (local testing)
  MI_UPDATES_FILE        path to data/updates.json (default: repo copy, then live site)

Noise filters (never wake the bot for these):
  - items older than maxAgeDays (feeds.json)
  - a normalised title already seen on any feed (Google News re-lists old posts)
  - links already cited in data/updates.json sources (already covered)
  - "threadFeeds" (TFW2005 boards): only threads whose URL was never seen;
    bumps on known threads are left to the Thursday catalog refresh
Feed health goes to the GitHub Actions job summary only: OK, or FAILED when
every URL for a feed errors. The newest item date is shown as info only (quiet
feeds are normal; there is no staleness rule).
"""
import email.utils, hashlib, html, json, os, re, sys, time, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "feeds.json"), encoding="utf-8"))
STATE_FILE = os.environ.get("MI_STATE_FILE", ".news-watch-state/seen.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
BLOCKED_HOSTS = ("news.tfw2005.com", "tfsource.com", "weibo.com/", "//weibo.com", "m.weibo.cn")
KEEP_DAYS = 120
THREAD_KEEP_DAYS = 365
UPDATES_URL = "https://mecha-invasion-combiners.vercel.app/data/updates.json"
NOW = time.time()


def log(*a):
    print(*a, flush=True)


def fetch(url):
    if any(b in url for b in BLOCKED_HOSTS):
        raise RuntimeError("blocked host (directCutOff/searchOnly)")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d


def local(tag):
    return tag.rsplit("}", 1)[-1]


def parse_feed(data):
    root = ET.fromstring(data)
    items = []
    for el in root.iter():
        name = local(el.tag)
        if name not in ("item", "entry"):
            continue
        f = {}
        for c in el:
            n = local(c.tag)
            if n == "link":
                href = c.get("href")
                if href and (c.get("rel") in (None, "alternate")):
                    f.setdefault("link", href)
                elif (c.text or "").strip():
                    f.setdefault("link", c.text.strip())
            elif n in ("title", "guid", "id", "pubDate", "published", "updated", "date", "description", "summary", "content"):
                f.setdefault(n, (c.text or "").strip())
        title = strip_tags(f.get("title", ""))
        if not title and not f.get("link"):
            continue
        d = parse_date(f.get("pubDate") or f.get("published") or f.get("updated") or f.get("date"))
        items.append({
            "title": title,
            "link": f.get("link", ""),
            "guid": f.get("guid") or f.get("id") or f.get("link") or title,
            "date": d,
            "summary": strip_tags(f.get("description") or f.get("summary") or f.get("content") or "")[:400],
        })
    if not items and local(root.tag) not in ("rss", "feed", "RDF"):
        raise ValueError("not a feed (root <%s>)" % local(root.tag))
    return items


KW = [k.lower() for k in CFG.get("keywords", [])]
KRE = [re.compile(p, re.I) for p in CFG.get("keywordRegex", [])]


def matches(text):
    t = text.lower()
    hits = [k for k in KW if k in t]
    hits += [p.pattern for p in KRE if p.search(text)]
    return hits


def key_for(feed_id, it):
    return hashlib.sha1((feed_id + "|" + it["guid"]).encode("utf-8")).hexdigest()[:20]


def norm_title(t):
    t = (t or "").lower()
    t = re.sub(r"\s+[-\u2013|]\s+[^-\u2013|]{2,40}$", "", t)  # " - TFW2005" style source suffix
    return re.sub(r"[\W_]+", "", t)


def norm_link(u):
    u = (u or "").strip().split("#", 1)[0]
    u = re.sub(r"^https?://(www\.)?", "", u, flags=re.I).rstrip("/")
    u = re.sub(r"/(unread|latest|page-\d+)$", "", u)
    return u.lower()


def thread_url(u):
    m = re.search(r"(tfw2005\.com/boards/threads/[^/?#]+)", u or "", re.I)
    return (m.group(1) if m else norm_link(u)).lower()


def covered_links():
    """Links cited in data/updates.json sources (already covered by an article)."""
    path = os.environ.get("MI_UPDATES_FILE") or os.path.join(HERE, "..", "..", "data", "updates.json")
    data = None
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        try:
            data = json.loads(fetch(UPDATES_URL))
        except Exception as e:
            log("NOTE: could not read updates.json (%s); covered-link filter off." % type(e).__name__)
            return set()
    out = set()
    for art in data or []:
        for src in art.get("sources") or []:
            if isinstance(src, dict):
                src = src.get("url", "")
            if src:
                out.add(norm_link(src))
    return out


def write_summary(health, posted):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    lines = ["## news-watch feed health", "", "| Feed | Status | Via | Newest item (info) | Detail |", "|---|---|---|---|---|"]
    for h in health:
        lines.append("| %s | %s | %s | %s | %s |" % (h["id"], h["status"], h.get("via", ""), h.get("newest", ""), h.get("detail", "").replace("|", "/")))
    lines += ["", "Webhook: %s" % posted, ""]
    text = "\n".join(lines) + "\n"
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(text)
    else:
        log("\n" + text)


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def save_state(st):
    os.makedirs(os.path.dirname(STATE_FILE) or ".", exist_ok=True)
    cutoff = NOW - KEEP_DAYS * 86400
    st["seen"] = {k: v for k, v in st["seen"].items() if v >= cutoff}
    st["titles"] = {k: v for k, v in st.get("titles", {}).items() if v >= cutoff}
    tcut = NOW - THREAD_KEEP_DAYS * 86400
    st["threads"] = {k: v for k, v in st.get("threads", {}).items() if v >= tcut}
    st["updated"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w", encoding="utf-8") as fh:
        json.dump(st, fh, ensure_ascii=False, indent=0)


def post(payload):
    url = os.environ.get("MI_WEBHOOK_URL", "").strip()
    key = os.environ.get("MI_WEBHOOK_KEY", "").strip()
    if not url:
        log("NOTE: MI_WEBHOOK_URL secret not set; skipping POST.")
        return False
    header = (os.environ.get("MI_WEBHOOK_KEY_HEADER") or "Authorization").strip()
    headers = {"Content-Type": "application/json", "User-Agent": "mi-news-watch/1"}
    if key:
        headers[header] = ("Bearer " + key) if header.lower() == "authorization" else key
    else:
        log("NOTE: MI_WEBHOOK_KEY secret not set; posting without a key.")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as r:
            log("Webhook POST ->", r.status)
            return 200 <= r.status < 300
    except urllib.error.HTTPError as e:
        log("WARNING: webhook POST failed with HTTP", e.code)
    except Exception as e:
        log("WARNING: webhook POST failed:", type(e).__name__)
    return False


def main():
    state = load_state()
    reseed = os.environ.get("MI_RESEED") == "1"
    first_run = state is None or reseed
    if first_run:
        state = {"seen": {}, "feeds": {}}
        log("No saved state (or reseed requested): seeding, no webhook call this run.")
    state.setdefault("feeds", {})
    # Older state has no thread/title sets: seed them this run instead of waking for every thread.
    seed_threads = "threads" not in state
    state.setdefault("threads", {})
    state.setdefault("titles", {})
    if seed_threads and not first_run:
        log("No thread set yet: seeding forum thread URLs, no thread wakes this run.")
    max_age = CFG.get("maxAgeDays", 10) * 86400
    thread_feeds = set(CFG.get("threadFeeds", []))
    covered = covered_links()
    new_matches, report, health = [], [], []
    run_titles = set()

    for feed in CFG["feeds"]:
        fid = feed["id"]
        items, used, errs = None, None, []
        for url in feed["urls"]:
            try:
                items = parse_feed(fetch(url))
                used = url
                break
            except Exception as e:
                errs.append("%s: %s" % (url.split("/")[2], str(e)[:80]))
        if items is None:
            report.append((fid, "FAILED", "; ".join(errs)))
            health.append({"id": fid, "status": "FAILED", "detail": "; ".join(errs)[:200]})
            continue
        via = used.split("/")[2]
        dates = [it["date"] for it in items if it["date"]]
        newest = max(dates) if dates else None
        h = {"id": fid, "status": "OK", "via": via, "newest": newest.strftime("%Y-%m-%d") if newest else "?", "detail": "%d items" % len(items)}
        health.append(h)

        feed_seeded = fid not in state["feeds"]
        is_thread_feed = fid in thread_feeds
        fresh = dropped = 0
        for it in items:
            k = key_for(fid, it)
            nt = norm_title(it["title"])
            thr = thread_url(it["link"]) if is_thread_feed else None
            already = k in state["seen"]
            title_known = bool(nt) and (nt in state["titles"] or nt in run_titles)
            thread_known = thr in state["threads"] if thr else False
            state["seen"][k] = state["seen"].get(k, NOW) if already else NOW
            if nt:
                state["titles"].setdefault(nt, NOW)
            if thr:
                state["threads"].setdefault(thr, NOW)
            if already:
                continue
            fresh += 1
            if first_run or feed_seeded:
                continue
            if it["date"] and NOW - it["date"].timestamp() > max_age:
                dropped += 1
                continue
            hits = ["(official account)"] if feed.get("matchAll") else matches(it["title"] + " " + it["summary"])
            if not hits:
                continue
            if is_thread_feed and (thread_known or seed_threads):
                log("  skip (%s):" % ("thread set seeding" if seed_threads else "known thread bump"), it["title"][:90])
                dropped += 1
                continue
            if title_known:
                log("  skip (title already seen):", it["title"][:90])
                dropped += 1
                continue
            if norm_link(it["link"]) in covered:
                log("  skip (already covered in updates.json):", it["title"][:90])
                dropped += 1
                continue
            if nt:
                run_titles.add(nt)
            new_matches.append({
                "title": it["title"],
                "link": it["link"],
                "date": it["date"].isoformat() if it["date"] else None,
                "source": feed["name"],
                "feedId": fid,
                "matched": hits[:5],
                "summary": it["summary"][:300],
            })
        state["feeds"][fid] = {"lastOk": datetime.now(timezone.utc).isoformat(), "via": via}
        report.append((fid, "ok via " + via, "%d items, %d unseen, %d filtered%s" % (len(items), fresh, dropped, " (seeded)" if (feed_seeded and not first_run) else "")))

    log("\nFeed report:")
    for r in report:
        log("  %-20s %-32s %s" % r)

    # de-duplicate by link, newest first, cap
    seen_links, payload_items = set(), []
    for m in sorted(new_matches, key=lambda m: m["date"] or "", reverse=True):
        lk = m["link"] or m["title"]
        if lk in seen_links:
            continue
        seen_links.add(lk)
        payload_items.append(m)
    payload_items = payload_items[: CFG.get("maxItems", 20)]

    log("\nNew Mecha Invasion matches: %d" % len(payload_items))
    for m in payload_items:
        log("  -", m["date"], "|", m["source"], "|", m["title"][:110])

    dry = os.environ.get("MI_DRY_RUN") == "1"
    posted = "not called (nothing new)"
    if payload_items:
        if dry:
            log("DRY RUN: would POST %d item(s)." % len(payload_items)); posted = "dry run (%d item(s))" % len(payload_items)
        else:
            ok = post({"source": "news-watch", "items": payload_items})
            posted = "called with %d item(s) -> %s" % (len(payload_items), "ok" if ok else "FAILED")
    elif os.environ.get("MI_TEST_PING") == "1":
        log("Test ping requested.")
        if not dry:
            post({"source": "news-watch", "test": True, "items": []})
        posted = "test ping"
    elif first_run:
        log("Seed run: nothing posted.")
        posted = "not called (seed run)"
    else:
        log("Nothing new: nothing posted.")

    write_summary(health, posted)
    save_state(state)
    ok = sum(1 for h in health if h["status"] == "OK")
    log("\nState saved to %s (%d keys, %d threads, %d titles). Feeds OK: %d/%d" % (STATE_FILE, len(state["seen"]), len(state["threads"]), len(state["titles"]), ok, len(health)))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never fail loudly
        log("WARNING: watcher crashed:", type(e).__name__, str(e)[:200])
        sys.exit(0)
