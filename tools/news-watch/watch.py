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
    max_age = CFG.get("maxAgeDays", 30) * 86400
    new_matches, report = [], []

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
            continue
        feed_seeded = fid not in state["feeds"]
        fresh = 0
        for it in items:
            k = key_for(fid, it)
            if k in state["seen"]:
                continue
            state["seen"][k] = NOW
            fresh += 1
            if first_run or feed_seeded:
                continue
            if it["date"] and NOW - it["date"].timestamp() > max_age:
                continue
            hits = ["(official account)"] if feed.get("matchAll") else matches(it["title"] + " " + it["summary"])
            if not hits:
                continue
            new_matches.append({
                "title": it["title"],
                "link": it["link"],
                "date": it["date"].isoformat() if it["date"] else None,
                "source": feed["name"],
                "feedId": fid,
                "matched": hits[:5],
                "summary": it["summary"][:300],
            })
        state["feeds"][fid] = {"lastOk": datetime.now(timezone.utc).isoformat(), "via": used.split("/")[2]}
        report.append((fid, "ok via " + used.split("/")[2], "%d items, %d unseen%s" % (len(items), fresh, " (seeded)" if (feed_seeded and not first_run) else "")))

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

    if payload_items:
        post({"source": "news-watch", "items": payload_items})
    elif os.environ.get("MI_TEST_PING") == "1":
        log("Test ping requested.")
        post({"source": "news-watch", "test": True, "items": []})
    elif first_run:
        log("Seed run: nothing posted.")
    else:
        log("Nothing new: nothing posted.")

    save_state(state)
    ok = sum(1 for r in report if r[1] != "FAILED")
    log("\nState saved to %s (%d keys). Feeds ok: %d/%d" % (STATE_FILE, len(state["seen"]), ok, len(report)))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never fail loudly
        log("WARNING: watcher crashed:", type(e).__name__, str(e)[:200])
        sys.exit(0)
