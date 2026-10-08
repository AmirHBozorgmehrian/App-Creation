"use strict";
// Shared by the GitHub Action (scripts/gold-monitor.mjs) AND the app, so the
// parsing / MGG maths / trend logic lives in exactly one place.
// Plain CommonJS, no dependencies, nothing Node-specific -> runs in Hermes too.

// ---------------------------------------------------------------- config ---
const SITE_ORIGIN = "https://www.sarafiyaran.com";
const SITE_URL = SITE_ORIGIN + "/";

// Sarafiyaran shows prices in TOMAN. 1 toman = 10 rial. If the site ever
// switches to rial, set this to 1.
const TOMAN_TO_RIAL = 10;

// 1 troy ounce = 31.1034768 g = 31,103.4768 mg
const MG_PER_TROY_OUNCE = 31103.4768;

const REFRESH_EVERY_MS = 30 * 60 * 1000;

// Iran has no daylight saving any more: fixed UTC+3:30.
const IRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

// Iranian business hours, in Iran local time. Day keys: 0=Sun ... 6=Sat.
// Sat-Wed full day, Thursday morning only, Friday closed.
// (Official holidays such as Nowruz are not known to this code.)
const BUSINESS_HOURS = {
  6: [9 * 60, 19 * 60], // Saturday
  0: [9 * 60, 19 * 60], // Sunday
  1: [9 * 60, 19 * 60], // Monday
  2: [9 * 60, 19 * 60], // Tuesday
  3: [9 * 60, 19 * 60], // Wednesday
  4: [9 * 60, 13 * 60], // Thursday (half day)
  // 5 (Friday): closed
};

// World gold price in USD per troy ounce. First one that answers wins.
const ONS_SOURCES = [
  {
    name: "gold-api.com",
    url: "https://api.gold-api.com/price/XAU",
    pick: function (j) { return Number(j && j.price); },
  },
  {
    name: "goldprice.org",
    url: "https://data-asg.goldprice.org/dbXRates/USD",
    pick: function (j) { return Number(j && j.items && j.items[0] && j.items[0].xauPrice); },
  },
];

// --------------------------------------------------------------- helpers ---
function normalizeDigits(s) {
  return String(s)
    .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06f0); })
    .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
    .replace(/\u066C/g, ",")
    .replace(/\u066B/g, ".");
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&zwnj;/gi, "\u200c")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); });
}

