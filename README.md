# Che facim'?

App eventi per la provincia di Potenza (Basilicata).

## Architettura ufficiale

**App pubblica anonima + pannello admin autenticato** (decisione 2026-06-30, [ADR-002](docs/archive/002-decisione-app-anonima-admin-only.md)).

- **App pubblica:** nessuna registrazione, nessun login, nessun account utente. Chiunque può esplorare eventi, salvare preferiti in locale e consultare le pagine informative.
- **Admin:** Firebase Authentication riservata esclusivamente a `/admin/` per il CRUD eventi su Firestore.

La branch `cursor/auth-fase-1-fondamenta-2423` (auth utente, ADR-001 Fase 1) è stata chiusa e eliminata senza merge.

- **Stack:** HTML/CSS/JS vanilla + Firebase (Firestore + Auth admin-only)
- **Hosting:** Firebase Hosting (`public/`)
- **Deploy:** GitHub Actions su push a `main`
- **Architettura:** vedi [ARCHITECTURE.md](ARCHITECTURE.md)

## Setup locale

```bash
npm install -g firebase-tools   # oppure: npx firebase-tools@15.22.3
firebase login
firebase serve --only hosting     # preview locale
```

## Deploy manuale

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes --project che-facim
```

## URL

- App pubblica: https://che-facim.web.app
- Admin: https://che-facim.web.app/admin/
