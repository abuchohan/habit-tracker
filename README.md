# Habits

An Expo / React Native version of Loop Habit Tracker, with a browser interface for phones and Windows. The app works locally without an account. Optional accounts sync habits through an independent copy of the Spring Board backend (Express, Prisma, PostgreSQL, httpOnly cookie sessions).

## Run locally

Use Node 24 LTS and npm. In PowerShell, use `npm.cmd` / `npx.cmd` if script execution is disabled.

```powershell
npm.cmd ci
Copy-Item server/.env.example server/.env
Copy-Item expo-app/.env.example expo-app/.env
docker compose -p habit-tracker up -d
npm.cmd run db:migrate
npm.cmd run build:web
npm.cmd run build --workspace server
npm.cmd run start --workspace server
```

Open http://localhost:5000. The PostgreSQL container uses port **54329** on localhost and a dedicated persistent volume. The generated `.env` files are ignored by Git. Use a separate terminal for `npm.cmd run server` when developing with hot reload; `npm.cmd run web` starts the Expo web development server on port 8081.

The production web export uses `/api` on the website's own origin. This keeps session cookies first-party for Safari and Brave. Set `EXPO_PUBLIC_API_URL` in the build environment only if a different API URL is needed. For phone access to an Expo development server, use the computer's LAN address in the frontend environment and add the frontend origin to `ALLOWED_ORIGINS`.

## Local demo data

Generate a realistic sample user with **28 habits** (24 active and 4 archived) across health, fitness, mindfulness, learning, work, home, money and relationships. History spans up to seven months, with newer habits, daily and weekly schedules, numerical targets, limits, notes, misses, skips, a holiday and an unfinished today.

### Try it without an account

```powershell
npm.cmd run seed:local
```

Open the app without signing in, go to **Settings > Import backup / Loop database**, and select **`.local/demo-habits.json`** in this repository. Review the counts and select **Import**. The habits are saved in this browser and work offline; no account or database is needed. You can also run the frontend alone with `npm.cmd run web` and open http://localhost:8081.

Imports merge with existing guest data. Use a separate browser profile for a clean demo, or export your current backup first. Reimporting uses the same identifiers, so habits are updated rather than duplicated.

### Try the same data with a local account

With the local PostgreSQL container running and migrations applied:

```powershell
npm.cmd run db:seed
```

Sign in at http://localhost:5000 with **`demo@habits.local`** / **`demo-habits-local-2026`**. Leave **Include my local habits in this account** unchecked when comparing the two copies. This command seeds the demo account and writes its current snapshot to `.local/demo-habits.json` for guest import, including any edits preserved from earlier seed runs. It adds missing records without changing existing records, passwords, settings or other accounts. Changes you make in guest mode and the demo account stay separate. `seed:local` regenerates the original sample data; `db:seed` exports the demo account's actual data.

Both commands use the same deterministic generator, anchored to today's local date. To reproduce an exact snapshot across runs or on different days, set a date before either command:

```powershell
$env:SEED_DATE = '2026-11-10'
npm.cmd run seed:local
npm.cmd run db:seed
Remove-Item Env:SEED_DATE
```

The database seed accepts only localhost database URLs and refuses production mode. Demo data is never loaded automatically into the app or a deployed database. The generated JSON lives in the Git-ignored `.local` directory.

## Deploy to Railway

Deploy **one app service and one PostgreSQL service** in the same Railway project. The Docker image serves the Expo website and Express API from the same origin, including session authentication and account sync.

1. Push this project to your Git repository and connect it to a new Railway app service. Use the **repository root** as the service root directory, with `/railway.json` as its config file. Do not set the root to `server` or `expo-app`: the build needs both and `shared`.
2. Add a PostgreSQL service named **Postgres** in the same project. Keep its persistent volume attached. No public database URL or database TCP proxy is needed by the app.
3. In the app service's **Variables > Raw Editor**, paste the contents of [`.env.railway.example`](.env.railway.example). These are Railway variable references, not actual credentials; Railway resolves them at deployment. If your database service has another name, update `Postgres` in the reference.
4. In the app service's **Networking**, generate a public domain. Railway then supplies `RAILWAY_PUBLIC_DOMAIN`. The environment template uses that hostname for both the frontend URL and the allowed browser origin. Railway supplies `PORT`; if the UI asks for a target port, use the value of `PORT` (the image defaults to 5000).
5. Apply the staged changes and deploy. `railway.json` selects the Dockerfile, runs `npm run db:migrate` as a **pre-deploy command**, then starts the server. A failed migration prevents the new deployment from going live. `/api/health` is the deployment healthcheck.
6. Open the generated HTTPS URL, create a sync account, add a habit, and sign into the same account from your phone. Local tracking also works without an account.

