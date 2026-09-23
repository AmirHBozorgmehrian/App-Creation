# TSE Stock App

A minimal Android app that lists every instrument on Iran's official stock
market (Tehran Stock Exchange + Fara Bourse, via TSETMC) with a search bar.
Tapping a stock adds/removes it from a local "Followings" list. No trading —
just browsing and bookmarking, for now.

## Data source & legality

The app reads from `cdn.tsetmc.com`, the same endpoint tsetmc.com's own
website calls to render its public market-watch page. It only reads data
that is already publicly displayed to anyone visiting the site — no login,
no private data, no scraping of restricted pages. There's no official public
API contract, though, so the response's field names have drifted before and
could again; see the comment at the top of `src/api/tsetmc.ts` for how to
find the current shape if it ever stops loading.

## Project structure

```
App.tsx                      entry point
src/types.ts                 Stock type
src/api/tsetmc.ts             fetches + parses the market watch endpoint
src/storage/followings.ts     persists the Followings list on-device
src/screens/StockListScreen.tsx   search bar, All Stocks / Followings tabs, list
.github/workflows/build-apk.yml   CI: builds a debug APK on every push
```

## Getting an APK via GitHub Actions (no local Android setup needed)

1. Create a new **public or private** GitHub repo and push this folder to it:
   ```
   cd tse-stock-app
   git init
   git add .
   git commit -m "Initial version"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Go to the repo's **Actions** tab on GitHub. The "Build APK" workflow
   should start automatically (it also runs on manual "Run workflow").
3. When it finishes (a few minutes), open the completed run and download the
   **tse-stock-app-debug-apk** artifact — it's a zip containing `app-debug.apk`.
4. Transfer `app-debug.apk` to your phone (email, cloud drive, USB) and open
   it to install. You'll need to allow "Install unknown apps" for whichever
   app you use to open it, since it isn't from the Play Store.

This produces a **debug** build, which is fine for personal testing and
doesn't require setting up a signing key. If you later want a smaller/faster
**release** build, you'd add an Android signing keystore as a GitHub secret
and change the workflow to run `./gradlew assembleRelease` instead — happy to
set that up when you're ready.

## Running locally instead (optional)

If you ever get Android Studio or a physical build environment set up:
```
npm install
npx expo prebuild --platform android
npx expo run:android
```

## Known limitations / next steps

- Followings persist on-device only (AsyncStorage) — nothing is synced or
  uploaded anywhere.
- Price fields (`lastPrice`, `closingPrice`) are parsed defensively but not
  guaranteed to be present for every instrument type (e.g. bonds).
- No pull-to-refresh price streaming yet — refresh is manual (pull down).
- App id is currently `com.tsestockapp.app` in `app.json` — change it before
  you'd ever publish anywhere.
