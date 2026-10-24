(function () {
  "use strict";
  var STATUS = { released: "Released", preorder: "Preorder", "gray-model": "Gray model", prototype: "Prototype", "in-development": "In development" };
  var KIND = { combiner: "Combiner", member: "Member", edition: "Colour edition", accessory: "Upgrade kit" };
  var S = { data: null, updates: [], q: "" };
  var app = document.getElementById("app");

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function thumb(src) { return src ? src.replace(/^images\//, "thumbs/") : null; }
  function fig(id) { return S.data.figures.find(function (f) { return f.id === id; }); }
  function proj(id) { return (S.data.projects || []).find(function (p) { return p.id === id; }); }
  function line(id) { return S.data.lines.find(function (l) { return l.id === id; }); }
  function hero(f) { return f && f.images && f.images[0] ? f.images[0].file : null; }
  function projHero(p) {
    var ids = [p.combinerId].concat.apply([], p.groups.map(function (g) { return g.ids; }));
    for (var i = 0; i < ids.length; i++) { var h = hero(fig(ids[i])); if (h) return h; }
    return null;
  }
  function money(s) {
    var sym = { USD: "US$", SGD: "S$", AUD: "A$", CNY: "¥" }[s.currency] || s.currency + " ";
    return sym + Number(s.price).toFixed(2);
  }
  function imgTag(src, alt, full) {
    if (!src) return '<div class="empty">No official images yet</div>';
    return '<img src="' + esc(full ? src : thumb(src)) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + esc(src) + '\'">';
  }
  function badge(st) { return '<span class="badge ' + esc(st) + '">' + esc(STATUS[st] || st) + "</span>"; }
  function sortedUpdates() { return (S.updates || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); }
  function excerpt(t, n) { t = (t || "").trim().split(/\n\s*\n/)[0].replace(/\s+/g, " "); return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "…"; }

  function card(f) {
    var st = f.stores && f.stores[0];
    return '<a class="card" href="#/figure/' + encodeURIComponent(f.id) + '"><div class="img">' + imgTag(hero(f), f.nameEn) + badge(f.status) + "</div>" +
      '<div class="body"><span class="code">' + esc(f.code && f.code !== "unknown" ? f.code : KIND[f.kind] || "") + (f.pack ? " · " + esc(f.pack) : "") + "</span>" +
      "<h3>" + esc(f.nameEn) + '</h3><span class="zh">' + esc(f.nameZh) + "</span>" +
      (f.role ? '<span class="role">' + esc(f.role) + "</span>" : "") +
      (st ? '<span class="price-tag">from ' + esc(money(st)) + "</span>" : "") + "</div></a>";
  }
  function pcard(p) {
    var figs = [].concat.apply([], p.groups.map(function (g) { return g.ids; })).map(fig).filter(Boolean);
    var comb = fig(p.combinerId);
    var chips = [];
    var mem = figs.filter(function (f) { return f.kind === "member"; }).length;
    if (mem) chips.push(mem + " members listed");
    var ed = figs.filter(function (f) { return f.kind === "edition"; }).length;
    if (ed) chips.push(ed + " colour editions");
    if (figs.some(function (f) { return f.kind === "accessory"; })) chips.push("Upgrade kit");
    chips.push(p.homage.split(" — ")[0]);
    return '<a class="pcard" href="#/project/' + encodeURIComponent(p.id) + '"><div class="img">' + imgTag(projHero(p), p.nameEn) + "</div>" +
      '<div class="body">' + (comb ? badge(comb.status) : "") + '<h3 style="margin-top:8px">' + esc(p.nameEn) + '</h3><div class="zh">' + esc(p.nameZh) + "</div>" +
      '<p class="sum">' + esc(p.summary) + '</p><div class="chips">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + "</span>"; }).join("") + "</div></div></a>";
  }
  function urow(a) {
    return '<a class="urow" href="#/update/' + encodeURIComponent(a.id) + '"><div class="img">' + imgTag(a.hero, a.title) + "</div><div>" +
      '<span class="d">' + esc(a.dateLabel || a.date) + "</span><h3>" + esc(a.title) + "</h3><p>" + esc(excerpt(a.summary, 180)) + "</p></div></a>";
  }

  function home() {
    var d = S.data, ups = sortedUpdates();
    var heroSrc = hero(fig("gla-black")) || hero(fig("gla-combined"));
    var h = '<section class="hero"><img src="' + esc(heroSrc) + '" alt="">' +
      '<div class="hero-inner"><span class="kicker">Unofficial collector catalog</span><h1>Mecha Invasion<span>机械入侵 · combiner figures</span></h1>' +
      "<p>Every combiner project, its members, colour editions and upgrade kits — with official news and live store prices.</p></div></section>";
    if (ups[0]) h += '<div class="sec"><h2>Latest news</h2><a href="#/updates">All updates →</a></div><div class="ulist">' + ups.slice(0, 2).map(urow).join("") + "</div>";
    d.lines.forEach(function (l) {
      var ps = (d.projects || []).filter(function (p) { return p.line === l.id; });
      if (!ps.length) return;
      h += '<div class="sec" id="line-' + esc(l.id) + '"><h2>' + esc(l.nameEn) + '<span class="zh">' + esc(l.nameZh) + "</span></h2></div>" +
        '<p class="line-blurb">' + esc(l.blurb) + '</p><div class="proj">' + ps.map(pcard).join("") + "</div>";
    });
    h += '<div class="sec"><h2>Top 5 to buy now</h2><a href="#/prices">Prices →</a></div><div class="grid">' + (d.topPicks || []).map(fig).filter(Boolean).map(card).join("") + "</div>";
    h += '<input class="search" id="q" type="search" placeholder="Search every figure (name, code, 中文)…" style="margin-top:30px" value="' + esc(S.q) + '"><div class="grid" id="qres" style="margin-top:12px"></div>';
    app.innerHTML = h;
    var q = document.getElementById("q");
    q.addEventListener("input", function () { S.q = q.value; search(); });
    search();
  }
  function search() {
    var el = document.getElementById("qres"); if (!el) return;
    var q = S.q.trim().toLowerCase();
    if (!q) { el.innerHTML = ""; return; }
    var r = S.data.figures.filter(function (f) {
      return [f.code, f.nameEn, f.nameZh, f.homage, f.squad, f.altMode, f.role, f.notes].concat(f.aliases || []).join(" ").toLowerCase().indexOf(q) >= 0;
    });
    el.innerHTML = r.length ? r.map(card).join("") : '<p class="small">No matches.</p>';
  }

  function project(id) {
    var p = proj(id);
    if (!p) return notFound();
    var l = line(p.line);
    var h = '<a class="back" href="#/">← Catalog</a><div class="crumbs">' + esc(l ? l.nameEn + " · " + l.nameZh : "") + "</div>" +
      '<div class="ptitle"><h1>' + esc(p.nameEn) + '</h1><div class="zh">' + esc(p.nameZh) + " · homage: " + esc(p.homage) + '</div><p class="sum">' + esc(p.summary) + "</p></div>";
    if (p.notes && p.notes.length) h += '<div class="callout"><h4>How it fits together · open questions</h4><ul>' + p.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>";
    p.groups.forEach(function (g) {
      h += '<div class="group-title">' + esc(g.title) + '</div><div class="grid">' + g.ids.map(fig).filter(Boolean).map(card).join("") + "</div>";
    });
    app.innerHTML = h;
  }
  function lineView(id) {
    var l = line(id); if (!l) return home();
    var ps = (S.data.projects || []).filter(function (p) { return p.line === id; });
    app.innerHTML = '<a class="back" href="#/">← Catalog</a><div class="ptitle"><h1>' + esc(l.nameEn) + '</h1><div class="zh">' + esc(l.nameZh) + '</div><p class="sum">' + esc(l.blurb) + '</p></div><div class="proj">' + ps.map(pcard).join("") + "</div>";
  }

  function kv(k, v) { if (v == null || v === "") v = "unknown"; if (Array.isArray(v)) v = v.join(", "); return "<div><dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd></div>"; }
  function figure(id) {
    var f = fig(id); if (!f) return notFound();
    var p = proj(f.project), comb = p && fig(p.combinerId);
    var rel = [];
    if (p) rel.push('<a href="#/project/' + encodeURIComponent(p.id) + '"><b>Project</b>' + esc(p.nameEn) + "</a>");
    if (comb && comb.id !== f.id) rel.push('<a href="#/figure/' + encodeURIComponent(comb.id) + '"><b>Combines into</b>' + esc(comb.nameEn) + "</a>");
    if (p) p.groups.forEach(function (g) {
      g.ids.forEach(function (oid) {
        if (oid === f.id || oid === p.combinerId) return;
        var o = fig(oid); if (!o) return;
        var lbl = f.kind === "member" && o.kind === "member" ? (o.pack && o.pack === f.pack ? "Pack-mate" : "Teammate") : KIND[o.kind];
        rel.push('<a href="#/figure/' + encodeURIComponent(o.id) + '"><b>' + esc(lbl) + "</b>" + esc(o.code && o.code !== "unknown" && o.kind === "member" ? o.code + " " + o.nameEn : o.nameEn) + "</a>");
      });
    });
    var stores = (f.stores || []).map(function (s) {
      return '<a class="store" href="' + esc(s.url) + '" target="_blank" rel="noopener"><div><div class="n">' + esc(s.store) + '</div><div class="a">' + esc(s.availability) + " · checked " + esc(s.checked) + '</div></div><div class="p">' + esc(money(s)) + "</div></a>";
    }).join("");
    var gal = (f.images || []).map(function (im, i) {
      return '<a href="' + esc(im.file) + '" data-full="' + esc(im.file) + '" data-cap="' + esc((im.caption || "") + " — " + (im.credit || "")) + '">' + imgTag(im.file, f.nameEn + " " + (i + 1)) + "</a>";
    }).join("");
    var h0 = hero(f);
    app.innerHTML = '<a class="back" href="' + (p ? "#/project/" + encodeURIComponent(p.id) : "#/") + '">← ' + esc(p ? p.nameEn : "Catalog") + "</a>" +
      '<div class="detail"><div><div class="dhero"' + (h0 ? ' data-full="' + esc(h0) + '" data-cap="' + esc(f.images[0].caption || "") + '"' : "") + ">" + imgTag(h0, f.nameEn, true) + "</div></div>" +
      '<div class="dhead"><span class="code">' + esc(f.code) + " · " + esc(KIND[f.kind] || "") + "</span> " + badge(f.status) +
      "<h1>" + esc(f.nameEn) + '</h1><div class="zh">' + esc(f.nameZh) + (f.aliases && f.aliases.length ? " · " + esc(f.aliases.join(" / ")) : "") + "</div>" +
      (f.role ? '<span class="role" style="display:inline-block;margin-top:10px">' + esc(f.role) + "</span>" : "") +
      (stores ? '<div class="stores">' + stores + "</div>" : "") +
      '<div class="rel">' + rel.join("") + "</div>" +
      '<dl class="kv">' + kv("Combiner role", f.combinerRole) + kv("Box / set", f.box) + kv("Homage", f.homage) + kv("Alt mode", f.altMode) +
      kv("Robot height", f.heightRobot) + kv("Combined height", f.heightCombined) + kv("Materials", f.materials) + kv("LEDs", f.leds) +
      kv("Announced", f.announced) + kv("Released", f.released) + kv("Official price", f.priceOfficial) + kv("Retail notes", f.priceRetail) + "</dl>" +
      (f.notes ? '<p class="notes">' + esc(f.notes) + "</p>" : "") +
      '<div class="sources">' + (f.sources || []).map(function (u) { return '<a href="' + esc(u) + '" rel="noopener" target="_blank">' + esc(u.replace(/^https?:\/\/(www\.)?/, "")) + "</a>"; }).join("") + "</div></div></div>" +
      '<div class="group-title">Gallery · ' + (f.images || []).length + "</div>" + (gal ? '<div class="gal">' + gal + "</div>" : '<p class="small">No official images yet.</p>');
    bindLb();
  }

  function prices() {
    var d = S.data;
    var rows = (d.topPicks || []).map(fig).filter(Boolean).map(function (f, i) {
      var s = f.stores[0];
      return '<div class="prow"><a class="img" href="#/figure/' + encodeURIComponent(f.id) + '">' + imgTag(hero(f), f.nameEn) + "</a><div>" +
        '<span class="rank">#' + (i + 1) + " · " + esc(STATUS[f.status] || f.status) + '</span><h3><a href="#/figure/' + encodeURIComponent(f.id) + '">' + esc(f.nameEn) + "</a></h3>" +
        '<div class="p">' + esc(money(s)) + ' <span class="small">' + esc(s.currency) + "</span></div>" +
        '<div class="meta">' + esc(s.store) + " · " + esc(s.availability) + "</div>" +
        (f.stores.slice(1).map(function (o) { return '<div class="meta">Also: <a href="' + esc(o.url) + '" target="_blank" rel="noopener" style="text-decoration:underline">' + esc(o.store) + "</a> " + esc(money(o)) + " (" + esc(o.availability) + ")</div>"; }).join("")) +
        '<a class="buy" href="' + esc(s.url) + '" target="_blank" rel="noopener">View at ' + esc(s.store) + " ↗</a></div></div>";
    }).join("");
    app.innerHTML = '<div class="ptitle"><h1>Top 5 · current prices</h1><p class="sum">The five most prominent Mecha Invasion products you can order now. Prices are as shown on the store page on ' + esc(d.pricesChecked) + ", before shipping and tax. Third-party figures sell through many small shops; always compare.</p></div>" +
      '<div class="plist">' + rows + '</div><p class="small" style="margin-top:16px">Not priced: TE01A 觜策 and TE01B 垒戍 (official price still TBA — shops only take US$1 deposits), dinosaur combiner and Micro-Star (not on sale).</p>';
  }

  function updates() {
    app.innerHTML = '<div class="ptitle"><h1>Updates</h1><p class="sum">Short recaps of official combiner news. Newest first.</p></div><div class="ulist">' + sortedUpdates().map(urow).join("") + "</div>";
  }
  function article(id) {
    var a = (S.updates || []).find(function (u) { return u.id === id; });
    if (!a) return notFound();
    var figs = (a.figureIds || []).map(fig).filter(Boolean);
    app.innerHTML = '<div class="article"><a class="back" href="#/updates">← Updates</a><span class="kicker">' + esc(a.dateLabel || a.date) + "</span><h1>" + esc(a.title) + "</h1>" +
      (a.hero ? '<div class="ahero" data-full="' + esc(a.hero) + '" data-cap="' + esc(a.title) + '">' + imgTag(a.hero, a.title, true) + "</div>" : "") +
      '<div class="body">' + (a.summary || "").trim().split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p.replace(/\s+/g, " ")) + "</p>"; }).join("") + "</div>" +
      (figs.length ? '<div class="group-title">In the catalog</div><div class="grid">' + figs.map(card).join("") + "</div>" : "") +
      '<div class="group-title">Sources</div><div class="sources">' + (a.sources || []).map(function (u) { return '<a href="' + esc(u) + '" rel="noopener" target="_blank">' + esc(u.replace(/^https?:\/\/(www\.)?/, "")) + "</a>"; }).join("") + "</div></div>";
    bindLb();
  }
  function notFound() { app.innerHTML = '<a class="back" href="#/">← Catalog</a><p>Not found.</p>'; }

  function bindLb() {
    app.querySelectorAll("[data-full]").forEach(function (n) {
      n.addEventListener("click", function (e) { e.preventDefault(); document.getElementById("lb-img").src = n.getAttribute("data-full"); document.getElementById("lb-cap").textContent = n.getAttribute("data-cap") || ""; document.getElementById("lightbox").hidden = false; });
    });
  }
  function closeLb() { document.getElementById("lightbox").hidden = true; document.getElementById("lb-img").src = ""; }

  function render() {
    closeLb();
    var h = location.hash.replace(/^#\/?/, "").replace(/\/+$/, ""), m, nav = "home";
    if ((m = h.match(/^figure\/(.+)$/))) figure(decodeURIComponent(m[1]));
    else if ((m = h.match(/^project\/(.+)$/))) project(decodeURIComponent(m[1]));
    else if ((m = h.match(/^line\/(.+)$/))) lineView(decodeURIComponent(m[1]));
    else if ((m = h.match(/^update\/(.+)$/))) { article(decodeURIComponent(m[1])); nav = "updates"; }
    else if (h === "updates") { updates(); nav = "updates"; }
    else if (h === "prices") { prices(); nav = "prices"; }
    else home();
    app.classList.remove("fade"); void app.offsetWidth; app.classList.add("fade");
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === nav); });
  }

  function fetchJson(u) { return fetch(u, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function loadScript(src) { return new Promise(function (ok) { var s = document.createElement("script"); s.src = src; s.onload = s.onerror = ok; document.head.appendChild(s); }); }
  Promise.all([fetchJson("data/figures.json"), fetchJson("data/updates.json")]).then(function (r) {
    if (r[0] && r[1]) return r;
    return Promise.all([loadScript("data/figures.js"), loadScript("data/updates.js")]).then(function () { return r; });
  }).then(function (r) {
    S.data = r[0] || window.CATALOG_DATA; S.updates = r[1] || window.UPDATES_DATA || [];
    var t = document.getElementById("updated"); t.textContent = S.data.lastUpdatedLabel || S.data.lastUpdated; t.dateTime = S.data.lastUpdatedIso || "";
    document.getElementById("lightbox").addEventListener("click", function (e) { if (e.target.id === "lightbox" || e.target.classList.contains("lb-close")) closeLb(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLb(); });
    window.addEventListener("hashchange", function () { window.scrollTo(0, 0); render(); });
    render();
  });
})();
