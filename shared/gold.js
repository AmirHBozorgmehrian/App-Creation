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

// timestamp -> "1405/07/16 14:58" (Iran time)
function formatJalaliMs(ms) {
  var d = iranDate(ms);
  return formatJalaliYmd(iranYmd(ms)) + " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
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
    if (points[i].ymd < today) {
      var pt = points[i];
      var vals = [pt.buy, pt.sell].filter(function (x) { return x !== null; });
      var mid = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      return { v: rep(pt), mid: mid, ymd: pt.ymd };
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

// Yesterday's close for the world ounce price, as a RATIO (previous close / price
// now) taken from ONE source, so it does not matter that the main ounce price
// comes from a different site. Needs no history stored on the phone.
var CLOSE_SOURCES = [
  {
    name: "goldprice.org",
    url: "https://data-asg.goldprice.org/dbXRates/USD",
    ratio: function (j) {
      var it = j && j.items && j.items[0];
      return it ? Number(it.xauClose) / Number(it.xauPrice) : NaN;
    },
  },
  {
    name: "yahoo GC=F",
    url: "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=5d&interval=1d",
    ratio: function (j) {
      var r = j && j.chart && j.chart.result && j.chart.result[0];
      if (!r) return NaN;
      var closes = ((r.indicators && r.indicators.quote && r.indicators.quote[0].close) || []).filter(function (x) {
        return x !== null && x !== undefined;
      });
      var price = Number(r.meta && r.meta.regularMarketPrice);
      if (closes.length < 2) return NaN;
      return Number(closes[closes.length - 2]) / price; // [-1] is today's unfinished candle
    },
  },
];

async function fetchOunceCloseRatio() {
  for (var i = 0; i < CLOSE_SOURCES.length; i++) {
    var s = CLOSE_SOURCES[i];
    try {
      var res = await fetchWithTimeout(s.url, { headers: { Accept: "application/json" } }, 15000);
      if (!res.ok) throw new Error("HTTP " + res.status);
      var r = s.ratio(await res.json());
      if (isFinite(r) && r > 0.8 && r < 1.25) return { ratio: r, source: s.name };
    } catch (e) { /* try the next source */ }
  }
  return null;
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


// ------------------------------------------------------- coin swaps (arbitrage) ---
// Same gold, different price: sell one kind of coin, buy another of equal gold
// weight, keep the toman difference. Only the bank-coin box is considered.
//
// PRICE SIDE (dealer's point of view, as on the site): "sell" = what YOU pay to
// buy a coin, "buy" = what you RECEIVE when you sell a coin to the dealer.
// So the spread is already inside every result (conservative).
var COIN_CATEGORY_ID = 7;
// Coin weights in grams. Only the RATIOS matter (equal-gold check).
// full / half / quarter are the official 8.133 g (900 fineness) series;
// the 1-gram coin is 1 g. Edit here if a weight is wrong.
var COIN_GRAMS = { full: 8.133, half: 4.0665, quarter: 2.03325, gram: 1.0 };

function normTitle(t) {
  return String(t || "")
    .replace(/[\u064A\u0649]/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); })
    .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Title -> { size, kind, grams } or null when it is not a recognised coin.
// kind: pre86 (قبل 86) | bahar (بهار آزادی) | emami86 (امامی 86) | other
function coinSpec(title) {
  var t = normTitle(title);
  if (/\u0634\u0645\u0634/.test(t)) return null; // bars (شمش) are not coins
  var size = null;
  if (/\u0631\u0628\u0639/.test(t)) size = "quarter"; // ربع
  else if (/\u0646\u06CC\u0645/.test(t)) size = "half"; // نیم
  else if (/\u06AF\u0631\u0645\u06CC/.test(t)) size = "gram"; // گرمی
  else if (/\u062A\u0645\u0627\u0645|\u0627\u0645\u0627\u0645\u06CC|\u0628\u0647\u0627\u0631/.test(t)) size = "full"; // تمام|امامی|بهار
  if (!size) return null;
  var kind = /\u0642\u0628\u0644/.test(t) ? "pre86" : /\u0628\u0647\u0627\u0631/.test(t) ? "bahar" : /86/.test(t) ? "emami86" : "other";
  return { size: size, kind: kind, grams: COIN_GRAMS[size] };
}

// Smallest whole-coin counts (a of one, b of the other, each <= 8) with equal gold.
function swapCounts(gramsSold, gramsBought) {
  for (var a = 1; a <= 8; a++) {
    var b = Math.round((a * gramsSold) / gramsBought);
    if (b >= 1 && b <= 8 && Math.abs(a * gramsSold - b * gramsBought) / (a * gramsSold) < 0.002) return { a: a, b: b };
  }
  return null;
}

// items: [{ id, title, buy, sell }]   opts: { have: [id], want: [id] }
// -> every sell-X / buy-Y option, best profit first. pct = profit / money received.
function findSwaps(items, opts) {
  var have = (opts && opts.have) || [];
  var want = (opts && opts.want) || [];
  var byId = {};
  (items || []).forEach(function (it) {
    var spec = coinSpec(it.title);
    if (spec) byId[it.id] = { it: it, spec: spec };
  });
  var out = [];
  have.forEach(function (hid) {
    want.forEach(function (wid) {
      if (hid === wid) return;
      var H = byId[hid];
      var W = byId[wid];
      if (!H || !W) return;
      var recv = H.it.buy; // dealer buys from you
      var pay = W.it.sell; // dealer sells to you
      if (recv === null || recv === undefined || pay === null || pay === undefined) return;
      var c = swapCounts(H.spec.grams, W.spec.grams);
      if (!c) return;
      var proceeds = c.a * recv;
      var cost = c.b * pay;
      var profit = proceeds - cost;
      out.push({
        key: hid + ">" + wid,
        sellId: hid, sellTitle: H.it.title, sellCount: c.a, sellUnit: recv, proceeds: proceeds,
        buyId: wid, buyTitle: W.it.title, buyCount: c.b, buyUnit: pay, cost: cost,
        profit: profit, pct: (profit / proceeds) * 100, grams: c.a * H.spec.grams,
      });
    });
  });
  out.sort(function (x, y) { return y.pct - x.pct; });
  return out;
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
    // Preferred: yesterday's real closes (works from the very first launch).
    var refUsd = null;
    var refRial = null;
    var cr = args.ounceClose && args.ounceClose.ratio ? args.ounceClose.ratio : null;
    if (cr) {
      var prevUsd = (ons.usd * cr) / MG_PER_TROY_OUNCE;
      refUsd = { v: prevUsd, t: null };
      var uref = dayRefs[USD_ITEM_ID];
      var prevRate = uref ? (uref.mid || uref.v) : null; // toman per USD yesterday
      if (prevRate) refRial = { v: prevUsd * prevRate * TOMAN_TO_RIAL, t: null };
    }
    // Fallback: history the phone recorded itself (only after it has run a while).
    var refInfo = null;
    if (refUsd) {
      var uy = dayRefs[USD_ITEM_ID] ? dayRefs[USD_ITEM_ID].ymd : null;
      refInfo = { kind: "close", ymd: uy, t: null };
    }
    if (!refUsd) refUsd = refValue(pts, function (p) { return p[1] === null ? null : p[1] / MG_PER_TROY_OUNCE; }, nowMs);
    if (!refRial) refRial = refValue(pts, function (p) { return p[1] === null || p[2] === null ? null : (p[1] / MG_PER_TROY_OUNCE) * p[2]; }, nowMs);
    snap.mgg = {
      usd: m.usd,
      rial: m.rial,
      usdChange: changeFrom(m.usd, refUsd),
      rialChange: m.rial === null ? null : changeFrom(m.rial, refRial),
      stale: !!(ons.stale || (usdRate && usdRate.stale)),
      // what the trend is measured against (shown under the card)
      ref: refInfo || (refUsd ? { kind: "phone", ymd: null, t: refUsd.t || null } : null),
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
  formatJalaliMs: formatJalaliMs,
  parseCatalog: parseCatalog,
  parsePrices: parsePrices,
  parseHistory: parseHistory,
  historyUrl: historyUrl,
  fetchCatalog: fetchCatalog,
  fetchPrices: fetchPrices,
  fetchHistory: fetchHistory,
  dayRefFromHistory: dayRefFromHistory,
  fetchOunceUsd: fetchOunceUsd,
  COIN_CATEGORY_ID: COIN_CATEGORY_ID,
  COIN_GRAMS: COIN_GRAMS,
  coinSpec: coinSpec,
  findSwaps: findSwaps,
  fetchOunceCloseRatio: fetchOunceCloseRatio,
  computeMgg: computeMgg,
  emptyHistory: emptyHistory,
  buildSnapshot: buildSnapshot,
};
