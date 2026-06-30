# Test Plan — Autenticazione e Ruoli

> **ARCHIVIATO** — Test plan non più applicabile. L'architettura ufficiale è definita in [ADR-002](002-decisione-app-anonima-admin-only.md). La branch `cursor/auth-fase-1-fondamenta-2423` è stata chiusa senza merge.

| Campo | Valore |
|---|---|
| **ID** | TP-001 |
| **Versione** | 1.0 |
| **Data** | 2026-06-30 |
| **Progetto** | Che facim'? |
| **Riferimento architetturale** | `docs/archive/001-autenticazione-e-ruoli.md` (archiviato) |
| **Tipo** | Test manuali |
| **Stato** | Archiviato — superseded da ADR-002 |

---

## 1. Scopo

Verificare manualmente che l'implementazione dell'autenticazione e dei ruoli sia conforme all'ADR-001, coprendo:

- Flussi utente lineari (registrazione, verifica, login, home)
- Flussi admin (login, dashboard, CRUD eventi)
- Route guard e redirect
- Persistenza sessione e logout
- Recupero password
- Preferiti legati all'utente
- Firestore Security Rules (comportamento osservabile)
- Casi negativi e di sicurezza
- Migrazione dallo stato legacy

---

## 2. Fuori scope

| Elemento | Motivo |
|---|---|
| Login social (Google, Apple) | Fuori scope v1 (ADR §5) |
| MFA | Fuori scope v1 |
| Test automatici / E2E script | Richiesta esplicita: solo manuali |
| Performance load testing | Non incluso |
| Penetration test professionale | Non incluso; solo smoke security manuale |

---

## 3. Ambiente di test

### 3.1 Ambienti richiesti

| Ambiente | URL | Uso |
|---|---|---|
| **Staging** | `https://che-facim-staging.web.app` (o preview channel Firebase) | Esecuzione principale |
| **Produzione** | `https://che-facim.web.app` | Smoke test pre/post release |

> Eseguire tutti i test P0 su staging prima del deploy in produzione. Ripetere smoke P0 in produzione dopo il deploy.

### 3.2 Browser e dispositivi

Eseguire almeno i casi **P0** su ciascuna combinazione:

| # | Browser / dispositivo | Versione minima |
|---|---|---|
| B1 | Chrome desktop | Ultima stable |
| B2 | Safari iOS | Ultima su iPhone |
| B3 | Chrome Android | Ultima su smartphone |
| B4 | Firefox desktop | Ultima stable |

### 3.3 Strumenti ausiliari

| Strumento | Uso |
|---|---|
| Firebase Console → Authentication | Verificare utenti, email verificata, custom claims |
| Firebase Console → Firestore | Verificare documenti `users`, `preferiti`, `eventi` |
| DevTools → Application → Local Storage / IndexedDB | Verificare sessione e migrazione preferiti |
| DevTools → Network | Verificare assenza di leak dati sensibili |
| Casella email di test | Ricevere email verifica e reset password |
| Browser incognito / profilo separato | Sessioni isolate tra test |
| Secondo dispositivo o browser | Test cross-device preferiti |

### 3.4 Configurazione Firebase pre-test

Prima di iniziare, verificare in Firebase Console:

- [ ] Provider Email/Password abilitato
- [ ] Signup pubblico disabilitato **oppure** controllato (documentare stato reale)
- [ ] Action URL reset password punta a `/auth/login.html`
- [ ] Almeno un account admin bootstrap con `users/{uid}` e claim `admin: true`
- [ ] Firestore rules deployate (versione ADR)
- [ ] Firestore indexes deployati
- [ ] Cloud Function `setAdminRole` deployata

---

## 4. Dati di test

### 4.1 Account predefiniti

| ID account | Email | Ruolo | Stato | Uso |
|---|---|---|---|---|
| ACC-ADMIN | `admin@test.chefacim.it` | admin | active, verificato | Test admin |
| ACC-USER-A | `usera@test.chefacim.it` | user | active, verificato | Test utente standard |
| ACC-USER-B | `userb@test.chefacim.it` | user | active, verificato | Test isolamento preferiti |
| ACC-UNVERIFIED | `unverified@test.chefacim.it` | user | active, **non verificato** | Test blocco pre-verifica |
| ACC-SUSPENDED | `suspended@test.chefacim.it` | user | **suspended** | Test account sospeso |

> Creare gli account in Firebase Console o via registrazione in-app. Per ACC-UNVERIFIED: registrare ma non cliccare il link di verifica. Per ACC-SUSPENDED: impostare `status: "suspended"` in Firestore da admin.

### 4.2 Password di test

| Regola | Valore |
|---|---|
| Password standard test | `TestCheFacim2026!` |
| Password debole (negativo) | `123456` |
| Password nuova (reset) | `NewTestCheFacim2026!` |

> Usare password diverse per ogni ambiente. Non usare password di produzione reali.

### 4.3 Dati Firestore di supporto

| Dato | Scopo |
|---|---|
| Almeno 1 evento `stato: "pubblicato"` | Test home e preferiti |
| Almeno 1 evento `stato: "bozza"` o non pubblicato | Test rules lettura eventi |
| `localStorage` legacy con 2-3 preferiti | Test migrazione (chiave `lucania_tonight_preferiti`) |

---

## 5. Convenzioni test case

| Campo | Significato |
|---|---|
| **TC-XXX-NNN** | ID univoco (suite-numero) |
| **P0** | Bloccante — must pass per release |
| **P1** | Importante — deve passare pre-lancio |
| **P2** | Nice to have — edge case / UX |
| **ADR** | Riferimento sezione ADR-001 |

### Esito

| Simbolo | Significato |
|---|---|
| ✅ PASS | Comportamento conforme |
| ❌ FAIL | Non conforme |
| ⚠️ BLOCKED | Test non eseguibile (ambiente/dati mancanti) |
| ➖ N/A | Non applicabile |

### Template compilazione

```
TC-ID: 
Tester: 
Data: 
Ambiente: 
Browser: 
Esito: PASS / FAIL / BLOCKED
Note: 
```

---

## 6. Matrice tracciabilità ADR → Test

| Sezione ADR | Suite test |
|---|---|
| 001.1 Login unico | REG, LOGIN, ADMIN |
| 001.3 Collection users | REG, USERS, SEC |
| 001.4 Ruoli | ROLE, ADMIN, SEC |
| 001.5 Verifica email | VERIFY |
| 001.6 Registrazione | REG |
| 001.7 Redirect | REDIR, LOGIN |
| 001.8 Route guard | GUARD |
| 001.9 Sessione | SESSION |
| 001.10 Logout | LOGOUT |
| 001.11 Recupero password | RESET |
| 001.12 Preferiti | PREF |
| 001.13 Firestore rules | SEC, ADMIN |
| 001.14 Cloud Functions | ROLE |
| 001.15 Protezione admin | ADMIN, GUARD |
| 001.16 Accesso senza auth | GUARD |
| §11 Criteri accettazione | ACCEPT |

---