The Dockerfile's working directory is `/app/server`, so the migration and start commands in `railway.json` run there. Migrations run during pre-deploy, rather than on every process restart. Outside Railway, run `npm run db:migrate` against the target database before starting the image.

| App service variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `ALLOWED_ORIGINS` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |

For a custom domain, set `FRONTEND_URL` to its exact HTTPS origin and include that origin in `ALLOWED_ORIGINS`. Multiple origins are comma-separated, without trailing slashes. Keep any Railway domain you still use in that list too.

The browser calls `/api` on the same domain; **do not point it at localhost or the database**. `DATABASE_URL`, database credentials and email credentials belong only in backend runtime variables, never `EXPO_PUBLIC_*` variables. The build needs no database connection or email credentials.

HTTPS is required for production cookie sessions, service workers, and installable offline use; Railway terminates HTTPS for the public domain. Password resets additionally require `RESEND_API_KEY` and a verified `EMAIL_FROM`. No email provider is needed for local tracking, registration, login, or sync. No separate session signing secret is needed: sessions use opaque database-backed identifiers in httpOnly cookies.

No app-service volume is required: account data lives in PostgreSQL and local data lives in each browser. Database backups should be configured on the PostgreSQL service.

Railway references: [config as code](https://docs.railway.com/config-as-code/reference), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [reference variables](https://docs.railway.com/variables/reference).

The service worker caches only app assets. API and authentication responses are excluded. After a successful first visit, the built app can reopen offline. Development mode does not install a service worker.

Today is highlighted through the date header and habit entries. Swipe horizontally over the date grid on a phone, or click and drag it with a mouse, to browse past dates. Habit names stay in place and vertical list scrolling works normally. Date order follows the Reverse date order setting; the Today button returns to the current day.

## Data and sync

- Web data is saved in IndexedDB; native builds use AsyncStorage.
- Guest data and each account's local data use separate storage keys. Connecting an account offers an explicit option to copy guest habits into the account.
- Changes are saved locally before sync. Online/focus events and a 30-second retry interval retry synchronization while the app is open.
- Each habit and each daily entry has its own version. The newest edit wins for the same record; different dates merge independently. Deletions retain tombstones to prevent old offline copies from restoring deleted habits.
- Signing out returns to separate guest data. Account data remains cached on that device; this is intended for personal devices.
- Settings (including reverse date order, theme, and week start) are saved locally and sync with a connected account. The newest settings edit wins if devices change settings offline. Guest and account settings are kept separately; signing out restores the guest settings. Existing device settings are kept on upgrade and seed accounts that have no synced settings yet.
- Local data belongs to the browser and website origin. Backups provide an independent copy; Safari and Brave have separate storage even on the same phone.

## Implemented

Yes/no and numerical habits; at-least / at-most targets; flexible schedules; Loop's score and interval algorithms; skip days; notes; editable calendar history; strength/value graphs; streaks; weekday frequency; monthly totals; categories; searching, filtering and sorting; reordering; archive/unarchive; duplication and deletion; system/light/dark/black themes; day rollover and week-start settings; JSON backup/restore, CSV export, and browser-based Loop SQLite import/export.

Native reminders and widgets are deferred to the iOS version as requested. Older third-party import formats (Tickmate, HabitBull, Rewire), Android automation integrations and system-level notification options have not been ported. Native SQLite backup support is not implemented; native JSON backups use the system document picker/share sheet. Native iOS builds have not yet been tested on a device.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:web
npm.cmd run build --workspace server
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $pwd '.playwright'
npx.cmd playwright install webkit
npx.cmd playwright test
```

The server integration tests use `server/.env` when present, create separate temporary test accounts and remove them afterwards. Browser tests expect the built app running at http://localhost:5000 and cover desktop Chromium and iPhone-sized WebKit.

## Attribution

Loop Habit Tracker is Copyright (C) 2016–2025 Álinson Santos Xavier and contributors. The score and flexible-schedule algorithms are adapted from the cloned Loop source. This derivative is distributed under **GPL-3.0-or-later**; see `LICENSE`. The backend follows the supplied Spring Board starter's routing, Prisma and cookie-session conventions.
