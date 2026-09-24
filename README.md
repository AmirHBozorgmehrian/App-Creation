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

This uses [ntfy.sh](https://ntfy.sh), a free push-notification service that
needs no sign-up, no Google account, and no Google Play Services on the
phone (its Android app is on F-Droid) - which matters here since Firebase
requires working Google Play Services, and both Firebase itself and Google
Play Services are unreliable on many Android phones in Iran.

1. Pick a hard-to-guess topic name - since there's no sign-up, the topic
   name doubles as your password. Something like `tse-<random-string>`
   works well.
2. On GitHub: **repo → Settings → Secrets and variables → Actions → New
   repository secret**. Name it `NTFY_TOPIC`, value is the topic name you
   picked.
3. On **both** phones: install the **ntfy** app ([F-Droid](https://f-droid.org/en/packages/io.heckel.ntfy/)
   or [Google Play](https://play.google.com/store/apps/details?id=io.heckel.ntfy)),
   open it, tap **+** to subscribe to a topic, and enter the same topic name.

That's it - no app rebuild needed for this part, since alerts are sent
straight from the GitHub Action to the ntfy app, not through this app at
all. Once set up: every 10-minute check also looks at your followed
stocks, and if any has dropped 1% or more since yesterday's close, both
phones get a push notification - once per stock per day, so it won't spam
you every 10 minutes once triggered.

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
