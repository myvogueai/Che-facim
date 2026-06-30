# ADR-001: Autenticazione e Ruoli

| Campo | Valore |
|---|---|
| **Stato** | Accettato |
| **Data** | 2026-06-30 |
| **Autori** | Software Architecture |
| **Progetto** | Che facim'? |
| **Scope** | Autenticazione, autorizzazione, ruoli, sessione, routing protetto |
| **Supersedes** | Comportamento auth attuale (admin inline + app pubblica anonima) |

---

## 1. Sommario esecutivo

Questo documento definisce in modo vincolante l'architettura di autenticazione e autorizzazione dell'applicazione Che facim'?. Tutta l'implementazione futura deve conformarsi a quanto qui descritto.

**Obiettivo:** un unico sistema di identità con percorsi lineari per tre attori (visitatore non ancora autenticato, utente registrato, amministratore), eliminando i due mondi paralleli attuali (app anonima + admin isolato).

**Decisione chiave:** Firebase Authentication gestisce l'identità; Firestore `users/{uid}` gestisce profilo e ruolo; le Firestore Security Rules applicano l'autorizzazione; un middleware client centralizzato applica route guard e redirect su ogni pagina.

---

## 2. Contesto

### 2.1 Stato attuale (as-is)

| Aspetto | Situazione |
|---|---|
| App pubblica | Nessuna autenticazione. Accesso diretto a home e contenuti. |
| Preferiti | `localStorage`, chiave `lucania_tonight_preferiti`, senza legame a utente. |
| Admin | Login email/password inline in `public/admin/index.html`. |
| Firestore rules | `allow read: if true` su `eventi`; `allow write: if request.auth != null`. |
| Ruoli | Non implementati. Qualsiasi utente autenticato può scrivere su `eventi`. |
| Registrazione | Assente. Account creati manualmente in Firebase Console. |
| Verifica email | Assente. |
| Recupero password | Assente. |
| Middleware / route guard | Assenti. |
| Redirect post-auth | Assenti. |

### 2.2 Problemi da risolvere

1. Percorso utente non lineare: due entry point scollegati (`/` e `/admin/`).
2. Nessuna distinzione tra utente e amministratore a livello di codice e regole.
3. Preferiti non portabili tra dispositivi.
4. Impossibilità di scalare verso funzionalità utente (notifiche, profilo, premium).
5. Rischio sicurezza: rules permissive, protezione admin solo CSS.

### 2.3 Vincoli

| Vincolo | Dettaglio |
|---|---|
| Stack | HTML/CSS/JS vanilla (MPA), Firebase Hosting, Firestore, Firebase Auth |
| Provider auth v1 | Solo email/password |
| No framework frontend | Nessun React, Vue, Angular |
| Compatibilità | Migrazione preferiti da `localStorage` senza perdita dati |
| Compliance | Verifica email obbligatoria prima dell'accesso all'app |

### 2.4 Attori

| Attore | Descrizione |
|---|---|
| **Visitatore** | Apre l'app senza sessione attiva. Può accedere solo a pagine `public`. |
| **Utente** | Registrato, email verificata, `role = "user"`. Accede all'app principale. |
| **Amministratore** | Registrato, email verificata, `role = "admin"` + custom claim. Gestisce eventi. |

---

## 3. Decisioni

### ADR-001.1 — Single Sign-On Entry Point

**Decisione:** esiste un unico form di login in `/auth/login.html` per tutti gli attori. Non esistono login separati per admin e utente.

**Motivazione:**
- Percorso lineare richiesto dal prodotto.
- Un solo punto di manutenzione per validazione, errori, rate limiting futuro.
- Il redirect post-login distingue la destinazione in base al ruolo.

**Conseguenze:**
- Il form login inline in `admin/index.html` va rimosso.
- `/admin/index.html` diventa esclusivamente dashboard, protetta da route guard `admin`.

---

### ADR-001.2 — Firebase Auth come unica fonte di identità