# SUITE 1 — REGISTRAZIONE (REG)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-REG-001 | P0 | Registrazione happy path | 001.6 |
| TC-REG-002 | P0 | Creazione documento `users/{uid}` | 001.3 |
| TC-REG-003 | P0 | Redirect post-registrazione a verify-email | 001.5, 001.6 |
| TC-REG-004 | P0 | Nessun accesso a home prima della verifica | 001.5 |
| TC-REG-005 | P1 | Email già registrata — messaggio generico | 001.6, §8.9 |
| TC-REG-006 | P1 | Password troppo debole | 001.6 |
| TC-REG-007 | P1 | Email formato non valido | 001.6 |
| TC-REG-008 | P1 | Campi obbligatori vuoti | 001.6 |
| TC-REG-009 | P1 | Conferma password non coincidente | 001.6 |
| TC-REG-010 | P2 | Registrazione con display name | 001.6 |
| TC-REG-011 | P2 | Registrazione senza display name | 001.6 |
| TC-REG-012 | P1 | Doppio submit form (anti-duplicazione) | 001.6 |

---

### TC-REG-001 — Registrazione happy path
**Priorità:** P0 | **ADR:** 001.6

**Precondizioni:**
- Visitatore non autenticato
- Email `newuser-{timestamp}@test.chefacim.it` mai usata

**Passi:**
1. Aprire `/index.html` in incognito
2. Verificare redirect a `/auth/login.html`
3. Cliccare link "Registrati"
4. Compilare email, password, conferma password
5. Submit

**Risultato atteso:**
- Nessun errore visibile
- Redirect a `/auth/verify-email.html`
- In Firebase Console → Authentication: nuovo utente presente
- `emailVerified = false`

---

### TC-REG-002 — Creazione documento users/{uid}
**Priorità:** P0 | **ADR:** 001.3

**Precondizioni:**
- Completato TC-REG-001

**Passi:**
1. In Firebase Console → Firestore, aprire `users/{uid}`
2. Verificare tutti i campi

**Risultato atteso:**

| Campo | Valore atteso |
|---|---|
| `uid` | Uguale a Auth uid |
| `email` | Email registrata (lowercase) |
| `role` | `"user"` |
| `email_verified` | `false` |
| `status` | `"active"` |
| `onboarding_completed` | `false` |
| `created_at` | Presente |
| `updated_at` | Presente |

---

### TC-REG-003 — Redirect post-registrazione a verify-email
**Priorità:** P0 | **ADR:** 001.5, 001.6

**Precondizioni:** Visitatore non autenticato

**Passi:**
1. Completare registrazione con nuova email
2. Osservare URL finale

**Risultato atteso:**
- URL = `/auth/verify-email.html`
- Pagina mostra istruzioni verifica email
- Non si visualizza home né bottom nav completa dell'app

---

### TC-REG-004 — Nessun accesso a home prima della verifica
**Priorità:** P0 | **ADR:** 001.5

**Precondizioni:**
- Utente appena registrato, email **non** verificata
- Sessione attiva (dopo registrazione)

**Passi:**
1. Digitare manualmente `/index.html` nella barra URL
2. Digitare `/preferiti.html`
3. Digitare `/evento.html?id={id_evento_valido}`

**Risultato atteso:**
- Ogni tentativo redirect a `/auth/verify-email.html`
- Nessun contenuto app (lista eventi, preferiti) visibile

---

### TC-REG-005 — Email già registrata
**Priorità:** P1 | **ADR:** §8.9

**Precondizioni:** ACC-USER-A già esistente

**Passi:**
1. Aprire `/auth/register.html`
2. Inserire email di ACC-USER-A
3. Submit

**Risultato atteso:**
- Messaggio errore generico (es. "Registrazione non riuscita" o simile)
- **Non** compare messaggio esplicito "email già in uso"
- Nessun nuovo documento `users` creato

---

### TC-REG-006 — Password troppo debole
**Priorità:** P1

**Passi:**
1. Registrarsi con password `123456`
2. Submit

**Risultato atteso:**
- Errore lato client o Firebase
- Nessun utente creato in Auth
- Nessun documento `users` creato

---

### TC-REG-007 — Email formato non valido
**Priorità:** P1

**Passi:**
1. Inserire email `nonvalida`
2. Submit

**Risultato atteso:**
- Validazione HTML5 o messaggio errore
- Nessuna chiamata riuscita (verificare in Network)

---

### TC-REG-008 — Campi obbligatori vuoti
**Priorità:** P1

**Passi:**
1. Lasciare email vuota → submit
2. Lasciare password vuota → submit

**Risultato atteso:**
- Form non inviato (validazione HTML5 `required`)
- Nessun utente creato

---

### TC-REG-009 — Conferma password non coincidente
**Priorità:** P1

**Passi:**
1. Password: `TestCheFacim2026!`
2. Conferma: `AltraPassword123!`
3. Submit

**Risultato atteso:**
- Errore client-side prima della chiamata Firebase
- Nessun utente creato

---

### TC-REG-010 — Registrazione con display name
**Priorità:** P2

**Passi:**
1. Registrarsi compilando anche display name "Mario Rossi"
2. Verificare Firestore

**Risultato atteso:**
- `users/{uid}.display_name = "Mario Rossi"`

---

### TC-REG-011 — Registrazione senza display name
**Priorità:** P2

**Passi:**
1. Registrarsi lasciando display name vuoto

**Risultato atteso:**
- Registrazione riuscita
- `display_name` assente o stringa vuota

---

### TC-REG-012 — Doppio submit form
**Priorità:** P1

**Passi:**
1. Compilare form registrazione
2. Cliccare submit rapidamente 2-3 volte

**Risultato atteso:**
- Un solo utente creato in Auth
- Bottone disabilitato durante elaborazione
- Nessun errore duplicazione visibile all'utente

---

# SUITE 2 — VERIFICA EMAIL (VERIFY)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-VERIFY-001 | P0 | Ricezione email di verifica | 001.5 |
| TC-VERIFY-002 | P0 | Verifica tramite link email | 001.5 |
| TC-VERIFY-003 | P0 | Accesso home dopo verifica | 001.5 |
| TC-VERIFY-004 | P0 | Sync `email_verified` su Firestore | 001.3, 001.5 |
| TC-VERIFY-005 | P1 | Rinvio email verifica | 001.5 |
| TC-VERIFY-006 | P1 | Cooldown rinvio 60 secondi | 001.5 |
| TC-VERIFY-007 | P1 | Polling automatico su verify-email | 001.5 |
| TC-VERIFY-008 | P1 | Logout da pagina verify-email | 001.5 |
| TC-VERIFY-009 | P1 | Login utente non verificato → verify-email | 001.7 |
| TC-VERIFY-010 | P2 | Link verifica scaduto / già usato | 001.5 |

---

### TC-VERIFY-001 — Ricezione email di verifica
**Priorità:** P0

**Precondizioni:** Registrazione appena completata (TC-REG-001)

**Passi:**
1. Aprire casella email usata per registrazione
2. Cercare email da `noreply@che-facim.firebaseapp.com` (o mittente Firebase)

**Risultato atteso:**
- Email ricevuta entro 2 minuti
- Contiene link di verifica cliccabile

---

### TC-VERIFY-002 — Verifica tramite link email
**Priorità:** P0

**Passi:**
1. Cliccare link verifica nell'email
2. Tornare all'app su `/auth/verify-email.html`
3. Attendere aggiornamento (o cliccare "Ho verificato" se presente)

**Risultato atteso:**
- Firebase Auth: `emailVerified = true`
- Redirect automatico o manuale verso `/index.html`

---

### TC-VERIFY-003 — Accesso home dopo verifica
**Priorità:** P0

**Precondizioni:** Email verificata

**Passi:**
1. Verificare URL = `/index.html`
2. Verificare caricamento lista eventi

**Risultato atteso:**
- Home visibile con contenuto
- Bottom nav funzionante
- Nessun redirect a login o verify-email

