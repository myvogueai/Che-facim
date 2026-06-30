# Che facim'? — Architettura tecnica

Documento di riferimento per lo sviluppo e il deploy del progetto.
Per istruzioni operative vedi [SETUP.md](SETUP.md).

---

## 1. Panoramica

Che facim'? è una web app statica che elenca eventi nella provincia di Potenza.
Non richiede account utente: chiunque può consultare gli eventi senza registrarsi.

| Componente | Tecnologia |
|---|---|
| Frontend | HTML / CSS / JavaScript vanilla (MPA) |
| Hosting | Firebase Hosting (`public/`) |
| Database | Cloud Firestore (collection `eventi`) |
| Autenticazione | Firebase Auth — **solo pannello admin** |
| Preferiti utente | `localStorage` nel browser (nessun backend) |
| CI/CD | GitHub Actions → deploy su push a `main` |

---

## 2. Principi architetturali

1. **App pubblica anonima** — nessuna registrazione, login, verifica email o profilo utente.
2. **Auth admin-only** — Firebase Authentication serve esclusivamente a `/admin/` per il CRUD eventi.
3. **Dati locali per l'utente** — preferiti e calendario personale restano in `localStorage`.
4. **Fail closed sulle scritture** — solo account admin autorizzati possono scrivere su Firestore.
5. **Semplicità operativa** — niente Cloud Functions, niente collection `users`, niente backend custom.

---

## 3. Struttura del repository

```
public/
  index.html              Home — lista eventi per giorno + mappa
  evento.html             Dettaglio evento + preferito locale
  preferiti.html          Lista preferiti (localStorage)
  i-miei-eventi.html      Preferiti filtrati futuri/passati
  about.html              Info, contatti, link legali
  privacy.html            Informativa privacy
  cookie.html             Cookie policy
  termini.html            Termini e condizioni
  admin/index.html        Pannello admin (login + CRUD)
  assets/
    eventi-data.js        Lettura/scrittura Firestore eventi
    preferiti.js          API preferiti localStorage
    firebase-config.js    Config Firebase client
    style.css             Design system condiviso
firestore.rules           Regole sicurezza Firestore
firestore.indexes.json    Indici query eventi
firebase.json             Config Hosting + Firestore
.github/workflows/        CI deploy
docs/archive/             Documenti storici (non vincolanti)
```

File esclusi dal deploy hosting: `index-demo.html`, `anteprima-stile.html` (vedi `firebase.json` → `ignore`).

---

## 4. Flussi applicativi

### 4.1 Visitatore (app pubblica)

```
Apre qualsiasi pagina pubblica
  → Nessun controllo auth
  → Legge eventi da Firestore (read pubblico)
  → Salva preferiti in localStorage (chiave lucania_tonight_preferiti)
```

Pagine pubbliche: `/`, `/evento.html`, `/preferiti.html`, `/i-miei-eventi.html`, `/about.html`, `/privacy.html`, `/cookie.html`, `/termini.html`.

### 4.2 Amministratore

```
Apre /admin/
  → Form login email/password (Firebase Auth)
  → onAuthStateChanged: mostra dashboard o login
  → CRUD eventi via eventi-data.js (richiede token admin valido per Firestore rules)
  → Logout con signOut()
```

L'account admin va creato manualmente in Firebase Console. **Disabilitare la registrazione pubblica** in Authentication → Settings.

---

## 5. Modello dati

### 5.1 Firestore — `eventi/{eventoId}`

| Campo | Tipo | Note |
|---|---|---|
| `titolo` | string | Obbligatorio |
| `sottotitolo` | string | Opzionale |
| `locale`, `comune` | string | Obbligatori |
| `lat`, `lng` | number | Coordinate |
| `data` | Timestamp | Data/ora evento |
| `orario` | string | Es. `"21:00"` |
| `categoria` | string | `musica`, `sagra`, `nightlife`, `teatro`, `sport`, `altro` |
| `prezzo` | string | Default `"Gratis"` |
| `immagine_url` | string | URL locandina |
| `descrizione`, `contatti` | string | Opzionali |
| `in_evidenza` | boolean | Promo |
| `stato` | string | `"pubblicato"` visibile in app |
| `creato_il` | Timestamp | Audit |

