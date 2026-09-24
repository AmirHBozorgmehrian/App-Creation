# TSE Stock App

A minimal Android app that lists every instrument on Iran's official stock
market (Tehran Stock Exchange + Fara Bourse, via TSETMC) with a search bar.
Tapping a stock adds/removes it from a local "Followings" list. No trading —
just browsing and bookmarking, for now.

## Automatic price monitoring (no phone/laptop needed)

`.github/workflows/monitor.yml` runs on a schedule - every 10 minutes during
Tehran Stock Exchange trading hours (Sat-Wed, 9:00-12:30 Iran time), fully
inside GitHub, whether or not your own devices are on. It runs
`scripts/monitor.mjs`, which fetches TSETMC and commits the result to
`data/latest.json`. The app reads that file straight from
`raw.githubusercontent.com` instead of calling TSETMC itself, so it loads
faster and doesn't depend on your phone's connection to do the fetching.

**This requires the repo to be public** (Settings → General → Danger Zone →
Change visibility), since `raw.githubusercontent.com` only serves files from
public repos without authentication. The code and price data aren't
sensitive, so this should be fine - just don't put anything private in this
repo later.

If you ever rename the repo or your GitHub username changes, update the
`SNAPSHOT_URL` constant in `src/api/snapshot.ts` to match.

## Syncing Followings between two phones

Both phones read/write the same `data/followings.json` file in this repo
via GitHub's API. To enable writing (reading works without this):

1. On GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Set **Repository access** to "Only select repositories" → this repo only.
3. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. Leave everything else as "No access".
4. Generate it, copy the token (starts with `github_pat_...`) - GitHub only
   shows it once.
5. In the app, tap the ⚙ next to the title, paste the token, Save.
6. Do this on **both** phones, using the same token or one each - either
   works, since it's just used to write to the same file.

Now, following/unfollowing a stock on one phone pushes to GitHub
immediately, and the other phone picks it up the next time it's opened.

## Emergency push alerts (followed stock drops 1%+ in a day)

This part needs a one-time Firebase setup, since sending a push notification
to a specific phone - even while it's idle - requires Google's push
infrastructure (Firebase Cloud Messaging, free, no credit card needed).

1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   **Add project** (any name, Analytics can be skipped).
2. Inside the project, click **Add app → Android**. For the package name,
   enter exactly: `com.tsestockapp.app`
3. Download the generated **`google-services.json`** and place it at the
   **root of this project** (next to `app.json`) - then commit and push it.
4. Back in the Firebase console: **Project settings (gear icon) → Service
   accounts → Generate new private key**. This downloads a second JSON file
   - keep this one secret, don't commit it to the repo.
5. On GitHub: **repo → Settings → Secrets and variables → Actions → New
   repository secret**. Name it `FIREBASE_SERVICE_ACCOUNT_JSON`, and paste
   the *entire contents* of that service-account file as the value.
6. Push the code changes (including `google-services.json`) and let the
   "Build APK" workflow run - the new release APK will include push support.
7. Install the new APK on both phones and open the app once on each - this
   registers each phone's push token to `data/push-tokens.json`
   automatically (as long as a GitHub token is set in Settings on that
   phone, per the sync section above).

Once all of that is in place: every 10-minute check also looks at your
followed stocks, and if any has dropped 1% or more since yesterday's close,
both phones get a push notification - once per stock per day, so it won't
spam you every 10 minutes once triggered.

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
