"use strict";
// Data layer for the Gold screen. Plain CommonJS, no dependencies.
// Everything comes from Sarafiyaran's own JSON service (api.sarafiyaran.com):
//   GET /api/item/1/all                          -> catalogue (id, category, name)
//   GET /api/price/1                             -> live buy/sell for every item
//   GET /api/price/history-all/1/{id}/{from}/{to}-> daily history for one item
// plus a public API for the world gold price (for MGG).

// ---------------------------------------------------------------- config ---
const API_BASE = "https://api.sarafiyaran.com/api";
const BRANCH = 1;

// Sarafiyaran prices are in TOMAN. 1 toman = 10 rial.
const TOMAN_TO_RIAL = 10;
// Item used as the USD -> rial rate for MGG (دلار آمریکا). The NIMA dollar
// (id 327) exists on the site but currently has no price (0).
const USD_ITEM_ID = 8;

const MG_PER_TROY_OUNCE = 31103.4768;
const REFRESH_EVERY_MS = 30 * 60 * 1000;
const IRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000; // Iran: UTC+3:30, no DST

// Iranian business hours in Iran local time. Day keys: 0=Sun ... 6=Sat.
// Sat-Wed full day, Thursday morning, Friday closed. Holidays are not known.
const BUSINESS_HOURS = {
  6: [9 * 60, 19 * 60],
  0: [9 * 60, 19 * 60],
  1: [9 * 60, 19 * 60],
  2: [9 * 60, 19 * 60],
  3: [9 * 60, 19 * 60],
  4: [9 * 60, 13 * 60],
};

// Boxes on the site, by categoryId. gold:true ones go on the Gold screen.
const CATEGORIES = {
  7: { title: "سکه های بانکی", gold: true, order: 1 },
  3: { title: "شمش طلا", gold: true, order: 2 },
  23: { title: "سکه های پارسیان", gold: true, order: 3 },
  27: { title: "طلاهای آبشده", gold: true, order: 4 },
  5: { title: "نرخ ارز", gold: false, order: 5 },
  28: { title: "نرخ ارز نیمایی", gold: false, order: 6 },
};

const ONS_SOURCES = [
  { name: "gold-api.com", url: "https://api.gold-api.com/price/XAU", pick: function (j) { return Number(j && j.price); } },
  {
    name: "goldprice.org",
    url: "https://data-asg.goldprice.org/dbXRates/USD",
    pick: function (j) { return Number(j && j.items && j.items[0] && j.items[0].xauPrice); },
  },
];

// --------------------------------------------------------------- helpers ---
function fetchWithTimeout(url, opts, ms) {
  var ctrl = new AbortController();
  var id = setTimeout(function () { ctrl.abort(); }, ms || 15000);
  var o = Object.assign({}, opts || {}, { signal: ctrl.signal });
  return fetch(url, o).finally(function () { clearTimeout(id); });
}

async function fetchJson(url, ms) {
  var res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, ms || 20000);
  if (!res.ok) throw new Error("HTTP " + res.status + " from " + url.replace(API_BASE, ""));
  return res.json();
}

function posNum(v) {
  var n = Number(v);
  return v !== null && v !== undefined && isFinite(n) && n > 0 ? n : null;
}

function iranDate(ms) { return new Date(ms + IRAN_OFFSET_MS); }

function isIranBusinessTime(date) {
  var ms = date instanceof Date ? date.getTime() : Number(date);
  var d = iranDate(ms);
  var win = BUSINESS_HOURS[d.getUTCDay()];
  if (!win) return false;
  var mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= win[0] && mins <= win[1];
}

function iranDayStart(ms) {
  var day = 24 * 60 * 60 * 1000;
  return Math.floor((ms + IRAN_OFFSET_MS) / day) * day - IRAN_OFFSET_MS;
}