Query principale (home): eventi con `stato == "pubblicato"` filtrati per giorno (`firestore.indexes.json`).

### 5.2 localStorage — preferiti

Chiave: `lucania_tonight_preferiti` (mantenuta per compatibilità pre-lancio).

```json
{
  "eventoId": {
    "titolo": "...",
    "immagine_url": "...",
    "comune": "...",
    "data": { "seconds": 1234567890 },
    "orario": "21:00",
    "salvato_il": 1234567890123
  }
}
```

Modulo: `public/assets/preferiti.js` — `ePreferito`, `aggiungiPreferito`, `rimuoviPreferito`, `getPreferiti`.

---

## 6. Sicurezza

### 6.1 Firestore Security Rules

| Collection | Read | Write |
|---|---|---|
| `eventi` | Tutti (`allow read: if true`) | Solo admin |

Funzione `isAdmin()` — **entrambe** le condizioni seguenti sono supportate (OR):

1. **Custom claim** `admin: true` sul token Firebase Auth
2. **Whitelist UID** — lista esplicita di UID in `firestore.rules`

Non usare `allow write: if request.auth != null` come regola definitiva: qualsiasi account Auth creato per errore potrebbe scrivere eventi.

### 6.2 Bootstrap admin

1. Crea account in Firebase Console → Authentication → Add user
2. Copia l'UID dell'account
3. **Opzione A:** aggiungi l'UID alla whitelist in `firestore.rules` e deploy
4. **Opzione B:** imposta custom claim `admin: true` (script Admin SDK o Firebase CLI extension)
5. Disabilita signup pubblico in Authentication settings
6. Verifica: login su `/admin/`, crea evento di prova, controlla che appaia in home

### 6.3 Superficie d'attacco

| Rischio | Mitigazione |
|---|---|
| URL `/admin/` scoperto | Rules Firestore bloccano write non admin; credenziali forti |
| Signup pubblico abilitato | Disabilitare in Console |
| Lettura bozze non pubblicate | Opzionale: restringere read a `stato == "pubblicato"` (non implementato in v1) |
| XSS su pagine statiche | Input admin sanitizzato lato UI; evitare `innerHTML` con dati utente |

---

## 7. Deploy e CI

### Deploy automatico (`main`)

Workflow `.github/workflows/firebase-deploy.yml`:

- Firebase Hosting (`public/`)
- Firestore rules
- Firestore indexes

### Deploy manuale

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes --project che-facim
```

Secret richiesto in GitHub: `FIREBASE_SERVICE_ACCOUNT`.

---

## 8. Cosa non fa parte dell'architettura

| Elemento | Stato |
|---|---|
| Registrazione utenti | Non previsto |
| Collection `users/{uid}` | Non previsto |
| Preferiti su Firestore | Non previsto |
| Cloud Functions | Non previsto |
| Route guard sull'app pubblica | Non previsto |
| Login unificato user/admin | Non previsto |

Documento storico con approccio diverso: `docs/archive/001-autenticazione-e-ruoli.md` (archiviato, non vincolante).

---

## 9. Estensioni future (non implementate)

- Upload locandine su Firebase Storage
- Filtro categorie completo in home
- App Check pre-lancio pubblico
- Dominio personalizzato
- PWA / offline

Ogni estensione che introduca auth utente richiede un nuovo ADR.

---

## 10. Riferimenti

| Documento | Contenuto |
|---|---|
| [README.md](README.md) | Overview e URL |
| [SETUP.md](SETUP.md) | Setup Firebase passo-passo |
| [firestore.rules](firestore.rules) | Regole sicurezza |
| [docs/archive/](docs/archive/) | ADR e test plan storici |