---

### TC-VERIFY-004 — Sync email_verified su Firestore
**Priorità:** P0

**Passi:**
1. Dopo verifica, controllare `users/{uid}` in Firestore

**Risultato atteso:**
- `email_verified = true`
- `updated_at` aggiornato

---

### TC-VERIFY-005 — Rinvio email verifica
**Priorità:** P1

**Precondizioni:** Utente autenticato, email non verificata, su `/auth/verify-email.html`

**Passi:**
1. Cliccare "Rinvia email"
2. Controllare casella email

**Risultato atteso:**
- Nuova email ricevuta
- Messaggio conferma invio in UI

---

### TC-VERIFY-006 — Cooldown rinvio 60 secondi
**Priorità:** P1

**Passi:**
1. Cliccare "Rinvia email"
2. Tentare clic immediato seconda volta

**Risultato atteso:**
- Bottone disabilitato o messaggio cooldown
- Impossibile inviare seconda email entro 60 secondi

---

### TC-VERIFY-007 — Polling automatico
**Priorità:** P1

**Precondizioni:** Utente su verify-email, email **non** ancora verificata

**Passi:**
1. In un'altra tab, cliccare link verifica email
2. Tornare alla tab verify-email senza refresh manuale
3. Attendere max 10 secondi

**Risultato atteso:**
- App rileva verifica automaticamente (polling)
- Redirect a `/index.html` senza refresh manuale F5

---

### TC-VERIFY-008 — Logout da verify-email
**Priorità:** P1

**Passi:**
1. Da `/auth/verify-email.html`, cliccare logout (se disponibile) o navigare a logout
2. Osservare destinazione

**Risultato atteso:**
- Redirect a `/auth/login.html`
- Tentativo accesso `/auth/verify-email.html` senza login → redirect login

---

### TC-VERIFY-009 — Login utente non verificato
**Priorità:** P1

**Precondizioni:** ACC-UNVERIFIED

**Passi:**
1. Aprire `/auth/login.html`
2. Login con ACC-UNVERIFIED
3. Osservare redirect

**Risultato atteso:**
- Redirect a `/auth/verify-email.html`
- **Non** a `/index.html`

---

### TC-VERIFY-010 — Link verifica già usato
**Priorità:** P2

**Passi:**
1. Cliccare link verifica una seconda volta dopo verifica completata

**Risultato atteso:**
- Nessun errore critico lato app
- Utente resta verificato

---

# SUITE 3 — LOGIN (LOGIN)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-LOGIN-001 | P0 | Login utente happy path | 001.7 |
| TC-LOGIN-002 | P0 | Login admin happy path | 001.1, 001.7 |
| TC-LOGIN-003 | P0 | Credenziali errate | 001.7, §8.9 |
| TC-LOGIN-004 | P1 | Email non registrata — messaggio generico | §8.9 |
| TC-LOGIN-005 | P0 | Utente già loggato visita /auth/login.html | 001.7 |
| TC-LOGIN-006 | P1 | Login con account sospeso | 001.7 |
| TC-LOGIN-007 | P1 | Aggiornamento last_login_at | 001.3 |
| TC-LOGIN-008 | P1 | Recovery: Auth esiste, documento users mancante | 001.3 |
| TC-LOGIN-009 | P2 | Login con spazi nella email (trim) | 001.7 |
| TC-LOGIN-010 | P1 | Link "Password dimenticata" visibile | 001.11 |
| TC-LOGIN-011 | P1 | Link "Registrati" visibile | 001.6 |

---

### TC-LOGIN-001 — Login utente happy path
**Priorità:** P0

**Precondizioni:** ACC-USER-A verificato, logout effettuato

**Passi:**
1. Aprire `/auth/login.html`
2. Inserire credenziali ACC-USER-A
3. Submit

**Risultato atteso:**
- Redirect a `/index.html`
- Lista eventi caricata
- Nessun flash del form login sulla home

---

### TC-LOGIN-002 — Login admin happy path
**Priorità:** P0

**Precondizioni:** ACC-ADMIN verificato, logout effettuato

**Passi:**
1. Aprire `/auth/login.html`
2. Inserire credenziali ACC-ADMIN
3. Submit

**Risultato atteso:**
- Redirect a `/admin/index.html`
- Dashboard admin visibile (form eventi o lista)
- **Non** redirect a `/index.html`

---

### TC-LOGIN-003 — Credenziali errate
**Priorità:** P0

**Passi:**
1. Login con email corretta, password sbagliata
2. Login con email inesistente, password qualsiasi

**Risultato atteso:**
- Stesso messaggio: "Email o password non corrette" (o equivalente)
- Nessun redirect
- Utente resta su login

---

### TC-LOGIN-004 — Email non registrata — anti-enumeration
**Priorità:** P1

**Passi:**
1. Login con `inesistente@test.chefacim.it`

**Risultato atteso:**
- Messaggio identico a TC-LOGIN-003
- Impossibile capire se l'email esiste

---

### TC-LOGIN-005 — Utente già loggato visita login
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato

**Passi:**
1. Navigare manualmente a `/auth/login.html`

**Risultato atteso:**
- Redirect immediato a `/index.html` (user) o `/admin/index.html` (admin)
- Form login non resta visibile

---

### TC-LOGIN-006 — Account sospeso
**Priorità:** P1

**Precondizioni:** ACC-SUSPENDED

**Passi:**
1. Login con ACC-SUSPENDED

**Risultato atteso:**
- Redirect a `/auth/suspended.html`
- Nessun accesso a home o admin

---

### TC-LOGIN-007 — Aggiornamento last_login_at
**Priorità:** P1

**Passi:**
1. Annotare `last_login_at` in Firestore
2. Logout, login di nuovo
3. Ricontrollare Firestore

**Risultato atteso:**
- `last_login_at` aggiornato a timestamp più recente

---

### TC-LOGIN-008 — Recovery documento users mancante
**Priorità:** P1

**Precondizioni:**
- Utente presente in Auth
- Documento `users/{uid}` **eliminato manualmente** da Console

**Passi:**
1. Login con quell'utente

**Risultato atteso:**
- Login riuscito
- Documento `users/{uid}` ricreato con `role: "user"`
- Redirect corretto in base a verifica email

---

### TC-LOGIN-009 — Trim email
**Priorità:** P2

**Passi:**
1. Login con `  usera@test.chefacim.it  ` (spazi)

**Risultato atteso:**
- Login riuscito (email trimmed)

---

### TC-LOGIN-010 — Link password dimenticata
**Priorità:** P1

**Passi:**
1. Su login, cliccare "Password dimenticata"

**Risultato atteso:**
- Navigazione a `/auth/forgot-password.html`

---

### TC-LOGIN-011 — Link registrati
**Priorità:** P1

**Passi:**
1. Su login, cliccare "Registrati"

**Risultato atteso:**
- Navigazione a `/auth/register.html`

---

# SUITE 4 — LOGOUT (LOGOUT)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-LOGOUT-001 | P0 | Logout da home utente | 001.10 |
| TC-LOGOUT-002 | P0 | Logout da admin | 001.10 |
| TC-LOGOUT-003 | P0 | Logout da About | 001.10 |
| TC-LOGOUT-004 | P1 | Post-logout: pagine protette inaccessibili | 001.10 |
| TC-LOGOUT-005 | P1 | Post-logout: pulizia localStorage legacy | 001.10, 001.12 |
| TC-LOGOUT-006 | P1 | Post-logout: preferiti Firestore persistono | 001.12 |
| TC-LOGOUT-007 | P2 | Doppio click logout | 001.10 |