**Decisione:** Firebase Authentication (email/password) è l'unico sistema di identità. Nessun sistema auth custom, nessun JWT gestito manualmente dall'app.

**Motivazione:**
- Già in uso per admin.
- Gestione sicura di password hash, token refresh, sessione.
- Integrazione nativa con Firestore Security Rules via `request.auth`.

**Conseguenze:**
- `uid` Firebase Auth = chiave primaria utente ovunque.
- Il client non gestisce mai token manualmente, salvo `getIdToken(true)` per refresh claims admin.

---

### ADR-001.3 — Collection Firestore `users/{uid}`

**Decisione:** ogni utente autenticato ha un documento profilo in `users/{uid}` creato al momento della registrazione.

**Schema vincolante:**

| Campo | Tipo | Obbligatorio | Chi può scrivere |
|---|---|---|---|
| `uid` | string | sì | create only (immutabile) |
| `email` | string | sì | create; update solo se coerente con Auth |
| `display_name` | string | no | self |
| `role` | string | sì | **solo admin** (o Cloud Function) |
| `email_verified` | boolean | sì | **solo sistema** (sync da Auth) |
| `created_at` | Timestamp | sì | create only |
| `updated_at` | Timestamp | sì | self / admin |
| `last_login_at` | Timestamp | no | self |
| `status` | string | sì | admin |
| `preferences` | map | no | self |
| `onboarding_completed` | boolean | sì | self (default `false`) |

**Valori ammessi:**

| Campo | Valori |
|---|---|
| `role` | `"user"` \| `"admin"` |
| `status` | `"active"` \| `"suspended"` \| `"deleted"` |

**Motivazione:**
- Separazione identità (Auth) da profilo applicativo (Firestore).
- Base per ruoli, preferenze, notifiche future.
- Query e audit su utenti.

**Conseguenze:**
- Obbligo di transazione logica register: Auth user + documento Firestore.
- Rollback: se `setDoc` fallisce dopo `createUser`, eliminare l'utente Auth.
- Path di recovery: se utente Auth esiste ma documento mancante, crearlo al primo login con `role = "user"`.

---

### ADR-001.4 — Modello ruoli

**Decisione:** il sistema riconosce esattamente due ruoli in v1: `user` e `admin`.

| Ruolo | Permessi applicativi |
|---|---|
| `user` | Leggere eventi pubblicati; gestire propri preferiti; accedere a home, dettaglio, preferiti, i miei eventi |
| `admin` | Tutti i permessi di `user` + CRUD completo su `eventi`; accesso dashboard admin; gestione utenti (futuro) |

**Assegnazione ruoli:**

| Evento | Ruolo assegnato |
|---|---|
| Registrazione self-service | `"user"` (forzato dalle rules, non dal client) |
| Promozione ad admin | Solo tramite Cloud Function `setAdminRole(uid)` invocata da admin esistente o script operativo |
| Demotion admin → user | Solo tramite Cloud Function, mai dal client |

**Decisione correlata — Custom Claims:**

| Aspetto | Decisione |
|---|---|
| Claim | `admin: true` su Firebase Auth token |
| Impostazione | Solo Cloud Function `setAdminRole` |
| Uso | Firestore rules per operazioni admin (`isAdmin()`) |
| Sincronizzazione | Function aggiorna sia claim che `users/{uid}.role` |

**Motivazione:**
- Custom claim evita read extra su `users` nelle rules per ogni write su `eventi`.
- Campo `role` su Firestore resta per UI, query, audit, estensibilità.

**Conseguenze:**
- Dopo promozione admin, l'utente deve fare refresh token (`getIdToken(true)`) o re-login.
- Il client non può mai impostare `role: "admin"` né direttamente né indirettamente.

---

### ADR-001.5 — Verifica email obbligatoria

**Decisione:** nessun utente accede alle pagine classificate `verified`, `user` o `admin` senza `emailVerified == true` su Firebase Auth.