// Gregorian date in Iran as a number: 20261009
function iranYmd(ms) {
  var d = iranDate(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// Gregorian -> Jalali (Persian) calendar
function toJalali(gy, gm, gd) {
  var gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var gy2 = gm > 2 ? gy + 1 : gy;
  var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
  var jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

// 20261009 -> "1405/07/17"
function formatJalaliYmd(ymd) {
  var j = toJalali(Math.floor(ymd / 10000), Math.floor((ymd % 10000) / 100), ymd % 100);
  return j[0] + "/" + pad2(j[1]) + "/" + pad2(j[2]);
}

// "2026-10-08T14:58:49.1" (Iran local) -> "1405/07/16 14:58"
function formatJalaliIso(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
  if (!m) return "";
  return formatJalaliYmd(Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3])) + " " + m[4] + ":" + m[5];
}

// -------------------------------------------------------- API: parse/fetch ---
function parseCatalog(json) {
  if (!json || !Array.isArray(json.result)) throw new Error("Unexpected item list from the site");
  return json.result.map(function (x) {
    return {
      itemId: Number(x.id),
      categoryId: Number(x.categoryId),
      title: String(x.title || "").replace(/\s+/g, " ").trim(),
      unit: x.unit ? String(x.unit).trim() : "",
      sortOrder: Number(x.sortOrder) || 0,
    };
  });
}

function parsePrices(json) {
  if (!json || !Array.isArray(json.result)) throw new Error("Unexpected price list from the site");
  return json.result.map(function (x) {
    return { itemId: Number(x.itemId), buy: posNum(x.price1), sell: posNum(x.price2), modifiedOn: x.modifiedOn || null };
  });
}

function rep(p) { return p.sell !== null ? p.sell : p.buy; }

// The site's data has the odd typo (e.g. 18.8M among values near 190M).
// Drop a point that is less than half / more than double the median of its neighbours.
function cleanSeries(points) {
  if (points.length < 5) return points;
  return points.filter(function (p, i) {
    var near = [];
    for (var k = Math.max(0, i - 3); k <= Math.min(points.length - 1, i + 3); k++) {
      if (k !== i) near.push(rep(points[k]));
    }
    near.sort(function (a, b) { return a - b; });
    var med = near[Math.floor(near.length / 2)];
    var v = rep(p);
    return v >= med * 0.5 && v <= med * 2;
  });
}

// -> [{ ymd, buy, sell }] oldest first, closed days (no price) removed
function parseHistory(json) {
  if (!json || !Array.isArray(json.result)) throw new Error("Unexpected history from the site");
  var pts = [];
  json.result.forEach(function (r) {
    var buy = posNum(r.price1);
    var sell = posNum(r.price2);
    if (buy === null && sell === null) return;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.date || "");
    if (!m) return;
    pts.push({ ymd: Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]), buy: buy, sell: sell });
  });
  pts.sort(function (a, b) { return a.ymd - b.ymd; });
  return cleanSeries(pts);
}

function historyUrl(itemId, fromMs, toMs) {
  return API_BASE + "/price/history-all/" + BRANCH + "/" + itemId + "/" + iranYmd(fromMs) + "/" + iranYmd(toMs);
}

async function fetchCatalog() { return parseCatalog(await fetchJson(API_BASE + "/item/" + BRANCH + "/all")); }
async function fetchPrices() { return parsePrices(await fetchJson(API_BASE + "/price/" + BRANCH)); }
async function fetchHistory(itemId, fromMs, toMs) { return parseHistory(await fetchJson(historyUrl(itemId, fromMs, toMs))); }

// Last recorded day BEFORE today (Iran time) = the reference for "change today".
function dayRefFromHistory(points, nowMs) {
  var today = iranYmd(nowMs);
  for (var i = points.length - 1; i >= 0; i--) {
    if (points[i].ymd < today) return { v: rep(points[i]), ymd: points[i].ymd };
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

// ------------------------------------- phone-side history (for MGG trend) ---
// history = { v:1, keys:[], points:[ [t, onsUsd|null, usdRial|null, []] ] }
var HISTORY_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
var HISTORY_MAX_POINTS = 4000;

function emptyHistory() { return { v: 1, keys: [], points: [] }; }

function appendHistory(history, snap, nowMs) {
  var h = history && history.points ? history : emptyHistory();
  h.points.push([
    nowMs,
    snap.ons && !snap.ons.stale ? snap.ons.usd : null,
    snap.usdRate && !snap.usdRate.stale ? snap.usdRate.rial : null,
    [],
  ]);
  var minT = nowMs - HISTORY_MAX_AGE_MS;
  h.points = h.points.filter(function (p) { return p[0] >= minT; });
  if (h.points.length > HISTORY_MAX_POINTS) h.points = h.points.slice(-HISTORY_MAX_POINTS);
  return h;
}

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
    if (w !== null && w !== undefined) return nowMs - points[j][0] > 10 * 60 * 1000 ? { v: w, t: points[j][0] } : null;
  }
  return null;
}

function changeFrom(cur, ref) {
  if (cur === null || cur === undefined || !ref || !ref.v) return null;
  return { abs: cur - ref.v, pct: ((cur - ref.v) / ref.v) * 100, since: ref.t || null };
}