---

### TC-LOGOUT-001 — Logout da home utente
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato su `/index.html`

**Passi:**
1. Cliccare "Esci" (header o menu)
2. Osservare URL

**Risultato atteso:**
- Redirect a `/auth/login.html`
- `/index.html` non più accessibile senza login

---

### TC-LOGOUT-002 — Logout da admin
**Priorità:** P0

**Precondizioni:** ACC-ADMIN loggato su `/admin/index.html`

**Passi:**
1. Cliccare "Esci"

**Risultato atteso:**
- Redirect a `/auth/login.html`
- `/admin/index.html` non accessibile senza login admin

---

### TC-LOGOUT-003 — Logout da About
**Priorità:** P0

**Passi:**
1. Login come ACC-USER-A
2. Navigare a `/about.html`
3. Cliccare logout

**Risultato atteso:**
- Redirect a `/auth/login.html`

---

### TC-LOGOUT-004 — Pagine protette post-logout
**Priorità:** P1

**Precondizioni:** Logout appena effettuato

**Passi:**
1. Tentare `/index.html`, `/preferiti.html`, `/admin/index.html`

**Risultato atteso:**
- Tutti redirect a `/auth/login.html`

---

### TC-LOGOUT-005 — Pulizia localStorage legacy
**Priorità:** P1

**Precondizioni:**
- Migrazione preferiti già avvenuta
- Chiave `lucania_tonight_preferiti` era presente

**Passi:**
1. Logout
2. DevTools → Application → Local Storage

**Risultato atteso:**
- Chiave `lucania_tonight_preferiti` assente o vuota

---

### TC-LOGOUT-006 — Preferiti Firestore persistono
**Priorità:** P1

**Precondizioni:** ACC-USER-A ha almeno 1 preferito su Firestore

**Passi:**
1. Logout
2. Verificare Firestore `users/{uid}/preferiti` — ancora presenti
3. Login di nuovo
4. Aprire `/preferiti.html`

**Risultato atteso:**
- Preferiti ancora visibili dopo re-login

---

### TC-LOGOUT-007 — Doppio click logout
**Priorità:** P2

**Passi:**
1. Cliccare "Esci" due volte rapidamente

**Risultato atteso:**
- Un solo redirect a login
- Nessun errore console

---

# SUITE 5 — SESSIONE (SESSION)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-SESSION-001 | P0 | Sessione persiste dopo reload | 001.9 |
| TC-SESSION-002 | P0 | Sessione persiste dopo chiusura tab | 001.9 |
| TC-SESSION-003 | P1 | Sessione condivisa tra pagine app | 001.9 |
| TC-SESSION-004 | P1 | Splash durante risoluzione auth | 001.9 |
| TC-SESSION-005 | P1 | Nessun FOUC — contenuto protetto nascosto pre-guard | 001.8, §8.8 |
| TC-SESSION-006 | P2 | Sessione admin su pagina pubblica (background) | 001.9 |
| TC-SESSION-007 | P2 | Token refresh silenzioso (sessione lunga) | 001.9 |

---

### TC-SESSION-001 — Persistenza dopo reload
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato

**Passi:**
1. Su `/index.html`, premere F5

**Risultato atteso:**
- Resta su `/index.html`
- Nessun redirect a login
- Eventi caricati

---

### TC-SESSION-002 — Persistenza dopo chiusura tab
**Priorità:** P0

**Passi:**
1. Login ACC-USER-A
2. Chiudere tab
3. Riaprire browser, navigare a `/index.html`

**Risultato atteso:**
- Accesso diretto senza re-login

---

### TC-SESSION-003 — Sessione tra pagine
**Priorità:** P1

**Passi:**
1. Login, navigare: home → evento → preferiti → i miei eventi → about
2. Verificare nessun re-login richiesto

**Risultato atteso:**
- Navigazione fluida senza redirect login

---

### TC-SESSION-004 — Splash durante auth
**Priorità:** P1

**Passi:**
1. Aprire `/index.html` con sessione attiva
2. Osservare i primi istanti di caricamento

**Risultato atteso:**
- Splash "Caricamento…" visibile brevemente
- Poi contenuto app

---

### TC-SESSION-005 — Nessun FOUC
**Priorità:** P1

**Precondizioni:** Logout, visitatore

**Passi:**
1. Aprire `/index.html` con throttling rete (DevTools → Slow 3G)
2. Osservare se lista eventi appare prima del redirect

**Risultato atteso:**
- **Mai** visibile lista eventi prima del redirect a login
- Solo splash o pagina vuota, poi login

---

### TC-SESSION-006 — Sessione admin in background su pagina pubblica
**Priorità:** P2

**Precondizioni:** ACC-ADMIN loggato

**Passi:**
1. Navigare manualmente a `/index.html`

**Risultato atteso:**
- Comportamento documentato: redirect a `/admin/index.html` (se implementato) oppure accesso home
- **Documentare** comportamento reale e verificare coerenza con ADR

---

### TC-SESSION-007 — Token refresh (sessione lunga)
**Priorità:** P2

**Passi:**
1. Login, lasciare tab aperta 60+ minuti
2. Interagire con app (cambia giorno, aggiungi preferito)

**Risultato atteso:**
- App continua a funzionare senza logout forzato

---

# SUITE 6 — ROUTE GUARD (GUARD)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-GUARD-001 | P0 | Visitatore → /index.html → login | 001.16 |
| TC-GUARD-002 | P0 | Visitatore → /preferiti.html → login | 001.16 |
| TC-GUARD-003 | P0 | Visitatore → /evento.html → login | 001.16 |
| TC-GUARD-004 | P0 | Visitatore → /i-miei-eventi.html → login | 001.16 |
| TC-GUARD-005 | P0 | Visitatore → /about.html → accesso consentito | 001.16 |
| TC-GUARD-006 | P0 | Visitatore → /auth/login.html → accesso consentito | 001.8 |
| TC-GUARD-007 | P0 | Visitatore → /admin/index.html → login | 001.15 |
| TC-GUARD-008 | P0 | User → /admin/index.html → index.html | 001.15 |
| TC-GUARD-009 | P1 | User non verificato → qualsiasi pagina verified → verify-email | 001.5 |
| TC-GUARD-010 | P1 | Admin non verificato → /admin → verify-email | 001.15 |
| TC-GUARD-011 | P1 | /auth/reset-sent.html accessibile senza login | 001.8 |
| TC-GUARD-012 | P1 | /auth/suspended.html accessibile senza login | 001.8 |
| TC-GUARD-013 | P2 | /index-demo.html (non deployato) — fuori scope | — |

---

### TC-GUARD-001 — Visitatore bloccato da home
**Priorità:** P0

**Passi:**
1. Incognito, navigare a `/` o `/index.html`

**Risultato atteso:**
- Redirect a `/auth/login.html`

---

### TC-GUARD-002 — Visitatore bloccato da preferiti
**Priorità:** P0

**Passi:** Incognito → `/preferiti.html`

**Risultato atteso:** Redirect a `/auth/login.html`

---

### TC-GUARD-003 — Visitatore bloccato da dettaglio evento
**Priorità:** P0

**Passi:** Incognito → `/evento.html?id={id}`

**Risultato atteso:** Redirect a `/auth/login.html`

---

### TC-GUARD-004 — Visitatore bloccato da i miei eventi
**Priorità:** P0