**Flusso vincolante:**

```
Registrazione → sendEmailVerification → /auth/verify-email.html
→ utente verifica → user.reload() → sync su Firestore → /index.html
```

**Pagine accessibili con auth ma senza verifica:**
- `/auth/verify-email.html`
- Logout

**Motivazione:**
- Riduce account fake e spam.
- Garantisce canale di comunicazione verificato.
- Requisito compliance per app con dati utente.

**Conseguenze:**
- Guard middleware deve controllare `emailVerified` prima del ruolo.
- Pagina verify-email supporta reinvio con cooldown 60 secondi.
- Polling opzionale ogni 5 secondi con `user.reload()` sulla pagina di attesa.

---

### ADR-001.6 — Registrazione in-app

**Decisione:** la registrazione avviene in `/auth/register.html` tramite `createUserWithEmailAndPassword`. Non esiste registrazione da Firebase Console per utenti finali (solo per bootstrap admin iniziale).

**Dati raccolti alla registrazione:**

| Campo | Obbligatorio |
|---|---|
| Email | sì |
| Password | sì (requisiti Firebase default) |
| Display name | no |

**Sequenza vincolante:**

1. Validazione client (formato email, password, conferma password).
2. `createUserWithEmailAndPassword`.
3. `setDoc(users/{uid}, { role: "user", email_verified: false, status: "active", ... })`.
4. `sendEmailVerification`.
5. Redirect a `/auth/verify-email.html`.
6. **Nessun** accesso a home prima della verifica.

**Motivazione:**
- Percorso lineare richiesto: Apri app → Registrati → Verifica → Home.
- L'utente non deve uscire dall'app per creare l'account.

---

### ADR-001.7 — Login e redirect post-auth

**Decisione:** il login avvia da `/auth/login.html`. Dopo autenticazione riuscita, il redirect è determinato dal ruolo e dallo stato verifica.

**Matrice redirect post-login:**

| Condizione | Destinazione |
|---|---|
| `status == "suspended"` | `/auth/suspended.html` |
| `!emailVerified` | `/auth/verify-email.html` |
| `role == "user"` | `/index.html` (o `returnTo` se valido) |
| `role == "admin"` | `/admin/index.html` |

**Parametro `returnTo`:**
- Formato: path interno (es. `/evento.html?id=abc`).
- Validazione: whitelist di path consentiti per il ruolo.
- Open redirect: **vietato**. Solo path che iniziano con `/` e appartengono all'app.

**Utente già autenticato che visita `/auth/login.html`:**
- Redirect immediato secondo matrice sopra (pagina `auth-only`).

---

### ADR-001.8 — Middleware client e route guard

**Decisione:** ogni pagina HTML esegue un guard centralizzato prima di renderizzare il contenuto. Il guard è implementato in `assets/router.js` e invocato all'avvio di ogni pagina.

**Moduli vincolanti:**

| Modulo | Responsabilità |
|---|---|
| `assets/auth.js` | Init Auth, sessione, operazioni auth, profilo, ruolo |
| `assets/router.js` | Classificazione route, guard, redirect |
| `assets/users-data.js` | CRUD profilo e preferiti su Firestore |

**Sequenza obbligatoria su ogni pagina protetta:**

1. Mostrare splash "Caricamento…" (HTML statico immediato).
2. `await waitForAuth()` — attendere risoluzione stato Auth.
3. `await router.guard(pageConfig)` — valutare accesso.
4. Se blocked → `redirect` (stop).
5. Se ok → nascondere splash, procedere con rendering.

**Classificazione route vincolante:**

| Tipo | Accesso | Redirect se negato |
|---|---|---|
| `public` | Tutti | — |
| `auth-only` | Solo non autenticati | Post-login redirect per ruolo |
| `verified-pending` | Autenticati non verificati | — |
| `verified` | Autenticati + email verificata + active | `/auth/login.html` |
| `user` | verified + `role == user` | `/auth/login.html` o `/admin/index.html` |
| `admin` | verified + `role == admin` | `/auth/login.html` o `/index.html` |