function stripTags(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseNum(text) {
  if (text === null || text === undefined) return null;
  var t = normalizeDigits(text).replace(/[,\s]/g, "");
  var m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function resolveUrl(href) {
  if (!href) return null;
  href = decodeEntities(href.trim());
  if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.indexOf("//") === 0) return "https:" + href;
  if (href.charAt(0) === "/") return SITE_ORIGIN + href;
  return SITE_ORIGIN + "/" + href;
}

function fetchWithTimeout(url, opts, ms) {
  var ctrl = new AbortController();
  var id = setTimeout(function () { ctrl.abort(); }, ms || 15000);
  var o = Object.assign({}, opts || {}, { signal: ctrl.signal });
  return fetch(url, o).finally(function () { clearTimeout(id); });
}

// --------------------------------------------------------- business time ---
function iranDate(ms) { return new Date(ms + IRAN_OFFSET_MS); }

function isIranBusinessTime(date) {
  var ms = date instanceof Date ? date.getTime() : Number(date);
  var d = iranDate(ms);
  var win = BUSINESS_HOURS[d.getUTCDay()];
  if (!win) return false;
  var mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= win[0] && mins <= win[1];
}

// Start (UTC ms) of the current Iranian calendar day.
function iranDayStart(ms) {
  var day = 24 * 60 * 60 * 1000;
  return Math.floor((ms + IRAN_OFFSET_MS) / day) * day - IRAN_OFFSET_MS;
}

// ---------------------------------------------------- Sarafiyaran parser ---
var DATE_RE = /\d{4}\/\d{1,2}\/\d{1,2}/;
var TIME_RE = /\d{1,2}:\d{2}(?::\d{2})?/;

function sectionTitleFrom(before) {
  var hs = [];
  var re = /<(h[1-6]|caption|legend)[^>]*>([\s\S]*?)<\/\1>/gi;
  var m;
  while ((m = re.exec(before))) hs.push(m[2]);
  for (var i = hs.length - 1; i >= 0; i--) {
    var t = stripTags(hs[i]);
    if (t && t.length < 80) return t;
  }
  var lines = decodeEntities(
    before
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  )
    .split("\n")
    .map(function (l) { return l.replace(/\s+/g, " ").trim(); })
    .filter(function (l) {
      if (!l) return false;
      var n = normalizeDigits(l);
      return !DATE_RE.test(n) && !TIME_RE.test(n);
    });
  var last = lines.length ? lines[lines.length - 1] : "";
  return last.length < 80 ? last : "";
}

function findSiteTime(text) {
  var n = normalizeDigits(text);
  var d = n.match(DATE_RE);
  var t = n.match(TIME_RE);
  if (!d && !t) return null;
  return ((d ? d[0] : "") + " " + (t ? t[0] : "")).trim();
}

function chartUrlFrom(cellHtml) {
  var m =
    cellHtml.match(/(?:href|data-href|data-url|data-link|data-chart|data-src)\s*=\s*["']([^"']+)["']/i) ||
    cellHtml.match(/onclick\s*=\s*["'][^"']*?['"]([^'"]+)['"]/i);
  return m ? resolveUrl(m[1]) : null;
}

function chartImageFrom(cellHtml) {
  var m = cellHtml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  return m ? resolveUrl(m[1]) : null;
}

// Turns the home page HTML into { sections, currencySections, rows }.
// It looks for every <table>, takes the heading just above it as the section
// name, and reads each row as: title | buy | sell | change | chart.
function parseSarafiyaranHtml(html) {
  var sections = [];
  var currencySections = [];
  var rows = 0;

  var tableRe = /<table[\s\S]*?<\/table>/gi;
  var m;
  var last = 0;
  while ((m = tableRe.exec(html))) {
    var tableHtml = m[0];
    var before = html.slice(last, m.index);
    last = m.index + tableHtml.length;

    var title = sectionTitleFrom(before);
    var siteTime = findSiteTime(stripTags(before).slice(-200) + " " + stripTags(tableHtml.slice(0, 600)));

    var idx = { title: 0, buy: 1, sell: 2, change: 3, chart: -1 };
    var items = [];
    var rowRe = /<tr[\s\S]*?<\/tr>/gi;
    var rm;
    while ((rm = rowRe.exec(tableHtml))) {
      var cells = [];
      var cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
      var cm;
      while ((cm = cellRe.exec(rm[0]))) cells.push({ html: cm[2], text: stripTags(cm[2]) });
      if (cells.length < 3) continue;

      var joined = cells.map(function (c) { return c.text; }).join("|");
      if (joined.indexOf("خرید") >= 0 && joined.indexOf("فروش") >= 0) {
        // header row: learn the column positions
        cells.forEach(function (c, i) {
          if (c.text.indexOf("عنوان") >= 0 || c.text.indexOf("نام") >= 0) idx.title = i;
          else if (c.text.indexOf("خرید") >= 0) idx.buy = i;
          else if (c.text.indexOf("فروش") >= 0) idx.sell = i;
          else if (c.text.indexOf("تغییر") >= 0) idx.change = i;
          else if (c.text.indexOf("نمودار") >= 0) idx.chart = i;
        });
        continue;
      }

      var name = cells[idx.title] ? cells[idx.title].text : "";
      var buy = cells[idx.buy] ? parseNum(cells[idx.buy].text) : null;
      var sell = cells[idx.sell] ? parseNum(cells[idx.sell].text) : null;
      if (!name || (buy === null && sell === null)) continue;
      if (buy === 0) buy = null; // 0 means "not bought here"
      if (sell === 0) sell = null;
      if (buy === null && sell === null) continue;

      var chartCell = idx.chart >= 0 ? cells[idx.chart] : cells[cells.length - 1];
      var changeCell = cells[idx.change];
      items.push({
        id: title + "|" + name,
        title: name,
        buy: buy,
        sell: sell,
        siteChange: changeCell && changeCell.text ? changeCell.text : null,
        chartUrl: chartCell ? chartUrlFrom(chartCell.html) : null,
        chartImage: chartCell ? chartImageFrom(chartCell.html) : null,
        change: null,
      });
    }

    if (!items.length) continue;
    rows += items.length;

    var isCurrency =
      /ارز|حواله|اسکناس/.test(title) ||
      items.every(function (it) { return /^نرخ ارز/.test(it.title); });
    (isCurrency ? currencySections : sections).push({ title: title || "—", siteTime: siteTime, items: items });
  }

  // guarantee unique ids across the page
  var seen = {};
  sections.concat(currencySections).forEach(function (s) {
    s.items.forEach(function (it) {
      if (seen[it.id]) { seen[it.id] += 1; it.id = it.id + "#" + seen[it.id]; }
      else seen[it.id] = 1;
    });
  });

  return { sections: sections, currencySections: currencySections, rows: rows };
}

function findUsdRate(currencySections) {
  for (var i = 0; i < currencySections.length; i++) {
    var items = currencySections[i].items;
    for (var j = 0; j < items.length; j++) {
      if (/دلار\s*آمریکا/.test(items[j].title)) {
        var it = items[j];
        var vals = [it.buy, it.sell].filter(function (v) { return v !== null; });
        if (!vals.length) continue;
        var mid = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        return { buy: it.buy, sell: it.sell, toman: mid, rial: mid * TOMAN_TO_RIAL, stale: false };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------ world gold ---
async function fetchOunceUsd() {
  var errors = [];
  for (var i = 0; i < ONS_SOURCES.length; i++) {
    var s = ONS_SOURCES[i];
    try {
      var res = await fetchWithTimeout(s.url, { headers: { Accept: "application/json" } }, 15000);
      if (!res.ok) throw new Error("HTTP " + res.status);
      var price = s.pick(await res.json());
      if (!isFinite(price) || price < 500 || price > 100000) throw new Error("implausible price " + price);
      return { usd: price, source: s.name, stale: false };
    } catch (e) {
      errors.push(s.name + ": " + (e && e.message ? e.message : e));
    }
  }
  throw new Error("No world gold price available (" + errors.join("; ") + ")");
}

function computeMgg(onsUsd, rialRate) {
  var usd = onsUsd / MG_PER_TROY_OUNCE;
  return { usd: usd, rial: rialRate ? usd * rialRate : null };
}

// --------------------------------------------------------------- history ---
// history = { v:1, keys:[itemId...], points:[ [t, onsUsd|null, usdRial|null, [price per key...]] ] }
var HISTORY_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
var HISTORY_MAX_POINTS = 4000;

function emptyHistory() { return { v: 1, keys: [], points: [] }; }

function appendHistory(history, snap, nowMs) {
  var h = history && history.points && history.keys ? history : emptyHistory();
  var keyIdx = {};
  h.keys.forEach(function (k, i) { keyIdx[k] = i; });
  var vals = [];
  if (snap.sarafi.ok) {
    snap.sections.forEach(function (sec) {
      sec.items.forEach(function (it) {
        var i = keyIdx[it.id];
        if (i === undefined) { i = h.keys.length; h.keys.push(it.id); keyIdx[it.id] = i; }
        vals[i] = it.sell !== null ? it.sell : it.buy;
      });
    });
  }
  for (var i2 = 0; i2 < vals.length; i2++) if (vals[i2] === undefined) vals[i2] = null;
  h.points.push([
    nowMs,
    snap.ons && !snap.ons.stale ? snap.ons.usd : null,
    snap.usdRate && !snap.usdRate.stale ? snap.usdRate.rial : null,
    vals,
  ]);
  var minT = nowMs - HISTORY_MAX_AGE_MS;
  h.points = h.points.filter(function (p) { return p[0] >= minT; });
  if (h.points.length > HISTORY_MAX_POINTS) h.points = h.points.slice(-HISTORY_MAX_POINTS);
  return h;
}

// Reference value for "change today": last value before today (Iran time),
// or, if there is none yet, the oldest value that is at least 10 min old.
function refValue(points, get, nowMs) {
  var dayStart = iranDayStart(nowMs);
  for (var i = points.length - 1; i >= 0; i--) {
    if (points[i][0] < dayStart) {
      var v = get(points[i]);
      if (v !== null && v !== undefined) return { v: v, t: points[i][0] };
    }
  }
  for (var j = 0; j < points.length; j++) {
    var w = get(points[j]);
    if (w !== null && w !== undefined) {
      return nowMs - points[j][0] > 10 * 60 * 1000 ? { v: w, t: points[j][0] } : null;
    }
  }
  return null;
}

function changeFrom(cur, ref) {
  if (cur === null || cur === undefined || !ref || !ref.v) return null;
  return { abs: cur - ref.v, pct: ((cur - ref.v) / ref.v) * 100, since: ref.t };
}

// ---------------------------------------------------------- the snapshot ---
// Builds the JSON the app shows. `html` / `ons` are the fresh fetch results
// (or null + an error string). Anything that failed falls back to `prev`
// and is flagged stale instead of silently showing old numbers as new.
function buildSnapshot(args) {
  var nowMs = args.nowMs;
  var prev = args.prev || null;

  var parsed = args.html ? parseSarafiyaranHtml(args.html) : null;
  var sarafiOk = !!(parsed && parsed.rows > 0);
  var sarafiError = sarafiOk
    ? null
    : args.htmlError || (parsed ? "Fetched the page but found 0 price rows - the site layout may have changed" : "Not fetched");

  var sections = sarafiOk ? parsed.sections : prev ? prev.sections || [] : [];
  var currencySections = sarafiOk ? parsed.currencySections : prev ? prev.currencySections || [] : [];

  var usdRate = sarafiOk ? findUsdRate(currencySections) : null;
  if (!usdRate && prev && prev.usdRate) usdRate = Object.assign({}, prev.usdRate, { stale: true });

  var ons = args.ons ? { usd: args.ons.usd, source: args.ons.source, stale: false } : null;
  if (!ons && prev && prev.ons) ons = Object.assign({}, prev.ons, { stale: true });

  var snap = {
    v: 1,
    generatedAt: new Date(nowMs).toISOString(),
    source: args.source || "action",
    unit: "toman",
    sarafi: {
      ok: sarafiOk,
      rows: parsed ? parsed.rows : 0,
      error: sarafiError,
      lastOkAt: sarafiOk ? new Date(nowMs).toISOString() : prev && prev.sarafi ? prev.sarafi.lastOkAt || null : null,
    },
    onsError: args.onsError || null,
    ons: ons,
    usdRate: usdRate,
    mgg: null,
    sections: sections,
    currencySections: currencySections,
  };

  var history = appendHistory(args.history, snap, nowMs);
  var pts = history.points;

  if (ons && usdRate) {
    var m = computeMgg(ons.usd, usdRate.rial);
    var refUsd = refValue(pts, function (p) { return p[1] === null ? null : p[1] / MG_PER_TROY_OUNCE; }, nowMs);
    var refRial = refValue(
      pts,
      function (p) { return p[1] === null || p[2] === null ? null : (p[1] / MG_PER_TROY_OUNCE) * p[2]; },
      nowMs
    );
    snap.mgg = {
      usd: m.usd,
      rial: m.rial,
      usdChange: changeFrom(m.usd, refUsd),
      rialChange: changeFrom(m.rial, refRial),
      stale: !!(ons.stale || usdRate.stale),
    };
  } else if (ons) {
    snap.mgg = { usd: ons.usd / MG_PER_TROY_OUNCE, rial: null, usdChange: null, rialChange: null, stale: !!ons.stale };
  }

  var keyIdx = {};
  history.keys.forEach(function (k, i) { keyIdx[k] = i; });
  sections.forEach(function (sec) {
    sec.items.forEach(function (it) {
      var i = keyIdx[it.id];
      var cur = it.sell !== null ? it.sell : it.buy;
      if (i === undefined || !sarafiOk) { it.change = sarafiOk ? null : it.change; return; }
      var ref = refValue(pts, function (p) { var v = p[3][i]; return v === undefined ? null : v; }, nowMs);
      it.change = changeFrom(cur, ref);
    });
  });

  return { snapshot: snap, history: history };
}

module.exports = {
  SITE_URL: SITE_URL,
  MG_PER_TROY_OUNCE: MG_PER_TROY_OUNCE,
  TOMAN_TO_RIAL: TOMAN_TO_RIAL,
  REFRESH_EVERY_MS: REFRESH_EVERY_MS,
  BUSINESS_HOURS: BUSINESS_HOURS,
  normalizeDigits: normalizeDigits,
  parseNum: parseNum,
  stripTags: stripTags,
  fetchWithTimeout: fetchWithTimeout,
  isIranBusinessTime: isIranBusinessTime,
  iranDayStart: iranDayStart,
  parseSarafiyaranHtml: parseSarafiyaranHtml,
  findUsdRate: findUsdRate,
  fetchOunceUsd: fetchOunceUsd,
  computeMgg: computeMgg,
  emptyHistory: emptyHistory,
  appendHistory: appendHistory,
  buildSnapshot: buildSnapshot,
};
