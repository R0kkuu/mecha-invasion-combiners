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
    var st = (f.stores || []).filter(function (x) { return x.priceType !== "deposit" && x.price != null; })[0];
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

  function lineView(id) {
    var l = line(id); if (!l) return home();
    var ps = (S.data.projects || []).filter(function (p) { return p.line === id; });
    app.innerHTML = '<a class="back" href="#/">← Catalog</a><div class="ptitle"><h1>' + esc(l.nameEn) + '</h1><div class="zh">' + esc(l.nameZh) + '</div><p class="sum">' + esc(l.blurb) + '</p></div><div class="proj">' + ps.map(pcard).join("") + "</div>";
  }

  // ---- v2 figure / project templates (data-driven; see UPDATE.md "Page data") ----
  var SEC = { robot: "Robot mode", vehicle: "Vehicle mode", part: "Combined", combined: "Full combiner", other: "More images" };
  var PILL = { released: ["ok", "Released"], preorder: ["pre", "Pre-order"], "gray-model": ["pro", "Prototype only"], prototype: ["pro", "Prototype only"], "in-development": ["unr", "In development"], announced: ["pre", "Announced"], unrevealed: ["unr", "Not yet revealed"] };
  function pill(st) { var p = PILL[st] || ["unr", st]; return '<span class="fd-pill ' + p[0] + '">' + esc(p[1]) + "</span>"; }
  function tba(v) { return v == null || v === "" || /^unknown$/i.test(String(v)) ? '<span class="fd-tba">TBA</span>' : esc(Array.isArray(v) ? v.join(", ") : v); }
  function short(v) { if (v == null) return v; v = String(v); var i = v.search(/[.(;]/); return i > 12 ? v.slice(0, i).trim() : v; }
  function ph(title, note, label) {
    return '<div class="fd-card"><div class="fd-ph"><div class="q">?</div><b>' + esc(title) + "</b>" + (note ? "<span>" + esc(note) + "</span>" : "") + '</div><div class="t">' + esc(label || title) + "</div></div>";
  }
  function imCard(im, alt) {
    return '<a class="fd-card" href="' + esc(im.file) + '" data-full="' + esc(im.file) + '" data-cap="' + esc((im.caption || "") + (im.credit ? " — " + im.credit : "")) + '">' + imgTag(im.file, alt) +
      '<div class="t">' + esc(im.title || im.caption || "") + '</div><div class="s">' + esc(im.credit || "") + "</div></a>";
  }
  function secOf(im) { return im.section || "other"; }
  function storeBlock(f) {
    var rows = (f.stores || []).slice(0, 5).map(function (s) {
      var price = s.priceType === "deposit" ? money(s) + " deposit" : s.priceType === "none" || s.price == null ? "Price not shown" : money(s);
      var full = s.fullPrice != null ? '<span class="fd-sub">full ' + esc(money({ price: s.fullPrice, currency: s.currency })) + "</span>" : s.priceType === "deposit" ? '<span class="fd-sub">full price TBA</span>' : s.wasPrice != null ? '<span class="fd-sub"><s>' + esc(money({ price: s.wasPrice, currency: s.currency })) + "</s></span>" : "";
      var src = s.priceSource === "search" ? '<span class="fd-sub">price from search snapshot</span>' : "";
      return '<a class="fd-store" href="' + esc(s.url) + '" target="_blank" rel="noopener"><div><div class="n">' + esc(s.store) + (s.variant ? ' <span class="fd-sub">' + esc(s.variant) + "</span>" : "") + '</div><div class="a ' + (/stock|open|pre-?order|avail/i.test(s.availability || "") && !/out|sold/i.test(s.availability || "") ? "ok" : "no") + '">' + esc(s.availability || "") + "</div>" + src + '</div><div class="p">' + esc(price) + full + "</div></a>";
    });
    (f.storesNotListed || []).forEach(function (s) { if (rows.length < 7) rows.push('<div class="fd-store off"><div><div class="n">' + esc(s.store) + '</div><div class="a no">' + esc(s.note || "Not listed") + '</div></div><div class="p">—</div></div>'); });
    if (!rows.length && !f.storesNote) return "";
    var checked = (f.stores || []).concat(f.storesNotListed || []).map(function (s) { return s.checked; }).filter(Boolean).sort().pop();
    return '<h2 class="fd-h">Where to buy' + (f.storesFor ? ' <span class="fd-sub">· ' + esc(f.storesFor) + "</span>" : "") + '</h2><div class="fd-box fd-stores">' + rows.join("") +
      '<p class="fd-note">' + esc(f.storesNote || "") + (checked ? " Prices checked " + esc(checked) + "." : "") + "</p></div>";
  }
  function stats(rows) { return '<div class="fd-box"><dl class="fd-dl">' + rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl></div>"; }
  function figStats(f, p) {
    if (f.basics) return stats(f.basics.map(function (r) { return [r[0], tba(r[1])]; }));
    var r = [];
    if (p) r.push(["Project", esc(p.nameEn) + ' <span class="fd-sub">' + esc(p.nameZh) + "</span>"]);
    if (f.kind !== "combiner") r.push(["Role", tba(f.role)]);
    r.push(["Alt mode", tba(short(f.altMode))]);
    if (f.pack) r.push(["Sold as", esc(f.pack)]);
    r.push(["Height", f.kind === "combiner" ? tba(short(f.heightCombined)) : tba(short(f.heightRobot))]);
    r.push(["Status", pill(f.status) + (f.releaseShort ? " " + esc(f.releaseShort) : "")]);
    r.push(["Price", tba(f.priceShort || short(f.priceOfficial))]);
    return stats(r);
  }
  function sectionHtml(title, items, sub) { return '<h2 class="fd-h">' + esc(title) + (sub ? ' <span class="fd-sub">· ' + esc(sub) + "</span>" : "") + '</h2><div class="fd-grid">' + items.join("") + "</div>"; }
  function gallery(f, p) {
    var ims = f.images || [], phs = f.placeholders || [], out = "";
    var pre = f.status === "released" ? "No official image found" : "Not yet revealed";
    var order = f.kind === "combiner" || f.kind === "edition" ? ["combined", "robot", "vehicle", "part", "other"] : ["robot", "vehicle", "part", "combined", "other"];
    order.forEach(function (sec) {
      var list = ims.filter(function (im) { return secOf(im) === sec; }).map(function (im) { return imCard(im, f.nameEn); });
      if (sec === "combined" && f.kind !== "combiner" && f.kind !== "edition") {
        [p && p.combinerId].concat(f.fullCombinerFrom || []).forEach(function (cid) {
          var c = cid && cid !== f.id && fig(cid); if (!c) return;
          (c.images || []).filter(function (im) { return secOf(im) === "combined"; }).slice(0, 3).forEach(function (im) { list.push(imCard(im, c.nameEn)); });
        });
      }
      phs.filter(function (x) { return x.section === sec; }).forEach(function (x) { list.push(ph(x.title || pre, x.note, x.label)); });
      var title = sec === "part" ? "Combined: " + (f.partLabel || "its part") : sec === "combined" && (f.kind === "combiner" || f.kind === "edition") ? "Combined mode" : SEC[sec];
      if (!list.length) {
        if (sec === "other") return;
        if (sec === "part" && !f.partLabel) return;
        if ((sec === "robot" || sec === "vehicle") && (f.kind === "combiner" || f.kind === "edition" || f.kind === "accessory")) return;
        list.push(ph(pre, f.status === "released" ? "" : "No official photo published yet", title));
      }
      out += sectionHtml(title, list);
    });
    return out;
  }
  function heroOf(f) {
    var ims = f.images || [];
    var pick = ims.find(function (im) { return im.hero; }) || ims[0];
    return pick;
  }
  function figure(id) {
    var f = fig(id); if (!f) return notFound();
    var p = proj(f.project), comb = p && fig(p.combinerId);
    if (f.kind === "combiner" && p) return project(p.id, true);
    var rel = [];
    if (p) rel.push('<a href="#/project/' + encodeURIComponent(p.id) + '"><b>Team</b>' + esc(p.nameEn) + "</a>");
    if (p) p.groups.forEach(function (g) { g.ids.forEach(function (oid) {
      if (oid === f.id || oid === p.combinerId) return; var o = fig(oid); if (!o || o.kind !== f.kind) return;
      rel.push('<a href="#/figure/' + encodeURIComponent(o.id) + '"><b>' + esc(o.pack && o.pack === f.pack ? "Pack-mate" : (KIND[o.kind] || "")) + "</b>" + esc(o.nameEn) + "</a>");
    }); });
    var h0 = heroOf(f);
    app.innerHTML = '<a class="back" href="' + (p ? "#/project/" + encodeURIComponent(p.id) : "#/") + '">← ' + esc(p ? p.nameEn : "Catalog") + "</a>" +
      '<div class="fd-head"><span class="code">' + esc(f.code && f.code !== "unknown" ? f.code : "") + " · " + esc(KIND[f.kind] || "") + "</span><h1>" + esc(f.nameEn) + '</h1><div class="zh">' + esc(f.nameZh) + (f.homage ? " · " + esc(f.homage.split(" (")[0]) + " homage" : "") + "</div></div>" +
      '<div class="fd-layout"><div class="fd-left">' +
      (h0 ? '<div class="fd-hero" data-full="' + esc(h0.file) + '" data-cap="' + esc(h0.caption || "") + '">' + imgTag(h0.file, f.nameEn, true) + '</div><p class="fd-cap">' + esc((h0.title ? h0.title + " — " : "") + (h0.caption || "")) + "</p>"
        : '<div class="fd-hero">' + ph(f.status === "released" ? "No official image yet" : "Not yet revealed", "No official photo published yet") + "</div>") +
      "</div><div>" + figStats(f, p) + storeBlock(f) + '<div class="rel">' + rel.join("") + "</div></div></div>" +
      gallery(f, p) +
      '<details class="fd-src"><summary>Sources &amp; notes</summary>' + (f.notes ? "<p>" + esc(f.notes) + "</p>" : "") + '<div class="sources">' + (f.sources || []).map(function (u) { return '<a href="' + esc(u) + '" rel="noopener" target="_blank">' + esc(u.replace(/^https?:\/\/(www\.)?/, "")) + "</a>"; }).join("") + "</div></details>";
    bindLb();
  }
  function rosterCard(o) {
    var h = heroOf(o);
    return '<a class="fd-card" href="#/figure/' + encodeURIComponent(o.id) + '">' + (h ? imgTag(h.file, o.nameEn) : '<div class="fd-ph"><div class="q">?</div><b>No image yet</b></div>') +
      '<div class="t">' + esc((o.code && o.code !== "unknown" && o.kind === "member" ? o.code + " " : "") + o.nameEn) + " " + esc(o.nameZh || "") + "</div>" +
      '<div class="s">' + pill(o.status) + " " + esc(o.role || "Role TBA") + "</div></a>";
  }
  function project(id, fromFigure) {
    var p = proj(id); if (!p) return notFound();
    var l = line(p.line), c = fig(p.combinerId) || {};
    var combImgs = (c.images || []).filter(function (im) { return secOf(im) === "combined"; });
    var h0 = combImgs.find(function (im) { return im.hero; }) || combImgs[0];
    var cph = p.combinedPlaceholder;
    var hero = h0 ? '<div class="fd-hero" data-full="' + esc(h0.file) + '" data-cap="' + esc(h0.caption || "") + '">' + imgTag(h0.file, p.nameEn, true) + '</div><p class="fd-cap">' + esc(h0.caption || "") + "</p>"
      : '<div class="fd-hero">' + ph((cph && cph.title) || "Combined mode not yet revealed", cph && cph.note) + "</div>";
    var thumbs = (c.images || []).slice(0, 8).map(function (im) { return '<a href="' + esc(im.file) + '" data-full="' + esc(im.file) + '" data-cap="' + esc(im.caption || "") + '">' + imgTag(im.file, p.nameEn) + "</a>"; }).join("");
    var rows = [["Line", esc(l ? l.nameEn + " · " + l.nameZh : "")], ["Homage", esc(p.homage)], ["Combined height", tba(short(c.heightCombined))], ["Member height", tba(short(c.heightRobot))]];
    var mem = [].concat.apply([], p.groups.filter(function (g) { return g.kind === "member"; }).map(function (g) { return g.ids; })).map(fig).filter(Boolean);
    rows.push(["Members", mem.length + " revealed" + (p.memberCount ? " of " + esc(p.memberCount) : (p.unrevealed && p.unrevealed.length ? " · total TBA" : ""))]);
    rows.push(["Status", pill(c.status || "in-development") + (c.releaseShort ? " " + esc(c.releaseShort) : "")]);
    rows.push(["Price", tba(c.priceShort || short(c.priceOfficial))]);
    var h = '<a class="back" href="#/">← Catalog</a><div class="fd-head"><span class="code">' + esc(l ? l.nameEn : "") + "</span><h1>" + esc(p.nameEn) + '</h1><div class="zh">' + esc(p.nameZh) + "</div></div>" +
      '<div class="fd-layout"><div class="fd-left">' + hero + (thumbs ? '<div class="fd-thumbs">' + thumbs + "</div>" : "") + "</div><div>" + stats(rows) + storeBlock(c) +
      '<p class="fd-sum">' + esc(p.summary) + "</p></div></div>";
    p.groups.forEach(function (g) {
      if (g.kind === "combiner") return;
      var items = g.ids.map(fig).filter(Boolean).map(rosterCard);
      if (g.kind === "member") (p.unrevealed || []).forEach(function (u) { items.push(ph(u.title || "Not yet revealed", u.note, u.label || "Member TBA")); });
      h += sectionHtml(g.kind === "member" ? "Member roster" : g.title, items, g.kind === "member" ? g.title : "");
    });
    if (p.notes && p.notes.length) h += '<details class="fd-src" open><summary>How it fits together · open questions</summary><ul>' + p.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></details>";
    app.innerHTML = h; bindLb();
  }

  function prices() {
    var d = S.data;
    var rows = (d.topPicks || []).map(fig).filter(Boolean).map(function (f, i) {
      var s = (f.stores || []).filter(function (x) { return x.priceType !== "deposit" && x.price != null; })[0] || f.stores[0];
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
