# Che facim'?

App eventi per la provincia di Potenza (Basilicata).

- **Stack:** HTML/CSS/JS vanilla + Firebase (Firestore + Auth)
- **Hosting:** Firebase Hosting (`public/`)
- **Deploy:** GitHub Actions su push a `main`

## Setup locale

```bash
npm install -g firebase-tools   # oppure: npx firebase-tools@15.22.3
firebase login
firebase serve --only hosting     # preview locale
```

## Deploy manuale

```bash
firebase deploy --only hosting,firestore:rules --project che-facim
```

## URL

- App: https://che-facim.web.app (dopo il primo deploy)
- Admin: https://che-facim.web.app/admin/