**Passi:** Incognito → `/i-miei-eventi.html`

**Risultato atteso:** Redirect a `/auth/login.html`

---

### TC-GUARD-005 — About accessibile senza login
**Priorità:** P0

**Passi:** Incognito → `/about.html`

**Risultato atteso:**
- Pagina About visibile
- Nessun redirect

---

### TC-GUARD-006 — Login accessibile senza sessione
**Priorità:** P0

**Passi:** Incognito → `/auth/login.html`

**Risultato atteso:** Form login visibile

---

### TC-GUARD-007 — Admin bloccato per visitatore
**Priorità:** P0

**Passi:** Incognito → `/admin/index.html`

**Risultato atteso:** Redirect a `/auth/login.html`

---

### TC-GUARD-008 — User non accede ad admin
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato

**Passi:** Navigare a `/admin/index.html`

**Risultato atteso:**
- Redirect a `/index.html`
- Dashboard admin non visibile

---

### TC-GUARD-009 — Non verificato bloccato da pagine verified
**Priorità:** P1

**Precondizioni:** ACC-UNVERIFIED loggato

**Passi:** Tentare ogni pagina verified

**Risultato atteso:** Redirect a `/auth/verify-email.html`

---

### TC-GUARD-010 — Admin non verificato
**Priorità:** P1

**Precondizioni:** Account admin creato ma email non verificata

**Passi:** Login → tentare `/admin/index.html`

**Risultato atteso:** Redirect a `/auth/verify-email.html`

---

### TC-GUARD-011 — reset-sent pubblico
**Priorità:** P1

**Passi:** Incognito → `/auth/reset-sent.html`

**Risultato atteso:** Pagina visibile senza login

---

### TC-GUARD-012 — suspended pubblico
**Priorità:** P1

**Passi:** Incognito → `/auth/suspended.html`

**Risultato atteso:** Pagina visibile senza login

---

# SUITE 7 — REDIRECT (REDIR)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-REDIR-001 | P0 | returnTo valido dopo login user | 001.7 |
| TC-REDIR-002 | P0 | returnTo assente → default index | 001.7 |
| TC-REDIR-003 | P0 | returnTo verso admin negato a user | 001.7 |
| TC-REDIR-004 | P0 | Open redirect esterno bloccato | §8.7 |
| TC-REDIR-005 | P1 | returnTo con javascript: bloccato | §8.7 |
| TC-REDIR-006 | P1 | returnTo con dominio esterno bloccato | §8.7 |
| TC-REDIR-007 | P1 | returnTo verso /auth/login.html ignorato o sanificato | 001.7 |
| TC-REDIR-008 | P2 | returnTo verso /about.html funzionante | 001.7 |

---

### TC-REDIR-001 — returnTo valido
**Priorità:** P0

**Precondizioni:** Logout

**Passi:**
1. Visitare `/evento.html?id={id}` (redirect a login con returnTo)
2. Login ACC-USER-A
3. Osservare destinazione

**Risultato atteso:**
- Redirect a `/evento.html?id={id}` dopo login

---

### TC-REDIR-002 — returnTo assente
**Priorità:** P0

**Passi:** Login diretto da `/auth/login.html` senza query string

**Risultato atteso:** Redirect a `/index.html` (user) o `/admin/index.html` (admin)

---

### TC-REDIR-003 — returnTo admin negato a user
**Priorità:** P0

**Passi:**
1. Visitare `/auth/login.html?returnTo=/admin/index.html`
2. Login ACC-USER-A

**Risultato atteso:**
- Redirect a `/index.html` (non admin)

---

### TC-REDIR-004 — Open redirect esterno bloccato
**Priorità:** P0

**Passi:**
1. Visitare `/auth/login.html?returnTo=https://evil.com`
2. Login ACC-USER-A

**Risultato atteso:**
- Redirect a `/index.html` (returnTo ignorato)
- **Mai** redirect a evil.com

---

### TC-REDIR-005 — javascript: bloccato
**Priorità:** P1

**Passi:** `?returnTo=javascript:alert(1)` → login

**Risultato atteso:** Redirect sicuro a index, nessun alert

---

### TC-REDIR-006 — Dominio esterno con path
**Priorità:** P1

**Passi:** `?returnTo=//evil.com/path` → login

**Risultato atteso:** Redirect sicuro a index

---

### TC-REDIR-007 — returnTo verso login
**Priorità:** P1

**Passi:** `?returnTo=/auth/login.html` → login

**Risultato atteso:** Redirect a `/index.html` (loop evitato)

---

# SUITE 8 — RUOLI (ROLE)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-ROLE-001 | P0 | Nuovo utente ha role=user | 001.4 |
| TC-ROLE-002 | P0 | Admin ha role=admin + claim | 001.4 |
| TC-ROLE-003 | P0 | Promozione via setAdminRole | 001.14 |
| TC-ROLE-004 | P1 | Post-promozione: re-login o refresh token | 001.4 |
| TC-ROLE-005 | P0 | User non può promuovere se stesso | 001.4, §8.1 |
| TC-ROLE-006 | P1 | User non può modificare proprio role su Firestore | §8.1 |
| TC-ROLE-007 | P1 | User non può modificare proprio status | §8.3 |
| TC-ROLE-008 | P1 | Admin può modificare role/status altri utenti | 001.13 |
| TC-ROLE-009 | P2 | Demotion admin → user via Function | 001.4 |

---

### TC-ROLE-001 — role=user alla registrazione
**Priorità:** P0

**Passi:** Registrare nuovo utente, verificare Firestore

**Risultato atteso:** `role = "user"`

---

### TC-ROLE-002 — Admin role e claim
**Priorità:** P0

**Precondizioni:** ACC-ADMIN

**Passi:**
1. Firestore: `users/{uid}.role = "admin"`
2. Firebase Console → Auth → utente → custom claims: `admin: true`

**Risultato atteso:** Entrambi presenti

---

### TC-ROLE-003 — Promozione setAdminRole
**Priorità:** P0

**Precondizioni:**
- ACC-ADMIN loggato
- ACC-USER-B da promuovere

**Passi:**
1. Invocare `setAdminRole` per uid di USER-B (da Console Functions o UI admin futura)
2. Verificare Firestore e claims

**Risultato atteso:**
- `users/{userB}.role = "admin"`
- Claim `admin: true` su USER-B

---

### TC-ROLE-004 — Post-promozione refresh
**Priorità:** P1

**Precondizioni:** USER-B appena promosso, sessione attiva come user

**Passi:**
1. Senza re-login, tentare `/admin/index.html`
2. Se bloccato: logout, login, riprovare

**Risultato atteso:**
- Prima del refresh token: possibile blocco (documentare)
- Dopo re-login o `getIdToken(true)`: accesso admin consentito

---

### TC-ROLE-005 — User non può auto-promuoversi
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato

**Passi:**
1. Da DevTools Console, tentare `updateDoc(users/{uid}, { role: "admin" })` (simulazione utente malintenzionato)

**Risultato atteso:**
- `permission-denied` da Firestore
- `role` invariato

---

### TC-ROLE-006 — User non modifica role
**Priorità:** P1

**Passi:** Tentare update `role` via qualsiasi path client

**Risultato atteso:** permission-denied

---

### TC-ROLE-007 — User non modifica status
**Priorità:** P1

**Passi:** Tentare `updateDoc({ status: "suspended" })` sul proprio profilo

**Risultato atteso:** permission-denied

---

