# Che facim'?

App eventi per la provincia di Potenza (Basilicata).

**L'app pubblica è completamente anonima:** nessuna registrazione, nessun login, nessun account utente. Chiunque può esplorare eventi, salvare preferiti in locale e consultare le pagine informative.

**L'autenticazione Firebase è riservata esclusivamente al pannello admin** (`/admin/`), dove gli amministratori creano, modificano ed eliminano eventi su Firestore.

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