**Mappa route v1:**

| Route | Tipo |
|---|---|
| `/auth/login.html` | `auth-only` |
| `/auth/register.html` | `auth-only` |
| `/auth/forgot-password.html` | `auth-only` |
| `/auth/reset-sent.html` | `public` |
| `/auth/verify-email.html` | `verified-pending` |
| `/auth/suspended.html` | `public` |
| `/index.html` | `verified` |
| `/evento.html` | `verified` |
| `/preferiti.html` | `verified` |
| `/i-miei-eventi.html` | `verified` |
| `/about.html` | `public` |
| `/admin/index.html` | `admin` |

**Motivazione:**
- In MPA vanilla non esiste middleware server sulle pagine statiche.
- Centralizzazione elimina duplicazione e race condition (FOUC auth).
- Fail closed: in caso di dubbio, redirect a login.

---

### ADR-001.9 — Gestione sessione

**Decisione:**

| Aspetto | Scelta |
|---|---|
| Persistenza | `browserLocalPersistence` (default Firebase Auth) |
| Durata | Finché token valido o logout esplicito |
| Init | Singleton in `auth.js`; `initializeApp` una sola volta |
| Stato | `onAuthStateChanged` registrato una volta; stato in memoria |
| Profilo | Cache in memoria, TTL 5 minuti, invalidata su logout e auth change |
| Token refresh | Automatico SDK; `getIdToken(true)` solo post-promozione admin |
| FOUC | Vietato: splash fino a `waitForAuth()` risolto |

**Conseguenze:**
- La sessione persiste tra reload e chiusura browser (finché non scade il token).
- Navigazione tra pagine della stessa origine condivide la sessione.
- `eventi-data.js` non inizializza più `initializeApp` autonomamente; delega a `auth.js`.

---

### ADR-001.10 — Logout

**Decisione:** il logout è centralizzato in `auth.logout()` e comporta sempre redirect a `/auth/login.html`.

**Sequenza vincolante:**

1. `signOut(auth)`.
2. Pulizia cache profilo in memoria.
3. Pulizia `localStorage` preferiti legacy (se ancora presente post-migrazione).
4. `window.location.replace('/auth/login.html')`.

**Disponibilità UI:**
- App utente: bottone logout in header o About.
- Admin: bottone logout in header dashboard (sostituisce `signOut` diretto attuale).

**Conseguenze:**
- Nessun dato auth residuo in memoria.
- I preferiti su Firestore (`users/{uid}/preferiti`) persistono e sono disponibili al prossimo login.

---

### ADR-001.11 — Recupero password

**Decisione:** il recupero password avviene in `/auth/forgot-password.html` tramite `sendPasswordResetEmail`.

**Regole:**
- Messaggio sempre generico: *"Se l'email è registrata, riceverai un link di recupero"* (anti-enumeration).
- Dopo invio → redirect a `/auth/reset-sent.html`.
- Action URL configurato in Firebase Console → redirect finale a `/auth/login.html`.
- Nessuna logica custom di reset lato app (usa pagina Firebase o action URL configurato).

---

### ADR-001.12 — Preferiti legati all'utente

**Decisione:** i preferiti migrano da `localStorage` a subcollection Firestore `users/{uid}/preferiti/{eventoId}`.

**Schema documento preferito:**

| Campo | Tipo |
|---|---|
| `evento_id` | string |
| `salvato_il` | Timestamp |
| `snapshot` | map: `{ titolo, immagine_url, comune, data, orario }` |

**Migrazione:**
- Al primo login post-deploy, se esiste `localStorage` legacy (`lucania_tonight_preferiti`):
  - Per ogni entry → `setDoc` su `users/{uid}/preferiti/{eventoId}`.
  - Rimuovere `localStorage` legacy.
- `preferiti.js` diventa facade che delega a `users-data.js`.