### TC-ROLE-008 — Admin modifica altri utenti
**Priorità:** P1

**Precondizioni:** ACC-ADMIN

**Passi:**
1. Admin imposta `status: "suspended"` su ACC-USER-A (via Console o UI)

**Risultato atteso:** Operazione consentita

---

# SUITE 9 — ADMIN E EVENTI (ADMIN)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-ADMIN-001 | P0 | Dashboard senza form login inline | 001.1, 001.15 |
| TC-ADMIN-002 | P0 | Admin crea evento | 001.13 |
| TC-ADMIN-003 | P0 | Admin modifica evento | 001.13 |
| TC-ADMIN-004 | P0 | Admin elimina evento | 001.13 |
| TC-ADMIN-005 | P0 | User non può creare evento | 001.13, §8.4 |
| TC-ADMIN-006 | P0 | User non può modificare evento | §8.4 |
| TC-ADMIN-007 | P0 | User non può eliminare evento | §8.4 |
| TC-ADMIN-008 | P1 | User legge solo eventi pubblicati | §8.5 |
| TC-ADMIN-009 | P1 | Admin legge eventi non pubblicati | 001.13 |
| TC-ADMIN-010 | P1 | User non può impostare in_evidenza via API | §8.4 |
| TC-ADMIN-011 | P1 | Admin può impostare in_evidenza | 001.13 |
| TC-ADMIN-012 | P1 | Validazione schema evento (categoria invalida) | 001.13 |
| TC-ADMIN-013 | P1 | Validazione immagine_url non https | 001.13 |

---

### TC-ADMIN-001 — Nessun login inline
**Priorità:** P0

**Passi:**
1. Incognito → `/admin/index.html`
2. Ispezionare HTML pagina dopo redirect login

**Risultato atteso:**
- Nessun form email/password dentro `/admin/index.html`
- Login solo su `/auth/login.html`

---

### TC-ADMIN-002 — Admin crea evento
**Priorità:** P0

**Precondizioni:** ACC-ADMIN loggato

**Passi:**
1. Compilare form nuovo evento
2. Submit

**Risultato atteso:**
- Toast successo
- Evento visibile in lista admin
- Evento visibile in home (se pubblicato)

---

### TC-ADMIN-003 — Admin modifica evento
**Priorità:** P0

**Passi:** Modificare titolo evento esistente

**Risultato atteso:** Aggiornamento riuscito

---

### TC-ADMIN-004 — Admin elimina evento
**Priorità:** P0

**Passi:** Eliminare evento con conferma

**Risultato atteso:** Evento rimosso da Firestore e liste

---

### TC-ADMIN-005 — User non crea evento
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato

**Passi:**
1. Da DevTools, tentare chiamata diretta `creaEvento()` o `addDoc` su `eventi`

**Risultato atteso:** `permission-denied`

---

### TC-ADMIN-006 — User non modifica evento
**Priorità:** P0

**Passi:** Tentare `updateDoc` su evento esistente come USER-A

**Risultato atteso:** `permission-denied`

---

### TC-ADMIN-007 — User non elimina evento
**Priorità:** P0

**Passi:** Tentare `deleteDoc` come USER-A

**Risultato atteso:** `permission-denied`

---

### TC-ADMIN-008 — User legge solo pubblicati
**Priorità:** P1

**Precondizioni:** Evento con `stato != "pubblicato"` esistente

**Passi:**
1. Come USER-A, tentare `getDoc` diretto con ID evento non pubblicato

**Risultato atteso:** `permission-denied` o documento non leggibile

---

### TC-ADMIN-009 — Admin legge non pubblicati
**Priorità:** P1

**Passi:** Come ACC-ADMIN, `getDoc` su evento non pubblicato

**Risultato atteso:** Lettura consentita

---

### TC-ADMIN-010 — User non imposta in_evidenza
**Priorità:** P1

**Passi:** Tentare write con `in_evidenza: true` come USER-A

**Risultato atteso:** `permission-denied`

---

### TC-ADMIN-011 — Admin imposta in_evidenza
**Priorità:** P1

**Passi:** Admin crea/modifica evento con checkbox in evidenza

**Risultato atteso:** Salvato e visibile badge in home

---

### TC-ADMIN-012 — Categoria invalida bloccata
**Priorità:** P1

**Passi:** Admin tenta salvare evento con `categoria: "hacker"` via DevTools

**Risultato atteso:** `permission-denied` dalle rules

---

### TC-ADMIN-013 — URL immagine non https
**Priorità:** P1

**Passi:** Admin tenta `immagine_url: "http://insecure.com/img.jpg"`

**Risultato atteso:** `permission-denied` o validazione client

---

# SUITE 10 — PREFERITI (PREF)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-PREF-001 | P0 | Aggiungi preferito su evento | 001.12 |
| TC-PREF-002 | P0 | Preferito salvato su Firestore | 001.12 |
| TC-PREF-003 | P0 | Rimuovi preferito | 001.12 |
| TC-PREF-004 | P0 | Lista preferiti corretta | 001.12 |
| TC-PREF-005 | P0 | Migrazione da localStorage | 001.12 |
| TC-PREF-006 | P0 | Cross-device: preferiti su secondo browser | 001.12 |
| TC-PREF-007 | P0 | User A non legge preferiti User B | §8.6 |
| TC-PREF-008 | P1 | Preferito persiste dopo logout/login | 001.12 |
| TC-PREF-009 | P1 | Visitatore non può salvare preferiti | 001.16 |
| TC-PREF-010 | P2 | Preferito con evento eliminato | edge case |

---

### TC-PREF-001 — Aggiungi preferito
**Priorità:** P0

**Precondizioni:** ACC-USER-A loggato, su dettaglio evento

**Passi:** Cliccare cuore

**Risultato atteso:** Icona cuore attiva (riempita)

---

### TC-PREF-002 — Salvataggio Firestore
**Priorità:** P0

**Passi:** Dopo TC-PREF-001, verificare Firestore

**Risultato atteso:**
- Documento in `users/{uid}/preferiti/{eventoId}`
- Campi `evento_id`, `salvato_il`, `snapshot` presenti

---

### TC-PREF-003 — Rimuovi preferito
**Priorità:** P0

**Passi:** Cliccare cuore di nuovo

**Risultato atteso:**
- Cuore disattivato
- Documento eliminato da Firestore

---

### TC-PREF-004 — Lista preferiti
**Priorità:** P0

**Passi:**
1. Aggiungere 2 preferiti
2. Aprire `/preferiti.html`

**Risultato atteso:** Entrambi visibili con dati corretti

---

### TC-PREF-005 — Migrazione localStorage
**Priorità:** P0

**Precondizioni:**
- Visitatore con 2-3 preferiti in `localStorage` (chiave legacy)
- Mai loggato post-deploy

**Passi:**
1. Registrarsi e completare verifica email
2. Login / accesso home
3. Controllare Firestore e localStorage

**Risultato atteso:**
- Preferiti presenti in `users/{uid}/preferiti/`
- `localStorage` legacy rimosso
- `/preferiti.html` mostra gli stessi eventi

---

### TC-PREF-006 — Cross-device
**Priorità:** P0

**Passi:**
1. ACC-USER-A: aggiungere preferito su Browser B1
2. Login stesso account su Browser B2
3. Aprire `/preferiti.html` su B2

**Risultato atteso:** Stesso preferito visibile su B2

---

### TC-PREF-007 — Isolamento preferiti
**Priorità:** P0