// ---------------------------------------------------------- the snapshot ---
// args: catalog, prices (arrays or null), catalogError, pricesError,
//       ons ({usd,source} or null), onsError, prev (last snapshot), history
//       (phone-side), dayRefs ({ [itemId]: {v, ymd} | null }), nowMs
function buildSnapshot(args) {
  var nowMs = args.nowMs;
  var prev = args.prev || null;
  var dayRefs = args.dayRefs || {};

  var ok = !!(args.catalog && args.prices && args.prices.length);
  var error = ok ? null : args.catalogError || args.pricesError || "No prices received";

  var sections = [];
  var currencySections = [];
  var priceTime = null;

  if (ok) {
    var priceById = {};
    args.prices.forEach(function (p) {
      priceById[p.itemId] = p;
      if (p.modifiedOn && (!priceTime || p.modifiedOn > priceTime)) priceTime = p.modifiedOn;
    });
    var byCat = {};
    args.catalog.forEach(function (c) {
      var p = priceById[c.itemId];
      if (!p || (p.buy === null && p.sell === null)) return; // not published
      var item = {
        id: String(c.itemId), itemId: c.itemId, title: c.title, unit: c.unit,
        buy: p.buy, sell: p.sell, change: null, modifiedOn: p.modifiedOn, _sort: c.sortOrder,
      };
      var ref = dayRefs[c.itemId];
      item.change = changeFrom(rep(item), ref ? { v: ref.v, t: null, ymd: ref.ymd } : null);
      (byCat[c.categoryId] = byCat[c.categoryId] || []).push(item);
    });
    Object.keys(byCat)
      .map(Number)
      .sort(function (a, b) {
        var oa = CATEGORIES[a] ? CATEGORIES[a].order : 100 + a;
        var ob = CATEGORIES[b] ? CATEGORIES[b].order : 100 + b;
        return oa - ob;
      })
      .forEach(function (cid) {
        var items = byCat[cid].sort(function (a, b) { return a._sort - b._sort || a.itemId - b.itemId; });
        items.forEach(function (it) { delete it._sort; });
        var meta = CATEGORIES[cid] || { title: "دسته " + cid, gold: false };
        (meta.gold ? sections : currencySections).push({ title: meta.title, items: items });
      });
  } else if (prev) {
    sections = prev.sections || [];
    currencySections = prev.currencySections || [];
    priceTime = prev.sarafi ? prev.sarafi.priceTime : null;
  }

  var usdRate = null;
  currencySections.forEach(function (s) {
    s.items.forEach(function (it) {
      if (it.itemId === USD_ITEM_ID && !usdRate) {
        var vals = [it.buy, it.sell].filter(function (v) { return v !== null; });
        if (vals.length) {
          var mid = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
          usdRate = { buy: it.buy, sell: it.sell, toman: mid, rial: mid * TOMAN_TO_RIAL, stale: !ok };
        }
      }
    });
  });
  if (!usdRate && prev && prev.usdRate) usdRate = Object.assign({}, prev.usdRate, { stale: true });

  var ons = args.ons ? { usd: args.ons.usd, source: args.ons.source, stale: false } : null;
  if (!ons && prev && prev.ons) ons = Object.assign({}, prev.ons, { stale: true });

  var rows = 0;
  sections.forEach(function (s) { rows += s.items.length; });

  var snap = {
    v: 2,
    generatedAt: new Date(nowMs).toISOString(),
    source: "direct",
    unit: "toman",
    sarafi: {
      ok: ok,
      rows: rows,
      error: error,
      priceTime: priceTime,
      lastOkAt: ok ? new Date(nowMs).toISOString() : prev && prev.sarafi ? prev.sarafi.lastOkAt || null : null,
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

  if (ons) {
    var m = computeMgg(ons.usd, usdRate ? usdRate.rial : null);
    var refUsd = refValue(pts, function (p) { return p[1] === null ? null : p[1] / MG_PER_TROY_OUNCE; }, nowMs);
    var refRial = refValue(pts, function (p) { return p[1] === null || p[2] === null ? null : (p[1] / MG_PER_TROY_OUNCE) * p[2]; }, nowMs);
    snap.mgg = {
      usd: m.usd,
      rial: m.rial,
      usdChange: changeFrom(m.usd, refUsd),
      rialChange: m.rial === null ? null : changeFrom(m.rial, refRial),
      stale: !!(ons.stale || (usdRate && usdRate.stale)),
    };
  }

  return { snapshot: snap, history: history };
}

module.exports = {
  API_BASE: API_BASE,
  USD_ITEM_ID: USD_ITEM_ID,
  TOMAN_TO_RIAL: TOMAN_TO_RIAL,
  MG_PER_TROY_OUNCE: MG_PER_TROY_OUNCE,
  REFRESH_EVERY_MS: REFRESH_EVERY_MS,
  BUSINESS_HOURS: BUSINESS_HOURS,
  CATEGORIES: CATEGORIES,
  fetchWithTimeout: fetchWithTimeout,
  isIranBusinessTime: isIranBusinessTime,
  iranDayStart: iranDayStart,
  iranYmd: iranYmd,
  toJalali: toJalali,
  formatJalaliYmd: formatJalaliYmd,
  formatJalaliIso: formatJalaliIso,
  parseCatalog: parseCatalog,
  parsePrices: parsePrices,
  parseHistory: parseHistory,
  historyUrl: historyUrl,
  fetchCatalog: fetchCatalog,
  fetchPrices: fetchPrices,
  fetchHistory: fetchHistory,
  dayRefFromHistory: dayRefFromHistory,
  fetchOunceUsd: fetchOunceUsd,
  computeMgg: computeMgg,
  emptyHistory: emptyHistory,
  buildSnapshot: buildSnapshot,
};