**Accesso:**
- Solo il proprietario (`request.auth.uid == uid`) può leggere/scrivere i propri preferiti.

---

### ADR-001.13 — Firestore Security Rules

**Decisione:** riscrittura completa delle rules. Il principio guida è **fail closed**.

**`users/{uid}`:**

| Operazione | Chi |
|---|---|
| read | owner o admin |
| create | owner (solo al register; `role` deve essere `"user"`) |
| update (self) | owner; solo campi: `display_name`, `preferences`, `onboarding_completed`, `last_login_at`, `updated_at` |
| update (admin) | admin; campi: `role`, `status`, `updated_at` |
| delete | admin |

**Vincoli create (register):**
- `request.resource.data.role == "user"`.
- `request.resource.data.email_verified == false`.
- `request.resource.data.status == "active"`.
- `request.resource.data.uid == request.auth.uid`.

**Vincoli update (self):**
- `role`, `email_verified`, `status` immutabili dal client.

**`users/{uid}/preferiti/{eventoId}`:**

| Operazione | Chi |
|---|---|
| read, write | owner (`request.auth.uid == uid`) |

**`eventi/{eventoId}`:**

| Operazione | Chi | Condizione |
|---|---|---|
| read | tutti | solo se `stato == "pubblicato"` |
| read | admin | qualsiasi stato |
| create, update, delete | admin | `request.auth.token.admin == true` + validazione schema |

**Helper functions obbligatorie nelle rules:**

| Funzione | Scopo |
|---|---|
| `isAuthenticated()` | `request.auth != null` |
| `isOwner(uid)` | `request.auth.uid == uid` |
| `isAdmin()` | `request.auth.token.admin == true` |
| `validEventSchema(data)` | Validazione campi, enum `categoria`, URL https per `immagine_url` |
| `hasRequiredFields(fields)` | Campi obbligatori presenti |
| `onlyChangedFields(allowed)` | Diff campi consentiti in update |

**Motivazione:**
- Sostituisce `allow write: if request.auth != null` che è insicuro.
- Protegge `in_evidenza`, `stato`, `role` da manipolazione client.
- Allinea autorizzazione server-side al modello ruoli.

---

### ADR-001.14 — Cloud Functions (scope v1 minimo)

**Decisione:** introdurre Firebase Cloud Functions per operazioni che il client non può eseguire in sicurezza.

**Functions obbligatorie in v1:**

| Function | Trigger | Scopo |
|---|---|---|
| `setAdminRole` | HTTPS callable | Promuove utente ad admin: imposta claim `admin: true` + `users/{uid}.role = "admin"`. Invocabile solo da admin esistente. |
| `syncEmailVerified` | Auth onUpdate (opzionale v1, obbligatorio v1.1) | Sincronizza `users/{uid}.email_verified` quando Auth cambia. |

**Functions escluse da v1:**
- Registrazione server-side (resta client con rules).
- Pagamenti, notifiche, ticketing.

**Motivazione:**
- Custom claims non possono essere impostati dal client.
- Centralizza promozione admin con audit.

---

### ADR-001.15 — Protezione route admin

**Decisione:** `/admin/index.html` è accessibile solo a utenti con `role == "admin"` e `emailVerified == true`.

**Comportamento guard:**

| Visitatore | Redirect a `/auth/login.html` |
| Utente (`role == user`) | Redirect a `/index.html` |
| Admin non verificato | Redirect a `/auth/verify-email.html` |
| Admin verificato | Accesso consentito |

**Conseguenze:**
- Il form login inline in admin va rimosso.
- L'HTML della dashboard resta nel DOM ma non è raggiungibile senza guard passed.
- Le write su `eventi` richiedono claim admin (non solo auth generica).

---

### ADR-001.16 — Accesso all'app senza autenticazione

**Decisione:** l'app principale (home, eventi, preferiti, i miei eventi) richiede autenticazione con email verificata. Non esiste modalità "sfoglia senza account" in v1.