**Precondizioni:**
- USER-A ha preferiti
- USER-B ha preferiti diversi

**Passi:**
1. Login USER-B
2. Verificare lista preferiti

**Risultato atteso:** Solo preferiti di USER-B

**Passi aggiuntivi (DevTools):**
3. Tentare read `users/{uidA}/preferiti` come USER-B

**Risultato atteso:** `permission-denied`

---

### TC-PREF-008 — Persistenza post logout
**Priorità:** P1

**Passi:** Aggiungere preferito → logout → login → verificare

**Risultato atteso:** Preferito ancora presente

---

### TC-PREF-009 — Visitatore non salva preferiti
**Priorità:** P1

**Precondizioni:** Incognito, non loggato (se raggiungibile dettaglio evento)

**Passi:** Tentare aggiungere preferito

**Risultato atteso:**
- Redirect a login **oppure** azione bloccata
- Nessun write Firestore

---

### TC-PREF-010 — Evento eliminato
**Priorità:** P2

**Passi:**
1. Aggiungere preferito
2. Admin elimina quell'evento
3. Aprire `/preferiti.html`

**Risultato atteso:**
- Preferito ancora in lista (snapshot) **oppure** gestione graceful documentata
- Click → "Evento non trovato" su dettaglio

---

# SUITE 11 — RECUPERO PASSWORD (RESET)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-RESET-001 | P0 | Flusso forgot-password happy path | 001.11 |
| TC-RESET-002 | P0 | Email inesistente — stesso messaggio | 001.11, §8.9 |
| TC-RESET-003 | P0 | Redirect a reset-sent | 001.11 |
| TC-RESET-004 | P0 | Email reset ricevuta | 001.11 |
| TC-RESET-005 | P0 | Nuova password funzionante | 001.11 |
| TC-RESET-006 | P1 | Link reset scaduto | 001.11 |
| TC-RESET-007 | P1 | Email vuota nel form | 001.11 |

---

### TC-RESET-001 — Happy path
**Priorità:** P0

**Passi:**
1. `/auth/forgot-password.html`
2. Inserire email ACC-USER-A
3. Submit

**Risultato atteso:** Redirect `/auth/reset-sent.html`, messaggio generico

---

### TC-RESET-002 — Email inesistente
**Priorità:** P0

**Passi:** Inserire `inesistente@test.chefacim.it`

**Risultato atteso:**
- Stesso messaggio di TC-RESET-001
- Stesso redirect reset-sent

---

### TC-RESET-003 — Pagina reset-sent
**Priorità:** P0

**Risultato atteso:** Pagina conferma visibile, link per tornare a login

---

### TC-RESET-004 — Email ricevuta
**Priorità:** P0

**Passi:** Controllare casella ACC-USER-A

**Risultato atteso:** Email reset con link entro 2 minuti

---

### TC-RESET-005 — Nuova password
**Priorità:** P0

**Passi:**
1. Cliccare link reset
2. Impostare `NewTestCheFacim2026!`
3. Login con nuova password

**Risultato atteso:** Login riuscito

---

### TC-RESET-006 — Link scaduto
**Priorità:** P1

**Passi:** Usare link reset vecchio di 24+ ore

**Risultato atteso:** Errore Firebase, nessun crash app

---

### TC-RESET-007 — Email vuota
**Priorità:** P1

**Passi:** Submit form vuoto

**Risultato atteso:** Validazione HTML5, nessun invio

---

# SUITE 12 — SICUREZZA (SEC)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-SEC-001 | P0 | User non imposta email_verified=true | §8.2 |
| TC-SEC-002 | P0 | User non crea users con role=admin | §8.1 |
| TC-SEC-003 | P0 | Admin HTML non è unico controllo accesso | §8.10 |
| TC-SEC-004 | P1 | Messaggi errore non enumerano email (login) | §8.9 |
| TC-SEC-005 | P1 | Messaggi errore non enumerano email (register) | §8.9 |
| TC-SEC-006 | P1 | Messaggi errore non enumerano email (reset) | §8.9 |
| TC-SEC-007 | P1 | Profilo altrui non leggibile da user | 001.13 |
| TC-SEC-008 | P1 | Admin può leggere profili utenti | 001.13 |
| TC-SEC-009 | P2 | XSS stored non eseguibile in titolo evento | sicurezza generale |
| TC-SEC-010 | P2 | Nessun token auth in URL (dopo redirect) | 001.7 |

---

### TC-SEC-001 — email_verified non modificabile
**Priorità:** P0

**Passi:** USER-A tenta `updateDoc({ email_verified: true })`

**Risultato atteso:** permission-denied

---

### TC-SEC-002 — Creazione users admin bloccata
**Priorità:** P0

**Passi:** Tentare `setDoc(users/{uid}, { role: "admin", ... })` al register

**Risultato atteso:** permission-denied

---

### TC-SEC-003 — Protezione admin non solo CSS
**Priorità:** P0

**Passi:**
1. Visitatore: tentare write Firestore su `eventi` (DevTools)
2. Visitatore: view source `/admin/index.html` — dashboard nel DOM ma write deve fallire

**Risultato atteso:**
- Write `permission-denied` senza auth
- Con auth user (non admin): `permission-denied`
- Solo admin con claim può scrivere

---

### TC-SEC-007 — Profilo altrui
**Priorità:** P1

**Passi:** USER-A tenta `getDoc(users/{uidB})`

**Risultato atteso:** permission-denied

---

### TC-SEC-008 — Admin legge profili
**Priorità:** P1

**Passi:** ACC-ADMIN legge `users/{uidA}`

**Risultato atteso:** Lettura consentita

---

### TC-SEC-009 — XSS titolo evento
**Priorità:** P2

**Precondizioni:** Admin salva evento con titolo `<script>alert(1)</script>`

**Passi:** Aprire home e dettaglio come USER-A

**Risultato atteso:**
- Script **non** eseguito
- Titolo mostrato come testo escapato

---

### TC-SEC-010 — Token non in URL
**Priorità:** P2

**Passi:** Completare login, verificare barra URL

**Risultato atteso:**
- Nessun token JWT in query string o hash

---

# SUITE 13 — MIGRAZIONE LEGACY (MIGR)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-MIGR-001 | P0 | Admin esistente può fare login post-migrazione | §6 |
| TC-MIGR-002 | P0 | Admin esistente ha users doc + claim | §6 |
| TC-MIGR-003 | P0 | Admin CRUD eventi post-migrazione | §6 |
| TC-MIGR-004 | P1 | Vecchio login inline admin rimosso | §6 |
| TC-MIGR-005 | P1 | Vecchie rules `auth != null` sostituite | §6 |
| TC-MIGR-006 | P1 | Preferiti legacy migrati (vedi TC-PREF-005) | §6 |

---

### TC-MIGR-001 — Admin legacy login
**Priorità:** P0

**Precondizioni:** Account admin pre-esistente migrato

**Passi:** Login su `/auth/login.html`

**Risultato atteso:** Redirect `/admin/index.html`, CRUD funzionante

---

### TC-MIGR-002 — Admin legacy documento
**Priorità:** P0

**Passi:** Verificare Firestore e claims admin pre-esistente

**Risultato atteso:** `role: "admin"`, claim `admin: true`

---

### TC-MIGR-004 — Login inline rimosso
**Priorità:** P1

**Passi:** View source `/admin/index.html`

**Risultato atteso:** Nessun `#vista-login`, nessun `signInWithEmailAndPassword` inline

---

# SUITE 14 — UTENTI / PROFILO (USERS)

