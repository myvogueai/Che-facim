# ADR-002: App pubblica anonima + pannello admin autenticato

| Campo | Valore |
|---|---|
| **Stato** | Accettato — decisione ufficiale |
| **Data** | 2026-06-30 |
| **Progetto** | Che facim'? |
| **Supersedes** | [ADR-001](001-autenticazione-e-ruoli.md) (auth utente, login unificato, collection `users`) |
| **Branch chiusa** | `cursor/auth-fase-1-fondamenta-2423` (eliminata, non mergeata) |

---

## 1. Decisione

L'architettura ufficiale di Che facim'? è:

1. **App pubblica anonima** — nessuna registrazione, login, verifica email, profilo utente o route guard sull'app pubblica.
2. **Pannello admin autenticato** — Firebase Authentication serve esclusivamente a `/admin/` per il CRUD eventi su Firestore.
3. **Preferiti locali** — salvati in `localStorage` (`lucania_tonight_preferiti`), non su Firestore.
4. **Sicurezza Firestore** — scritture su `eventi` consentite solo agli admin (whitelist UID e/o custom claim `admin: true`).

Questa decisione è definitiva per il lancio e lo sviluppo corrente su `main`.

---

## 2. Contesto

L'ADR-001 prevedeva un sistema di autenticazione unificato per visitatori, utenti registrati e amministratori, con collection `users`, preferiti su Firestore e pagine `/auth/*`.

La branch `cursor/auth-fase-1-fondamenta-2423` implementava la Fase 1 di quell'ADR (login, registrazione, profili, regole `users`). Dopo valutazione:

- L'app pubblica non richiede account utente per il valore offerto (consultazione eventi e preferiti locali).
- `main` aveva già evoluto con login admin dedicato, regole più restrittive e UX migliorata (mappa, location picker, pagine legali).
- Merge della branch auth avrebbe introdotto regressioni (regole `eventi` permissive, perdita location picker admin, accoppiamento a moduli auth utente).

**Esito:** la branch auth non viene mergeata. Il codice auth utente resta solo come riferimento storico nel git history della branch eliminata, non in produzione.

---

## 3. Cosa è in produzione (`main`)

| Componente | Implementazione |
|---|---|
| Visitatore | Accesso diretto a tutte le pagine pubbliche, lettura eventi da Firestore |
| Preferiti | `public/assets/preferiti.js` → `localStorage` |
| Admin | `public/admin/index.html` — login inline Firebase Auth, CRUD via `eventi-data.js` |
| Regole | `firestore.rules` — `eventi` read pubblico, write solo `isAdmin()` |
| Auth Firebase | Signup pubblico **disabilitato** in Console; account admin creati manualmente |

---

## 4. Cosa non fa parte dell'architettura (eliminato / non implementato)

| Elemento | Stato |
|---|---|
| `public/auth/login.html`, `register.html`, ecc. | Non presenti su `main` |
| `public/assets/auth.js`, `users-data.js`, `router.js`, `auth-errors.js` | Non presenti su `main` |
| Collection Firestore `users/{uid}` | Non prevista |
| Subcollection `users/{uid}/preferiti` | Non prevista |
| Route guard sull'app pubblica | Non prevista |
| Login unificato user/admin | Non previsto |
| Workflow CI preview auth (`firebase-preview.yml`) | Rimosso da `main` |
| Test suite Fase 1 auth (`scripts/test-fase1*`) | Non presenti su `main` |

---

## 5. Conseguenze operative

1. **Non riaprire** la branch `cursor/auth-fase-1-fondamenta-2423` per merge: è archiviata e cancellata dal remote.
2. **Non reintrodurre** moduli o pagine auth utente senza un nuovo ADR esplicito.
3. **Mantenere** signup pubblico disabilitato in Firebase Authentication.
4. **Verificare** che l'UID admin sia in `firestore.rules` o abbia custom claim prima di ogni deploy produzione.
5. **Riferimento tecnico** aggiornato: [ARCHITECTURE.md](../../ARCHITECTURE.md).

---

## 6. Estensioni future

Qualsiasi reintroduzione di autenticazione utente (account, preferiti cloud, profili) richiede un **nuovo ADR** con analisi impatto su privacy, costi Firestore e UX.

---

## 7. Riferimenti

| Documento | Ruolo |
|---|---|
| [ARCHITECTURE.md](../../ARCHITECTURE.md) | Architettura tecnica vincolante |
| [SETUP.md](../../SETUP.md) | Bootstrap Firebase e admin |
| [001-autenticazione-e-ruoli.md](001-autenticazione-e-ruoli.md) | ADR storico (auth utente) — archiviato |
| [001-autenticazione-test-plan.md](001-autenticazione-test-plan.md) | Test plan storico — archiviato |
