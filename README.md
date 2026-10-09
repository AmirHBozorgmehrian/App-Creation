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
