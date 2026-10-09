# Capstone

Android app (Expo / React Native) with Stock, Gold, Currencies (placeholder)
and Crypto (placeholder). **The phone fetches all data itself** - GitHub is
used only to build the .apk (`.github/workflows/build-apk.yml`).

- Stocks: straight from `cdn.tsetmc.com` (see `src/api/tsetmc.ts`). Followings
  are stored on the phone only.
- Gold: read from Sarafiyaran's own JSON service (`api.sarafiyaran.com`, see
  `shared/gold.js`): item list, live buy/sell prices, and the daily history
  that feeds the 1W/1M/3M/6M/1Y charts and the "change today" figure. World
  gold price from gold-api.com (fallback goldprice.org). MGG = ounce USD /
  31,103.4768 mg, converted to rial with the site's USD rate (mid of buy/sell).
- Auto refresh every 30 min while the app is open, only in Iranian business
  hours (Sat-Wed 09-19, Thu 09-13; edit `BUSINESS_HOURS` in `shared/gold.js`),
  plus pull-down to refresh any time.
- Coin/currency trends and charts come from the site's own history, so they
  work from the first launch. Only the MGG trend uses history kept on the phone.

## Coin swaps (Gold page -> "Swaps")

The panel opens from the arrow tab on the edge of the Gold page.

Side panel for the "sell one coin, buy another of equal gold weight, keep the
difference" trade (e.g. 1 full coin <-> 2 half coins, 2 half <-> 4 quarter,
before/after 86, Bahar Azadi, ...).

- Tick the coins you have and the ones you'd buy, set a minimum profit (% of the
  money received). The panel lists the current swaps above it.
- With **Notify me** on, a notification says what to sell, what to buy and the
  profit. Checked after every price refresh, which a background task also does about
  every 30 min in Iranian business hours (Android decides the exact timing, and
  battery saver can delay it). The same swap is repeated at most every 3 h
  unless it improves by 1 point.
- **Swap types**: optional cards with two spots (تمام ۸۶ / بهار آزادی / قبل ۸۶ / سکه یک گرمی) joined by ⇄. Only swaps between the chosen groups, in either direction, are shown and notified (e.g. بهار آزادی ⇄ بهار آزادی, or بهار آزادی ⇄ قبل ۸۶). Add several cards to allow several types; empty cards mean no restriction. It works together with the coin checklists.
- **Upward / Downward**: a switch in the panel. *Upward* = sell smaller coins, buy a bigger one (same-size swaps are listed here too); you set a **minimum profit**. *Downward* = sell a bigger coin, buy smaller ones; you set a **maximum loss** (a swap that earns something always shows). Each has its own options list and its own "notify me" switch. Cards are green (gain >= 0.5%), red (loss >= 0.5%) or grey (in between), with an UP / DOWN / SAME SIZE label top-right and an arrow in brackets after the % comparing the swap with ~2 h ago (saved coin prices, kept 6 h; `swapTrend` in `shared/gold.js`).
- **Movable tab**: press and hold the tab, drag it, let go: it sticks to the nearest side at the height you left it (remembered). The panel opens from that side.
- Prices: you receive the site's "Buy" price when selling and pay its "Sell"
  price when buying, so the spread is already counted.
- Only the bank-coin box is used. Weights live in `COIN_GRAMS` and the title
  matching in `coinSpec()` (`shared/gold.js`). Coins with no whole-number
  match in weight (the 1 g coin) are skipped.
- Code: `shared/gold.js` (`findSwaps`), `src/arbitrage/*`, `src/components/SwapPanel.tsx`.