| ID | P | Titolo | ADR |
|---|---|---|---|
| TC-USERS-001 | P1 | User aggiorna display_name | 001.3 |
| TC-USERS-002 | P1 | User aggiorna preferences | 001.3 |
| TC-USERS-003 | P1 | User non modifica email di altri | 001.13 |
| TC-USERS-004 | P2 | User completa onboarding_completed | 001.3 |
| TC-USERS-005 | P1 | created_at immutabile su update | 001.3 |

---

### TC-USERS-001 — Aggiorna display_name
**Priorità:** P1

**Passi:** USER-A modifica nome in profilo (se UI) o via app

**Risultato atteso:** `display_name` aggiornato, `updated_at` aggiornato

---

### TC-USERS-005 — created_at immutabile
**Priorità:** P1

**Passi:** Tentare modifica `created_at` su proprio profilo

**Risultato atteso:** permission-denied

---

# SUITE 15 — CRITERI DI ACCETTAZIONE (ACCEPT)

Checklist finale mappata su ADR §11. Da compilare interamente prima del sign-off.

| ID | Criterio ADR §11 | Test correlati | Esito |
|---|---|---|---|
| TC-ACCEPT-01 | Registrazione da register.html | TC-REG-001 | |
| TC-ACCEPT-02 | users/{uid} con role=user | TC-REG-002 | |
| TC-ACCEPT-03 | Post-register su verify-email | TC-REG-003 | |
| TC-ACCEPT-04 | Client non crea role=admin | TC-SEC-002 | |
| TC-ACCEPT-05 | Non verificato non accede index | TC-REG-004, TC-GUARD-009 | |
| TC-ACCEPT-06 | Verificato accede index | TC-VERIFY-003 | |
| TC-ACCEPT-07 | Rinvio email verifica | TC-VERIFY-005 | |
| TC-ACCEPT-08 | Login unico user+admin | TC-LOGIN-001, TC-LOGIN-002 | |
| TC-ACCEPT-09 | Login user → index | TC-LOGIN-001 | |
| TC-ACCEPT-10 | Login admin → admin | TC-LOGIN-002 | |
| TC-ACCEPT-11 | Già loggato → redirect | TC-LOGIN-005 | |
| TC-ACCEPT-12 | Logout → login | TC-LOGOUT-001..003 | |
| TC-ACCEPT-13 | Nessun dato auth residuo | TC-LOGOUT-004 | |
| TC-ACCEPT-14 | User non accede admin | TC-GUARD-008 | |
| TC-ACCEPT-15 | Admin accede admin | TC-ADMIN-001 | |
| TC-ACCEPT-16 | Promozione solo setAdminRole | TC-ROLE-003 | |
| TC-ACCEPT-17 | Write eventi richiede admin | TC-ADMIN-005..007 | |
| TC-ACCEPT-18 | Preferiti su Firestore | TC-PREF-002 | |
| TC-ACCEPT-19 | Migrazione localStorage | TC-PREF-005 | |
| TC-ACCEPT-20 | Isolamento preferiti | TC-PREF-007 | |
| TC-ACCEPT-21 | Rules: no write eventi user | TC-ADMIN-005 | |
| TC-ACCEPT-22 | Rules: no modifica role | TC-ROLE-005 | |
| TC-ACCEPT-23 | No rendering pre-guard | TC-SESSION-005 | |
| TC-ACCEPT-24 | No open redirect | TC-REDIR-004 | |
| TC-ACCEPT-25 | Errori auth generici | TC-LOGIN-003, TC-REG-005 | |
| TC-ACCEPT-26 | Forgot-password E2E | TC-RESET-001..005 | |
| TC-ACCEPT-27 | Reset messaggio generico | TC-RESET-002 | |

**Sign-off:** tutti i TC-ACCEPT devono essere ✅ PASS per dichiarare conformità ADR-001.

---

## 7. Ordine di esecuzione consigliato

Eseguire le suite in questo ordine per rispettare le dipendenze:

```
1.  MIGR      — verificare admin legacy funzionante
2.  GUARD     — route guard base
3.  REG       — registrazione
4.  VERIFY    — verifica email
5.  LOGIN     — login user e admin
6.  SESSION   — persistenza
7.  REDIR     — redirect e returnTo
8.  ROLE      — ruoli e promozione
9.  ADMIN     — CRUD eventi e permessi
10. PREF      — preferiti e migrazione
11. LOGOUT    — logout
12. RESET     — recupero password
13. USERS     — profilo
14. SEC       — sicurezza negativa
15. ACCEPT    — checklist finale
```

---

## 8. Criteri di uscita (Exit Criteria)

| Criterio | Soglia |
|---|---|
| Tutti i test P0 | 100% PASS |
| Test P1 | ≥ 95% PASS (fail documentati con bug ticket) |
| Test P2 | Best effort, non bloccanti |
| TC-ACCEPT (§15) | 27/27 PASS |
| Test su B1, B2, B3 | P0 eseguiti su tutti |
| Firebase rules verificate | Suite ADMIN + SEC completate |
| Migrazione legacy | Suite MIGR + TC-PREF-005 PASS |

---

## 9. Gestione difetti

| Priorità bug | Definizione | Azione |
|---|---|---|
| **S1 Critico** | Bypass auth, write non autorizzate, open redirect | Block release, fix immediato |
| **S2 Alto** | Flusso rotto (login, register, verify), data loss preferiti | Fix prima del lancio |
| **S3 Medio** | UX degradata, messaggi errati, FOUC | Fix pre-lancio o sprint+1 |
| **S4 Basso** | Cosmetico, edge case raro | Backlog |

### Template segnalazione bug

```
ID Bug:
TC-ID correlato:
Ambiente:
Passi riproduzione:
Risultato attuale:
Risultato atteso:
Screenshot/log:
Priorità: S1/S2/S3/S4
```

---

## 10. Riepilogo quantitativo

| Suite | Test case | P0 | P1 | P2 |
|---|---|---|---|---|
| REG | 12 | 4 | 7 | 1 |
| VERIFY | 10 | 4 | 5 | 1 |
| LOGIN | 11 | 4 | 6 | 1 |
| LOGOUT | 7 | 3 | 3 | 1 |
| SESSION | 7 | 2 | 3 | 2 |
| GUARD | 13 | 8 | 4 | 1 |
| REDIR | 8 | 4 | 3 | 1 |
| ROLE | 9 | 4 | 4 | 1 |
| ADMIN | 13 | 7 | 6 | 0 |
| PREF | 10 | 7 | 2 | 1 |
| RESET | 7 | 5 | 2 | 0 |
| SEC | 10 | 3 | 5 | 2 |
| MIGR | 6 | 3 | 3 | 0 |
| USERS | 5 | 0 | 4 | 1 |
| ACCEPT | 27 | — | — | — |
| **Totale** | **~155** | **~58** | **~57** | **~13** |

---

## 11. Storico revisioni

| Versione | Data | Modifica |
|---|---|---|
| 1.0 | 2026-06-30 | Creazione test plan iniziale |

---

## 12. Riferimenti

| Documento | Path |
|---|---|
| ADR Autenticazione | `docs/adr/001-autenticazione-e-ruoli.md` |
| Firestore Rules | `firestore.rules` |
| Setup Firebase | `SETUP.md` |

---

**Prossimo passo:** eseguire questo test plan su ambiente staging al completamento di ogni fase di implementazione (ADR §10), con riesecuzione completa prima del sign-off finale.