**Eccezioni `public` (accessibili senza login):**
- `/auth/*` (pagine auth).
- `/about.html` (informazioni statiche).

**Motivazione:**
- Coerente con il percorso lineare richiesto.
- Base per preferiti, profilo, notifiche future.

**Conseguenza UX:**
- Apertura `/` senza sessione → redirect a `/auth/login.html`.
- La pagina About resta raggiungibile per info e contatti pre-login.

---

## 4. Flussi vincolanti

### 4.1 Nuovo utente

```
Apre app (qualsiasi route verified)
  → router.guard: non autenticato
  → /auth/login.html
  → clic "Registrati"
  → /auth/register.html
  → submit: Auth user + users/{uid} + sendEmailVerification
  → /auth/verify-email.html
  → verifica email (link)
  → user.reload() + sync email_verified
  → migrazione preferiti localStorage (se presenti)
  → /index.html
```

### 4.2 Utente già registrato

```
Apre app
  → router.guard: non autenticato
  → /auth/login.html
  → submit: signInWithEmailAndPassword
  → getUserProfile
  → role == user, emailVerified, status == active
  → migrazione preferiti (se necessario)
  → /index.html
```

### 4.3 Amministratore

```
Apre /admin/index.html (o /auth/login.html)
  → login (se necessario)
  → role == admin, emailVerified, status == active
  → /admin/index.html (dashboard)
```

### 4.4 Logout

```
Click "Esci" (qualsiasi contesto)
  → auth.logout()
  → /auth/login.html
```

### 4.5 Recupero password

```
/auth/forgot-password.html
  → sendPasswordResetEmail
  → /auth/reset-sent.html
  → email link → reset password Firebase
  → /auth/login.html
```

---

## 5. Cosa è esplicitamente fuori scope v1

| Elemento | Versione target |
|---|---|
| Login social (Google, Apple) | v2 |
| Multi-factor authentication (MFA) | v2 |
| Ruolo `organizer` / `venue_owner` | v2 |
| Self-service creazione eventi da utente | v2 |
| Notifiche push (FCM) | v2 |
| Onboarding guidato post-verifica | v2 (v1: redirect diretto a home) |
| Account deletion self-service | v2 |
| Rate limiting lato server | v1.1 |
| Firebase App Check | v1.1 (raccomandato pre-lancio pubblico) |
| PWA / offline auth | v2 |

---

## 6. Migrazione dallo stato attuale

| Elemento as-is | Azione | Quando |
|---|---|---|
| Login inline admin | Rimuovere; usare `/auth/login.html` | Deploy auth v1 |
| `allow write: if request.auth != null` | Sostituire con `isAdmin()` | Deploy rules v1 |
| Preferiti `localStorage` | Migrare a Firestore al primo login | Deploy + primo accesso utente |
| Account admin Console | Eseguire `setAdminRole` + creare `users/{uid}` | Pre-deploy, script one-shot |
| Commenti obsoleti in `firestore.rules` | Rimuovere | Deploy rules v1 |
| `index-demo.html`, `anteprima-stile.html` | Nessuna modifica (fuori deploy) | — |

**Script operativo pre-deploy (obbligatorio):**
1. Per ogni admin esistente in Firebase Auth: creare `users/{uid}` con `role: "admin"`.
2. Invocare `setAdminRole(uid)` per impostare custom claim.
3. Verificare che l'admin possa fare login e accedere a `/admin/index.html`.

---

## 7. Indici Firestore richiesti

| Collection | Campi | Uso |
|---|---|---|
| `eventi` | `stato` ASC, `data` ASC | `getEventiPerGiorno` (esistente) |
| `users` | `role` ASC, `created_at` DESC | Lista utenti admin (futuro) |
| `users/{uid}/preferiti` | `salvato_il` DESC | Lista preferiti |

Gli indici devono essere deployati in CI insieme alle rules.

---

## 8. Invarianti di sicurezza

