# TSE Stock App

Android app (Expo / React Native) with Stock, Gold, Currencies (placeholder)
and Crypto (placeholder). **The phone fetches all data itself** - GitHub is
used only to build the .apk (`.github/workflows/build-apk.yml`).

- Stocks: straight from `cdn.tsetmc.com` (see `src/api/tsetmc.ts`). Followings
  are stored on the phone only.
- Gold: `sarafiyaran.com` (parsed by `shared/gold.js`) + world gold price from
  gold-api.com (fallback goldprice.org). MGG = ounce USD / 31,103.4768 mg,
  converted to rial with Sarafiyaran's USD rate (mid of buy/sell).
- Auto refresh every 30 min while the app is open, only in Iranian business
  hours (Sat-Wed 09-19, Thu 09-13; edit `BUSINESS_HOURS` in `shared/gold.js`),
  plus pull-down to refresh any time.
- Trends and charts use history stored on the phone, so they build up only
  while the app is used.
