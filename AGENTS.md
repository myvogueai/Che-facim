# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
Static Firebase Hosting web app (vanilla HTML/CSS/JS, MPA) in `public/`. There is
**no build step, no bundler, no `package.json`, and no linter** configured. The
client talks directly to the **live** Firebase project `che-facim`
(Firestore + Auth + Storage) via `public/assets/firebase-config.js`. See
`ARCHITECTURE.md` and `SETUP.md` for product details.

### Running the app locally (dev)
The documented command `firebase serve --only hosting` requires an interactive
`firebase login` (Google auth), which is not available in the cloud VM. Instead
run the **hosting emulator with a demo project**, which needs no auth and serves
the same `public/` folder:

```
npx --yes firebase-tools@15.22.3 emulators:start --only hosting --project demo-che-facim
```

Served at `http://127.0.0.1:5000`. Non-obvious gotcha: only *static file serving*
is emulated — the app's client SDK still reads/writes the **real production**
Firebase project (`che-facim`), regardless of how the files are served. Firestore
reads are public (`firestore.rules` → `allow read: if true`), so the public app
(browse events, save favorites in `localStorage`) works fully anonymously without
any credentials.

Any plain static file server (e.g. `python3 -m http.server -d public 5000`) also
works for the public app, since there are no Hosting rewrites.

### Lint / test / build
- **Lint:** none configured (no ESLint/`package.json`). N/A.
- **Build:** none — static files are deployed as-is.
- **Tests:** scripts in `scripts/*.mjs` are E2E/verification scripts that run
  against **live production** (`https://che-facim.web.app`), not local unit tests.
  `scripts/test-copertina-e2e.mjs` needs Playwright (`npm i playwright &&
  npx playwright install chromium`) plus admin credentials via env
  `ADMIN_EMAIL` / `ADMIN_PASSWORD`. `scripts/verify-storage-ready.mjs` and
  `verify-storage-bucket.mjs` probe the production Storage bucket (the latter
  needs `@google-cloud/storage`). Only run these when intentionally validating
  production.

### Admin panel
`/admin/` requires a real Firebase Auth admin account (created in the Firebase
Console; whitelisted in `firestore.rules`). The public pages need no login.