Queste regole non possono essere violate dall'implementazione:

1. Il client **non può** impostare `role: "admin"`.
2. Il client **non può** impostare `email_verified: true`.
3. Il client **non può** modificare `status` del proprio account.
4. Il client **non può** scrivere su `eventi` senza claim admin.
5. Il client **non può** leggere `eventi` con `stato != "pubblicato"` (salvo admin).
6. Il client **non può** leggere o scrivere preferiti di altri utenti.
7. Nessun open redirect via parametro `returnTo`.
8. Nessun rendering di pagine protette prima del guard passed.
9. Messaggi di errore auth non rivelano se un'email è registrata.
10. La protezione admin non si basa su `display: none` CSS come unico controllo.

---

## 9. File coinvolti nell'implementazione

### 9.1 Da creare

| File | ADR di riferimento |
|---|---|
| `public/auth/login.html` | 001.1, 001.7 |
| `public/auth/register.html` | 001.6 |
| `public/auth/verify-email.html` | 001.5 |
| `public/auth/forgot-password.html` | 001.11 |
| `public/auth/reset-sent.html` | 001.11 |
| `public/auth/suspended.html` | 001.3 |
| `public/assets/auth.js` | 001.2, 001.9, 001.10 |
| `public/assets/router.js` | 001.8 |
| `public/assets/users-data.js` | 001.3, 001.12 |
| `functions/index.js` | 001.14 |
| `functions/package.json` | 001.14 |

### 9.2 Da modificare

| File | ADR di riferimento |
|---|---|
| `public/admin/index.html` | 001.1, 001.15 |
| `public/index.html` | 001.8, 001.16 |
| `public/evento.html` | 001.8, 001.12 |
| `public/preferiti.html` | 001.8, 001.12 |
| `public/i-miei-eventi.html` | 001.8, 001.12 |
| `public/about.html` | 001.10 |
| `public/assets/eventi-data.js` | 001.9, 001.13 |
| `public/assets/preferiti.js` | 001.12 |
| `public/assets/style.css` | 001.8 |
| `firestore.rules` | 001.13 |
| `firestore.indexes.json` | §7 |
| `firebase.json` | 001.14 |
| `.github/workflows/firebase-deploy.yml` | 001.14, §7 |
| `README.md` | §6 |
| `SETUP.md` | §6 |

### 9.3 Invariati

| File | Note |
|---|---|
| `public/assets/firebase-config.js` | Config client pubblica |
| `public/index-demo.html` | Fuori deploy, senza auth |
| `public/anteprima-stile.html` | Fuori deploy |
| `.firebaserc` | Progetto `che-facim` |

---

## 10. Ordine di implementazione

L'implementazione deve seguire questo ordine. Non si può procedere a una fase senza aver completato le dipendenze precedenti.

```
Fase 1 — Fondamenta
  ├── auth.js (init, waitForAuth, getCurrentUser)
  ├── router.js (guard, redirect, ROUTES)
  ├── users-data.js (CRUD profilo)
  ├── firestore.rules (users + preferiti)
  ├── auth/login.html
  └── auth/register.html

Fase 2 — Flusso utente
  ├── auth/verify-email.html
  ├── Guard su index, evento, preferiti, i-miei-eventi
  ├── Migrazione preferiti (preferiti.js → users-data.js)
  └── firestore.rules (eventi read pubblicato)

Fase 3 — Admin
  ├── functions/setAdminRole
  ├── firestore.rules (eventi write admin + validEventSchema)
  ├── admin/index.html (rimozione login, solo dashboard)
  └── Script migrazione admin esistenti

Fase 4 — Completamento
  ├── auth/forgot-password.html, reset-sent.html
  ├── auth/suspended.html
  ├── about.html (logout)
  ├── Splash screen (style.css)
  ├── Security headers (firebase.json)
  └── CI: deploy functions + indexes
```

---

## 11. Criteri di accettazione

L'implementazione si considera conforme a questo ADR quando tutti i criteri sono soddisfatti:

### Registrazione
- [ ] Un visitatore può registrarsi da `/auth/register.html`.
- [ ] Dopo la registrazione viene creato `users/{uid}` con `role: "user"`.
- [ ] Dopo la registrazione l'utente è su `/auth/verify-email.html`, non su home.
- [ ] Il client non può creare un documento con `role: "admin"`.

### Verifica email
- [ ] Utente non verificato non accede a `/index.html`.
- [ ] Dopo verifica, l'utente accede a `/index.html`.
- [ ] È possibile rinviare l'email di verifica.

### Login
- [ ] Un unico form login in `/auth/login.html` per user e admin.
- [ ] Login user → `/index.html`.
- [ ] Login admin → `/admin/index.html`.
- [ ] Utente già autenticato che visita login viene rediretto.

### Logout
- [ ] Logout da qualsiasi pagina → `/auth/login.html`.
- [ ] Nessun dato auth residuo in memoria.

### Ruoli
- [ ] Utente con `role: "user"` non accede a `/admin/index.html`.
- [ ] Utente con `role: "admin"` accede a `/admin/index.html`.
- [ ] Promozione admin avviene solo via `setAdminRole` Function.
- [ ] Write su `eventi` richiede claim admin.

### Preferiti
- [ ] Preferiti salvati in `users/{uid}/preferiti/{eventoId}`.
- [ ] Preferiti `localStorage` migrati al primo login.
- [ ] Utente non può leggere preferiti altrui.

### Sicurezza
- [ ] Firestore rules impediscono write su `eventi` a utenti non admin.
- [ ] Firestore rules impediscono modifica di `role` da client.
- [ ] Nessun rendering di pagine protette prima del guard.
- [ ] `returnTo` non permette open redirect.
- [ ] Messaggi errore login/register non rivelano esistenza email.

### Recupero password
- [ ] Flusso forgot-password funzionante end-to-end.
- [ ] Messaggio generico indipendentemente dall'esistenza dell'email.

---

## 12. Conseguenze

### Positive
- Percorso utente lineare e prevedibile.
- Separazione netta tra identità, profilo e autorizzazione.
- Base solida per funzionalità future (notifiche, premium, profilo).
- Preferiti sincronizzati cross-device.
- Sicurezza allineata a standard production.

### Negative
- Maggiore complessità rispetto all'MVP attuale.
- Introduzione Cloud Functions (costo e manutenzione).
- Obbligo di login per usare l'app (barriera d'ingresso).
- Migrazione admin e preferiti richiede intervento operativo al deploy.
- Ogni pagina HTML deve importare e attendere il guard (latenza iniziale).

### Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Race condition auth (FOUC) | `waitForAuth()` + splash obbligatorio |
| Documento `users` mancante dopo register | Rollback Auth su failure; recovery path al login |
| Admin senza claim dopo promozione | `getIdToken(true)` o re-login obbligatorio |
| Indice Firestore mancante | Deploy indexes in CI |
| Signup abilitato in Console | Disabilitare signup pubblico in Console; documentare in SETUP.md |

---

## 13. Riferimenti

| Documento | Relazione |
|---|---|
| `README.md` | Overview progetto |
| `SETUP.md` | Setup operativo Firebase |
| `firestore.rules` | Implementazione §ADR-001.13 |
| `docs/adr/001-autenticazione-e-ruoli.md` | Questo documento |

---

## 14. Storico revisioni

| Versione | Data | Modifica |
|---|---|---|
| 1.0 | 2026-06-30 | Creazione ADR iniziale — auth e ruoli v1 |

---

## 15. Approvazione

Questo documento è il riferimento vincolante per l'implementazione dell'autenticazione e dei ruoli. Qualsiasi deviazione richiede un nuovo ADR che supersede o modifica le decisioni qui contenute.

**Prossimo passo:** implementazione Fase 1 conforme a §10.
